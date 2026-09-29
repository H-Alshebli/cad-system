import { createHash } from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { noticeEnabled, ReviewNotice } from "../reviewNotificationPolicy";

export function enqueueReviewNotice(tx: Transaction, eventId: string, event: ReviewNotice, cohortSubmittedAt: unknown) {
  if (!noticeEnabled(process.env.REVIEW_NOTIFICATIONS_ENABLED, process.env.REVIEW_NOTIFICATIONS_START_AT, cohortSubmittedAt)) return;
  const id = createHash("sha256").update(`${event.kind}:${event.recordId}:${eventId}`).digest("hex");
  // Same transaction as the lifecycle event. Never include patient data or notes.
  tx.create(adminDb.collection("reviewNotificationOutbox").doc(id), { ...event, status: "pending", createdAt: new Date(event.at) });
}
