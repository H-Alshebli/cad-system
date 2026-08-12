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

export default function ProjectEpcrPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [epcrs, setEpcrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "epcr"),
      where("projectId", "==", params.projectId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setEpcrs(data);
      setLoading(false);
    });

    return () => unsub();
  }, [params.projectId]);

  if (loading) return <div className="p-6 text-sm font-semibold text-[#607482]">Loading ePCR records...</div>;

  return (
    <div className="space-y-5 text-[#274C5A]">
      <div className="rounded-2xl bg-[#274C5A] p-5 text-white shadow-lg shadow-[#274C5A]/15">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ee3ec]">Electronic Patient Care Reports</p>
        <h2 className="mt-2 text-2xl font-black">Project ePCR</h2>
        <p className="mt-1 text-sm font-medium text-white/75">Review the patient care reports recorded for this project.</p>
      </div>

      {epcrs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#b9d3da] bg-[#f7fbfc] p-8 text-center text-sm font-semibold text-[#607482]">
          No ePCR records for this project yet.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {epcrs.map((e) => (
          <Link
            key={e.id}
            href={`/epcr/${e.id}`}
            className="group block rounded-2xl border border-[#d8e6ea] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#74cdda] hover:shadow-md"
          >
            <div className="font-black text-[#274C5A] group-hover:text-[#166575]">
              Case: {e.caseId}
            </div>
            <div className="mt-2 text-sm font-semibold text-[#607482]">
              Created:{" "}
              {e.createdAt?.seconds
                ? new Date(
                    e.createdAt.seconds * 1000
                  ).toLocaleString()
                : "-"}
            </div>
            <div className="mt-4 text-xs font-black uppercase tracking-wide text-[#166575]">Open ePCR</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
