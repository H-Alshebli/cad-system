export const DRAFT_FIELDS = ["patientInfo", "projectInfo", "medicalHistory", "headToToe", "narrativeVitals", "outcome", "transferTeam", "time"] as const;
export function draftPayload(record: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key of DRAFT_FIELDS) if (record[key] !== undefined) result[key] = record[key];
  return JSON.parse(JSON.stringify(result));
}

// Send only leaves that changed since the report was read.  A complete section
// write can replace a colleague's newer value with a stale, empty value.
export function draftPatch(next: Record<string, any>, base: Record<string, any>) {
  const patch: Record<string, unknown> = {};
  const walk = (value: unknown, previous: unknown, path: string) => {
    if (value === undefined) return;
    const object = value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
    const previousObject = previous !== null && typeof previous === "object" && !Array.isArray(previous) && !(previous instanceof Date);
    if (object) {
      const keys = new Set([...Object.keys(value as Record<string, unknown>), ...(previousObject ? Object.keys(previous as Record<string, unknown>) : [])]);
      for (const key of keys) walk((value as Record<string, unknown>)[key], previousObject ? (previous as Record<string, unknown>)[key] : undefined, `${path}.${key}`);
      return;
    }
    if (JSON.stringify(value) !== JSON.stringify(previous)) patch[path] = value;
  };
  for (const field of DRAFT_FIELDS) walk(next[field], base[field], field);
  return patch;
}

export function applyDraftPatch(record: Record<string, any>, patch: Record<string, unknown>) {
  const result = JSON.parse(JSON.stringify(record));
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split(".");
    let target = result;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts[parts.length - 1]] = value;
  }
  return result;
}
export function draftVersion(record: Record<string, any>): string {
  const value = record.updatedAt;
  return JSON.stringify([record.draftRevision || 0,
    value?.toMillis ? value.toMillis() : value instanceof Date ? value.getTime() : value || null]);
}
export type DraftReceipt = { mutationId: string; payload: string; version: string };
export function draftFingerprint(record: Record<string, any>): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  return JSON.stringify(canonical(draftPayload(record)));
}
export function matchesDraftReceipt(remote: Record<string, any>, receipts: DraftReceipt[]): boolean {
  if (remote.locked === true || remote.finalizedAt) return false;
  return receipts.some(receipt => receipt.mutationId === remote.lastDraftMutationId && receipt.version === draftVersion(remote) && receipt.payload === draftFingerprint(remote));
}
export function checkDraftWrite(remote: Record<string, any>, baseVersion: string, mutationId: string, receipts: DraftReceipt[] = []) {
  if (remote.locked === true || remote.finalizedAt) throw new Error("REPORT_LOCKED");
  if (remote.lastDraftMutationId === mutationId) {
    if (receipts.length && !matchesDraftReceipt(remote, receipts)) throw new Error("REPORT_CONFLICT");
    return "already-saved";
  }
  if (matchesDraftReceipt(remote, receipts)) return "write";
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
