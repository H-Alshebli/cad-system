"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import CaseTimeline from "@/app/components/CaseTimeline";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";
import Link from "next/link";

export default function Dashboard() {
  const { user, loading } = useCurrentUser();
  console.log("CURRENT USER (Sidebar):", user);

  const [cases, setCases] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [epcrs, setEpcrs] = useState<any[]>([]);
  const [showAllCases, setShowAllCases] = useState(false);

  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  function getCaseDate(item: any): Date | null {
    const raw =
      item.timeline?.Received ||
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

  function getMatchedEpcr(caseItem: any) {
    return epcrs.find((e) => e.caseId === caseItem.id) || null;
  }

  function getMatchedEpcrId(caseItem: any): string {
    const matched = getMatchedEpcr(caseItem);
    return matched?.id || "—";
  }

  function getMatchedProjectName(caseItem: any): string {
    const matched = getMatchedEpcr(caseItem);

    return (
      matched?.projectInfo?.projectName ||
      matched?.projectName ||
      caseItem?.projectName ||
      caseItem?.projectInfo?.projectName ||
      "—"
    );
  }

  function isVisibleRecord(item: any) {
    return item?.isArchived !== true && item?.projectArchived !== true;
  }

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

  useEffect(() => {
    if (loading) return;
    if (!user || user.role === "none") return;

    console.log("Starting dashboard listeners for role:", user.role);

    const unsubCases = onSnapshot(
      collection(db, "cases"),
      (snap) => {
        const list: any[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter(isVisibleRecord);

        list.sort((a, b) => {
          const ta = getCaseDate(a)?.getTime() ?? 0;
          const tb = getCaseDate(b)?.getTime() ?? 0;
          return tb - ta;
        });

        setCases(list);
      },
      (error) => {
        console.error("Cases listener error:", error);
      }
    );

    const unsubAmb = onSnapshot(
      collection(db, "ambulances"),
      (snap) => {
        const list: any[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setAmbulances(list);
      },
      (error) => {
        console.error("Ambulances listener error:", error);
      }
    );

    const unsubEpcr = onSnapshot(
      collection(db, "epcr"),
      (snap) => {
        const list: any[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter(isVisibleRecord);

        setEpcrs(list);
      },
      (error) => {
        console.error("ePCR listener error:", error);
      }
    );

    return () => {
      unsubCases();
      unsubAmb();
      unsubEpcr();
    };
  }, [user, loading]);

  const projectOptions = useMemo(() => {
    const set = new Set<string>();

    cases.forEach((c) => {
      const name = getMatchedProjectName(c);
      if (name && name !== "—") set.add(name);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cases, epcrs]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const projectName = getMatchedProjectName(c);

      const matchesProject =
        !selectedProject || projectName === selectedProject;

      const matchesDate = matchesDateFilter(c);

      return matchesProject && matchesDate;
    });
  }, [cases, epcrs, selectedProject, startDate, endDate]);

  const visibleCases = useMemo(() => {
    if (showAllCases) return filteredCases;
    return filteredCases.filter((c) => c.status !== "Closed");
  }, [filteredCases, showAllCases]);

  const totalCases = filteredCases.length;

  const onSceneCases = filteredCases.filter(
    (c) => c.status === "OnScene"
  ).length;

  const enRouteCases = filteredCases.filter(
    (c) => c.status === "EnRoute"
  ).length;

  const activeCases = filteredCases.filter(
    (c) => c.status !== "Closed"
  ).length;

  const closedCases = filteredCases.filter(
    (c) => c.status === "Closed"
  ).length;

  const unreceivedCases = filteredCases.filter(
    (c) => c.status === "Assigned" || c.status === "Received"
  ).length;

  const transportingCases = filteredCases.filter(
    (c) => ["Transporting", "Hospital"].includes(c.status)
  ).length;

  const closedHospitalCases = filteredCases.filter(
    (c) =>
      c.status === "Closed" &&
      c.transportingToType === "hospital"
  ).length;

  const transportingHospitalCases = filteredCases.filter(
    (c) =>
      ["Transporting", "Hospital"].includes(c.status) &&
      c.transportingToType === "hospital"
  ).length;

  const transportingClinicCases = filteredCases.filter(
    (c) =>
      ["Transporting", "Hospital"].includes(c.status) &&
      c.transportingToType === "clinic"
  ).length;

  const closedClinicCases = filteredCases.filter(
    (c) =>
      c.status === "Closed" &&
      c.transportingToType === "clinic"
  ).length;

  const totalAmbulances = ambulances.length;

  function clearFilters() {
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
        <div className="flex flex-col gap-5 border-b border-[#86A7B2]/20 bg-gradient-to-r from-[#274C5A] to-[#315f70] p-6 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white">
              HCAD Command Center
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Dispatch Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#d7e4e8]">Live operational dashboard. Click any case card to open the unified case page directly.</p>
          </div>
          <Link className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black text-[#274C5A] shadow-lg shadow-black/10 transition hover:bg-[#eef5f7]" href="/call-intake">New Case / Call Intake</Link>
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
            Showing {visibleCases.length} case{visibleCases.length !== 1 ? "s" : ""}
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
        {visibleCases.map((c) => (
          <Link
            href={`/cases/${c.id}`}
            key={c.id}
            className="block rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5 transition hover:border-[#274C5A]/50 hover:shadow-lg hover:shadow-[#274C5A]/10"
          >
            <div className="mb-3">
              <h2 className="text-xl font-black text-[#274C5A]">
                {getMatchedEpcrId(c)} — {getMatchedProjectName(c)}
              </h2>

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
