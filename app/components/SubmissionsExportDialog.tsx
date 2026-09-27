"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, List, X } from "lucide-react";
import type { ExportMode } from "@/lib/submissionsExport";

export default function SubmissionsExportDialog({ count, onExport, onClose }: { count: number; onExport: (mode: ExportMode) => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<ExportMode | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!; element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  const close = () => { if (!inFlight.current) onClose(); };
  const start = async (mode: ExportMode) => {
    if (inFlight.current || !count) return;
    inFlight.current = true; setBusy(mode); setError("");
    try {
      // Let the progress state paint before building a large workbook.
      await new Promise(resolve => setTimeout(resolve, 30));
      await onExport(mode); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed. Please try again.");
    } finally { inFlight.current = false; setBusy(null); }
  };
  return <dialog ref={dialog} aria-labelledby="export-title" aria-describedby="export-description" aria-busy={!!busy}
    onCancel={event => { event.preventDefault(); close(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-[#d8e6ea] bg-white p-0 text-[#274C5A] shadow-2xl backdrop:bg-slate-950/50">
    <div className="flex items-start justify-between gap-4 border-b border-[#d8e6ea] p-5">
      <div><h2 id="export-title" className="text-xl font-black">Export Excel</h2><p id="export-description" className="mt-1 text-sm text-[#607482]">{count.toLocaleString()} matching results — all filtered results, not just this page.</p></div>
      <button type="button" onClick={close} disabled={!!busy} aria-label="Close export" className="rounded-lg p-2 hover:bg-slate-100 focus-visible:ring-2 disabled:opacity-40"><X size={20}/></button>
    </div>
    <div className="grid gap-3 p-5 sm:grid-cols-2">
      {([{ mode: "basic", title: "Basic details", Icon: List, description: "Case and report references, project, patient, complaint, triage, statuses, dates, times and destination." }, { mode: "full", title: "Full details", Icon: FileSpreadsheet, description: "Basic details plus medical history, examination, narrative, vital signs, medications, consumables and crew." }] as const).map(({ mode, title, Icon, description }) => <button key={mode} type="button" onClick={() => void start(mode)} disabled={!!busy || !count}
        className="flex flex-col items-start rounded-xl border border-[#c8dce2] p-5 text-left transition hover:border-[#274C5A] hover:bg-[#f0f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#274C5A] disabled:cursor-wait disabled:opacity-50">
        <Icon size={25} aria-hidden="true"/><span className="mt-3 text-base font-black">{title}</span><span className="mt-2 flex-1 text-sm leading-6 text-[#607482]">{description}</span><span className="mt-4 inline-flex items-center gap-2 text-sm font-bold"><Download size={16}/>{busy === mode ? "Preparing file…" : "Download .xlsx"}</span>
      </button>)}
    </div>
    <div className="space-y-2 border-t border-[#d8e6ea] bg-[#f8fbfc] p-5 text-xs leading-5 text-[#607482]">
      <p>Long text is retained. Rows stay compact; expand row height or read the formula bar in Excel. Dates and times use your device timezone.</p>
      <p>Full details excludes separate consent/refusal forms, signature images and technical fields. Files contain sensitive information; share only with authorized recipients.</p>
      {error && <p role="alert" className="font-bold text-red-700">{error}</p>}
      {busy && <p role="status">Preparing {busy} details. Please keep this window open.</p>}
    </div>
  </dialog>;
}
