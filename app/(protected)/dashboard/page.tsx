"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import CaseTimeline from "@/app/components/CaseTimeline";

export default function Dashboard() {
  const { user, loading } = useCurrentUser();

  const [cases, setCases] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);

  /* =====================================================
     🔐 FIRESTORE LISTENERS (ROLE GUARDED)
  ===================================================== */
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!["admin", "dispatcher"].includes(user.role)) {
      console.warn("⛔ User has no permission to load dashboard data");
      return;
    }

    console.log("✅ Dashboard listeners started for role:", user.role);

    const unsubCases = onSnapshot(
      collection(db, "cases"),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Sort by Received time (latest first)
        // list.sort((a, b) => {
        //   const ta = a.timeline?.Received
        //     ? new Date(a.timeline.Received).getTime()
        //     : 0;
        //   const tb = b.timeline?.Received
        //     ? new Date(b.timeline.Received).getTime()
        //     : 0;
        //   return tb - ta;
        // });

        setCases(list);
      },
      (error) => {
        console.error("❌ Cases listener error:", error);
      }
    );

    const unsubAmb = onSnapshot(
      collection(db, "ambulances"),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setAmbulances(list);
      },
      (error) => {
        console.error("❌ Ambulances listener error:", error);
      }
    );

    return () => {
      unsubCases();
      unsubAmb();
    };
  }, [user, loading]);

  /* =====================================================
     ⛔ BLOCK UI UNTIL USER READY
  ===================================================== */
  if (loading || !user) {
    return (
      <div className="p-6 min-h-screen bg-gray-900 text-white">
        Loading dashboard…
      </div>
    );
  }

  if (!["admin", "dispatcher"].includes(user.role)) {
    return (
      <div className="p-6 min-h-screen bg-gray-900 text-red-400">
        You do not have permission to access this dashboard.
      </div>
    );
  }

  /* =====================================================
     📊 STATS
  ===================================================== */
  const totalCases = cases.length;

  const activeCases = cases.filter((c) => c.status !== "Closed").length;
  const closedCases = cases.filter((c) => c.status === "Closed").length;

  const onSceneCases = cases.filter((c) => c.status === "OnScene").length;
  const enRouteCases = cases.filter((c) => c.status === "EnRoute").length;

  const unreceivedCases = cases.filter(
    (c) => c.status === "Assigned" || c.status === "Received"
  ).length;

  const transportingCases = cases.filter((c) =>
    ["Transporting", "Hospital"].includes(c.status)
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
      c.status === "Closed" && c.transportingToType === "hospital"
  ).length;

  const closedClinicCases = cases.filter(
    (c) =>
      c.status === "Closed" && c.transportingToType === "clinic"
  ).length;

  const totalAmbulances = ambulances.length;

  /* =====================================================
     🖥 UI
  ===================================================== */
  return (
    <div className="p-6 min-h-screen bg-gray-100 dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Dispatch Dashboard
      </h1>

      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <Card title="Total Cases" value={totalCases} />
        <Card title="Active" value={activeCases} color="text-blue-600" />
        <Card title="Unreceived from team" value={unreceivedCases} />
        <Card title="EnRoute" value={enRouteCases} />
        <Card title="OnScene" value={onSceneCases} />
        <Card
          title="Transporting"
          value={transportingCases}
          color="text-orange-600"
          sub={`Hospital: ${transportingHospitalCases} - Clinic: ${transportingClinicCases}`}
        />
        <Card
          title="Treated"
          value={closedCases}
          sub={`Hospital: ${closedHospitalCases} - Clinic: ${closedClinicCases}`}
        />
        <Card
          title="Ambulances"
          value={totalAmbulances}
          color="text-purple-600"
        />
      </div>

      {/* ===== CASE LIST ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cases.map((c) => (
          <div
            key={c.id}
            className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:border-gray-700"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Lazem Code: {c.lazemCode || "—"} — {c.level}
            </h2>

            <p className="text-gray-500">
              Ijrny Code: {c.ijrny || "—"}
            </p>

            <CaseTimeline timeline={c.timeline || {}} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================
   🧱 REUSABLE CARD
===================================================== */
function Card({
  title,
  value,
  color = "text-gray-900",
  sub,
}: {
  title: string;
  value: number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:border-gray-700">
      <h3 className="text-sm text-gray-400">{title}</h3>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-400 text-sm">{sub}</p>}
    </div>
  );
}
