"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import html2canvas from "html2canvas";

type Props = { values: string[]; onChange: (vals: string[]) => void; disabled?: boolean };
type Area = { id: string; label: string; x: number; y: number; width: number; height: number; radius: number; shape?: "ellipse" };

export const NO_PAIN_REPORTED = "No Pain Reported";

const makeAreas = (offset: number, side: "front" | "back"): Area[] => {
  const front = side === "front";
  const prefix = front ? "Front" : "Back";
  const torso = (name: string) => front ? name : `Back - ${name}`;
  return [
    { id: front ? "Head" : "Back Head", label: "Head", x: offset + 118, y: 25, width: 64, height: 64, radius: 32, shape: "ellipse" },
    { id: front ? "Neck" : "Back - Neck", label: "Neck", x: offset + 132, y: 93, width: 36, height: 24, radius: 9 },
    { id: `${prefix} - Right Shoulder`, label: "R Shoulder", x: offset + 78, y: 124, width: 46, height: 31, radius: 12 },
    { id: `${prefix} - Left Shoulder`, label: "L Shoulder", x: offset + 176, y: 124, width: 46, height: 31, radius: 12 },
    { id: torso(front ? "Chest" : "Upper"), label: front ? "Chest" : "Upper Back", x: offset + 119, y: 124, width: 62, height: 70, radius: 14 },
    { id: torso(front ? "Abdomen" : "Lower"), label: front ? "Abdomen" : "Lower Back", x: offset + 119, y: 198, width: 62, height: 58, radius: 14 },
    { id: front ? "Pelvis" : "Back - Pelvis", label: front ? "Pelvis" : "Buttocks", x: offset + 113, y: 260, width: 74, height: 41, radius: 14 },
    { id: `${prefix} - Right Upper Arm`, label: "R Upper", x: offset + 64, y: 159, width: 44, height: 69, radius: 18 },
    { id: `${prefix} - Left Upper Arm`, label: "L Upper", x: offset + 192, y: 159, width: 44, height: 69, radius: 18 },
    { id: `${prefix} - Right Forearm`, label: "R Forearm", x: offset + 58, y: 232, width: 42, height: 76, radius: 18 },
    { id: `${prefix} - Left Forearm`, label: "L Forearm", x: offset + 200, y: 232, width: 42, height: 76, radius: 18 },
    { id: `${prefix} - Right Hand`, label: "R Hand", x: offset + 61, y: 312, width: 35, height: 42, radius: 16 },
    { id: `${prefix} - Left Hand`, label: "L Hand", x: offset + 204, y: 312, width: 35, height: 42, radius: 16 },
    { id: `${prefix} - Right Thigh`, label: "R Thigh", x: offset + 104, y: 306, width: 43, height: 86, radius: 18 },
    { id: `${prefix} - Left Thigh`, label: "L Thigh", x: offset + 153, y: 306, width: 43, height: 86, radius: 18 },
    { id: `${prefix} - Right Lower Leg`, label: front ? "R Lower" : "R Calf", x: offset + 104, y: 396, width: 43, height: 96, radius: 18 },
    { id: `${prefix} - Left Lower Leg`, label: front ? "L Lower" : "L Calf", x: offset + 153, y: 396, width: 43, height: 96, radius: 18 },
    { id: `${prefix} - Right Foot`, label: "R Foot", x: offset + 94, y: 496, width: 53, height: 34, radius: 16 },
    { id: `${prefix} - Left Foot`, label: "L Foot", x: offset + 153, y: 496, width: 53, height: 34, radius: 16 },
  ];
};

const FRONT_AREAS = makeAreas(40, "front");
const BACK_AREAS = makeAreas(380, "back");

const LEGACY_AREA_GROUPS: Record<string, string[]> = {
  "Left Arm": ["Front - Left Upper Arm", "Front - Left Forearm", "Front - Left Hand"],
  "Right Arm": ["Front - Right Upper Arm", "Front - Right Forearm", "Front - Right Hand"],
  "Left Leg": ["Front - Left Thigh", "Front - Left Lower Leg", "Front - Left Foot"],
  "Right Leg": ["Front - Right Thigh", "Front - Right Lower Leg", "Front - Right Foot"],
  "Back - Left Arm": ["Back - Left Upper Arm", "Back - Left Forearm", "Back - Left Hand"],
  "Back - Right Arm": ["Back - Right Upper Arm", "Back - Right Forearm", "Back - Right Hand"],
  "Back - Left Leg": ["Back - Left Thigh", "Back - Left Lower Leg", "Back - Left Foot"],
  "Back - Right Leg": ["Back - Right Thigh", "Back - Right Lower Leg", "Back - Right Foot"],
};

const BodyPainSelector = forwardRef(function BodyPainSelector(
  { values, onChange, disabled = false }: Props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const noPainReported = values.includes(NO_PAIN_REPORTED);
  const selectedValues = values.filter((value) => value !== NO_PAIN_REPORTED);

  const isAreaActive = (id: string) => selectedValues.includes(id) || Object.entries(LEGACY_AREA_GROUPS).some(
    ([legacyId, childIds]) => selectedValues.includes(legacyId) && childIds.includes(id)
  );

  const toggle = (id: string) => {
    if (disabled || noPainReported) return;
    const next = new Set(selectedValues);
    const legacyGroup = Object.entries(LEGACY_AREA_GROUPS).find(
      ([legacyId, childIds]) => next.has(legacyId) && childIds.includes(id)
    );
    if (legacyGroup) {
      const [legacyId, childIds] = legacyGroup;
      next.delete(legacyId);
      childIds.filter((childId) => childId !== id).forEach((childId) => next.add(childId));
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  useImperativeHandle(ref, () => ({
    async exportImage(): Promise<string | null> {
      if (!containerRef.current) return null;
      const canvas = await html2canvas(containerRef.current, { backgroundColor: "#ffffff", scale: 2 });
      return canvas.toDataURL("image/png");
    },
  }));

  const renderArea = (area: Area) => {
    const active = isAreaActive(area.id);
    const commonProps = {
      fill: active ? "#274c5a" : "#e2f3f6",
      stroke: active ? "#1f4654" : "#93bec8",
      strokeWidth: active ? 3 : 2,
      className: disabled || noPainReported ? "transition-colors" : "cursor-pointer transition-colors hover:fill-[#ccebf0] focus:outline-none",
    };
    return (
      <g key={area.id} role="button" aria-label={`${active ? "Remove" : "Select"} ${area.id}`} aria-pressed={active}
        tabIndex={disabled || noPainReported ? -1 : 0} onClick={() => toggle(area.id)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(area.id); } }}>
        {area.shape === "ellipse" ? (
          <ellipse cx={area.x + area.width / 2} cy={area.y + area.height / 2} rx={area.width / 2} ry={area.height / 2} {...commonProps} />
        ) : (
          <rect x={area.x} y={area.y} width={area.width} height={area.height} rx={area.radius} {...commonProps} />
        )}
        <text x={area.x + area.width / 2} y={area.y + area.height / 2 + 3} textAnchor="middle"
          fontSize={area.width < 45 ? 7 : 9} fontWeight={active ? 700 : 600}
          fill={active ? "#ffffff" : "#416775"} pointerEvents="none">{area.label}</text>
      </g>
    );
  };

  return (
    <div ref={containerRef} className="overflow-hidden rounded-2xl border border-[#d3e2e7] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce9ed] bg-[#f3f8f9] px-5 py-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#274c5a]">Body Pain Assessment</p>
          <p className="mt-0.5 text-xs font-medium text-[#718995]">Select each area where the patient reports pain</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-[#274c5a]">
            <input type="checkbox" checked={noPainReported} disabled={disabled}
              onChange={(event) => onChange(event.target.checked ? [NO_PAIN_REPORTED] : [])}
              className="h-4 w-4 rounded border-[#93bec8] text-[#274c5a] focus:ring-[#74cdda]" />
            No pain reported
          </label>
          <span className="rounded-full bg-[#274c5a] px-3 py-1.5 text-xs font-bold text-white">{selectedValues.length} selected</span>
          <button type="button" disabled={disabled || values.length === 0} onClick={() => onChange([])}
            className="rounded-full border border-[#bfd5dc] bg-white px-3 py-1.5 text-xs font-bold text-[#274c5a] transition hover:border-[#74cdda] disabled:cursor-not-allowed disabled:opacity-45">Clear</button>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-6">
        <p className="mb-2 text-center text-xs font-semibold text-[#718995]">Right and left refer to the patient&apos;s perspective</p>
        <svg viewBox="0 0 720 545" className={`mx-auto block w-full max-w-[820px] ${disabled || noPainReported ? "opacity-80" : ""}`}
          aria-label="Front and back body pain selector">
          <text x="190" y="17" textAnchor="middle" fill="#718995" fontSize="14" fontWeight="700">FRONT</text>
          <text x="530" y="17" textAnchor="middle" fill="#718995" fontSize="14" fontWeight="700">BACK</text>
          {FRONT_AREAS.map(renderArea)}
          {BACK_AREAS.map(renderArea)}
        </svg>
        <div className="mt-4 rounded-xl border border-[#dce9ed] bg-[#f7fafb] px-4 py-3">
          <span className="text-xs font-black uppercase tracking-wide text-[#718995]">Selected areas</span>
          <p className="mt-1 text-sm font-semibold text-[#274c5a]">
            {noPainReported ? NO_PAIN_REPORTED : selectedValues.length ? selectedValues.join(", ") : "No pain locations selected"}
          </p>
        </div>
      </div>
    </div>
  );
});

export default BodyPainSelector;
