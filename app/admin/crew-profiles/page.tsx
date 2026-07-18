"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import PermissionGuard from "@/app/components/PermissionGuard";
import { db } from "@/lib/firebase";
import {
  CREW_PROFILE_FIELDS,
  CREW_PROFILE_SECTIONS,
  CrewProfileValues,
  getCrewProfileCompletion,
  getCrewProfileValues,
} from "@/lib/crewProfile";

type CrewUser = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  crewProfile?: Record<string, string>;
  crewProfileAttachments?: Record<string, any>;
  profileUpdatedAt?: any;
};

const fileFieldKeys = new Set(
  CREW_PROFILE_FIELDS.filter((field) => field.type === "file").map((field) => field.key)
);

function profileName(user: CrewUser, values: CrewProfileValues) {
  const fullNameEn = [
    values.firstNameEn,
    values.secondNameEn,
    values.thirdNameEn,
    values.familyNameEn,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const fullNameAr = [
    values.firstNameAr,
    values.secondNameAr,
    values.thirdNameAr,
    values.familyNameAr,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullNameEn || fullNameAr || user.name || user.email || "Crew Member";
}

function formatDate(value: any) {
  if (!value) return "-";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(percent: number) {
  if (percent >= 90) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  if (percent >= 60) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }

  return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-200";
}

function fieldDisplayValue(fieldKey: string, values: CrewProfileValues, attachments: Record<string, any>) {
  if (fileFieldKeys.has(fieldKey)) {
    return attachments?.[fieldKey]?.name || "";
  }

  return values[fieldKey] || "";
}

function todayFileStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function CrewProfilesDashboardPage() {
  const [users, setUsers] = useState<CrewUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs
          .map((item) => ({ id: item.id, ...(item.data() as any) }))
          .sort((a, b) => String(a.name || a.email || "").localeCompare(String(b.name || b.email || "")));

        setUsers(list);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load crew profiles", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const rows = useMemo(() => {
    return users.map((user) => {
      const values = getCrewProfileValues(user);
      const completion = getCrewProfileCompletion(values);
      const attachments = user.crewProfileAttachments || {};
      const attachmentCount = Object.values(attachments).filter(Boolean).length;

      return {
        user,
        values,
        completion,
        attachmentCount,
        displayName: profileName(user, values),
      };
    });
  }, [users]);

  const stats = useMemo(() => {
    const complete = rows.filter((row) => row.completion.percent >= 90).length;
    const partial = rows.filter(
      (row) => row.completion.percent > 0 && row.completion.percent < 90
    ).length;
    const notStarted = rows.filter((row) => row.completion.percent === 0).length;

    return {
      total: rows.length,
      complete,
      partial,
      notStarted,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const haystack = [
        row.displayName,
        row.user.email,
        row.user.role,
        row.values.employeeId,
        row.values.mobile,
        row.values.city,
        row.values.jobTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "complete" && row.completion.percent >= 90) ||
        (statusFilter === "partial" &&
          row.completion.percent > 0 &&
          row.completion.percent < 90) ||
        (statusFilter === "missing" && row.completion.percent === 0);

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const selectedRow = rows.find((row) => row.user.id === selectedId);

  function exportToExcel() {
    const exportRows = filteredRows.map((row) => {
      const attachments = row.user.crewProfileAttachments || {};
      const base: Record<string, string | number> = {
        "Crew Member": row.displayName,
        Email: row.user.email || "",
        "System Role": row.user.role || "",
        Active: row.user.active === false ? "No" : "Yes",
        "Employee ID": row.values.employeeId || "",
        "Mobile Country Code": row.values.mobileCountryCode || "",
        "Mobile Number": row.values.mobile || "",
        City: row.values.city || "",
        "Completion %": row.completion.percent,
        "Missing Count": row.completion.missing.length,
        "Missing Fields": row.completion.missing.map((field) => field.label).join(", "),
        "Attachments Count": row.attachmentCount,
        "Last Updated": formatDate(row.user.profileUpdatedAt),
      };

      CREW_PROFILE_FIELDS.forEach((field) => {
        if (field.type === "file") {
          base[`${field.label} - File Name`] = attachments[field.key]?.name || "";
          base[`${field.label} - Link`] = attachments[field.key]?.url || "";
        } else {
          base[field.label] = row.values[field.key] || "";
        }
      });

      return base;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    worksheet["!cols"] = Object.keys(exportRows[0] || { "Crew Member": "" }).map((key) => ({
      wch: Math.min(Math.max(key.length + 4, 16), 42),
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Crew Profiles");
    XLSX.writeFile(workbook, `Crew_Profiles_${todayFileStamp()}.xlsx`);
  }

  return (
    <PermissionGuard module="crew_profile" action="view_all" showMessage={true}>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <div className="badge mb-3">Crew Administration</div>
            <h1 className="page-title">Crew Profiles Dashboard</h1>
            <p className="page-subtitle">
              Review crew profile completion, missing data, uploaded documents,
              and contact details from one HCAD dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            disabled={loading || filteredRows.length === 0}
            className="btn-primary gap-2"
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="card-modern">
            <div className="text-sm text-slate-500 dark:text-slate-400">Total Crew</div>
            <div className="mt-2 flex items-center gap-2 text-3xl font-black text-slate-950 dark:text-white">
              <Users size={24} />
              {stats.total}
            </div>
          </div>
          <div className="card-modern">
            <div className="text-sm text-slate-500 dark:text-slate-400">Near Complete</div>
            <div className="mt-2 flex items-center gap-2 text-3xl font-black text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 size={24} />
              {stats.complete}
            </div>
          </div>
          <div className="card-modern">
            <div className="text-sm text-slate-500 dark:text-slate-400">In Progress</div>
            <div className="mt-2 text-3xl font-black text-amber-600 dark:text-amber-300">
              {stats.partial}
            </div>
          </div>
          <div className="card-modern">
            <div className="text-sm text-slate-500 dark:text-slate-400">Not Started</div>
            <div className="mt-2 flex items-center gap-2 text-3xl font-black text-red-600 dark:text-red-300">
              <AlertCircle size={24} />
              {stats.notStarted}
            </div>
          </div>
        </div>

        <div className="card-modern">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <label className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-9"
                placeholder="Search by name, email, role, employee ID, mobile, city..."
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="select"
            >
              <option value="all">All statuses</option>
              <option value="complete">Near complete</option>
              <option value="partial">In progress</option>
              <option value="missing">Not started</option>
            </select>
          </div>
        </div>

        <div className="table-modern overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70">
              <tr>
                <th className="p-4">Crew Member</th>
                <th className="p-4">Role</th>
                <th className="p-4">Employee ID</th>
                <th className="p-4">Mobile</th>
                <th className="p-4">City</th>
                <th className="p-4">Completion</th>
                <th className="p-4">Missing</th>
                <th className="p-4">Files</th>
                <th className="p-4">Updated</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="p-5 text-slate-500 dark:text-slate-400" colSpan={10}>
                    Loading crew profiles...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="p-5 text-slate-500 dark:text-slate-400" colSpan={10}>
                    No crew profiles match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.user.id}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    <td className="p-4">
                      <div className="font-black text-slate-950 dark:text-white">
                        {row.displayName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.user.email || "-"}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="badge">{row.values.jobTitle || row.user.role || "-"}</span>
                    </td>
                    <td className="p-4 font-semibold">{row.values.employeeId || "-"}</td>
                    <td className="p-4">
                      {[row.values.mobileCountryCode, row.values.mobile].filter(Boolean).join(" ") || "-"}
                    </td>
                    <td className="p-4">{row.values.city || "-"}</td>
                    <td className="p-4">
                      <span className={`badge ${statusClass(row.completion.percent)}`}>
                        {row.completion.percent}%
                      </span>
                    </td>
                    <td className="p-4">{row.completion.missing.length}</td>
                    <td className="p-4">{row.attachmentCount}</td>
                    <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(row.user.profileUpdatedAt)}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.user.id)}
                        className="btn-secondary px-3 py-2"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedRow && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Close profile details"
              className="absolute inset-0 cursor-default"
              onClick={() => setSelectedId("")}
            />

            <aside className="relative h-full w-full max-w-4xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#07111f]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="badge mb-3">Profile Details</div>
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                    {selectedRow.displayName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {selectedRow.user.email || "-"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId("")}
                  className="btn-secondary h-10 w-10 p-0"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <div className="card-soft">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Completion</div>
                  <div className="mt-1 text-2xl font-black">
                    {selectedRow.completion.percent}%
                  </div>
                </div>
                <div className="card-soft">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Missing Fields</div>
                  <div className="mt-1 text-2xl font-black">
                    {selectedRow.completion.missing.length}
                  </div>
                </div>
                <div className="card-soft">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Attachments</div>
                  <div className="mt-1 text-2xl font-black">
                    {selectedRow.attachmentCount}
                  </div>
                </div>
              </div>

              {selectedRow.completion.missing.length > 0 && (
                <div className="notice-warning mb-5">
                  <div className="mb-3 font-black">Missing fields</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRow.completion.missing.map((field) => (
                      <span key={field.key} className="badge">
                        {field.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {CREW_PROFILE_SECTIONS.map((section) => (
                  <section key={section.key} className="card-modern">
                    <h3 className="section-title">{section.title}</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {section.fields.map((field) => {
                        const value = fieldDisplayValue(
                          field.key,
                          selectedRow.values,
                          selectedRow.user.crewProfileAttachments || {}
                        );
                        const attachment = selectedRow.user.crewProfileAttachments?.[field.key];

                        return (
                          <div key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                              {field.label}
                            </div>
                            {field.type === "file" ? (
                              attachment?.url ? (
                                <a
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-2 text-sm font-black text-blue-600 hover:underline dark:text-blue-300"
                                >
                                  <FileText size={15} />
                                  {attachment.name || "Open attachment"}
                                  <ExternalLink size={13} />
                                </a>
                              ) : (
                                <div className="mt-2 text-sm font-semibold text-slate-400">-</div>
                              )
                            ) : (
                              <div className="mt-2 break-words text-sm font-black text-slate-950 dark:text-white">
                                {value || "-"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
