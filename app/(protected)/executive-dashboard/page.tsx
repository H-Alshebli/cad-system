"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

type TransportStatus =
  | "new"
  | "ops_available"
  | "rejected"
  | "client_approved"
  | "assigned";

type TransportRequest = {
  id: string;
  serviceType?: string;
  requirements?: string;
  serviceTime?: string;
  cityScope?: "inside" | "outside" | string;
  cityName?: string;
  status?: TransportStatus | string;
  createdAt?: Timestamp | Date | null;

  clientName?: string;
  projectName?: string;

  opsDecisionNote?: string;
  salesRejectNote?: string;
  salesRejectedAt?: any;

  teamName?: string;
  assignedTeam?: string;
  ambulanceName?: string;

  feedbackScore?: number | null;
};

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value?: string | Timestamp | Date | null) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString();
}

function formatMonth(date: Date) {
  return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function getRejectedLabel(x: TransportRequest): string {
  const status = x.status as TransportStatus;

  if (status !== "rejected") return getStatusLabel(status);

  const opsRejectNote = x.opsDecisionNote?.trim?.() || "";
  const salesRejectNote = x.salesRejectNote?.trim?.() || "";

  const salesRejected = !!(x.salesRejectedAt || salesRejectNote);
  const opsRejected = !!opsRejectNote;

  if (salesRejected) return "Rejected (Sales)";
  if (opsRejected) return "Rejected (Ops)";
  return "Rejected";
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "new":
      return "New";
    case "ops_available":
      return "Ops Available";
    case "rejected":
      return "Rejected";
    case "client_approved":
      return "Client Approved";
    case "assigned":
      return "Assigned";
    default:
      return status || "—";
  }
}

function getStatusBadgeClass(status?: string) {
  switch (status) {
    case "new":
      return "bg-blue-500/15 text-blue-300 ring-blue-400/20";
    case "ops_available":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20";
    case "rejected":
      return "bg-red-500/15 text-red-300 ring-red-400/20";
    case "client_approved":
      return "bg-amber-500/15 text-amber-300 ring-amber-400/20";
    case "assigned":
      return "bg-violet-500/15 text-violet-300 ring-violet-400/20";
    default:
      return "bg-white/10 text-white/80 ring-white/10";
  }
}

export default function ExecutiveDashboardPage() {
  const [items, setItems] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "transport_requests"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: TransportRequest[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setItems(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Executive dashboard load error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const kpis = useMemo(() => {
    const total = items.length;
    const newCount = items.filter((x) => x.status === "new").length;
    const opsAvailable = items.filter((x) => x.status === "ops_available").length;
    const rejected = items.filter((x) => x.status === "rejected").length;
    const clientApproved = items.filter((x) => x.status === "client_approved").length;
    const assigned = items.filter((x) => x.status === "assigned").length;
    const insideCity = items.filter((x) => x.cityScope === "inside").length;
    const outsideCity = items.filter((x) => x.cityScope === "outside").length;

    const feedbackScores = items
      .map((x) => x.feedbackScore)
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    const avgFeedback =
      feedbackScores.length > 0
        ? Number(
            (
              feedbackScores.reduce((sum, val) => sum + val, 0) /
              feedbackScores.length
            ).toFixed(1)
          )
        : 0;

    return {
      total,
      newCount,
      opsAvailable,
      rejected,
      clientApproved,
      assigned,
      insideCity,
      outsideCity,
      avgFeedback,
    };
  }, [items]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        total: number;
        assigned: number;
        rejected: number;
      }
    >();

    const sorted = [...items]
      .map((item) => ({
        ...item,
        createdDate: toDate(item.createdAt) || toDate(item.serviceTime),
      }))
      .filter((item) => item.createdDate)
      .sort((a, b) => a.createdDate!.getTime() - b.createdDate!.getTime());

    sorted.forEach((item) => {
      const key = formatMonth(item.createdDate!);

      if (!map.has(key)) {
        map.set(key, {
          month: key,
          total: 0,
          assigned: 0,
          rejected: 0,
        });
      }

      const row = map.get(key)!;
      row.total += 1;
      if (item.status === "assigned") row.assigned += 1;
      if (item.status === "rejected") row.rejected += 1;
    });

    return Array.from(map.values()).slice(-6);
  }, [items]);

  const statusData = useMemo(
    () => [
      { name: "New", value: kpis.newCount },
      { name: "Ops Available", value: kpis.opsAvailable },
      { name: "Rejected", value: kpis.rejected },
      { name: "Client Approved", value: kpis.clientApproved },
      { name: "Assigned", value: kpis.assigned },
    ],
    [kpis]
  );

  const cityScopeData = useMemo(
    () => [
      { name: "Inside City", value: kpis.insideCity },
      { name: "Outside City", value: kpis.outsideCity },
    ],
    [kpis]
  );

  const serviceTypeData = useMemo(() => {
    const map = new Map<string, number>();

    items.forEach((x) => {
      const key = x.serviceType?.trim() || "Unknown";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [items]);

  const topCities = useMemo(() => {
    const map = new Map<string, number>();

    items.forEach((x) => {
      const city = x.cityName?.trim() || "Unknown";
      map.set(city, (map.get(city) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([city, requests]) => ({ city, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 7);
  }, [items]);

  const recentRequests = useMemo(() => items.slice(0, 8), [items]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020817] p-6 text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold">Executive Dashboard</h1>
          <p className="mt-2 text-sm text-white/70">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020817] p-6 text-white">
      <div className="w-full space-y-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl">
          <h1 className="text-3xl font-bold tracking-tight">
            HCAD Executive Analytics Dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Executive view for Transport Requests showing operational volume,
            request status, city distribution, service types, and recent activity.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Total Requests" value={kpis.total} subtitle="All requests in the system" />
          <KpiCard title="Assigned Requests" value={kpis.assigned} subtitle="Operationally assigned" />
          <KpiCard title="Rejected Requests" value={kpis.rejected} subtitle="Sales or Ops rejected" />
          <KpiCard title="Ops Available" value={kpis.opsAvailable} subtitle="Available for next step" />

          <KpiCard title="Client Approved" value={kpis.clientApproved} subtitle="Approved by client" />
          <KpiCard title="Inside City" value={kpis.insideCity} subtitle="Within city scope" />
          <KpiCard title="Outside City" value={kpis.outsideCity} subtitle="Outside city scope" />
          <KpiCard
            title="Avg Feedback"
            value={kpis.avgFeedback ? `${kpis.avgFeedback}/5` : "—"}
            subtitle="When feedback is added"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DarkCard title="Request Trend">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
                  <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.6)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} />
                  <Line type="monotone" dataKey="assigned" stroke="#22c55e" strokeWidth={3} />
                  <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DarkCard>

          <DarkCard title="Status Distribution">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                    label
                  >
                    {statusData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DarkCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DarkCard title="Top Service Types">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" />
                  <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.6)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DarkCard>

          <DarkCard title="City Scope">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityScopeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" />
                  <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.6)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DarkCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <DarkCard title="Top Cities">
            <div className="space-y-3">
              {topCities.length === 0 ? (
                <div className="text-sm text-white/60">No city data available.</div>
              ) : (
                topCities.map((row) => (
                  <div
                    key={row.city}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <span className="text-sm text-white/80">{row.city}</span>
                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300 ring-1 ring-blue-400/20">
                      {row.requests} requests
                    </span>
                  </div>
                ))
              )}
            </div>
          </DarkCard>

          <DarkCard title="Executive Insight">
            <div className="space-y-3 text-sm text-white/75">
              <p>
                This dashboard gives management a real-time picture of transport
                request activity, current operational status, and service demand by city.
              </p>
              <p>
                It helps leadership quickly identify request volume, approval flow,
                rejected cases, and service distribution across locations.
              </p>
              <p>
                As the system grows, this page can also include revenue, response time,
                client feedback, and fleet utilization.
              </p>
            </div>
          </DarkCard>

          <DarkCard title="Next Additions">
            <ul className="space-y-2 text-sm text-white/75">
              <li>• Date range filter</li>
              <li>• Client / project filter</li>
              <li>• Export to Excel / PDF</li>
              <li>• Revenue analytics</li>
              <li>• Ambulance utilization</li>
              <li>• Client satisfaction trend</li>
            </ul>
          </DarkCard>
        </div>

        <DarkCard title="Recent Transport Requests">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/60">
                  <th className="px-4 py-3 font-medium">Service Type</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">City Scope</th>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-white/60">
                      No requests found.
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((x) => (
                    <tr
                      key={x.id}
                      className="border-b border-white/5 transition hover:bg-white/5"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{x.serviceType || "—"}</div>
                        <div className="mt-1 max-w-[280px] truncate text-xs text-white/50">
                          {x.requirements || ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {formatDateTime(x.serviceTime)}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {x.cityScope === "inside" ? "Inside City" : "Outside City"}
                      </td>
                      <td className="px-4 py-3 text-white/75">{x.cityName || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(
                            x.status
                          )}`}
                        >
                          {x.status === "rejected"
                            ? getRejectedLabel(x)
                            : getStatusLabel(x.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DarkCard>
      </div>
    </div>
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
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="text-sm font-medium text-white/60">{title}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-xs text-white/50">{subtitle}</div>
    </div>
  );
}