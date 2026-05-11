"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";

type Project = {
  id: string;
  projectName?: string;
};

type CaseItem = {
  id: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  createdAt?: any;
  timeline?: Record<string, any>;
};

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

export default function ClientTimelineDashboardPage() {
  const { user, loading: userLoading } = useCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");

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
    if (!selectedProjectId) return cases;
    return cases.filter((c) => c.projectId === selectedProjectId);
  }, [cases, selectedProjectId]);

  const total = filteredCases.length;
  const active = filteredCases.filter((c) => c.status !== "Closed").length;
  const completed = filteredCases.filter((c) => c.status === "Closed").length;

  const byStatus = useMemo(() => {
    const result: Record<string, number> = {};

    filteredCases.forEach((c) => {
      const key = clientStatus(c.status);
      result[key] = (result[key] || 0) + 1;
    });

    return Object.entries(result).sort((a, b) => b[1] - a[1]);
  }, [filteredCases]);

  if (userLoading || loading) {
    return <div className="p-6 text-slate-400">Loading timeline dashboard...</div>;
  }

  return (
    <PermissionGuard module="client_dashboards" action="timeline" showMessage={true}>
      <div className="min-h-screen bg-[#030712] p-6 text-white">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Timeline Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Client-safe operational status dashboard.
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-800 bg-[#111827] p-4">
          <label className="mb-1 block text-xs text-slate-400">Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-[#0b1220] px-3 py-2 text-sm text-white"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectName || p.id}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Total Requests" value={total} />
          <Card title="Active Requests" value={active} />
          <Card title="Completed" value={completed} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
            <h2 className="mb-4 text-lg font-semibold">Cases by Status</h2>

            {byStatus.length === 0 ? (
              <div className="text-sm text-slate-400">No data.</div>
            ) : (
              <div className="space-y-3">
                {byStatus.map(([status, count]) => (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{status}</span>
                      <span className="text-slate-400">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${total ? Math.round((count / total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
            <h2 className="mb-4 text-lg font-semibold">Recent Timeline</h2>

            {filteredCases.slice(0, 8).length === 0 ? (
              <div className="text-sm text-slate-400">No cases found.</div>
            ) : (
              <div className="space-y-3">
                {filteredCases.slice(0, 8).map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-800 bg-[#0b1220] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {c.projectName || "Project"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {formatDate(c.createdAt)}
                        </div>
                      </div>

                      <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-300">
                        {clientStatus(c.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}