"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PermissionGuard from "@/app/components/PermissionGuard";
import { db } from "@/lib/firebase";
import { getEpcrResponseMinutes } from "@/lib/epcrResponseTime";

type GenderFilter = "male" | "female" | null;
type TriageKey = "level1" | "level2" | "level3" | "level4" | "level5" | "death";

type EpcrRecord = {
  id: string;
  patientInfo?: {
    gender?: string;
    triageColor?: string;
    healthClassification?: string;
    chiefComplaints?: string[];
  };
  projectId?: string;
  projectName?: string;
  projectInfo?: {
    projectId?: string;
    projectName?: string;
  };
  isArchived?: boolean;
  projectArchived?: boolean;
  outcome?: { destination?: string };
};

const GENDERS = [
  { key: "male" as const, label: "Male", color: "#20A4E8" },
  { key: "female" as const, label: "Female", color: "#A76BD4" },
];

const TRIAGE_LEVELS: Array<{
  key: TriageKey;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
}> = [
  { key: "level5", label: "Level 5 (Non-Urgent)", shortLabel: "Level 5", color: "#82D3E0", textColor: "#123746" },
  { key: "level4", label: "Level 4 (Less Urgent)", shortLabel: "Level 4", color: "#087465", textColor: "#FFFFFF" },
  { key: "level3", label: "Level 3 (Urgent)", shortLabel: "Level 3", color: "#F7B51B", textColor: "#123746" },
  { key: "level2", label: "Level 2 (Emergent)", shortLabel: "Level 2", color: "#ED7C4F", textColor: "#FFFFFF" },
  { key: "level1", label: "Level 1 (Resuscitation)", shortLabel: "Level 1", color: "#CF2027", textColor: "#FFFFFF" },
  { key: "death", label: "Death", shortLabel: "Death", color: "#3F4F56", textColor: "#FFFFFF" },
];

function normalizeGender(value: unknown): Exclude<GenderFilter, null> | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "male") return "male";
  if (normalized === "female") return "female";
  return null;
}

function normalizeTriage(value: unknown): TriageKey | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.startsWith("level 1")) return "level1";
  if (normalized.startsWith("level 2")) return "level2";
  if (normalized.startsWith("level 3")) return "level3";
  if (normalized.startsWith("level 4")) return "level4";
  if (normalized.startsWith("level 5")) return "level5";
  if (normalized === "death") return "death";
  return null;
}

function getProjectName(record: EpcrRecord) {
  return record.projectInfo?.projectName || record.projectName || "";
}

function isVisibleRecord(record: EpcrRecord) {
  return record.isArchived !== true && record.projectArchived !== true;
}

export default function CasesDashboardPlusPage() {
  const [records, setRecords] = useState<EpcrRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedGender, setSelectedGender] = useState<GenderFilter>(null);
  const [selectedTriage, setSelectedTriage] = useState<TriageKey | null>(null);
  const [selectedHealth, setSelectedHealth] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "epcr"),
      (snapshot) => {
        setRecords(
          snapshot.docs
            .map((item) => ({ id: item.id, ...(item.data() as any) } as EpcrRecord))
            .filter(isVisibleRecord)
        );
        setLoading(false);
      },
      (error) => {
        console.error("Cases Dashboard Plus listener error:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const completeRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          normalizeGender(record.patientInfo?.gender) !== null &&
          normalizeTriage(record.patientInfo?.triageColor) !== null
      ),
    [records]
  );

  const projectRecords = useMemo(
    () =>
      completeRecords.filter(
        (record) => !selectedProject || getProjectName(record) === selectedProject
      ),
    [completeRecords, selectedProject]
  );

  const genderRecords = useMemo(
    () =>
      projectRecords.filter(
        (record) =>
          !selectedTriage ||
          normalizeTriage(record.patientInfo?.triageColor) === selectedTriage
      ),
    [projectRecords, selectedTriage]
  );

  const triageRecords = useMemo(
    () =>
      projectRecords.filter(
        (record) =>
          !selectedGender ||
          normalizeGender(record.patientInfo?.gender) === selectedGender
      ),
    [projectRecords, selectedGender]
  );

  const genderCounts = useMemo(
    () => ({
      male: genderRecords.filter(
        (record) => normalizeGender(record.patientInfo?.gender) === "male"
      ).length,
      female: genderRecords.filter(
        (record) => normalizeGender(record.patientInfo?.gender) === "female"
      ).length,
    }),
    [genderRecords]
  );

  const triageCounts = useMemo(() => {
    const counts = Object.fromEntries(
      TRIAGE_LEVELS.map((level) => [level.key, 0])
    ) as Record<TriageKey, number>;
    triageRecords.forEach((record) => {
      const key = normalizeTriage(record.patientInfo?.triageColor);
      if (key) counts[key] += 1;
    });
    return counts;
  }, [triageRecords]);

  const genderTriageRecords = useMemo(
    () =>
      projectRecords.filter((record) => {
        const genderMatches = !selectedGender || normalizeGender(record.patientInfo?.gender) === selectedGender;
        const triageMatches = !selectedTriage || normalizeTriage(record.patientInfo?.triageColor) === selectedTriage;
        return genderMatches && triageMatches;
      }),
    [projectRecords, selectedGender, selectedTriage]
  );

  const healthFilteredRecords = useMemo(
    () => genderTriageRecords.filter((record) => !selectedHealth || record.patientInfo?.healthClassification === selectedHealth),
    [genderTriageRecords, selectedHealth]
  );

  const filteredRecords = useMemo(
    () => healthFilteredRecords.filter((record) => !selectedComplaint || (record.patientInfo?.chiefComplaints || []).includes(selectedComplaint)),
    [healthFilteredRecords, selectedComplaint]
  );

  const healthChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    genderTriageRecords.forEach((record) => {
      const health = record.patientInfo?.healthClassification;
      if (health) counts[health] = (counts[health] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [genderTriageRecords]);

  const complaintChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    healthFilteredRecords.forEach((record) => {
      (record.patientInfo?.chiefComplaints || []).forEach((complaint) => {
        counts[complaint] = (counts[complaint] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [healthFilteredRecords]);

  const analytics = useMemo(() => {
    const projectMap: Record<string, number> = {};
    const healthMap: Record<string, number> = {};
    const complaintMap: Record<string, number> = {};
    let responseTotal = 0;
    let responseCount = 0;

    filteredRecords.forEach((record) => {
      const project = getProjectName(record);
      if (project) projectMap[project] = (projectMap[project] || 0) + 1;
      const health = record.patientInfo?.healthClassification;
      if (health) healthMap[health] = (healthMap[health] || 0) + 1;
      (record.patientInfo?.chiefComplaints || []).forEach((complaint) => {
        complaintMap[complaint] = (complaintMap[complaint] || 0) + 1;
      });
      const minutes = getEpcrResponseMinutes(record as any);
      if (minutes !== null) {
        responseTotal += minutes;
        responseCount += 1;
      }
    });

    const toData = (map: Record<string, number>) =>
      Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return {
      projects: toData(projectMap).slice(0, 8),
      health: toData(healthMap),
      complaints: toData(complaintMap).slice(0, 8),
      avgResponse: responseCount ? Number((responseTotal / responseCount).toFixed(1)) : 0,
    };
  }, [filteredRecords]);

  const selectedGenderCount = selectedGender
    ? genderCounts[selectedGender]
    : genderCounts.male + genderCounts.female;
  const genderTotal = genderCounts.male + genderCounts.female;
  const malePercentage = genderTotal
    ? Math.round((genderCounts.male / genderTotal) * 100)
    : 0;
  const femalePercentage = genderTotal ? 100 - malePercentage : 0;
  const genderArcGap = genderTotal && genderCounts.male && genderCounts.female ? 2 : 0;
  const maleArcLength = Math.max(0, (genderCounts.male / Math.max(genderTotal, 1)) * 100 - genderArcGap);
  const femaleArcLength = Math.max(0, (genderCounts.female / Math.max(genderTotal, 1)) * 100 - genderArcGap);
  const maxTriageCount = Math.max(...Object.values(triageCounts), 1);
  const hasActiveFilter = Boolean(selectedGender || selectedTriage || selectedHealth || selectedComplaint);
  const topProject = analytics.projects[0];
  const topComplaint = analytics.complaints[0];
  const topTriage = TRIAGE_LEVELS.map((level) => ({ ...level, value: triageCounts[level.key] })).sort((a, b) => b.value - a.value)[0];
  const healthTotal = healthChartData.reduce((sum, item) => sum + item.value, 0);
  const selectedHealthItem = healthChartData.find((item) => item.name === selectedHealth);

  function clearInteractiveFilters() {
    setSelectedGender(null);
    setSelectedTriage(null);
    setSelectedHealth(null);
    setSelectedComplaint(null);
  }

  if (loading) {
    return (
      <div className="p-6 text-sm font-semibold text-[#607482]">
        Loading Cases Dashboard Plus...
      </div>
    );
  }

  return (
    <PermissionGuard module="dashboards" action="epcr" showMessage={true}>
      <div className="min-h-screen bg-[#f5f7f8] p-4 text-[#274C5A] md:p-6">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl bg-[#274C5A] px-5 py-4 text-white shadow-sm shadow-[#274C5A]/20 md:min-h-[74px] md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                Cases Dashboard Plus
              </h1>
              <p className="mt-1 max-w-3xl text-xs font-medium text-white/75">
                Executive analytical view of ePCR activity, project distribution, triage trends, health classifications, complaints, and operational indicators.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35 md:self-auto"
              disabled={!hasActiveFilter && !selectedProject}
              onClick={() => {
                setSelectedProject("");
                clearInteractiveFilters();
              }}
            >
              <RotateCcw size={15} /> Clear interactive filters
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Total ePCR" value={filteredRecords.length} subtitle="Total recorded cases" />
            <KpiCard title="Male Patients" value={genderCounts.male} subtitle={`${malePercentage}% of visible patients`} />
            <KpiCard title="Female Patients" value={genderCounts.female} subtitle={`${femalePercentage}% of visible patients`} />
            <KpiCard title="Avg Response Time" value={`${analytics.avgResponse} min`} subtitle="Average response duration" />
            <KpiCard title="Top Project" value={topProject ? `${topProject.name} (${topProject.value})` : "—"} subtitle="Highest ePCR volume" />
            <KpiCard title="Top Complaint" value={topComplaint ? `${topComplaint.name} (${topComplaint.value})` : "—"} subtitle="Most frequent complaint" />
            <KpiCard title="Top Triage" value={topTriage?.value ? `${topTriage.label} (${topTriage.value})` : "—"} subtitle="Most frequent triage level" />
            <KpiCard title="Projects Count" value={analytics.projects.length} subtitle="Active projects in dashboard" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section className="h-[352px] overflow-hidden rounded-2xl border border-[#d8e6ea] bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-[#274C5A]">
                  Gender Distribution
                </h2>
                <p className="mt-1 text-sm font-medium text-[#607482]">
                  Select Male or Female to update Triage Level Analysis.
                </p>
              </div>

              <div className="relative mx-auto mt-1 max-w-[340px]">
                <svg
                  className="h-auto w-full overflow-visible"
                  viewBox="0 0 440 255"
                  role="img"
                  aria-label={`Gender distribution. Male ${genderCounts.male}, Female ${genderCounts.female}`}
                >
                  <path
                    d="M70 215 A150 150 0 0 1 370 215"
                    fill="none"
                    stroke="#E8EFF2"
                    strokeLinecap="round"
                    strokeWidth="22"
                  />
                  <path
                    d="M70 215 A150 150 0 0 1 370 215"
                    fill="none"
                    stroke="#20A4E8"
                    strokeLinecap="round"
                    strokeWidth={selectedGender === "male" ? 27 : 22}
                    pathLength="100"
                    strokeDasharray={`${maleArcLength} ${100 - maleArcLength}`}
                    opacity={selectedGender === "female" ? 0.18 : 1}
                    className="cursor-pointer transition-all"
                    onClick={() =>
                      setSelectedGender((current) =>
                        current === "male" ? null : "male"
                      )
                    }
                  />
                  <path
                    d="M70 215 A150 150 0 0 1 370 215"
                    fill="none"
                    stroke="#A76BD4"
                    strokeLinecap="round"
                    strokeWidth={selectedGender === "female" ? 27 : 22}
                    pathLength="100"
                    strokeDasharray={`${femaleArcLength} ${100 - femaleArcLength}`}
                    strokeDashoffset={-(maleArcLength + genderArcGap * 2)}
                    opacity={selectedGender === "male" ? 0.18 : 1}
                    className="cursor-pointer transition-all"
                    onClick={() =>
                      setSelectedGender((current) =>
                        current === "female" ? null : "female"
                      )
                    }
                  />
                </svg>
                <div className="absolute left-1/2 top-[67%] -translate-x-1/2 -translate-y-1/2 text-center">
                  <div className="whitespace-nowrap text-sm font-semibold text-[#607482]">
                    {selectedGender ? `${selectedGender === "male" ? "Male" : "Female"} patients` : "Total patients"}
                  </div>
                  <div className="mt-1 text-4xl font-black tabular-nums text-[#274C5A]">
                    {selectedGenderCount.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mx-auto -mt-1 grid max-w-[390px] grid-cols-2 gap-2">
                {GENDERS.map((gender) => {
                  const count = genderCounts[gender.key];
                  const percentage =
                    gender.key === "male" ? malePercentage : femalePercentage;
                  const selected = selectedGender === gender.key;
                  return (
                    <button
                      key={gender.key}
                      type="button"
                      aria-pressed={selected}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-[#274C5A] bg-[#f1f8fa] ring-2 ring-[#274C5A]/10"
                          : selectedGender
                          ? "border-[#d8e6ea] bg-[#f8fbfc] opacity-45"
                          : "border-[#d8e6ea] bg-[#f8fbfc] hover:border-[#86A7B2]"
                      }`}
                      onClick={() =>
                        setSelectedGender((current) =>
                          current === gender.key ? null : gender.key
                        )
                      }
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full"
                        style={{ backgroundColor: gender.color }}
                      />
                      <span>
                        <span className="block text-sm font-bold text-[#607482]">
                          {gender.label}
                        </span>
                        <span className="mt-1 block text-lg font-black tabular-nums text-[#274C5A]">
                          {count.toLocaleString()} · {percentage}%
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <AnalyticsCard title="Top Projects by ePCR Volume">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.projects} margin={{ top: 24, right: 12, left: -8, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e6eef1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#607482" tickFormatter={(value) => truncateLabel(value, 14)} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} stroke="#8aa0a9" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="value"
                    radius={[12, 12, 4, 4]}
                    maxBarSize={72}
                    className="cursor-pointer"
                    onClick={(entry) => {
                      const name = String(entry.name || "");
                      if (name) {
                        setSelectedProject((current) => current === name ? "" : name);
                        clearInteractiveFilters();
                      }
                    }}
                  >
                    {analytics.projects.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} opacity={selectedProject && selectedProject !== entry.name ? 0.2 : 1} />)}
                    <LabelList dataKey="value" position="top" fill="#274C5A" fontSize={12} fontWeight={800} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCard>

            <section className="h-[352px] overflow-hidden rounded-2xl border border-[#d8e6ea] bg-white p-4 shadow-sm">
              <div>
                <div>
                  <h2 className="text-xl font-black text-[#274C5A]">
                    Triage Level Analysis
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#607482]">
                    Select a colored level to update Gender Distribution.
                  </p>
                </div>
              </div>

              {triageRecords.length === 0 ? (
                <div className="flex h-[390px] items-center justify-center text-sm font-bold text-[#607482]">
                  No completed ePCR records match the current filter.
                </div>
              ) : (
                <div className="mx-auto mt-5 max-w-[520px]">
                    <div className="grid items-center gap-3 sm:grid-cols-[1fr_150px]">
                      <svg viewBox="0 0 360 360" className="mx-auto w-full max-w-[255px] overflow-visible" role="img" aria-label="Radial triage level analysis">
                        {TRIAGE_LEVELS.map((level, index) => {
                          const count = triageCounts[level.key];
                          const radius = 145 - index * 20;
                          const circumference = 2 * Math.PI * radius;
                          const progress = count / maxTriageCount;
                          const selected = selectedTriage === level.key;
                          return (
                            <g
                              key={level.key}
                              role="button"
                              aria-label={`${level.label}, ${count} cases`}
                              className="cursor-pointer outline-none transition-all duration-300"
                              style={{
                                opacity: selectedTriage && !selected ? 0.16 : 1,
                                filter: selectedTriage && !selected ? "grayscale(0.75)" : "none",
                              }}
                              onClick={() => setSelectedTriage((current) => current === level.key ? null : level.key)}
                            >
                              <circle cx="180" cy="180" r={radius} fill="none" stroke="#edf2f4" strokeWidth={selected ? 15 : 12} />
                              <circle
                                cx="180" cy="180" r={radius} fill="none" stroke={level.color}
                                strokeWidth={selected ? 17 : 12} strokeLinecap="round"
                                strokeDasharray={`${circumference * progress} ${circumference}`}
                                transform="rotate(-90 180 180)"
                                className="transition-all duration-300"
                              />
                            </g>
                          );
                        })}
                        <circle cx="180" cy="180" r="36" fill="#274C5A" />
                        <text x="180" y="174" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">TOTAL</text>
                        <text x="180" y="196" textAnchor="middle" fill="white" fontSize="22" fontWeight="900">{triageRecords.length}</text>
                      </svg>
                      <div className="space-y-2">
                        {TRIAGE_LEVELS.map((level) => (
                          <button
                            key={level.key}
                            type="button"
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-black transition-all duration-300 ${selectedTriage === level.key ? "border-[#274C5A] bg-[#eef6f8] ring-2 ring-[#274C5A]/10" : selectedTriage ? "border-[#e2ebee] bg-[#f4f6f7] opacity-30 grayscale" : "border-[#e2ebee] hover:border-[#9bb0b8]"}`}
                            onClick={() => setSelectedTriage((current) => current === level.key ? null : level.key)}
                          >
                            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: level.color }} />{level.shortLabel}</span>
                            <span className="tabular-nums">{triageCounts[level.key]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <AnalyticsCard title="Health Classification Analysis">
              <div className="grid h-full items-center gap-2 sm:grid-cols-[minmax(190px,0.9fr)_1.1fr]">
                <div className="relative h-full min-h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="82%"
                        paddingAngle={3}
                        cornerRadius={7}
                        startAngle={90}
                        endAngle={-270}
                        className="cursor-pointer outline-none"
                        onClick={(entry) => {
                          const name = String(entry.name || "");
                          if (name) setSelectedHealth((current) => current === name ? null : name);
                        }}
                      >
                        {healthChartData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            opacity={selectedHealth && selectedHealth !== entry.name ? 0.14 : 1}
                            stroke={selectedHealth === entry.name ? "#274C5A" : "#ffffff"}
                            strokeWidth={selectedHealth === entry.name ? 4 : 2}
                            className="transition-all duration-300"
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="max-w-24 truncate text-[11px] font-bold uppercase tracking-wide text-[#718691]">
                      {selectedHealthItem?.name || "Total cases"}
                    </span>
                    <span className="mt-1 text-3xl font-black tabular-nums text-[#274C5A]">
                      {selectedHealthItem?.value ?? healthTotal}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {healthChartData.map((entry, index) => {
                    const selected = selectedHealth === entry.name;
                    const percentage = healthTotal ? Math.round((entry.value / healthTotal) * 100) : 0;
                    return (
                      <button
                        key={entry.name}
                        type="button"
                        aria-pressed={selected}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-300 ${selected ? "border-[#274C5A] bg-[#eef6f8] shadow-sm ring-2 ring-[#274C5A]/10" : selectedHealth ? "border-transparent bg-[#f5f7f8] opacity-30 grayscale" : "border-[#e4ecef] bg-[#fbfcfc] hover:-translate-y-0.5 hover:border-[#a9bdc4] hover:shadow-sm"}`}
                        onClick={() => setSelectedHealth((current) => current === entry.name ? null : entry.name)}
                      >
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black text-[#274C5A]">{entry.name}</span>
                        </span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-[#718691]">{percentage}%</span>
                        <span className="text-base font-black tabular-nums text-[#274C5A]">{entry.value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="Chief Complaints Analysis">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complaintChartData} layout="vertical" margin={{ top: 4, right: 38, left: 12, bottom: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="#e6eef1" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} stroke="#8aa0a9" />
                  <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} stroke="#607482" tickFormatter={(value) => truncateLabel(value, 22)} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="value"
                    radius={[4, 12, 12, 4]}
                    maxBarSize={22}
                    className="cursor-pointer"
                    onClick={(entry) => {
                      const name = String(entry.name || "");
                      if (name) setSelectedComplaint((current) => current === name ? null : name);
                    }}
                  >
                    {complaintChartData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} opacity={selectedComplaint && selectedComplaint !== entry.name ? 0.18 : 1} />)}
                    <LabelList dataKey="value" position="right" fill="#274C5A" fontSize={12} fontWeight={800} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCard>
          </div>

        </div>
      </div>
    </PermissionGuard>
  );
}

const CHART_COLORS = ["#8fd8e6", "#005f53", "#c81e1e", "#f6b31a", "#148f3d", "#2d5c88", "#9b95d9", "#70c7d9"];
const tooltipStyle = { backgroundColor: "#ffffff", border: "1px solid rgba(134, 167, 178, 0.35)", borderRadius: "12px", color: "#274C5A" };

function truncateLabel(text: string, max = 18) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function KpiCard({ title, value, subtitle }: { title: string; value: number | string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
      <div className="text-sm font-medium text-[#7F7F7F]">{title}</div>
      <div className="mt-2 break-words text-2xl font-black text-[#274C5A]">{value}</div>
      <div className="mt-2 text-xs text-[#7F7F7F]">{subtitle}</div>
    </div>
  );
}

function AnalyticsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="h-[352px] overflow-hidden rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
      <h2 className="mb-4 text-lg font-black text-[#274C5A]">{title}</h2>
      <div className="h-[270px]">{children}</div>
    </section>
  );
}
