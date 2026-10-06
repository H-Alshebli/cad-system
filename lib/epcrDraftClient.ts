"use client";
import { auth } from "./firebase";
export async function sendEpcrDraft(id: string, body: { baseVersion: string; mutationId: string; patch: Record<string, unknown> }) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("ACCOUNT_CHANGED");
  const response = await fetch(`/api/epcr/${encodeURIComponent(id)}/draft`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error === "Report changed elsewhere. Compare before continuing." ? "REPORT_CONFLICT" : result.error === "The report is finalized and cannot be edited." ? "REPORT_LOCKED" : "DRAFT_SAVE_FAILED");
  return result as { record: Record<string, unknown>; version: string; updatedAt?: string; draftRevision?: number; lastDraftMutationId?: string; duplicate?: boolean };
}
