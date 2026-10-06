import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { epcrActor } from "@/lib/server/epcrReviewAuth";

export const runtime = "nodejs";
const LEASE_MS = 90_000;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await epcrActor(request.headers.get("authorization"));
  const body = await request.json().catch(() => null);
  if (!actor || !actor.can("epcr", "edit")) return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  if (!params.id || params.id.includes("/") || !body || !/^[a-f0-9-]{36}$/i.test(body.deviceId || "") || !["claim", "release"].includes(body.action)) return NextResponse.json({ error: "Invalid edit session." }, { status: 400 });
  try {
    const result = await adminDb.runTransaction(async tx => {
      const reportRef = adminDb.collection("epcr").doc(params.id), leaseRef = reportRef.collection("editSessions").doc("active");
      const [report, lease] = await Promise.all([tx.get(reportRef), tx.get(leaseRef)]);
      if (!report.exists) throw new Error("REPORT_MISSING");
      if (report.data()?.locked || report.data()?.finalizedAt) throw new Error("REPORT_LOCKED");
      const now = new Date(), current = lease.data() || {}, expires = current.expiresAt?.toDate?.() || new Date(0);
      const owned = current.ownerUid === actor.uid && current.deviceId === body.deviceId;
      if (body.action === "release") { if (owned) tx.delete(leaseRef); return { editor: false }; }
      if (expires > now && !owned) return { editor: false, owner: current.ownerName || "another user" };
      tx.set(leaseRef, { ownerUid: actor.uid, ownerName: actor.name, deviceId: body.deviceId, claimedAt: now, expiresAt: new Date(now.getTime() + LEASE_MS) });
      return { editor: true, expiresInMs: LEASE_MS };
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "REPORT_LOCKED" ? "The report is finalized." : code === "REPORT_MISSING" ? "Report not found." : "Edit session could not be started." }, { status: 409 });
  }
}
