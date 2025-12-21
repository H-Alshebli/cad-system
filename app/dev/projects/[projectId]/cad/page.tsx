"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import Link from "next/link";

import StatusButtons from "@/app/components/StatusButtons";
import CaseTimeline from "@/app/components/CaseTimeline";

export default function ProjectCadPage({
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

  if (loading) return <div className="p-4">Loading CAD...</div>;

  return (
    <div className="space-y-4">
      {/* ---------------- HEADER ---------------- */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Project CAD</h2>

        <Link
          href={`/dev/projects/${params.projectId}/cases/new`}
          className="px-3 py-2 bg-green-600 text-white rounded text-sm"
        >
          + New Case
        </Link>
      </div>

      {/* ---------------- EMPTY STATE ---------------- */}
      {cases.length === 0 && (
        <div className="text-muted-foreground">
          No cases for this project yet.
        </div>
      )}

      {/* ---------------- CASES LIST ---------------- */}
      <div className="grid gap-4">
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/dev/projects/${params.projectId}/cad/${c.id}`}
            className="block p-4 bg-card border rounded space-y-3 hover:bg-muted transition"
          >
            {/* Case Header */}
            <div className="flex justify-between items-center">
              <div className="font-semibold">
                {c.lazemCode || c.id}
              </div>
              <span className="text-sm text-muted-foreground">
                {c.status}
              </span>
            </div>

            {/* Status Buttons */}
        

            {/* Timeline */}
            <div className="border border-gray-700 rounded-lg p-4 bg-[#0f172a] hover:border-blue-500 transition">
  {/* HEADER */}
  <div className="flex justify-between items-center mb-3">
    <div className="font-semibold text-white">
      {c.lazemCode || c.id}
    </div>

    <span
      className={`text-xs px-3 py-1 rounded-full font-medium
        ${
          c.status === "Assigned"
            ? "bg-blue-600/20 text-blue-400"
            : c.status === "Received"
            ? "bg-green-600/20 text-green-400"
            : "bg-gray-600/20 text-gray-300"
        }`}
    >
      {c.status}
    </span>
  </div>

  {/* BODY */}
  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
    {/* Complaint */}
    <div>
      <div className="text-gray-400">Chief Complaint</div>
      <div className="text-white font-medium">
        {c.chiefComplaint || "-"}
      </div>
    </div>

    {/* Triage */}
    <div>
      <div className="text-gray-400">Triage</div>
      <div className="text-white font-medium">
        {c.level || "-"}
      </div>
    </div>

    {/* Location */}
    <div className="col-span-2">
      <div className="text-gray-400">Location</div>
      <div className="text-white">
        {c.locationText || "-"}
      </div>
    </div>

    {/* Assigned Unit */}
    <div className="col-span-2">
      <div className="text-gray-400">Assigned Unit</div>
      <div className="text-white">
        {c.ambulanceCode || c.roaming || c.clinicId || "-"}
      </div>
    </div>
  </div>
</div>

            
          </Link>
        ))}
      </div>
    </div>
  );
}
