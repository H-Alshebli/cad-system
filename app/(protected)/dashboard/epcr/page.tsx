"use client";

import { useMemo, useState } from "react";
import { StatsTable } from "@/app/components/StatsTable";
import { useEpcrDashboard } from "@/app/hooks/useEpcrDashboard";
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

type ProjectsMap = Record<string, number>;
type GenericMap = Record<string, number>;

/* ================= COLORS ================= */

const HEALTH_COLORS: Record<string, string> = {
  Occupational: "bg-blue-500/15 text-blue-400",
  "Non-Occupational": "bg-purple-500/15 text-purple-400",
  "General Health Illnesses": "bg-green-500/15 text-green-400",
  "Unspecified Medical Conditions": "bg-gray-500/15 text-gray-300",
};

const TRIAGE_COLORS: Record<string, string> = {
  "Level 1 (Resuscitation)": "bg-red-600/20 text-red-400",
  "Level 2 (Emergent)": "bg-orange-500/20 text-orange-400",
  "Level 3 (Urgent)": "bg-yellow-500/20 text-yellow-300",
  "Level 4 (Less Urgent)": "bg-green-500/20 text-green-400",
  "Level 5 (non-urgent)": "bg-blue-500/20 text-blue-400",
  death: "bg-black/40 text-red-500",
};

const COMPLAINT_COLORS: Record<string, string> = {
  "Cardiac complaints": "bg-red-500/15 text-red-400",
  "Musculoskeletal complaints": "bg-blue-500/15 text-blue-400",
  "Respiratory complaints": "bg-cyan-500/15 text-cyan-400",
  "Digestive complaints": "bg-green-500/15 text-green-400",
  "General medical complaints": "bg-gray-500/15 text-gray-300",
};

const PIE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

const CHART_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
];
/* ================= HELPERS ================= */

function mapToChartData(obj?: GenericMap) {
  if (!obj) return [];
  return Object.entries(obj)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function truncateLabel(text: string, max = 18) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/* ================= PAGE ================= */

export default function EpcrDashboardPage() {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();

  const { loading, stats } = useEpcrDashboard(
    undefined,
    undefined,
    selectedProject
  );

  const projects = (stats?.projects || {}) as ProjectsMap;

  const genderData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Male", value: stats.gender?.male || 0 },
      { name: "Female", value: stats.gender?.female || 0 },
    ];
  }, [stats]);

  const triageChartData = useMemo(
    () => mapToChartData(stats?.triage as GenericMap),
    [stats]
  );

  const healthChartData = useMemo(
    () => mapToChartData(stats?.healthClassification as GenericMap),
    [stats]
  );

  const complaintsChartData = useMemo(
    () => mapToChartData(stats?.complaints as GenericMap).slice(0, 8),
    [stats]
  );

  const projectChartData = useMemo(
    () =>
      Object.entries(projects)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [projects]
  );

  const totalPatients = stats?.totalCases || 0;
  const male = stats?.gender?.male || 0;
  const female = stats?.gender?.female || 0;

  const malePct = totalPatients ? Math.round((male / totalPatients) * 100) : 0;
  const femalePct = totalPatients
    ? Math.round((female / totalPatients) * 100)
    : 0;

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

  if (loading || !stats) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#020817] p-6 text-white">
      <div className="w-full space-y-6">
        {/* HEADER */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl">
          <h1 className="text-3xl font-bold tracking-tight">ePCR Analytics Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Executive analytical view of ePCR activity, project distribution,
            triage trends, health classifications, complaints, and operational indicators.
          </p>
        </div>

        {/* PROJECT FILTER */}
        {Object.keys(projects).length > 0 && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedProject(undefined)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                !selectedProject
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              }`}
            >
              All Projects
            </button>

            {Object.entries(projects).map(([project, count]) => (
              <button
                key={project}
                onClick={() => setSelectedProject(project)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  selectedProject === project
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                {project} ({count})
              </button>
            ))}
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Total ePCR" value={stats.totalCases} subtitle="Total recorded cases" />
          <KpiCard title="Male Patients" value={male} subtitle={`${malePct}% of total cases`} />
          <KpiCard title="Female Patients" value={female} subtitle={`${femalePct}% of total cases`} />
          <KpiCard
            title="Avg Response Time"
            value={`${stats.responseTime?.avgMinutes || 0} min`}
            subtitle="Average response duration"
          />

          <KpiCard title="Top Project" value={topProject} subtitle="Highest ePCR volume" />
          <KpiCard title="Top Complaint" value={topComplaint} subtitle="Most frequent complaint" />
          <KpiCard title="Top Triage" value={topTriage} subtitle="Most frequent triage level" />
          <KpiCard
            title="Projects Count"
            value={Object.keys(projects).length}
            subtitle="Active projects in dashboard"
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
                fill={GENDER_COLORS[entry.name as "Male" | "Female"]}
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="name"
            stroke="rgba(255,255,255,0.65)"
            tickFormatter={(value) => truncateLabel(value, 12)}
          />
          <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.65)" />
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="name"
            stroke="rgba(255,255,255,0.65)"
            tickFormatter={(value) => truncateLabel(value, 14)}
          />
          <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.65)" />
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
                fill={HEALTH_CHART_COLORS[entry.name] || "#3b82f6"}
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
        <BarChart data={complaintsChartData} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis type="number" allowDecimals={false} stroke="rgba(255,255,255,0.65)" />
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

  <DarkCard title="Executive Insights">
    <div className="space-y-3 text-sm text-white/75">
      <p>
        This dashboard gives management a clearer analytical view of ePCR trends
        across projects, patient profiles, health classifications, and operational response.
      </p>
      <p>
        It helps identify which projects generate the highest medical activity,
        the most common complaints, and the triage levels that require the most attention.
      </p>
      <p>
        The dashboard can later be expanded with time-based trends, ambulance response analysis,
        location heatmaps, and patient outcome metrics.
      </p>
    </div>
  </DarkCard>

  <DarkCard title="Recommended Next Metrics">
    <ul className="space-y-2 text-sm text-white/75">
      <li>• Daily / weekly case trend</li>
      <li>• Cases by location</li>
      <li>• Cases by shift</li>
      <li>• Response time per project</li>
      <li>• Most frequent diagnosis</li>
      <li>• Referral / transport outcomes</li>
      <li>• Team performance comparison</li>
    </ul>
  </DarkCard>
</div>

        {/* TABLES */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <StatsTable
            title="Health Classification"
            data={stats.healthClassification}
            colorMap={HEALTH_COLORS}
          />

          <StatsTable
            title="Triage Levels"
            data={stats.triage}
            colorMap={TRIAGE_COLORS}
          />

          <StatsTable
            title="Chief Complaints"
            data={stats.complaints}
            colorMap={COMPLAINT_COLORS}
          />
        </div>

        {/* PROJECTS TABLE */}
        <DarkCard title="Projects Summary">
          {Object.keys(projects).length === 0 ? (
            <div className="text-sm text-white/50">No projects linked yet.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Project Name</th>
                    <th className="px-4 py-3 text-right font-medium">ePCR Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(projects)
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
  );
}

/* ================= UI ================= */
const GENDER_COLORS = {
  Male: "#3b82f6",
  Female: "#a855f7",
};

const HEALTH_CHART_COLORS: Record<string, string> = {
  Occupational: "#e42923", // blue
  "Non-Occupational": "#3b82f6", // purple
  "General Health Illnesses": "#22c55e", // green
  "Unspecified Medical Conditions": "#6b7280", // gray
};

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#fff",
};

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
      <div className="mt-2 text-2xl font-bold text-white break-words">{value}</div>
      <div className="mt-2 text-xs text-white/50">{subtitle}</div>
    </div>
  );
}