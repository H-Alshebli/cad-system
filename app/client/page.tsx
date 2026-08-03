"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import PermissionGuard from "@/app/components/PermissionGuard";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

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
    return (
      <div className="p-6">
        <div className="card-modern text-sm font-semibold text-[#274C5A]">
          Loading client portal...
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard module="client_portal" action="view" showMessage={true}>
      <div className="page-shell p-6">
        <div className="page-header">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#74cdda]">
              Client Portal
            </p>
            <h1 className="page-title">Client Portal</h1>
            <p className="page-subtitle mt-1">
              Create and track your medical service requests.
            </p>
          </div>

          <Link href="/client/cases/new" className="btn-primary">
            Create New Case
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card title="Assigned Projects" value={projects.length} />
          <Card title="Total Cases" value={cases.length} />
          <Card title="Active Cases" value={activeCases} />
          <Card title="Completed" value={closedCases} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="card-modern xl:col-span-1">
            <h2 className="mb-3 text-lg font-black text-[#123746]">
              Quick Actions
            </h2>

            <div className="space-y-2">
              <Link href="/client/cases/new" className="btn-primary w-full">
                Create New Case
              </Link>

              <Link href="/client/cases" className="btn-secondary w-full">
                View My Cases
              </Link>

              <Link
                href="/client/dashboard/timeline"
                className="btn-secondary w-full"
              >
                Timeline Dashboard
              </Link>

              <Link
                href="/client/dashboard/epcr"
                className="btn-secondary w-full"
              >
                ePCR Dashboard
              </Link>
            </div>
          </div>

          <div className="card-modern xl:col-span-2">
            <h2 className="mb-3 text-lg font-black text-[#123746]">
              Recent Cases
            </h2>

            {recentCases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#c8dce2] bg-[#f7fbfc] p-6 text-center text-sm font-semibold text-[#607482]">
                No cases submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentCases.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black text-[#123746]">
                          {c.projectName || "Project"}
                        </div>
                        <div className="text-xs font-semibold text-[#607482]">
                          {formatDate(c.createdAt)}
                        </div>
                      </div>

                      <span className="rounded-full border border-[#274C5A]/20 bg-[#274C5A]/10 px-3 py-1 text-xs font-black text-[#274C5A]">
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
    <div className="card-modern">
      <div className="text-sm font-semibold text-[#607482]">{title}</div>
      <div className="mt-2 text-3xl font-black text-[#123746]">{value}</div>
    </div>
  );
}
