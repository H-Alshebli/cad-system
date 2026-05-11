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

type EpcrItem = {
  id: string;
  projectId?: string;
  projectName?: string;
  projectInfo?: {
    id?: string;
    projectId?: string;
    projectName?: string;
  };
  triage?: string;
  triageLevel?: string;
  gender?: string;
  patientGender?: string;
  chiefComplaint?: string;
  healthClassification?: string;
  createdAt?: any;
};

function getProjectId(e: EpcrItem) {
  return e.projectId || e.projectInfo?.id || e.projectInfo?.projectId || "";
}

function getGender(e: EpcrItem) {
  return String(e.gender || e.patientGender || "Unspecified");
}

function getTriage(e: EpcrItem) {
  return String(e.triage || e.triageLevel || "Unspecified");
}

function getComplaint(e: EpcrItem) {
  return String(e.chiefComplaint || "Unspecified");
}

function getHealth(e: EpcrItem) {
  return String(e.healthClassification || "Unspecified");
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const result: Record<string, number> = {};

  items.forEach((item) => {
    const key = getKey(item) || "Unspecified";
    result[key] = (result[key] || 0) + 1;
  });

  return Object.entries(result).sort((a, b) => b[1] - a[1]);
}

export default function ClientEpcrDashboardPage() {
  const { user, loading: userLoading } = useCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [epcrs, setEpcrs] = useState<EpcrItem[]>([]);
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
    const unsub = onSnapshot(collection(db, "epcr"), (snap) => {
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setEpcrs(all);
    });

    return () => unsub();
  }, []);

  const allowedEpcrs = useMemo(() => {
    return epcrs.filter((e) => {
      const pid = getProjectId(e);
      if (!projectIds.includes(pid)) return false;
      if (selectedProjectId && pid !== selectedProjectId) return false;
      return true;
    });
  }, [epcrs, projectIds, selectedProjectId]);

  const genderStats = useMemo(() => countBy(allowedEpcrs, getGender), [allowedEpcrs]);
  const triageStats = useMemo(() => countBy(allowedEpcrs, getTriage), [allowedEpcrs]);
  const complaintStats = useMemo(
    () => countBy(allowedEpcrs, getComplaint).slice(0, 8),
    [allowedEpcrs]
  );
  const healthStats = useMemo(() => countBy(allowedEpcrs, getHealth), [allowedEpcrs]);

  if (userLoading || loading) {
    return <div className="p-6 text-slate-400">Loading ePCR dashboard...</div>;
  }

  return (
    <PermissionGuard module="client_dashboards" action="epcr" showMessage={true}>
      <div className="min-h-screen bg-[#030712] p-6 text-white">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">ePCR Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Client-safe ePCR analytics. Sensitive patient details are hidden.
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card title="Total ePCR" value={allowedEpcrs.length} />
          <Card title="Projects" value={projects.length} />
          <Card title="Triage Groups" value={triageStats.length} />
          <Card title="Complaint Groups" value={complaintStats.length} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <StatsBox title="Gender Distribution" rows={genderStats} />
          <StatsBox title="Triage Levels" rows={triageStats} />
          <StatsBox title="Health Classification" rows={healthStats} />
          <StatsBox title="Top Complaints" rows={complaintStats} />
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

function StatsBox({
  title,
  rows,
}: {
  title: string;
  rows: [string, number][];
}) {
  const total = rows.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>

      {rows.length === 0 ? (
        <div className="text-sm text-slate-400">No data.</div>
      ) : (
        <div className="space-y-3">
          {rows.map(([label, count]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{label}</span>
                <span className="text-slate-400">{count}</span>
              </div>

              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-blue-500"
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
  );
}