"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";
import CaseTimeline from "@/app/components/CaseTimeline";

type Project = {
  id: string;
  projectName?: string;
  client?: string;
};

type CaseItem = {
  id: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  createdAt?: any;
  timeline?: Record<string, any>;
  locationDescription?: string;
  chiefComplaint?: string;
  patientName?: string;
  callerName?: string;
  transportingToType?: string;
};

function getCaseDate(item: any): Date | null {
  const raw =
    item.timeline?.Received ||
    item.timeline?.receivedAt ||
    item.createdAt?.toDate?.() ||
    item.createdAt ||
    item.created_at ||
    item.date ||
    item.caseDate ||
    null;

  const parsed =
    raw instanceof Date
      ? raw
      : raw?.toDate?.()
      ? raw.toDate()
      : raw
      ? new Date(raw)
      : null;

  return parsed && !isNaN(parsed.getTime()) ? parsed : null;
}

function formatCaseDate(item: any): string {
  const dateObj = getCaseDate(item);

  if (!dateObj) return "—";

  return dateObj.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
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
    Closed: "Completed",
  };

  return map[status || ""] || status || "—";
}

function isVisibleRecord(item: any) {
  return item?.isArchived !== true && item?.projectArchived !== true;
}

function normalizeTimelineForClient(timeline: Record<string, any> = {}) {
  return {
    Received: timeline.Received || timeline.receivedAt || null,
    Assigned: timeline.Assigned || timeline.assignedAt || null,
    EnRoute: timeline.EnRoute || timeline.enRouteAt || null,
    OnScene: timeline.OnScene || timeline.onSceneAt || null,
    Transporting: timeline.Transporting || timeline.transportingAt || null,
    Hospital: timeline.Hospital || timeline.hospitalAt || null,
    Closed: timeline.Closed || timeline.closedAt || null,
  };
}

export default function ClientTimelineDashboardPage() {
  const { user, loading: userLoading } = useCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProject, setSelectedProject] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAllCases, setShowAllCases] = useState(false);

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

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

    const unsub = onSnapshot(
      q,
      (snap) => {
        setProjects(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );
        setLoading(false);
      },
      (error) => {
        console.error("Client projects listener error:", error);
        setLoading(false);
      }
    );

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

      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }))
            .filter(isVisibleRecord);

          setCases((prev) => {
            const other = prev.filter((c) => !ids.includes(c.projectId || ""));
            const merged = [...other, ...list];

            return merged.sort((a, b) => {
              const ta = getCaseDate(a)?.getTime() ?? 0;
              const tb = getCaseDate(b)?.getTime() ?? 0;
              return tb - ta;
            });
          });
        },
        (error) => {
          console.error("Client cases listener error:", error);
        }
      );
    });

    return () => unsubs.forEach((unsub) => unsub());
  }, [projectIds.join("|")]);

  const projectOptions = useMemo(() => {
    const set = new Set<string>();

    cases.forEach((c) => {
      const name = c.projectName || "—";
      if (name && name !== "—") set.add(name);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cases]);

  function matchesDateFilter(item: any) {
    const caseDate = getCaseDate(item);

    if (!caseDate) return !startDate && !endDate;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      if (caseDate < start) return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      if (caseDate > end) return false;
    }

    return true;
  }

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesProject =
        !selectedProject || c.projectName === selectedProject;

      const matchesDate = matchesDateFilter(c);

      return matchesProject && matchesDate;
    });
  }, [cases, selectedProject, startDate, endDate]);

  const visibleCases = useMemo(() => {
    if (showAllCases) return filteredCases;
    return filteredCases.filter((c) => c.status !== "Closed");
  }, [filteredCases, showAllCases]);

  const totalCases = filteredCases.length;

  const activeCases = filteredCases.filter(
    (c) => c.status !== "Closed"
  ).length;

  const receivedCases = filteredCases.filter(
    (c) => c.status === "Received"
  ).length;

  const assignedCases = filteredCases.filter(
    (c) => c.status === "Assigned"
  ).length;

  const enRouteCases = filteredCases.filter(
    (c) => c.status === "EnRoute"
  ).length;

  const onSceneCases = filteredCases.filter(
    (c) => c.status === "OnScene"
  ).length;

  const transportingCases = filteredCases.filter((c) =>
    ["Transporting", "Hospital"].includes(c.status || "")
  ).length;

  const completedCases = filteredCases.filter(
    (c) => c.status === "Closed"
  ).length;

  const transportingHospitalCases = filteredCases.filter(
    (c) =>
      ["Transporting", "Hospital"].includes(c.status || "") &&
      c.transportingToType === "hospital"
  ).length;

  const transportingClinicCases = filteredCases.filter(
    (c) =>
      ["Transporting", "Hospital"].includes(c.status || "") &&
      c.transportingToType === "clinic"
  ).length;

  function clearFilters() {
    setSelectedProject("");
    setStartDate("");
    setEndDate("");
  }

  if (userLoading || loading) {
    return (
      <div className="p-6 dark:bg-gray-900 min-h-screen text-white">
        Loading timeline dashboard…
      </div>
    );
  }

  return (
    <PermissionGuard
      module="client_dashboards"
      action="timeline"
      showMessage={true}
    >
      <div className="p-6 dark:bg-gray-900 min-h-screen">
        <h1 className="text-3xl font-bold mb-6 dark:text-white">
          Timeline Dashboard
        </h1>

        {/* FILTERS */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3">
            <h2 className="text-lg font-bold dark:text-white">Filters</h2>
            <p className="text-sm text-gray-400">
              Filter dashboard by project and case date.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-500 dark:text-gray-400">
                Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full rounded border bg-white px-3 py-2 text-sm dark:bg-gray-900 dark:text-white dark:border-gray-700"
              >
                <option value="">All Projects</option>
                {projectOptions.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-500 dark:text-gray-400">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded border bg-white px-3 py-2 text-sm dark:bg-gray-900 dark:text-white dark:border-gray-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-500 dark:text-gray-400">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded border bg-white px-3 py-2 text-sm dark:bg-gray-900 dark:text-white dark:border-gray-700"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full rounded border px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white dark:border-gray-700 hover:opacity-90 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <KpiCard title="Total Cases" value={totalCases} />
          <KpiCard title="Active" value={activeCases} valueClass="text-blue-600" />
          <KpiCard
            title="Request Received"
            value={receivedCases}
            valueClass="text-blue-600"
          />
          <KpiCard
            title="Team Assigned"
            value={assignedCases}
            valueClass="text-blue-600"
          />
          <KpiCard title="EnRoute" value={enRouteCases} valueClass="text-blue-600" />
          <KpiCard title="OnScene" value={onSceneCases} valueClass="text-blue-600" />
          <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
            <h3 className="text-sm text-gray-400">Transporting</h3>
            <p className="text-2xl font-bold text-orange-600">
              {transportingCases}
            </p>
            <p className="text-gray-400">
              Hospital: {transportingHospitalCases} - Clinic:{" "}
              {transportingClinicCases}
            </p>
          </div>
          <KpiCard
            title="Completed"
            value={completedCases}
            valueClass="text-blue-600"
          />
        </div>

        {/* TIMELINE HEADER */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold dark:text-white">
              Cases Timeline
            </h2>
            <p className="text-sm text-gray-400">
              Showing {visibleCases.length} case
              {visibleCases.length !== 1 ? "s" : ""}
              {!showAllCases ? " (closed cases hidden)" : " (all cases)"}
            </p>
          </div>

          <button
            onClick={() => setShowAllCases((prev) => !prev)}
            className="px-4 py-2 rounded border bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700 hover:opacity-90 transition"
          >
            {showAllCases ? "Hide Closed Cases" : "Show All Cases"}
          </button>
        </div>

        {/* TIMELINE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleCases.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-gray-700 p-8 text-center text-sm text-gray-400">
              No cases found.
            </div>
          ) : (
            visibleCases.map((c) => (
              <div
                key={c.id}
                className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
              >
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">
                        {c.projectName || "Project"}
                      </h2>

                      <p className="text-gray-400">
                        Date & Time: {formatCaseDate(c)}
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-300">
                      {clientStatus(c.status)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-gray-400">
                    <p>
                      <span className="text-gray-500">Caller:</span>{" "}
                      {c.callerName || "—"}
                    </p>
                    <p>
                      <span className="text-gray-500">Patient:</span>{" "}
                      {c.patientName || "—"}
                    </p>
                    <p>
                      <span className="text-gray-500">Complaint:</span>{" "}
                      {c.chiefComplaint || "—"}
                    </p>
                  </div>
                </div>

                <CaseTimeline timeline={normalizeTimelineForClient(c.timeline)} />
              </div>
            ))
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}

function KpiCard({
  title,
  value,
  valueClass = "",
}: {
  title: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
      <h3 className="text-sm text-gray-400">{title}</h3>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}