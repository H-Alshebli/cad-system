"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getCaseDisplayCode,
  getCaseDisplayTitle,
  getUnitDisplayName,
} from "@/lib/displayLabels";

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

    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  function formatCaseDate(item: any): string {
    const dateObj = getCaseDate(item);
    if (!dateObj) return "-";

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
    const q = query(collection(db, "cases"), where("projectId", "==", params.projectId));

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Project CAD</h2>

        <Link
          href={`/projects/${params.projectId}/cases/new`}
          className="rounded bg-green-600 px-3 py-2 text-sm text-white"
        >
          + New Case
        </Link>
      </div>

      {cases.length === 0 && (
        <div className="text-muted-foreground">No cases for this project yet.</div>
      )}

      <div className="grid gap-4">
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/projects/${params.projectId}/cad/${c.id}`}
            className="block space-y-3 rounded border bg-card p-4 transition hover:bg-muted"
          >
            <div className="rounded-lg border border-gray-700 bg-[#0f172a] p-4 transition hover:border-blue-500">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-white">
                    {getCaseDisplayCode(c)}
                  </div>
                  <div className="mt-1 text-sm text-gray-300">
                    {getCaseDisplayTitle(c)}
                  </div>
                  <div className="mt-1 text-sm text-gray-400">
                    Date & Time: {formatCaseDate(c)}
                  </div>
                </div>

                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
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
                  {c.status || "-"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
                <div>
                  <div className="text-gray-400">Chief Complaint</div>
                  <div className="font-medium text-white">{c.chiefComplaint || "-"}</div>
                </div>

                <div>
                  <div className="text-gray-400">Project Name</div>
                  <div className="font-medium text-white">{c.projectName || "-"}</div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <div className="text-gray-400">Location</div>
                  <div className="text-white">{c.locationText || c.pickupText || "-"}</div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <div className="text-gray-400">Assigned Unit</div>
                  <div className="text-white">
                    {getUnitDisplayName(c.assignedUnit) ||
                      c.ambulanceCode ||
                      c.roaming ||
                      c.clinicId ||
                      "-"}
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
