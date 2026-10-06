"use client";
import { auth } from "./firebase";
export async function claimEpcrEditSession(id: string, deviceId: string, action: "claim" | "release" = "claim") {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in first.");
  const response = await fetch(`/api/epcr/${encodeURIComponent(id)}/edit-session`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, deviceId }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Edit session unavailable.");
  return result as { editor: boolean; owner?: string; expiresInMs?: number };
}
