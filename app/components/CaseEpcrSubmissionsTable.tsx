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

function cleanExportValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (value instanceof Timestamp) {
    return formatDate(value);
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value === "string") {
    if (value.startsWith("data:image")) {
      return "Signature/Image Saved";
    }

    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          return Object.entries(item as Record<string, unknown>)
            .map(([key, val]) => `${key}: ${cleanExportValue(val)}`)
            .join(" | ");
        }

        return cleanExportValue(item);
      })
      .join(" ; ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${cleanExportValue(val)}`)
      .join(" | ");
  }

  return String(value);
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  result: Record<string, string> = {}
) {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Timestamp) &&
      !(value instanceof Date)
    ) {
      flattenObject(value as Record<string, unknown>, newKey, result);
    } else {
      result[newKey] = cleanExportValue(value);
    }
  });

  return result;
}

function exportToCsv(rows: Row[]) {
  const exportRows = rows.map(({ caseItem, epcr }) => {
    const caseFlat = flattenObject(caseItem as Record<string, unknown>, "case");
    const epcrFlat = epcr
      ? flattenObject(epcr as Record<string, unknown>, "epcr")
      : {};

    return {
      "Case Ref": getCaseDisplayCode(caseItem),
      "ePCR Ref": epcr ? getEpcrDisplayCode(epcr) : "Not Created",
      Project: getProjectName(caseItem, epcr),
      Patient: getPatientName(caseItem, epcr),
      Age: cleanExportValue(epcr?.patientInfo?.age),
      Gender: epcr?.patientInfo?.gender || "",
      Phone: epcr?.patientInfo?.phone || caseItem.patient?.phone || caseItem.contactNumber || "",
      "Chief Complaint": getChiefComplaint(caseItem, epcr),
      "Signs And Symptoms": epcr?.patientInfo?.signsAndSymptoms?.join(", ") || "",
      "Triage / Level": getTriage(caseItem, epcr),
      "Health Classification": epcr?.patientInfo?.healthClassification || "",
      "Case Status": caseItem.status || "",
      "ePCR Status": epcr?.status || "Not Created",
      "Case Created At": formatDate(caseItem.createdAt),
      "ePCR Created At": formatDate(epcr?.createdAt),
      "ePCR Finalized At": formatDate(epcr?.finalizedAt),
      "Moving Time": epcr?.time?.movingTime?.timeHHMM || "",
      "Arrival Time": epcr?.time?.arrivalTime?.timeHHMM || "",
      "Arrival To Patient Time": epcr?.time?.arrivalToPTTime?.timeHHMM || "",
      "Leaving Scene Time": epcr?.time?.leavingSceneTime?.timeHHMM || "",
      "Hospital Time": epcr?.time?.hospitalTime?.timeHHMM || "",
      "Discharge Time": epcr?.time?.dischargeTime?.timeHHMM || "",
      "Back Time": epcr?.time?.backTime?.timeHHMM || "",
      Destination: getDestination(caseItem, epcr),
      "Created By": epcr?.createdBy || "",
      Locked: cleanExportValue(epcr?.locked),

      ...caseFlat,
      ...epcrFlat,
    };
  });

  const headers = Array.from(
    new Set(exportRows.flatMap((row) => Object.keys(row)))
  );

  const csvContent = [
    headers,
    ...exportRows.map((row) =>
      headers.map((header) => {
        const value = row[header as keyof typeof row];
        return value === undefined || value === null ? "" : String(value);
      })
    ),
  ]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `hcad-full-case-epcr-export-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
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

  const [search, setSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("all");
  const [epcrStatusFilter, setEpcrStatusFilter] = useState("all");
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

  async function historicalImportRequest(action: "preview" | "import", rows: Record<string, unknown>[], fileName = importFileName, projectMappings = importProjectMappings) {
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
      },
      (error) => {
        console.error("Failed to load ePCR records:", error);
      }
    );

    return () => {
      unsubCases();
      unsubEpcr();
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    return cases
      .filter((caseItem) => {
        if (!projectId) return true;

        const linkedEpcr = epcrs.find((epcr) => epcr.caseId === caseItem.id);

        return (
          caseItem.projectId === projectId ||
          linkedEpcr?.projectId === projectId ||
          linkedEpcr?.projectInfo?.projectId === projectId
        );
      })
      .map((caseItem) => {
        const linkedEpcr = epcrs.find((epcr) => epcr.caseId === caseItem.id);

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
        epcr?.status,
        getTriage(caseItem, epcr),
        getDestination(caseItem, epcr),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchableText.includes(keyword);

      const matchesCaseStatus =
        caseStatusFilter === "all" ||
        caseItem.status?.toLowerCase() === caseStatusFilter.toLowerCase();

      const epcrStatus = epcr?.status || "Not Created";

      const matchesEpcrStatus =
        epcrStatusFilter === "all" ||
        epcrStatus.toLowerCase() === epcrStatusFilter.toLowerCase();

      return matchesSearch && matchesCaseStatus && matchesEpcrStatus;
    });
  }, [rows, search, caseStatusFilter, epcrStatusFilter]);

  const totalCases = rows.length;
  const totalWithEpcr = rows.filter((row) => row.epcr).length;
  const totalWithoutEpcr = rows.filter((row) => !row.epcr).length;
  const totalClosed = rows.filter(
    (row) => row.caseItem.status?.toLowerCase() === "closed"
  ).length;

  const caseStatuses = Array.from(
    new Set(rows.map((row) => row.caseItem.status).filter(Boolean))
  ) as string[];

  const epcrStatuses = Array.from(
    new Set(
      rows.map((row) => row.epcr?.status || "Not Created").filter(Boolean)
    )
  ) as string[];

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-6 text-[#274C5A] shadow-sm">
        Loading submissions...
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-4">
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
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_220px_220px_180px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case, ePCR, patient, project..."
            className="rounded-xl border border-[#86A7B2]/30 bg-[#f8fbfc] px-4 py-2 text-sm font-semibold text-[#274C5A] outline-none placeholder:text-[#7F7F7F] focus:border-[#274C5A]"
          />

          <select
            value={caseStatusFilter}
            onChange={(e) => setCaseStatusFilter(e.target.value)}
            className="rounded-xl border border-[#86A7B2]/30 bg-[#f8fbfc] px-4 py-2 text-sm font-semibold text-[#274C5A] outline-none focus:border-[#274C5A]"
          >
            <option value="all">All Case Statuses</option>
            {caseStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={epcrStatusFilter}
            onChange={(e) => setEpcrStatusFilter(e.target.value)}
            className="rounded-xl border border-[#86A7B2]/30 bg-[#f8fbfc] px-4 py-2 text-sm font-semibold text-[#274C5A] outline-none focus:border-[#274C5A]"
          >
            <option value="all">All ePCR Statuses</option>
            {epcrStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            onClick={() => exportToCsv(filteredRows)}
            className="rounded-xl bg-[#274C5A] px-4 py-2 text-sm font-black text-white shadow-sm shadow-[#274C5A]/20 transition hover:bg-[#1f3f4c]"
          >
            Export Full CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#86A7B2]/25 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1720px] text-left text-sm">
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
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Times</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#86A7B2]/20">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-[#7F7F7F]">
                    No submissions found.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ caseItem, epcr }) => (
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
                      <span className={statusBadge(epcr?.status || "Not Created")}>
                        {epcr?.status || "Not Created"}
                      </span>
                    </td>

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
      </div>
    </div>
  ); 
}
