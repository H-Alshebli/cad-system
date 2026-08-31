"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Send, Upload } from "lucide-react";

import PermissionGuard from "@/app/components/PermissionGuard";
import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

type PreviewRow = {
  employeeId: string;
  employeeName: string;
  userId: string;
  accountEmail: string;
  combined: { entitlement: number; paid: number; remaining: number };
  employmentStatus: string;
  issues: string[];
};

type EntitlementRecord = {
  id: string;
  batchId: string;
  employeeId: string;
  employeeName: string;
  combined?: { entitlement?: number; paid?: number; remaining?: number };
  status?: string;
  createdAt?: string;
};

const money = new Intl.NumberFormat("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function apiRequest(path: string, init?: RequestInit) {
  await auth.authStateReady();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Your session is not ready. Please refresh the page and sign in again.");
  const token = await currentUser.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

const sampleHeaders = [
  "Employee ID", "Employee Name", "OT 2025", "OT 2026", "OT Entitlement",
  "OT Source Paid", "OT Source Remaining", "OT Payment Marker", "OT Employment",
  "Per Diem 2025", "Per Diem 2026", "Per Diem Entitlement",
  "Per Diem Source Remaining", "Per Diem Payment Marker", "Per Diem Employment",
  "Payment Date", "HR Notes",
];

function downloadSampleWorkbook() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["HCAD Employee Entitlements Import Template"],
    ["Complete one row per employee. Do not rename the Final Import sheet or column headers."],
    ["Payment Marker: leave blank or use Paid. Employment: Active, Left Company, or Not in source."],
    [],
    sampleHeaders,
  ]);
  worksheet["!cols"] = sampleHeaders.map((header) => ({ wch: Math.max(16, header.length + 2) }));
  worksheet["!freeze"] = { xSplit: 0, ySplit: 5 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Final Import");
  XLSX.writeFile(workbook, "HCAD-Employee-Entitlements-Import-Sample.xlsx");
}

export default function EmployeeEntitlementsAdminPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();
  const { can, isAdmin } = usePermissions(user?.role);
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<EntitlementRecord[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canImport = isAdmin || can("employee_entitlements", "import");
  const canSend = isAdmin || can("employee_entitlements", "send");

  async function loadRecords() {
    try {
      const result = await apiRequest("/api/employee-entitlements?scope=all");
      setRecords(result.records || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load entitlement records.");
    }
  }

  useEffect(() => {
    if (user?.uid) void loadRecords();
  }, [user?.uid]);

  async function selectFile(file: File) {
    setBusy("preview"); setError(""); setMessage(""); setPreviewRows([]); setSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const worksheet = workbook.Sheets["Final Import"];
      if (!worksheet) throw new Error('The workbook must contain a sheet named "Final Import".');
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { range: 4, defval: "" });
      if (!rows.length || !("Employee ID" in rows[0])) throw new Error("The Final Import header row is missing or invalid.");
      setFileName(file.name); setRawRows(rows);
      const result = await apiRequest("/api/employee-entitlements/import", {
        method: "POST",
        body: JSON.stringify({ action: "preview", fileName: file.name, rows }),
      });
      setPreviewRows(result.rows || []); setSummary(result.summary || null);
      setMessage("Preview completed. No data has been saved.");
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Could not read the workbook.");
    } finally { setBusy(""); }
  }

  async function importDraft() {
    setBusy("import"); setError(""); setMessage("");
    try {
      const result = await apiRequest("/api/employee-entitlements/import", {
        method: "POST",
        body: JSON.stringify({ action: "import", fileName, rows: rawRows }),
      });
      setMessage(`Draft batch imported successfully. Batch: ${result.batchId}`);
      await loadRecords();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import the draft.");
    } finally { setBusy(""); }
  }

  async function sendBatch(batchId: string) {
    if (!window.confirm("Send this entitlement batch to every employee now?")) return;
    setBusy(`send:${batchId}`); setError(""); setMessage("");
    try {
      const result = await apiRequest("/api/employee-entitlements", {
        method: "POST", body: JSON.stringify({ action: "send_batch", batchId }),
      });
      setMessage(`${result.sent} entitlement statement(s) sent.`);
      await loadRecords();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send the batch.");
    } finally { setBusy(""); }
  }

  const invalidRows = previewRows.filter((row) => row.issues.length);
  const batches = useMemo(() => {
    const map = new Map<string, EntitlementRecord[]>();
    records.forEach((record) => map.set(record.batchId, [...(map.get(record.batchId) || []), record]));
    return [...map.entries()];
  }, [records]);

  return (
    <PermissionGuard module="employee_entitlements" action="view_all" showMessage>
      <div className="page-shell space-y-5">
        <div className="page-header">
          <div>
            <div className="badge mb-3">HR Employee Finance</div>
            <h1 className="page-title">Employee Entitlements</h1>
            <p className="page-subtitle">Preview, validate, import, and send Overtime and Per Diem acknowledgments.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary gap-2" onClick={downloadSampleWorkbook}>
              <Download size={16} /> Download Sample Excel
            </button>
            {canImport && (
              <button className="btn-primary gap-2" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)}>
                <Upload size={16} /> {busy === "preview" ? "Reading..." : "Upload Final Excel"}
              </button>
            )}
          </div>
          <input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => {
            const file = event.target.files?.[0]; if (file) void selectFile(file); event.target.value = "";
          }} />
        </div>

        {error && <div className="notice-danger">{error}</div>}
        {message && <div className="notice-success">{message}</div>}

        {summary && (
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ["Rows", summary.total], ["Matched", summary.matched], ["Errors", summary.invalid],
                ["Entitlement", money.format(summary.entitlement)], ["Paid", money.format(summary.paid)], ["Remaining", money.format(summary.remaining)],
              ].map(([label, value]) => <div key={String(label)} className="card-soft"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#86A7B2]/30 bg-white p-4">
              <div><div className="font-black">{fileName}</div><div className="text-sm text-slate-500">Preview only — nothing is saved until Import Draft.</div></div>
              {canImport && <button className="btn-primary" disabled={Boolean(busy) || invalidRows.length > 0} onClick={importDraft}>{busy === "import" ? "Importing..." : "Import Draft"}</button>}
            </div>
            <div className="card-modern overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-3">Employee</th><th className="p-3">HCAD Match</th><th className="p-3">Entitlement</th><th className="p-3">Remaining</th><th className="p-3">Validation</th></tr></thead>
                <tbody>{previewRows.map((row) => <tr key={row.employeeId} className="border-b last:border-0"><td className="p-3"><div className="font-black">{row.employeeId} — {row.employeeName}</div><div className="text-xs text-slate-500">{row.employmentStatus}</div></td><td className="p-3">{row.userId ? row.accountEmail || row.userId : "Not matched"}</td><td className="p-3 font-bold">{money.format(row.combined.entitlement)}</td><td className="p-3 font-bold">{money.format(row.combined.remaining)}</td><td className="p-3">{row.issues.length ? <span className="inline-flex gap-1 text-red-700"><AlertTriangle size={15} />{row.issues.join("; ")}</span> : <span className="inline-flex gap-1 text-emerald-700"><CheckCircle2 size={15} />PASS</span>}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xl font-black">Imported Batches</h2>
          {!batches.length && <div className="card-modern text-slate-500">No entitlement batches imported yet.</div>}
          {batches.map(([batchId, items]) => {
            const draftCount = items.filter((item) => item.status === "draft").length;
            const sentCount = items.filter((item) => item.status === "sent").length;
            const agreedCount = items.filter((item) => item.status === "agreed").length;
            const disputedCount = items.filter((item) => item.status === "disputed").length;
            return <div key={batchId} className="card-modern flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><FileSpreadsheet className="text-[#0F766E]" /><div><div className="font-black">Batch {batchId}</div><div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-500"><span>{items.length} employees</span>{draftCount > 0 && <span>• {draftCount} draft</span>}{sentCount > 0 && <span>• {sentCount} awaiting</span>}{agreedCount > 0 && <span className="text-emerald-700">• {agreedCount} agreed</span>}{disputedCount > 0 && <span className="text-red-700">• {disputedCount} disputed</span>}</div></div></div>{canSend && draftCount > 0 && <button className="btn-primary gap-2" disabled={Boolean(busy)} onClick={() => sendBatch(batchId)}><Send size={15} />{busy === `send:${batchId}` ? "Sending..." : "Send All"}</button>}</div>;
          })}
        </section>
      </div>
    </PermissionGuard>
  );
}
