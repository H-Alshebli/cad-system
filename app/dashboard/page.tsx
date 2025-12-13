"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import CaseTimeline from "@/app/components/CaseTimeline";

/* =====================================================
   🔒 ADMIN FIXED FILTER (غير التاريخ والوقت هنا فقط)
===================================================== */
// 🇸🇦 Saudi Arabia Time (UTC+3)
const FILTER_FROM = new Date(2025, 11, 13, 17, 0, 0); // 12 Dec 5:00 PM
const FILTER_TO   = new Date(2025, 11, 14, 17, 0, 0); // 13 Dec 5:00 PM



export default function Dashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);

  useEffect(() => {
    const casesQuery = query(
      collection(db, "cases"),
      orderBy("createdAt", "desc")
    );

    const unsubCases = onSnapshot(casesQuery, (snap) => {
      const list: any[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setCases(list);
    });

    const unsubAmb = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list: any[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAmbulances(list);
    });

    return () => {
      unsubCases();
      unsubAmb();
    };
  }, []);

  /* =====================================================
     🔍 FIXED FILTER LOGIC
  ===================================================== */
  const filteredCases = cases.filter((c) => {
    if (!c.timeline?.Received) return false;

    const receivedAt = new Date(c.timeline.Received);
    return receivedAt >= FILTER_FROM && receivedAt <= FILTER_TO;
  });

  /* =====================================================
     📊 STATS
  ===================================================== */
  const totalCases = filteredCases.length;
  const OnSceneCases = filteredCases.filter(
    (c) => c.status === "OnScene"
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
    c.status === "Transporting" || c.status === "Hospital" &&
    c.transportingToType === "hospital"
).length;
const transportingClinicCases = filteredCases.filter(
  (c) =>
    ["Transporting", "Hospital"].includes(c.status)&&
    c.transportingToType === "clinic"
).length;
const closedclinicCases = filteredCases.filter(
  (c) =>
    c.status === "Closed" &&
    c.transportingToType === "clinic"
).length;


  const totalAmbulances = ambulances.length;

  return (
    <div className="p-6 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">
        Dispatch Dashboard
      </h1>

      {/* ================== TOP SUMMARY CARDS ================== */}
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

      {/* ================== CASE LIST ================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCases.map((c) => (
          <div
            key={c.id}
            className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
          >
            <h2 className="text-xl font-bold">
              Lazem Code: {c.lazemCode || "—"} — {c.level}
            </h2>

            <p className="text-gray-400">
              Ijrny Code: {c.ijrny || "—"}
            </p>

            <CaseTimeline timeline={c.timeline || {}} />
          </div>
        ))}
      </div>
    </div>
  );
}
