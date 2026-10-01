// /components/CaseEpcrSubmissionsTable.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { getCaseDisplayCode, getEpcrDisplayCode } from "@/lib/displayLabels";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { getEpcrStatus } from "@/lib/epcrStatus";
import { medicalReviewLabel, MedicalReview } from "@/lib/epcrMedicalReview";
import { matchesSubmissionDate } from "@/lib/epcrDraftCore";
import SubmissionsExportDialog from "./SubmissionsExportDialog";
import SubmissionsMultiSelect from "./SubmissionsMultiSelect";

const HISTORICAL_IMPORT_HEADERS = [
  "Submission ID", "Project ID", "Project Name", "Report Date", "Patient First Name",
  "Patient Last Name", "Patient ID / Iqama", "Age", "Gender", "Phone", "Nationality",
  "Chief Complaint", "Signs and Symptoms", "Triage Level", "Health Classification",
  "Narrative", "Primary Assessment", "Secondary Assessment", "Impression", "Medications",
  "Procedures", "Oxygen Therapy", "Pickup Location", "Destination", "Crew Names",
  "Ambulance / Unit", "Original PDF URL", "Legacy Notes",
];

type ImportPreviewRow = { rowNumber: number; submissionId: string; patientName: string; project: string; originalProject?: string; projectId?: string; reportDate: string; status: "ready" | "needs_review" | "duplicate"; warnings: string[] };
type ImportProjectOption = { id: string; projectName: string; projectCode?: string };

function downloadHistoricalImportSample() {
  const workbook = XLSX.utils.book_new();
  const instructions = XLSX.utils.aoa_to_sheet([
    ["HCAD Historical ePCR Import"],
    ["Fill one row per Jotform submission. Do not rename the Historical ePCR Import sheet or headers."],
    ["Missing fields will not block upload. They will be imported as Draft / Needs Review."],
    ["Separate list values such as symptoms, medications, procedures, and crew names with semicolons."],
    ["Use Submission ID whenever available to prevent duplicate reports."],
  ]);
  const data = XLSX.utils.aoa_to_sheet([HISTORICAL_IMPORT_HEADERS]);
  data["!cols"] = HISTORICAL_IMPORT_HEADERS.map((header) => ({ wch: Math.min(30, Math.max(16, header.length + 2)) }));
  data["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  XLSX.utils.book_append_sheet(workbook, data, "Historical ePCR Import");
  XLSX.writeFile(workbook, "HCAD-Historical-ePCR-Import-Sample.xlsx");
}

type FirestoreDate = Timestamp | Date | string | null | undefined;

type CaseDoc = {
  id: string;
  assignedUnit?: {
    id?: string;
    name?: string;
    type?: string;
  };
  callerName?: string;
  chiefComplaint?: string;
  contactNumber?: string;
  createdAt?: FirestoreDate;
  destination?: {
    name?: string;
    type?: string;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    id?: string;
  };
  level?: string;
  location?: {
    text?: string;
    source?: string;
    googleMapLink?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  patient?: {
    name?: string;
    phone?: string;
  };
  patientName?: string;
  projectId?: string;
  status?: string;
  timeline?: Record<string, FirestoreDate>;
  [key: string]: unknown;
};

type EpcrDoc = {
  medicalReview?: MedicalReview;
  id: string;
  caseId?: string;
  epcrId?: string;
  createdAt?: FirestoreDate;
  finalizedAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
  createdBy?: string;
  locked?: boolean;
  projectId?: string;
  projectInfo?: {
    projectId?: string;
    projectName?: string;
  };
  status?: string;
  patientInfo?: {
    firstName?: string;
    lastName?: string;
    patientId?: string;
    age?: number | string;
    gender?: string;
    phone?: string;
    nationality?: string;
    factoryName?: string;
    weightKg?: number | string;
    triageColor?: string;
    healthClassification?: string;
    chiefComplaints?: string[];
    signsAndSymptoms?: string[];
  };
  medicalHistory?: Record<string, unknown>;
  headToToe?: Record<string, unknown>;
  narrative?: Record<string, unknown>;
  narrativeVitals?: Record<string, unknown>;
  outcome?: {
    destination?: string;
    hospitalName?: string;
    hospitalMember?: string;
    hospitalSignatureDataUrl?: string;
    patientSignatureDataUrl?: string;
  };
  time?: {
    movingTime?: {
      timeHHMM?: string;
    };
    arrivalTime?: {
      timeHHMM?: string;
    };
    arrivalToPTTime?: {
      timeHHMM?: string;
    };
    leavingSceneTime?: {
      timeHHMM?: string;
    };
    hospitalTime?: {
      timeHHMM?: string;
    };
    dischargeTime?: {
      timeHHMM?: string;
    };
    waitingTime?: {
      timeHHMM?: string;
    };
    backTime?: {
      timeHHMM?: string;
    };
  };
  transferTeam?: Record<string, unknown>;
  [key: string]: unknown;
};

type Row = {
  caseItem: CaseDoc;
  epcr?: EpcrDoc;
};

function formatDate(value: FirestoreDate) {
  if (!value) return "-";

  try {
    let date: Date;

    if (value instanceof Timestamp) {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function shortId(id?: string) {
  if (!id) return "-";
  return id.length > 10 ? `${id.slice(0, 8)}...` : id;
}

function getPatientName(caseItem: CaseDoc, epcr?: EpcrDoc) {
  const fromCase = caseItem.patient?.name || caseItem.patientName;
  if (fromCase) return fromCase;

  const firstName = epcr?.patientInfo?.firstName || "";
  const lastName = epcr?.patientInfo?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "-";
}

function getProjectName(caseItem: CaseDoc, epcr?: EpcrDoc) {
  return (
    epcr?.projectInfo?.projectName ||
    caseItem.projectId ||
    epcr?.projectId ||
    "-"
  );
}

function getChiefComplaint(caseItem: CaseDoc, epcr?: EpcrDoc) {
  return (
    caseItem.chiefComplaint ||
    epcr?.patientInfo?.chiefComplaints?.join(", ") ||
    "-"
  );
}

function getTriage(caseItem: CaseDoc, epcr?: EpcrDoc) {
  return epcr?.patientInfo?.triageColor || caseItem.level || "-";
}

function getDestination(caseItem: CaseDoc, epcr?: EpcrDoc) {
  return (
    caseItem.destination?.name ||
    epcr?.outcome?.hospitalName ||
    epcr?.outcome?.destination ||
    "-"
  );
}

function statusBadge(status?: string) {
  const value = status || "-";

  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black";

  if (value.toLowerCase().includes("closed")) {
    return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-700`;
  }

  if (value.toLowerCase().includes("draft")) {
    return `${base} border-amber-500/25 bg-amber-500/10 text-amber-700`;
  }

  if (value.toLowerCase().includes("final")) {
    return `${base} border-[#274C5A]/25 bg-[#274C5A]/10 text-[#274C5A]`;
  }

  if (value.toLowerCase().includes("not created")) {
    return `${base} border-rose-500/25 bg-rose-500/10 text-rose-700`;
  }

  return `${base} border-[#86A7B2]/30 bg-[#86A7B2]/12 text-[#274C5A]`;
}


export default function CaseEpcrSubmissionsTable({
  projectId,
}: {
  projectId?: string;
}) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();
  const { can, isAdmin } = usePermissions(user?.role);
  const [cases, setCases] = useState<CaseDoc[]>([]);
  const [epcrs, setEpcrs] = useState<EpcrDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [epcrLoading, setEpcrLoading] = useState(true);
  const [exportSelection, setExportSelection] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState<string[]>([]);
  const [epcrStatusFilter, setEpcrStatusFilter] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string[]>([]);
  const [fromDateTime, setFromDateTime] = useState("");
  const [toDateTime, setToDateTime] = useState("");
  const [detailed, setDetailed] = useState(true);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, caseStatusFilter, epcrStatusFilter, selectedProject, fromDateTime, toDateTime, projectId]);
  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<Record<string, number> | null>(null);
  const [importBusy, setImportBusy] = useState("");
  const [importError, setImportError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importProjectOptions, setImportProjectOptions] = useState<ImportProjectOption[]>([]);
  const [importProjectMappings, setImportProjectMappings] = useState<Record<string, string>>({});
  const canImport = isAdmin || can("submissions", "import");
  const unresolvedImportProjects = useMemo(() => Array.from(new Set(importPreview
    .filter((row) => row.originalProject && row.warnings.some((warning) => warning.includes("not linked to an HCAD project")))
    .map((row) => row.originalProject as string))).sort((left, right) => left.localeCompare(right)), [importPreview]);

  async function historicalImportRequest(action: "preview" | "import" | "repair", rows: Record<string, unknown>[], fileName = importFileName, projectMappings = importProjectMappings) {
    await auth.authStateReady();
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Authentication is required.");
    const response = await fetch("/api/submissions/historical-import", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, fileName, rows, projectMappings }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Historical import could not be completed.");
    return result;
  }

  async function repairHistoricalImports() {
    if (!window.confirm("Repair the clinical fields of previously imported Jotform ePCR records? Existing HCAD/ePCR numbers will not change.")) return;
    setImportBusy("repair"); setImportError(""); setImportMessage("");
    try {
      const result = await historicalImportRequest("repair", []);
      setImportMessage(`Repair completed. ${Number(result.repaired || 0).toLocaleString()} imported ePCR record(s) updated.`);
    } catch (error) { setImportError(error instanceof Error ? error.message : "Could not repair imported records."); }
    finally { setImportBusy(""); }
  }

  async function previewHistoricalFile(file: File) {
    setImportBusy("preview"); setImportError(""); setImportMessage(""); setImportPreview([]); setImportSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets["Historical ePCR Import"] || workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("The workbook does not contain a readable sheet.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!rows.length) throw new Error("The selected import sheet has no data rows.");
      setImportFileName(file.name); setImportRows(rows);
      const result = await historicalImportRequest("preview", rows, file.name);
      setImportPreview(result.preview || []); setImportSummary(result.summary || null); setImportProjectOptions(result.projectOptions || []);
      setImportMessage("Preview completed. No database records have been created yet.");
    } catch (error) { setImportError(error instanceof Error ? error.message : "Could not read this workbook."); }
    finally { setImportBusy(""); }
  }

  async function mapImportProject(sourceProject: string, hcadProjectId: string) {
    const nextMappings = { ...importProjectMappings, [sourceProject]: hcadProjectId };
    setImportProjectMappings(nextMappings);
    try { window.localStorage.setItem("hcad-jotform-project-mappings", JSON.stringify(nextMappings)); } catch {}
    if (!importRows.length) return;
    setImportBusy("mapping"); setImportError(""); setImportMessage(`Applying project mapping for ${sourceProject}...`);
    try {
      const result = await historicalImportRequest("preview", importRows, importFileName, nextMappings);
      setImportPreview(result.preview || []); setImportSummary(result.summary || null); setImportProjectOptions(result.projectOptions || importProjectOptions);
      setImportMessage("Project mapping applied. No database records have been created yet.");
    } catch (error) { setImportError(error instanceof Error ? error.message : "Could not apply project mapping."); }
    finally { setImportBusy(""); }
  }

  async function applyHistoricalImport() {
    if (!importRows.length || !window.confirm("Import all non-duplicate rows as historical Draft ePCR records? Rows with warnings will be marked Needs Review.")) return;
    setImportBusy("import"); setImportError(""); setImportMessage("");
    try {
      const result = await historicalImportRequest("import", importRows);
      setImportSummary(result.summary || importSummary);
      setImportMessage(`Import completed. ${result.summary?.imported || 0} record(s) imported; ${result.summary?.skippedDuplicates || 0} duplicate(s) skipped.`);
    } catch (error) { setImportError(error instanceof Error ? error.message : "Could not import historical records."); }
    finally { setImportBusy(""); }
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("hcad-jotform-project-mappings");
      if (stored) setImportProjectMappings(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);

    const casesQuery = query(
      collection(db, "cases"),
      orderBy("createdAt", "desc")
    );

    const epcrQuery = query(
      collection(db, "epcr"),
      orderBy("createdAt", "desc")
    );

    const unsubCases = onSnapshot(
      casesQuery,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<CaseDoc, "id">),
        }));

        setCases(list);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load cases:", error);
        setLoadError("Could not load cases. Check your connection and refresh.");
        setLoading(false);
      }
    );

    const unsubEpcr = onSnapshot(
      epcrQuery,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<EpcrDoc, "id">),
        }));

        setEpcrs(list);
        setEpcrLoading(false);
      },
      (error) => {
        console.error("Failed to load ePCR records:", error);
        setEpcrLoading(false);
        setLoadError("Could not load reports. Missing-report labels are unavailable until loading succeeds.");
      }
    );

    return () => {
      unsubCases();
      unsubEpcr();
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const byId = new Map(epcrs.map(report => [report.id, report]));
    const byCase = new Map<string, EpcrDoc>();
    for (const report of epcrs) if (report.caseId && !byCase.has(report.caseId)) byCase.set(report.caseId, report);
    return cases
      .filter((caseItem) => {
        if (!projectId) return true;

        const linkedEpcr = byId.get(caseItem.id) || byCase.get(caseItem.id);

        return (
          caseItem.projectId === projectId ||
          linkedEpcr?.projectId === projectId ||
          linkedEpcr?.projectInfo?.projectId === projectId
        );
      })
      .map((caseItem) => {
        const linkedEpcr = byId.get(caseItem.id) || byCase.get(caseItem.id);

        return {
          caseItem,
          epcr: linkedEpcr,
        };
      });
  }, [cases, epcrs, projectId]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows.filter(({ caseItem, epcr }) => {
      const searchableText = [
        caseItem.id,
        caseItem.caseNumber,
        caseItem.caseSequence,
        epcr?.epcrId,
        epcr?.id,
        epcr?.epcrNumber,
        epcr?.epcrSequence,
        caseItem.externalReference,
        epcr?.externalReference,
        getProjectName(caseItem, epcr),
        getPatientName(caseItem, epcr),
        getChiefComplaint(caseItem, epcr),
        epcr?.patientInfo?.phone,
        caseItem.contactNumber,
        caseItem.status,
        getEpcrStatus(epcr),
        getTriage(caseItem, epcr),
        getDestination(caseItem, epcr),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchableText.includes(keyword);

      const matchesCaseStatus =
        caseStatusFilter.length === 0 ||
        caseStatusFilter.some(status => caseItem.status?.toLowerCase() === status.toLowerCase());

      const epcrStatus = getEpcrStatus(epcr);

      const matchesEpcrStatus =
        epcrStatusFilter.length === 0 ||
        epcrStatusFilter.some(status => epcrStatus.toLowerCase() === status.toLowerCase());

      const matchesProject = selectedProject.length === 0 || selectedProject.includes(getProjectName(caseItem, epcr));
      const validRange = !fromDateTime || !toDateTime || fromDateTime <= toDateTime;
      return matchesSearch && matchesCaseStatus && matchesEpcrStatus && matchesProject && validRange && matchesSubmissionDate(caseItem.createdAt, fromDateTime, toDateTime);
    });
  }, [rows, search, caseStatusFilter, epcrStatusFilter, selectedProject, fromDateTime, toDateTime]);
  const projectOptions = useMemo(() => Array.from(new Set(rows.map(({ caseItem, epcr }) => getProjectName(caseItem, epcr)))).sort(), [rows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 50));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleRows = filteredRows.slice(currentPage * 50, (currentPage + 1) * 50);

  const totalCases = rows.length;
  const totalWithEpcr = rows.filter((row) => row.epcr).length;
  const totalWithoutEpcr = rows.filter((row) => !row.epcr).length;
  const totalClosed = rows.filter(
    (row) => row.caseItem.status?.toLowerCase() === "closed"
  ).length;

  const caseStatuses = useMemo(() => Array.from(
    new Set(rows.map((row) => row.caseItem.status).filter(Boolean))
  ) as string[], [rows]);

  const epcrStatuses = useMemo(() => Array.from(
    new Set(
      rows.map((row) => getEpcrStatus(row.epcr)).filter(Boolean)
    )
  ) as string[], [rows]);

  if (loadError) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{loadError}</p>;
  if (loading || epcrLoading) {
    return (
      <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-6 text-[#274C5A] shadow-sm">
        Loading submissions...
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      {exportSelection && <SubmissionsExportDialog count={exportSelection.length}
        onClose={() => setExportSelection(null)}
        onExport={async mode => {
          const { downloadSubmissions } = await import("@/lib/submissionsWorkbook");
          await downloadSubmissions(exportSelection, mode);
        }} />}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#7F7F7F]">Total Cases</p>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{totalCases}</p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#7F7F7F]">With ePCR</p>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{totalWithEpcr}</p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#7F7F7F]">Without ePCR</p>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">
            {totalWithoutEpcr}
          </p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#7F7F7F]">Closed Cases</p>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{totalClosed}</p>
        </div>
      </div>

      {canImport && (
        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-black">Historical ePCR Import</h2><p className="mt-1 text-sm text-[#7F7F7F]">Upload Jotform history for comparison. Missing fields do not block upload; they are marked for review.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadHistoricalImportSample} className="rounded-xl border border-[#86A7B2]/30 px-4 py-2 text-sm font-black">Download Import Sample</button>
              <button type="button" disabled={Boolean(importBusy)} onClick={() => void repairHistoricalImports()} className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-black text-amber-900 disabled:opacity-50">{importBusy === "repair" ? "Repairing..." : "Repair Imported ePCR"}</button>
              <button type="button" disabled={Boolean(importBusy)} onClick={() => importInputRef.current?.click()} className="rounded-xl bg-[#274C5A] px-4 py-2 text-sm font-black text-white disabled:opacity-50">{importBusy === "preview" ? "Reading..." : "Import Excel"}</button>
              <input ref={importInputRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void previewHistoricalFile(file); event.target.value = ""; }} />
            </div>
          </div>
          {importError && <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">{importError}</div>}
          {importMessage && <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{importMessage}</div>}
          {unresolvedImportProjects.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="font-black text-amber-900">Link Jotform Projects to HCAD</div>
              <p className="mt-1 text-sm text-amber-800">Choose the matching HCAD project for each imported project name. Your choices are saved for the next Excel batches.</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {unresolvedImportProjects.map((sourceProject) => (
                  <label key={sourceProject} className="grid gap-1 text-sm font-bold text-[#274C5A]">
                    <span>Jotform: {sourceProject}</span>
                    <select value={importProjectMappings[sourceProject] || ""} disabled={Boolean(importBusy)} onChange={(event) => void mapImportProject(sourceProject, event.target.value)} className="rounded-xl border border-amber-300 bg-white px-3 py-2 font-semibold outline-none">
                      <option value="">Select matching HCAD project</option>
                      {importProjectOptions.map((project) => <option key={project.id} value={project.id}>{project.projectName}{project.projectCode ? ` — ${project.projectCode}` : ""}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
          {importSummary && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[["Rows", importSummary.total || 0], ["Ready", importSummary.ready || 0], ["Needs Review", importSummary.needsReview || 0], ["Duplicates", importSummary.duplicates || 0]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[#86A7B2]/25 bg-[#f8fbfc] p-3"><div className="text-xs font-bold text-[#7F7F7F]">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>)}
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#86A7B2]/25">
                <table className="min-w-[1000px] w-full text-sm"><thead><tr className="border-b bg-[#f8fbfc] text-left text-xs uppercase text-[#7F7F7F]"><th className="p-3">Row</th><th className="p-3">Submission</th><th className="p-3">Patient</th><th className="p-3">Project</th><th className="p-3">Date</th><th className="p-3">Status & Findings</th></tr></thead><tbody>{importPreview.map((row) => <tr key={`${row.rowNumber}-${row.submissionId}`} className="border-b align-top last:border-0"><td className="p-3 font-bold">{row.rowNumber}</td><td className="p-3">{row.submissionId || "Generated on import"}</td><td className="p-3">{row.patientName || "—"}</td><td className="p-3">{row.project || "—"}</td><td className="p-3">{row.reportDate ? new Date(row.reportDate).toLocaleDateString("en-GB") : "—"}</td><td className="p-3"><span className={statusBadge(row.status)}>{row.status.replaceAll("_", " ")}</span>{row.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">{row.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</td></tr>)}</tbody></table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-[#7F7F7F]">Warnings remain visible and are imported as Draft / Needs Review. Duplicate submissions are reported and skipped.</div><button type="button" disabled={Boolean(importBusy) || unresolvedImportProjects.length > 0} title={unresolvedImportProjects.length > 0 ? "Link all Jotform projects before importing" : undefined} onClick={applyHistoricalImport} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{importBusy === "import" ? "Importing..." : unresolvedImportProjects.length > 0 ? "Link Projects First" : "Import Draft Records"}</button></div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case, ePCR, patient, project..."
            className="rounded-xl border border-[#86A7B2]/30 bg-[#f8fbfc] px-4 py-2 text-sm font-semibold text-[#274C5A] outline-none placeholder:text-[#7F7F7F] focus:border-[#274C5A]"
          />

          <SubmissionsMultiSelect label="Case Status" allLabel="All Case Statuses" options={caseStatuses}
            value={caseStatusFilter} onChange={setCaseStatusFilter} />
          <SubmissionsMultiSelect label="ePCR Status" allLabel="All ePCR Statuses" options={epcrStatuses}
            value={epcrStatusFilter} onChange={setEpcrStatusFilter} />

          <button
            onClick={() => setExportSelection([...filteredRows])}
            disabled={!filteredRows.length}
            className="rounded-xl bg-[#274C5A] px-4 py-2 text-sm font-black text-white shadow-sm shadow-[#274C5A]/20 transition hover:bg-[#1f3f4c]"
          >
            Export Excel
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 text-xs font-bold">Project
            <div className="mt-1"><SubmissionsMultiSelect label="Project" allLabel="All projects" options={projectOptions}
              value={selectedProject} onChange={setSelectedProject} /></div>
          </div>
          <label className="min-w-0 text-xs font-bold">Case created — from
            <input type="datetime-local" className="mt-1 w-full min-w-0 rounded-lg border p-2 text-sm" value={fromDateTime} onChange={e => setFromDateTime(e.target.value)} />
          </label>
          <label className="min-w-0 text-xs font-bold">Case created — to
            <input type="datetime-local" className="mt-1 w-full min-w-0 rounded-lg border p-2 text-sm" value={toDateTime} onChange={e => setToDateTime(e.target.value)} />
          </label>
          <button className="self-end rounded-lg border p-2 text-sm font-bold" onClick={() => { setSearch(""); setSelectedProject([]); setFromDateTime(""); setToDateTime(""); setCaseStatusFilter([]); setEpcrStatusFilter([]); }}>Reset filters</button>
        </div>
        <p className="mt-2 text-xs">Dates and times use your device timezone. Export includes all matching results, not just this page.</p>
        {fromDateTime && toDateTime && fromDateTime > toDateTime && <p role="alert" className="mt-2 text-sm text-red-700">The end date/time must be after the start.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{filteredRows.length} matching results · Page {currentPage + 1} of {totalPages}</span>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border px-3 py-2" onClick={() => setDetailed(!detailed)}>{detailed ? "Compact view" : "Detailed table"}</button>
          <button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>
      </div>
      {!detailed && <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        {visibleRows.map(({ caseItem, epcr }) => <article key={caseItem.id} className="min-w-0 rounded-xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="font-black">{getCaseDisplayCode(caseItem)} <span className="font-normal">/ {epcr ? getEpcrDisplayCode(epcr) : "No ePCR"}</span></div>
            <div className="flex flex-wrap gap-2"><span className={statusBadge(caseItem.status)}>{caseItem.status || "—"}</span><span className={statusBadge(getEpcrStatus(epcr))}>{getEpcrStatus(epcr)}</span></div>
          </div>
          <p className="mt-3 break-words font-semibold">{getPatientName(caseItem, epcr)}</p>
          <p className="break-words text-sm">{getProjectName(caseItem, epcr)}</p>
          <p className="mt-1 text-sm">Medical review: {epcr ? medicalReviewLabel(epcr) : "—"}</p>
          <p className="mt-1 text-xs text-slate-600">{formatDate(caseItem.createdAt)}</p>
          <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">Clinical and trip details</summary>
            <dl className="mt-2 grid grid-cols-2 gap-2 break-words">
              <dt>Age / Gender</dt><dd>{epcr?.patientInfo?.age || "—"} / {epcr?.patientInfo?.gender || "—"}</dd>
              <dt>Chief complaint</dt><dd>{getChiefComplaint(caseItem, epcr)}</dd>
              <dt>Triage</dt><dd>{getTriage(caseItem, epcr)}</dd>
              <dt>Moving / Arrival PT</dt><dd>{epcr?.time?.movingTime?.timeHHMM || "—"} / {epcr?.time?.arrivalToPTTime?.timeHHMM || "—"}</dd>
              <dt>Destination</dt><dd>{getDestination(caseItem, epcr)}</dd>
            </dl>
          </details>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <Link className="rounded-lg border px-3 py-2" href={`/cadcases/${caseItem.id}`}>View Case</Link>
            <Link className="rounded-lg bg-[#274C5A] px-3 py-2 text-white" href={epcr ? `/epcr/${epcr.id}` : `/epcr/new?caseId=${caseItem.id}`}>{epcr ? "View ePCR" : "Create ePCR"}</Link>
          </div>
        </article>)}
        {!visibleRows.length && <p className="p-4 text-sm">No submissions found.</p>}
      </div>}
      {detailed && <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#86A7B2]/25 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1720px] text-left text-sm">
            <thead className="border-b border-[#86A7B2]/25 bg-[#f8fbfc] text-xs uppercase text-[#7F7F7F]">
              <tr>
                <th className="px-4 py-3">Case Ref</th>
                <th className="px-4 py-3">ePCR Ref</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Chief Complaint</th>
                <th className="px-4 py-3">Triage / Level</th>
                <th className="px-4 py-3">Case Status</th>
                <th className="px-4 py-3">ePCR Status</th>
                <th className="px-4 py-3">Medical Review</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Times</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#86A7B2]/20">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-[#7F7F7F]">
                    No submissions found.
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ caseItem, epcr }) => (
                  <tr key={caseItem.id} className="hover:bg-[#f8fbfc]">
                    <td className="whitespace-nowrap px-4 py-4 text-[#274C5A]">
                      <div className="font-black">
                        {getCaseDisplayCode(caseItem)}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {epcr ? (
                        <div className="font-black text-[#166575]">
                          {getEpcrDisplayCode(epcr)}
                        </div>
                      ) : (
                        <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-xs font-black text-rose-700">
                          Not Created
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[#274C5A]">
                      {getProjectName(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[#274C5A]">
                      {getPatientName(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[#274C5A]">
                      {epcr?.patientInfo?.age || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[#274C5A]">
                      {epcr?.patientInfo?.gender || "-"}
                    </td>

                    <td className="min-w-[260px] px-4 py-4 text-[#274C5A]">
                      {getChiefComplaint(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[#274C5A]">
                      {getTriage(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={statusBadge(caseItem.status)}>
                        {caseItem.status || "-"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={statusBadge(getEpcrStatus(epcr))}>
                        {getEpcrStatus(epcr)}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm">{epcr ? medicalReviewLabel(epcr) : "—"}</td>

                    <td className="whitespace-nowrap px-4 py-4 text-[#274C5A]">
                      {formatDate(caseItem.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[#274C5A]">
                      <div className="space-y-1 text-xs">
                        <div>
                          Moving:{" "}
                          <span className="font-bold text-[#274C5A]">
                            {epcr?.time?.movingTime?.timeHHMM || "-"}
                          </span>
                        </div>
                        <div>
                          Arrival PT:{" "}
                          <span className="font-bold text-[#274C5A]">
                            {epcr?.time?.arrivalToPTTime?.timeHHMM || "-"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="min-w-[220px] px-4 py-4 text-[#274C5A]">
                      {getDestination(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/cadcases/${caseItem.id}`}
                          className="rounded-lg border border-[#86A7B2]/30 px-3 py-1.5 text-xs font-bold text-[#274C5A] transition hover:bg-[#f8fbfc]"
                        >
                          View Case
                        </Link>

                        {epcr ? (
                          <Link
                            href={`/epcr/${epcr.id}`}
                            className="rounded-lg bg-[#274C5A] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1f3f4c]"
                          >
                            View ePCR
                          </Link>
                        ) : (
                          <Link
                            href={`/epcr/new?caseId=${caseItem.id}`}
                            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                          >
                            Create ePCR
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  ); 
}
