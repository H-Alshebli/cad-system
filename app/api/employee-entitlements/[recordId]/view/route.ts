import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  actorCan,
  authenticateEntitlementsActor,
} from "@/lib/server/employeeEntitlementsAuth";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  const actor = await authenticateEntitlementsActor(request);
  if (!actor || !actorCan(actor, "view_own")) {
    return NextResponse.json({ error: "View-own permission is required." }, { status: 403 });
  }

  const recordRef = adminDb.collection("employeeEntitlements").doc(params.recordId);
  const snapshot = await recordRef.get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: "Entitlement record not found." }, { status: 404 });
  }
  const record = snapshot.data() || {};
  if (record.userId !== actor.uid || record.status === "draft") {
    return NextResponse.json({ error: "This entitlement is not available to this user." }, { status: 403 });
  }

  await recordRef.update({
    ...(record.firstViewedAt ? {} : { firstViewedAt: FieldValue.serverTimestamp() }),
    lastViewedAt: FieldValue.serverTimestamp(),
    viewCount: FieldValue.increment(1),
  });

  return NextResponse.json({ ok: true });
}
