"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";

type Project = {
  id: string;
  projectName?: string;
  client?: string;
  status?: string;
};

type CaseItem = {
  id: string;
  projectId?: string;
  projectName?: string;
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

export default function ClientHomePage() {
  const { user, loading: userLoading } = useCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);

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

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setProjects(list);
        setLoading(false);
      },
      (error) => {
        console.error("Client projects error:", error);
        setLoading(false);
      }
    );

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

  const activeCases = cases.filter((c) => c.status !== "Closed").length;
  const closedCases = cases.filter((c) => c.status === "Closed").length;
  const recentCases = cases.slice(0, 5);

  if (userLoading || loading) {
    return <div className="p-6 text-slate-400">Loading client portal...</div>;
  }

  return (
    <PermissionGuard module="client_portal" action="view" showMessage={true}>
      <div className="min-h-screen bg-[#030712] p-6 text-white">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Client Portal</h1>
          <p className="mt-1 text-sm text-slate-400">
            Create and track your medical service requests.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card title="Assigned Projects" value={projects.length} />
          <Card title="Total Cases" value={cases.length} />
          <Card title="Active Cases" value={activeCases} />
          <Card title="Completed" value={closedCases} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 xl:col-span-1">
            <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>

            <div className="space-y-2">
              <Link
                href="/client/cases/new"
                className="block rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold hover:bg-blue-700"
              >
                Create New Case
              </Link>

              <Link
                href="/client/cases"
                className="block rounded-lg border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-200 hover:bg-white/5"
              >
                View My Cases
              </Link>

              <Link
                href="/client/dashboard/timeline"
                className="block rounded-lg border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-200 hover:bg-white/5"
              >
                Timeline Dashboard
              </Link>

              <Link
                href="/client/dashboard/epcr"
                className="block rounded-lg border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-200 hover:bg-white/5"
              >
                ePCR Dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 xl:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">Recent Cases</h2>

            {recentCases.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                No cases submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentCases.map((c) => (
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
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
    </div>
  );
}