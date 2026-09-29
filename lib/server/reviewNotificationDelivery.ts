import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { canReceiveNotice, noticeLink, noticeTitle, ReviewNotice } from "../reviewNotificationPolicy";

async function recipients(event: ReviewNotice) {
  const users = event.action === "submit"
    ? await adminDb.collection("users").where("active", "==", true).select("active", "accountType", "role", "email").get()
    : null;
  const own = users ? null : await adminDb.collection("users").where(FieldPath.documentId(), "==", event.ownerId).select("active", "accountType", "role", "email").get();
  const roles = new Map<string, any>();
  const result: { uid: string; email: string }[] = [];
  for (const doc of users?.docs || own?.docs || []) {
    const user = doc.data(); if (!user) continue;
    const role = String(user.role || "").trim();
    if (!role || role.includes("/")) continue;
    if (!roles.has(role)) roles.set(role, (await adminDb.collection("roles").doc(role).get()).data()?.permissions || {});
    if (canReceiveNotice(event, doc.id, user, roles.get(role))) result.push({ uid: doc.id, email: String(user.email || "").trim() });
  }
  return result;
}

export async function deliverReviewNotifications() {
  if (process.env.REVIEW_NOTIFICATIONS_ENABLED !== "true") return { disabled: true };
  const stats = { events: 0, sent: 0, ambiguous: 0, skipped: 0 };
  // No scans of reports, clinical records or historical checklist data.
  const pending = await adminDb.collection("reviewNotificationOutbox").where("status", "==", "pending").limit(20).get();
  for (const entry of pending.docs) {
    const event = entry.data() as ReviewNotice;
    const targets = await recipients(event);
    // Explicit blocked state avoids silently dropping notices or starving others.
    if (!targets.length || targets.length > 80) {
      await adminDb.runTransaction(async tx => {
        if ((await tx.get(entry.ref)).data()?.status === 'pending') tx.update(entry.ref, {
          status: !targets.length ? 'blocked_no_recipients' : 'blocked_recipient_limit', updatedAt: new Date(),
        });
      });
      stats.skipped++; continue;
    }
    await adminDb.runTransaction(async tx => {
      const current = await tx.get(entry.ref);
      if (current.data()?.status !== "pending") return;
      for (const target of targets) {
        const notice = adminDb.collection("users").doc(target.uid).collection("reviewNotifications").doc(entry.id);
        tx.create(notice, { title: noticeTitle(event), link: noticeLink(event), createdAt: new Date(event.at), read: false });
        tx.create(adminDb.collection("reviewNotificationMail").doc(`${entry.id}_${target.uid}`), {
          event, recipientId: target.uid, status: "pending", attempts: 0, nextAttemptAt: 0, createdAt: new Date(),
        });
      }
      tx.update(entry.ref, { status: "dispatched", dispatchedAt: new Date(), recipientCount: targets.length });
    });
    stats.events++;
  }
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const origin = process.env.REVIEW_NOTIFICATION_ORIGIN;
  if (!host || !user || !pass || !from || !origin || !/^https:\/\/[^/]+\/?$/.test(origin)) return { ...stats, mailConfigured: false };
  const transport = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465, requireTLS: true,
    auth: { user, pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 });
  try {
    const jobs = await adminDb.collection("reviewNotificationMail").where("status", "==", "pending").limit(20).get();
    for (const job of jobs.docs) {
      const data = job.data(); if (Number(data.nextAttemptAt || 0) > Date.now()) continue;
      const event = data.event as ReviewNotice;
      // Permissions/active account are checked again at delivery time.
      const target = (await recipients(event)).find(r => r.uid === data.recipientId);
      const claimId = randomUUID();
      const claimed = await adminDb.runTransaction(async tx => {
        const current = (await tx.get(job.ref)).data();
        if (!current || current.status !== "pending" || Number(current.nextAttemptAt || 0) > Date.now()) return false;
        if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email)) {
          tx.update(job.ref, { status: "skipped_recipient", updatedAt: new Date() }); return false;
        }
        tx.update(job.ref, { status: "sending", claimId, attempts: Number(current.attempts || 0) + 1, sendingAt: new Date() });
        return true;
      });
      if (!claimed || !target) continue;
      let resultStatus = "sent";
      try {
        const info = await transport.sendMail({ from, to: target.email, subject: noticeTitle(event),
          text: `${noticeTitle(event)}. Sign in to HCAD to view the details.\n${origin.replace(/\/$/, "")}${noticeLink(event)}`,
          messageId: `<review-${job.id}@${new URL(origin).hostname}>` });
        if (!info.accepted?.length) resultStatus = "failed";
      } catch (error: any) {
        // Explicit SMTP rejection is safe to retry; lost acknowledgement is not.
        resultStatus = Number(error?.responseCode) >= 400 && Number(error?.responseCode) < 500 && Number(data.attempts || 0) < 4
          ? "pending" : Number(error?.responseCode) >= 500 ? "failed" : "delivery_unknown";
      }
      // A crash after SMTP acceptance leaves 'sending'. Never auto-reclaim it:
      // SMTP cannot guarantee exactly-once delivery; operator verification needed.
      await job.ref.update({ status: resultStatus, updatedAt: new Date(), nextAttemptAt: Date.now() + 300000 });
      if (resultStatus === "sent") stats.sent++;
      if (resultStatus === "delivery_unknown") stats.ambiguous++;
    }
  } finally { transport.close(); }
  return stats;
}
