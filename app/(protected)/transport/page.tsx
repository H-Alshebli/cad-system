// app/(protected)/transport/page.tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Area,
  AreaChart,
} from "recharts";

import { db } from "@/lib/firebase";
import PermissionGuard from "@/app/components/PermissionGuard";

import type { TransportRequest, TransportStatus } from "./types";
import { STATUS_LABEL } from "./constants";

type ViewMode = "classic" | "analytics";

type CountItem = {
  label: string;
  value: number;
};

const chartColors = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

function getRejectedLabel(x: TransportRequest): string {
  const status = x.status as TransportStatus;

  if (status !== "rejected") return STATUS_LABEL[status] || "—";

  const opsRejectNote = (x as any).opsDecisionNote?.trim?.() || "";
  const salesRejectNote = (x as any).salesRejectNote?.trim?.() || "";

  const salesRejected = !!((x as any).salesRejectedAt || salesRejectNote);
  const opsRejected = !!opsRejectNote;

  if (salesRejected) return "Rejected (Sales)";
  if (opsRejected) return "Rejected (Ops)";

  return STATUS_LABEL.rejected;
}

function toDate(value?: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatDateTime(value?: any) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString();
}

function getPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function toTopList(map: Record<string, number>, limit = 6): CountItem[] {
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function buildCountMap(items: TransportRequest[], getter: (x: TransportRequest) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const label = getter(item) || "Unknown";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function buildMonthlyTrend(items: TransportRequest[]) {
  const map: Record<string, number> = {};

  items.forEach((item) => {
    const date = toDate((item as any).createdAt) || toDate((item as any).serviceTime);
    if (!date) return;

    const key = date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });

    map[key] = (map[key] || 0) + 1;
  });

  return Object.entries(map).map(([label, value]) => ({
    label,
    value,
  }));
}

export default function TransportListPage() {
  const [items, setItems] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TransportStatus | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("classic");

  useEffect(() => {
    const q = query(collection(db, "transport_requests"), orderBy("createdAt", "desc"));

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
        console.error("Failed to load transport requests:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((x) => x.status === statusFilter);
  }, [items, statusFilter]);

  const analytics = useMemo(() => {
    const total = items.length;

    const newRequests = items.filter((x) => x.status === "new").length;
    const opsAvailable = items.filter((x) => x.status === "ops_available").length;
    const clientApproved = items.filter((x) => x.status === "client_approved").length;
    const assigned = items.filter((x) => x.status === "assigned").length;
    const rejected = items.filter((x) => x.status === "rejected").length;

    const rejectedBySales = items.filter((x) => {
      if (x.status !== "rejected") return false;
      const salesRejectNote = (x as any).salesRejectNote?.trim?.() || "";
      return !!((x as any).salesRejectedAt || salesRejectNote);
    }).length;

    const rejectedByOps = items.filter((x) => {
      if (x.status !== "rejected") return false;

      const opsRejectNote = (x as any).opsDecisionNote?.trim?.() || "";
      const salesRejectNote = (x as any).salesRejectNote?.trim?.() || "";
      const salesRejected = !!((x as any).salesRejectedAt || salesRejectNote);

      return !!opsRejectNote && !salesRejected;
    }).length;

    const insideCity = items.filter((x) => x.cityScope === "inside").length;
    const outsideCity = items.filter((x) => x.cityScope === "outside").length;

    const conversionRate = getPercent(clientApproved + assigned, total);
    const rejectionRate = getPercent(rejected, total);
    const assignmentRate = getPercent(assigned, total);
    const opsAvailabilityRate = getPercent(
      opsAvailable + clientApproved + assigned,
      total
    );

    const upcomingRequests = items
      .filter((x) => {
        const serviceDate = toDate((x as any).serviceTime);
        return serviceDate && serviceDate >= new Date();
      })
      .sort((a, b) => {
        const aTime = toDate((a as any).serviceTime)?.getTime() || 0;
        const bTime = toDate((b as any).serviceTime)?.getTime() || 0;
        return aTime - bTime;
      })
      .slice(0, 6);

    const latestRejected = items.filter((x) => x.status === "rejected").slice(0, 5);

    const statusBreakdown: CountItem[] = [
      { label: "New", value: newRequests },
      { label: "Ops Available", value: opsAvailable },
      { label: "Client Approved", value: clientApproved },
      { label: "Assigned", value: assigned },
      { label: "Rejected", value: rejected },
    ];

    const cityScopeBreakdown: CountItem[] = [
      { label: "Inside City", value: insideCity },
      { label: "Outside City", value: outsideCity },
    ];

    const rejectionBreakdown: CountItem[] = [
      { label: "Rejected by Sales", value: rejectedBySales },
      { label: "Rejected by Operations", value: rejectedByOps },
    ];

    const topCities = toTopList(
      buildCountMap(items, (x) => String(x.cityName || "Unknown")),
      6
    );

    const topServices = toTopList(
      buildCountMap(items, (x) => String(x.serviceType || "Unknown")),
      6
    );

    const monthlyTrend = buildMonthlyTrend(items);

    return {
      total,
      newRequests,
      opsAvailable,
      clientApproved,
      assigned,
      rejected,
      rejectedBySales,
      rejectedByOps,
      insideCity,
      outsideCity,
      conversionRate,
      rejectionRate,
      assignmentRate,
      opsAvailabilityRate,
      upcomingRequests,
      latestRejected,
      statusBreakdown,
      cityScopeBreakdown,
      rejectionBreakdown,
      topCities,
      topServices,
      monthlyTrend,
    };
  }, [items]);

  return (
    <PermissionGuard module="transport" action="view" showMessage={true}>
      <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 dark:bg-[#020817] dark:text-white lg:px-6">
        <div className="w-full space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Transporting / Coverage
                </div>

                <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  Transport Requests
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Manage ambulance transporting and coverage requests from sales
                  initiation, operations availability confirmation, client approval,
                  and final team assignment.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => setViewMode("classic")}
                    className={`h-10 rounded-xl px-4 text-sm font-black transition ${
                      viewMode === "classic"
                        ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Classic View
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("analytics")}
                    className={`h-10 rounded-xl px-4 text-sm font-black transition ${
                      viewMode === "analytics"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Analytics Dashboard
                  </button>
                </div>

                {viewMode === "classic" && (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="all">All statuses</option>
                    <option value="new">{STATUS_LABEL.new}</option>
                    <option value="ops_available">{STATUS_LABEL.ops_available}</option>
                    <option value="rejected">{STATUS_LABEL.rejected}</option>
                    <option value="client_approved">{STATUS_LABEL.client_approved}</option>
                    <option value="assigned">{STATUS_LABEL.assigned}</option>
                  </select>
                )}

                <Link
                  href="/transport/new"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  New Request
                </Link>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              Loading...
            </div>
          ) : viewMode === "analytics" ? (
            <TransportAnalyticsDashboard data={analytics} />
          ) : (
            <ClassicTransportView filtered={filtered} />
          )}
        </div>
      </main>
    </PermissionGuard>
  );
}

function ClassicTransportView({ filtered }: { filtered: TransportRequest[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="grid grid-cols-12 gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
        <div className="col-span-3">Service Type</div>
        <div className="col-span-3">Time</div>
        <div className="col-span-2">City Scope</div>
        <div className="col-span-2">City</div>
        <div className="col-span-2">Status</div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          No transport requests yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filtered.map((x) => (
            <Link
              key={x.id}
              href={`/transport/${x.id}`}
              className="grid grid-cols-12 items-center px-4 py-4 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="col-span-3">
                <div className="font-black text-slate-950 dark:text-white">
                  {x.serviceType || "—"}
                </div>

                <div className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                  {x.requirements || ""}
                </div>
              </div>

              <div className="col-span-3 font-semibold text-slate-700 dark:text-slate-300">
                {formatDateTime((x as any).serviceTime)}
              </div>

              <div className="col-span-2 font-semibold text-slate-700 dark:text-slate-300">
                {x.cityScope === "inside" ? "Inside City" : "Outside City"}
              </div>

              <div className="col-span-2 font-semibold text-slate-700 dark:text-slate-300">
                {x.cityName || "—"}
              </div>

              <div className="col-span-2">
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {getRejectedLabel(x)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TransportAnalyticsDashboard({
  data,
}: {
  data: {
    total: number;
    newRequests: number;
    opsAvailable: number;
    clientApproved: number;
    assigned: number;
    rejected: number;
    rejectedBySales: number;
    rejectedByOps: number;
    insideCity: number;
    outsideCity: number;
    conversionRate: number;
    rejectionRate: number;
    assignmentRate: number;
    opsAvailabilityRate: number;
    upcomingRequests: TransportRequest[];
    latestRejected: TransportRequest[];
    statusBreakdown: CountItem[];
    cityScopeBreakdown: CountItem[];
    rejectionBreakdown: CountItem[];
    topCities: CountItem[];
    topServices: CountItem[];
    monthlyTrend: CountItem[];
  };
}) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5 dark:border-slate-800 dark:from-blue-950/30 dark:via-slate-900/80 dark:to-emerald-950/20">
          <div className="mb-2 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Executive Analytics Dashboard
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                Transporting & Coverage Performance
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                A management view that summarizes sales requests, operations
                availability, client approval, assignment progress, demand
                distribution, and rejection analysis.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                Total Requests
              </div>
              <div className="text-3xl font-black text-slate-950 dark:text-white">
                {data.total}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <ModernKpiCard
            label="New Requests"
            value={data.newRequests}
            helper="Waiting for operations review"
            color="#2563eb"
          />
          <ModernKpiCard
            label="Ops Available"
            value={data.opsAvailable}
            helper="Resources confirmed by operations"
            color="#10b981"
          />
          <ModernKpiCard
            label="Client Approved"
            value={data.clientApproved}
            helper="Confirmed by sales with client"
            color="#8b5cf6"
          />
          <ModernKpiCard
            label="Assigned"
            value={data.assigned}
            helper="Team assigned for execution"
            color="#f59e0b"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          title="Conversion Rate"
          value={`${data.conversionRate}%`}
          description="Client approved + assigned"
          progress={data.conversionRate}
          color="#2563eb"
        />
        <MetricCard
          title="Ops Availability"
          value={`${data.opsAvailabilityRate}%`}
          description="Requests moved beyond review"
          progress={data.opsAvailabilityRate}
          color="#10b981"
        />
        <MetricCard
          title="Assignment Rate"
          value={`${data.assignmentRate}%`}
          description="Requests with assigned teams"
          progress={data.assignmentRate}
          color="#f59e0b"
        />
        <MetricCard
          title="Rejection Rate"
          value={`${data.rejectionRate}%`}
          description="Rejected by sales or operations"
          progress={data.rejectionRate}
          color="#ef4444"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel title="Status Breakdown" subtitle="Pie chart by request status">
          <PieAnalyticsChart data={data.statusBreakdown} />
        </ChartPanel>

        <ChartPanel title="City Scope" subtitle="Inside city vs outside city">
          <DonutAnalyticsChart data={data.cityScopeBreakdown} />
        </ChartPanel>

        <ChartPanel title="Rejection Source" subtitle="Sales and operations rejection">
          <PieAnalyticsChart data={data.rejectionBreakdown} />
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Top Cities" subtitle="Highest demand by city">
          <BarAnalyticsChart data={data.topCities} />
        </ChartPanel>

        <ChartPanel title="Top Service Types" subtitle="Demand by service type">
          <HorizontalBarAnalyticsChart data={data.topServices} />
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Monthly Request Trend" subtitle="Request volume over time">
          <AreaAnalyticsChart data={data.monthlyTrend} />
        </ChartPanel>

        <ChartPanel title="Status Distribution" subtitle="Column chart by status">
          <ColumnAnalyticsChart data={data.statusBreakdown} />
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsPanel title="Upcoming Transport Requests" subtitle="Nearest scheduled requests">
          {data.upcomingRequests.length === 0 ? (
            <EmptyState text="No upcoming requests available." />
          ) : (
            <div className="space-y-3">
              {data.upcomingRequests.map((x) => (
                <Link
                  key={x.id}
                  href={`/transport/${x.id}`}
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:bg-slate-800/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-950 dark:text-white">
                        {x.serviceType || "—"}
                      </div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {x.cityName || "—"} •{" "}
                        {x.cityScope === "inside" ? "Inside City" : "Outside City"}
                      </div>
                    </div>

                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-700 dark:text-blue-300">
                      {getRejectedLabel(x)}
                    </span>
                  </div>

                  <div className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {formatDateTime((x as any).serviceTime)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AnalyticsPanel>

        <AnalyticsPanel title="Latest Rejected Requests" subtitle="Requests requiring management review">
          {data.latestRejected.length === 0 ? (
            <EmptyState text="No rejected requests found." />
          ) : (
            <div className="space-y-3">
              {data.latestRejected.map((x) => (
                <Link
                  key={x.id}
                  href={`/transport/${x.id}`}
                  className="block rounded-2xl border border-red-500/20 bg-red-500/5 p-4 transition hover:bg-red-500/10 dark:border-red-500/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-950 dark:text-white">
                        {x.serviceType || "—"}
                      </div>

                      <div className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                        {x.requirements || "No requirements provided."}
                      </div>
                    </div>

                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-black text-red-700 dark:text-red-300">
                      {getRejectedLabel(x)}
                    </span>
                  </div>

                  <div className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {x.cityName || "—"} • {formatDateTime((x as any).serviceTime)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AnalyticsPanel>
      </div>
    </div>
  );
}

function ModernKpiCard({
  label,
  value,
  helper,
  color,
}: {
  label: string;
  value: number;
  helper: string;
  color: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:bg-slate-800/70">
      <div
        className="mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide"
        style={{
          color,
          borderColor: `${color}33`,
          backgroundColor: `${color}14`,
        }}
      >
        {label}
      </div>

      <div className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
        {value}
      </div>

      <div className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
        {helper}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  progress,
  color,
}: {
  title: string;
  value: string;
  description: string;
  progress: number;
  color: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="text-sm font-black text-slate-700 dark:text-slate-200">
        {title}
      </div>

      <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
        {value}
      </div>

      <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(progress, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-5">
        <h3 className="text-lg font-black text-slate-950 dark:text-white">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      <div className="h-[280px]">{children}</div>
    </div>
  );
}

function AnalyticsPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-5">
        <h3 className="text-lg font-black text-slate-950 dark:text-white">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}

function PieAnalyticsChart({ data }: { data: CountItem[] }) {
  if (!data.length) return <EmptyState text="No data available." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label
        >
          {data.map((_, index) => (
            <Cell key={index} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function DonutAnalyticsChart({ data }: { data: CountItem[] }) {
  if (!data.length) return <EmptyState text="No data available." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={5}
          label
        >
          {data.map((_, index) => (
            <Cell key={index} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarAnalyticsChart({ data }: { data: CountItem[] }) {
  if (!data.length) return <EmptyState text="No data available." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={chartColors[index % chartColors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarAnalyticsChart({ data }: { data: CountItem[] }) {
  if (!data.length) return <EmptyState text="No data available." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[0, 10, 10, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={chartColors[index % chartColors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ColumnAnalyticsChart({ data }: { data: CountItem[] }) {
  if (!data.length) return <EmptyState text="No data available." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" radius={[12, 12, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={chartColors[index % chartColors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AreaAnalyticsChart({ data }: { data: CountItem[] }) {
  if (!data.length) return <EmptyState text="No trend data available." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.18}
          strokeWidth={3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
      {text}
    </div>
  );
}