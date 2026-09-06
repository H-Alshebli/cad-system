import { resolveCurrentProjectShift, type ProjectShift } from "@/lib/readinessChecklist";

export type CrewMemberSnapshot = {
  userId: string;
  name?: string;
  email?: string;
  role?: string;
};

export type ShiftCrewAssignment = {
  shiftId: string;
  shiftName?: string;
  crewUserIds: string[];
  crewMembers?: CrewMemberSnapshot[];
};

export type ShiftCrewAssignments = Record<string, ShiftCrewAssignment>;

function uniqueIds(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

export function getLegacyCrewUserIds(ambulance: any) {
  return uniqueIds([
    ...(Array.isArray(ambulance?.assignedUserIds) ? ambulance.assignedUserIds : []),
    ...(Array.isArray(ambulance?.crewUserIds) ? ambulance.crewUserIds : []),
    ...(Array.isArray(ambulance?.crewMembers)
      ? ambulance.crewMembers.map((member: any) => member?.userId)
      : []),
  ]);
}

export function normalizeShiftCrewAssignments(value: any): ShiftCrewAssignments {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, raw]: [string, any]) => {
      const shiftId = String(raw?.shiftId || key || "").trim();
      if (!shiftId) return [];
      const crewUserIds = uniqueIds([
        ...(Array.isArray(raw?.crewUserIds) ? raw.crewUserIds : []),
        ...(Array.isArray(raw?.crewMembers)
          ? raw.crewMembers.map((member: any) => member?.userId)
          : []),
      ]).slice(0, 2);
      return [[shiftId, { shiftId, shiftName: String(raw?.shiftName || ""), crewUserIds, crewMembers: Array.isArray(raw?.crewMembers) ? raw.crewMembers.filter((member: any) => crewUserIds.includes(String(member?.userId || ""))) : [] }]];
    })
  );
}

export function resolveAmbulanceCrewForShift(ambulance: any, shiftId?: string | null) {
  const assignments = normalizeShiftCrewAssignments(ambulance?.shiftCrewAssignments);
  const scheduled = shiftId ? assignments[shiftId] : undefined;
  if (scheduled?.crewUserIds.length) {
    return { ...scheduled, source: "shift" as const };
  }
  return {
    shiftId: shiftId || "legacy",
    shiftName: "Legacy / Default Crew",
    crewUserIds: getLegacyCrewUserIds(ambulance).slice(0, 2),
    crewMembers: Array.isArray(ambulance?.crewMembers) ? ambulance.crewMembers : [],
    source: "legacy" as const,
  };
}

export function resolveCurrentAmbulanceCrew(
  ambulance: any,
  shiftSchedule?: ProjectShift[] | null,
  now = new Date()
) {
  const shift = resolveCurrentProjectShift(shiftSchedule, now);
  return { shift, assignment: resolveAmbulanceCrewForShift(ambulance, shift.shiftId) };
}
