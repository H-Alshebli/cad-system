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

const HEALTH_COLORS: Record<string, string> = {
  Occupational: "border-[#274C5A]/25 bg-[#274C5A]/10 text-[#274C5A]",
  "Non-Occupational": "border-[#86A7B2]/30 bg-[#86A7B2]/12 text-[#274C5A]",
  "General Health Illnesses": "border-emerald-500/25 bg-emerald-500/10 text-emerald-800",
  "Unspecified Medical Conditions": "border-[#c8dce2] bg-[#f7fbfc] text-[#607482]",
  Unspecified: "border-[#c8dce2] bg-[#f7fbfc] text-[#607482]",
};

const TRIAGE_COLORS: Record<string, string> = {
  "Level 1 (Resuscitation)": "border-red-500/25 bg-red-500/10 text-red-800",
  "Level 2 (Emergent)": "border-orange-500/25 bg-orange-500/10 text-orange-800",
  "Level 3 (Urgent)": "border-yellow-500/25 bg-yellow-500/10 text-yellow-800",
  "Level 4 (Less Urgent)": "border-emerald-500/25 bg-emerald-500/10 text-emerald-800",
  "Level 5 (Non-Urgent)": "border-[#274C5A]/25 bg-[#274C5A]/10 text-[#274C5A]",
  "Level 5 (non-urgent)": "border-[#274C5A]/25 bg-[#274C5A]/10 text-[#274C5A]",
  Death: "border-red-700/25 bg-red-700/10 text-red-900",
  death: "border-red-700/25 bg-red-700/10 text-red-900",
  Unspecified: "border-[#c8dce2] bg-[#f7fbfc] text-[#607482]",
};

const COMPLAINT_COLORS: Record<string, string> = {
  "Cardiac complaints": "border-red-500/25 bg-red-500/10 text-red-800",
  "Musculoskeletal complaints": "border-[#274C5A]/25 bg-[#274C5A]/10 text-[#274C5A]",
  "Respiratory complaints": "border-cyan-500/25 bg-cyan-500/10 text-cyan-800",
  "Digestive complaints": "border-emerald-500/25 bg-emerald-500/10 text-emerald-800",
  "General medical complaints": "border-[#c8dce2] bg-[#f7fbfc] text-[#607482]",
  Unspecified: "border-[#c8dce2] bg-[#f7fbfc] text-[#607482]",
};

const CHART_COLORS = [
  "#274C5A",
  "#86A7B2",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#22c55e",
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
          <div className="page-header">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#74cdda]">
                Client Analytics
              </p>
              <h1 className="page-title">ePCR Analytics Dashboard</h1>
              <p className="page-subtitle mt-2">
                Client-safe analytical view of ePCR activity, project distribution,
                triage trends, health classifications, complaints, and operational indicators.
              </p>
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-[#274C5A]/70">
                Sensitive patient details are hidden from this dashboard.
              </p>
            </div>
          </div>

          {/* PROJECT FILTER */}
          {projects.length > 0 && (
            <div className="card-modern flex flex-wrap gap-3">
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
                const count = allowedEpcrs.filter(
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

            <DarkCard title="Client Insights">
              <div className="space-y-3 text-sm font-semibold text-[#607482]">
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
              <ul className="space-y-2 text-sm font-semibold text-[#607482]">
                <li>Daily / weekly case trend</li>
                <li>Cases by location</li>
                <li>Cases by shift</li>
                <li>Response time per project</li>
                <li>Referral / transport outcomes</li>
                <li>Project activity comparison</li>
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
              <div className="text-sm font-semibold text-[#607482]">No projects linked yet.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#d8e6ea]">
                <table className="w-full text-sm">
                  <thead className="bg-[#f7fbfc] text-[#607482]">
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
                          className="border-t border-[#e1ebef] hover:bg-[#f7fbfc]"
                        >
                          <td className="px-4 py-3">{project}</td>
                          <td className="px-4 py-3 text-right font-black text-[#123746]">
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
    <div className="rounded-2xl border border-[#d8e6ea] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-[#123746]">{title}</h2>

      {rows.length === 0 ? (
        <div className="text-sm font-semibold text-[#607482]">No data.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] px-3 py-2"
            >
              <span
                className={`rounded-full border px-2 py-1 text-xs font-black ${
                  colorMap[row.name] || "border-[#c8dce2] bg-[#f7fbfc] text-[#607482]"
                }`}
              >
                {row.name}
              </span>

              <span className="font-black text-[#123746]">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


