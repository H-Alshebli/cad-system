export type CorrectionTask = { id: string; reportNumber: string; caseNumber: string; reason: string; returnedAt: string };
// Responsibility follows the authenticated submitter, not mutable case assignment.
// No case-status filter: closed CAD cases can still require clinical corrections.
export function correctionTasks(records: Array<Record<string, any>>, uid: string): CorrectionTask[] {
  if (!uid) return [];
  return records.filter(record => record.medicalReview?.status === "returned" && record.medicalReview?.submittedBy === uid)
    .map(record => ({ id: String(record.id), reportNumber: String(record.epcrNumber || record.id), caseNumber: String(record.caseNumber || "—"),
      reason: String(record.medicalReview.notes || "See review history for the required correction."), returnedAt: String(record.medicalReview.reviewedAt || "") }))
    .sort((a, b) => (Date.parse(b.returnedAt) || 0) - (Date.parse(a.returnedAt) || 0) || a.id.localeCompare(b.id));
}
