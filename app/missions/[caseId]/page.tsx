"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { acknowledgeCase } from "@/lib/cases";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function MissionAcknowledgePage({ params }: { params: { caseId: string } }) {
  const { user, loading: userLoading } = useCurrentUser();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cases", params.caseId), (snap) => {
      setCaseData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    return () => unsub();
  }, [params.caseId]);

  const isAllowed = useMemo(() => {
    if (!user || !caseData) return false;
    if (["admin", "dispatcher", "dispatch", "operations_manager"].includes(user.role)) return true;
    const assigned = Array.isArray(caseData.assignedUserIds) ? caseData.assignedUserIds : [];
    return assigned.includes(user.uid);
  }, [caseData, user]);

  async function acknowledgeAndView() {
    if (!caseData || !user) return;
    setAckLoading(true);
    try {
      await acknowledgeCase(caseData.id, user);
      setShowDetails(true);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to acknowledge mission");
    } finally {
      setAckLoading(false);
    }
  }

  if (loading || userLoading) return <div className="page-shell"><div className="card-modern">Loading mission...</div></div>;
  if (!caseData) return <div className="page-shell"><div className="card-modern">Mission not found.</div></div>;

  if (!isAllowed) {
    return (
      <div className="page-shell">
        <div className="card-modern max-w-2xl">
          <h1 className="text-2xl font-bold text-white">Access denied</h1>
          <p className="mt-2 text-slate-400">You are not assigned to this mission and cannot view its details.</p>
          <Link className="btn-secondary mt-5" href="/missions">Back to My Missions</Link>
        </div>
      </div>
    );
  }

  const detailsVisible = showDetails || caseData.acknowledged;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mission Link</h1>
          <p className="page-subtitle">Secure mission page. Details are shown only to assigned users after acknowledgement.</p>
        </div>
        <Link className="btn-secondary" href="/missions">My Missions</Link>
      </div>

      {!detailsVisible ? (
        <div className="card-modern max-w-3xl">
          <span className="badge">New mission assigned</span>
          <h2 className="mt-4 text-2xl font-bold text-white">Case {caseData.lazemCode || caseData.id}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-300 md:grid-cols-2">
            <p><span className="text-slate-500">Source:</span> {caseData.sourceType || "PROJECT"}</p>
            <p><span className="text-slate-500">Service:</span> {caseData.serviceType || caseData.chiefComplaint || "—"}</p>
            <p><span className="text-slate-500">Unit:</span> {caseData.assignedUnit?.code || caseData.assignedUnit?.id || "—"}</p>
            <p><span className="text-slate-500">Status:</span> {caseData.status || "—"}</p>
          </div>
          <p className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
            By clicking the button below, the system will record that you received this mission and then show the full case details.
          </p>
          <button className="btn-primary mt-5 w-full md:w-auto" disabled={ackLoading} onClick={acknowledgeAndView}>
            {ackLoading ? "Opening..." : "Acknowledge & View Case / استلام وعرض الطلب"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="card-modern space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Case {caseData.lazemCode || caseData.id}</h2>
                <p className="text-sm text-slate-400">{caseData.sourceType === "B2C" ? caseData.customerName : caseData.projectName}</p>
              </div>
              <span className="badge">{caseData.dispatchStatus || caseData.status}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <p><span className="text-slate-500">Patient:</span> {caseData.patientName || "—"}</p>
              <p><span className="text-slate-500">Complaint:</span> {caseData.chiefComplaint || "—"}</p>
              <p><span className="text-slate-500">Pickup:</span> {caseData.pickup?.text || caseData.location?.text || caseData.locationText || "—"}</p>
              <p><span className="text-slate-500">Destination:</span> {caseData.destination?.text || caseData.destinationName || "—"}</p>
              <p><span className="text-slate-500">Mobile:</span> {caseData.customerMobile || caseData.contactNumber || "—"}</p>
              <p><span className="text-slate-500">Unit:</span> {caseData.assignedUnit?.code || caseData.assignedUnit?.id || "—"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="font-semibold text-white">Notes</h3>
              <p className="mt-2 text-sm text-slate-300">{caseData.notes || caseData.paramedicNote || "No notes."}</p>
            </div>
            <Link className="btn-primary" href={`/cases/${caseData.id}`}>Open Full Case Details</Link>
          </div>

          <div className="card-modern">
            <h3 className="text-lg font-semibold text-white">Acknowledgement</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Acknowledged:</span> {caseData.acknowledged ? "Yes" : "No"}</p>
              <p><span className="text-slate-500">By:</span> {caseData.acknowledgedByName || caseData.acknowledgedBy || "—"}</p>
              <p><span className="text-slate-500">At:</span> {caseData.acknowledgedAt?.toDate?.()?.toLocaleString?.() || "—"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
