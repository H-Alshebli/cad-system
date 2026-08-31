"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, WalletCards } from "lucide-react";

import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

type RecordItem = {
  id: string;
  period?: string;
  status?: string;
  overtime?: Record<string, any>;
  perDiem?: Record<string, any>;
  combined?: Record<string, any>;
  hrNotes?: string;
  sentAt?: string;
  employeeResponse?: { comment?: string };
  hrResolution?: { action?: string; comment?: string; actorName?: string; at?: string };
};

const money = new Intl.NumberFormat("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function FinanceCard({ title, data }: { title: string; data?: Record<string, any> }) {
  return (
    <div className="card-soft">
      <div className="text-sm font-black text-[#274C5A]">{title}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><div className="text-xs text-slate-500">Entitlement</div><div className="font-black">{money.format(Number(data?.entitlement || 0))}</div></div>
        <div><div className="text-xs text-slate-500">Paid</div><div className="font-black text-emerald-700">{money.format(Number(data?.operationalPaid ?? data?.paid ?? 0))}</div></div>
        <div><div className="text-xs text-slate-500">Remaining</div><div className="font-black text-amber-700">{money.format(Number(data?.operationalRemaining ?? data?.remaining ?? 0))}</div></div>
      </div>
    </div>
  );
}

export default function EmployeeEntitlementsPanel() {
  const { user } = useCurrentUser();
  const { can, isAdmin, loading: permissionsLoading } = usePermissions(user?.role);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const canView = isAdmin || can("employee_entitlements", "view_own");
  const canRespond = isAdmin || can("employee_entitlements", "respond");

  async function load() {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/employee-entitlements?scope=mine", { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load entitlements.");
      setRecords(result.records || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load entitlements.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!permissionsLoading && canView && user?.uid) void load();
    if (!permissionsLoading && !canView) setLoading(false);
  }, [permissionsLoading, canView, user?.uid]);

  async function respond(record: RecordItem, action: "agree" | "dispute") {
    const comment = action === "dispute" ? window.prompt("Explain the reason for your dispute:")?.trim() : "";
    if (action === "dispute" && !comment) return;
    if (action === "agree" && !window.confirm("Confirm that you agree with this entitlement statement?")) return;
    setBusy(record.id); setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/employee-entitlements/${record.id}/response`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save your response.");
      await load();
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : "Could not save your response.");
    } finally { setBusy(""); }
  }

  if (!canView || permissionsLoading) return null;
  return (
    <section id="employee-entitlements" className="card-modern mb-4 scroll-mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="badge mb-2">Employee Acknowledgment</div><h2 className="flex items-center gap-2 text-xl font-black"><WalletCards size={20} />My Overtime & Per Diem</h2><p className="mt-1 text-sm text-slate-500">Review each statement, then agree or submit a dispute to HR.</p></div>
        {loading && <span className="badge"><Clock3 size={13} /> Loading</span>}
      </div>
      {error && <div className="notice-danger mt-4">{error}</div>}
      {!loading && !records.length && <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">No entitlement statement has been sent to you yet.</div>}
      <div className="mt-4 space-y-4">
        {records.map((record) => <article key={record.id} className="rounded-2xl border border-[#86A7B2]/30 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-black">Entitlement Statement • {record.period || "2025-2026"}</div><div className="mt-1 text-xs text-slate-500">Status: <span className="font-black uppercase">{record.status?.replaceAll("_", " ")}</span></div></div>{record.status === "agreed" ? <span className="inline-flex items-center gap-1 text-sm font-black text-emerald-700"><CheckCircle2 size={16} />Agreed</span> : record.status === "disputed" ? <span className="inline-flex items-center gap-1 text-sm font-black text-red-700"><AlertTriangle size={16} />Under HR Review</span> : record.status === "dispute_rejected" ? <span className="badge">Dispute Reviewed & Closed</span> : <span className="badge">Awaiting response</span>}</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3"><FinanceCard title="Overtime" data={record.overtime} /><FinanceCard title="Per Diem" data={record.perDiem} /><FinanceCard title="Combined Total" data={record.combined} /></div>
          {record.hrNotes && <div className="mt-3 text-sm"><span className="font-black">HR note:</span> {record.hrNotes}</div>}
          {record.employeeResponse?.comment && <div className="notice-warning mt-3"><span className="font-black">Your dispute:</span> {record.employeeResponse.comment}</div>}
          {record.hrResolution?.comment && <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><span className="font-black">HR response:</span> {record.hrResolution.comment}{record.hrResolution.action === "correct_and_resend" && <div className="mt-1 font-bold">The amounts were corrected. Please review and respond again.</div>}</div>}
          {record.status === "sent" && canRespond && <div className="mt-4 flex flex-wrap justify-end gap-2"><button className="btn-secondary" disabled={busy === record.id} onClick={() => respond(record, "dispute")}>Dispute / اعتراض</button><button className="btn-primary" disabled={busy === record.id} onClick={() => respond(record, "agree")}>{busy === record.id ? "Saving..." : "Agree / موافق"}</button></div>}
        </article>)}
      </div>
    </section>
  );
}
