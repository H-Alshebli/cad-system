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
import { getCaseDisplayCode } from "@/lib/displayLabels";

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
    Returning: "Team returning",
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
    Returning: timeline.Returning || timeline.returningAt || null,
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

  const returningCases = filteredCases.filter(
    (c) => c.status === "Returning"
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
      <div className="page-shell"><div className="card-modern">Loading timeline dashboard…</div></div>
    );
  }

  return (
    <PermissionGuard
      module="client_dashboards"
      action="timeline"
      showMessage={true}
    >
      <div className="page-shell">
        <div className="overflow-hidden rounded-2xl border border-[#86A7B2]/25 bg-white shadow-xl shadow-[#274C5A]/10">
          <div className="flex flex-col gap-5 border-b border-[#86A7B2]/20 bg-gradient-to-r from-[#274C5A] to-[#315f70] p-6 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white">
                Client Operations
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">Timeline Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#d7e4e8]">
                Live operational view of cases across your assigned projects.
              </p>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <div className="mb-3">
            <h2 className="text-lg font-black text-[#274C5A]">Filters</h2>
            <p className="text-sm font-medium text-[#7F7F7F]">
              Filter dashboard by project and case date.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#274C5A]">
                Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="select"
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
              <label className="mb-1 block text-sm font-bold text-[#274C5A]">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="select"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-[#274C5A]">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="select"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#274C5A]/20 bg-[#274C5A] p-5 text-white shadow-lg shadow-[#274C5A]/15">
            <h3 className="text-lg font-black">Total Cases</h3>
            <p className="mt-2 text-4xl font-extrabold">{totalCases}</p>
          </div>
          <KpiCard title="Active" value={activeCases} />
          <KpiCard
            title="Request Received"
            value={receivedCases}
          />
          <KpiCard
            title="Team Assigned"
            value={assignedCases}
          />
          <KpiCard title="EnRoute" value={enRouteCases} />
          <KpiCard title="OnScene" value={onSceneCases} />
          <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
            <h3 className="text-sm font-bold text-[#7F7F7F]">Transporting</h3>
            <p className="mt-2 text-2xl font-black text-[#ef7b00]">
              {transportingCases}
            </p>
            <p className="mt-1 text-sm font-medium text-[#7F7F7F]">
              Hospital: {transportingHospitalCases} - Clinic:{" "}
              {transportingClinicCases}
            </p>
          </div>
          <KpiCard title="Returning" value={returningCases} />
          <KpiCard
            title="Completed"
            value={completedCases}
          />
        </div>

        {/* TIMELINE HEADER */}
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-[#86A7B2]/20 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <div>
            <h2 className="text-xl font-black text-[#274C5A]">
              Cases Timeline
            </h2>
            <p className="text-sm font-medium text-[#7F7F7F]">
              Showing {visibleCases.length} case
              {visibleCases.length !== 1 ? "s" : ""}
              {!showAllCases ? " (closed cases hidden)" : " (all cases)"}
            </p>
          </div>

          <button
            onClick={() => setShowAllCases((prev) => !prev)}
            className="btn-secondary"
          >
            {showAllCases ? "Hide Closed Cases" : "Show All Cases"}
          </button>
        </div>

        {/* TIMELINE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleCases.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[#86A7B2] bg-white p-8 text-center text-sm font-medium text-[#7F7F7F]">
              No cases found.
            </div>
          ) : (
            visibleCases.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5"
              >
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-[#274C5A]">
                        {getCaseDisplayCode(c)} — {c.projectName || "Project"}
                      </h2>

                      <p className="mt-1 text-sm font-medium text-[#7F7F7F]">
                        Date & Time: {formatCaseDate(c)}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#e9f2ff] px-3 py-1 text-xs font-bold text-[#5076a5]">
                      {clientStatus(c.status)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm font-medium text-[#7F7F7F]">
                    <p>
                      <span className="font-bold text-[#274C5A]">Caller:</span>{" "}
                      {c.callerName || "—"}
                    </p>
                    <p>
                      <span className="font-bold text-[#274C5A]">Patient:</span>{" "}
                      {c.patientName || "—"}
                    </p>
                    <p>
                      <span className="font-bold text-[#274C5A]">Complaint:</span>{" "}
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
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
      <h3 className="text-sm font-bold text-[#7F7F7F]">{title}</h3>
      <p className="mt-2 text-2xl font-black text-[#274C5A]">{value}</p>
    </div>
  );
}
