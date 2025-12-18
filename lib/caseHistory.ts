// lib/caseHistory.ts
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type HistoryEventType =
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "RECEIVED"
  | "CLOSED"
  | "UPDATED";

interface AddCaseHistoryParams {
  caseId: string;

  type: HistoryEventType;

  from?: string | null;
  to?: string | null;

  by: {
    role: "dispatch" | "ambulance" | "roaming" | "admin";
    code?: string;
  };

  note?: string;
}

export async function addCaseHistory({
  caseId,
  type,
  from = null,
  to = null,
  by,
  note,
}: AddCaseHistoryParams) {
  if (!caseId || !type || !by?.role) {
    console.warn("⚠️ Missing required history fields");
    return;
  }

  try {
    await addDoc(collection(db, "cases", caseId, "history"), {
      type,
      from,
      to,
      by,
      note: note || null,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Failed to write case history", err);
  }
}
