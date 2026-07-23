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
import PermissionGuard from "@/app/components/PermissionGuard";

type ProjectsMap = Record<string, number>;
type GenericMap = Record<string, number>;

/* ================= COLORS ================= */

const HEALTH_COLORS: Record<string, string> = {
  Occupational: "bg-[#8fd8e6]/35 text-[#274C5A]",
  "Non-Occupational": "bg-[#005f53]/10 text-[#005f53]",
  "General Health Illnesses": "bg-emerald-500/10 text-emerald-700",
  "Unspecified Medical Conditions": "bg-[#86A7B2]/20 text-[#274C5A]",
};

const TRIAGE_COLORS: Record<string, string> = {
  "Level 1 (Resuscitation)": "bg-red-600/10 text-red-700",
  "Level 2 (Emergent)": "bg-red-600/10 text-red-700",
  "Level 3 (Urgent)": "bg-amber-500/15 text-amber-700",
  "Level 4 (Less Urgent)": "bg-emerald-500/10 text-emerald-700",
  "Level 5 (non-urgent)": "bg-[#8fd8e6]/35 text-[#274C5A]",
  death: "bg-red-600/10 text-red-700",
};

const COMPLAINT_COLORS: Record<string, string> = {
  "Cardiac complaints": "bg-red-500/10 text-red-700",
  "Musculoskeletal complaints": "bg-[#8fd8e6]/35 text-[#274C5A]",
  "Respiratory complaints": "bg-[#005f53]/10 text-[#005f53]",
  "Digestive complaints": "bg-emerald-500/10 text-emerald-700",
  "General medical complaints": "bg-[#86A7B2]/20 text-[#274C5A]",
};

const PIE_COLORS = [
  "#8fd8e6",
  "#005f53",
  "#2d5c88",
  "#9b95d9",
  "#3b78a8",
  "#d76aa3",
  "#f6b31a",
  "#70c7d9",
];

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
    return <div className="p-6 text-sm font-semibold text-[#7F7F7F]">Loading...</div>;
  }

 return (
  <PermissionGuard module="dashboards" action="epcr" showMessage={true}>
    <div className="min-h-screen bg-[#f5f7f8] p-6 text-[#274C5A]">
      <div className="w-full space-y-6">
        {/* HEADER */}
        <div className="rounded-2xl bg-[#274C5A] p-6 text-white shadow-sm shadow-[#274C5A]/20">
          <h1 className="text-3xl font-black tracking-tight">ePCR Analytics Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-white/78">
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
                  ? "border-[#274C5A] bg-[#274C5A] text-white"
                  : "border-[#86A7B2]/35 bg-white text-[#274C5A] hover:bg-[#f8fbfc]"
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
                    ? "border-[#274C5A] bg-[#274C5A] text-white"
                    : "border-[#86A7B2]/35 bg-white text-[#274C5A] hover:bg-[#f8fbfc]"
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e6eef1" />
          <XAxis
            dataKey="name"
            stroke="#7F7F7F"
            tickFormatter={(value) => truncateLabel(value, 12)}
          />
          <YAxis allowDecimals={false} stroke="#7F7F7F" />
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e6eef1" />
          <XAxis
            dataKey="name"
            stroke="#7F7F7F"
            tickFormatter={(value) => truncateLabel(value, 14)}
          />
          <YAxis allowDecimals={false} stroke="#7F7F7F" />
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
                fill={HEALTH_CHART_COLORS[entry.name] || "#8fd8e6"}
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e6eef1" />
          <XAxis type="number" allowDecimals={false} stroke="#7F7F7F" />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            stroke="#7F7F7F"
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

  {/* <DarkCard title="Executive Insights">
    <div className="space-y-3 text-sm text-[#7F7F7F]">
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
  </DarkCard> */}

  <DarkCard title="Recommended Next Metrics">
    <ul className="space-y-2 text-sm text-[#7F7F7F]">
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
            <div className="text-sm text-[#7F7F7F]">No projects linked yet.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#86A7B2]/25">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fbfc] text-[#7F7F7F]">
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
                        className="border-t border-[#86A7B2]/25 hover:bg-[#f8fbfc]"
                      >
                        <td className="px-4 py-3">{project}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#274C5A]">
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

/* ================= UI ================= */
const GENDER_COLORS = {
  Male: "#8fd8e6",
  Female: "#005f53",
};

const HEALTH_CHART_COLORS: Record<string, string> = {
  Occupational: "#8fd8e6",
  "Non-Occupational": "#005f53",
  "General Health Illnesses": "#148f3d",
  "Unspecified Medical Conditions": "#86A7B2",
};

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid rgba(134, 167, 178, 0.35)",
  borderRadius: "12px",
  color: "#274C5A",
};

function DarkCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
      <div className="mb-4 text-lg font-black text-[#274C5A]">{title}</div>
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
    <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
      <div className="text-sm font-medium text-[#7F7F7F]">{title}</div>
      <div className="mt-2 break-words text-2xl font-black text-[#274C5A]">{value}</div>
      <div className="mt-2 text-xs text-[#7F7F7F]">{subtitle}</div>
    </div>
  );
}
