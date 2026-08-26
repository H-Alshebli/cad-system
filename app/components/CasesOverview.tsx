"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CaseTimeline from "@/app/components/CaseTimeline";
import {
  getCaseDisplayCode,
  getEpcrDisplayCode,
  getProjectDisplayName,
  getUnitDisplayName,
} from "@/lib/displayLabels";

export default function CasesOverview({
  title,
  cases,
  ambulances = [],
}: {
  title: string;
  cases: any[];
  ambulances?: any[];
}) {
  const [epcrs, setEpcrs] = useState<any[]>([]);
  const [showAllCases, setShowAllCases] = useState(false);

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
    const matched = epcrs.find((e) => e.caseId === caseItem.id);
    return matched || null;
  }

  useEffect(() => {
    const unsubEpcr = onSnapshot(
      collection(db, "epcr"),
      (snap) => {
        const list: any[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setEpcrs(list);
      },
      (error) => {
        console.error("ePCR listener error:", error);
      }
    );

    return () => unsubEpcr();
  }, []);

  const sortedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      const ta = getCaseDate(a)?.getTime() ?? 0;
      const tb = getCaseDate(b)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [cases]);

  const visibleCases = useMemo(() => {
    if (showAllCases) return sortedCases;
    return sortedCases.filter((c) => c.status !== "Closed");
  }, [sortedCases, showAllCases]);

  /* =========================
     STATS (same as dashboard)
  ========================= */
  const totalCases = cases.length;

  const onSceneCases = cases.filter(
    (c) => c.status === "OnScene"
  ).length;

  const enRouteCases = cases.filter(
    (c) => c.status === "EnRoute"
  ).length;

  const activeCases = cases.filter(
    (c) => c.status !== "Closed"
  ).length;

  const closedCases = cases.filter(
    (c) => c.status === "Closed"
  ).length;

  const unreceivedCases = cases.filter(
    (c) => c.status === "Assigned" || c.status === "Received"
  ).length;

  const transportingCases = cases.filter(
    (c) => ["Transporting", "Hospital"].includes(c.status)
  ).length;

  const returningCases = cases.filter(
    (c) => c.status === "Returning"
  ).length;

  const transportingHospitalCases = cases.filter(
    (c) =>
      ["Transporting", "Hospital"].includes(c.status) &&
      c.transportingToType === "hospital"
  ).length;

  const transportingClinicCases = cases.filter(
    (c) =>
      ["Transporting", "Hospital"].includes(c.status) &&
      c.transportingToType === "clinic"
  ).length;

  const closedHospitalCases = cases.filter(
    (c) =>
      c.status === "Closed" &&
      c.transportingToType === "hospital"
  ).length;

  const closedClinicCases = cases.filter(
    (c) =>
      c.status === "Closed" &&
      c.transportingToType === "clinic"
  ).length;

  const totalAmbulances = ambulances.length;

  /* =========================
     UI
  ========================= */
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight text-[#274C5A]">
        {title}
      </h1>

      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card title="Total Cases" value={totalCases} big />
        <Card title="Active" value={activeCases} />
        <Card title="Unreceived from team" value={unreceivedCases} />
        <Card title="EnRoute" value={enRouteCases} />
        <Card title="OnScene" value={onSceneCases} />

        <Card
          title="Transporting"
          value={transportingCases}
          sub={`Hospital: ${transportingHospitalCases} - Clinic: ${transportingClinicCases}`}
          color="orange"
        />

        <Card title="Returning" value={returningCases} />

        <Card
          title="Treated"
          value={closedCases}
          sub={`Hospital: ${closedHospitalCases} - Clinic: ${closedClinicCases}`}
        />

        {ambulances.length > 0 && (
          <Card
            title="Ambulances"
            value={totalAmbulances}
            color="purple"
          />
        )}
      </div>

      {/* ===== CASE LIST HEADER ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#86A7B2]/20 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
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

      {/* ===== CASE LIST ===== */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {visibleCases.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-[#86A7B2]/40 bg-white p-8 text-center text-sm font-semibold text-[#7F7F7F]">
            No cases found.
          </div>
        ) : (
          visibleCases.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5 transition hover:border-[#274C5A]/50 hover:shadow-lg hover:shadow-[#274C5A]/10"
            >
              <div className="mb-3">
                <h2 className="text-xl font-black text-[#274C5A]">
                  {getCaseDisplayCode(c)} — {getProjectDisplayName(c)}
                </h2>

                <p className="mt-1 text-sm font-bold text-[#274C5A]">
                  {c.chiefComplaint || c.caseInfo?.complaint || "No complaint recorded"}
                  {" • "}
                  {getUnitDisplayName(c.assignedUnit) || "Unit not assigned"}
                  {getMatchedEpcr(c)
                    ? ` • ${getEpcrDisplayCode(getMatchedEpcr(c))}`
                    : ""}
                </p>

                <p className="text-sm font-medium text-[#7F7F7F]">
                  Date & Time: {formatCaseDate(c)}
                </p>
              </div>

              <CaseTimeline timeline={c.timeline || {}} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* =========================
   CARD COMPONENT
========================= */
function Card({
  title,
  value,
  sub,
  big,
  color = "blue",
}: {
  title: string;
  value: number;
  sub?: string;
  big?: boolean;
  color?: "blue" | "orange" | "purple";
}) {
  const colorMap: Record<"blue" | "orange" | "purple", string> = {
    blue: "text-[#274C5A]",
    orange: "text-[#ef7b00]",
    purple: "text-[#86A7B2]",
  };

  if (big) {
    return (
      <div className="rounded-2xl border border-[#274C5A]/20 bg-[#274C5A] p-5 text-white shadow-lg shadow-[#274C5A]/15">
        <h3 className="text-lg font-black">{title}</h3>
        <p className="mt-2 text-4xl font-extrabold">{value}</p>
        {sub && <p className="mt-1 text-sm font-medium text-white/75">{sub}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
      <h3 className="text-sm font-bold text-[#7F7F7F]">{title}</h3>
      <p className={`mt-2 text-2xl font-black ${colorMap[color]}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-sm font-medium text-[#7F7F7F]">{sub}</p>}
    </div>
  );
}
