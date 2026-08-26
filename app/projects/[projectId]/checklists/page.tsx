"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { calculateReadiness, canViewChecklist } from "@/lib/readinessChecklist";
import { hasPermission } from "@/lib/usePermissions";
import { getChecklistMissionDisplay, getUnitDisplayName } from "@/lib/displayLabels";
import { useChecklistReviewScope } from "@/app/components/ChecklistReviewScope";

function formatDateTime(value: any) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", { timeZone: "Asia/Riyadh" });
}

function resultClass(result: string) {
  if (result === "Ready") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  if (result === "Ready with Warnings") return "border-amber-500/25 bg-amber-500/10 text-amber-700";
  return "border-red-500/25 bg-red-500/10 text-red-700";
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function riyadhDateKey(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function checklistDateKey(item: any) {
  const storedDate = String(item?.dateKey || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(storedDate)) return storedDate;

  const date = item?.createdAt?.toDate?.() || (item?.createdAt ? new Date(item.createdAt) : null);
  return date && !Number.isNaN(date.getTime()) ? riyadhDateKey(date) : "";
}

export default function ProjectChecklistsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { allProjects } = useChecklistReviewScope();
  const { user, loading: userLoading } = useCurrentUser();
  const { permissions, loading: permLoading, can } = usePermissions(user?.role);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [startDate, setStartDate] = useState(() => riyadhDateKey());
  const [endDate, setEndDate] = useState(() => riyadhDateKey());

  useEffect(() => {
    const q = allProjects
      ? query(collection(db, "projectChecklists"))
      : query(
          collection(db, "projectChecklists"),
          where("projectId", "==", params.projectId)
        );

    const unsub = onSnapshot(q, (snap) => {
      const rows: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => {
        const ad = a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bd = b.createdAt?.toDate?.()?.getTime?.() || 0;
        return bd - ad;
      });
      setChecklists(rows);
      setLoading(false);
    });

    return () => unsub();
  }, [allProjects, params.projectId]);

  const visibleChecklists = useMemo(() => {
    return checklists.filter((item) => canViewChecklist(item, permissions, user));
  }, [checklists, permissions, user]);

  const projectOptions = useMemo(() => {
    const values = new Map<string, string>();
    visibleChecklists.forEach((item) => {
      const id = String(item.projectId || "").trim();
      if (!id) return;
      values.set(id, String(item.projectName || id));
    });
    return Array.from(values.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [visibleChecklists]);

  const filteredChecklists = useMemo(() => {
    return visibleChecklists.filter((item) => {
      if (projectFilter && item.projectId !== projectFilter) return false;
      if (statusFilter && String(item.status || "draft") !== statusFilter) return false;
      if (phaseFilter && String(item.checklistPhase || "opening") !== phaseFilter) return false;

      const itemDate = checklistDateKey(item);
      if (startDate && (!itemDate || itemDate < startDate)) return false;
      if (endDate && (!itemDate || itemDate > endDate)) return false;
      return true;
    });
  }, [visibleChecklists, projectFilter, statusFilter, phaseFilter, startDate, endDate]);

  const readinessRows = useMemo(
    () =>
      filteredChecklists.map((item) => ({
        item,
        readiness: calculateReadiness(item.items || []),
      })),
    [filteredChecklists]
  );
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isFieldUser =
    normalizedRole.includes("paramedic") ||
    normalizedRole.includes("emt") ||
    normalizedRole.includes("medic") ||
    normalizedRole.includes("ambulance");
  const canViewTiming =
    !isFieldUser &&
    (hasPermission(permissions, "readiness_checklists", "view_all", user?.role) ||
      hasPermission(permissions, "readiness_checklists", "review", user?.role) ||
      hasPermission(permissions, "readiness_checklists", "approve", user?.role));
  const cardClass = "rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5";
  const metricLabelClass = "text-sm font-semibold text-[#7F7F7F]";
  const badgeClass =
    "inline-flex rounded-full border border-[#86A7B2]/30 bg-[#f8fbfc] px-2.5 py-1 text-xs font-black uppercase tracking-wide text-[#274C5A]";
  const actionButtonClass =
    "inline-flex items-center justify-center rounded-xl border border-[#86A7B2]/35 bg-white px-4 py-2.5 text-sm font-bold text-[#274C5A] transition hover:border-[#274C5A]/40 hover:bg-[#f8fbfc]";

  if (loading || userLoading || permLoading) {
    return <div className={cardClass}>Loading readiness checklists...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#274C5A] p-5 text-white shadow-sm shadow-[#274C5A]/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide">
            HCAD Readiness
          </div>
          <h2 className="text-xl font-black text-white">
            {allProjects ? "Checklist Review" : "Readiness Review Dashboard"}
          </h2>
          <p className="mt-1 text-sm font-medium text-white/78">
            {allProjects
              ? "EMS readiness checks across all projects by project, unit, shift, mission, and inspector."
              : "EMS readiness checks for this project by unit, shift, mission, and inspector."}
          </p>
        </div>

      </div>
      </div>

      <div className={`${cardClass} grid grid-cols-1 gap-3 md:grid-cols-2 ${allProjects ? "xl:grid-cols-7" : "xl:grid-cols-6"}`}>
          {allProjects && (
            <select className="input" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">All projects</option>
              {projectOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="returned_for_correction">Returned for correction</option>
          </select>
          <select className="input" value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
            <option value="">All phases</option>
            <option value="opening">Opening</option>
            <option value="closing">Closing</option>
          </select>
          <input className="input" type="date" aria-label="Start date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <input className="input" type="date" aria-label="End date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              const today = riyadhDateKey();
              setStartDate(today);
              setEndDate(today);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Show All Dates
          </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className={cardClass}>
          <div className={metricLabelClass}>Total</div>
          <div className="mt-1 text-2xl font-black text-[#274C5A]">
            {readinessRows.length}
          </div>
        </div>
        <div className={cardClass}>
          <div className={metricLabelClass}>Ready</div>
          <div className="mt-1 text-2xl font-black text-emerald-700">
            {readinessRows.filter(({ readiness }) => readiness.result === "Ready").length}
          </div>
        </div>
        <div className={cardClass}>
          <div className={metricLabelClass}>Warnings</div>
          <div className="mt-1 text-2xl font-black text-amber-700">
            {
              readinessRows.filter(({ readiness }) => readiness.result === "Ready with Warnings")
                .length
            }
          </div>
        </div>
        <div className={cardClass}>
          <div className={metricLabelClass}>Vehicle Blocked</div>
          <div className="mt-1 text-2xl font-black text-red-700">
            {readinessRows.filter(({ readiness }) => readiness.vehicleRedIssues.length > 0).length}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#86A7B2]/25 bg-white shadow-sm shadow-[#274C5A]/5">
          <table className="w-full min-w-[1180px] text-left">
          <thead className="border-b border-[#86A7B2]/25 bg-[#f8fbfc] text-xs uppercase tracking-wide text-[#7F7F7F]">
            <tr>
              <th className="px-4 py-3">Date / Shift</th>
              {allProjects && <th className="px-4 py-3">Project</th>}
              <th className="px-4 py-3">Mission</th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Inspector</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Issues</th>
              <th className="px-4 py-3">Status</th>
              {canViewTiming && <th className="px-4 py-3">Duration</th>}
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#86A7B2]/18">
            {readinessRows.map(({ item, readiness }) => {
              return (
                <tr key={item.id} className="transition hover:bg-[#f8fbfc]">
                  <td className="px-4 py-3 text-[#274C5A]">
                    <div className="font-bold text-[#274C5A]">{item.dateKey}</div>
                    <div className="text-xs text-[#7F7F7F]">{item.shiftKey}</div>
                  </td>
                  {allProjects && (
                    <td className="px-4 py-3 text-[#274C5A]">
                      <div className="font-bold">{item.projectName || item.projectId || "-"}</div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-[#274C5A]">
                    {getChecklistMissionDisplay(item)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={badgeClass}>
                      {(item.checklistPhase || "opening") === "closing" ? "Closing" : "Opening"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#274C5A]">
                    {getUnitDisplayName({ unitCode: item.unitCode, unitId: item.unitId }) || "-"}
                  </td>
                  <td className="px-4 py-3 text-[#274C5A]">
                    {item.inspectorName || item.inspectorUserId || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${resultClass(readiness.result)}`}>
                      {readiness.result} / {readiness.readinessScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#274C5A]">
                    {readiness.vehicleRedIssues.length} vehicle red,{" "}
                    {readiness.vehicleYellowIssues.length} vehicle yellow,{" "}
                    {readiness.shortageIssues.length} shortages,{" "}
                    {readiness.criticalIssues.length} V items
                  </td>
                  <td className="px-4 py-3">
                    <span className={badgeClass}>{item.status || "draft"}</span>
                    <div className="mt-1 text-xs text-[#7F7F7F]">
                      {formatDateTime(item.updatedAt)}
                    </div>
                  </td>
                  {canViewTiming && (
                    <td className="px-4 py-3 text-[#274C5A]">
                      {formatDuration(item.durationSeconds)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link
                      className={actionButtonClass}
                      href={`/projects/${item.projectId || params.projectId}/checklists/${item.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}

            {readinessRows.length === 0 && (
              <tr>
                <td colSpan={(canViewTiming ? 10 : 9) + (allProjects ? 1 : 0)} className="px-4 py-10 text-center text-sm font-semibold text-[#7F7F7F]">
                  {allProjects
                    ? "No readiness checklists match the selected filters."
                    : "No readiness checklists found for this project."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
