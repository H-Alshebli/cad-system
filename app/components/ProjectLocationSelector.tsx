"use client";

import { useMemo, useState } from "react";
import { Check, MapPin, Search } from "lucide-react";
import { ProjectLocation } from "@/lib/projectLocations";
import { useClientI18n } from "@/lib/clientI18n";

export default function ProjectLocationSelector({
  locations,
  selectedId,
  onSelect,
  onManual,
  localized = false,
}: {
  locations: ProjectLocation[];
  selectedId: string;
  onSelect: (location: ProjectLocation) => void;
  onManual: () => void;
  localized?: boolean;
}) {
  const { t } = useClientI18n();
  const text = (value: string) => localized ? t(value) : value;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const activeLocations = useMemo(
    () => locations.filter((item) => item.status !== "archived"),
    [locations]
  );
  const selected = activeLocations.find((item) => item.id === selectedId);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activeLocations.slice(0, 60);
    return activeLocations
      .filter(
        (item) =>
          item.siteName.toLowerCase().includes(term) ||
          String(item.siteNumber).toLowerCase().includes(term)
      )
      .slice(0, 60);
  }, [activeLocations, search]);

  if (activeLocations.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#74cdda]/45 bg-[#effbfc] p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#274C5A] p-2 text-white"><MapPin size={17} /></div>
        <div>
          <div className="text-sm font-black text-[#123746]">{text("Select project factory / site *")}</div>
          <div className="mt-0.5 text-xs font-semibold text-[#607482]">
            {text("The location and map pin will be filled automatically.")}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#c8dce2] bg-white px-3 py-3 text-left text-sm font-bold text-[#123746]"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selected ? `${selected.siteName} — ${text("Site")} ${selected.siteNumber}` : text("Choose a factory or site")}</span>
        <span className="text-xs text-[#607482]">{activeLocations.length} {text("sites")}</span>
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-[#d8e6ea] bg-white shadow-xl">
          <div className="relative border-b border-[#e1ebef] p-3">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[#607482]" size={16} />
            <input
              className="input pl-9"
              autoFocus
              placeholder={text("Search by factory name or site number")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.map((location) => (
              <button
                key={location.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 border-b border-[#edf3f5] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f2fafb]"
                onClick={() => {
                  onSelect(location);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <span>
                  <span className="block text-sm font-black text-[#123746]">{location.siteName}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-[#607482]">{text("Site")} {location.siteNumber} · {location.coordinates}</span>
                </span>
                {selectedId === location.id && <Check className="shrink-0 text-emerald-600" size={17} />}
              </button>
            ))}
            {filtered.length === 0 && <div className="p-5 text-center text-sm font-semibold text-[#607482]">{text("No matching location.")}</div>}
          </div>
        </div>
      )}

      <button
        type="button"
        className="mt-3 text-xs font-black text-[#166575] underline"
        onClick={() => {
          onManual();
          setOpen(false);
        }}
      >
        {text("Location not listed — enter manually")}
      </button>
    </div>
  );
}
