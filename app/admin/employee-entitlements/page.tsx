"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Download, FileSpreadsheet, Search, Send, Upload } from "lucide-react";

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
  employeeEmail?: string;
  overtime?: { entitlement?: number; operationalPaid?: number; operationalRemaining?: number };
  perDiem?: { entitlement?: number; operationalPaid?: number; operationalRemaining?: number };
  combined?: { entitlement?: number; paid?: number; remaining?: number };
  status?: string;
  createdAt?: string;
  createdByName?: string;
  sentAt?: string;
  sentByName?: string;
  respondedAt?: string;
  employeeResponse?: { action?: string; comment?: string; userName?: string; at?: string };
};

const money = new Intl.NumberFormat("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function recordStatusLabel(status?: string) {
  return ({ draft: "Draft", sent: "Awaiting Response", agreed: "Agreed", disputed: "Disputed" } as Record<string, string>)[status || ""] || "Unknown";
}

function statusBadgeClass(status?: string) {
  if (status === "agreed") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  if (status === "disputed") return "border-red-500/25 bg-red-500/10 text-red-700";
  if (status === "sent") return "border-amber-500/25 bg-amber-500/10 text-amber-700";
  return "border-slate-500/25 bg-slate-500/10 text-slate-700";
}

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
  const [expandedBatchId, setExpandedBatchId] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatus, setBatchStatus] = useState("all");
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
            const responseCount = agreedCount + disputedCount;
            const batchStatusLabel = draftCount > 0
              ? "Draft"
              : responseCount === items.length
              ? "Completed"
              : responseCount > 0
              ? "Partially Responded"
              : "Sent — Awaiting Responses";
            const isExpanded = expandedBatchId === batchId;
            const search = batchSearch.trim().toLowerCase();
            const filteredItems = items.filter((item) => {
              const matchesSearch = !search || [item.employeeId, item.employeeName, item.employeeEmail]
                .filter(Boolean).join(" ").toLowerCase().includes(search);
              return matchesSearch && (batchStatus === "all" || item.status === batchStatus);
            });
            const firstItem = items[0];
            return (
              <div key={batchId} className="card-modern space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet className="mt-1 text-[#0F766E]" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-black">Batch {batchId}</div>
                        <span className="badge">{batchStatusLabel}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Imported {formatDate(firstItem?.createdAt)} by {firstItem?.createdByName || "HR"}
                        {firstItem?.sentAt && ` • Sent ${formatDate(firstItem.sentAt)} by ${firstItem.sentByName || "HR"}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canSend && draftCount > 0 && (
                      <button className="btn-primary gap-2" disabled={Boolean(busy)} onClick={() => sendBatch(batchId)}>
                        <Send size={15} />{busy === `send:${batchId}` ? "Sending..." : "Send All"}
                      </button>
                    )}
                    <button type="button" className="btn-secondary gap-2" onClick={() => {
                      setExpandedBatchId(isExpanded ? "" : batchId);
                      setBatchSearch(""); setBatchStatus("all");
                    }}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      {isExpanded ? "Hide Details" : "View Details"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[["Employees", items.length], ["Draft", draftCount], ["Awaiting", sentCount], ["Agreed", agreedCount], ["Disputed", disputedCount]].map(([label, value]) => (
                    <div key={String(label)} className="card-soft py-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>
                  ))}
                </div>

                {isExpanded && (
                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                      <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="input-field w-full pl-10" value={batchSearch} onChange={(event) => setBatchSearch(event.target.value)} placeholder="Search employee name, ID, or email" /></label>
                      <select className="input-field" value={batchStatus} onChange={(event) => setBatchStatus(event.target.value)}>
                        <option value="all">All statuses</option><option value="draft">Draft</option><option value="sent">Awaiting Response</option><option value="agreed">Agreed</option><option value="disputed">Disputed</option>
                      </select>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-[1200px] w-full text-sm">
                        <thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Employee</th><th className="p-3">Overtime</th><th className="p-3">Per Diem</th><th className="p-3">Combined</th><th className="p-3">Status</th><th className="p-3">Sent</th><th className="p-3">Response</th></tr></thead>
                        <tbody>
                          {filteredItems.map((item) => (
                            <tr key={item.id} className="border-b align-top last:border-0">
                              <td className="p-3"><div className="font-black">{item.employeeId} — {item.employeeName}</div><div className="mt-1 text-xs text-slate-500">{item.employeeEmail || "No email"}</div></td>
                              <td className="p-3"><div className="font-bold">{money.format(item.overtime?.entitlement || 0)}</div><div className="text-xs text-slate-500">Remaining: {money.format(item.overtime?.operationalRemaining || 0)}</div></td>
                              <td className="p-3"><div className="font-bold">{money.format(item.perDiem?.entitlement || 0)}</div><div className="text-xs text-slate-500">Remaining: {money.format(item.perDiem?.operationalRemaining || 0)}</div></td>
                              <td className="p-3"><div className="font-black">{money.format(item.combined?.entitlement || 0)}</div><div className="text-xs text-slate-500">Paid: {money.format(item.combined?.paid || 0)} • Remaining: {money.format(item.combined?.remaining || 0)}</div></td>
                              <td className="p-3"><span className={`badge ${statusBadgeClass(item.status)}`}>{recordStatusLabel(item.status)}</span></td>
                              <td className="p-3 text-xs">{formatDate(item.sentAt)}{item.sentByName && <div className="mt-1 text-slate-500">By {item.sentByName}</div>}</td>
                              <td className="p-3 text-xs">{item.respondedAt ? <><div className="font-bold">{formatDate(item.respondedAt)}</div>{item.employeeResponse?.comment && <div className="mt-2 max-w-sm rounded-xl border border-red-200 bg-red-50 p-2 font-semibold text-red-700">{item.employeeResponse.comment}</div>}</> : "No response yet"}</td>
                            </tr>
                          ))}
                          {!filteredItems.length && <tr><td className="p-5 text-center text-slate-500" colSpan={7}>No employees match these filters.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </PermissionGuard>
  );
}
