"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";
import { getEpcrResponseMinutes } from "@/lib/epcrResponseTime";

type Project = {
  id: string;
  projectName?: string;
  client?: string;
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
  level?: string;

  gender?: string;
  patientGender?: string;

  chiefComplaint?: string;
  complaint?: string;

  healthClassification?: string;
  classification?: string;
  patientInfo?: {
    gender?: string;
    triageColor?: string;
    healthClassification?: string;
    chiefComplaints?: string[];
  };

  responseTimeMinutes?: number;
  responseTime?: {
    minutes?: number;
    avgMinutes?: number;
  };
  time?: any;
  timeline?: any;
  caseSnapshot?: any;

  createdAt?: any;
  isArchived?: boolean;
  projectArchived?: boolean;
};

type ChartRow = {
  name: string;
  value: number;
};

const CHART_COLORS = [
  "#8fd8e6",
  "#005f53",
  "#c81e1e",
  "#f6b31a",
  "#148f3d",
  "#2d5c88",
  "#9b95d9",
  "#70c7d9",
];

const GENDER_COLORS: Record<string, string> = {
  Male: "#8fd8e6",
  Female: "#005f53",
  Unspecified: "#86A7B2",
};

const HEALTH_CHART_COLORS: Record<string, string> = {
  Occupational: "#8fd8e6",
  "Non-Occupational": "#005f53",
  "General Health Illnesses": "#148f3d",
  "Unspecified Medical Conditions": "#86A7B2",
  Unspecified: "#86A7B2",
};

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #d8e6ea",
  borderRadius: "12px",
  color: "#123746",
};

function getProjectId(e: EpcrItem) {
  return e.projectId || e.projectInfo?.id || e.projectInfo?.projectId || "";
}

function getProjectName(e: EpcrItem) {
  return (
    e.projectInfo?.projectName ||
    e.projectName ||
    e.projectId ||
    "Unknown Project"
  );
}

function getGender(e: EpcrItem) {
  const value = e.patientInfo?.gender || e.gender || e.patientGender;
  return !value || value.toLowerCase() === "unknown" ? "Unspecified" : String(value);
}

function getTriage(e: EpcrItem) {
  return String(
    e.patientInfo?.triageColor || e.triage || e.triageLevel || e.level || "Unspecified"
  );
}

function getComplaints(e: EpcrItem) {
  const values = e.patientInfo?.chiefComplaints?.filter(Boolean) || [];
  return values.length
    ? values
    : [String(e.chiefComplaint || e.complaint || "Unspecified")];
}

function getHealth(e: EpcrItem) {
  return String(
    e.patientInfo?.healthClassification ||
      e.healthClassification ||
      e.classification ||
      "Unspecified"
  );
}

function isVisibleRecord(item: EpcrItem) {
  return item?.isArchived !== true && item?.projectArchived !== true;
}

function countBy<T>(items: T[], getKey: (item: T) => string): ChartRow[] {
  const result: Record<string, number> = {};

  items.forEach((item) => {
    const key = getKey(item) || "Unspecified";
    result[key] = (result[key] || 0) + 1;
  });

  return Object.entries(result)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function countByMany<T>(items: T[], getKeys: (item: T) => string[]): ChartRow[] {
  const result: Record<string, number> = {};

  items.forEach((item) => {
    const keys = getKeys(item).filter(Boolean);
    (keys.length ? keys : ["Unspecified"]).forEach((key) => {
      result[key] = (result[key] || 0) + 1;
    });
  });

  return Object.entries(result)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function truncateLabel(text: string, max = 18) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}...` : text;
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

    const unsub = onSnapshot(
      q,
      (snap) => {
        setProjects(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );

        setLoading(false);
      },
      (error) => {
        console.error("Client projects listener error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, userLoading]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "epcr"),
      (snap) => {
        const all = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
          .filter(isVisibleRecord);

        setEpcrs(all);
      },
      (error) => {
        console.error("Client ePCR listener error:", error);
      }
    );

    return () => unsub();
  }, []);

  const clientEpcrs = useMemo(() => {
    return epcrs.filter((e) => {
      const pid = getProjectId(e);
      return projectIds.includes(pid);
    });
  }, [epcrs, projectIds]);

  const allowedEpcrs = useMemo(
    () =>
      selectedProjectId
        ? clientEpcrs.filter((item) => getProjectId(item) === selectedProjectId)
        : clientEpcrs,
    [clientEpcrs, selectedProjectId]
  );

  const projectsMap = useMemo(() => {
    const result: Record<string, number> = {};

    allowedEpcrs.forEach((e) => {
      const name = getProjectName(e);
      result[name] = (result[name] || 0) + 1;
    });

    return result;
  }, [allowedEpcrs]);

  const genderData = useMemo(
    () => countBy(allowedEpcrs, getGender),
    [allowedEpcrs]
  );

  const triageChartData = useMemo(
    () => countBy(allowedEpcrs, getTriage),
    [allowedEpcrs]
  );

  const healthChartData = useMemo(
    () => countBy(allowedEpcrs, getHealth),
    [allowedEpcrs]
  );

  const complaintsChartData = useMemo(
    () => countByMany(allowedEpcrs, getComplaints).slice(0, 8),
    [allowedEpcrs]
  );

  const projectChartData = useMemo(
    () =>
      Object.entries(projectsMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [projectsMap]
  );

  const totalPatients = allowedEpcrs.length;

  const male =
    genderData.find((x) => x.name.toLowerCase() === "male")?.value || 0;

  const female =
    genderData.find((x) => x.name.toLowerCase() === "female")?.value || 0;

  const malePct = totalPatients ? Math.round((male / totalPatients) * 100) : 0;
  const femalePct = totalPatients
    ? Math.round((female / totalPatients) * 100)
    : 0;

  const avgResponseMinutes = useMemo(() => {
    const values = allowedEpcrs
      .map(getEpcrResponseMinutes)
      .filter((value): value is number => value !== null && value > 0);

    if (values.length === 0) return 0;

    return Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length
    );
  }, [allowedEpcrs]);

  const topProject = useMemo(() => {
    const first = projectChartData[0];
    return first ? `${first.name} (${first.value})` : "—";
  }, [projectChartData]);

  const topComplaint = useMemo(() => {
    const first = complaintsChartData[0];
    return first ? `${first.name} (${first.value})` : "—";
  }, [complaintsChartData]);

  const topTriage = useMemo(() => {
    const first = triageChartData[0];
    return first ? `${first.name} (${first.value})` : "—";
  }, [triageChartData]);

  if (userLoading || loading) {
    return (
      <div className="p-6">
        <div className="card-modern text-sm font-semibold text-[#274C5A]">
          Loading ePCR dashboard...
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard module="client_dashboards" action="epcr" showMessage={true}>
      <div className="page-shell p-6">
        <div className="w-full space-y-6">
          <div className="rounded-2xl bg-[#274C5A] p-6 text-white shadow-sm shadow-[#274C5A]/20">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8fd8e6]">
                Client Analytics
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Cases Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-white/80">
                Client-safe analytical view of ePCR activity, project distribution,
                triage trends, health classifications, complaints, and operational indicators.
              </p>
              <p className="mt-3 text-xs font-black uppercase tracking-wide text-white/60">
                Sensitive patient details are hidden from this dashboard.
              </p>
            </div>
          </div>

          {/* PROJECT FILTER */}
          {projects.length > 0 && (
            <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm shadow-[#274C5A]/5">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#607482]">
                Filter by project
              </div>
              <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSelectedProjectId("")}
                className={`rounded-full border px-3 py-1.5 text-sm font-black transition ${
                  !selectedProjectId
                    ? "border-[#274C5A] bg-[#274C5A] text-white"
                    : "border-[#c8dce2] bg-white text-[#274C5A] hover:bg-[#f7fbfc]"
                }`}
              >
                All Projects
              </button>

              {projects.map((project) => {
                const count = clientEpcrs.filter(
                  (e) => getProjectId(e) === project.id
                ).length;

                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-black transition ${
                      selectedProjectId === project.id
                        ? "border-[#274C5A] bg-[#274C5A] text-white"
                        : "border-[#c8dce2] bg-white text-[#274C5A] hover:bg-[#f7fbfc]"
                    }`}
                  >
                    {project.projectName || project.client || project.id} ({count})
                  </button>
                );
              })}
              </div>
            </div>
          )}

          {/* KPI CARDS */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total ePCR"
              value={totalPatients}
              subtitle="Total recorded ePCR cases"
            />

            <KpiCard
              title="Male Patients"
              value={male}
              subtitle={`${malePct}% of total cases`}
            />

            <KpiCard
              title="Female Patients"
              value={female}
              subtitle={`${femalePct}% of total cases`}
            />

            <KpiCard
              title="Avg Response Time"
              value={`${avgResponseMinutes} min`}
              subtitle="Average response duration"
            />

            <KpiCard
              title="Top Project"
              value={topProject}
              subtitle="Highest ePCR volume"
            />

            <KpiCard
              title="Top Complaint"
              value={topComplaint}
              subtitle="Most frequent complaint"
            />

            <KpiCard
              title="Top Triage"
              value={topTriage}
              subtitle="Most frequent triage level"
            />

            <KpiCard
              title="Projects Count"
              value={projects.length}
              subtitle="Assigned projects in dashboard"
            />
          </div>

          {/* MAIN ANALYTICS GRID */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <DarkCard title="Gender Distribution">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={110}
                      label
                    >
                      {genderData.map((entry, index) => (
                        <Cell
                          key={`gender-${index}`}
                          fill={
                            GENDER_COLORS[entry.name] ||
                            CHART_COLORS[index % CHART_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </DarkCard>

            <DarkCard title="Top Projects by ePCR Volume">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#d8e6ea"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#607482"
                      tickFormatter={(value) => truncateLabel(value, 12)}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="#607482"
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {projectChartData.map((_, index) => (
                        <Cell
                          key={`project-bar-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DarkCard>

            <DarkCard title="Triage Level Analysis">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={triageChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#d8e6ea"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#607482"
                      tickFormatter={(value) => truncateLabel(value, 14)}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="#607482"
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {triageChartData.map((_, index) => (
                        <Cell
                          key={`triage-bar-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DarkCard>

            <DarkCard title="Health Classification Analysis">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthChartData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={110}
                      label
                    >
                      {healthChartData.map((entry, index) => (
                        <Cell
                          key={`health-${index}`}
                          fill={
                            HEALTH_CHART_COLORS[entry.name] ||
                            CHART_COLORS[index % CHART_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </DarkCard>

            <DarkCard title="Chief Complaints Analysis">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={complaintsChartData}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#d8e6ea"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      stroke="#607482"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={180}
                      stroke="#607482"
                      tickFormatter={(value) => truncateLabel(value, 24)}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {complaintsChartData.map((_, index) => (
                        <Cell
                          key={`complaint-bar-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DarkCard>

          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}

function DarkCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#d8e6ea] bg-white p-5 shadow-sm">
      <div className="mb-4 text-lg font-black text-[#123746]">{title}</div>
      {children}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-[#d8e6ea] bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-[#607482]">{title}</div>
      <div className="mt-2 break-words text-2xl font-black text-[#123746]">
        {value}
      </div>
      <div className="mt-2 text-xs font-semibold text-[#607482]">{subtitle}</div>
    </div>
  );
}

