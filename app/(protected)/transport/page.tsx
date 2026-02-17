// app/(protected)/transport/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TransportRequest, TransportStatus } from "./types";
import { STATUS_LABEL } from "./constants";
import { selectClass } from "./ui";

function getRejectedLabel(x: TransportRequest): string {
  const status = x.status as TransportStatus;

  if (status !== "rejected") return STATUS_LABEL[status] || "—";

  const opsRejectNote = (x as any).opsDecisionNote?.trim?.() || "";
  const salesRejectNote = (x as any).salesRejectNote?.trim?.() || "";

  const salesRejected = !!((x as any).salesRejectedAt || salesRejectNote);
  const opsRejected = !!(opsRejectNote); // ✅ note is required for ops reject in your UI

  if (salesRejected) return "Rejected (Sales)";
  if (opsRejected) return "Rejected (Ops)";

  return STATUS_LABEL.rejected; // fallback
}


export default function TransportListPage() {
  const [items, setItems] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TransportStatus | "all">("all");

  useEffect(() => {
    const q = query(collection(db, "transport_requests"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: TransportRequest[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setItems(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((x) => x.status === statusFilter);
  }, [items, statusFilter]);

  return (
    <div className="p-6 text-white">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transport Requests</h1>
          <p className="text-sm text-white/70">
            Phase 1 only: Request → Ops (Available/Reject) → Client Approval → Assignment
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={selectClass}
          >
            <option value="all">All statuses</option>
            <option value="new">{STATUS_LABEL.new}</option>
            <option value="ops_available">{STATUS_LABEL.ops_available}</option>
            <option value="rejected">{STATUS_LABEL.rejected}</option>
            <option value="client_approved">{STATUS_LABEL.client_approved}</option>
            <option value="assigned">{STATUS_LABEL.assigned}</option>
          </select>

          <Link
            href="/transport/new"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/15 hover:bg-white/15"
          >
            New Request
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-white/10">
        <div className="grid grid-cols-12 gap-0 bg-white/5 px-4 py-3 text-xs font-semibold text-white/80">
          <div className="col-span-3">Service Type</div>
          <div className="col-span-3">Time</div>
          <div className="col-span-2">City Scope</div>
          <div className="col-span-2">City</div>
          <div className="col-span-2">Status</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-white/70">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/70">No transport requests yet.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((x) => (
              <Link
                key={x.id}
                href={`/transport/${x.id}`}
                className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-white/5"
              >
                <div className="col-span-3">
                  <div className="font-medium">{x.serviceType || "—"}</div>
                  <div className="text-xs text-white/60 line-clamp-1">{x.requirements || ""}</div>
                </div>

                <div className="col-span-3 text-white/80">
                  {x.serviceTime ? new Date(x.serviceTime).toLocaleString() : "—"}
                </div>

                <div className="col-span-2 text-white/80">
                  {x.cityScope === "inside" ? "Inside City" : "Outside City"}
                </div>

                <div className="col-span-2 text-white/80">{x.cityName || "—"}</div>

             <div className="col-span-2">
  <span className="rounded-full bg-white/10 px-2 py-1 text-xs ring-1 ring-white/10">
    {getRejectedLabel(x)}
  </span>
</div>

              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
