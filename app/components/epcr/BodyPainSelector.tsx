"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import html2canvas from "html2canvas";

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

const BodyPainSelector = forwardRef(function BodyPainSelector(
  { values, onChange }: Props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    onChange(
      values.includes(id)
        ? values.filter((v) => v !== id)
        : [...values, id]
    );
  };

  // 🔥 EXPOSE EXPORT FUNCTION
  useImperativeHandle(ref, () => ({
    async exportImage(): Promise<string | null> {
      if (!containerRef.current) return null;

      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: "#020617",
        scale: 2,
      });

      return canvas.toDataURL("image/png");
    },
  }));

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-4"
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#274C5A]">
          Click on body areas to select pain locations
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-[#607482]">Selected:</span>
          <span className="max-w-[280px] truncate rounded-full border border-[#c8dce2] bg-white px-2 py-1 text-xs font-semibold text-[#274C5A]">
            {values.length ? values.join(", ") : "—"}
          </span>

          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-full border border-[#c8dce2] bg-white px-2 py-1 text-xs font-black text-[#274C5A] hover:border-[#74cdda]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* SVG BODY */}
      <svg viewBox="0 0 460 350" className="w-full">
        <text x="115" y="14" fill="#607482" fontSize="10">
          FRONT
        </text>
        <text x="315" y="14" fill="#607482" fontSize="10">
          BACK
        </text>

        <g opacity="0.28" fill="#74CDDA">
          <rect x="90" y="20" width="90" height="300" rx="40" />
          <rect x="290" y="20" width="90" height="300" rx="40" />
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
                cursor="pointer"
                fill={
                  active
                    ? "rgba(39,76,90,0.38)"
                    : "rgba(116,205,218,0.16)"
                }
                stroke={active ? "#274C5A" : "rgba(39,76,90,0.25)"}
                strokeWidth={active ? 2 : 1}
              />
              <text
                x={a.x + 4}
                y={a.y + 14}
                fontSize="9"
                fill={active ? "#123746" : "#607482"}
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
});

export default BodyPainSelector;
