"use client";

import { useState } from "react";
import { DRAFT_FIELDS } from "@/lib/epcrDraftCore";
import type { RecoveryPreview } from "@/lib/useEpcrDraft";

const labels: Record<string, string> = {
  patientInfo: "Patient information", projectInfo: "Project information",
  medicalHistory: "Medical history", headToToe: "Physical assessment",
  narrativeVitals: "Narrative and vital signs", outcome: "Outcome and patient signature",
  transferTeam: "Care team and signatures", time: "Times",
};
function Value({ value }: { value: unknown }) {
  if (value == null) return <span>Not present</span>;
  if (typeof value === "string" && /^data:image\/(png|jpeg);base64,/.test(value)) {
    // eslint-disable-next-line @next/next/no-img-element -- Device-local signature comparison, no optimization/upload.
    return <img src={value} alt="Saved signature or assessment image" className="max-h-40 max-w-full border bg-white" />;
  }
  if (typeof value === "object") return <dl className="space-y-2">{Object.entries(value).map(([key, item]) => <div key={key}><dt className="font-bold">{key}</dt><dd className="ml-2 whitespace-pre-wrap break-words"><Value value={item} /></dd></div>)}</dl>;
  return <span className="whitespace-pre-wrap break-words">{String(value) || "Empty"}</span>;
}
export default function EpcrDraftRecoveryPanel({ previewRecovery, recoverDraft, continueWithServer }: {
  previewRecovery: () => Promise<RecoveryPreview>;
  recoverDraft: (token: string, choices: Record<string, "local" | "server">) => Promise<"server" | "local" | "failed">;
  continueWithServer?: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<RecoveryPreview | null>(null);
  const [choices, setChoices] = useState<Record<string, "local" | "server">>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function compare() {
    setBusy(true); setError(""); setPreview(null); setConfirmed(false); setChoices({});
    try { setPreview(await previewRecovery()); }
    catch (e) { setError(e instanceof Error ? e.message : "Comparison failed. Nothing was overwritten."); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!preview || !confirmed || busy) return;
    setBusy(true); setError("");
    try {
      const result = await recoverDraft(preview.token, choices);
      if (result !== "server") setError("Server save was not confirmed. Keep this page open and check the save status above.");
      setPreview(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Recovery failed. Keep this page open."); }
    finally { setBusy(false); }
  }
  async function useServer() {
    if (!continueWithServer || busy || !window.confirm("Continue with the latest server copy? Your device copy will be archived on this device first.")) return;
    setBusy(true); setError("");
    try { await continueWithServer(); }
    catch (e) { setError(e instanceof Error ? e.message : "Server recovery failed. Your device copy was retained."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
    <h2 className="font-bold">Recover paused draft</h2>
    <p className="text-sm">Compare this device with the latest server copy. Nothing is merged automatically. Review signatures and test values carefully. Finalized reports cannot be unlocked here.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void compare()} className="rounded border bg-white px-3 py-2 disabled:opacity-50">{busy ? "Please wait…" : "Compare local and server copies"}</button>{continueWithServer && <button type="button" disabled={busy} onClick={() => void useServer()} className="rounded border border-[#274C5A] bg-[#274C5A] px-3 py-2 text-white disabled:opacity-50">Continue with server version</button>}</div>
    {error && <p role="alert" className="text-red-800">{error}</p>}
    {preview && <>
      {DRAFT_FIELDS.map(field => <details key={field} className="rounded border bg-white p-3">
        <summary className="cursor-pointer font-semibold">{labels[field]} {choices[field] ? `— ${choices[field]} selected` : "— choose a source"}</summary>
        <div className="grid gap-4 md:grid-cols-2 mt-3 text-sm">
          {(["local", "server"] as const).map(side => <div key={side}>
            <h3 className="font-bold">{side === "local" ? "This device" : "Server"}</h3>
            <div className="max-h-80 overflow-auto border p-2"><Value value={preview[side][field]} /></div>
            <label className="flex gap-2 mt-2"><input type="radio" name={`recovery-${field}`} checked={choices[field] === side} disabled={busy || (side === "local" && preview.local[field] === undefined && preview.server[field] !== undefined)} onChange={() => { setChoices(p => ({ ...p, [field]: side })); setConfirmed(false); }} />Use {side === "local" ? "this device's" : "server"} section</label>
          </div>)}
        </div>
      </details>)}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />I reviewed all sections and signatures and confirm the selected values are correct. Save as draft only.</label>
      <button type="button" disabled={busy || !confirmed || DRAFT_FIELDS.some(field => !choices[field])} onClick={() => void restore()} className="rounded bg-[#274C5A] text-white px-4 py-2 disabled:opacity-50">Save selected recovery draft</button>
    </>}
  </section>;
}
