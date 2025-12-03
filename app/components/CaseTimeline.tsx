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
    <div className="p-4 border rounded-lg bg-white shadow-sm mt-4">
      <h3 className="text-lg font-bold mb-3">Timeline</h3>

      {/* HORIZONTAL LIST */}
      <div className="flex items-center space-x-8 overflow-x-auto scrollbar-hide py-4">

        {ORDER.map((status, i) => {
          const time = timeline?.[status];

          return (
            <div key={status} className="flex flex-col items-center relative">

              {/* Connector Line */}
              {i !== 0 && (
                <div className="absolute -left-8 top-2 w-8 h-1 bg-gray-300"></div>
              )}

              {/* Status Dot */}
              <span
                className={`w-4 h-4 rounded-full mb-2 ${
                  time ? "bg-green-500" : "bg-gray-400"
                }`}
              ></span>

              {/* Label */}
              <span className="font-semibold text-sm">{status}</span>

              {/* Time */}
              {time && (
                <p className="text-xs text-gray-600 mt-1">
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
