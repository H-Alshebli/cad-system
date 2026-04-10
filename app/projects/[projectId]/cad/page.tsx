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

export default function ProjectCadPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      data.sort((a, b) => {
        const ta = getCaseDate(a)?.getTime() ?? 0;
        const tb = getCaseDate(b)?.getTime() ?? 0;
        return tb - ta;
      });

      setCases(data);
      setLoading(false);
    });

    return () => unsub();
  }, [params.projectId]);

  if (loading) return <div className="p-4">Loading CAD...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Project CAD</h2>

        <Link
          href={`/projects/${params.projectId}/cases/new`}
          className="px-3 py-2 bg-green-600 text-white rounded text-sm"
        >
          + New Case
        </Link>
      </div>

      {cases.length === 0 && (
        <div className="text-muted-foreground">
          No cases for this project yet.
        </div>
      )}

      <div className="grid gap-4">
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/projects/${params.projectId}/cad/${c.id}`}
            className="block p-4 bg-card border rounded space-y-3 hover:bg-muted transition"
          >
            <div className="border border-gray-700 rounded-lg p-4 bg-[#0f172a] hover:border-blue-500 transition">
              <div className="flex justify-between items-start mb-4 gap-4">
                <div>
                  <div className="font-semibold text-white text-base">
                    {c.id} — {c.patientName || "—"}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Date & Time: {formatCaseDate(c)}
                  </div>
                </div>

                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap
                    ${
                      c.status === "Assigned"
                        ? "bg-blue-600/20 text-blue-400"
                        : c.status === "Received"
                        ? "bg-green-600/20 text-green-400"
                        : c.status === "Closed"
                        ? "bg-red-600/20 text-red-400"
                        : c.status === "EnRoute"
                        ? "bg-yellow-600/20 text-yellow-400"
                        : c.status === "OnScene"
                        ? "bg-purple-600/20 text-purple-400"
                        : "bg-gray-600/20 text-gray-300"
                    }`}
                >
                  {c.status || "—"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <div className="text-gray-400">Chief Complaint</div>
                  <div className="text-white font-medium">
                    {c.chiefComplaint || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-gray-400">Project Name</div>
                  <div className="text-white font-medium">
                    {c.patientName || "-"}
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <div className="text-gray-400">Location</div>
                  <div className="text-white">
                    {c.locationText || "-"}
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2">
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