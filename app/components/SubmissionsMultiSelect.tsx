"use client";

import { useRef } from "react";

type Props = {
  label: string;
  allLabel: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
};

export default function SubmissionsMultiSelect({ label, allLabel, options, value, onChange }: Props) {
  const details = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={details} className="relative min-w-0"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false; }}
      onKeyDown={event => {
        if (event.key === "Escape" && details.current?.open) {
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}>
      <summary aria-label={`${label}: ${value.length ? value.join(", ") : allLabel}`}
        className="cursor-pointer rounded-xl border border-[#86A7B2]/30 bg-[#f8fbfc] px-4 py-2 text-sm font-semibold text-[#274C5A] focus-visible:outline focus-visible:outline-2">
        {value.length ? `${label} (${value.length})` : allLabel}
      </summary>
      <div role="group" aria-label={label} className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full min-w-0 overflow-y-auto rounded-xl border bg-white p-2 shadow-lg">
        <button type="button" onClick={() => onChange([])} className="w-full rounded p-2 text-left text-sm font-bold text-[#274C5A] hover:bg-slate-100">
          {allLabel} / Clear selection
        </button>
        {options.map(option => (
          <label key={option} className="flex cursor-pointer items-start gap-2 rounded p-2 text-sm hover:bg-slate-100">
            <input type="checkbox" className="mt-1 shrink-0" checked={value.includes(option)}
              onChange={event => onChange(event.target.checked ? [...value, option] : value.filter(item => item !== option))} />
            <span className="min-w-0 break-words">{option}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
