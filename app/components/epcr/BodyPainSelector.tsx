"use client";

type Props = {
  values: string[];
  onChange: (vals: string[]) => void;
};

type Area = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const AREAS: Area[] = [
  // FRONT
  { id: "Head", label: "Head", x: 110, y: 20, w: 40, h: 30 },
  { id: "Neck", label: "Neck", x: 118, y: 55, w: 24, h: 18 },
  { id: "Chest", label: "Chest", x: 90, y: 75, w: 80, h: 45 },
  { id: "Abdomen", label: "Abdomen", x: 95, y: 125, w: 70, h: 40 },
  { id: "Pelvis", label: "Pelvis", x: 100, y: 170, w: 60, h: 30 },
  { id: "Left Arm", label: "Left Arm", x: 60, y: 80, w: 25, h: 90 },
  { id: "Right Arm", label: "Right Arm", x: 175, y: 80, w: 25, h: 90 },
  { id: "Left Leg", label: "Left Leg", x: 105, y: 210, w: 25, h: 110 },
  { id: "Right Leg", label: "Right Leg", x: 140, y: 210, w: 25, h: 110 },

  // BACK
  { id: "Back Head", label: "Back Head", x: 310, y: 20, w: 40, h: 30 },
  { id: "Back - Upper", label: "Back - Upper", x: 290, y: 70, w: 80, h: 60 },
  { id: "Back - Lower", label: "Back - Lower", x: 295, y: 135, w: 70, h: 55 },
  { id: "Back - Left Arm", label: "Back - Left Arm", x: 260, y: 80, w: 25, h: 90 },
  { id: "Back - Right Arm", label: "Back - Right Arm", x: 375, y: 80, w: 25, h: 90 },
  { id: "Back - Left Leg", label: "Back - Left Leg", x: 305, y: 210, w: 25, h: 110 },
  { id: "Back - Right Leg", label: "Back - Right Leg", x: 340, y: 210, w: 25, h: 110 },
];

export default function BodyPainSelector({ values, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(
      values.includes(id)
        ? values.filter((v) => v !== id)
        : [...values, id]
    );
  };

  return (
    <div className="border border-gray-700 rounded-lg bg-[#020617] p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-300">
          Click on body areas to select pain locations
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Selected:</span>
          <span className="text-xs px-2 py-1 rounded bg-[#0F172A] border border-gray-700 max-w-[280px] truncate">
            {values.length ? values.join(", ") : "—"}
          </span>

          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-[#0F172A]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* SVG BODY */}
      <svg viewBox="0 0 460 350" className="w-full">
        {/* Titles */}
        <text x="115" y="14" fill="#9CA3AF" fontSize="10">
          FRONT
        </text>
        <text x="315" y="14" fill="#9CA3AF" fontSize="10">
          BACK
        </text>

        {/* Silhouette */}
        <g opacity="0.25" fill="#94A3B8">
          <rect x="90" y="20" width="90" height="300" rx="40" />
          <rect x="290" y="20" width="90" height="300" rx="40" />
        </g>

        {/* Clickable areas */}
        {AREAS.map((a) => {
          const active = values.includes(a.id);
          return (
            <g key={a.id}>
              <rect
                x={a.x}
                y={a.y}
                width={a.w}
                height={a.h}
                rx={8}
                onClick={() => toggle(a.id)}
                cursor="pointer"
                fill={
                  active
                    ? "rgba(59,130,246,0.45)"
                    : "rgba(148,163,184,0.15)"
                }
                stroke={active ? "#60A5FA" : "rgba(148,163,184,0.35)"}
                strokeWidth={active ? 2 : 1}
              />
              <text
                x={a.x + 4}
                y={a.y + 14}
                fontSize="9"
                fill={active ? "#BFDBFE" : "#94A3B8"}
                pointerEvents="none"
              >
                {a.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
