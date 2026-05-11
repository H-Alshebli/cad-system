"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";

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

  if (!date || isNaN(date.getTime())) return "—";

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

  return map[status || ""] || status || "—";
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
    if (statusFilter === "active") return cases.filter((c) => c.status !== "Closed");
    if (statusFilter === "closed") return cases.filter((c) => c.status === "Closed");
    return cases.filter((c) => c.status === statusFilter);
  }, [cases, statusFilter]);

  if (userLoading || loading) {
    return <div className="p-6 text-slate-400">Loading cases...</div>;
  }

  return (
    <PermissionGuard module="client_cases" action="view_own" showMessage={true}>
      <div className="min-h-screen bg-[#030712] p-6 text-white">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Cases</h1>
            <p className="mt-1 text-sm text-slate-400">
              Track your submitted cases and requests.
            </p>
          </div>

          <Link
            href="/client/cases/new"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Create New Case
          </Link>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-800 bg-[#111827] p-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-[#0b1220] px-3 py-2 text-sm text-white"
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

        {filteredCases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            No cases found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredCases.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-800 bg-[#111827] p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {c.projectName || "Project"}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {formatDate(c.createdAt)}
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-300">
                    {clientStatus(c.status)}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                  <p>
                    <span className="text-slate-500">Caller:</span>{" "}
                    {c.callerName || "—"}
                  </p>

                  <p>
                    <span className="text-slate-500">Patient:</span>{" "}
                    {c.patientName || "—"}
                  </p>

                  <p>
                    <span className="text-slate-500">Complaint:</span>{" "}
                    {c.chiefComplaint || "—"}
                  </p>

                  <p>
                    <span className="text-slate-500">Location:</span>{" "}
                    {c.locationDescription || "—"}
                  </p>

                  {c.googleMapsLink && (
                    <a
                      href={c.googleMapsLink}
                      target="_blank"
                      className="inline-block text-sm text-blue-400 hover:underline"
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