"use client";

import { useEpcrDashboard } from "@/app/hooks/useEpcrDashboard";

export default function EpcrDashboardPage() {
  const { loading, stats } = useEpcrDashboard();

  if (loading || !stats) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">ePCR Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <div>Total Cases: {stats.totalCases}</div>
        <div>Male: {stats.gender.male}</div>
        <div>Female: {stats.gender.female}</div>
        <div>Avg Response Time: {stats.responseTime.avgMinutes} min</div>
      </div>
    </div>
  );
}
