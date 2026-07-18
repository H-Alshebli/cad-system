// /components/CaseEpcrSubmissionsTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { getCaseDisplayCode, shortTechnicalId } from "@/lib/displayLabels";

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
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

  if (value.toLowerCase().includes("closed")) {
    return `${base} bg-green-500/10 text-green-300 border border-green-500/20`;
  }

  if (value.toLowerCase().includes("draft")) {
    return `${base} bg-yellow-500/10 text-yellow-300 border border-yellow-500/20`;
  }

  if (value.toLowerCase().includes("final")) {
    return `${base} bg-blue-500/10 text-blue-300 border border-blue-500/20`;
  }

  if (value.toLowerCase().includes("not created")) {
    return `${base} bg-red-500/10 text-red-300 border border-red-500/20`;
  }

  return `${base} bg-gray-500/10 text-gray-300 border border-gray-500/20`;
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
      "ePCR Ref": epcr ? shortTechnicalId(epcr.epcrId || epcr.id, "EPCR") : "Not Created",
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
  const [cases, setCases] = useState<CaseDoc[]>([]);
  const [epcrs, setEpcrs] = useState<EpcrDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("all");
  const [epcrStatusFilter, setEpcrStatusFilter] = useState("all");

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
        epcr?.epcrId,
        epcr?.id,
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
      <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-6 text-gray-300">
        Loading submissions...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
          <p className="text-sm text-gray-400">Total Cases</p>
          <p className="mt-2 text-2xl font-bold text-white">{totalCases}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
          <p className="text-sm text-gray-400">With ePCR</p>
          <p className="mt-2 text-2xl font-bold text-white">{totalWithEpcr}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
          <p className="text-sm text-gray-400">Without ePCR</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {totalWithoutEpcr}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
          <p className="text-sm text-gray-400">Closed Cases</p>
          <p className="mt-2 text-2xl font-bold text-white">{totalClosed}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case, ePCR, patient, project..."
            className="rounded-xl border border-white/10 bg-[#111827] px-4 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500"
          />

          <select
            value={caseStatusFilter}
            onChange={(e) => setCaseStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#111827] px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
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
            className="rounded-xl border border-white/10 bg-[#111827] px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
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
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Export Full CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1220]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-gray-400">
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

            <tbody className="divide-y divide-white/10">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                    No submissions found.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ caseItem, epcr }) => (
                  <tr key={caseItem.id} className="hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-4 py-4 text-white">
                      <div className="font-medium">
                        {getCaseDisplayCode(caseItem)}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {epcr ? (
                        <>
                          <div className="font-medium text-blue-300">
                            {shortTechnicalId(epcr.epcrId || epcr.id, "EPCR")}
                          </div>
                        </>
                      ) : (
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-300">
                          Not Created
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-300">
                      {getProjectName(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-300">
                      {getPatientName(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-300">
                      {epcr?.patientInfo?.age || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-300">
                      {epcr?.patientInfo?.gender || "-"}
                    </td>

                    <td className="min-w-[220px] px-4 py-4 text-gray-300">
                      {getChiefComplaint(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-300">
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

                    <td className="whitespace-nowrap px-4 py-4 text-gray-300">
                      {formatDate(caseItem.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-300">
                      <div className="space-y-1 text-xs">
                        <div>
                          Moving:{" "}
                          <span className="text-white">
                            {epcr?.time?.movingTime?.timeHHMM || "-"}
                          </span>
                        </div>
                        <div>
                          Arrival PT:{" "}
                          <span className="text-white">
                            {epcr?.time?.arrivalToPTTime?.timeHHMM || "-"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="min-w-[180px] px-4 py-4 text-gray-300">
                      {getDestination(caseItem, epcr)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/cases/${caseItem.id}`}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                        >
                          View Case
                        </Link>

                        {epcr ? (
                          <Link
                            href={`/epcr/${epcr.id}`}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
                          >
                            View ePCR
                          </Link>
                        ) : (
                          <Link
                            href={`/epcr/new?caseId=${caseItem.id}`}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-500"
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
