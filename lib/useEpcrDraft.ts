"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDocFromServer, onSnapshot, runTransaction } from "firebase/firestore";
import { auth, db } from "./firebase";
import { checkDraftWrite, draftPayload, draftVersion, draftFingerprint, matchesDraftReceipt, DraftReceipt, DRAFT_FIELDS } from "./epcrDraftCore";
import { LocalDraft, removeDraft, restoreDrafts, storeDraft } from "./epcrDraftVault";
import { sendMedicalReview } from "./epcrReviewClient";

type RecordData = Record<string, any>;
type SaveResult = "server" | "local" | "failed";
export type RecoveryPreview = { token: string; local: RecordData; server: RecordData };
type State = { record: RecordData | null; base: string; dirty: boolean; sequence: number; mutation: string; uid: string; scope: string; localId: string; blocked: boolean; ready: boolean; receipts: DraftReceipt[] };
const empty = (): State => ({ record: null, base: "", dirty: false, sequence: 0, mutation: "", uid: "", scope: "", localId: "", blocked: false, ready: false, receipts: [] });
export function useEpcrDraft(id: string, enrich: (record: RecordData) => Promise<RecordData>, patientSync: (patient: any) => RecordData) {
  const [data, render] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading report…");
  const [busy, setBusy] = useState(false);
  const finalizing = useRef(false);
  const submissionRequest = useRef<{ base: string; id: string } | null>(null);
  const [sequence, setSequence] = useState(0);
  const state = useRef<State>(empty());
  const recoveryPreview = useRef<{ view: RecoveryPreview; state: State; version: string; sequence: number } | null>(null);
  const recoveryFlight = useRef(false);
  const flight = useRef<Promise<SaveResult> | null>(null);
  const localQueue = useRef<Promise<unknown>>(Promise.resolve());
  const enrichRef = useRef(enrich); enrichRef.current = enrich;
  const patientSyncRef = useRef(patientSync); patientSyncRef.current = patientSync;
  const persist = useCallback(async () => {
    const s = state.current;
    if (!s.ready || !s.dirty || !s.record || auth.currentUser?.uid !== s.uid) return false;
    const entry: LocalDraft = { record: JSON.parse(JSON.stringify(s.record)), baseVersion: s.base, mutationId: s.mutation, savedAt: Date.now(), receipts: s.receipts.map(receipt => ({ ...receipt })) };
    const task = localQueue.current.catch(() => {}).then(() => storeDraft(s.scope, s.localId, entry));
    localQueue.current = task;
    await task;
    return true;
  }, []);
  const flush = useCallback(async (): Promise<SaveResult> => {
    while (flight.current) { await flight.current; if (!state.current.dirty) return "server"; }
    const s = state.current;
    if (!s.ready || !s.record || auth.currentUser?.uid !== s.uid || s.blocked) return "failed";
    if (!s.dirty) return "server";
    const task = (async (): Promise<SaveResult> => {
      let local = false;
      try { local = await persist(); } catch { setMessage("Local recovery unavailable. Keep this page open until saved to server."); }
      if (!navigator.onLine) { setMessage(local ? "Saved on this device — waiting for connection" : "Not saved — local storage unavailable. Keep this page open."); return local ? "local" : "failed"; }
      const snapshot = s.record!;
      const version = s.base, mutation = s.mutation, generation = s.sequence;
      setMessage("Saving to server…");
      try {
        const remote = await runTransaction(db, async tx => {
          if (auth.currentUser?.uid !== s.uid) throw new Error("ACCOUNT_CHANGED");
          const ref = doc(db, "epcr", id);
          const found = await tx.get(ref);
          if (!found.exists()) throw new Error("REPORT_MISSING");
          const current = found.data();
          if (checkDraftWrite(current, version, mutation, s.receipts) === "already-saved") return current;
          const patch = { ...draftPayload(snapshot), status: "draft", updatedAt: new Date(), draftRevision: Number(current.draftRevision || 0) + 1, lastDraftMutationId: mutation };
          // Keep evidence of the exact attempted commit before sending it. A late
          // acknowledgement must not make our own prior save look like another editor.
          const receipt = { mutationId: mutation, payload: draftFingerprint(snapshot), version: draftVersion(patch) };
          s.receipts = [...s.receipts.filter(item => item.version !== receipt.version || item.mutationId !== mutation), receipt].slice(-8);
          try { await persist(); } catch { /* In-memory evidence still protects this session. */ }
          if (state.current !== s || auth.currentUser?.uid !== s.uid) throw new Error("ACCOUNT_CHANGED");
          tx.update(ref, patch);
          if (snapshot.patientInfo) tx.update(doc(db, "cases", current.caseId || id), patientSyncRef.current(snapshot.patientInfo));
          return { ...current, ...patch };
        });
        if (state.current !== s) return "failed";
        s.base = draftVersion(remote);
        s.receipts = s.receipts.filter(receipt => receipt.mutationId === remote.lastDraftMutationId && receipt.version === s.base);
        if (s.sequence === generation) {
          s.dirty = false; s.record = { ...s.record, updatedAt: remote.updatedAt, draftRevision: remote.draftRevision };
          const cleanup = localQueue.current.catch(() => {}).then(async () => {
            if (!s.dirty && state.current === s) await removeDraft(s.localId);
          });
          localQueue.current = cleanup;
          try { await cleanup; } catch { setMessage("Saved to server; local recovery cleanup will retry later."); return "server"; }
          if (!s.dirty) setMessage("Saved to server");
        } else { await persist(); setSequence(n => n + 1); }
        return "server";
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (/REPORT_(CONFLICT|LOCKED|MISSING)|ACCOUNT_CHANGED/.test(code)) {
          s.blocked = true;
          setMessage("Sync stopped: report changed elsewhere, was locked, or is unavailable. Your local draft is retained; do not overwrite it. Contact your administrator.");
          return "failed";
        }
        setMessage(local ? "Saved on this device — server sync failed. Retry when connected." : "Save failed. Keep this page open and retry.");
        return local ? "local" : "failed";
      }
    })();
    flight.current = task;
    try { return await task; } finally { if (flight.current === task) flight.current = null; }
  }, [id, persist]);

  useEffect(() => {
    let disposed = false, stopReport = () => {}, releaseLock = () => {};
    const stopAuth = onAuthStateChanged(auth, async account => {
      stopReport();
      releaseLock();
      const s = empty(); state.current = s; render(null); setLoading(true);
      if (!account) { setMessage("Sign in to access this report and local drafts."); setLoading(false); return; }
      s.uid = account.uid;
      s.scope = `${db.app.options.projectId}:${s.uid}`;
      const prefix = `${s.scope}:${id}:`;
      s.localId = `${prefix}${crypto.randomUUID()}`;
      // Only one editor per report per browser profile can own the recovery
      // copy. Other devices are guarded by the server transaction version.
      if (!navigator.locks) { setMessage("This browser cannot safely coordinate local drafts. Use a current Chrome or Edge browser."); setLoading(false); return; }
      const acquired = await new Promise<boolean>((resolve, reject) => {
        void navigator.locks.request(prefix, { ifAvailable: true }, lock => {
          if (!lock || disposed || state.current !== s) { resolve(false); return; }
          return new Promise<void>(release => { releaseLock = release; resolve(true); });
        }).catch(reject);
      }).catch(() => false);
      if (!acquired || state.current !== s || disposed) { if (state.current === s) { setMessage("Report is already open in another tab. Close that editor before continuing here."); setLoading(false); } return; }
      let recovered: LocalDraft | undefined;
      try {
        const saved = await restoreDrafts(s.scope, prefix);
        if (state.current !== s || disposed) return;
        if (saved.length > 1) { s.blocked = true; setMessage("Multiple local drafts found. Administrator review required; nothing was overwritten."); setLoading(false); return; }
        if (saved.length) {
          recovered = saved[0].draft; s.localId = saved[0].id;
          s.record = recovered.record; s.base = recovered.baseVersion; s.mutation = recovered.mutationId; s.dirty = true; s.ready = true;
          s.receipts = Array.isArray(recovered.receipts) ? recovered.receipts : [];
          render(s.record); setLoading(false); setMessage("Recovered local draft — waiting for server verification");
        }
      } catch { setMessage("Local recovery unavailable. Do not leave before server save is confirmed."); }
      if (state.current !== s || disposed) return;
      let initializing = false;
      stopReport = onSnapshot(doc(db, "epcr", id), { includeMetadataChanges: true }, async snap => {
        if (state.current !== s || disposed || snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
        if (!snap.exists()) { s.blocked = true; setMessage("Report not found. Any local recovery copy is retained."); setLoading(false); return; }
        const remote = snap.data();
        if (!s.ready) {
          if (initializing) return;
          initializing = true;
          try {
            const initial = remote.locked ? remote : await enrichRef.current({ ...remote });
            if (state.current !== s || disposed) return;
            s.record = initial; s.base = draftVersion(remote); s.ready = true;
            render(initial); setLoading(false); setMessage(remote.locked ? "Finalized — read only" : "Ready — changes save automatically");
          } catch { setLoading(false); setMessage("Could not load report. Retry without creating a new report."); }
          return;
        }
        if (s.dirty) {
          if (flight.current) return;
          // Reconcile an uncertain commit by its stable mutation ID.
          if (matchesDraftReceipt(remote, s.receipts) || (!s.receipts.length && remote.lastDraftMutationId === s.mutation && !remote.locked && !remote.finalizedAt)) { void flush(); return; }
          if (remote.locked || remote.finalizedAt || draftVersion(remote) !== s.base) {
            s.blocked = true; setMessage("Conflict: server report changed or was finalized. Local edits retained; automatic sync stopped."); return;
          }
          void flush();
        } else { s.record = remote; s.base = draftVersion(remote); render(remote); }
      }, () => { setLoading(false); setMessage(s.dirty ? "Local draft retained — unable to read server report" : "Unable to load report. Check connection and permissions."); });
    });
    return () => { disposed = true; stopAuth(); stopReport(); releaseLock(); };
  }, [id, flush]);

  const setData = useCallback((change: any) => {
    const s = state.current;
    if (!s.ready || !s.record || s.record.locked || s.record.finalizedAt || s.blocked || finalizing.current || auth.currentUser?.uid !== s.uid) return;
    const next = typeof change === "function" ? change(s.record) : change;
    if (JSON.stringify(draftPayload(next)) === JSON.stringify(draftPayload(s.record))) return;
    s.record = next; s.dirty = true; s.sequence++; s.mutation = crypto.randomUUID();
    render(next); setSequence(n => n + 1); setMessage("Saving recovery copy…");
    void persist().then(() => { if (state.current === s && s.dirty && !s.blocked) setMessage(navigator.onLine ? "Saved on this device — syncing…" : "Saved on this device — waiting for connection"); }).catch(() => { if (state.current === s && !s.blocked) setMessage("Local save failed. Keep this page open until server save succeeds."); });
  }, [persist, busy]);
  useEffect(() => {
    if (!state.current.dirty || state.current.blocked) return;
    const timer = setTimeout(() => { void flush(); }, 1200);
    return () => clearTimeout(timer);
  }, [sequence, flush]);
  useEffect(() => {
    const retry = () => { if (state.current.dirty) void flush(); };
    const unload = (event: BeforeUnloadEvent) => { if (state.current.dirty) { event.preventDefault(); event.returnValue = ""; } };
    const leave = () => { if (document.visibilityState === "hidden" && state.current.dirty) void persist().catch(() => {}); };
    const links = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!state.current.dirty || !anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.button !== 0 || anchor.origin !== location.origin) return;
      event.preventDefault(); event.stopPropagation();
      void flush().then(result => { if (result !== "failed") location.assign(anchor.href); });
    };
    window.addEventListener("online", retry); window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", leave); document.addEventListener("click", links, true);
    const interval = setInterval(retry, 15000);
    return () => { clearInterval(interval); window.removeEventListener("online", retry); window.removeEventListener("beforeunload", unload); document.removeEventListener("visibilitychange", leave); document.removeEventListener("click", links, true); };
  }, [flush, persist]);
  const finalize = useCallback(async (): Promise<"done" | "consent" | "failed"> => {
    if (finalizing.current || state.current.blocked) return "failed";
    finalizing.current = true;
    setBusy(true);
    try {
      if (!navigator.onLine) { await persist(); setMessage("Draft saved locally. Finalization requires an online connection."); return "failed"; }
      if (await flush() !== "server" || state.current.dirty) return "failed";
      const s = state.current;
      if (submissionRequest.current?.base !== s.base) submissionRequest.current = { base: s.base, id: crypto.randomUUID() };
      const { result } = await sendMedicalReview(id, { action: "submit", requestId: submissionRequest.current.id, baseVersion: s.base, notes: "" });
      if (state.current !== s || auth.currentUser?.uid !== s.uid) return "failed";
      // The live server snapshot owns the state: do not overwrite a newer
      // reviewer return with a late submission response.
      if (result === "done") setMessage("Submission recorded. See medical review status for the current decision.");
      return result;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Submission failed. Draft retained; check save status before leaving."); return "failed"; }
    finally { finalizing.current = false; setBusy(false); }
  }, [busy, flush, id, persist]);
  const previewRecovery = useCallback(async (): Promise<RecoveryPreview> => {
    const s = state.current;
    if (!s.blocked || !s.ready || !s.record || auth.currentUser?.uid !== s.uid || flight.current) throw new Error("Recovery is not available for this session.");
    await persist();
    const found = await getDocFromServer(doc(db, "epcr", id));
    if (state.current !== s || auth.currentUser?.uid !== s.uid || !found.exists()) throw new Error("Report or account changed. Keep the local copy.");
    const remote = found.data();
    if (remote.locked || remote.finalizedAt) throw new Error("The server report is finalized. It must be returned for correction through the authorized review workflow.");
    const view = { token: crypto.randomUUID(), local: draftPayload(s.record), server: draftPayload(remote) };
    recoveryPreview.current = { view: JSON.parse(JSON.stringify(view)), state: s, version: draftVersion(remote), sequence: s.sequence };
    return view;
  }, [id, persist]);
  const recoverDraft = useCallback(async (token: string, choices: Record<string, "local" | "server">): Promise<SaveResult> => {
    if (recoveryFlight.current) throw new Error("Recovery is already in progress.");
    const preview = recoveryPreview.current, s = state.current;
    if (!preview || token !== preview.view.token || preview.state !== s || preview.sequence !== s.sequence || !s.blocked || auth.currentUser?.uid !== s.uid) throw new Error("Comparison expired. Compare again.");
    for (const field of DRAFT_FIELDS) {
      if (!["local", "server"].includes(choices[field])) throw new Error("Choose a source for every section.");
      if (choices[field] === "local" && preview.view.local[field] === undefined && preview.view.server[field] !== undefined) throw new Error("A missing local section cannot replace server data.");
    }
    recoveryFlight.current = true; setBusy(true);
    try {
      // Verify again before preparing a write; flush also checks inside its transaction.
      const found = await getDocFromServer(doc(db, "epcr", id));
      if (state.current !== s || auth.currentUser?.uid !== s.uid || !found.exists()) throw new Error("Report or account changed.");
      const remote = found.data();
      if (remote.locked || remote.finalizedAt || draftVersion(remote) !== preview.version || draftFingerprint(remote) !== draftFingerprint(preview.view.server)) throw new Error("Server changed after comparison. Compare again; nothing was overwritten.");
      const archivePrefix = `${s.scope}:recovery-archive:${id}:${preview.view.token}`;
      // Archive both sides in the existing encrypted device vault. Archives are not
      // automatic-recovery candidates and are never removed by ordinary save cleanup.
      await localQueue.current.catch(() => {});
      await storeDraft(s.scope, `${archivePrefix}:local`, { record: JSON.parse(JSON.stringify(s.record)), baseVersion: s.base, mutationId: s.mutation, savedAt: Date.now(), receipts: s.receipts });
      await storeDraft(s.scope, `${archivePrefix}:server`, { record: { ...remote, recoverySelection: choices }, baseVersion: preview.version, mutationId: "", savedAt: Date.now() });
      if (state.current !== s || auth.currentUser?.uid !== s.uid) throw new Error("Account changed. Recovery cancelled.");
      const selected = { ...remote };
      for (const field of DRAFT_FIELDS) {
        const value = preview.view[choices[field]][field];
        if (value !== undefined) selected[field] = value;
      }
      s.record = selected; s.base = preview.version; s.mutation = crypto.randomUUID(); s.receipts = []; s.sequence++; s.dirty = true;
      await persist(); // Do not unlock if preserving the selected recovery draft fails.
      s.blocked = false; recoveryPreview.current = null; render(selected);
      const result = await flush();
      if (result === "server") setMessage("Recovery saved as draft. Review all fields and signatures before finalizing.");
      return result;
    } finally { recoveryFlight.current = false; setBusy(false); }
  }, [id, persist, flush]);
  return { data, setData, loading, message, busy, flush, finalize, previewRecovery, recoverDraft, blocked: state.current.blocked };
}
