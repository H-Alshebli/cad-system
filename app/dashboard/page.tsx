"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import CaseTimeline from "@/app/components/CaseTimeline";

export default function Dashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);

  // FILTER STATES
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [filteredCases, setFilteredCases] = useState<any[]>([]);

  useEffect(() => {
    const casesQuery = query(collection(db, "cases"), orderBy("createdAt", "desc"));

    const unsubCases = onSnapshot(casesQuery, (snap) => {
      const list: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCases(list);

      // If filters active → reapply them on live updates
      if (filteredCases.length > 0) applyFilters(list);
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

  /* -------------------------------------------------------------
     🔍 FILTER LOGIC
  --------------------------------------------------------------*/
  const applyFilters = (baseCases = cases) => {
    let filtered = [...baseCases];

    // DATE FROM
    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter((c) => {
        const t = new Date(c.timeline?.Received);
        return t >= from;
      });
    }

    // DATE TO
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59);
      filtered = filtered.filter((c) => {
        const t = new Date(c.timeline?.Received);
        return t <= to;
      });
    }

    // START TIME
    if (startTime) {
      filtered = filtered.filter((c) => {
        const t = new Date(c.timeline?.Received);
        const [h, m] = startTime.split(":");
        return t.getHours() > Number(h) || (t.getHours() === Number(h) && t.getMinutes() >= Number(m));
      });
    }

    // END TIME
    if (endTime) {
      filtered = filtered.filter((c) => {
        const t = new Date(c.timeline?.Received);
        const [h, m] = endTime.split(":");
        return t.getHours() < Number(h) || (t.getHours() === Number(h) && t.getMinutes() <= Number(m));
      });
    }

    setFilteredCases(filtered);
  };

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setStartTime("");
    setEndTime("");
    setFilteredCases([]);
  };

  /* -------------------------------------------------------------
     📊 STATS
  --------------------------------------------------------------*/
  const currentCases = filteredCases.length ? filteredCases : cases;

  const totalCases = currentCases.length;
  const OnSceneCases = currentCases.filter((c) => c.status == "OnScene").length;
  const activeCases = currentCases.filter((c) => c.status !== "Closed").length;
  const closedCases = currentCases.filter((c) => c.status === "Closed").length;
  const unreceivedCases = currentCases.filter((c) => c.status === "Assigned" || c.status === "Received").length;
  const transportingCases = currentCases.filter((c) => c.status === "Transporting").length;
  const totalAmbulances = ambulances.length;

  return (
    <div className="p-6 dark:bg-gray-900 min-h-screen">

      <h1 className="text-3xl font-bold mb-6 dark:text-white">Dispatch Dashboard</h1>

      {/* ================== FILTER BAR ================== */}
      <div className="flex flex-wrap gap-3 mb-8 bg-[#1c2333] p-4 rounded-lg">

        <div>
          <label className="text-white text-sm">From Date</label>
          <input
            type="date"
            className="p-2 rounded bg-[#0f172a] text-white"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-white text-sm">To Date</label>
          <input
            type="date"
            className="p-2 rounded bg-[#0f172a] text-white"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-white text-sm">Start Time</label>
          <input
            type="time"
            className="p-2 rounded bg-[#0f172a] text-white"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        <div>
          <label className="text-white text-sm">End Time</label>
          <input
            type="time"
            className="p-2 rounded bg-[#0f172a] text-white"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <button
          onClick={() => applyFilters()}
          className="bg-blue-600 px-4 py-2 rounded text-white"
        >
          Apply
        </button>

        <button
          onClick={resetFilters}
          className="bg-gray-600 px-4 py-2 rounded text-white"
        >
          Reset
        </button>
      </div>

      {/* ================== TOP SUMMARY CARDS ================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">

        {/* TOTAL CASES */}
        <div className="p-4 border rounded shadow bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-lg font-bold dark:text-gray-200">Total Cases</h3>
          <p className="text-4xl font-extrabold">{totalCases}</p>
        </div>

        {/* ACTIVE CASES */}
        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">Active</h3>
          <p className="text-2xl font-bold text-blue-600">{activeCases}</p>
        </div>

        {/* UNRECEIVED */}
        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">Unreceived from team</h3>
          <p className="text-2xl font-bold text-blue-600">{unreceivedCases}</p>
        </div>

        {/* ON SCENE */}
        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">OnScene</h3>
          <p className="text-2xl font-bold text-blue-600">{OnSceneCases}</p>
        </div>

        {/* TRANSPORTING */}
        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">Transporting</h3>
          <p className="text-2xl font-bold text-orange-600">{transportingCases}</p>
        </div>

        {/* CLOSED */}
        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">Treated</h3>
          <p className="text-2xl font-bold text-blue-600">{closedCases}</p>
        </div>

        {/* AMBULANCES */}
        <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-300">Ambulances</h3>
          <p className="text-2xl font-bold text-purple-600">{totalAmbulances}</p>
        </div>
      </div>

      {/* ================== CASE LIST WITH TIMELINES ================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {currentCases.map((c) => (
          <div
            key={c.id}
            className="p-4 border rounded shadow bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700"
          >
            <h2 className="text-xl font-bold dark:text-white">
              <strong>Lazem Code:</strong> {c.lazemCode || "—"} — {c.level}
            </h2>

            <p className="text-gray-600 dark:text-gray-300">
              <strong>Ijrny Code:</strong> {c.ijrny || "—"}
            </p>

            <CaseTimeline timeline={c.timeline || {}} />
          </div>
        ))}
      </div>
    </div>
  );
}
