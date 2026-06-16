"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

function getDateValue(item: any) {
  const raw =
    item.createdAt ||
    item.timeline?.receivedAt ||
    item.requestedAt ||
    item.requestedTransportAt;

  return raw?.toDate?.() || (raw ? new Date(raw) : null);
}

function getB2CDateValue(item: any) {
  const raw = item.requestedTransportAt || item.createdAt;
  return raw?.toDate?.() || (raw ? new Date(raw) : null);
}

function formatDate(value: any) {
  if (!value) return "—";

  const date = value?.toDate?.() || new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function isUserAssignedToB2CRequest(request: any, user: any) {
  const assigned = Array.isArray(request?.plannedAssignment?.assignedUserIds)
    ? request.plannedAssignment.assignedUserIds
    : [];

  return Boolean(user?.uid && assigned.includes(user.uid));
}

function isUserAssignedToCase(item: any, user: any) {
  const assigned = Array.isArray(item.assignedUserIds)
    ? item.assignedUserIds
    : [];

  return Boolean(user?.uid && assigned.includes(user.uid));
}

function getPreparationStatus(request: any) {
  const acknowledgement = request?.preparationAcknowledgement || {};

  if (acknowledgement?.acknowledged) {
    return `Acknowledged by ${
      acknowledgement.acknowledgedByName ||
      request.preparationAcknowledgedByName ||
      "Team"
    }`;
  }

  return "Pending";
}

function getB2CRequestIdFromCase(item: any) {
  return item.sourceRequestId || item.b2cRequestId || item.b2cRequest?.id || "";
}

function isB2CCase(item: any) {
  const source = String(item.sourceType || item.caseType || "").toLowerCase();
  return source === "b2c" || Boolean(getB2CRequestIdFromCase(item));
}

function isClosedCase(item: any) {
  const status = String(item.status || item.dispatchStatus || "").toLowerCase();

  return (
    status === "closed" ||
    status === "completed" ||
    status === "cancelled"
  );
}

export default function MyMissionsPage() {
  const { user, loading } = useCurrentUser();

  const [cases, setCases] = useState<any[]>([]);
  const [b2cRequests, setB2CRequests] = useState<any[]>([]);
  const [showAllForTesting, setShowAllForTesting] = useState(false);
  const [showClosedMissions, setShowClosedMissions] = useState(false);

  useEffect(() => {
    const unsubCases = onSnapshot(collection(db, "cases"), (snap) => {
      setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubB2C = onSnapshot(collection(db, "b2cRequests"), (snap) => {
      setB2CRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCases();
      unsubB2C();
    };
  }, []);

  const normalizedRole = String(user?.role || "").toLowerCase();
  const isAdmin =
    normalizedRole === "admin" ||
    normalizedRole === "super_admin" ||
    normalizedRole === "superadmin";

  const upcomingB2CRequests = useMemo(() => {
    const list = b2cRequests.filter((request) => {
      if (request.requestStatus === "Cancelled") return false;
      if (request.requestStatus === "Rejected") return false;

      // If CAD already created, show it in Active CAD Missions section.
      if (request.cadCaseId) return false;

      if (showAllForTesting || isAdmin) return true;

      return isUserAssignedToB2CRequest(request, user);
    });

    return list.sort((a, b) => {
      const ad = getB2CDateValue(a)?.getTime?.() || 0;
      const bd = getB2CDateValue(b)?.getTime?.() || 0;
      return ad - bd;
    });
  }, [b2cRequests, showAllForTesting, isAdmin, user]);

  const activeMissions = useMemo(() => {
    const list = cases.filter((item) => {
      if (!showClosedMissions && isClosedCase(item)) return false;

      if (showAllForTesting || isAdmin) return true;

      return isUserAssignedToCase(item, user);
    });

    return list.sort((a, b) => {
      const ad = getDateValue(a)?.getTime?.() || 0;
      const bd = getDateValue(b)?.getTime?.() || 0;
      return bd - ad;
    });
  }, [cases, showAllForTesting, showClosedMissions, isAdmin, user]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading missions...</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        
          <h1 className="page-title">My Missions</h1>

          <p className="page-subtitle">
            Upcoming B2C requests appear here for preparation. Active CAD
            missions appear after Dispatch creates or activates the CAD case.
          </p>
        </div>

 
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">
              Upcoming B2C Requests
            </h2>

            <p className="text-sm text-slate-400">
              These requests are for preparation only. Click View Request to
              review and acknowledge the request.
            </p>
          </div>

          <span className="badge">{upcomingB2CRequests.length}</span>  
        </div>

        <div className="table-modern overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Pickup</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Transport Time</th>
                <th className="px-4 py-3">Ambulance</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Preparation</th>
                <th className="px-4 py-3">CAD Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {upcomingB2CRequests.map((request) => (
                <tr key={request.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-semibold text-white">
                    {request.bookingConfirmationNumber
                      ? `#${request.bookingConfirmationNumber}`
                      : request.id}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {request.patientName || "—"}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {request.pickupText || "—"}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {request.destinationText || "—"}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {formatDate(request.requestedTransportAt)}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {request.plannedAssignment?.unitCode ||
                      request.plannedAssignment?.unitName ||
                      request.plannedAssignment?.unitId ||
                      "—"}
                  </td>

                  <td className="px-4 py-3">
                    <span className="badge">
                      {request.paymentStatus || "Pending"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="badge">
                      {getPreparationStatus(request)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="badge">CAD Not Active</span>
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      className="btn-secondary"
                      href={`/b2c/requests/${request.id}`}
                    >
                      View Request
                    </Link>
                  </td>
                </tr>
              ))}

              {upcomingB2CRequests.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    No upcoming B2C requests assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">
              Active CAD Missions
            </h2>

            <p className="text-sm text-slate-400">
              These are active CAD cases assigned to your team. For B2C cases,
              you can still review the original request.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={showClosedMissions}
                onChange={(e) => setShowClosedMissions(e.target.checked)}
              />
              Show closed missions
            </label>

            <span className="badge">{activeMissions.length}</span>
          </div>
        </div>

        <div className="table-modern overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
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
              {activeMissions.map((item) => {
                const b2cRequestId = getB2CRequestIdFromCase(item);
                const showViewRequest = isB2CCase(item) && b2cRequestId;

                return (
                  <tr key={item.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-semibold text-white">
                      {item.lazemCode || item.caseNumber || item.id}
                    </td>

                    <td className="px-4 py-3">
                      <span className="badge">
                        {item.sourceType || item.caseType || "PROJECT"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {item.serviceType || item.chiefComplaint || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {item.pickup?.text ||
                        item.pickupText ||
                        item.location?.text ||
                        item.locationText ||
                        "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span className="badge">
                        {item.dispatchStatus || item.status || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {item.acknowledged
                        ? `Acknowledged by ${
                            item.acknowledgedByName ||
                            item.acknowledgedBy ||
                            "team"
                          }`
                        : "Not acknowledged"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {showViewRequest && (
                          <Link
                            className="btn-secondary"
                            href={`/b2c/requests/${b2cRequestId}`}
                          >
                            View Request
                          </Link>
                        )}

                        <Link
                          className="btn-secondary"
                          href={`/missions/${item.id}`}
                        >
                          Open Mission
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {activeMissions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    No active CAD missions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}