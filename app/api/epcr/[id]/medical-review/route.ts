import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { epcrActor } from "@/lib/server/epcrReviewAuth";
import { draftVersion, draftPayload } from "@/lib/epcrDraftCore";
import { reviewTransition, MedicalReview, ReviewAction } from "@/lib/epcrMedicalReview";
import { submissionErrors } from "@/lib/epcrSubmissionValidation";
import { enqueueReviewNotice } from "@/lib/server/reviewNotificationOutbox";

export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!params.id || params.id.includes("/") || params.id.length > 1000) return NextResponse.json({ error: "Invalid report ID." }, { status: 400 });
  const actor = await epcrActor(request.headers.get("authorization"));
  if (!actor) return NextResponse.json({ error: "Active employee authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!body || !["submit", "comment", "approve", "return"].includes(action) || !/^[a-f0-9-]{36}$/i.test(body.requestId || "") || typeof body.notes !== "string" || body.notes.length > 4000) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (action === "submit" ? typeof body.baseVersion !== "string" : !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1) {
    return NextResponse.json({ error: "Report version is required." }, { status: 400 });
  }
  const permission = action === "return" ? "return_for_correction" : action === "comment" ? "review" : action;
  if (action === "submit" ? !actor.can("epcr", "finalize") : !(actor.can("epcr_medical_review", "view") && actor.can("epcr_medical_review", permission))) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }
  try {
    const result = await adminDb.runTransaction(async tx => {
      const ref = adminDb.collection("epcr").doc(params.id);
      const eventRef = ref.collection("reviewEvents").doc(body.requestId);
      const [snapshot, event] = await Promise.all([tx.get(ref), tx.get(eventRef)]);
      if (event.exists) {
        const old = event.data()!;
        if (old.actorId !== actor.uid || old.action !== action || old.notes !== body.notes.trim()
            || old.requestVersion !== (action === "submit" ? body.baseVersion : body.expectedRevision)) throw new Error("Request ID was already used for another operation.");
        return { result: "done" };
      }
      if (!snapshot.exists) throw new Error("Report not found.");
      const report = snapshot.data()!;
      const now = new Date();
      const current = report.medicalReview as MedicalReview | undefined;
      let next: MedicalReview;
      let patch: Record<string, any> = {};
      if (action === "submit") {
        if (report.locked || report.finalizedAt) throw new Error("This report is already submitted. Refresh to see its current state.");
        if (draftVersion(report) !== body.baseVersion) throw new Error("Report changed. Refresh before submitting.");
        const errors = submissionErrors(report);
        if (errors.length) throw new Error("Complete required fields: " + errors.join(", "));
        const consent = await tx.get(ref.collection("forms").doc("dataSharingConsent"));
        if (consent.data()?.completed !== true) return { result: "consent" };
        next = { status: "pending", revision: Number(current?.revision || 0) + 1, submission: Number(current?.submission || 0) + 1, submittedBy: actor.uid, submittedAt: now.toISOString() };
        patch = { status: "finalized", locked: true, finalizedAt: now };
        // Immutable snapshot per submission, stored atomically with the event.
        tx.create(ref.collection("reviewVersions").doc(String(next.submission)), { ...draftPayload(report), submittedAt: now, submittedBy: actor.uid, consent: consent.data() });
      } else {
        if (!current || current.revision !== body.expectedRevision) throw new Error("Review changed or report has not entered medical review. Refresh first.");
        if (!report.locked || !report.finalizedAt) throw new Error("Only locked submissions can be reviewed.");
        next = reviewTransition(current, action as ReviewAction, actor.uid, body.notes, now.toISOString(), actor.isAdmin);
        if (action === "return") patch = { status: "draft", locked: false, finalizedAt: null };
      }
      tx.update(ref, { ...patch, medicalReview: next, updatedAt: now });
      enqueueReviewNotice(tx, body.requestId, { kind: "epcr", recordId: params.id, action,
        ownerId: next.submittedBy, at: now.toISOString() }, next.submittedAt);
      tx.create(eventRef, { actorId: actor.uid, actorName: actor.name, action, notes: body.notes.trim(), at: now, revision: next.revision, submission: next.submission,
        requestVersion: action === "submit" ? body.baseVersion : body.expectedRevision,
        adminSelfApproval: action === "approve" && actor.isAdmin === true && current?.submittedBy === actor.uid,
        adminSelfReturn: action === "return" && actor.isAdmin === true && current?.submittedBy === actor.uid });
      return { result: "done" };
    });
    return NextResponse.json(result);
  } catch (error) {
    // Expected policy errors only; do not expose service credentials or internals.
    const message = error instanceof Error ? error.message : "";
    const safe = /^(Report |This report|Complete required|Review changed|Only |You cannot|A comment|Comment exceeds|Request ID)/.test(message);
    return NextResponse.json({ error: safe ? message : "Review could not be saved. Retry with the same request." }, { status: safe ? 409 : 500 });
  }
}
