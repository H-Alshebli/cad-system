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

  responseTimeMinutes?: number;
  responseTime?: {
    minutes?: number;
    avgMinutes?: number;
  };

  createdAt?: any;
  isArchived?: boolean;
  projectArchived?: boolean;
};

type ChartRow = {
  name: string;
  value: number;
};

const HEALTH_COLORS: Record<string, string> = {
  Occupational: "bg-blue-500/15 text-blue-400",
  "Non-Occupational": "bg-purple-500/15 text-purple-400",
  "General Health Illnesses": "bg-green-500/15 text-green-400",
  "Unspecified Medical Conditions": "bg-gray-500/15 text-gray-300",
  Unspecified: "bg-gray-500/15 text-gray-300",
};

const TRIAGE_COLORS: Record<string, string> = {
  "Level 1 (Resuscitation)": "bg-red-600/20 text-red-400",
  "Level 2 (Emergent)": "bg-orange-500/20 text-orange-400",
  "Level 3 (Urgent)": "bg-yellow-500/20 text-yellow-300",
  "Level 4 (Less Urgent)": "bg-green-500/20 text-green-400",
  "Level 5 (Non-Urgent)": "bg-blue-500/20 text-blue-400",
  "Level 5 (non-urgent)": "bg-blue-500/20 text-blue-400",
  Death: "bg-black/40 text-red-500",
  death: "bg-black/40 text-red-500",
  Unspecified: "bg-gray-500/15 text-gray-300",
};

const COMPLAINT_COLORS: Record<string, string> = {
  "Cardiac complaints": "bg-red-500/15 text-red-400",
  "Musculoskeletal complaints": "bg-blue-500/15 text-blue-400",
  "Respiratory complaints": "bg-cyan-500/15 text-cyan-400",
  "Digestive complaints": "bg-green-500/15 text-green-400",
  "General medical complaints": "bg-gray-500/15 text-gray-300",
  Unspecified: "bg-gray-500/15 text-gray-300",
};

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

const GENDER_COLORS: Record<string, string> = {
  Male: "#3b82f6",
  Female: "#a855f7",
  Unspecified: "#6b7280",
};

const HEALTH_CHART_COLORS: Record<string, string> = {
  Occupational: "#e42923",
  "Non-Occupational": "#3b82f6",
  "General Health Illnesses": "#22c55e",
  "Unspecified Medical Conditions": "#6b7280",
  Unspecified: "#6b7280",
};

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#fff",
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
  return String(e.gender || e.patientGender || "Unspecified");
}

function getTriage(e: EpcrItem) {
  return String(e.triage || e.triageLevel || e.level || "Unspecified");
}

function getComplaint(e: EpcrItem) {
  return String(e.chiefComplaint || e.complaint || "Unspecified");
}

function getHealth(e: EpcrItem) {
  return String(
    e.healthClassification || e.classification || "Unspecified"
  );
}

function getResponseMinutes(e: EpcrItem) {
  const value =
    e.responseTimeMinutes ||
    e.responseTime?.minutes ||
    e.responseTime?.avgMinutes ||
    0;

  return Number(value) || 0;
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

  const allowedEpcrs = useMemo(() => {
    return epcrs.filter((e) => {
      const pid = getProjectId(e);

      if (!projectIds.includes(pid)) return false;
      if (selectedProjectId && pid !== selectedProjectId) return false;

      return true;
    });
  }, [epcrs, projectIds, selectedProjectId]);

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
    () => countBy(allowedEpcrs, getComplaint).slice(0, 8),
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
      .map(getResponseMinutes)
      .filter((value) => value > 0);

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
    return <div className="p-6 text-slate-400">Loading ePCR dashboard...</div>;
  }

  return (
    <PermissionGuard module="client_dashboards" action="epcr" showMessage={true}>
      <div className="min-h-screen bg-[#020817] p-6 text-white">
        <div className="w-full space-y-6">
          {/* HEADER */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl">
            <h1 className="text-3xl font-bold tracking-tight">
              ePCR Analytics Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Client-safe analytical view of ePCR activity, project distribution,
              triage trends, health classifications, complaints, and operational indicators.
            </p>
            <p className="mt-2 text-xs text-blue-200/80">
              Sensitive patient details are hidden from this dashboard.
            </p>
          </div>

          {/* PROJECT FILTER */}
          {projects.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSelectedProjectId("")}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  !selectedProjectId
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                All Projects
              </button>

              {projects.map((project) => {
                const count = allowedEpcrs.filter(
                  (e) => getProjectId(e) === project.id
                ).length;

                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      selectedProjectId === project.id
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {project.projectName || project.client || project.id} ({count})
                  </button>
                );
              })}
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
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="rgba(255,255,255,0.65)"
                      tickFormatter={(value) => truncateLabel(value, 12)}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="rgba(255,255,255,0.65)"
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
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="rgba(255,255,255,0.65)"
                      tickFormatter={(value) => truncateLabel(value, 14)}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="rgba(255,255,255,0.65)"
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
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      stroke="rgba(255,255,255,0.65)"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={180}
                      stroke="rgba(255,255,255,0.65)"
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

            <DarkCard title="Client Insights">
              <div className="space-y-3 text-sm text-white/75">
                <p>
                  This dashboard provides a client-safe view of ePCR activity
                  across the projects assigned to your account.
                </p>
                <p>
                  It helps track case volume, common complaints, triage levels,
                  health classifications, and operational medical trends.
                </p>
                <p>
                  Patient-identifiable details and internal medical notes are
                  intentionally hidden from this view.
                </p>
              </div>
            </DarkCard>

            <DarkCard title="Recommended Next Metrics">
              <ul className="space-y-2 text-sm text-white/75">
                <li>• Daily / weekly case trend</li>
                <li>• Cases by location</li>
                <li>• Cases by shift</li>
                <li>• Response time per project</li>
                <li>• Referral / transport outcomes</li>
                <li>• Project activity comparison</li>
              </ul>
            </DarkCard>
          </div>

          {/* TABLES */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <StatsTableLite
              title="Health Classification"
              rows={healthChartData}
              colorMap={HEALTH_COLORS}
            />

            <StatsTableLite
              title="Triage Levels"
              rows={triageChartData}
              colorMap={TRIAGE_COLORS}
            />

            <StatsTableLite
              title="Chief Complaints"
              rows={complaintsChartData}
              colorMap={COMPLAINT_COLORS}
            />
          </div>

          {/* PROJECTS TABLE */}
          <DarkCard title="Projects Summary">
            {Object.keys(projectsMap).length === 0 ? (
              <div className="text-sm text-white/50">No projects linked yet.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-white/60">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        Project Name
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        ePCR Count
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.entries(projectsMap)
                      .sort((a, b) => b[1] - a[1])
                      .map(([project, count]) => (
                        <tr
                          key={project}
                          className="border-t border-white/10 hover:bg-white/5"
                        >
                          <td className="px-4 py-3">{project}</td>
                          <td className="px-4 py-3 text-right font-semibold text-white">
                            {count}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </DarkCard>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="mb-4 text-lg font-semibold text-white">{title}</div>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="text-sm font-medium text-white/60">{title}</div>
      <div className="mt-2 break-words text-2xl font-bold text-white">
        {value}
      </div>
      <div className="mt-2 text-xs text-white/50">{subtitle}</div>
    </div>
  );
}

function StatsTableLite({
  title,
  rows,
  colorMap,
}: {
  title: string;
  rows: ChartRow[];
  colorMap: Record<string, string>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>

      {rows.length === 0 ? (
        <div className="text-sm text-white/50">No data.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2"
            >
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  colorMap[row.name] || "bg-gray-500/15 text-gray-300"
                }`}
              >
                {row.name}
              </span>

              <span className="font-semibold text-white">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}