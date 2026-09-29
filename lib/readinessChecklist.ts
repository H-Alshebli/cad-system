import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PermissionsMap, normalizePermissions } from "@/lib/permissionsMatrix";
import { hasPermission } from "@/lib/usePermissions";
import { checklistLifecycle } from "./checklistLifecycleClient";

import { ChecklistPhase, DeploymentType, ReadinessChecklistPayload, CHECKLIST_COLLECTION,
  doesChecklistShiftMatch, normalizeDeploymentType, calculateReadiness, removeUndefinedValues } from "./readinessChecklistCore";
export * from "./readinessChecklistCore";

export async function findDuplicateChecklist(
  unitId: string,
  dateKey: string,
  shiftKey: string,
  deploymentType: DeploymentType | string,
  checklistPhase: ChecklistPhase = "opening",
  shiftId?: string
) {
  if (!unitId || !dateKey || !shiftKey || !deploymentType) return null;
  const normalizedDeployment = normalizeDeploymentType(deploymentType);
  const q = query(
    collection(db, CHECKLIST_COLLECTION),
    where("unitId", "==", unitId),
    limit(100)
  );
  const snap = await getDocs(q);
  const first = snap.docs.find((entry) => {
    const data: any = entry.data();
    return (
      data.dateKey === dateKey &&
      doesChecklistShiftMatch(data, shiftKey, shiftId) &&
      (data.checklistPhase || "opening") === checklistPhase &&
      normalizeDeploymentType(data.deploymentType || data.checklistCategory || "Ambulance") === normalizedDeployment
    );
  });
  return first ? { id: first.id, ...first.data() } : null;
}

export async function createReadinessChecklist(
  payload: ReadinessChecklistPayload,
  status: "draft" | "submitted"
) {
  /* Duplicate checks run on the server, so a retry after a lost response can
     retrieve the original successful request instead of blocking itself. */
  return checklistLifecycle(null, { action: "create", payload: removeUndefinedValues(payload), status });
}

export async function updateReadinessChecklistDraft(
  checklistId: string,
  payload: Pick<ReadinessChecklistPayload, "items" | "notes"> & Partial<Pick<ReadinessChecklistPayload, "durationSeconds">>
) {
  const cleanPayload = removeUndefinedValues(payload);
  const readiness = removeUndefinedValues(calculateReadiness(cleanPayload.items));
  await updateDoc(doc(db, CHECKLIST_COLLECTION, checklistId), {
    ...cleanPayload,
    ...readiness,
    status: "draft",
    durationSeconds: cleanPayload.durationSeconds || null,
    updatedAt: serverTimestamp(),
  });
}

export async function submitReadinessChecklist(
  checklistId: string,
  payload: Pick<ReadinessChecklistPayload, "items" | "notes"> &
    Partial<Pick<ReadinessChecklistPayload, "durationSeconds" | "submittedAtMs" | "submissionAcknowledgement">>,
  baseVersion?: string
) {
  await checklistLifecycle(checklistId, { action: "submit", payload: removeUndefinedValues(payload), ...(baseVersion !== undefined ? { baseVersion } : {}) });
}

export async function reviewReadinessChecklist(
  checklistId: string,
  action: "approved" | "returned_for_correction" | "comment",
  reviewer: any,
  reviewNotes: string,
  baseVersion?: string
) {
  await checklistLifecycle(checklistId, { action: action === "approved" ? "approve" : action === "comment" ? "comment" : "return", notes: reviewNotes, ...(baseVersion !== undefined ? { baseVersion } : {}) });
}

export function canViewChecklist(checklist: any, permissions: PermissionsMap, user: any) {
  const normalized = normalizePermissions(permissions);
  if (hasPermission(normalized, "readiness_checklists", "view_all", user?.role)) return true;
  return (
    (hasPermission(normalized, "readiness_checklists", "view", user?.role) ||
      hasPermission(normalized, "readiness_checklists", "view_own", user?.role)) &&
    checklist?.inspectorUserId === user?.uid
  );
}

export function canEditOwnDraft(checklist: any, permissions: PermissionsMap, user: any) {
  return (
    (checklist?.status === "draft" || checklist?.status === "returned_for_correction") &&
    checklist?.inspectorUserId === user?.uid &&
    hasPermission(permissions, "readiness_checklists", "edit_own_draft", user?.role)
  );
}

export function canSubmitChecklist(checklist: any, permissions: PermissionsMap, user: any) {
  return (
    (checklist?.status === "draft" || checklist?.status === "returned_for_correction") &&
    checklist?.inspectorUserId === user?.uid &&
    hasPermission(permissions, "readiness_checklists", "submit", user?.role)
  );
}

