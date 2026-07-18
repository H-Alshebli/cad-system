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

function formatDateTime(value: any) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", { timeZone: "Asia/Riyadh" });
}

function resultClass(result: string) {
  if (result === "Ready") return "bg-emerald-500/10 text-emerald-200";
  if (result === "Ready with Warnings") return "bg-amber-500/10 text-amber-200";
  return "bg-red-500/10 text-red-200";
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function ProjectChecklistsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { user, loading: userLoading } = useCurrentUser();
  const { permissions, loading: permLoading, can } = usePermissions(user?.role);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
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
  }, [params.projectId]);

  const visibleChecklists = useMemo(() => {
    return checklists.filter((item) => canViewChecklist(item, permissions, user));
  }, [checklists, permissions, user]);

  const readinessRows = useMemo(
    () =>
      visibleChecklists.map((item) => ({
        item,
        readiness: calculateReadiness(item.items || []),
      })),
    [visibleChecklists]
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

  if (loading || userLoading || permLoading) {
    return <div className="card-modern">Loading readiness checklists...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Readiness Review Dashboard</h2>
          <p className="mt-1 text-sm text-slate-400">
            EMS readiness checks for this project by unit, shift, mission, and inspector.
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="card-modern">
          <div className="text-sm text-slate-400">Total</div>
          <div className="mt-1 text-2xl font-black text-white">
            {visibleChecklists.length}
          </div>
        </div>
        <div className="card-modern">
          <div className="text-sm text-slate-400">Ready</div>
          <div className="mt-1 text-2xl font-black text-emerald-300">
            {readinessRows.filter(({ readiness }) => readiness.result === "Ready").length}
          </div>
        </div>
        <div className="card-modern">
          <div className="text-sm text-slate-400">Warnings</div>
          <div className="mt-1 text-2xl font-black text-amber-300">
            {
              readinessRows.filter(({ readiness }) => readiness.result === "Ready with Warnings")
                .length
            }
          </div>
        </div>
        <div className="card-modern">
          <div className="text-sm text-slate-400">Vehicle Blocked</div>
          <div className="mt-1 text-2xl font-black text-red-300">
            {readinessRows.filter(({ readiness }) => readiness.vehicleRedIssues.length > 0).length}
          </div>
        </div>
      </div>

      <div className="table-modern overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date / Shift</th>
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

          <tbody className="divide-y divide-white/10">
            {readinessRows.map(({ item, readiness }) => {
              return (
                <tr key={item.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-slate-300">
                    <div className="font-semibold text-white">{item.dateKey}</div>
                    <div className="text-xs text-slate-500">{item.shiftKey}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {getChecklistMissionDisplay(item)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge">
                      {(item.checklistPhase || "opening") === "closing" ? "Closing" : "Opening"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {getUnitDisplayName({ unitCode: item.unitCode, unitId: item.unitId }) || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {item.inspectorName || item.inspectorUserId || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${resultClass(readiness.result)}`}>
                      {readiness.result} / {readiness.readinessScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {readiness.vehicleRedIssues.length} vehicle red,{" "}
                    {readiness.vehicleYellowIssues.length} vehicle yellow,{" "}
                    {readiness.shortageIssues.length} shortages,{" "}
                    {readiness.criticalIssues.length} V items
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge">{item.status || "draft"}</span>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTime(item.updatedAt)}
                    </div>
                  </td>
                  {canViewTiming && (
                    <td className="px-4 py-3 text-slate-300">
                      {formatDuration(item.durationSeconds)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link
                      className="btn-secondary"
                      href={`/projects/${params.projectId}/checklists/${item.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}

            {readinessRows.length === 0 && (
              <tr>
                <td colSpan={canViewTiming ? 10 : 9} className="px-4 py-10 text-center text-slate-400">
                  No readiness checklists found for this project.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
