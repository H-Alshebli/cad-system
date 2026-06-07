"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  Ambulance,
  CalendarClock,
  CreditCard,
  FileText,
  Search,
  UserRound,
} from "lucide-react";

import { db } from "@/lib/firebase";

export default function B2CRequestsPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "b2cRequests"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setRequests(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredRequests = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return requests
      .filter((request) => {
        if (statusFilter !== "All" && request.requestStatus !== statusFilter) {
          return false;
        }

        if (paymentFilter !== "All" && request.paymentStatus !== paymentFilter) {
          return false;
        }

        if (!searchValue) return true;

        const searchableText = [
          request.id,
          request.bookingConfirmationNumber,
          request.customerName,
          request.customerMobile,
          request.patientName,
          request.pickupText,
          request.destinationText,
          request.plannedAssignment?.unitCode,
          request.requestStatus,
          request.paymentStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchValue);
      })
      .sort((a, b) => {
        const aTime = getDateValue(a.requestedTransportAt || a.createdAt);
        const bTime = getDateValue(b.requestedTransportAt || b.createdAt);

        return bTime - aTime;
      });
  }, [requests, search, statusFilter, paymentFilter]);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pendingPayment: requests.filter(
        (r) => r.requestStatus === "PendingPayment"
      ).length,
      confirmed: requests.filter((r) => r.requestStatus === "Confirmed").length,
      readyToActivate: requests.filter(
        (r) => r.requestStatus === "ReadyToActivate"
      ).length,
      cadCreated: requests.filter((r) => r.requestStatus === "CadCreated")
        .length,
    };
  }, [requests]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading B2C requests...</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="badge mb-3">B2C Requests</div>

          <h1 className="page-title">B2C Request Management</h1>

          <p className="page-subtitle">
            Review individual customer requests before they become active CAD
            cases. Open a request to update payment, edit details, change the
            planned ambulance/team, or create CAD.
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => router.push("/b2c/cases/new")}
        >
          New B2C Request
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Requests" value={stats.total} />
        <StatCard label="Pending Payment" value={stats.pendingPayment} />
        <StatCard label="Confirmed" value={stats.confirmed} />
        <StatCard label="Ready to Activate" value={stats.readyToActivate} />
        <StatCard label="CAD Created" value={stats.cadCreated} />
      </div>

      <div className="card-modern">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px_220px]">
          <div>
            <label className="field-label">Search</label>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                className="input pl-10"
                placeholder="Search by customer, patient, mobile, booking number, ambulance..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="field-label">Request Status</label>

            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All</option>
              <option>PendingPayment</option>
              <option>Paid</option>
              <option>Confirmed</option>
              <option>ReadyToActivate</option>
              <option>CadCreated</option>
              <option>Rejected</option>
              <option>Cancelled</option>
            </select>
          </div>

          <div>
            <label className="field-label">Payment Status</label>

            <select
              className="select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option>All</option>
              <option>Pending</option>
              <option>Paid</option>
            </select>
          </div>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="card-modern text-slate-500 dark:text-slate-400">
          No B2C requests found.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <button
              key={request.id}
              onClick={() => router.push(`/b2c/requests/${request.id}`)}
              className="card-modern w-full text-left transition hover:border-blue-500/40 hover:shadow-blue-950/10"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="badge">
                      {request.requestStatus || "Unknown"}
                    </span>

                    <span
                      className={
                        request.paymentStatus === "Paid"
                          ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300"
                          : "rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-700 dark:text-amber-300"
                      }
                    >
                      {request.paymentStatus || "Pending"}
                    </span>

                    <span
                      className={
                        request.cadCaseId
                          ? "rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-300"
                          : "rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-xs font-black text-slate-600 dark:text-slate-300"
                      }
                    >
                      {request.cadCaseId ? "CAD Created" : "CAD Not Created"}
                    </span>
                  </div>

                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {request.bookingConfirmationNumber
                      ? `Booking #${request.bookingConfirmationNumber}`
                      : `Request #${request.id}`}
                  </h2>

                  <div className="mt-2 grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4 dark:text-slate-300">
                    <InfoLine
                      icon={<UserRound size={15} />}
                      label="Customer"
                      value={request.customerName}
                    />

                    <InfoLine
                      icon={<UserRound size={15} />}
                      label="Patient"
                      value={request.patientName}
                    />

                    <InfoLine
                      icon={<CalendarClock size={15} />}
                      label="Trip Time"
                      value={formatDate(request.requestedTransportAt)}
                    />

                    <InfoLine
                      icon={<Ambulance size={15} />}
                      label="Ambulance"
                      value={
                        request.plannedAssignment?.unitCode ||
                        request.plannedAssignment?.unitId ||
                        "—"
                      }
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-500 md:grid-cols-2 dark:text-slate-400">
                    <InfoLine
                      icon={<FileText size={15} />}
                      label="Pickup"
                      value={request.pickupText}
                    />

                    <InfoLine
                      icon={<FileText size={15} />}
                      label="Destination"
                      value={request.destinationText}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2 xl:w-48">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <CreditCard size={14} />
                      Payment
                    </div>

                    <div className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                      {request.price ? `${request.price} SAR` : "—"}
                    </div>
                  </div>

                  <div className="btn-secondary w-full justify-center">
                    Open Request
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-modern">
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: any;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 text-blue-500">{icon}</span>

      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {label}
        </div>

        <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function getDateValue(value: any) {
  if (!value) return 0;

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  return 0;
}

function formatDate(value: any) {
  const timestamp = getDateValue(value);

  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleString();
}