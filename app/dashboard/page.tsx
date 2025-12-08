"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import CaseTimeline from "@/app/components/CaseTimeline";

export default function Dashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);

  useEffect(() => {
    const casesQuery = query(collection(db, "cases"), orderBy("createdAt", "desc"));

    const unsubCases = onSnapshot(casesQuery, (snap) => {
      const list: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCases(list);
    });

    const unsubAmb = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAmbulances(list);
    });

    return () => {
      unsubCases();
      unsubAmb();
    };
  }, []);

  // 📌 Stats
  const totalCases = cases.length;
  const OnSceneCases = cases.filter((c) => c.status == "OnScene").length;
  const activeCases = cases.filter((c) => c.status !== "Closed").length;
  const closedCases = cases.filter((c) => c.status === "Closed").length;
  const transportingCases = cases.filter((c) => c.status === "Transporting").length;
  const totalAmbulances = ambulances.length;

  return (
    <div className="p-6 dark:bg-gray-900 min-h-screen">

      <h1 className="text-3xl font-bold mb-6 dark:text-white">Dispatch Dashboard</h1>

      {/* ================== TOP SUMMARY CARDS ================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">

        {/* TOTAL CASES */}
        <div className="
          p-4 border rounded shadow 
          bg-white text-gray-900 
          dark:bg-gray-800 dark:text-white dark:border-gray-700
        ">
          <h3 className="text-lg font-bold dark:text-gray-200">Total Cases</h3>
          <p className="text-4xl font-extrabold">{totalCases}</p>

          <p className="mt-2 text-sm dark:text-gray-300">
            Active: <span className="font-bold">{activeCases}</span> — treated:{" "}
            <span className="font-bold">{closedCases}</span>
          </p>
        </div>

        {/* ACTIVE CASES */}
        <div className="
          p-4 border rounded shadow 
          bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700
        ">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">OnScene</h3>
          <p className="text-2xl font-bold text-blue-600">{OnSceneCases}</p>
        </div>

        {/* TRANSPORTING */}
        <div className="
          p-4 border rounded shadow 
          bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700
        ">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">Transporting</h3>
          <p className="text-2xl font-bold text-orange-600">{transportingCases}</p>
        </div>

        {/* TOTAL AMBULANCES */}
        <div className="
          p-4 border rounded shadow 
          bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700
        ">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">Ambulances</h3>
          <p className="text-2xl font-bold text-purple-600">{totalAmbulances}</p>
        </div>
      </div>

      {/* ================== CASE LIST WITH TIMELINES ================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cases.map((c) => (
          <div
            key={c.id}
            className="
              p-4 border rounded shadow 
              bg-white text-gray-900 
              dark:bg-gray-800 dark:text-white dark:border-gray-700
            "
          >
            <h2 className="text-xl font-bold dark:text-white">
  <strong>Lazem Code:</strong> {c.lazemCode || "—"} —  {c.level}
</h2>

<p className="text-gray-600 dark:text-gray-300">
  <strong>Ijrny Code:</strong> {c.ijrny || "—"}
</p>

            {/* Timeline now supports dark mode automatically */}
            <CaseTimeline timeline={c.timeline || {}} />
          </div>
        ))}
      </div>
    </div>
  );
}
