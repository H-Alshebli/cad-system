"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { correctionTasks, CorrectionTask } from "@/lib/epcrCorrectionTasks";

export default function EpcrCorrectionTasks({ uid }: { uid: string }) {
  const [state, setState] = useState<{ uid: string; rows: CorrectionTask[]; status: "loading" | "ready" | "error" }>({ uid: "", rows: [], status: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let active = true;
    setState({ uid, rows: [], status: "loading" });
    // Single-field query needs no composite index and never subscribes to all users' reports.
    const stop = onSnapshot(query(collection(db, "epcr"), where("medicalReview.submittedBy", "==", uid)), snapshot => {
      if (active) setState({ uid, status: "ready", rows: correctionTasks(snapshot.docs.map(item => ({ ...item.data(), id: item.id })), uid) });
    }, () => { if (active) setState({ uid, rows: [], status: "error" }); });
    return () => { active = false; stop(); };
  }, [uid, retry]);
  if (!uid) return null;
  const current = state.uid === uid ? state : { rows: [], status: "loading" as const };
  return <section aria-label="Reports needing correction" className="my-5 space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="font-black text-[#123746]">Reports Needing Correction / تقارير تحتاج تصحيح</h2>
        <p className="mt-1 text-sm text-[#607482]">Reports you submitted, including closed cases. Correct and finalize the same report to resubmit.</p></div>
      <span aria-label="Reports needing correction count" className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-900">{current.status === "ready" ? current.rows.length : "—"}</span>
    </div>
    {current.status === "loading" && <p role="status" className="text-sm">Loading correction tasks…</p>}
    {current.status === "error" && <div role="alert" className="text-sm"><p>Unable to load correction tasks. Check your connection and permissions.</p><button onClick={() => setRetry(value => value + 1)} className="mt-2 rounded-lg border px-3 py-2">Retry</button></div>}
    {current.status === "ready" && !current.rows.length && <p className="text-sm text-[#607482]">No reports need correction.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{current.rows.map(task => <article key={task.id} className="min-w-0 space-y-2 rounded-xl border border-amber-200 bg-white p-4">
      <h3 className="font-bold text-[#123746]">{task.reportNumber} · {task.caseNumber}</h3>
      <p className="text-xs text-[#607482]">Returned: {Number.isFinite(Date.parse(task.returnedAt)) ? new Date(task.returnedAt).toLocaleString() : "—"}</p>
      <p className="whitespace-pre-wrap break-words text-sm text-[#274C5A]">{task.reason}</p>
      <Link className="inline-block rounded-lg bg-[#274C5A] px-4 py-2 text-sm font-bold text-white" href={`/epcr/${encodeURIComponent(task.id)}`}>Open Report for Correction</Link>
    </article>)}</div>
  </section>;
}
