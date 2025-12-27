"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

export default function ProjectDetailsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "cases"),
      where("projectId", "==", params.projectId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setCases(data);
      setLoading(false);
    });

    return () => unsub();
  }, [params.projectId]);

  if (loading) return <div className="p-6">Loading overview...</div>;

  // 🔢 KPIs
  const total = cases.length;
  const active = cases.filter((c) =>
    ["Received", "Assigned"].includes(c.status)
  ).length;
  const enRoute = cases.filter((c) => c.status === "EnRoute").length;
  const onScene = cases.filter((c) => c.status === "OnScene").length;
  const transporting = cases.filter(
    (c) => c.status === "Transporting"
  ).length;
  const treated = cases.filter((c) => c.status === "Treated").length;

  return (
    <div className="space-y-6">
      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Total Cases" value={total} />
        <KpiCard title="Active" value={active} />
        <KpiCard title="EnRoute" value={enRoute} />
        <KpiCard title="On Scene" value={onScene} />
        <KpiCard title="Transporting" value={transporting} />
        <KpiCard title="Treated" value={treated} />
      </div>

      {/* Placeholder for future charts */}
      <div className="p-4 border rounded bg-card text-muted-foreground">
        Charts & analytics will be added here.
      </div>
    </div>
  );
}

/* -----------------------------
   KPI CARD COMPONENT
------------------------------ */
function KpiCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="p-4 rounded border bg-card">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
