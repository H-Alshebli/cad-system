"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  Ambulance,
  ArrowRight,
  CalendarClock,
  CreditCard,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  canCreateCadCase,
  createCadCaseFromB2CRequest,
  isWithinOneHour,
} from "@/lib/b2cRequests";

export default function B2CRequestDetailsPage({
  params,
}: {
  params: { requestId: string };
}) {
  const router = useRouter();
  const requestId = params.requestId;

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creatingCad, setCreatingCad] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "b2cRequests", requestId), (snap) => {
      if (!snap.exists()) {
        setRequest(null);
        setLoading(false);
        return;
      }

      setRequest({ id: snap.id, ...snap.data() });
      setLoading(false);
    });

    return () => unsub();
  }, [requestId]);

  async function handleCreateCad() {
    if (!request) return;

    setCreatingCad(true);

    try {
      const caseId = await createCadCaseFromB2CRequest(request.id, "dispatch");
      router.push(`/cases/${caseId}`);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to create CAD case.");
    } finally {
      setCreatingCad(false);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading request...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="page-shell">
        <div className="card-modern text-red-500">Request not found.</div>
      </div>
    );
  }

  const cadReady = canCreateCadCase(request);
  const withinOneHour = isWithinOneHour(request);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="badge mb-3">B2C Request</div>

          <h1 className="page-title">
            Request #{request.bookingConfirmationNumber || request.id}
          </h1>

          <p className="page-subtitle">
            This page is for request follow-up before the CAD case becomes active.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {request.cadCaseId && (
            <button
              className="btn-primary"
              onClick={() => router.push(`/cases/${request.cadCaseId}`)}
            >
              Open CAD Case
            </button>
          )}

          {!request.cadCaseId && cadReady && (
            <button
              className="btn-primary"
              disabled={creatingCad}
              onClick={handleCreateCad}
            >
              {creatingCad ? "Creating CAD..." : "Create CAD Case"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Section title="Customer & Patient" icon={<UserRound size={18} />}>
            <Info label="Customer Name" value={request.customerName} />
            <Info label="Customer Mobile" value={request.customerMobile} />
            <Info label="Patient Name" value={request.patientName} />
            <Info label="Age" value={request.patientAge} />
            <Info label="Gender" value={request.patientGender} />
            <Info label="ID / Iqama" value={request.patientIdOrIqama} />
          </Section>

          <Section title="Trip Details" icon={<MapPin size={18} />}>
            <Info label="Request Type" value={request.requestType} />
            <Info label="Transport Date / Time" value={request.requestedTransportAt} />
            <Info label="Pickup" value={request.pickupText} />
            <Info label="Pickup Link" value={request.pickupMapLink} />
            <Info label="Pickup Floor" value={request.pickupFloor} />
            <Info label="Destination" value={request.destinationText} />
            <Info label="Destination Link" value={request.destinationMapLink} />
            <Info label="Destination Floor" value={request.destinationFloor} />
          </Section>

          <Section title="Clinical & Operational Screening" icon={<ShieldCheck size={18} />}>
            <Info label="Patient Stability" value={request.patientStability} />
            <Info label="Transport Level" value={request.transportLevel} />
            <Info label="Mobility" value={request.mobility} />
            <Info
              label="Special Requirements"
              value={
                Array.isArray(request.specialRequirements)
                  ? request.specialRequirements.join(", ")
                  : request.specialRequirements
              }
            />
            <Info label="Diagnosis / Reason" value={request.diagnosisOrReason} />
            <Info label="Operational Decision" value={request.operationalDecision} />
            <Info label="Rejection Reason" value={request.rejectionReason} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Request Status" icon={<CalendarClock size={18} />}>
            <StatusBadge label="Request Status" value={request.requestStatus} />
            <StatusBadge label="Payment Status" value={request.paymentStatus} />
            <StatusBadge
              label="CAD Status"
              value={request.cadCaseId ? "CAD Created" : "Not Created"}
            />

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              {request.cadCaseId
                ? "CAD case is already created."
                : cadReady
                ? "This request is ready to create CAD case."
                : "CAD is locked until payment is paid and request is approved."}
            </div>

            {!request.cadCaseId && withinOneHour && cadReady && (
              <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-700 dark:text-amber-200">
                This trip is within one hour. CAD should be activated now.
              </div>
            )}
          </Section>

          <Section title="Payment" icon={<CreditCard size={18} />}>
            <Info label="Price" value={request.price ? `${request.price} SAR` : "—"} />
            <Info label="Payer" value={request.payer} />
            <Info label="Payment Link Sent At" value={request.paymentLinkSentAt} />
            <Info label="Customer Approved Price" value={request.customerApprovedPrice} />
          </Section>

          <Section title="Planned Assignment" icon={<Ambulance size={18} />}>
            <Info
              label="Unit"
              value={
                request.plannedAssignment?.unitCode ||
                request.plannedAssignment?.unitId ||
                "—"
              }
            />
            <Info
              label="Team Group"
              value={request.plannedAssignment?.assignedTeamGroup || "—"}
            />
            <Info
              label="Assigned Users"
              value={
                Array.isArray(request.plannedAssignment?.assignedUserIds)
                  ? request.plannedAssignment.assignedUserIds.join(", ")
                  : "—"
              }
            />

            {request.cadCaseId ? (
              <button
                className="btn-primary mt-4 w-full"
                onClick={() => router.push(`/cases/${request.cadCaseId}`)}
              >
                Open CAD Case
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="btn-primary mt-4 w-full"
                disabled={!cadReady || creatingCad}
                onClick={handleCreateCad}
              >
                {creatingCad ? "Creating CAD..." : "Create CAD Case"}
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card-modern">
      <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
        <span className="text-blue-500">{icon}</span>
        {title}
      </div>

      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
        {value || "—"}
      </div>
    </div>
  );
}

function StatusBadge({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-300">
        {value || "—"}
      </span>
    </div>
  );
}