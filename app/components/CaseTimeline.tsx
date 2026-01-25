"use client";

import { Timestamp } from "firebase/firestore";

interface TimelineProps {
  timeline: Record<string, any>; // intentionally flexible (important)
}

const ORDER = [
  "Received",
  "Assigned",
  "EnRoute",
  "OnScene",
  "Transporting",
  "Hospital",
  "Closed",
];

/* =========================
   SAFE TIME FORMATTER
========================= */
function formatTime(time: any): string | null {
  if (!time) return null;

  // Firestore Timestamp
  if (time instanceof Timestamp || typeof time.toDate === "function") {
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

  // String (legacy data)
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
    <div
      className="
        p-4 border rounded-lg shadow-sm mt-4
        bg-white text-gray-900
        dark:bg-gray-800 dark:border-gray-700 dark:text-white
      "
    >
      <h3 className="text-lg font-bold mb-3">Timeline</h3>

      <div className="flex items-center space-x-8 overflow-x-auto py-4">
        {ORDER.map((status, i) => {
          const rawTime = timeline?.[status];
          const displayTime = formatTime(rawTime);

          return (
            <div
              key={status}
              className="flex flex-col items-center relative min-w-[90px]"
            >
              {/* Connector */}
              {i !== 0 && (
                <div
                  className="
                    absolute -left-8 top-2 w-8 h-1
                    bg-gray-300 dark:bg-gray-600
                  "
                />
              )}

              {/* Dot */}
              <span
                className={`
                  w-4 h-4 rounded-full mb-2
                  ${displayTime ? "bg-green-500" : "bg-gray-400"}
                `}
              />

              {/* Label */}
              <span className="font-semibold text-sm text-center">
                {status}
              </span>

              {/* Time */}
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 h-4">
                {displayTime ?? "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
