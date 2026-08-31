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
  if (!new Set(["send_batch", "send_record"]).has(action)) {
    return NextResponse.json({ error: "Invalid send action." }, { status: 400 });
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
