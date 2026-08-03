"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";

import PermissionGuard from "@/app/components/PermissionGuard";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

type Project = {
  id: string;
  projectName?: string;
  client?: string;
};

type CaseItem = {
  id: string;
  projectId?: string;
  projectName?: string;
  patientName?: string;
  callerName?: string;
  chiefComplaint?: string;
  locationDescription?: string;
  googleMapsLink?: string;
  status?: string;
  createdAt?: any;
};

function formatDate(value: any) {
  const date =
    value?.toDate?.() instanceof Date
      ? value.toDate()
      : value
        ? new Date(value)
        : null;

  if (!date || Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clientStatus(status?: string) {
  const map: Record<string, string> = {
    Received: "Request received",
    Assigned: "Team assigned",
    EnRoute: "Team on the way",
    OnScene: "Team arrived",
    Transporting: "Transporting patient",
    Hospital: "Arrived at destination",
    Closed: "Completed",
  };

  return map[status || ""] || status || "-";
}

export default function ClientCasesPage() {
  const { user, loading: userLoading } = useCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

  useEffect(() => {
    if (userLoading) return;

    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "projects"),
      where("clientUserIds", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setProjects(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid, userLoading]);

  useEffect(() => {
    if (projectIds.length === 0) {
      setCases([]);
      return;
    }

    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += 10) {
      chunks.push(projectIds.slice(i, i + 10));
    }

    const unsubs = chunks.map((ids) => {
      const q = query(collection(db, "cases"), where("projectId", "in", ids));

      return onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setCases((prev) => {
          const other = prev.filter((c) => !ids.includes(c.projectId || ""));
          const merged = [...other, ...list];

          return merged.sort((a, b) => {
            const ta = a.createdAt?.toDate?.()?.getTime?.() || 0;
            const tb = b.createdAt?.toDate?.()?.getTime?.() || 0;
            return tb - ta;
          });
        });
      });
    });

    return () => unsubs.forEach((unsub) => unsub());
  }, [projectIds.join("|")]);

  const filteredCases = useMemo(() => {
    if (statusFilter === "all") return cases;
    if (statusFilter === "active") {
      return cases.filter((c) => c.status !== "Closed");
    }
    if (statusFilter === "closed") {
      return cases.filter((c) => c.status === "Closed");
    }
    return cases.filter((c) => c.status === statusFilter);
  }, [cases, statusFilter]);

  if (userLoading || loading) {
    return (
      <div className="p-6">
        <div className="card-modern text-sm font-semibold text-[#274C5A]">
          Loading cases...
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard module="client_cases" action="view_own" showMessage={true}>
      <div className="page-shell p-6">
        <div className="page-header">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#74cdda]">
              Client Cases
            </p>
            <h1 className="page-title">My Cases</h1>
            <p className="page-subtitle mt-1">
              Track your submitted cases and requests.
            </p>
          </div>

          <Link href="/client/cases/new" className="btn-primary">
            Create New Case
          </Link>
        </div>

        <div className="card-modern">
          <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-end">
            <div>
              <label className="field-label">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select"
              >
                <option value="all">All cases</option>
                <option value="active">Active only</option>
                <option value="closed">Completed only</option>
                <option value="Received">Request received</option>
                <option value="Assigned">Team assigned</option>
                <option value="EnRoute">Team on the way</option>
                <option value="OnScene">Team arrived</option>
                <option value="Transporting">Transporting</option>
                <option value="Hospital">Arrived at destination</option>
              </select>
            </div>
            <p className="text-sm font-semibold text-[#607482]">
              Showing {filteredCases.length} of {cases.length} case
              {cases.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {filteredCases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#c8dce2] bg-white p-8 text-center text-sm font-semibold text-[#607482] shadow-sm">
            No cases found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredCases.map((c) => (
              <div key={c.id} className="card-modern">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-[#123746]">
                      {c.projectName || "Project"}
                    </h2>
                    <p className="text-xs font-semibold text-[#607482]">
                      {formatDate(c.createdAt)}
                    </p>
                  </div>

                  <span className="rounded-full border border-[#274C5A]/20 bg-[#274C5A]/10 px-3 py-1 text-xs font-black text-[#274C5A]">
                    {clientStatus(c.status)}
                  </span>
                </div>

                <div className="space-y-2 text-sm font-semibold text-[#274C5A]">
                  <p>
                    <span className="text-[#8aa0aa]">Caller:</span>{" "}
                    {c.callerName || "-"}
                  </p>

                  <p>
                    <span className="text-[#8aa0aa]">Patient:</span>{" "}
                    {c.patientName || "-"}
                  </p>

                  <p>
                    <span className="text-[#8aa0aa]">Complaint:</span>{" "}
                    {c.chiefComplaint || "-"}
                  </p>

                  <p>
                    <span className="text-[#8aa0aa]">Location:</span>{" "}
                    {c.locationDescription || "-"}
                  </p>

                  {c.googleMapsLink && (
                    <a
                      href={c.googleMapsLink}
                      target="_blank"
                      className="inline-block text-sm font-bold text-[#274C5A] underline"
                    >
                      Open Location
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
