"use client";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { medicalReviewLabel, MedicalReview, ReviewAction } from "@/lib/epcrMedicalReview";
import { sendMedicalReview } from "@/lib/epcrReviewClient";

export default function EpcrMedicalReviewPanel({ id, medicalReview }: { id: string; medicalReview?: MedicalReview }) {
  const { user } = useCurrentUser();
  const { can, isAdmin } = usePermissions(user?.role);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [historyError, setHistoryError] = useState("");
  const [historyRetry, setHistoryRetry] = useState(0);
  const inFlight = useRef(false);
  const retry = useRef<{ key: string; requestId: string; expectedRevision: number } | null>(null);
  useEffect(() => {
    setEvents([]); setHistoryError(""); setHistoryState("loading");
    if (!medicalReview) return;
    let active = true;
    const unsubscribe = onSnapshot(query(collection(db, "epcr", id, "reviewEvents"), orderBy("at", "desc")), snapshot => {
      if (!active) return;
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setHistoryState("ready"); setHistoryError("");
    }, error => {
      if (!active) return;
      setHistoryState("error");
      setHistoryError(error.code === "permission-denied"
        ? "Review history access was denied. Ask an administrator to check the deployed Firestore rules for reviewEvents in this environment. This does not mean saved comments were deleted."
        : "Unable to load review history. Check your connection and retry. This does not mean saved comments were deleted.");
    });
    return () => { active = false; unsubscribe(); };
  }, [id, !!medicalReview, historyRetry]);
  async function act(action: ReviewAction) {
    if (inFlight.current || !medicalReview) return;
    if (action !== "approve" && !notes.trim()) { setMessage("Enter a comment first."); return; }
    if (action !== "comment" && !window.confirm(action === "approve" ? "Approve this submitted report?" : "Return this report to the team for correction?")) return;
    inFlight.current = true; setBusy(true); setMessage("");
    // Preserve the original revision through an uncertain response, even if
    // the snapshot already received our successful comment.
    const key = JSON.stringify([id, action, notes.trim()]);
    if (retry.current?.key !== key) retry.current = { key, requestId: crypto.randomUUID(), expectedRevision: medicalReview.revision };
    try {
      await sendMedicalReview(id, { action, notes: notes.trim(), requestId: retry.current.requestId, expectedRevision: retry.current.expectedRevision });
      setNotes(""); setMessage("Review saved."); retry.current = null;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review failed. Retry."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const reviewer = can("epcr_medical_review", "view");
  const pending = medicalReview?.status === "pending";
  const own = medicalReview?.submittedBy === user?.uid;
  return <section className="rounded-2xl border border-[#c8dce2] bg-white p-5 space-y-3" aria-label="Medical review">
    <h2 className="font-black text-[#274C5A]">Medical review: {medicalReviewLabel({ medicalReview })}</h2>
    {!medicalReview && <p className="text-sm text-slate-600">This report has no medical-review record. Existing reports are not automatically marked approved.</p>}
    {medicalReview?.status === "returned" && <p className="whitespace-pre-wrap text-sm">Required correction: {medicalReview.notes}</p>}
    {reviewer && pending && <>
      <label className="block text-sm font-semibold">Review comment
        <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000} disabled={busy} rows={3} className="mt-2 w-full rounded-xl border p-3" />
      </label>
      <div className="flex flex-wrap gap-3">
        {can("epcr_medical_review", "review") && <button disabled={busy || !notes.trim()} onClick={() => void act("comment")} className="rounded-xl border px-4 py-2 disabled:opacity-50">Add Comment</button>}
        {can("epcr_medical_review", "return_for_correction") && <button disabled={busy || (own && !isAdmin) || !notes.trim()} onClick={() => void act("return")} className="rounded-xl border border-amber-400 px-4 py-2 disabled:opacity-50">Return for Correction</button>}
        {can("epcr_medical_review", "approve") && <button disabled={busy || (own && !isAdmin)} onClick={() => void act("approve")} className="rounded-xl bg-[#137a4a] px-4 py-2 text-white disabled:opacity-50">Approve</button>}
      </div>
      {own && <p className="text-sm">{isAdmin ? "Administrator self-approval is enabled. You can also return your own submission with a reason. Both actions are recorded in review history." : "A different reviewer must approve or return your submission."}</p>}
      {!notes.trim() && <p className="text-sm text-slate-600">Enter a reason above to enable Return for Correction. Previously saved comments are not automatically used as the return reason.</p>}
    </>}
    <p role="status" className="text-sm">{message}</p>
    {medicalReview && <details open><summary className="cursor-pointer text-sm font-semibold">Review history{historyState === "ready" ? ` (${events.length})` : ""}</summary>
      {historyState === "loading" && <p role="status" className="mt-3 text-sm">Loading review history…</p>}
      {historyState === "error" && <div role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
        <p>{historyError}</p>
        <button type="button" onClick={() => setHistoryRetry(value => value + 1)} className="mt-2 rounded-lg border px-3 py-2">Retry History</button>
      </div>}
      {historyState === "ready" && !events.length && <p className="mt-3 text-sm">No review events found.</p>}
      <ol className="mt-3 space-y-3">{events.map(event => <li key={event.id} className="rounded-lg bg-slate-50 p-3 text-sm">
        <p>{event.action} · {event.actorName} · Submission {event.submission} · {event.at?.toDate?.().toLocaleString()}</p>
        {event.adminSelfApproval && <p>Administrator self-approval</p>}
        {event.adminSelfReturn && <p>Administrator returned own submission</p>}
        <p className="whitespace-pre-wrap">{event.notes}</p>
      </li>)}</ol>
    </details>}
  </section>;
}
