"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";

import PermissionGuard from "@/app/components/PermissionGuard";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useClientI18n } from "@/lib/clientI18n";
import { FileDown, FileText } from "lucide-react";
import {
  ClientCaseExportLabels,
  exportClientCasesExcel,
  exportClientCasesPdf,
} from "@/lib/clientCaseExports";

type Project = {
  id: string;
  projectName?: string;
  client?: string;
};

type CaseItem = {
  id: string;
  projectId?: string;
  projectName?: string;
  patientName?: string;
  callerName?: string;
  chiefComplaint?: string;
  locationDescription?: string;
  googleMapsLink?: string;
  status?: string;
  createdAt?: any;
  timeline?: Record<string, any>;
  assignedUnit?: any;
};

function formatDate(value: any, locale: string) {
  const date =
    value?.toDate?.() instanceof Date
      ? value.toDate()
      : value
        ? new Date(value)
        : null;

  if (!date || Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clientStatus(status?: string) {
  const map: Record<string, string> = {
    Received: "Request received",
    Assigned: "Team assigned",
    EnRoute: "Team on the way",
    OnScene: "Team arrived",
    Transporting: "Transporting patient",
    Hospital: "Arrived at destination",
    Returning: "Team returning",
    Closed: "Completed",
  };

  return map[status || ""] || status || "-";
}

export default function ClientCasesPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const { t, translateValue, dir, language, locale } = useClientI18n();

  const [projects, setProjects] = useState<Project[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const exportLabels = useMemo<ClientCaseExportLabels>(() => ({
    reportTitle: t("Client Cases Report"),
    generatedAt: t("Generated At"),
    caseNumber: t("Case Number"),
    project: t("Project"),
    dateTime: t("Date & Time"),
    status: t("Status"),
    caller: t("Caller"),
    patient: t("Patient"),
    complaint: t("Complaint"),
    location: t("Location"),
    unit: t("Unit"),
    received: t("Received"),
    assigned: t("Assigned"),
    enRoute: t("EnRoute"),
    onScene: t("OnScene"),
    transporting: t("Transporting"),
    hospital: t("Hospital"),
    returning: t("Returning"),
    closed: t("Closed"),
    timelineDetails: t("Timeline Details"),
  }), [language]);

  useEffect(() => {
    if (userLoading) return;

    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "projects"),
      where("clientUserIds", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setProjects(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid, userLoading]);

  useEffect(() => {
    if (projectIds.length === 0) {
      setCases([]);
      return;
    }

    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += 10) {
      chunks.push(projectIds.slice(i, i + 10));
    }

    const unsubs = chunks.map((ids) => {
      const q = query(collection(db, "cases"), where("projectId", "in", ids));

      return onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setCases((prev) => {
          const other = prev.filter((c) => !ids.includes(c.projectId || ""));
          const merged = [...other, ...list];

          return merged.sort((a, b) => {
            const ta = a.createdAt?.toDate?.()?.getTime?.() || 0;
            const tb = b.createdAt?.toDate?.()?.getTime?.() || 0;
            return tb - ta;
          });
        });
      });
    });

    return () => unsubs.forEach((unsub) => unsub());
  }, [projectIds.join("|")]);

  const filteredCases = useMemo(() => {
    if (statusFilter === "all") return cases;
    if (statusFilter === "active") {
      return cases.filter((c) => c.status !== "Closed");
    }
    if (statusFilter === "closed") {
      return cases.filter((c) => c.status === "Closed");
    }
    return cases.filter((c) => c.status === statusFilter);
  }, [cases, statusFilter]);

  async function exportCases(format: "excel" | "pdf") {
    if (filteredCases.length === 0) {
      alert(t("No cases are available to export."));
      return;
    }
    const options = {
      filename: `HCAD-Client-Cases-${new Date().toISOString().slice(0, 10)}`,
      sheetName: language === "ar" ? "حالاتي" : "My Cases",
      locale,
      labels: exportLabels,
      statusLabel: (status?: string) => translateValue(clientStatus(status)),
    };
    if (format === "excel") await exportClientCasesExcel(filteredCases, options);
    else await exportClientCasesPdf(filteredCases, options);
  }

  if (userLoading || loading) {
    return (
      <div className="p-6">
        <div className="card-modern text-sm font-semibold text-[#274C5A]">
          {t("Loading cases...")}
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard module="client_cases" action="view_own" showMessage={true}>
      <div className="page-shell p-6" dir={dir} lang={language}>
        <div className="page-header">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#74cdda]">
              {t("Client Cases")}
            </p>
            <h1 className="page-title">{t("My Cases")}</h1>
            <p className="page-subtitle mt-1">
              {t("Track your submitted cases and requests.")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => exportCases("excel")} className="btn-secondary inline-flex items-center gap-2">
              <FileDown size={16} /> {t("Export Excel")}
            </button>
            <button onClick={() => exportCases("pdf")} className="btn-secondary inline-flex items-center gap-2">
              <FileText size={16} /> {t("Export PDF")}
            </button>
            <Link href="/client/cases/new" className="btn-primary">
              {t("Create New Case")}
            </Link>
          </div>
        </div>

        <div className="card-modern">
          <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-end">
            <div>
              <label className="field-label">{t("Status")}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select"
              >
                <option value="all">{t("All cases")}</option>
                <option value="active">{t("Active only")}</option>
                <option value="closed">{t("Completed only")}</option>
                <option value="Received">{t("Request received")}</option>
                <option value="Assigned">{t("Team assigned")}</option>
                <option value="EnRoute">{t("Team on the way")}</option>
                <option value="OnScene">{t("Team arrived")}</option>
                <option value="Transporting">{t("Transporting")}</option>
                <option value="Hospital">{t("Arrived at destination")}</option>
                <option value="Returning">{t("Team returning")}</option>
              </select>
            </div>
            <p className="text-sm font-semibold text-[#607482]">
              {language === "ar"
                ? `عرض ${filteredCases.length} من أصل ${cases.length} حالة.`
                : `Showing ${filteredCases.length} of ${cases.length} case${cases.length === 1 ? "" : "s"}.`}
            </p>
          </div>
        </div>

        {filteredCases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#c8dce2] bg-white p-8 text-center text-sm font-semibold text-[#607482] shadow-sm">
            {t("No cases found.")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredCases.map((c) => (
              <div key={c.id} className="card-modern">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-[#123746]">
                      {c.projectName || "Project"}
                    </h2>
                    <p className="text-xs font-semibold text-[#607482]">
                      {formatDate(c.createdAt, locale)}
                    </p>
                  </div>

                  <span className="rounded-full border border-[#274C5A]/20 bg-[#274C5A]/10 px-3 py-1 text-xs font-black text-[#274C5A]">
                    {translateValue(clientStatus(c.status))}
                  </span>
                </div>

                <div className="space-y-2 text-sm font-semibold text-[#274C5A]">
                  <p>
                    <span className="text-[#8aa0aa]">{t("Caller")}:</span>{" "}
                    {c.callerName || "-"}
                  </p>

                  <p>
                    <span className="text-[#8aa0aa]">{t("Patient")}:</span>{" "}
                    {c.patientName || "-"}
                  </p>

                  <p>
                    <span className="text-[#8aa0aa]">{t("Complaint")}:</span>{" "}
                    {c.chiefComplaint || "-"}
                  </p>

                  <p>
                    <span className="text-[#8aa0aa]">{t("Location")}:</span>{" "}
                    {c.locationDescription || "-"}
                  </p>

                  {c.googleMapsLink && (
                    <a
                      href={c.googleMapsLink}
                      target="_blank"
                      className="inline-block text-sm font-bold text-[#274C5A] underline"
                    >
                      {t("Open Location")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
