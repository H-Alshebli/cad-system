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

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#d8e6ea] bg-white p-6 text-sm font-semibold text-[#274C5A] shadow-sm">
        Loading CAD...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8e6ea] bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#74cdda]">
            Project Command
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#123746]">Project CAD</h2>
          <p className="mt-1 text-sm font-semibold text-[#607482]">
            Project-linked CAD cases and operational status.
          </p>
        </div>

        <Link
          href={`/projects/${params.projectId}/cases/new`}
          className="inline-flex items-center justify-center rounded-xl bg-[#274C5A] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-[#274C5A]/15 transition hover:bg-[#1d3b47]"
        >
          + New Case
        </Link>
      </div>

      {cases.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#b9d2d9] bg-white p-8 text-center text-sm font-semibold text-[#607482] shadow-sm">
          No cases for this project yet.
        </div>
      )}

      <div className="grid gap-4">
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/projects/${params.projectId}/cad/${c.id}`}
            className="group block rounded-2xl border border-[#d8e6ea] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#74cdda] hover:shadow-xl hover:shadow-[#274C5A]/10"
          >
            <div className="rounded-xl border border-[#e1ebef] bg-[#f7fbfc] p-5 transition group-hover:border-[#74cdda]">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-[#123746]">
                    {getCaseDisplayCode(c)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#274C5A]">
                    {getCaseDisplayTitle(c)}
                  </div>
                  <div className="mt-1 text-sm text-[#607482]">
                    Date & Time: {formatCaseDate(c)}
                  </div>
                </div>

                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${
                    c.status === "Assigned"
                      ? "bg-[#dfeeff] text-[#1d63c8]"
                      : c.status === "Received"
                      ? "bg-[#dff8ed] text-[#137a4a]"
                      : c.status === "Closed"
                      ? "bg-[#ffe3e3] text-[#b42318]"
                      : c.status === "EnRoute"
                      ? "bg-[#fff4d6] text-[#9a6700]"
                      : c.status === "OnScene"
                      ? "bg-[#efe7ff] text-[#6941c6]"
                      : "bg-[#edf3f5] text-[#496574]"
                  }`}
                >
                  {c.status || "-"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.12em] text-[#7c8f99]">
                    Chief Complaint
                  </div>
                  <div className="mt-1 font-black text-[#123746]">
                    {c.chiefComplaint || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-black uppercase tracking-[0.12em] text-[#7c8f99]">
                    Project Name
                  </div>
                  <div className="mt-1 font-black text-[#123746]">
                    {c.projectName || "-"}
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <div className="text-xs font-black uppercase tracking-[0.12em] text-[#7c8f99]">
                    Location
                  </div>
                  <div className="mt-1 font-semibold text-[#274C5A]">
                    {c.locationText || c.pickupText || "-"}
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <div className="text-xs font-black uppercase tracking-[0.12em] text-[#7c8f99]">
                    Assigned Unit
                  </div>
                  <div className="mt-1 font-semibold text-[#274C5A]">
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
