import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  actorCan,
  authenticateEntitlementsActor,
} from "@/lib/server/employeeEntitlementsAuth";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

function serialize(value: any): any {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

export async function GET(request: NextRequest) {
  const actor = await authenticateEntitlementsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const wantsAll = request.nextUrl.searchParams.get("scope") === "all";
  if (wantsAll && !actorCan(actor, "view_all")) {
    return NextResponse.json({ error: "View-all permission is required." }, { status: 403 });
  }
  if (!wantsAll && !actorCan(actor, "view_own")) {
    return NextResponse.json({ error: "View-own permission is required." }, { status: 403 });
  }

  const query = wantsAll
    ? adminDb.collection("employeeEntitlements")
    : adminDb.collection("employeeEntitlements").where("userId", "==", actor.uid);
  const snapshot = await query.get();
  const records = snapshot.docs
    .map((document) => ({ id: document.id, ...serialize(document.data()) }))
    .filter((record: any) => wantsAll || record.status !== "draft")
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if (!wantsAll && records.length > 0) {
    const userSnapshot = await adminDb.collection("users").doc(actor.uid).get();
    const user = userSnapshot.data() || {};
    const reviewStatus = String(user.crewProfileReviewStatus || "");
    const profileSubmitted = Boolean(user.crewProfileSubmittedAt) ||
      new Set(["submitted", "verified", "changes_required", "update_requested", "reopened"]).has(reviewStatus);
    if (!profileSubmitted) {
      return NextResponse.json({
        records: [],
        entitlementAvailable: true,
        profileRequired: true,
      });
    }
  }
  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  const actor = await authenticateEntitlementsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actorCan(actor, "send")) {
    return NextResponse.json({ error: "Send entitlement permission is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const batchId = String(body.batchId || "").trim();
  const recordId = String(body.recordId || "").trim();
  if (!new Set(["send_batch", "send_record", "correct_and_resend", "reject_dispute"]).has(action)) {
    return NextResponse.json({ error: "Invalid send action." }, { status: 400 });
  }

  if (action === "correct_and_resend" || action === "reject_dispute") {
    const document = await adminDb.collection("employeeEntitlements").doc(recordId).get();
    if (!document.exists) return NextResponse.json({ error: "Entitlement record not found." }, { status: 404 });
    const data = document.data() || {};
    if (data.status !== "disputed") {
      return NextResponse.json({ error: "Only a disputed statement can be reviewed." }, { status: 409 });
    }
    const comment = String(body.comment || "").trim();
    if (!comment) return NextResponse.json({ error: "An HR response is required." }, { status: 400 });
    const responseHistory = data.employeeResponse
      ? FieldValue.arrayUnion(data.employeeResponse)
      : FieldValue.arrayUnion();

    if (action === "reject_dispute") {
      await document.ref.update({
        status: "dispute_rejected",
        hrResolution: { action, comment, actorId: actor.uid, actorName: actor.name, at: new Date().toISOString() },
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: actor.uid,
        resolvedByName: actor.name,
        responseHistory,
        updatedAt: FieldValue.serverTimestamp(),
        auditHistory: FieldValue.arrayUnion({ action, actorId: actor.uid, comment, at: new Date().toISOString() }),
      });
    } else {
      const values = ["otEntitlement", "otPaid", "perDiemEntitlement", "perDiemPaid"].map((key) => Number(body[key]));
      if (values.some((value) => !Number.isFinite(value) || value < 0)) {
        return NextResponse.json({ error: "All corrected amounts must be valid positive numbers or zero." }, { status: 400 });
      }
      const [otEntitlement, otPaid, perDiemEntitlement, perDiemPaid] = values;
      if (otPaid > otEntitlement || perDiemPaid > perDiemEntitlement) {
        return NextResponse.json({ error: "Paid amount cannot exceed the entitlement amount." }, { status: 400 });
      }
      const overtime = { ...(data.overtime || {}), entitlement: otEntitlement, sourcePaid: otPaid, sourceRemaining: otEntitlement - otPaid, operationalPaid: otPaid, operationalRemaining: otEntitlement - otPaid };
      const perDiem = { ...(data.perDiem || {}), entitlement: perDiemEntitlement, sourceRemaining: perDiemEntitlement - perDiemPaid, operationalPaid: perDiemPaid, operationalRemaining: perDiemEntitlement - perDiemPaid };
      await document.ref.update({
        overtime,
        perDiem,
        combined: { entitlement: otEntitlement + perDiemEntitlement, paid: otPaid + perDiemPaid, remaining: otEntitlement - otPaid + perDiemEntitlement - perDiemPaid },
        status: "sent",
        hrResolution: { action, comment, actorId: actor.uid, actorName: actor.name, at: new Date().toISOString() },
        correctedAt: FieldValue.serverTimestamp(),
        correctedBy: actor.uid,
        correctedByName: actor.name,
        resentAt: FieldValue.serverTimestamp(),
        sentAt: FieldValue.serverTimestamp(),
        sentBy: actor.uid,
        sentByName: actor.name,
        responseHistory,
        updatedAt: FieldValue.serverTimestamp(),
        auditHistory: FieldValue.arrayUnion({ action, actorId: actor.uid, comment, previousCombined: data.combined || {}, at: new Date().toISOString() }),
      });
    }

    await adminDb.collection("notifications").add({
      type: "employee_entitlement_hr_resolution",
      entitlementId: document.id,
      batchId: data.batchId,
      recipientUserIds: [data.userId],
      recipientEmails: data.employeeEmail ? [data.employeeEmail] : [],
      title: action === "correct_and_resend" ? "Entitlement statement corrected" : "Entitlement dispute reviewed",
      message: action === "correct_and_resend" ? "HR corrected and resent your entitlement statement for review." : "HR reviewed your adjustment request. Open your profile to view the response.",
      link: "/crew-profile#employee-entitlements",
      readByUserIds: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ status: action === "correct_and_resend" ? "sent" : "dispute_rejected" });
  }

  const documents = action === "send_batch"
    ? (await adminDb.collection("employeeEntitlements").where("batchId", "==", batchId).get()).docs
    : [await adminDb.collection("employeeEntitlements").doc(recordId).get()].filter((item) => item.exists);
  if (!documents.length) return NextResponse.json({ error: "No entitlement records found." }, { status: 404 });

  const writer = adminDb.batch();
  let sent = 0;
  documents.forEach((document) => {
    const data = document.data() || {};
    if (data.status !== "draft") return;
    sent += 1;
    writer.update(document.ref, {
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      sentBy: actor.uid,
      sentByName: actor.name,
      updatedAt: FieldValue.serverTimestamp(),
      auditHistory: FieldValue.arrayUnion({ action: "sent", actorId: actor.uid, at: new Date().toISOString() }),
    });
    const notificationRef = adminDb.collection("notifications").doc();
    writer.create(notificationRef, {
      type: "employee_entitlement",
      entitlementId: document.id,
      batchId: data.batchId,
      recipientUserIds: [data.userId],
      recipientEmails: data.employeeEmail ? [data.employeeEmail] : [],
      title: "Employee entitlement acknowledgment",
      message: `Your Overtime and Per Diem entitlement statement for ${data.period || "2025-2026"} is ready for review.`,
      link: "/crew-profile#employee-entitlements",
      readByUserIds: [],
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  if (action === "send_batch" && batchId && sent > 0) {
    writer.update(adminDb.collection("employeeEntitlementBatches").doc(batchId), {
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      sentBy: actor.uid,
      sentByName: actor.name,
      auditHistory: FieldValue.arrayUnion({ action: "sent", actorId: actor.uid, at: new Date().toISOString() }),
    });
  }
  if (sent > 0) await writer.commit();
  return NextResponse.json({ sent });
}
