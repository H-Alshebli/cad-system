"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import html2canvas from "html2canvas";

type Props = {
  values: string[];
  onChange: (vals: string[]) => void;
  disabled?: boolean;
};

type Area = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  shape?: "ellipse";
};

const FRONT_AREAS: Area[] = [
  { id: "Head", label: "Head", x: 163, y: 28, width: 64, height: 64, radius: 32, shape: "ellipse" },
  { id: "Neck", label: "Neck", x: 178, y: 96, width: 34, height: 22, radius: 9 },
  { id: "Chest", label: "Chest", x: 139, y: 120, width: 112, height: 70, radius: 18 },
  { id: "Abdomen", label: "Abdomen", x: 146, y: 194, width: 98, height: 52, radius: 15 },
  { id: "Pelvis", label: "Pelvis", x: 152, y: 250, width: 86, height: 38, radius: 14 },
  { id: "Left Arm", label: "L Arm", x: 105, y: 126, width: 30, height: 124, radius: 15 },
  { id: "Right Arm", label: "R Arm", x: 255, y: 126, width: 30, height: 124, radius: 15 },
  { id: "Left Leg", label: "L Leg", x: 158, y: 292, width: 34, height: 116, radius: 16 },
  { id: "Right Leg", label: "R Leg", x: 198, y: 292, width: 34, height: 116, radius: 16 },
];

const BACK_AREAS: Area[] = [
  { id: "Back Head", label: "Head", x: 493, y: 28, width: 64, height: 64, radius: 32, shape: "ellipse" },
  { id: "Back - Upper", label: "Upper Back", x: 469, y: 120, width: 112, height: 70, radius: 18 },
  { id: "Back - Lower", label: "Lower Back", x: 476, y: 194, width: 98, height: 52, radius: 15 },
  { id: "Back - Left Arm", label: "L Arm", x: 435, y: 126, width: 30, height: 124, radius: 15 },
  { id: "Back - Right Arm", label: "R Arm", x: 585, y: 126, width: 30, height: 124, radius: 15 },
  { id: "Back - Left Leg", label: "L Leg", x: 488, y: 292, width: 34, height: 116, radius: 16 },
  { id: "Back - Right Leg", label: "R Leg", x: 528, y: 292, width: 34, height: 116, radius: 16 },
];

const BodyPainSelector = forwardRef(function BodyPainSelector(
  { values, onChange, disabled = false }: Props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  };

  useImperativeHandle(ref, () => ({
    async exportImage(): Promise<string | null> {
      if (!containerRef.current) return null;
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      return canvas.toDataURL("image/png");
    },
  }));

  const renderArea = (area: Area) => {
    const active = values.includes(area.id);
    const commonProps = {
      fill: active ? "#274c5a" : "#e2f3f6",
      stroke: active ? "#1f4654" : "#93bec8",
      strokeWidth: active ? 3 : 2,
      className: disabled
        ? "transition-colors"
        : "cursor-pointer transition-colors hover:fill-[#ccebf0] focus:outline-none",
    };

    return (
      <g
        key={area.id}
        role="button"
        aria-label={`${active ? "Remove" : "Select"} ${area.id}`}
        aria-pressed={active}
        tabIndex={disabled ? -1 : 0}
        onClick={() => toggle(area.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle(area.id);
          }
        }}
      >
        {area.shape === "ellipse" ? (
          <ellipse
            cx={area.x + area.width / 2}
            cy={area.y + area.height / 2}
            rx={area.width / 2}
            ry={area.height / 2}
            {...commonProps}
          />
        ) : (
          <rect
            x={area.x}
            y={area.y}
            width={area.width}
            height={area.height}
            rx={area.radius}
            {...commonProps}
          />
        )}
        <text
          x={area.x + area.width / 2}
          y={area.y + area.height / 2 + 3}
          textAnchor="middle"
          fontSize={area.width < 40 ? 8 : 10}
          fontWeight={active ? 700 : 600}
          fill={active ? "#ffffff" : "#416775"}
          pointerEvents="none"
        >
          {area.label}
        </text>
      </g>
    );
  };

  return (
    <div ref={containerRef} className="overflow-hidden rounded-2xl border border-[#d3e2e7] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce9ed] bg-[#f3f8f9] px-5 py-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#274c5a]">Body Pain Assessment</p>
          <p className="mt-0.5 text-xs font-medium text-[#718995]">
            Select each area where the patient reports pain
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#274c5a] px-3 py-1.5 text-xs font-bold text-white">
            {values.length} selected
          </span>
          <button
            type="button"
            disabled={disabled || values.length === 0}
            onClick={() => onChange([])}
            className="rounded-full border border-[#bfd5dc] bg-white px-3 py-1.5 text-xs font-bold text-[#274c5a] transition hover:border-[#74cdda] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        <svg
          viewBox="0 0 720 430"
          className={`mx-auto block w-full max-w-[820px] ${disabled ? "opacity-80" : ""}`}
          aria-label="Front and back body pain selector"
        >
          <text x="195" y="18" textAnchor="middle" fill="#718995" fontSize="14" fontWeight="700">FRONT</text>
          <text x="525" y="18" textAnchor="middle" fill="#718995" fontSize="14" fontWeight="700">BACK</text>

          {FRONT_AREAS.map(renderArea)}
          {BACK_AREAS.map(renderArea)}
        </svg>

        <div className="mt-4 rounded-xl border border-[#dce9ed] bg-[#f7fafb] px-4 py-3">
          <span className="text-xs font-black uppercase tracking-wide text-[#718995]">Selected areas</span>
          <p className="mt-1 text-sm font-semibold text-[#274c5a]">
            {values.length ? values.join(", ") : "No pain locations selected"}
          </p>
        </div>
      </div>
    </div>
  );
});

export default BodyPainSelector;
