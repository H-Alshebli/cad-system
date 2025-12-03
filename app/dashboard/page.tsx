"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Dashboard() {
  const [totalCases, setTotalCases] = useState(0);
  const [activeCases, setActiveCases] = useState(0);
  const [solvedCases, setSolvedCases] = useState(0);
  const [casesToday, setCasesToday] = useState(0);
  const [transporting, setTransporting] = useState(0);
  const [ambulances, setAmbulances] = useState(0);

  useEffect(() => {
    // Listen for case updates in real time
    const unsubCases = onSnapshot(collection(db, "cases"), (snap) => {
      const all = snap.docs.map((d) => d.data());
      setTotalCases(all.length);

      const active = all.filter((c) => c.status !== "Closed").length;
      const solved = all.filter((c) => c.status === "Closed").length;
      setActiveCases(active);
      setSolvedCases(solved);

      // Cases Today
      const today = new Date().toDateString();
      const todayCases = all.filter((c) => {
        if (!c.timestamp) return false;
        return new Date(c.timestamp.toDate()).toDateString() === today;
      }).length;
      setCasesToday(todayCases);

      // Transporting
      const transportingCount = all.filter((c) => c.status === "Transporting").length;
      setTransporting(transportingCount);
    });

    // Listen for ambulances
    const unsubAmb = onSnapshot(collection(db, "ambulances"), (snap) => {
      setAmbulances(snap.docs.length);
    });

    return () => {
      unsubCases();
      unsubAmb();
    };
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dispatch Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* TOTAL CASES CARD */}
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Total Cases</h2>
          <p className="text-4xl font-bold mt-2">{totalCases}</p>
          <p className="text-md mt-2">
            Active: <span className="font-bold">{activeCases}</span> — 
            Solved: <span className="font-bold">{solvedCases}</span>
          </p>
        </div>

        {/* CASES TODAY */}
        <div className="bg-green-600 text-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Cases Today</h2>
          <p className="text-4xl font-bold mt-2">{casesToday}</p>
        </div>

        {/* TRANSPORTING */}
        <div className="bg-yellow-500 text-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Transporting</h2>
          <p className="text-4xl font-bold mt-2">{transporting}</p>
        </div>

        {/* AMBULANCES */}
        <div className="bg-purple-600 text-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Ambulances</h2>
          <p className="text-4xl font-bold mt-2">{ambulances}</p>
        </div>
      </div>
    </div>
  );
}
