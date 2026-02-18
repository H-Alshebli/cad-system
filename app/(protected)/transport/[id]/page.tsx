// app/(protected)/transport/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import { sendEmail } from "../emailClient";
import { buildEmail } from "../emailTemplates";

import type { TransportRequest, TransportStatus, TeamRow } from "../types";
import { STATUS_LABEL, type TransportRole } from "../constants";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { can } from "@/lib/can";

function Tag({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-white/10 px-2 py-1 text-xs ring-1 ring-white/10">
      {text}
    </span>
  );
}

/* =========================
   NEW: Team Composition Labels
========================= */
const TEAM_COMPOSITION_LABEL: Record<string, string> = {
  doctor_emt: "Doctor + EMT",
  paramedic: "Paramedic",
  emt_paramedic: "EMT + Paramedic",
  driver_paramedic: "Driver + Paramedic",
  nurse_doctor: "Nurse + Doctor",
  none: "No team required",
};

function teamLabel(composition?: string) {
  if (!composition) return "—";
  return TEAM_COMPOSITION_LABEL[composition] || composition;
}

function safeDate(v?: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
function pickEmail(v?: any) {
  const s = String(v || "").trim();
  return s.includes("@") ? s : "";
}

export default function TransportDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const { user, loading } = useCurrentUser();

  const roleName = user?.role ?? "none";
  const { permissions, loading: permLoading } = usePermissions(roleName);

  const [data, setData] = useState<TransportRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignedAmbulanceId, setAssignedAmbulanceId] = useState("");
  const [assignedTeamName, setAssignedTeamName] = useState("");
  const [assignedCrew, setAssignedCrew] = useState<string>("");

  // Reject note
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "transport_requests", id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setData(null);
          return;
        }
        setData({ id: snap.id, ...(snap.data() as any) });
      },
      (e) => setError(e?.message || "Failed to load the request.")
    );
    return () => unsub();
  }, [id]);

  const role = useMemo<TransportRole>(() => {
    return (((user as any)?.role || "unknown") as TransportRole);
  }, [user]);

  const isAdmin = role === "admin";

  // ✅ Permission booleans
  const canView = isAdmin || can(permissions, "transport", "view");
  const canOps = isAdmin || can(permissions, "transport", "ops");
  const canApprove = isAdmin || can(permissions, "transport", "approve");
  const canAssign = isAdmin || can(permissions, "transport", "assign");
  const canReject = isAdmin || can(permissions, "transport", "reject");

  // Helper: send email safely (recipientGroup always LAST)
function fireEmail(
  fallbackGroup: "OPS" | "SALES",
  args: Parameters<typeof buildEmail>[0],
  to?: string
) {
  try {
    const email = buildEmail(args);
    const direct = pickEmail(to);

    // ✅ if we have direct recipient, use it. otherwise fallback to group
    const payload = direct
      ? { ...email, to: direct }
      : { ...email, recipientGroup: fallbackGroup };

    void sendEmail(payload as any).catch(console.error);
  } catch (e) {
    console.error("buildEmail failed:", e);
  }
}


  async function setStatus(next: TransportStatus, note?: string) {
    if (!id || !user?.uid) return;
    const requestId = String(id);

    setError("");

    if (!data) return;
    const current = data.status;

    const allowed =
      (next === "ops_available" && canOps && current === "new") ||
      (next === "rejected" && canOps && current === "new") ||
      (next === "rejected" && canReject && current === "ops_available") ||
      (next === "client_approved" && canApprove && current === "ops_available");

    if (!allowed) {
      setError("You are not allowed to perform this action.");
      return;
    }

    setBusy(true);
    try {
      const ref = doc(db, "transport_requests", id);

      const patch: any = {
        status: next,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };

      // ====== Build Firestore patch ======
      if (next === "ops_available") {
        patch.opsDecidedAt = serverTimestamp();
        patch.opsDecidedBy = user.uid;
        patch.opsDecisionNote = note || "";
      }

      if (next === "rejected") {
        // Ops Reject (from NEW)
        if (current === "new") {
          patch.opsDecidedAt = serverTimestamp();
          patch.opsDecidedBy = user.uid;
          patch.opsDecisionNote = note || "";
        }

        // Sales Reject (from OPS_AVAILABLE)
        if (current === "ops_available") {
          patch.salesRejectedAt = serverTimestamp();
          patch.salesRejectedBy = user.uid;
          patch.salesRejectNote = note || "";
        }
      }

      if (next === "client_approved") {
        patch.clientApprovedAt = serverTimestamp();
        patch.clientApprovedBy = user.uid;
      }
      // ✅ NEW: capture ops owner the first time Ops touches the request
const currentOpsOwner = pickEmail((data as any)?.opsOwnerEmail);
if (canOps && !currentOpsOwner) {
  patch.opsOwnerUid = user.uid;
  patch.opsOwnerEmail = (user as any)?.email || "";
}


      // ✅ 1) Update DB first
      await updateDoc(ref, patch);

      // ✅ 2) Build a SAFE request object for email (avoid serverTimestamp values)
      const reqForEmail: any = {
        ...data,
        status: next,
      };

      if (next === "ops_available") {
        reqForEmail.opsDecisionNote = note || "";
      }

      if (next === "rejected") {
        if (current === "new") reqForEmail.opsDecisionNote = note || "";
        if (current === "ops_available") reqForEmail.salesRejectNote = note || "";
      }

      // ✅ 3) Send email AFTER success (exact mapping)
      if (next === "ops_available") {
        // Ops -> Sales
     const salesTo = pickEmail((data as any)?.salesOwnerEmail);

fireEmail(
  "SALES",
  { type: "OPS_AVAILABLE", req: reqForEmail, id: requestId },
  salesTo
);

      }

      if (next === "rejected") {
        if (current === "new") {
          // Ops Reject -> Sales
         const salesTo = pickEmail((data as any)?.salesOwnerEmail);

fireEmail(
  "SALES",
  { type: "OPS_REJECT", req: reqForEmail, id: requestId, note },
  salesTo
);

        }

        if (current === "ops_available") {
          // Sales Reject -> Ops
         const opsTo = pickEmail((data as any)?.opsOwnerEmail);

fireEmail(
  "OPS",
  { type: "CLIENT_REJECT", req: reqForEmail, id: requestId, note },
  opsTo
);

        }
      }

      if (next === "client_approved") {
        // Sales Approve -> Ops
     const opsTo = pickEmail((data as any)?.opsOwnerEmail);

fireEmail(
  "OPS",
  { type: "CLIENT_APPROVED", req: reqForEmail, id: requestId },
  opsTo
);

      }

      // local UI update
      setData((prev) => (prev ? { ...prev, status: next } : prev));

      setRejectNote("");
    } catch (e: any) {
      setError(e?.message || "Failed to update status.");
    } finally {
      setBusy(false);
    }
  }

  async function onAssign() {
    if (!id || !user?.uid) return;
    const requestId = String(id);

    setError("");

    if (!data) return;

    if (!(canAssign && data.status === "client_approved")) {
      setError("You are not allowed to assign at this stage.");
      return;
    }

    if (!assignedTeamName.trim()) {
      setError("Team name/code is required.");
      return;
    }

    setBusy(true);
    try {
      const ref = doc(db, "transport_requests", id);

      const crewArr = assignedCrew
        ? assignedCrew.split(",").map((x) => x.trim()).filter(Boolean)
        : [];

      await updateDoc(ref, {
        status: "assigned",
        assignedAt: serverTimestamp(),
        assignedBy: user.uid,
        assignedAmbulanceId: assignedAmbulanceId.trim() || "",
        assignedTeamName: assignedTeamName.trim(),
        assignedCrew: crewArr,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      // ✅ Assign -> Sales (safe req object)
      const reqForEmail: any = {
        ...data,
        status: "assigned",
        assignedAmbulanceId: assignedAmbulanceId.trim() || "",
        assignedTeamName: assignedTeamName.trim(),
        assignedCrew: crewArr,
      };

    const salesTo = pickEmail((data as any)?.salesOwnerEmail);

fireEmail(
  "SALES",
  { type: "ASSIGNED", req: reqForEmail, id: requestId },
  salesTo
);


      setAssignOpen(false);
    } catch (e: any) {
      setError(e?.message || "Failed to assign.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || permLoading) {
    return <div className="p-6 text-sm text-white/70">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-6 text-white">
        <div className="rounded-xl bg-red-500/10 p-4 ring-1 ring-red-500/20">
          You must be signed in.
        </div>
        <button
          onClick={() => router.push("/login")}
          className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/15"
        >
          Go to login
        </button>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6 text-white">
        <div className="rounded-xl bg-red-500/10 p-4 ring-1 ring-red-500/20">
          Missing or insufficient permissions.
        </div>
        <button
          onClick={() => router.push("/transport")}
          className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/15"
        >
          Back
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-white">
        <div className="rounded-xl bg-red-500/10 p-4 ring-1 ring-red-500/20">
          Request not found.
        </div>
        <button
          onClick={() => router.push("/transport")}
          className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/15"
        >
          Back
        </button>
      </div>
    );
  }

  const status = data.status;

  // =========================
  // NEW: computed display helpers
  // =========================
  const startDT = safeDate((data as any).serviceStartTime) || safeDate(data.serviceTime);
  const endDT = safeDate((data as any).serviceEndTime);

  const projectTypeLabel =
    (data as any).projectType === "coverage"
      ? "Coverage"
      : (data as any).projectType === "transporting"
      ? "Transporting"
      : "—";

  const teamsArr = ((data as any).teams as TeamRow[] | undefined) || [];
  const hasTeams = teamsArr.length > 0;

  const teamNeeded =
    typeof data.teamNeeded === "boolean" ? data.teamNeeded : hasTeams;

  const totalTeamsQty =
    hasTeams
      ? teamsArr.reduce((sum, t) => sum + (Number(t.qty) || 0), 0)
      : Number((data as any).teamCount || 0);

  const roamingNeeded = Boolean((data as any).roamingNeeded);
  const roamingCount = Number((data as any).roamingCount || 0);

  return (
    <div className="p-6 text-white">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transport Request Details</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag text={`Status: ${STATUS_LABEL[status] || status}`} />
            {isAdmin ? <Tag text="Role: Admin" /> : null}
            {!isAdmin && canApprove ? <Tag text="Permission: Approve" /> : null}
            {!isAdmin && canOps ? <Tag text="Permission: Ops" /> : null}
            {!isAdmin && canAssign ? <Tag text="Permission: Assign" /> : null}
          </div>
        </div>

        <button
          onClick={() => router.push("/transport")}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
        >
          Back to list
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm ring-1 ring-red-500/20">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Request Info */}
        <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <h2 className="mb-3 text-sm font-semibold text-white/80">
            Request Info
          </h2>

          <div className="grid gap-2 text-sm">
            {/* NEW: Project Type */}
            <div className="flex justify-between gap-3">
              <span className="text-white/70">Project Type</span>
              <span className="font-medium">{projectTypeLabel}</span>
            </div>

            {/* Service Type (ALS/BLS) */}
            <div className="flex justify-between gap-3">
              <span className="text-white/70">Service Type</span>
              <span className="font-medium">{(data as any).serviceType || "—"}</span>
            </div>

            {/* NEW: Start/End time */}
            <div className="flex justify-between gap-3">
              <span className="text-white/70">Start</span>
              <span className="font-medium">
                {startDT ? startDT.toLocaleString() : "—"}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-white/70">End</span>
              <span className="font-medium">
                {endDT ? endDT.toLocaleString() : "—"}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-white/70">City Scope</span>
              <span className="font-medium">
                {data.cityScope === "inside" ? "Inside City" : "Outside City"}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-white/70">City</span>
              <span className="font-medium">{data.cityName || "—"}</span>
            </div>

            <div className="mt-2 rounded-lg bg-black/20 p-3 ring-1 ring-white/10">
              <div className="text-xs text-white/70">Requirements</div>
              <div className="mt-1 text-sm">{data.requirements || "—"}</div>
            </div>
          </div>
        </div>

        {/* Resources Requested */}
        <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <h2 className="mb-3 text-sm font-semibold text-white/80">
            Resources Requested
          </h2>

          <div className="grid gap-2 text-sm">
            {/* Teams (new multi rows) */}
            <div className="flex justify-between gap-3">
              <span className="text-white/70">Team required</span>
              <span className="font-medium">{teamNeeded ? "Yes" : "No"}</span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-white/70">Team count</span>
              <span className="font-medium">{totalTeamsQty}</span>
            </div>

            {/* NEW: show teams breakdown if exists, otherwise show legacy */}
            {hasTeams ? (
              <div className="mt-2 rounded-lg bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/70">Teams breakdown</div>
                <div className="mt-2 grid gap-2">
                  {teamsArr.map((t, idx) => (
                    <div
                      key={`${t.composition}-${idx}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-white/80">{teamLabel(t.composition)}</span>
                      <span className="font-medium">{Number(t.qty) || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex justify-between gap-3">
                <span className="text-white/70">Team type</span>
                <span className="font-medium">{(data as any).teamType || "—"}</span>
              </div>
            )}

            {/* Ambulance */}
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-white/70">Ambulance required</span>
              <span className="font-medium">
                {data.ambulanceNeeded ? "Yes" : "No"}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-white/70">Ambulance count</span>
              <span className="font-medium">{data.ambulanceCount ?? 0}</span>
            </div>

            {/* NEW: Roaming */}
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-white/70">Roaming required</span>
              <span className="font-medium">{roamingNeeded ? "Yes" : "No"}</span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-white/70">Roaming count</span>
              <span className="font-medium">{roamingNeeded ? roamingCount : 0}</span>
            </div>

            {/* Days / Hours */}
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/70">Days</div>
                <div className="mt-1 text-sm font-medium">
                  {data.daysCount ?? 0}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/70">Hours</div>
                <div className="mt-1 text-sm font-medium">
                  {data.hoursCount ?? 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Phase 1 Actions */}
        <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-white/80">
            Phase 1 Actions
          </h2>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-white/70">
              Buttons appear based on permissions and request status.
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {canOps && status === "new" ? (
                <button
                  disabled={busy}
                  onClick={() => setStatus("ops_available", "")}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-60"
                >
                  Mark as Available
                </button>
              ) : null}

              {canOps && status === "new" ? (
                <>
                  <input
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    className="h-9 w-56 rounded-lg bg-black/20 px-3 text-sm ring-1 ring-white/10 outline-none placeholder:text-white/40 focus:ring-white/20"
                    placeholder="Ops reject reason (required)"
                  />
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (!rejectNote.trim()) {
                        setError("Reject reason is required.");
                        return;
                      }
                      setStatus("rejected", rejectNote.trim());
                    }}
                    className="h-9 rounded-lg bg-red-500/15 px-4 text-sm font-medium ring-1 ring-red-500/25 hover:bg-red-500/20 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </>
              ) : null}

              {canApprove && status === "ops_available" ? (
                <button
                  disabled={busy}
                  onClick={() => setStatus("client_approved")}
                  className="h-9 rounded-lg bg-emerald-500/15 px-4 text-sm font-medium ring-1 ring-emerald-500/25 hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  Client Approved
                </button>
              ) : null}

              {canReject && status === "ops_available" ? (
                <>
                  <input
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    className="h-9 w-56 rounded-lg bg-black/20 px-3 text-sm ring-1 ring-white/10 outline-none placeholder:text-white/40 focus:ring-white/20"
                    placeholder="Client reject reason (required)"
                  />
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (!rejectNote.trim()) {
                        setError("Reject reason is required.");
                        return;
                      }
                      setStatus("rejected", rejectNote.trim());
                    }}
                    className="h-9 rounded-lg bg-red-500/15 px-4 text-sm font-medium ring-1 ring-red-500/25 hover:bg-red-500/20 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </>
              ) : null}

              {canAssign && status === "client_approved" ? (
                <button
                  disabled={busy}
                  onClick={() => {
                    setAssignedAmbulanceId((data as any).assignedAmbulanceId || "");
                    setAssignedTeamName((data as any).assignedTeamName || "");
                    setAssignedCrew(((data as any).assignedCrew || []).join(", "));
                    setAssignOpen(true);
                  }}
                  className="h-9 rounded-lg bg-sky-500/15 px-4 text-sm font-medium ring-1 ring-sky-500/25 hover:bg-sky-500/20 disabled:opacity-60"
                >
                  Assign Team
                </button>
              ) : null}
            </div>
          </div>

          {(data as any).opsDecisionNote ? (
            <div className="mt-4 rounded-lg bg-black/20 p-3 text-sm ring-1 ring-white/10">
              <div className="text-xs text-white/70">Ops Note</div>
              <div className="mt-1">{(data as any).opsDecisionNote}</div>
            </div>
          ) : null}

          {(data as any).salesRejectNote ? (
            <div className="mt-4 rounded-lg bg-black/20 p-3 text-sm ring-1 ring-white/10">
              <div className="text-xs text-white/70">Sales Reject Note</div>
              <div className="mt-1">{(data as any).salesRejectNote}</div>
            </div>
          ) : null}

          {data.status === "assigned" ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/70">Team</div>
                <div className="mt-1 text-sm font-medium">
                  {(data as any).assignedTeamName || "—"}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/70">Ambulance</div>
                <div className="mt-1 text-sm font-medium">
                  {(data as any).assignedAmbulanceId || "—"}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/70">Crew</div>
                <div className="mt-1 text-sm font-medium">
                  {(data as any).assignedCrew?.length
                    ? (data as any).assignedCrew.join(", ")
                    : "—"}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Assign Modal */}
      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#0b1220] p-5 ring-1 ring-white/15">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Assign Team</h3>
              <button
                onClick={() => setAssignOpen(false)}
                className="rounded-lg bg-white/5 px-3 py-1 text-sm ring-1 ring-white/10 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="block text-xs text-white/70">
                  Team name/code
                </label>
                <input
                  value={assignedTeamName}
                  onChange={(e) => setAssignedTeamName(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-black/20 px-3 py-2 text-sm ring-1 ring-white/10 outline-none"
                  placeholder="e.g., Team-01"
                />
              </div>

              <div>
                <label className="block text-xs text-white/70">
                  Ambulance ID (optional)
                </label>
                <input
                  value={assignedAmbulanceId}
                  onChange={(e) => setAssignedAmbulanceId(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-black/20 px-3 py-2 text-sm ring-1 ring-white/10 outline-none"
                  placeholder="e.g., AMB-12"
                />
              </div>

              <div>
                <label className="block text-xs text-white/70">
                  Crew names (optional) — comma separated
                </label>
                <input
                  value={assignedCrew}
                  onChange={(e) => setAssignedCrew(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-black/20 px-3 py-2 text-sm ring-1 ring-white/10 outline-none"
                  placeholder="e.g., Ahmed, Khalid, Saad"
                />
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm ring-1 ring-red-500/20">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setAssignOpen(false)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={onAssign}
                className="rounded-lg bg-sky-500/15 px-4 py-2 text-sm font-medium ring-1 ring-sky-500/25 hover:bg-sky-500/20 disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save Assignment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
