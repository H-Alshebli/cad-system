import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type AmbulanceCrewSyncResult = {
  updatedRequests: number;
  updatedCases: number;
  skippedCaseIds: string[];
};

function normalizeStatus(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function hasCadMovementStarted(status: unknown) {
  const normalized = normalizeStatus(status);
  return /enroute|onscene|atscene|transporting|arrived|completed|closed|cancelled|canceled/.test(
    normalized
  );
}

export async function syncAmbulanceCrewAssignments(params: {
  ambulanceId: string;
  ambulanceCode: string;
  assignedTeamGroup: string;
  previousUserIds: string[];
  assignedUserIds: string[];
  changedById: string;
  changedByName: string;
}): Promise<AmbulanceCrewSyncResult> {
  const previousUserIds = Array.from(new Set(params.previousUserIds.filter(Boolean)));
  const assignedUserIds = Array.from(new Set(params.assignedUserIds.filter(Boolean)));
  const changedAt = new Date().toISOString();
  const auditEntry = {
    source: "ambulance_crew_update",
    ambulanceId: params.ambulanceId,
    ambulanceCode: params.ambulanceCode,
    previousUserIds,
    assignedUserIds,
    changedById: params.changedById,
    changedByName: params.changedByName,
    changedAt,
  };

  const [requestSnapshot, caseSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, "b2cRequests"),
        where("plannedAssignment.unitId", "==", params.ambulanceId)
      )
    ),
    getDocs(
      query(
        collection(db, "cases"),
        where("assignedAmbulanceId", "==", params.ambulanceId)
      )
    ),
  ]);

  const cases = caseSnapshot.docs
    .map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }))
    .filter(
      (cadCase: Record<string, any>) =>
        String(cadCase.sourceType || "").toUpperCase() === "B2C" ||
        Boolean(cadCase.b2cRequestId)
    ) as Array<Record<string, any> & { id: string }>;
  const safeCaseIds = new Set(
    cases
      .filter(
        (cadCase) =>
          !hasCadMovementStarted(cadCase.status) &&
          !hasCadMovementStarted(cadCase.dispatchStatus)
      )
      .map((cadCase) => cadCase.id)
  );
  const skippedCaseIds = cases
    .filter(
      (cadCase) =>
        hasCadMovementStarted(cadCase.status) ||
        hasCadMovementStarted(cadCase.dispatchStatus)
    )
    .map((cadCase) => cadCase.id);

  const safeCases = cases.filter((cadCase) => safeCaseIds.has(cadCase.id));
  const safeRequests = requestSnapshot.docs.filter((snapshot) => {
    const request = snapshot.data();
    if (request.requestStatus === "Cancelled") return false;
    if (!request.cadCaseId) return true;
    return safeCaseIds.has(request.cadCaseId);
  });

  await Promise.all([
    ...safeRequests.map((snapshot) => {
      const request = snapshot.data();
      return updateDoc(doc(db, "b2cRequests", snapshot.id), {
        "plannedAssignment.unitCode": params.ambulanceCode,
        "plannedAssignment.assignedTeamGroup": params.assignedTeamGroup,
        "plannedAssignment.assignedUserIds": assignedUserIds,
        crewAssignmentHistory: arrayUnion(auditEntry),
        crewAssignmentUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }),
    ...safeCases.map((cadCase) =>
      updateDoc(doc(db, "cases", cadCase.id), {
        assignedAmbulanceCode: params.ambulanceCode,
        assignedTeamGroup: params.assignedTeamGroup,
        assignedUserIds,
        crewAssignmentHistory: arrayUnion(auditEntry),
        crewAssignmentUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    ),
  ]);

  return {
    updatedRequests: safeRequests.length,
    updatedCases: safeCases.length,
    skippedCaseIds,
  };
}
