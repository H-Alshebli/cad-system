"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

function getDateValue(item: any) {
  const raw = item.createdAt || item.timeline?.receivedAt || item.requestedAt;
  return raw?.toDate?.() || (raw ? new Date(raw) : null);
}

export default function MyMissionsPage() {
  const { user, loading } = useCurrentUser();
  const [cases, setCases] = useState<any[]>([]);
  const [showAllForTesting, setShowAllForTesting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cases"), (snap) => {
      setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const missions = useMemo(() => {
    const list = cases.filter((c) => {
      if (showAllForTesting || user?.role === "admin") return true;
      const assigned = Array.isArray(c.assignedUserIds) ? c.assignedUserIds : [];
      return user?.uid && assigned.includes(user.uid);
    });

    return list.sort((a, b) => {
      const ad = getDateValue(a)?.getTime?.() || 0;
      const bd = getDateValue(b)?.getTime?.() || 0;
      return bd - ad;
    });
  }, [cases, showAllForTesting, user]);

  if (loading) return <div className="page-shell"><div className="card-modern">Loading missions...</div></div>;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Missions</h1>
          <p className="page-subtitle">Assigned project and B2C cases appear here. The paramedic does not need to enter the project page.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={showAllForTesting} onChange={(e) => setShowAllForTesting(e.target.checked)} />
          Show all for local testing
        </label>
      </div>

      <div className="table-modern overflow-x-auto">
        <table className="w-full min-w-[950px] text-left">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Service / Complaint</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Acknowledgement</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {missions.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-semibold text-white">{item.lazemCode || item.id}</td>
                <td className="px-4 py-3"><span className="badge">{item.sourceType || "PROJECT"}</span></td>
                <td className="px-4 py-3 text-slate-300">{item.serviceType || item.chiefComplaint || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{item.pickup?.text || item.location?.text || item.locationText || "—"}</td>
                <td className="px-4 py-3"><span className="badge">{item.dispatchStatus || item.status || "—"}</span></td>
                <td className="px-4 py-3 text-slate-300">{item.acknowledged ? `Acknowledged by ${item.acknowledgedByName || item.acknowledgedBy || "team"}` : "Not acknowledged"}</td>
                <td className="px-4 py-3">
                  <Link className="btn-secondary" href={`/missions/${item.id}`}>Open Mission</Link>
                </td>
              </tr>
            ))}
            {missions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No assigned missions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
