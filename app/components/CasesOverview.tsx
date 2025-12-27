"use client";

import CaseTimeline from "@/app/components/CaseTimeline";

export default function CasesOverview({
  title,
  cases,
  ambulances = [],
}: {
  title: string;
  cases: any[];
  ambulances?: any[];
}) {
  /* =========================
     STATS (نفس الداشبورد)
  ========================= */
  const totalCases = cases.length;

  const onSceneCases = cases.filter(
    (c) => c.status === "OnScene"
  ).length;

  const enRouteCases = cases.filter(
    (c) => c.status === "EnRoute"
  ).length;

  const activeCases = cases.filter(
    (c) => c.status !== "Closed"
  ).length;

  const closedCases = cases.filter(
    (c) => c.status === "Closed"
  ).length;

  const unreceivedCases = cases.filter(
    (c) => c.status === "Assigned" || c.status === "Received"
  ).length;

  const transportingCases = cases.filter(
    (c) => ["Transporting", "Hospital"].includes(c.status)
  ).length;

  const transportingHospitalCases = cases.filter(
    (c) =>
      ["Transporting", "Hospital"].includes(c.status) &&
      c.transportingToType === "hospital"
  ).length;

  const transportingClinicCases = cases.filter(
    (c) =>
      ["Transporting", "Hospital"].includes(c.status) &&
      c.transportingToType === "clinic"
  ).length;

  const closedHospitalCases = cases.filter(
    (c) =>
      c.status === "Closed" &&
      c.transportingToType === "hospital"
  ).length;

  const closedClinicCases = cases.filter(
    (c) =>
      c.status === "Closed" &&
      c.transportingToType === "clinic"
  ).length;

  const totalAmbulances = ambulances.length;

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">
        {title}
      </h1>

      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <Card title="Total Cases" value={totalCases} big />
        <Card title="Active" value={activeCases} />
        <Card title="Unreceived from team" value={unreceivedCases} />
        <Card title="EnRoute" value={enRouteCases} />
        <Card title="OnScene" value={onSceneCases} />

        <Card
          title="Transporting"
          value={transportingCases}
          sub={`Hospital: ${transportingHospitalCases} - Clinic: ${transportingClinicCases}`}
          color="orange"
        />

        <Card
          title="Treated"
          value={closedCases}
          sub={`Hospital: ${closedHospitalCases} - Clinic: ${closedClinicCases}`}
        />

        {ambulances.length > 0 && (
          <Card
            title="Ambulances"
            value={totalAmbulances}
            color="purple"
          />
        )}
      </div>

      {/* ===== CASE LIST ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cases.map((c) => (
          <div
            key={c.id}
            className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
          >
            <h2 className="text-xl font-bold">
              Lazem Code: {c.lazemCode || "—"} — {c.level}
            </h2>

            <p className="text-gray-400">
              Ijrny Code: {c.ijrny || "—"}
            </p>

            <CaseTimeline timeline={c.timeline || {}} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   CARD COMPONENT
========================= */
function Card({
  title,
  value,
  sub,
  big,
  color = "blue",
}: {
  title: string;
  value: number;
  sub?: string;
  big?: boolean;
  color?: "blue" | "orange" | "purple";
}) {
  const colorMap: any = {
    blue: "text-blue-600",
    orange: "text-orange-600",
    purple: "text-purple-600",
  };

  return (
    <div className="p-4 border rounded shadow bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
      <h3 className={big ? "text-lg font-bold" : "text-sm text-gray-400"}>
        {title}
      </h3>
      <p
        className={`${
          big ? "text-4xl" : "text-2xl"
        } font-extrabold ${colorMap[color]}`}
      >
        {value}
      </p>
      {sub && <p className="text-gray-400">{sub}</p>}
    </div>
  );
}
