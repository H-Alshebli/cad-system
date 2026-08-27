"use client";

import { FormEvent, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import { auth } from "@/lib/firebase";
import { useClientI18n } from "@/lib/clientI18n";

export type LocationSearchResult = {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
};

export default function LocationSearch({
  onSelect,
  localized = false,
}: {
  onSelect: (result: LocationSearchResult) => void;
  localized?: boolean;
}) {
  const { t } = useClientI18n();
  const text = (value: string) => localized ? t(value) : value;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim().replace(/\s+/g, " ");

    if (normalizedQuery.length < 3) {
      setError(text("Enter at least 3 characters."));
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error(text("Your session has expired. Please sign in again."));

      const response = await fetch(
        `/api/geocoding/search?q=${encodeURIComponent(normalizedQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const responseText = await response.text();
      let payload: any = {};

      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new Error(
            `Location search service returned an invalid response (${response.status}).`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          payload?.error || `Location search failed (${response.status}).`
        );
      }

      if (!responseText) throw new Error("Location search service returned an empty response.");

      const nextResults = Array.isArray(payload?.results) ? payload.results : [];
      setResults(nextResults);
      if (nextResults.length === 0) {
        setError(text("No matching places found. You can still enter the coordinates manually."));
      }
    } catch (searchError: any) {
      setError(searchError?.message || text("Location search failed."));
    } finally {
      setLoading(false);
    }
  }

  function chooseResult(result: LocationSearchResult) {
    onSelect(result);
    setQuery(result.displayName);
    setResults([]);
    setError("");
  }

  return (
    <div className="space-y-2">
      <form onSubmit={searchLocation} className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#607482]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full rounded-xl border border-[#c8dce2] bg-white pl-10 pr-3 text-sm font-semibold text-[#123746] outline-none transition placeholder:text-[#8aa0aa] focus:border-[#74cdda] focus:ring-4 focus:ring-[#74cdda]/20"
            placeholder={text("Search for a place or address in Saudi Arabia")}
            maxLength={120}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#274C5A] px-5 text-sm font-black text-white transition hover:bg-[#1d3b47] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
          {text("Search")}
        </button>
      </form>

      {error && <p className="text-xs font-semibold text-amber-700">{error}</p>}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#c8dce2] bg-white shadow-lg">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => chooseResult(result)}
              className="flex w-full items-start gap-3 border-b border-[#e3edf0] px-3 py-3 text-left last:border-b-0 hover:bg-[#f3f8fa]"
            >
              <MapPin size={17} className="mt-0.5 shrink-0 text-[#166575]" />
              <span className="text-sm font-semibold leading-5 text-[#274C5A]">
                {result.displayName}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] font-medium text-[#607482]">
        {text("Search runs only when you press Search. Results ©")}{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="font-bold underline"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
