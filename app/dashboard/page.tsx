"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import CaseTimeline from "@/app/components/CaseTimeline";

export default function Dashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);

  useEffect(() => {
  // 🔥 Live sorted cases listener
  const casesQuery = query(
    collection(db, "cases"),
    orderBy("createdAt", "desc")   // NEW → OLD
  );

  const unsubCases = onSnapshot(casesQuery, (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    setCases(list);
  });

  // 🔥 Live ambulances listener
  const unsubAmb = onSnapshot(collection(db, "ambulances"), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
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
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dispatch Dashboard</h1>

     {/* ================== TOP SUMMARY CARDS ================== */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">

  {/* TOTAL CASES CARD */}
  <div className="p-4 border rounded shadow text-blue" style={{ background: "white" }}>
    <h3 className="text-lg font-bold">Total Cases</h3>
    <p className="text-4xl font-extrabold">{totalCases}</p>

    <p className="mt-2 text-sm">
      Active: <span className="font-bold">{activeCases}</span>
      {" — "}
      Solved: <span className="font-bold">{closedCases}</span>
    </p>
  </div>

  {/* ACTIVE CASES */}
  <div className="p-4 bg-white border rounded shadow">
    <h3 className="text-sm text-gray-600">OnScene</h3>
    <p className="text-2xl font-bold text-blue-600">{OnSceneCases}</p>
  </div>

  {/* TRANSPORTING */}
  <div className="p-4 bg-white border rounded shadow">
    <h3 className="text-sm text-gray-600">Transporting</h3>
    <p className="text-2xl font-bold text-orange-600">{transportingCases}</p>
  </div>

  {/* AMBULANCES */}
  <div className="p-4 bg-white border rounded shadow">
    <h3 className="text-sm text-gray-600">Ambulances</h3>
    <p className="text-2xl font-bold text-purple-600">{totalAmbulances}</p>
  </div>

</div>



      {/* ================== CASES WITH TIMELINES ================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cases.map((c) => (
          <div key={c.id} className="p-4 bg-white rounded shadow border">
            <h2 className="text-xl font-bold">
              {c.patientName} — Level {c.level}
            </h2>
            <p className="text-gray-600">{c.locationText}</p>

            <CaseTimeline timeline={c.timeline || {}} />
          </div>
        ))}
      </div>
    </div>
  );
}
