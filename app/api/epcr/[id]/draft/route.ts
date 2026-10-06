import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { applyDraftPatch, draftFingerprint, draftPayload, draftVersion } from "@/lib/epcrDraftCore";
import { epcrActor } from "@/lib/server/epcrReviewAuth";

export const runtime = "nodejs";
const allowedRoots = new Set(["patientInfo", "projectInfo", "medicalHistory", "headToToe", "narrativeVitals", "outcome", "transferTeam", "time"]);
function validPatch(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([path, item]) => allowedRoots.has(path.split(".")[0]) && !path.includes("__") && path.length <= 300 && item !== undefined);
}
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await epcrActor(request.headers.get("authorization"));
  if (!actor) return NextResponse.json({ error: "Active employee authentication required." }, { status: 401 });
  if (!actor.can("epcr", "edit") || !params.id || params.id.includes("/") || params.id.length > 1000) return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.baseVersion !== "string" || !/^[a-f0-9-]{36}$/i.test(body.mutationId || "") || !validPatch(body.patch)) return NextResponse.json({ error: "Invalid draft update." }, { status: 400 });
  try {
    const result = await adminDb.runTransaction(async tx => {
      const ref = adminDb.collection("epcr").doc(params.id), snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error("REPORT_MISSING");
      const report = snapshot.data() || {};
      if (report.locked || report.finalizedAt) throw new Error("REPORT_LOCKED");
      if (report.lastDraftMutationId === body.mutationId) return { record: draftPayload(report), version: draftVersion(report), duplicate: true };
      if (draftVersion(report) !== body.baseVersion) throw new Error("REPORT_CONFLICT");
      const now = new Date(), nextRevision = Number(report.draftRevision || 0) + 1, next = applyDraftPatch(report, body.patch);
      tx.create(ref.collection("draftVersions").doc(`${nextRevision}-${body.mutationId}`), { revision: Number(report.draftRevision || 0), savedAt: now, savedBy: actor.uid, savedByName: actor.name, reason: "autosave", snapshot: draftPayload(report), fingerprint: draftFingerprint(report) });
      tx.update(ref, { ...body.patch, status: "draft", updatedAt: now, draftRevision: nextRevision, lastDraftMutationId: body.mutationId, lastEditedBy: actor.uid, lastEditedAt: now });
      const response = { ...next, updatedAt: now, draftRevision: nextRevision, lastDraftMutationId: body.mutationId };
      return { record: draftPayload(response), version: draftVersion(response), updatedAt: now, draftRevision: nextRevision, lastDraftMutationId: body.mutationId };
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const errors: Record<string, string> = { REPORT_MISSING: "Report not found.", REPORT_LOCKED: "The report is finalized and cannot be edited.", REPORT_CONFLICT: "Report changed elsewhere. Compare before continuing." };
    return NextResponse.json({ error: errors[code] || "Draft could not be saved. Retry." }, { status: errors[code] ? 409 : 500 });
  }
}
