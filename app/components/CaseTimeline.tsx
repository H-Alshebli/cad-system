"use client";

interface TimelineProps {
  timeline: Record<string, string>;
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

export default function CaseTimeline({ timeline }: TimelineProps) {
  return (
    <div
      className="
        p-4 border rounded-lg shadow-sm mt-4
        bg-white text-gray-900
        dark:bg-gray-800 dark:border-gray-700 dark:text-white
      "
    >
      <h3 className="text-lg font-bold mb-3 dark:text-white">Timeline</h3>

      {/* Timeline row */}
      <div className="flex items-center space-x-8 overflow-x-auto scrollbar-hide py-4">
        {ORDER.map((status, i) => {
          const time = timeline?.[status];

          return (
            <div key={status} className="flex flex-col items-center relative">
              {/* Connector line (except for first item) */}
              {i !== 0 && (
                <div
                  className="
                    absolute -left-8 top-2 w-8 h-1
                    bg-gray-300
                    dark:bg-gray-600
                  "
                ></div>
              )}

              {/* Dot */}
              <span
                className={`
                  w-4 h-4 rounded-full mb-2
                  ${time ? "bg-green-500" : "bg-gray-400 dark:bg-gray-500"}
                `}
              ></span>

              {/* Status label */}
              <span className="font-semibold text-sm dark:text-gray-200">
                {status}
              </span>

              {/* Timestamp */}
              {time && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {new Date(time).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
