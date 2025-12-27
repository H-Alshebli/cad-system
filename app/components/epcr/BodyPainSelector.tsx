"use client";

type Props = {
  values: string[];
  onChange: (vals: string[]) => void;
};

const AREAS = [
  // FRONT
  { id: "Head", label: "Head", x: 135, y: 18, w: 30, h: 30 },
  { id: "Neck", label: "Neck", x: 140, y: 48, w: 20, h: 16 },
  { id: "Chest", label: "Chest", x: 115, y: 65, w: 70, h: 45 },
  { id: "Abdomen", label: "Abdomen", x: 120, y: 112, w: 60, h: 40 },
  { id: "Pelvis", label: "Pelvis", x: 125, y: 152, w: 50, h: 30 },
  { id: "Left Arm", label: "Left Arm", x: 85, y: 70, w: 25, h: 85 },
  { id: "Right Arm", label: "Right Arm", x: 190, y: 70, w: 25, h: 85 },
  { id: "Left Leg", label: "Left Leg", x: 135, y: 182, w: 25, h: 110 },
  { id: "Right Leg", label: "Right Leg", x: 165, y: 182, w: 25, h: 110 },

  // BACK
  { id: "Back Head", label: "Back Head", x: 285, y: 20, w: 30, h: 30 },
  { id: "Back - Upper", label: "Back - Upper", x: 270, y: 60, w: 70, h: 60 },
  { id: "Back - Lower", label: "Back - Lower", x: 275, y: 130, w: 60, h: 55 },
  { id: "Back - Left Arm", label: "Back - Left Arm", x: 245, y: 70, w: 22, h: 90 },
  { id: "Back - Right Arm", label: "Back - Right Arm", x: 345, y: 70, w: 22, h: 90 },
  { id: "Back - Left Leg", label: "Back - Left Leg", x: 285, y: 190, w: 25, h: 110 },
  { id: "Back - Right Leg", label: "Back - Right Leg", x: 315, y: 190, w: 25, h: 110 },
];

export default function BodyPainSelector({ values, onChange }: Props) {
  const toggle = (id: string) => {
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg bg-[#020617] p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-gray-300">
          Click on body areas to select pain locations
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Selected:</span>
          <span className="text-xs px-2 py-1 rounded bg-[#0F172A] border border-gray-700">
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

      <svg viewBox="0 0 420 320" className="w-full">
        <text x="125" y="14" fill="#9CA3AF" fontSize="10">FRONT</text>
        <text x="295" y="14" fill="#9CA3AF" fontSize="10">BACK</text>

        <g opacity="0.25" fill="#94A3B8">
          <rect x="120" y="20" width="60" height="290" rx="20" />
          <rect x="265" y="20" width="60" height="290" rx="20" />
        </g>

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
                style={{ cursor: "pointer" }}
                fill={active ? "rgba(59,130,246,0.45)" : "rgba(148,163,184,0.12)"}
                stroke={active ? "#60A5FA" : "rgba(148,163,184,0.35)"}
                strokeWidth={active ? 2 : 1}
              />
              <text
                x={a.x + 4}
                y={a.y + 12}
                fontSize="8"
                fill={active ? "#BFDBFE" : "#94A3B8"}
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
