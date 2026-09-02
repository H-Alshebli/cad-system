import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  actorCan,
  authenticateEntitlementsActor,
} from "@/lib/server/employeeEntitlementsAuth";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { recordId: string } }) {
  const actor = await authenticateEntitlementsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actorCan(actor, "respond")) {
    return NextResponse.json({ error: "Response permission is required." }, { status: 403 });
  }

  const userSnapshot = await adminDb.collection("users").doc(actor.uid).get();
  const user = userSnapshot.data() || {};
  const profileSubmitted = Boolean(user.crewProfileSubmittedAt) ||
    new Set(["submitted", "verified", "changes_required", "update_requested", "reopened"]).has(
      String(user.crewProfileReviewStatus || "")
    );
  if (!profileSubmitted) {
    return NextResponse.json(
      { error: "Complete and submit your Crew Profile before responding." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const comment = String(body.comment || "").trim();
  if (!new Set(["agree", "dispute"]).has(action)) {
    return NextResponse.json({ error: "Invalid response." }, { status: 400 });
  }
  if (action === "dispute" && !comment) {
    return NextResponse.json({ error: "An adjustment request comment is required." }, { status: 400 });
  }

  const ref = adminDb.collection("employeeEntitlements").doc(params.recordId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: "Entitlement record not found." }, { status: 404 });
  const record = snapshot.data() || {};
  if (record.userId !== actor.uid) return NextResponse.json({ error: "You can only respond to your own record." }, { status: 403 });
  if (record.status !== "sent") return NextResponse.json({ error: "This statement is not awaiting a response." }, { status: 409 });

  const status = action === "agree" ? "agreed" : "disputed";
  const employeeResponse = { action, comment, userId: actor.uid, userName: actor.name, at: new Date().toISOString() };
  await ref.update({
    status,
    employeeResponse,
    responseHistory: FieldValue.arrayUnion(employeeResponse),
    respondedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    auditHistory: FieldValue.arrayUnion({ action, actorId: actor.uid, comment, at: new Date().toISOString() }),
  });

  if (record.sentBy || record.createdBy) {
    await adminDb.collection("notifications").add({
      type: "employee_entitlement_response",
      entitlementId: snapshot.id,
      batchId: record.batchId,
      recipientUserIds: [record.sentBy || record.createdBy],
      recipientEmails: [],
      title: status === "agreed" ? "Entitlement statement agreed" : "Entitlement adjustment requested",
      message: `${record.employeeName || actor.name} ${status === "agreed" ? "agreed to" : "requested an adjustment to"} the entitlement statement.`,
      link: "/admin/employee-entitlements",
      readByUserIds: [],
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  return NextResponse.json({ status });
}
