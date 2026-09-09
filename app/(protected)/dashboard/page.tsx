"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import CaseTimeline from "@/app/components/CaseTimeline";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";
import Link from "next/link";
import {
  getCaseDisplayCode,
  getUnitDisplayName,
} from "@/lib/displayLabels";

export default function Dashboard() {
  const { user, loading } = useCurrentUser();
  const [showAllCases, setShowAllCases] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setPending(true);
    setError("");
    async function load() {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Please sign in again.");
        const params = new URLSearchParams({ project: selectedProject, start: startDate, end: endDate, all: String(showAllCases), offset: String(offset) });
        const response = await fetch(`/api/dashboards/timeline?${params}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load dashboard.");
        if (!stopped) { setResult(payload); setError(""); }
      } catch (error) {
        if (!stopped) { setResult(null); setError(error instanceof Error ? error.message : "Could not load dashboard."); }
      } finally {
        if (!stopped) {
          setPending(false);
          timer = setTimeout(() => { if (document.visibilityState === "visible") void load(); else timer = setTimeout(load, 30000); }, 30000);
        }
      }
    }
    void load();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [user?.uid, user?.role, loading, selectedProject, startDate, endDate, showAllCases, offset, refresh]);

  const visibleCases = pending ? [] : result?.cards || [];
  const projectOptions: string[] = result?.projects || [];
  const stats = result?.stats || {};
  const value = (key: string) => pending || !result ? "…" : stats[key];
  const totalCases = value("totalCases"), activeCases = value("activeCases"), closedCases = value("closedCases");
  const onSceneCases = value("onSceneCases"), enRouteCases = value("enRouteCases"), unreceivedCases = value("unreceivedCases");
  const transportingCases = value("transportingCases"), returningCases = value("returningCases");
  const closedHospitalCases = value("closedHospitalCases"), closedClinicCases = value("closedClinicCases");
  const transportingHospitalCases = value("transportingHospitalCases"), transportingClinicCases = value("transportingClinicCases");
  const totalAmbulances = value("totalAmbulances");
  function getMatchedProjectName(item: any) { return item.projectName || "—"; }
  function getMatchedEpcrId(item: any) { return item.epcrNumber || ""; }
  function formatCaseDate(item: any) {
    return item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
  }

  function clearFilters() {
    setOffset(0);
    setSelectedProject("");
    setStartDate("");
    setEndDate("");
  }

  if (loading || !user || user.role === "none") {
    return (
      <div className="page-shell"><div className="card-modern">Loading dashboard…</div></div>
    );
  }

return (
  <PermissionGuard module="dashboards" action="timeline" showMessage={true}>
    <div className="page-shell">
      <div className="overflow-hidden rounded-2xl border border-[#86A7B2]/25 bg-white shadow-xl shadow-[#274C5A]/10">
        <div className="flex min-h-[74px] flex-col gap-4 border-b border-[#86A7B2]/20 bg-gradient-to-r from-[#274C5A] to-[#315f70] px-5 py-4 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Timeline Dashboard</h1>
            <p className="mt-1 max-w-3xl text-xs font-medium text-[#d7e4e8]">Live operational dashboard. Click any case card to open the unified case page directly.</p>
          </div>
          <Link className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#274C5A] shadow-sm transition hover:bg-[#eef5f7]" href="/call-intake">New Case / Call Intake</Link>
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
              onChange={(e) => { setSelectedProject(e.target.value); setOffset(0); }}
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
              onChange={(e) => { setStartDate(e.target.value); setOffset(0); }}
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
              onChange={(e) => { setEndDate(e.target.value); setOffset(0); }}
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
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
      <div role="status" className="text-sm text-[#607482]">{pending ? "Loading dashboard…" : "Refreshes every 30 seconds."} <button className="underline" onClick={() => setRefresh(value => value + 1)}>Refresh now</button></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#274C5A]/20 bg-[#274C5A] p-5 text-white shadow-lg shadow-[#274C5A]/15">
          <h3 className="text-lg font-black">Total Cases</h3>
          <p className="mt-2 text-4xl font-extrabold">{totalCases}</p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <h3 className="text-sm font-bold text-[#7F7F7F]">Active</h3>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{activeCases}</p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <h3 className="text-sm font-bold text-[#7F7F7F]">Unreceived from team</h3>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{unreceivedCases}</p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <h3 className="text-sm font-bold text-[#7F7F7F]">EnRoute</h3>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{enRouteCases}</p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <h3 className="text-sm font-bold text-[#7F7F7F]">OnScene</h3>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{onSceneCases}</p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <h3 className="text-sm font-bold text-[#7F7F7F]">Transporting</h3>
          <p className="mt-2 text-2xl font-black text-[#ef7b00]">
            {transportingCases}
          </p>
          <p className="mt-1 text-sm font-medium text-[#7F7F7F]">
            Hospital: {transportingHospitalCases} - Clinic: {transportingClinicCases}
          </p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <h3 className="text-sm font-bold text-[#7F7F7F]">Returning</h3>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{returningCases}</p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <h3 className="text-sm font-bold text-[#7F7F7F]">Treated</h3>
          <p className="mt-2 text-2xl font-black text-[#274C5A]">{closedCases}</p>
          <p className="mt-1 text-sm font-medium text-[#7F7F7F]">
            Hospital: {closedHospitalCases} - Clinic: {closedClinicCases}
          </p>
        </div>

        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
          <h3 className="text-sm font-bold text-[#7F7F7F]">Ambulances</h3>
          <p className="mt-2 text-2xl font-black text-[#86A7B2]">
            {totalAmbulances}
          </p>
        </div>
      </div>

      {/* TIMELINE HEADER */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap rounded-2xl border border-[#86A7B2]/20 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
        <div>
          <h2 className="text-xl font-black text-[#274C5A]">Cases Timeline</h2>
          <p className="text-sm font-medium text-[#7F7F7F]">
            Showing {visibleCases.length} of {pending ? "…" : result?.totalVisible ?? "…"} cases
            {!showAllCases ? " (closed cases hidden)" : " (all cases)"}
          </p>
        </div>

        <button
          onClick={() => { setShowAllCases((prev) => !prev); setOffset(0); }}
          className="btn-secondary"
        >
          {showAllCases ? "Hide Closed Cases" : "Show All Cases"}
        </button>
      </div>

      {/* TIMELINE CARDS */}
      <div className="flex items-center justify-end gap-3">
        <button className="btn-secondary" disabled={pending || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Previous</button>
        <span>Page {Math.floor(offset / 50) + 1}</span>
        <button className="btn-secondary" disabled={pending || !result?.hasMore} onClick={() => setOffset(value => value + 50)}>Next</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleCases.map((c: any) => (
          <Link
            href={`/cadcases/${c.id}`}
            key={c.id}
            className="block rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5 transition hover:border-[#274C5A]/50 hover:shadow-lg hover:shadow-[#274C5A]/10"
          >
            <div className="mb-3">
              <h2 className="text-xl font-black text-[#274C5A]">
                {getCaseDisplayCode(c)} — {getMatchedProjectName(c)}
              </h2>

              <p className="mt-1 text-sm font-bold text-[#274C5A]">
                {c.chiefComplaint || c.caseInfo?.complaint || "No complaint recorded"}
                {" • "}
                {getUnitDisplayName(c.assignedUnit) || "Unit not assigned"}
                {getMatchedEpcrId(c) ? ` • ${getMatchedEpcrId(c)}` : ""}
              </p>

              <p className="text-sm font-medium text-[#7F7F7F]">
                Date & Time: {formatCaseDate(c)}
              </p>
            </div>

            <CaseTimeline timeline={c.timeline || {}} />
          </Link>
        ))}
      </div>
      </div>
    </PermissionGuard>
  );
}
