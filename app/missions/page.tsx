"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import {
  doesChecklistShiftMatch,
  getChecklistDeploymentTypeFromMission,
  getProjectReadinessSettings,
  getRiyadhDateKey,
  getUnitCodeFromMission,
  getUnitIdFromMission,
  isMissionActive,
  isProjectMission,
  normalizeDeploymentType,
  resolveCurrentProjectShift,
} from "@/lib/readinessChecklist";
import {
  getB2CRequestDisplay,
  getCaseDisplayCode,
  getCaseDisplayTitle,
  getUnitDisplayName,
} from "@/lib/displayLabels";

function getDateValue(item: any) {
  const raw =
    item.createdAt ||
    item.timeline?.receivedAt ||
    item.requestedAt ||
    item.requestedTransportAt;

  return raw?.toDate?.() || (raw ? new Date(raw) : null);
}

function getB2CDateValue(item: any) {
  const raw = item.requestedTransportAt || item.createdAt;
  return raw?.toDate?.() || (raw ? new Date(raw) : null);
}

function formatDate(value: any) {
  if (!value) return "-";
  const date = value?.toDate?.() || new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function isUserAssignedToB2CRequest(request: any, user: any) {
  const assigned = Array.isArray(request?.plannedAssignment?.assignedUserIds)
    ? request.plannedAssignment.assignedUserIds
    : [];

  return Boolean(user?.uid && assigned.includes(user.uid));
}

function isUserAssignedToCase(item: any, user: any) {
  const assigned = Array.isArray(item.assignedUserIds)
    ? item.assignedUserIds
    : [];

  return Boolean(user?.uid && assigned.includes(user.uid));
}

function isUserAssignedToAmbulance(ambulance: any, user: any) {
  if (!user?.uid) return false;

  const assignedIds = [
    ...(Array.isArray(ambulance?.assignedUserIds) ? ambulance.assignedUserIds : []),
    ...(Array.isArray(ambulance?.crewUserIds) ? ambulance.crewUserIds : []),
  ].filter(Boolean);

  if (assignedIds.includes(user.uid)) return true;

  if (Array.isArray(ambulance?.crewMembers)) {
    return ambulance.crewMembers.some((member: any) => member?.userId === user.uid);
  }

  return false;
}

function getAmbulanceProjectId(ambulance: any) {
  return ambulance?.assignedProjectId || ambulance?.projectId || "";
}

function getAmbulanceUnitId(ambulance: any) {
  return String(
    ambulance?.id ||
      ambulance?.unitId ||
      ambulance?.ambulanceId ||
      ambulance?.code ||
      ambulance?.unitCode ||
      ambulance?.ambulanceCode ||
      ""
  ).trim();
}

function getAmbulanceUnitCode(ambulance: any) {
  return String(
    ambulance?.unitCode ||
      ambulance?.code ||
      ambulance?.ambulanceCode ||
      ambulance?.vehicleCode ||
      ambulance?.callSign ||
      ambulance?.name ||
      getAmbulanceUnitId(ambulance)
  ).trim();
}

function getPreparationStatus(request: any) {
  const acknowledgement = request?.preparationAcknowledgement || {};

  if (acknowledgement?.acknowledged) {
    return `Acknowledged by ${
      acknowledgement.acknowledgedByName ||
      request.preparationAcknowledgedByName ||
      "Team"
    }`;
  }

  return "Pending";
}

function getB2CRequestIdFromCase(item: any) {
  return item.sourceRequestId || item.b2cRequestId || item.b2cRequest?.id || "";
}

function isB2CCase(item: any) {
  const source = String(item.sourceType || item.caseType || "").toLowerCase();
  return source === "b2c" || Boolean(getB2CRequestIdFromCase(item));
}

function isClosedCase(item: any) {
  const status = String(item.status || item.dispatchStatus || "").toLowerCase();
  return status === "closed" || status === "completed" || status === "cancelled";
}

function getMissionLocation(item: any) {
  return (
    item.pickup?.text ||
    item.pickupText ||
    item.location?.text ||
    item.locationText ||
    "-"
  );
}

function getMissionDestination(item: any) {
  return (
    item.destination?.text ||
    item.destinationText ||
    item.dropoff?.text ||
    item.dropoffText ||
    "-"
  );
}

function getMissionPatient(item: any) {
  return item.patientName || item.patient?.name || "-";
}

function getMissionMobile(item: any) {
  return (
    item.mobile ||
    item.phone ||
    item.patientMobile ||
    item.patient?.mobile ||
    item.patient?.phone ||
    "-"
  );
}

function getMissionUnit(item: any) {
  return (
    getUnitDisplayName(
      item.assignedUnit || {
        unitCode:
          item.assignedAmbulanceCode ||
          item.unitCode ||
          item.plannedAssignment?.unitCode ||
          item.plannedAssignment?.unitName,
      }
    ) || getUnitCodeFromMission(item) || "-"
  );
}

function getMissionStatus(item: any) {
  return item.dispatchStatus || item.status || "-";
}

function isChecklistDone(checklist: any) {
  const status = String(checklist?.status || "").toLowerCase();
  return status === "submitted" || status === "approved";
}

function getChecklistStatusLabel(checklist: any) {
  if (!checklist) return "Not started";
  const status = String(checklist.status || "draft").replaceAll("_", " ");
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getChecklistCreatedMs(checklist: any) {
  return (
    checklist?.submittedAtMs ||
    checklist?.startedAtMs ||
    checklist?.createdAt?.toDate?.()?.getTime?.() ||
    0
  );
}

function getMissionProjectId(item: any) {
  if (isB2CCase(item)) return "_b2c";
  return item.projectId || item.assignedProjectId || "";
}

type ChecklistContext = {
  key: string;
  projectId: string;
  projectName: string;
  unitId: string;
  unitCode: string;
  dateKey: string;
  shiftKey: string;
  shiftId?: string;
  deploymentType: string;
};

function buildChecklistContexts(missions: any[], projects: any[]) {
  const seen = new Set<string>();
  const contexts: ChecklistContext[] = [];

  missions.forEach((mission) => {
    if (!isProjectMission(mission) || !isMissionActive(mission)) return;

    const projectId = getMissionProjectId(mission);
    const unitId = getUnitIdFromMission(mission);
    if (!projectId || !unitId) return;

    const project = projects.find((entry) => entry.id === projectId);
    const resolvedShift = resolveCurrentProjectShift(project?.shiftSchedule);
    const dateKey = resolvedShift.shiftDate;
    const shiftKey = resolvedShift.shiftName;
    const shiftId = resolvedShift.shiftId;
    const deploymentType = project
      ? getProjectReadinessSettings(project, unitId).deploymentType
      : getChecklistDeploymentTypeFromMission(mission);
    const key = [
      projectId,
      unitId,
      dateKey,
      shiftId || shiftKey,
      normalizeDeploymentType(deploymentType),
    ].join("|");

    if (seen.has(key)) return;
    seen.add(key);

    contexts.push({
      key,
      projectId,
      projectName: mission.projectName || mission.assignedProjectName || "Project",
      unitId,
      unitCode: getUnitCodeFromMission(mission) || unitId,
      dateKey,
      shiftKey,
      shiftId,
      deploymentType,
    });
  });

  return contexts;
}

function buildChecklistContextsFromExistingChecklists(checklists: any[], user: any) {
  const today = getRiyadhDateKey();
  const seen = new Set<string>();
  const contexts: ChecklistContext[] = [];

  checklists.forEach((checklist) => {
    if (!checklist?.unitId || !checklist?.projectId || checklist?.dateKey !== today) return;

    const belongsToUser =
      checklist.inspectorUserId === user?.uid ||
      checklist.inspectorName === user?.displayName ||
      checklist.inspectorName === user?.name ||
      checklist.inspectorName === user?.fullName ||
      checklist.inspectorName === user?.email;

    if (!belongsToUser) return;

    const deploymentType = normalizeDeploymentType(
      checklist.deploymentType || checklist.checklistCategory || "Ambulance"
    );
    const key = [
      checklist.projectId,
      checklist.unitId,
      checklist.dateKey,
      checklist.shiftId || checklist.shiftKey || "Day",
      deploymentType,
    ].join("|");

    if (seen.has(key)) return;
    seen.add(key);

    contexts.push({
      key,
      projectId: checklist.projectId,
      projectName: checklist.projectName || "Project",
      unitId: checklist.unitId,
      unitCode: checklist.unitCode || checklist.unitId,
      dateKey: checklist.dateKey,
      shiftKey: checklist.shiftKey || "Day",
      shiftId: checklist.shiftId || checklist.shiftKey || "Day",
      deploymentType,
    });
  });

  return contexts;
}

function buildChecklistContextsFromAssignedAmbulances(
  ambulances: any[],
  projects: any[],
  user: any
) {
  const seen = new Set<string>();
  const contexts: ChecklistContext[] = [];

  ambulances.forEach((ambulance) => {
    if (!isUserAssignedToAmbulance(ambulance, user)) return;

    const projectId = getAmbulanceProjectId(ambulance);
    const unitId = getAmbulanceUnitId(ambulance);
    if (!projectId || !unitId) return;

    const project = projects.find((entry) => entry.id === projectId);
    if (!project) return;

    const resolvedShift = resolveCurrentProjectShift(project?.shiftSchedule);
    const deploymentType = getProjectReadinessSettings(project, unitId).deploymentType;
    const key = [
      projectId,
      unitId,
      resolvedShift.shiftDate,
      resolvedShift.shiftId || resolvedShift.shiftName,
      deploymentType,
    ].join("|");

    if (seen.has(key)) return;
    seen.add(key);

    contexts.push({
      key,
      projectId,
      projectName: project.projectName || project.name || ambulance.projectName || "Project",
      unitId,
      unitCode: getAmbulanceUnitCode(ambulance) || unitId,
      dateKey: resolvedShift.shiftDate,
      shiftKey: resolvedShift.shiftName,
      shiftId: resolvedShift.shiftId,
      deploymentType,
    });
  });

  return contexts;
}

function mergeChecklistContexts(...groups: ChecklistContext[][]) {
  const seen = new Set<string>();
  const merged: ChecklistContext[] = [];

  groups.flat().forEach((context) => {
    if (seen.has(context.key)) return;
    seen.add(context.key);
    merged.push(context);
  });

  return merged;
}

function findChecklistForContext(
  checklists: any[],
  context: ChecklistContext,
  phase: "opening" | "closing"
) {
  const normalizedDeployment = normalizeDeploymentType(context.deploymentType);

  return checklists
    .filter((entry) => {
      return (
        entry.unitId === context.unitId &&
        entry.dateKey === context.dateKey &&
        doesChecklistShiftMatch(entry, context.shiftKey, context.shiftId) &&
        (entry.checklistPhase || "opening") === phase &&
        normalizeDeploymentType(
          entry.deploymentType || entry.checklistCategory || "Ambulance"
        ) === normalizedDeployment
      );
    })
    .sort((a, b) => getChecklistCreatedMs(b) - getChecklistCreatedMs(a))[0];
}

export default function MyMissionsPage() {
  const { user, loading } = useCurrentUser();
  const { can } = usePermissions(user?.role);

  const [cases, setCases] = useState<any[]>([]);
  const [b2cRequests, setB2CRequests] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [showAllForTesting] = useState(false);
  const [showClosedMissions, setShowClosedMissions] = useState(false);

  useEffect(() => {
    if (loading || !user?.uid || user.active === false) return;

    const listen = (
      collectionName: string,
      onData: (rows: any[]) => void
    ) =>
      onSnapshot(
        collection(db, collectionName),
        (snap) => {
          onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (error) => {
          console.warn(`Missions ${collectionName} listener failed`, error);
          onData([]);
        }
      );

    const unsubCases = listen("cases", setCases);
    const unsubB2C = listen("b2cRequests", setB2CRequests);
    const unsubChecklists = listen("projectChecklists", setChecklists);
    const unsubProjects = listen("projects", setProjects);
    const unsubAmbulances = listen("ambulances", setAmbulances);

    return () => {
      unsubCases();
      unsubB2C();
      unsubChecklists();
      unsubProjects();
      unsubAmbulances();
    };
  }, [loading, user?.uid, user?.active]);

  const normalizedRole = String(user?.role || "").toLowerCase();
  const isAdmin =
    normalizedRole === "admin" ||
    normalizedRole === "super_admin" ||
    normalizedRole === "superadmin";

  const upcomingB2CRequests = useMemo(() => {
    const list = b2cRequests.filter((request) => {
      if (request.requestStatus === "Cancelled") return false;
      if (request.requestStatus === "Rejected") return false;
      if (request.cadCaseId) return false;
      if (showAllForTesting || isAdmin) return true;
      return isUserAssignedToB2CRequest(request, user);
    });

    return list.sort((a, b) => {
      const ad = getB2CDateValue(a)?.getTime?.() || 0;
      const bd = getB2CDateValue(b)?.getTime?.() || 0;
      return ad - bd;
    });
  }, [b2cRequests, showAllForTesting, isAdmin, user]);

  const activeMissions = useMemo(() => {
    const list = cases.filter((item) => {
      if (!showClosedMissions && isClosedCase(item)) return false;
      if (showAllForTesting || isAdmin) return true;
      return isUserAssignedToCase(item, user);
    });

    return list.sort((a, b) => {
      const ad = getDateValue(a)?.getTime?.() || 0;
      const bd = getDateValue(b)?.getTime?.() || 0;
      return bd - ad;
    });
  }, [cases, showAllForTesting, showClosedMissions, isAdmin, user]);

  const checklistContexts = useMemo(
    () => {
      const existingChecklistContexts = buildChecklistContextsFromExistingChecklists(checklists, user);
      const missionChecklistContexts = buildChecklistContexts(activeMissions, projects);
      const assignedAmbulanceContexts = buildChecklistContextsFromAssignedAmbulances(
        ambulances,
        projects,
        user
      );
      return mergeChecklistContexts(
        existingChecklistContexts,
        assignedAmbulanceContexts,
        missionChecklistContexts
      );
    },
    [activeMissions, ambulances, checklists, projects, user]
  );

  const checklistCards = useMemo(() => {
    return checklistContexts.map((context) => {
      const opening = findChecklistForContext(checklists, context, "opening");
      const closing = findChecklistForContext(checklists, context, "closing");
      const openingDone = isChecklistDone(opening);
      const closingDone = isChecklistDone(closing);
      const phase = openingDone ? "closing" : "opening";
      const current = openingDone ? closing : opening;

      return {
        context,
        current,
        phase,
        hidden: openingDone && closingDone,
        title: openingDone ? "Closing Checklist" : "Opening Checklist",
        description: openingDone
          ? "End of shift readiness closure for this unit."
          : "Start of shift unit readiness before CAD missions.",
        status: getChecklistStatusLabel(current),
        sourceChecklistId: openingDone ? opening?.id || "" : "",
      };
    }).filter((card) => !card.hidden);
  }, [checklistContexts, checklists]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading missions...</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">My Missions</h1>
            <p className="page-subtitle">
              Complete unit readiness once per shift, then open assigned CAD missions.
            </p>
          </div>

          {can("readiness_checklists", "create") && (
            <Link className="btn-secondary" href="/projects/_manual/checklists/new?manual=1">
              Manual Checklist
            </Link>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#123746]">Upcoming B2C Requests</h2>
            <p className="text-sm font-semibold text-[#607482]">
              These requests are for preparation only. Click View Request to review and acknowledge.
            </p>
          </div>

          <span className="badge">{upcomingB2CRequests.length}</span>
        </div>

        <div className="table-modern overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left">
            <thead className="border-b border-[#d8e6ea] bg-[#f7fbfc] text-xs uppercase tracking-wide text-[#607482]">
              <tr>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Pickup</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Transport Time</th>
                <th className="px-4 py-3">Ambulance</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Preparation</th>
                <th className="px-4 py-3">CAD Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#e1ebef]">
              {upcomingB2CRequests.map((request) => (
                <tr key={request.id} className="hover:bg-[#f7fbfc]">
                  <td className="px-4 py-3 font-semibold text-[#123746]">
                    {getB2CRequestDisplay(request)}
                  </td>
                  <td className="px-4 py-3 text-[#274C5A]">
                    {request.patientName || "-"}
                  </td>
                  <td className="px-4 py-3 text-[#274C5A]">
                    {request.pickupText || "-"}
                  </td>
                  <td className="px-4 py-3 text-[#274C5A]">
                    {request.destinationText || "-"}
                  </td>
                  <td className="px-4 py-3 text-[#274C5A]">
                    {formatDate(request.requestedTransportAt)}
                  </td>
                  <td className="px-4 py-3 text-[#274C5A]">
                    {request.plannedAssignment?.unitCode ||
                      request.plannedAssignment?.unitName ||
                      getUnitDisplayName(request.plannedAssignment) ||
                      "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge">{request.paymentStatus || "Pending"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge">{getPreparationStatus(request)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge">CAD Not Active</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link className="btn-secondary" href={`/b2c/requests/${request.id}`}>
                      View Request
                    </Link>
                  </td>
                </tr>
              ))}

              {upcomingB2CRequests.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center font-semibold text-[#607482]"
                  >
                    No upcoming B2C requests assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#123746]">Unit Readiness</h2>
            <p className="text-sm font-semibold text-[#607482]">
              Opening appears first. Closing appears after opening is submitted or approved.
            </p>
          </div>

          <span className="badge">{getRiyadhDateKey()}</span>
        </div>

        {checklistCards.length === 0 ? (
          <div className="card-modern py-8 text-center font-semibold text-[#607482]">
            No readiness checklist is pending for the detected unit and shift.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {checklistCards.map(({ context, current, phase, title, description, status, sourceChecklistId }) => (
              <article key={`${context.key}-${phase}`} className="card-modern min-h-[220px]">
                <div className="flex h-full flex-col justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="badge">{phase === "opening" ? "Opening" : "Closing"}</span>
                      <span className="badge">{status}</span>
                    </div>

                    <h3 className="mt-5 text-2xl font-black text-[#123746]">{title}</h3>
                    <p className="mt-2 text-sm font-semibold text-[#607482]">{description}</p>

                    <div className="mt-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <span className="font-bold text-[#607482]">Unit: </span>
                        <span className="font-black text-[#123746]">{context.unitCode}</span>
                      </div>
                      <div>
                        <span className="font-bold text-[#607482]">Shift: </span>
                        <span className="font-black text-[#123746]">{context.shiftKey}</span>
                      </div>
                      <div>
                        <span className="font-bold text-[#607482]">Project: </span>
                        <span className="font-black text-[#123746]">{context.projectName}</span>
                      </div>
                      <div>
                        <span className="font-bold text-[#607482]">Date: </span>
                        <span className="font-black text-[#123746]">{context.dateKey}</span>
                      </div>
                    </div>
                  </div>

                  {can("readiness_checklists", "create") ? (
                    <Link
                      className="btn-primary w-fit"
                      href={
                        current
                          ? `/projects/${current.projectId || context.projectId}/checklists/${current.id}`
                          : `/projects/${context.projectId}/checklists/new?unitId=${encodeURIComponent(
                              context.unitId
                            )}&shift=${encodeURIComponent(context.shiftKey)}${
                              phase === "closing" ? "&phase=closing" : ""
                            }${
                              sourceChecklistId
                                ? `&sourceChecklistId=${encodeURIComponent(sourceChecklistId)}`
                                : ""
                            }`
                      }
                    >
                      {current ? "Open Checklist" : phase === "closing" ? "Start Closing" : "Start Opening"}
                    </Link>
                  ) : (
                    <span className="badge w-fit">Checklist access not available</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#123746]">Active CAD Missions</h2>
            <p className="text-sm font-semibold text-[#607482]">
              Open a mission to acknowledge and view the full CAD case details.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#274C5A]">
              <input
                type="checkbox"
                checked={showClosedMissions}
                onChange={(e) => setShowClosedMissions(e.target.checked)}
              />
              Show closed missions
            </label>

            <span className="badge">{activeMissions.length}</span>
          </div>
        </div>

        {activeMissions.length === 0 ? (
          <div className="card-modern py-10 text-center font-semibold text-[#607482]">
            No active CAD missions found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {activeMissions.map((item) => {
              const b2cRequestId = getB2CRequestIdFromCase(item);
              const showViewRequest = isB2CCase(item) && b2cRequestId;
              const sourceLabel = item.sourceType || item.caseType || "PROJECT";

              return (
                <article key={item.id} className="card-modern min-h-[220px]">
                  <div className="flex h-full flex-col justify-between gap-5">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <span className="badge">Open Mission</span>
                        <span className="badge">{getMissionStatus(item)}</span>
                      </div>

                      <h3 className="mt-5 text-2xl font-black leading-tight text-[#123746]">
                        {getCaseDisplayCode(item)}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-[#607482]">
                        {getCaseDisplayTitle(item)}
                      </p>

                      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                        <div>
                          <span className="font-bold text-[#607482]">Source: </span>
                          <span className="font-black text-[#123746]">{sourceLabel}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#607482]">Service: </span>
                          <span className="font-black text-[#123746]">
                            {item.chiefComplaint || item.serviceType || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-[#607482]">Patient: </span>
                          <span className="font-black text-[#123746]">{getMissionPatient(item)}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#607482]">Mobile: </span>
                          <span className="font-black text-[#123746]">{getMissionMobile(item)}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#607482]">Pickup: </span>
                          <span className="font-black text-[#123746]">{getMissionLocation(item)}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#607482]">Destination: </span>
                          <span className="font-black text-[#123746]">{getMissionDestination(item)}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#607482]">Unit: </span>
                          <span className="font-black text-[#123746]">{getMissionUnit(item)}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#607482]">Received: </span>
                          <span className="font-black text-[#123746]">
                            {item.acknowledged ? "Acknowledged" : "Pending"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {showViewRequest && (
                        <Link
                          className="btn-secondary"
                          href={`/b2c/requests/${b2cRequestId}`}
                        >
                          View Request
                        </Link>
                      )}

                      <Link className="btn-primary" href={`/missions/${item.id}`}>
                        Open Mission
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
