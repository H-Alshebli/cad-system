"use client";

import { ChangeEvent, useMemo, useRef, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Archive,
  Download,
  ExternalLink,
  FileSpreadsheet,
  MapPin,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import PermissionGuard from "@/app/components/PermissionGuard";
import {
  archiveProjectLocation,
  importProjectLocations,
  parseCoordinates,
  ProjectLocation,
  ProjectLocationInput,
  readProjectLocations,
  saveProjectLocation,
} from "@/lib/projectLocations";
import { db } from "@/lib/firebase";

type ImportIssue = { row: number; message: string };
type ImportPreview = {
  fileName: string;
  locations: ProjectLocationInput[];
  issues: ImportIssue[];
  duplicateNames: string[];
};

const PAGE_SIZE = 50;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findColumn(headers: unknown[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) => normalizedCandidates.includes(normalizeHeader(header)));
}

export default function ProjectLocationsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [locations, setLocations] = useState<ProjectLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [editing, setEditing] = useState<ProjectLocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [siteNumber, setSiteNumber] = useState("");
  const [siteName, setSiteName] = useState("");
  const [coordinates, setCoordinates] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "projects", params.projectId),
      (snapshot) => {
        const next = readProjectLocations(snapshot.exists() ? snapshot.data() : null)
          .sort((a, b) =>
            String(a.siteNumber).localeCompare(String(b.siteNumber), undefined, {
              numeric: true,
            })
          );
        setLocations(next);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load project locations", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [params.projectId]);

  const activeCount = locations.filter((item) => item.status !== "archived").length;
  const archivedCount = locations.length - activeCount;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return locations.filter((item) => {
      if (!showArchived && item.status === "archived") return false;
      if (!term) return true;
      return (
        String(item.siteNumber).toLowerCase().includes(term) ||
        String(item.siteName).toLowerCase().includes(term)
      );
    });
  }, [locations, search, showArchived]);

  useEffect(() => setPage(1), [search, showArchived]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleLocations = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetForm() {
    setEditing(null);
    setSiteNumber("");
    setSiteName("");
    setCoordinates("");
    setFormOpen(false);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  function openEditForm(location: ProjectLocation) {
    setEditing(location);
    setSiteNumber(location.siteNumber);
    setSiteName(location.siteName);
    setCoordinates(location.coordinates || `${location.lat}, ${location.lng}`);
    setFormOpen(true);
  }

  async function submitForm() {
    const number = siteNumber.trim();
    const name = siteName.trim();
    const parsed = parseCoordinates(coordinates);

    if (!number || !name || !parsed) {
      alert("Enter the site number, site name, and valid coordinates (latitude, longitude).");
      return;
    }

    const conflicting = locations.find(
      (item) => item.siteNumber.trim() === number && item.id !== editing?.id
    );
    if (conflicting) {
      alert("This site number is already used in the project.");
      return;
    }

    if (editing && editing.siteNumber !== number) {
      alert("The site number cannot be changed while editing. Archive this location and add a new one instead.");
      return;
    }

    setSaving(true);
    try {
      await saveProjectLocation(params.projectId, {
        siteNumber: number,
        siteName: name,
        coordinates: parsed.normalized,
        lat: parsed.lat,
        lng: parsed.lng,
      });
      resetForm();
    } catch (error) {
      console.error("Failed to save project location", error);
      alert("The location could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function readImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
      });

      if (rows.length < 2) {
        alert("The spreadsheet does not contain location rows.");
        return;
      }

      const headers = rows[0];
      const numberIndex = findColumn(headers, ["عدد", "رقم الموقع", "site number"]);
      const nameIndex = findColumn(headers, ["اسم المصنع", "اسم المصنع أو الموقع", "site name"]);
      const coordinateIndex = findColumn(headers, ["google map", "الإحداثيات", "coordinates"]);

      if (numberIndex < 0 || nameIndex < 0 || coordinateIndex < 0) {
        alert("The required columns were not found. Download the sample file and use its headers.");
        return;
      }

      const issues: ImportIssue[] = [];
      const parsedLocations: ProjectLocationInput[] = [];
      const seenNumbers = new Set<string>();
      const nameCounts = new Map<string, number>();

      rows.slice(1).forEach((row, index) => {
        const excelRow = index + 2;
        const number = String(row[numberIndex] ?? "").trim();
        const name = String(row[nameIndex] ?? "").trim();
        const parsed = parseCoordinates(row[coordinateIndex]);

        if (!number && !name && !String(row[coordinateIndex] ?? "").trim()) return;
        if (!number) issues.push({ row: excelRow, message: "Site number is missing." });
        if (!name) issues.push({ row: excelRow, message: "Site name is missing." });
        if (!parsed) issues.push({ row: excelRow, message: "Coordinates are invalid." });
        if (number && seenNumbers.has(number)) {
          issues.push({ row: excelRow, message: `Site number ${number} is duplicated in the file.` });
        }

        if (!number || !name || !parsed || seenNumbers.has(number)) return;
        seenNumbers.add(number);
        const normalizedName = name.toLowerCase().replace(/\s+/g, " ");
        nameCounts.set(normalizedName, (nameCounts.get(normalizedName) || 0) + 1);
        parsedLocations.push({
          siteNumber: number,
          siteName: name,
          coordinates: parsed.normalized,
          lat: parsed.lat,
          lng: parsed.lng,
        });
      });

      setImportPreview({
        fileName: file.name,
        locations: parsedLocations,
        issues,
        duplicateNames: [...nameCounts.entries()]
          .filter(([, count]) => count > 1)
          .map(([name]) => name),
      });
    } catch (error) {
      console.error("Failed to read spreadsheet", error);
      alert("The spreadsheet could not be read. Use an .xlsx file based on the sample.");
    }
  }

  async function confirmImport() {
    if (!importPreview || importPreview.issues.length > 0) return;
    setImporting(true);
    try {
      await importProjectLocations(params.projectId, importPreview.locations);
      setImportPreview(null);
      alert(`${importPreview.locations.length} locations imported successfully.`);
    } catch (error) {
      console.error("Failed to import project locations", error);
      const details = error instanceof Error ? error.message : String(error);
      alert(`The locations could not be imported. ${details}`);
    } finally {
      setImporting(false);
    }
  }

  async function downloadSample() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.aoa_to_sheet([
      ["رقم الموقع", "اسم المصنع أو الموقع", "الإحداثيات"],
      [1, "مثال: مصنع الألمنيوم", "23.92245833, 47.27457064"],
    ]);
    dataSheet["!cols"] = [{ wch: 16 }, { wch: 48 }, { wch: 30 }];
    const instructions = XLSX.utils.aoa_to_sheet([
      ["تعليمات تعبئة مواقع المشروع"],
      ["1", "لا تغير أسماء الأعمدة في ورقة مواقع المشروع."],
      ["2", "ضع كل موقع في صف مستقل."],
      ["3", "رقم الموقع يجب أن يكون غير مكرر داخل المشروع."],
      ["4", "يمكن تكرار اسم المصنع إذا كانت له مواقع مختلفة."],
      ["5", "اكتب الإحداثيات بالصيغة: Latitude, Longitude"],
    ]);
    instructions["!cols"] = [{ wch: 8 }, { wch: 68 }];
    XLSX.utils.book_append_sheet(workbook, dataSheet, "مواقع المشروع");
    XLSX.utils.book_append_sheet(workbook, instructions, "تعليمات");
    XLSX.writeFile(workbook, "Project-Locations-Sample.xlsx");
  }

  async function archiveLocation(location: ProjectLocation) {
    if (!confirm(`Archive ${location.siteName}?`)) return;
    try {
      await archiveProjectLocation(params.projectId, location.id);
    } catch (error) {
      console.error("Failed to archive location", error);
      alert("The location could not be archived.");
    }
  }

  return (
    <PermissionGuard module="projects" action="edit" showMessage={true}>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <h2 className="page-title">Project Locations</h2>
            <p className="page-subtitle mt-1">
              Manage factories and operational sites used by this project. Case creation integration will be added next.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary gap-2" onClick={downloadSample}>
              <Download size={16} /> Download Sample
            </button>
            <button className="btn-secondary gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Import Excel
            </button>
            <button className="btn-primary gap-2" onClick={openCreateForm}>
              <Plus size={16} /> Add Location
            </button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".xlsx"
              onChange={readImportFile}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="card-modern">
            <div className="text-sm font-bold text-[#607482]">Active locations</div>
            <div className="mt-2 text-3xl font-black text-[#123746]">{activeCount}</div>
          </div>
          <div className="card-modern">
            <div className="text-sm font-bold text-[#607482]">Archived locations</div>
            <div className="mt-2 text-3xl font-black text-[#123746]">{archivedCount}</div>
          </div>
          <div className="card-modern">
            <div className="text-sm font-bold text-[#607482]">Project directory</div>
            <div className="mt-2 text-sm font-black text-[#274C5A]">Excel and manual locations combined</div>
          </div>
        </div>

        <div className="card-modern space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607482]" size={17} />
              <input
                className="input pl-10"
                placeholder="Search by site name or number"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-[#274C5A]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#d8e6ea]">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[#274C5A] text-white">
                <tr>
                  <th className="px-4 py-3">Site number</th>
                  <th className="px-4 py-3">Factory / site name</th>
                  <th className="px-4 py-3">Coordinates</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e1ebef] bg-white">
                {loading && (
                  <tr><td className="px-4 py-8 text-center font-semibold text-[#607482]" colSpan={6}>Loading locations...</td></tr>
                )}
                {!loading && visibleLocations.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center" colSpan={6}>
                      <FileSpreadsheet className="mx-auto text-[#86A7B2]" size={34} />
                      <div className="mt-3 font-black text-[#274C5A]">No project locations found</div>
                      <div className="mt-1 text-sm font-semibold text-[#607482]">Import the project Excel file or add a location manually.</div>
                    </td>
                  </tr>
                )}
                {visibleLocations.map((location) => (
                  <tr key={location.id} className={location.status === "archived" ? "bg-slate-50 opacity-65" : "hover:bg-[#f7fbfc]"}>
                    <td className="px-4 py-3 font-black text-[#274C5A]">{location.siteNumber}</td>
                    <td className="px-4 py-3 font-bold text-[#123746]">{location.siteName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#607482]">{location.coordinates}</td>
                    <td className="px-4 py-3"><span className="badge">{location.source || "manual"}</span></td>
                    <td className="px-4 py-3">
                      <span className={`badge ${location.status === "archived" ? "border-slate-300 text-slate-500" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}>
                        {location.status || "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <a
                          className="rounded-xl p-2 text-[#274C5A] hover:bg-[#e8f4f6]"
                          href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open map"
                        ><ExternalLink size={16} /></a>
                        {location.status !== "archived" && (
                          <>
                            <button className="rounded-xl p-2 text-[#274C5A] hover:bg-[#e8f4f6]" onClick={() => openEditForm(location)} title="Edit"><Pencil size={16} /></button>
                            <button className="rounded-xl p-2 text-[#b42318] hover:bg-red-50" onClick={() => archiveLocation(location)} title="Archive"><Archive size={16} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between gap-3 text-sm font-bold text-[#607482]">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex gap-2">
                <button className="btn-secondary py-2" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                <span className="flex items-center px-2">{page} / {pageCount}</span>
                <button className="btn-secondary py-2" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
              </div>
            </div>
          )}
        </div>

        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="section-title">{editing ? "Edit location" : "Add location"}</h3><p className="section-subtitle mt-1">All three fields are required in the first version.</p></div>
                <button className="rounded-xl p-2 hover:bg-slate-100" onClick={resetForm}><X size={18} /></button>
              </div>
              <div className="mt-5 space-y-4">
                <div><label className="field-label">Site number *</label><input className="input" value={siteNumber} disabled={!!editing} onChange={(event) => setSiteNumber(event.target.value)} /></div>
                <div><label className="field-label">Factory / site name *</label><input className="input" value={siteName} onChange={(event) => setSiteName(event.target.value)} /></div>
                <div><label className="field-label">Coordinates *</label><input className="input" placeholder="23.92245833, 47.27457064" value={coordinates} onChange={(event) => setCoordinates(event.target.value)} /></div>
                {parseCoordinates(coordinates) && <a className="inline-flex items-center gap-2 text-sm font-black text-[#166575] underline" href={`https://www.google.com/maps?q=${parseCoordinates(coordinates)?.lat},${parseCoordinates(coordinates)?.lng}`} target="_blank" rel="noreferrer"><MapPin size={16} /> Preview on Google Maps</a>}
              </div>
              <div className="mt-6 flex justify-end gap-2"><button className="btn-secondary" onClick={resetForm}>Cancel</button><button className="btn-primary" disabled={saving} onClick={submitForm}>{saving ? "Saving..." : "Save location"}</button></div>
            </div>
          </div>
        )}

        {importPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="section-title">Review Excel import</h3><p className="section-subtitle mt-1">{importPreview.fileName}</p></div>
                <button className="rounded-xl p-2 hover:bg-slate-100" onClick={() => setImportPreview(null)}><X size={18} /></button>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="card-soft p-4"><div className="text-xs font-black uppercase text-[#607482]">Valid rows</div><div className="mt-1 text-2xl font-black text-emerald-700">{importPreview.locations.length}</div></div>
                <div className="card-soft p-4"><div className="text-xs font-black uppercase text-[#607482]">Errors</div><div className="mt-1 text-2xl font-black text-red-700">{importPreview.issues.length}</div></div>
                <div className="card-soft p-4"><div className="text-xs font-black uppercase text-[#607482]">Repeated names</div><div className="mt-1 text-2xl font-black text-amber-700">{importPreview.duplicateNames.length}</div></div>
              </div>
              {importPreview.duplicateNames.length > 0 && <div className="notice-warning mt-4">Repeated factory names are allowed because they can represent different locations. They will be imported using their site numbers.</div>}
              {importPreview.issues.length > 0 && (
                <div className="notice-danger mt-4"><div className="font-black">Fix these rows before importing:</div><ul className="mt-2 list-disc space-y-1 pl-5">{importPreview.issues.slice(0, 20).map((issue, index) => <li key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</li>)}</ul>{importPreview.issues.length > 20 && <div className="mt-2">And {importPreview.issues.length - 20} more issues.</div>}</div>
              )}
              <div className="mt-6 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setImportPreview(null)}>Cancel</button><button className="btn-primary" disabled={importing || importPreview.issues.length > 0 || importPreview.locations.length === 0} onClick={confirmImport}>{importing ? "Importing..." : `Import ${importPreview.locations.length} locations`}</button></div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
