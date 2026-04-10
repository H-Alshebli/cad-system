"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import CaseTimeline from "@/app/components/CaseTimeline";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function Dashboard() {
  const { user, loading } = useCurrentUser();
  console.log("CURRENT USER (Sidebar):", user);

  const [cases, setCases] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
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
    if (loading) return;
    if (!user || user.role === "none") return;

    console.log("Starting dashboard listeners for role:", user.role);

    const unsubCases = onSnapshot(
      collection(db, "cases"),
      (snap) => {
        const list: any[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

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

    return () => {
      unsubCases();
      unsubAmb();
      unsubEpcr();
    };
  }, [user, loading]);

  const visibleCases = useMemo(() => {
    if (showAllCases) return cases;
    return cases.filter((c) => c.status !== "Closed");
  }, [cases, showAllCases]);

  const totalCases = cases.length;

  const OnSceneCases = cases.filter(
    (c) => c.status === "OnScene"
  ).length;

  const EnRouteCases = cases.filter(
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

  const closedHospitalCases = cases.filter(
    (c) =>
      c.status === "Closed" &&
      c.transportingToType === "hospital"
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

  const closedclinicCases = cases.filter(
    (c) =>
      c.status === "Closed" &&
      c.transportingToType === "clinic"
  ).length;

  const totalAmbulances = ambulances.length;

  if (loading || !user || user.role === "none") {
    return (
      <div className="p-6 dark:bg-gray-900 min-h-screen text-white">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">
        Dispatch Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-lg font-bold">Total Cases</h3>
          <p className="text-4xl font-extrabold">{totalCases}</p>
        </div>

        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-400">Active</h3>
          <p className="text-2xl font-bold text-blue-600">{activeCases}</p>
        </div>

        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-400">Unreceived from team</h3>
          <p className="text-2xl font-bold text-blue-600">{unreceivedCases}</p>
        </div>

        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-400">EnRoute</h3>
          <p className="text-2xl font-bold text-blue-600">{EnRouteCases}</p>
        </div>

        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-400">OnScene</h3>
          <p className="text-2xl font-bold text-blue-600">{OnSceneCases}</p>
        </div>

        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-400">Transporting</h3>
          <p className="text-2xl font-bold text-orange-600">
            {transportingCases}
          </p>
          <p className="text-gray-400">
            Hospital: {transportingHospitalCases} - Clinic: {transportingClinicCases}
          </p>
        </div>

        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-400">Treated</h3>
          <p className="text-2xl font-bold text-blue-600">{closedCases}</p>
          <p className="text-gray-400">
            Hospital: {closedHospitalCases} - Clinic: {closedclinicCases}
          </p>
        </div>

        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-400">Ambulances</h3>
          <p className="text-2xl font-bold text-purple-600">
            {totalAmbulances}
          </p>
        </div>
      </div>

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