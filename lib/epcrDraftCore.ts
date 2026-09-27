export const DRAFT_FIELDS = ["patientInfo", "projectInfo", "medicalHistory", "headToToe", "narrativeVitals", "outcome", "transferTeam", "time"] as const;
export function draftPayload(record: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key of DRAFT_FIELDS) if (record[key] !== undefined) result[key] = record[key];
  return JSON.parse(JSON.stringify(result));
}
export function draftVersion(record: Record<string, any>): string {
  const value = record.updatedAt;
  return JSON.stringify([record.draftRevision || 0,
    value?.toMillis ? value.toMillis() : value instanceof Date ? value.getTime() : value || null]);
}
export function checkDraftWrite(remote: Record<string, any>, baseVersion: string, mutationId: string) {
  if (remote.lastDraftMutationId === mutationId) return "already-saved";
  if (remote.locked === true || remote.finalizedAt) throw new Error("REPORT_LOCKED");
  if (draftVersion(remote) !== baseVersion) throw new Error("REPORT_CONFLICT");
  return "write";
}
export function matchesSubmissionDate(value: unknown, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (value == null || value === "") return false;
  const raw: any = value;
  const date = raw?.toDate ? raw.toDate() : new Date(raw instanceof Date ? raw.getTime() : raw as string);
  const time = date.getTime();
  if (!Number.isFinite(time)) return false;
  // datetime-local filters use the user's local timezone. Include the end minute.
  return (!from || time >= new Date(from).getTime()) && (!to || time <= new Date(to).getTime() + 59999);
}
