"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Download, FileSpreadsheet, Search, Send, Upload, X } from "lucide-react";

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
  monthlyOvertime?: MonthlyEntry[];
  monthlyPerDiem?: MonthlyEntry[];
  issues: string[];
};

type MonthlyEntry = { month: string; quantity: number };

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
  hrResolution?: { action?: string; comment?: string; actorName?: string; at?: string };
  profileAccessPending?: boolean;
  firstViewedAt?: string;
  lastViewedAt?: string;
  monthlyOvertime?: MonthlyEntry[];
  monthlyPerDiem?: MonthlyEntry[];
  version?: number;
};

type CorrectionMode = "edit_statement" | "correct_and_resend";

const money = new Intl.NumberFormat("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function recordStatusLabel(record: EntitlementRecord) {
  if (record.status === "sent" && record.profileAccessPending) return "Profile Incomplete — Access Pending";
  if (record.status === "sent" && record.firstViewedAt) return "Viewed — Awaiting Response";
  return ({ draft: "Draft", sent: "Sent — Not Viewed", agreed: "Agreed", disputed: "Adjustment Requested", dispute_rejected: "Adjustment Reviewed / Closed" } as Record<string, string>)[record.status || ""] || "Unknown";
}

function statusBadgeClass(record: EntitlementRecord) {
  if (record.status === "agreed") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  if (record.status === "disputed") return "border-red-500/25 bg-red-500/10 text-red-700";
  if (record.status === "dispute_rejected") return "border-slate-500/25 bg-slate-500/10 text-slate-700";
  if (record.status === "sent" && record.profileAccessPending) return "border-orange-500/25 bg-orange-500/10 text-orange-800";
  if (record.status === "sent" && record.firstViewedAt) return "border-blue-500/25 bg-blue-500/10 text-blue-700";
  if (record.status === "sent") return "border-amber-500/25 bg-amber-500/10 text-amber-700";
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
const standardMonthHeaders = ["Jun 2025", "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026"];
const overtimeMonthHeaders = [
  "Employee ID",
  "Employee Name",
  ...standardMonthHeaders.slice(0, 7),
  "Dec MDL Beast",
  ...standardMonthHeaders.slice(7),
];
const perDiemMonthHeaders = ["Employee ID", "Employee Name", ...standardMonthHeaders];

function templateSheet(title: string, instructions: string, headers: string[]) {
  const worksheet = XLSX.utils.aoa_to_sheet([[title], [instructions], ["Use Employee ID to link this sheet to Final Import. Enter zero or leave blank when there is no activity."], [], headers]);
  worksheet["!cols"] = headers.map((header) => ({ wch: Math.max(15, header.length + 2) }));
  worksheet["!freeze"] = { xSplit: 0, ySplit: 5 };
  return worksheet;
}

function downloadSampleWorkbook() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, templateSheet("HCAD Employee Entitlements Import Template", "Complete one row per employee. Payment Marker: blank or Paid. Employment: Active, Left Company, or Not in source.", sampleHeaders), "Final Import");
  XLSX.utils.book_append_sheet(workbook, templateSheet("Monthly Overtime Hours", "Enter the employee's overtime hours for each month. Use Dec MDL Beast for event-specific December hours. Do not enter an hourly rate.", overtimeMonthHeaders), "Monthly OT Hours");
  XLSX.utils.book_append_sheet(workbook, templateSheet("Monthly Per Diem Days", "Enter the employee's Per Diem days for each month. Do not enter a daily rate.", perDiemMonthHeaders), "Monthly Per Diem");
  XLSX.writeFile(workbook, "HCAD-Employee-Entitlements-Import-Sample.xlsx");
}

export default function EmployeeEntitlementsAdminPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();
  const { can, isAdmin } = usePermissions(user?.role);
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [monthlyOtRows, setMonthlyOtRows] = useState<Record<string, any>[]>([]);
  const [monthlyPerDiemRows, setMonthlyPerDiemRows] = useState<Record<string, any>[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [workbookIssues, setWorkbookIssues] = useState<string[]>([]);
  const [records, setRecords] = useState<EntitlementRecord[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedBatchId, setExpandedBatchId] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatus, setBatchStatus] = useState("all");
  const [correctionRecord, setCorrectionRecord] = useState<EntitlementRecord | null>(null);
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("edit_statement");
  const [correctionOtMonths, setCorrectionOtMonths] = useState<MonthlyEntry[]>([]);
  const [correctionPerDiemMonths, setCorrectionPerDiemMonths] = useState<MonthlyEntry[]>([]);
  const [correctionAmounts, setCorrectionAmounts] = useState({ otEntitlement: "", otPaid: "", perDiemEntitlement: "", perDiemPaid: "" });
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const canImport = isAdmin || can("employee_entitlements", "import");
  const canSend = isAdmin || can("employee_entitlements", "send");
  const canExport = isAdmin || can("employee_entitlements", "export");

  function exportBatch(batchId: string, items: EntitlementRecord[]) {
    const workbook = XLSX.utils.book_new();
    const summaryRows = items.map((item) => ({
      "Employee ID": item.employeeId, "Employee Name": item.employeeName, Email: item.employeeEmail || "",
      "OT Entitlement": item.overtime?.entitlement || 0, "OT Paid": item.overtime?.operationalPaid || 0, "OT Remaining": item.overtime?.operationalRemaining || 0,
      "Per Diem Entitlement": item.perDiem?.entitlement || 0, "Per Diem Paid": item.perDiem?.operationalPaid || 0, "Per Diem Remaining": item.perDiem?.operationalRemaining || 0,
      "Combined Entitlement": item.combined?.entitlement || 0, Paid: item.combined?.paid || 0, Remaining: item.combined?.remaining || 0,
      Status: recordStatusLabel(item), Sent: item.sentAt || "", "First Viewed": item.firstViewedAt || "", "Last Viewed": item.lastViewedAt || "", Responded: item.respondedAt || "",
      "Employee Response": item.employeeResponse?.comment || "", "HR Response": item.hrResolution?.comment || "",
    }));
    const monthlyRows = (field: "monthlyOvertime" | "monthlyPerDiem", headers: string[]) => items.map((item) => {
      const quantities = Object.fromEntries((item[field] || []).map((entry) => [entry.month, entry.quantity]));
      return { "Employee ID": item.employeeId, "Employee Name": item.employeeName, ...Object.fromEntries(headers.slice(2).map((month) => [month, quantities[month] || 0])) };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Entitlements Summary");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthlyRows("monthlyOvertime", overtimeMonthHeaders)), "Monthly OT Hours");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthlyRows("monthlyPerDiem", perDiemMonthHeaders)), "Monthly Per Diem");
    XLSX.writeFile(workbook, `HCAD-Employee-Entitlements-${batchId}.xlsx`);
  }

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
    setBusy("preview"); setError(""); setMessage(""); setPreviewRows([]); setSummary(null); setWorkbookIssues([]);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const worksheet = workbook.Sheets["Final Import"];
      const otWorksheet = workbook.Sheets["Monthly OT Hours"];
      const perDiemWorksheet = workbook.Sheets["Monthly Per Diem"];
      if (!worksheet) throw new Error('The workbook must contain a sheet named "Final Import".');
      if (!otWorksheet) throw new Error('The workbook must contain a sheet named "Monthly OT Hours".');
      if (!perDiemWorksheet) throw new Error('The workbook must contain a sheet named "Monthly Per Diem".');
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { range: 4, defval: "" });
      const otRows = XLSX.utils.sheet_to_json<Record<string, any>>(otWorksheet, { range: 4, defval: "" });
      const perDiemRows = XLSX.utils.sheet_to_json<Record<string, any>>(perDiemWorksheet, { range: 4, defval: "" });
      if (!rows.length || !("Employee ID" in rows[0])) throw new Error("The Final Import header row is missing or invalid.");
      if (otRows.length && !("Employee ID" in otRows[0])) throw new Error("The Monthly OT Hours header row is invalid.");
      if (perDiemRows.length && !("Employee ID" in perDiemRows[0])) throw new Error("The Monthly Per Diem header row is invalid.");
      setFileName(file.name); setRawRows(rows); setMonthlyOtRows(otRows); setMonthlyPerDiemRows(perDiemRows);
      const result = await apiRequest("/api/employee-entitlements/import", {
        method: "POST",
        body: JSON.stringify({ action: "preview", fileName: file.name, rows, monthlyOtRows: otRows, monthlyPerDiemRows: perDiemRows }),
      });
      setPreviewRows(result.rows || []); setSummary(result.summary || null); setWorkbookIssues(result.workbookIssues || []);
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
        body: JSON.stringify({ action: "import", fileName, rows: rawRows, monthlyOtRows, monthlyPerDiemRows }),
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

  function allMonthEntries(headers: string[], current: MonthlyEntry[] = []) {
    const currentByMonth = new Map(current.map((entry) => [entry.month, Number(entry.quantity || 0)]));
    return Array.from(new Set([...headers, ...current.map((entry) => entry.month)]))
      .map((month) => ({ month, quantity: currentByMonth.get(month) || 0 }));
  }

  function openCorrection(record: EntitlementRecord, mode: CorrectionMode) {
    setCorrectionRecord(record);
    setCorrectionMode(mode);
    setCorrectionOtMonths(allMonthEntries(overtimeMonthHeaders.slice(2), record.monthlyOvertime));
    setCorrectionPerDiemMonths(allMonthEntries(perDiemMonthHeaders.slice(2), record.monthlyPerDiem));
    setCorrectionAmounts({
      otEntitlement: String(record.overtime?.entitlement || 0),
      otPaid: String(record.overtime?.operationalPaid || 0),
      perDiemEntitlement: String(record.perDiem?.entitlement || 0),
      perDiemPaid: String(record.perDiem?.operationalPaid || 0),
    });
    setCorrectionReason("");
    setCorrectionError("");
  }

  function updateMonth(setter: typeof setCorrectionOtMonths, month: string, value: string) {
    const quantity = value === "" ? 0 : Number(value);
    setter((current) => current.map((entry) => entry.month === month ? { ...entry, quantity } : entry));
  }

  async function submitCorrection() {
    if (!correctionRecord) return;
    if (!correctionReason.trim()) {
      setCorrectionError("A correction reason is required.");
      return;
    }
    const numericAmounts = Object.fromEntries(Object.entries(correctionAmounts).map(([key, value]) => [key, Number(value)]));
    if (Object.values(numericAmounts).some((value) => !Number.isFinite(value) || value < 0)) {
      setCorrectionError("All financial amounts must be valid positive numbers or zero.");
      return;
    }
    if ([...correctionOtMonths, ...correctionPerDiemMonths].some((entry) => !Number.isFinite(entry.quantity) || entry.quantity < 0)) {
      setCorrectionError("Monthly hours and days must be valid positive numbers or zero.");
      return;
    }
    if (numericAmounts.otPaid > numericAmounts.otEntitlement || numericAmounts.perDiemPaid > numericAmounts.perDiemEntitlement) {
      setCorrectionError("Paid amounts cannot exceed entitlement amounts.");
      return;
    }

    setBusy(`review:${correctionRecord.id}`); setCorrectionError(""); setError(""); setMessage("");
    try {
      const result = await apiRequest("/api/employee-entitlements", {
        method: "POST",
        body: JSON.stringify({
          action: correctionMode,
          recordId: correctionRecord.id,
          comment: correctionReason.trim(),
          ...numericAmounts,
          monthlyOvertime: correctionOtMonths,
          monthlyPerDiem: correctionPerDiemMonths,
        }),
      });
      setCorrectionRecord(null);
      setMessage(result.status === "draft" ? "Draft statement updated." : "Corrected statement saved and sent to the employee for a new review.");
      await loadRecords();
    } catch (submitError) {
      setCorrectionError(submitError instanceof Error ? submitError.message : "Could not save the correction.");
    } finally { setBusy(""); }
  }

  async function reviewDispute(record: EntitlementRecord, action: "reject_dispute") {
    const comment = window.prompt("Explain why the adjustment request is being closed:")?.trim();
    if (!comment) return;
    const payload: Record<string, any> = { action, recordId: record.id, comment };
    if (!window.confirm("Close this adjustment request without changing the statement?")) return;

    setBusy(`review:${record.id}`); setError(""); setMessage("");
    try {
      const result = await apiRequest("/api/employee-entitlements", { method: "POST", body: JSON.stringify(payload) });
      setMessage("Adjustment request reviewed and closed.");
      await loadRecords();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review the dispute.");
    } finally { setBusy(""); }
  }

  async function relinkAccount(record: EntitlementRecord) {
    const targetEmail = window.prompt(
      `Enter the active account email for employee ID ${record.employeeId}:`,
      record.employeeEmail || ""
    )?.trim();
    if (!targetEmail) return;
    if (!window.confirm(`Move this entitlement statement to ${targetEmail}? The employee ID must match.`)) return;

    setBusy(`relink:${record.id}`); setError(""); setMessage("");
    try {
      const result = await apiRequest("/api/employee-entitlements", {
        method: "POST",
        body: JSON.stringify({ action: "relink_account", recordId: record.id, targetEmail }),
      });
      setMessage(`Entitlement statement linked to ${result.email}. Existing amounts, status, and history were preserved.`);
      await loadRecords();
    } catch (relinkError) {
      setError(relinkError instanceof Error ? relinkError.message : "Could not change the linked account.");
    } finally { setBusy(""); }
  }

  const invalidRows = previewRows.filter((row) => row.issues.length);
  const batches = useMemo(() => {
    const map = new Map<string, EntitlementRecord[]>();
    records.forEach((record) => map.set(record.batchId, [...(map.get(record.batchId) || []), record]));
    return [...map.entries()];
  }, [records]);
  const correctionOtHours = correctionOtMonths.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
  const correctionPerDiemDays = correctionPerDiemMonths.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
  const correctedOtEntitlement = Number(correctionAmounts.otEntitlement) || 0;
  const correctedOtPaid = Number(correctionAmounts.otPaid) || 0;
  const correctedPerDiemEntitlement = Number(correctionAmounts.perDiemEntitlement) || 0;
  const correctedPerDiemPaid = Number(correctionAmounts.perDiemPaid) || 0;
  const correctedCombined = correctedOtEntitlement + correctedPerDiemEntitlement;
  const correctedRemaining = Math.max(0, correctedOtEntitlement - correctedOtPaid) + Math.max(0, correctedPerDiemEntitlement - correctedPerDiemPaid);

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
            {workbookIssues.length > 0 && <div className="notice-danger"><div className="mb-2 font-black">Workbook structure issues</div><ul className="list-disc space-y-1 pl-5">{workbookIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#86A7B2]/30 bg-white p-4">
              <div><div className="font-black">{fileName}</div><div className="text-sm text-slate-500">Preview only — nothing is saved until Import Draft.</div></div>
              {canImport && <button className="btn-primary" disabled={Boolean(busy) || invalidRows.length > 0 || workbookIssues.length > 0} onClick={importDraft}>{busy === "import" ? "Importing..." : "Import Draft"}</button>}
            </div>
            <div className="card-modern overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-3">Employee</th><th className="p-3">HCAD Match</th><th className="p-3">Entitlement</th><th className="p-3">Remaining</th><th className="p-3">Validation</th></tr></thead>
                <tbody>{previewRows.map((row) => <tr key={row.employeeId} className="border-b last:border-0"><td className="p-3"><div className="font-black">{row.employeeId} — {row.employeeName}</div><div className="text-xs text-slate-500">{row.employmentStatus} • {row.monthlyOvertime?.length || 0} OT months • {row.monthlyPerDiem?.length || 0} Per Diem months</div></td><td className="p-3">{row.userId ? row.accountEmail || row.userId : "Not matched"}</td><td className="p-3 font-bold">{money.format(row.combined.entitlement)}</td><td className="p-3 font-bold">{money.format(row.combined.remaining)}</td><td className="p-3">{row.issues.length ? <span className="inline-flex gap-1 text-red-700"><AlertTriangle size={15} />{row.issues.join("; ")}</span> : <span className="inline-flex gap-1 text-emerald-700"><CheckCircle2 size={15} />PASS</span>}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xl font-black">Imported Batches</h2>
          {!batches.length && <div className="card-modern text-slate-500">No entitlement batches imported yet.</div>}
          {batches.map(([batchId, items]) => {
            const draftCount = items.filter((item) => item.status === "draft").length;
            const accessPendingCount = items.filter((item) => item.status === "sent" && item.profileAccessPending).length;
            const viewedCount = items.filter((item) => item.status === "sent" && !item.profileAccessPending && item.firstViewedAt).length;
            const notViewedCount = items.filter((item) => item.status === "sent" && !item.profileAccessPending && !item.firstViewedAt).length;
            const agreedCount = items.filter((item) => item.status === "agreed").length;
            const disputedCount = items.filter((item) => item.status === "disputed").length;
            const resolvedCount = items.filter((item) => item.status === "dispute_rejected").length;
            const responseCount = agreedCount + disputedCount + resolvedCount;
            const batchStatusLabel = draftCount > 0
              ? "Draft"
              : disputedCount > 0
              ? "Needs HR Review"
              : agreedCount + resolvedCount === items.length
              ? "Completed"
              : responseCount > 0
              ? "Partially Responded"
              : accessPendingCount === items.length
              ? "Profile Completion Pending"
              : accessPendingCount > 0
              ? "Partially Access Pending"
              : viewedCount > 0
              ? "Viewed — Awaiting Responses"
              : "Sent — Awaiting Responses";
            const isExpanded = expandedBatchId === batchId;
            const search = batchSearch.trim().toLowerCase();
            const filteredItems = items.filter((item) => {
              const matchesSearch = !search || [item.employeeId, item.employeeName, item.employeeEmail]
                .filter(Boolean).join(" ").toLowerCase().includes(search);
              const matchesStatus = batchStatus === "all"
                ? true
                : batchStatus === "access_pending"
                ? item.status === "sent" && Boolean(item.profileAccessPending)
                : batchStatus === "viewed"
                ? item.status === "sent" && !item.profileAccessPending && Boolean(item.firstViewedAt)
                : batchStatus === "sent"
                ? item.status === "sent" && !item.profileAccessPending && !item.firstViewedAt
                : item.status === batchStatus;
              return matchesSearch && matchesStatus;
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
                    {canExport && <button type="button" className="btn-secondary gap-2" onClick={() => exportBatch(batchId, items)}><Download size={15} />Export Excel</button>}
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

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-7">
                  {[["Employees", items.length], ["Access Pending", accessPendingCount], ["Not Viewed", notViewedCount], ["Viewed", viewedCount], ["Agreed", agreedCount], ["Needs Review", disputedCount], ["Closed", resolvedCount]].map(([label, value]) => (
                    <div key={String(label)} className="card-soft py-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>
                  ))}
                </div>

                {isExpanded && (
                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                      <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="input-field w-full pl-10" value={batchSearch} onChange={(event) => setBatchSearch(event.target.value)} placeholder="Search employee name, ID, or email" /></label>
                      <select className="input-field" value={batchStatus} onChange={(event) => setBatchStatus(event.target.value)}>
                        <option value="all">All statuses</option><option value="draft">Draft</option><option value="access_pending">Profile Incomplete — Access Pending</option><option value="sent">Sent — Not Viewed</option><option value="viewed">Viewed — Awaiting Response</option><option value="agreed">Agreed</option><option value="disputed">Adjustment Requested</option><option value="dispute_rejected">Adjustment Reviewed / Closed</option>
                      </select>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-[1200px] w-full text-sm">
                        <thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Employee</th><th className="p-3">Overtime</th><th className="p-3">Per Diem</th><th className="p-3">Combined</th><th className="p-3">Status</th><th className="p-3">Sent</th><th className="p-3">Response</th></tr></thead>
                        <tbody>
                          {filteredItems.map((item) => (
                            <tr key={item.id} className="border-b align-top last:border-0">
                              <td className="p-3"><div className="font-black">{item.employeeId} — {item.employeeName}</div><div className="mt-1 text-xs text-slate-500">{item.employeeEmail || "No email"}</div>{canSend && <div className="mt-2 flex flex-wrap gap-2"><button className="btn-secondary px-3 py-2 text-xs" disabled={Boolean(busy)} onClick={() => relinkAccount(item)}>{busy === `relink:${item.id}` ? "Linking..." : "Change Linked Account"}</button>{item.status !== "disputed" && <button className="btn-secondary px-3 py-2 text-xs" disabled={Boolean(busy)} onClick={() => openCorrection(item, "edit_statement")}>Edit Statement</button>}</div>}</td>
                              <td className="p-3"><div className="font-bold">{money.format(item.overtime?.entitlement || 0)}</div><div className="text-xs text-slate-500">Remaining: {money.format(item.overtime?.operationalRemaining || 0)}</div>{Boolean(item.monthlyOvertime?.length) && <details className="mt-2"><summary className="cursor-pointer font-bold text-[#0F766E]">{item.monthlyOvertime?.length} monthly entries</summary><div className="mt-1 space-y-1">{item.monthlyOvertime?.map((entry) => <div key={entry.month} className="flex justify-between gap-4"><span>{entry.month}</span><b>{entry.quantity} hrs</b></div>)}</div></details>}</td>
                              <td className="p-3"><div className="font-bold">{money.format(item.perDiem?.entitlement || 0)}</div><div className="text-xs text-slate-500">Remaining: {money.format(item.perDiem?.operationalRemaining || 0)}</div>{Boolean(item.monthlyPerDiem?.length) && <details className="mt-2"><summary className="cursor-pointer font-bold text-[#0F766E]">{item.monthlyPerDiem?.length} monthly entries</summary><div className="mt-1 space-y-1">{item.monthlyPerDiem?.map((entry) => <div key={entry.month} className="flex justify-between gap-4"><span>{entry.month}</span><b>{entry.quantity} days</b></div>)}</div></details>}</td>
                              <td className="p-3"><div className="font-black">{money.format(item.combined?.entitlement || 0)}</div><div className="text-xs text-slate-500">Paid: {money.format(item.combined?.paid || 0)} • Remaining: {money.format(item.combined?.remaining || 0)}</div></td>
                              <td className="p-3"><span className={`badge ${statusBadgeClass(item)}`}>{recordStatusLabel(item)}</span>{item.firstViewedAt && <div className="mt-2 text-xs text-slate-500">First viewed: {formatDate(item.firstViewedAt)}{item.lastViewedAt && <><br />Last viewed: {formatDate(item.lastViewedAt)}</>}</div>}</td>
                              <td className="p-3 text-xs">{formatDate(item.sentAt)}{item.sentByName && <div className="mt-1 text-slate-500">By {item.sentByName}</div>}</td>
                              <td className="p-3 text-xs">
                                {item.respondedAt ? <><div className="font-bold">{formatDate(item.respondedAt)}</div>{item.employeeResponse?.comment && <div className="mt-2 max-w-sm rounded-xl border border-red-200 bg-red-50 p-2 font-semibold text-red-700">Employee: {item.employeeResponse.comment}</div>}</> : "No response yet"}
                                {item.hrResolution?.comment && <div className="mt-2 max-w-sm rounded-xl border border-blue-200 bg-blue-50 p-2 font-semibold text-blue-700">HR: {item.hrResolution.comment}</div>}
                                {item.status === "disputed" && canSend && <div className="mt-2 flex flex-wrap gap-2"><button className="btn-primary px-3 py-2 text-xs" disabled={Boolean(busy)} onClick={() => openCorrection(item, "correct_and_resend")}>Correct & Resend</button><button className="btn-secondary px-3 py-2 text-xs" disabled={Boolean(busy)} onClick={() => reviewDispute(item, "reject_dispute")}>Close Without Adjustment</button></div>}
                              </td>
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

        {correctionRecord && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/45" role="dialog" aria-modal="true" aria-labelledby="correction-title">
            <button className="absolute inset-0 cursor-default" aria-label="Close correction form" onClick={() => !busy && setCorrectionRecord(null)} />
            <section className="relative z-10 h-full w-full overflow-y-auto bg-[#f4f9fb] shadow-2xl md:max-w-3xl">
              <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
                <div>
                  <div className="badge mb-2">HR Correction</div>
                  <h2 id="correction-title" className="text-xl font-black text-[#123746]">{correctionMode === "correct_and_resend" ? "Correct & Resend Statement" : "Edit Entitlement Statement"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{correctionRecord.employeeId} — {correctionRecord.employeeName} • Version {correctionRecord.version || 1}</p>
                </div>
                <button type="button" className="btn-secondary !p-2" aria-label="Close" disabled={Boolean(busy)} onClick={() => setCorrectionRecord(null)}><X size={20} /></button>
              </div>

              <div className="space-y-5 p-4 md:p-6">
                {correctionMode === "correct_and_resend" && correctionRecord.employeeResponse?.comment && (
                  <div className="notice-danger"><div className="mb-1 text-xs font-black uppercase">Employee adjustment request</div>{correctionRecord.employeeResponse.comment}</div>
                )}

                <div className="card-modern space-y-4">
                  <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Overtime</h3><p className="text-xs text-slate-500">Enter the number of hours for each month.</p></div><span className="badge">{correctionOtHours} total hours</span></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {correctionOtMonths.map((entry) => <label key={entry.month} className="text-xs font-bold text-slate-600">{entry.month}<input type="number" min="0" step="0.01" className="input-field mt-1 w-full" value={entry.quantity} onChange={(event) => updateMonth(setCorrectionOtMonths, entry.month, event.target.value)} /></label>)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-bold">Total Overtime Amount (SAR)<input type="number" min="0" step="0.01" className="input-field mt-1 w-full" value={correctionAmounts.otEntitlement} onChange={(event) => setCorrectionAmounts((current) => ({ ...current, otEntitlement: event.target.value }))} /></label>
                    <label className="text-sm font-bold">Overtime Paid (SAR)<input type="number" min="0" step="0.01" className="input-field mt-1 w-full" value={correctionAmounts.otPaid} onChange={(event) => setCorrectionAmounts((current) => ({ ...current, otPaid: event.target.value }))} /></label>
                  </div>
                </div>

                <div className="card-modern space-y-4">
                  <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Per Diem</h3><p className="text-xs text-slate-500">Enter the number of days for each month.</p></div><span className="badge">{correctionPerDiemDays} total days</span></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {correctionPerDiemMonths.map((entry) => <label key={entry.month} className="text-xs font-bold text-slate-600">{entry.month}<input type="number" min="0" step="0.01" className="input-field mt-1 w-full" value={entry.quantity} onChange={(event) => updateMonth(setCorrectionPerDiemMonths, entry.month, event.target.value)} /></label>)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-bold">Total Per Diem Amount (SAR)<input type="number" min="0" step="0.01" className="input-field mt-1 w-full" value={correctionAmounts.perDiemEntitlement} onChange={(event) => setCorrectionAmounts((current) => ({ ...current, perDiemEntitlement: event.target.value }))} /></label>
                    <label className="text-sm font-bold">Per Diem Paid (SAR)<input type="number" min="0" step="0.01" className="input-field mt-1 w-full" value={correctionAmounts.perDiemPaid} onChange={(event) => setCorrectionAmounts((current) => ({ ...current, perDiemPaid: event.target.value }))} /></label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="card-soft"><div className="text-xs font-bold text-slate-500">Combined Entitlement</div><div className="mt-1 text-xl font-black">{money.format(correctedCombined)} SAR</div></div>
                  <div className="card-soft"><div className="text-xs font-bold text-slate-500">Combined Paid</div><div className="mt-1 text-xl font-black">{money.format(correctedOtPaid + correctedPerDiemPaid)} SAR</div></div>
                  <div className="card-soft"><div className="text-xs font-bold text-slate-500">Combined Remaining</div><div className="mt-1 text-xl font-black">{money.format(correctedRemaining)} SAR</div></div>
                </div>

                <label className="block text-sm font-black">Correction Reason *<textarea className="input-field mt-2 min-h-28 w-full resize-y" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Explain what was changed and why. This note will be shown to the employee." /></label>
                {correctionError && <div className="notice-danger">{correctionError}</div>}
              </div>

              <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white p-4">
                <button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={() => setCorrectionRecord(null)}>Cancel</button>
                <button type="button" className="btn-primary" disabled={Boolean(busy)} onClick={submitCorrection}>{busy === `review:${correctionRecord.id}` ? "Saving..." : correctionRecord.status === "draft" ? "Save Draft Changes" : "Save & Resend"}</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
