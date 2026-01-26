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
    <div className="p-4 border rounded-lg bg-[#1c2333] border-gray-700 text-white">
      <h3 className="text-lg font-bold mb-3">Timeline</h3>

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
                <div className="absolute -left-8 top-2 w-8 h-1 bg-gray-600" />
              )}

              {/* Dot */}
              <span
                className={`w-4 h-4 rounded-full mb-2 ${
                  displayTime ? "bg-green-500" : "bg-gray-500"
                }`}
              />

              {/* Label */}
              <span className="font-semibold text-sm text-center">
                {step.label}
              </span>

              {/* Time */}
              <p className="text-xs text-gray-300 mt-1 h-4">
                {displayTime ?? "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
