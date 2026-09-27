export function getEpcrStatus(record?: {
  locked?: boolean;
  finalizedAt?: unknown;
  status?: string;
} | null): string {
  if (!record) return "Not Created";
  if (record.locked === true && record.finalizedAt) return "finalized";
  // An inconsistent legacy status must not claim clinical approval.
  if (!record.status || record.status.toLowerCase() === "finalized") return "draft";
  return record.status;
}
