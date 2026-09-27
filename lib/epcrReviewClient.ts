"use client";
import { auth } from "./firebase";
export async function sendMedicalReview(id: string, body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in first.");
  const response = await fetch(`/api/epcr/${encodeURIComponent(id)}/medical-review`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Review failed. Retry.");
  return result as { result: "done" | "consent" };
}
