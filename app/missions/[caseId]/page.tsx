"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { acknowledgeCase } from "@/lib/cases";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function MissionAcknowledgePage({
  params,
}: {
  params: { caseId: string };
}) {
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

  const normalizedRole = String(user?.role || "").toLowerCase();

  const isAdminOrDispatch =
    normalizedRole === "admin" ||
    normalizedRole === "super_admin" ||
    normalizedRole === "superadmin" ||
    normalizedRole === "dispatcher" ||
    normalizedRole === "dispatch" ||
    normalizedRole === "operations" ||
    normalizedRole === "operations_manager";

  const assignedUserIds = Array.isArray(caseData?.assignedUserIds)
    ? caseData.assignedUserIds
    : [];

  const isAssignedToMission = Boolean(
    user?.uid && assignedUserIds.includes(user.uid)
  );

  const isAllowed = useMemo(() => {
    if (!user || !caseData) return false;
    if (isAdminOrDispatch) return true;
    return isAssignedToMission;
  }, [caseData, user, isAdminOrDispatch, isAssignedToMission]);

  const isB2C = String(caseData?.sourceType || caseData?.caseType || "")
    .toLowerCase()
    .includes("b2c");

  const b2cRequestId =
    caseData?.sourceRequestId ||
    caseData?.b2cRequestId ||
    caseData?.b2cRequest?.id ||
    "";

  const acknowledged =
    Boolean(caseData?.acknowledgement?.acknowledged) ||
    Boolean(caseData?.acknowledged);

  const detailsVisible = showDetails || acknowledged;

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

  if (loading || userLoading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading mission...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="page-shell">
        <div className="card-modern">Mission not found.</div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="page-shell">
        <div className="card-modern max-w-2xl">
          <h1 className="text-2xl font-bold text-white">Access denied</h1>

          <p className="mt-2 text-slate-400">
            You are not assigned to this mission and cannot view its details.
          </p>

          <Link className="btn-secondary mt-5" href="/missions">
            Back to My Missions
          </Link>
        </div>
      </div>
    );
  }

  const patientName =
    caseData.patientName ||
    caseData.patient?.name ||
    caseData.customerName ||
    "—";

  const customerName =
    caseData.customerName ||
    caseData.customer?.name ||
    caseData.callerName ||
    "—";

  const mobile =
    caseData.customerMobile ||
    caseData.contactNumber ||
    caseData.patient?.phone ||
    "—";

  const complaint =
    caseData.chiefComplaint ||
    caseData.caseInfo?.complaint ||
    caseData.diagnosisOrReason ||
    caseData.serviceType ||
    "—";

  const pickup =
    caseData.pickup?.text ||
    caseData.pickupText ||
    caseData.pickupLocation?.text ||
    caseData.location?.text ||
    caseData.locationText ||
    "—";

  const destination =
    caseData.destination?.text ||
    caseData.destinationText ||
    caseData.destinationLocation?.text ||
    caseData.destinationName ||
    "—";

  const unit =
    caseData.assignedUnit?.code ||
    caseData.assignedUnit?.unitCode ||
    caseData.assignedUnit?.id ||
    caseData.assignedAmbulanceCode ||
    caseData.ambulanceCode ||
    "—";

  const acknowledgedBy =
    caseData.acknowledgement?.acknowledgedByName ||
    caseData.acknowledgement?.acknowledgedBy ||
    caseData.acknowledgedByName ||
    caseData.acknowledgedBy ||
    "—";

  const acknowledgedAt =
    caseData.acknowledgement?.acknowledgedAt?.toDate?.()?.toLocaleString?.() ||
    caseData.acknowledgedAt?.toDate?.()?.toLocaleString?.() ||
    "—";

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mission Acknowledgement</h1>

          <p className="page-subtitle">
            This page confirms that the team received the active CAD mission
            before opening the full CAD details.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/missions">
            My Missions
          </Link>

          {isB2C && b2cRequestId && (
            <Link className="btn-secondary" href={`/b2c/requests/${b2cRequestId}`}>
              View Original Request
            </Link>
          )}
        </div>
      </div>

      {!detailsVisible ? (
        <div className="card-modern max-w-3xl">
          <span className="badge">Active CAD Mission</span>

          <h2 className="mt-4 text-2xl font-bold text-white">
            Case {caseData.lazemCode || caseData.caseNumber || caseData.id}
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            {isB2C ? customerName : caseData.projectName || "Project Case"}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-300 md:grid-cols-2">
            <p>
              <span className="text-slate-500">Source:</span>{" "}
              {caseData.sourceType || caseData.caseType || "PROJECT"}
            </p>

            <p>
              <span className="text-slate-500">Service:</span> {complaint}
            </p>

            <p>
              <span className="text-slate-500">Patient:</span> {patientName}
            </p>

            <p>
              <span className="text-slate-500">Mobile:</span> {mobile}
            </p>

            <p>
              <span className="text-slate-500">Pickup:</span> {pickup}
            </p>

            <p>
              <span className="text-slate-500">Destination:</span> {destination}
            </p>

            <p>
              <span className="text-slate-500">Unit:</span> {unit}
            </p>

            <p>
              <span className="text-slate-500">Status:</span>{" "}
              {caseData.dispatchStatus || caseData.status || "—"}
            </p>
          </div>

          <p className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
            By clicking the button below, the system will record that you
            received this active CAD mission. After acknowledgement, you can open
            the full CAD case details.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {isB2C && b2cRequestId && (
              <Link
                className="btn-secondary"
                href={`/b2c/requests/${b2cRequestId}`}
              >
                View Original Request
              </Link>
            )}

            <button
              className="btn-primary"
              disabled={ackLoading}
              onClick={acknowledgeAndView}
            >
              {ackLoading
                ? "Acknowledging..."
                : "Acknowledge & Open CAD / استلام وفتح الحالة"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="card-modern space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Case {caseData.lazemCode || caseData.caseNumber || caseData.id}
                </h2>

                <p className="text-sm text-slate-400">
                  {isB2C ? customerName : caseData.projectName || "Project Case"}
                </p>
              </div>

              <span className="badge">
                {caseData.dispatchStatus || caseData.status || "—"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="text-slate-500">Patient:</span> {patientName}
              </p>

              <p>
                <span className="text-slate-500">Complaint:</span> {complaint}
              </p>

              <p>
                <span className="text-slate-500">Pickup:</span> {pickup}
              </p>

              <p>
                <span className="text-slate-500">Destination:</span>{" "}
                {destination}
              </p>

              <p>
                <span className="text-slate-500">Mobile:</span> {mobile}
              </p>

              <p>
                <span className="text-slate-500">Unit:</span> {unit}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="font-semibold text-white">Notes</h3>

              <p className="mt-2 text-sm text-slate-300">
                {caseData.notes || caseData.paramedicNote || "No notes."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isB2C && b2cRequestId && (
                <Link
                  className="btn-secondary"
                  href={`/b2c/requests/${b2cRequestId}`}
                >
                  View Original Request
                </Link>
              )}

              <Link className="btn-primary" href={`/cases/${caseData.id}`}>
                Open Full CAD Details
              </Link>
            </div>
          </div>

          <div className="card-modern">
            <h3 className="text-lg font-semibold text-white">
              Mission Acknowledgement
            </h3>

            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>
                <span className="text-slate-500">Acknowledged:</span>{" "}
                {acknowledged ? "Yes" : "No"}
              </p>

              <p>
                <span className="text-slate-500">By:</span> {acknowledgedBy}
              </p>

              <p>
                <span className="text-slate-500">At:</span> {acknowledgedAt}
              </p>
            </div>

            {isB2C && b2cRequestId && (
              <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                This CAD mission came from a B2C request. Use “View Original
                Request” if you need the full booking and preparation details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}