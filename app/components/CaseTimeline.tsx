"use client";

import { Timestamp } from "firebase/firestore";

interface TimelineProps {
  timeline: Record<string, any>;
}

/**
 * label = UI text
 * newKey = new Firestore key
 * oldKey = legacy Firestore key
 */
const STEPS = [
  { label: "Received", newKey: "receivedAt", oldKey: "Received" },
  { label: "Assigned", newKey: "assignedAt", oldKey: "Assigned" },
  { label: "EnRoute", newKey: "enRouteAt", oldKey: "EnRoute" },
  { label: "OnScene", newKey: "onSceneAt", oldKey: "OnScene" },
  { label: "Transporting", newKey: "transportingAt", oldKey: "Transporting" },
  { label: "Hospital", newKey: "hospitalAt", oldKey: "Hospital" },
  { label: "Closed", newKey: "closedAt", oldKey: "Closed" },
];

/* =========================
   SAFE TIME FORMATTER
========================= */
function formatTime(time: any): string | null {
  if (!time) return null;

  // Firestore Timestamp
  if (time instanceof Timestamp || typeof time?.toDate === "function") {
    const d = time.toDate();
    return isNaN(d.getTime())
      ? null
      : d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  // JS Date
  if (time instanceof Date) {
    return isNaN(time.getTime())
      ? null
      : time.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  // String (legacy)
  if (typeof time === "string") {
    const d = new Date(time);
    return isNaN(d.getTime())
      ? null
      : d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  return null;
}

/* =========================
   COMPONENT
========================= */
export default function CaseTimeline({ timeline }: TimelineProps) {
  return (
    <div className="rounded-xl border border-[#86A7B2]/25 bg-[#f8fbfc] p-4 text-[#274C5A]">
      <h3 className="mb-3 text-lg font-black">Timeline</h3>

      <div className="flex items-center space-x-8 overflow-x-auto py-4">
        {STEPS.map((step, i) => {
          // 🔑 NEW → OLD fallback
          const rawTime =
            timeline?.[step.newKey] ??
            timeline?.[step.oldKey];

          const displayTime = formatTime(rawTime);

          return (
            <div
              key={step.label}
              className="flex flex-col items-center relative min-w-[90px]"
            >
              {/* Connector */}
              {i !== 0 && (
                <div className="absolute -left-8 top-2 h-1 w-8 rounded-full bg-[#86A7B2]/45" />
              )}

              {/* Dot */}
              <span
                className={`mb-2 h-4 w-4 rounded-full border-2 ${
                  displayTime
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-[#86A7B2]/70 bg-white"
                }`}
              />

              {/* Label */}
              <span className="text-center text-sm font-black text-[#274C5A]">
                {step.label}
              </span>

              {/* Time */}
              <p className="mt-1 h-4 text-xs font-semibold text-[#7F7F7F]">
                {displayTime ?? "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
