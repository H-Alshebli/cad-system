"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

type AlertCase = {
  id: string;
  projectId?: string;
  assignedProjectId?: string;
  projectName?: string;
  assignedProjectName?: string;
  status?: string;
  chiefComplaint?: string;
  complaint?: string;

  ambulanceCode?: string | null;
  assignedAmbulanceCode?: string | null;
  assignedAmbulanceId?: string | null;
  ambulanceId?: string | null;

  assignedUnit?: {
    type?: string;
    id?: string | null;
    code?: string | null;
  } | null;

  [key: string]: any;
};

type ProjectDoc = {
  id: string;
  clientUserIds?: string[];
  assignedUsers?: string[];
  assignedUserIds?: string[];
  teamUserIds?: string[];
  assignedAmbulanceIds?: string[];
  assignedAmbulances?: Array<{ id?: string; code?: string }>;
  [key: string]: any;
};

type AmbulanceDoc = {
  id: string;
  code?: string;
  crewUserIds?: string[];
  crewMembers?: Array<{
    userId?: string;
    name?: string;
    email?: string;
    role?: string;
  }>;
  archived?: boolean;
  [key: string]: any;
};

const ALERT_AUDIO_PATH = "/sounds/alert.mp3";

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function hasAnyRole(role: string | undefined, allowed: string[]) {
  const normalized = (role || "").trim().toLowerCase();
  return allowed.includes(normalized);
}

function getCaseProjectId(c: AlertCase) {
  return c.projectId || c.assignedProjectId || "";
}

function getCaseDetailsHref(c: AlertCase) {
  const projectId = getCaseProjectId(c);

  if (projectId) {
    return `/projects/${projectId}/cad/${c.id}`;
  }

  return `/cases/${c.id}`;
}

function caseMatchesAmbulance(
  c: AlertCase,
  ambulanceIds: string[],
  ambulanceCodes: string[]
) {
  const assignedId =
    c.assignedUnit?.id ||
    c.assignedAmbulanceId ||
    c.ambulanceId ||
    "";

  const assignedCode =
    c.assignedUnit?.code ||
    c.ambulanceCode ||
    c.assignedAmbulanceCode ||
    "";

  return (
    (assignedId && ambulanceIds.includes(assignedId)) ||
    (assignedCode && ambulanceCodes.includes(assignedCode))
  );
}

function buildCaseTitle(
  c: AlertCase,
  audience: "dispatch" | "client" | "team"
) {
  if (audience === "dispatch") return "New case created";
  if (audience === "client") return "New case created in your project";
  return "New case assigned to your ambulance";
}

function buildCaseMessage(c: AlertCase) {
  const projectName =
    c.projectName || c.assignedProjectName || c.project?.name || "";

  const complaint = c.chiefComplaint || c.complaint || "";

  const ambulance =
    c.assignedUnit?.code ||
    c.ambulanceCode ||
    c.assignedAmbulanceCode ||
    "";

  const parts = [
    projectName ? `Project: ${projectName}` : null,
    complaint ? `Complaint: ${complaint}` : null,
    c.status ? `Status: ${c.status}` : null,
    ambulance ? `Ambulance: ${ambulance}` : null,
  ].filter(Boolean);

  return parts.length
    ? parts.join(" • ")
    : "Open the case details to review it.";
}

export default function CaseAlertListener() {
  const { user, loading } = useCurrentUser();

  const [clientProjects, setClientProjects] = useState<ProjectDoc[]>([]);
  const [teamProjects, setTeamProjects] = useState<ProjectDoc[]>([]);
  const [userCrewAmbulances, setUserCrewAmbulances] = useState<AmbulanceDoc[]>(
    []
  );

  const [audioReady, setAudioReady] = useState(false);
  const [alertCase, setAlertCase] = useState<AlertCase | null>(null);
  const [alertAudience, setAlertAudience] = useState<
    "dispatch" | "client" | "team"
  >("dispatch");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenCaseIdsRef = useRef<Set<string>>(new Set());
  const listenersReadyRef = useRef<Record<string, boolean>>({});

  const role = (user?.role || "").trim().toLowerCase();

  const isDispatch = hasAnyRole(role, [
    "dispatch",
    "dispatcher",
    "admin",
    "management",
  ]);

  const isClient = hasAnyRole(role, ["client", "client_portal", "customer"]);

  const isTeam = hasAnyRole(role, [
    "team",
    "ambulance",
    "response_team",
    "medical_team",
    "paramedic",
    "driver",
  ]);

  const clientProjectIds = useMemo(
    () => unique(clientProjects.map((p) => p.id)),
    [clientProjects]
  );

  const teamProjectAmbulanceIds = useMemo(() => {
    const ids: string[] = [];

    teamProjects.forEach((p) => {
      if (Array.isArray(p.assignedAmbulanceIds)) {
        ids.push(...p.assignedAmbulanceIds);
      }

      if (Array.isArray(p.assignedAmbulances)) {
        p.assignedAmbulances.forEach((a) => {
          if (a?.id) ids.push(a.id);
        });
      }
    });

    return unique(ids);
  }, [teamProjects]);

  const teamProjectAmbulanceCodes = useMemo(() => {
    const codes: string[] = [];

    teamProjects.forEach((p) => {
      if (Array.isArray(p.assignedAmbulances)) {
        p.assignedAmbulances.forEach((a) => {
          if (a?.code) codes.push(a.code);
        });
      }
    });

    return unique(codes);
  }, [teamProjects]);

  const userAmbulanceIds = useMemo(
    () =>
      unique([
        user?.ambulanceId,
        user?.assignedAmbulanceId,
        user?.unitId,
        ...(Array.isArray(user?.ambulanceIds) ? user.ambulanceIds : []),
        ...(Array.isArray(user?.assignedAmbulanceIds)
          ? user.assignedAmbulanceIds
          : []),
      ]),
    [user]
  );

  const userAmbulanceCodes = useMemo(
    () =>
      unique([
        user?.ambulanceCode,
        user?.assignedAmbulanceCode,
        user?.unitCode,
        ...(Array.isArray(user?.ambulanceCodes) ? user.ambulanceCodes : []),
        ...(Array.isArray(user?.assignedAmbulanceCodes)
          ? user.assignedAmbulanceCodes
          : []),
      ]),
    [user]
  );

  const crewAmbulanceIds = useMemo(
    () => unique(userCrewAmbulances.map((a) => a.id)),
    [userCrewAmbulances]
  );

  const crewAmbulanceCodes = useMemo(
    () => unique(userCrewAmbulances.map((a) => a.code)),
    [userCrewAmbulances]
  );

  const teamAmbulanceIds = useMemo(
    () =>
      unique([
        ...userAmbulanceIds,
        ...teamProjectAmbulanceIds,
        ...crewAmbulanceIds,
      ]),
    [userAmbulanceIds, teamProjectAmbulanceIds, crewAmbulanceIds]
  );

  const teamAmbulanceCodes = useMemo(
    () =>
      unique([
        ...userAmbulanceCodes,
        ...teamProjectAmbulanceCodes,
        ...crewAmbulanceCodes,
      ]),
    [userAmbulanceCodes, teamProjectAmbulanceCodes, crewAmbulanceCodes]
  );

  function ensureAudio() {
    if (!audioRef.current) {
      audioRef.current = new Audio(ALERT_AUDIO_PATH);
      audioRef.current.loop = false;
      audioRef.current.volume = 1;
    }

    return audioRef.current;
  }

  async function enableAudio() {
    try {
      const audio = ensureAudio();
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      setAudioReady(true);
    } catch (error) {
      console.warn("Audio permission not ready yet:", error);
      setAudioReady(false);
    }
  }

  function stopAlarm() {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  function startAlarm() {
    const audio = ensureAudio();
    stopAlarm();

    audio.currentTime = 0;
    audio.play().catch(() => {
      setAudioReady(false);
    });

    alarmIntervalRef.current = setInterval(() => {
      const replay = ensureAudio();
      replay.currentTime = 0;
      replay.play().catch(() => {
        setAudioReady(false);
      });
    }, 1600);
  }

  function openAlert(c: AlertCase, audience: "dispatch" | "client" | "team") {
    if (seenCaseIdsRef.current.has(`${audience}:${c.id}`)) return;

    seenCaseIdsRef.current.add(`${audience}:${c.id}`);
    setAlertCase(c);
    setAlertAudience(audience);
    startAlarm();
  }

  function dismissAlert() {
    stopAlarm();
    setAlertCase(null);
  }

  useEffect(() => {
    return () => stopAlarm();
  }, []);

  // Load projects where the logged-in client is assigned.
  useEffect(() => {
    if (loading || !user?.uid || !isClient) {
      setClientProjects([]);
      return;
    }

    const q = query(
      collection(db, "projects"),
      where("clientUserIds", "array-contains", user.uid)
    );

    return onSnapshot(q, (snap) => {
      setClientProjects(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      );
    });
  }, [loading, user?.uid, isClient]);

  // Load projects where a team user is assigned.
  useEffect(() => {
    if (loading || !user?.uid || !isTeam) {
      setTeamProjects([]);
      return;
    }

    const queries = [
      query(
        collection(db, "projects"),
        where(`assignedUsers.${user.uid}`, "==", true)
      ),
      query(
        collection(db, "projects"),
        where("assignedUserIds", "array-contains", user.uid)
      ),
      query(
        collection(db, "projects"),
        where("teamUserIds", "array-contains", user.uid)
      ),
    ];

    const unsubs = queries.map((q, index) =>
      onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));

          setTeamProjects((prev) => {
            const other = prev.filter(
              (p) => !list.some((x) => x.id === p.id)
            );

            return [...other, ...list];
          });
        },
        (error) => {
          console.warn(`Team project listener ${index + 1} failed`, error);
        }
      )
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [loading, user?.uid, isTeam]);

  // Load ambulances where the logged-in user is inside crewUserIds.
  // This is important because your ambulance page saves crew users here:
  // ambulances/{ambulanceId}.crewUserIds = [userId1, userId2]
  useEffect(() => {
    if (loading || !user?.uid || !isTeam) {
      setUserCrewAmbulances([]);
      return;
    }

    const q = query(
      collection(db, "ambulances"),
      where("crewUserIds", "array-contains", user.uid)
    );

    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as AmbulanceDoc))
          .filter((a) => !a.archived);

        setUserCrewAmbulances(list);
      },
      (error) => {
        console.warn("User crew ambulance listener failed", error);
        setUserCrewAmbulances([]);
      }
    );
  }, [loading, user?.uid, isTeam]);

  // Dispatch listener: alert for every new case created.
  useEffect(() => {
    if (loading || !user?.uid || !isDispatch) return;

    const listenerKey = "dispatch:all-cases";
    listenersReadyRef.current[listenerKey] = false;

    return onSnapshot(collection(db, "cases"), (snap) => {
      const changes = snap
        .docChanges()
        .filter((change) => change.type === "added");

      if (!listenersReadyRef.current[listenerKey]) {
        changes.forEach((change) =>
          seenCaseIdsRef.current.add(`dispatch:${change.doc.id}`)
        );
        listenersReadyRef.current[listenerKey] = true;
        return;
      }

      changes.forEach((change) => {
        openAlert(
          { id: change.doc.id, ...(change.doc.data() as any) },
          "dispatch"
        );
      });
    });
  }, [loading, user?.uid, isDispatch]);

  // Client listener: alert only for cases created inside the client's projects.
  useEffect(() => {
    if (loading || !user?.uid || !isClient || clientProjectIds.length === 0) {
      return;
    }

    const chunks = chunkArray(clientProjectIds, 10);

    const unsubs = chunks.map((ids) => {
      const listenerKey = `client:${ids.join("|")}`;
      listenersReadyRef.current[listenerKey] = false;

      const q = query(collection(db, "cases"), where("projectId", "in", ids));

      return onSnapshot(q, (snap) => {
        const changes = snap
          .docChanges()
          .filter((change) => change.type === "added");

        if (!listenersReadyRef.current[listenerKey]) {
          changes.forEach((change) =>
            seenCaseIdsRef.current.add(`client:${change.doc.id}`)
          );
          listenersReadyRef.current[listenerKey] = true;
          return;
        }

        changes.forEach((change) => {
          openAlert(
            { id: change.doc.id, ...(change.doc.data() as any) },
            "client"
          );
        });
      });
    });

    return () => unsubs.forEach((unsub) => unsub());
  }, [loading, user?.uid, isClient, clientProjectIds.join("|")]);

  // Team listener:
  // It listens to added and modified because sometimes the case is created first,
  // then assigned to the ambulance after.
  useEffect(() => {
    if (loading || !user?.uid || !isTeam) return;

    if (teamAmbulanceIds.length === 0 && teamAmbulanceCodes.length === 0) {
      console.warn("Team alert listener skipped: no ambulance assigned to user", {
        userId: user.uid,
        userRole: user.role,
        userAmbulanceIds,
        userAmbulanceCodes,
        crewAmbulanceIds,
        crewAmbulanceCodes,
      });
      return;
    }

    const listenerKey = `team:${teamAmbulanceIds.join(
      "|"
    )}:${teamAmbulanceCodes.join("|")}`;

    listenersReadyRef.current[listenerKey] = false;

    return onSnapshot(collection(db, "cases"), (snap) => {
      const changes = snap
        .docChanges()
        .filter(
          (change) => change.type === "added" || change.type === "modified"
        );

      if (!listenersReadyRef.current[listenerKey]) {
        snap.docs.forEach((docSnap) =>
          seenCaseIdsRef.current.add(`team:${docSnap.id}`)
        );

        listenersReadyRef.current[listenerKey] = true;
        return;
      }

      changes.forEach((change) => {
        const c = {
          id: change.doc.id,
          ...(change.doc.data() as any),
        } as AlertCase;

        if (caseMatchesAmbulance(c, teamAmbulanceIds, teamAmbulanceCodes)) {
          openAlert(c, "team");
        }
      });
    });
  }, [
    loading,
    user?.uid,
    isTeam,
    teamAmbulanceIds.join("|"),
    teamAmbulanceCodes.join("|"),
    userAmbulanceIds.join("|"),
    userAmbulanceCodes.join("|"),
    crewAmbulanceIds.join("|"),
    crewAmbulanceCodes.join("|"),
  ]);

  if (loading || !user?.uid) return null;

  return (
    <>
      {!audioReady && (
        <button
          onClick={enableAudio}
          className="fixed bottom-4 right-4 z-[70] rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-red-700"
        >
          Enable Alerts
        </button>
      )}

      {alertCase && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-slate-950 p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-red-600 px-3 py-2 text-xl">
                🚨
              </div>

              <div>
                <h2 className="text-xl font-bold text-red-300">
                  {buildCaseTitle(alertCase, alertAudience)}
                </h2>

                <p className="mt-2 text-sm text-slate-300">
                  {buildCaseMessage(alertCase)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={dismissAlert}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Stop Alarm
              </button>

              <Link
                href={getCaseDetailsHref(alertCase)}
                onClick={dismissAlert}
                className="rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-red-700"
              >
                Open Case
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}