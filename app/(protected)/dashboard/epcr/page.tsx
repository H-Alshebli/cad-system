"use client";
import { StatsTable } from "@/app/components/StatsTable";


import { useState } from "react";
import { useEpcrDashboard } from "@/app/hooks/useEpcrDashboard";

type ProjectsMap = Record<string, number>;

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


export default function EpcrDashboardPage() {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();

  const { loading, stats } = useEpcrDashboard(
    undefined,
    undefined,
    selectedProject
  );

  if (loading || !stats) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  const projects = stats.projects as ProjectsMap;

  console.log("PROJECTS:", projects);

  return (
    <div className="p-6 text-white space-y-6">
      <h1 className="text-2xl font-bold">ePCR Dashboard</h1>
      

      {/* ================= PROJECT FILTER ================= */}
      {Object.keys(projects).length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setSelectedProject(undefined)}
            className={`px-3 py-1 rounded border text-sm ${
              !selectedProject
                ? "bg-blue-600 border-blue-600"
                : "border-gray-600"
            }`}
          >
            All Projects
          </button>

          {Object.entries(projects).map(([project, count]) => (
            <button
              key={project}
              onClick={() => setSelectedProject(project)}
              className={`px-3 py-1 rounded border text-sm ${
                selectedProject === project
                  ? "bg-blue-600 border-blue-600"
                  : "border-gray-600"
              }`}
            >
              {project} ({count})
            </button>
          ))}
        </div>
      )}

      {/* ================= KPIs ================= */}
      <div className="grid grid-cols-4 gap-4">
        <Kpi title="Total ePCR" value={stats.totalCases} />
        <Kpi title="Male" value={stats.gender.male} />
        <Kpi title="Female" value={stats.gender.female} />
        <Kpi
          title="Avg Response Time"
          value={`${stats.responseTime.avgMinutes} min`}
        />
      </div>
      {/* ================= MEDICAL STATISTICS ================= */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
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


      {/* ================= PROJECTS TABLE ================= */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Projects</h2>

        {Object.keys(projects).length === 0 ? (
          <div className="text-gray-400 text-sm">
            No projects linked yet
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-[#0F172A] text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left">Project Name</th>
                  <th className="px-4 py-2 text-right">ePCR Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(projects).map(([project, count]) => (
                  <tr
                    key={project}
                    className="border-t border-gray-800 hover:bg-[#020617]"
                  >
                    <td className="px-4 py-2">{project}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= KPI CARD ================= */
function Kpi({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="bg-[#0F172A] border border-gray-700 rounded p-4">
      <div className="text-xs text-gray-400">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
