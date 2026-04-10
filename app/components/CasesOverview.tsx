"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CaseTimeline from "@/app/components/CaseTimeline";

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

  function getMatchedEpcrId(caseItem: any): string {
    const matched = epcrs.find((e) => e.caseId === caseItem.id);
    return matched?.id || "—";
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
    <div className="p-6 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">
        {title}
      </h1>

      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold dark:text-white">Cases Timeline</h2>
          <p className="text-sm text-gray-400">
            Showing {visibleCases.length} case{visibleCases.length !== 1 ? "s" : ""}
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

      {/* ===== CASE LIST ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleCases.map((c) => (
          <div
            key={c.id}
            className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
          >
            <div className="mb-3">
              <h2 className="text-xl font-bold">
                {getMatchedEpcrId(c)} — {c.patientName || "—"}
              </h2>

              <p className="text-gray-400">
                Date & Time: {formatCaseDate(c)}
              </p>
            </div>

            <CaseTimeline timeline={c.timeline || {}} />
          </div>
        ))}
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
  const colorMap: any = {
    blue: "text-blue-600",
    orange: "text-orange-600",
    purple: "text-purple-600",
  };

  return (
    <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
      <h3 className={big ? "text-lg font-bold" : "text-sm text-gray-400"}>
        {title}
      </h3>
      <p
        className={`${
          big ? "text-4xl" : "text-2xl"
        } font-extrabold ${colorMap[color]}`}
      >
        {value}
      </p>
      {sub && <p className="text-gray-400">{sub}</p>}
    </div>
  );
}