"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { ArrowLeft, Check, Search, ShieldCheck } from "lucide-react";
import PermissionGuard from "@/app/components/PermissionGuard";
import { db } from "@/lib/firebase";
import { ACTION_LABELS, MODULE_DESCRIPTIONS, MODULE_LABELS, PERMISSION_GROUPS, PERMISSION_MATRIX, PermissionsMap, normalizeRolePermissions } from "@/lib/permissionsMatrix";

type RoleEntry = { id: string; permissions: PermissionsMap };
type Control = { label: string; refs: Array<[string, string]>; kind?: "access" | "scope" | "sensitive" };
type Module = { key: string; label: string; description: string; controls: Control[] };

const legacy = new Set(["cad_cases_old", "b2c_cases"]);
const cadParts = new Set(["cases", "cad", "cad_cases_new"]);
const sensitive = new Set(["delete", "view_sensitive", "all_data", "activate", "deactivate"]);

const cadModule: Module = {
  key: "cad_cases_consolidated",
  label: "CAD Cases",
  description: "Modern CAD access, case scope, operations, dispatch, timeline, and internal chat in one view.",
  controls: [
    { label: "Access", refs: [["cad_cases_new", "view"]], kind: "access" },
    { label: "Assigned", refs: [["cad_cases_new", "view_assigned"]], kind: "scope" },
    { label: "All Cases", refs: [["cad_cases_new", "view_all"]], kind: "scope" },
    { label: "Create", refs: [["cases", "create"]] },
    { label: "Edit Details", refs: [["cases", "edit"]] },
    { label: "Assign / Dispatch", refs: [["cases", "assign"], ["cad", "dispatch"]] },
    { label: "Update Status", refs: [["cases", "update_status"], ["cad", "manage_status"]] },
    { label: "Close", refs: [["cases", "close"]] },
    { label: "Close Assigned", refs: [["cases", "close_assigned"]] },
    { label: "Close Any", refs: [["cases", "close_any"]], kind: "sensitive" },
    { label: "Cancel Any", refs: [["cases", "cancel_any"]], kind: "sensitive" },
    { label: "Restore Cancelled", refs: [["cases", "restore_cancelled"]], kind: "sensitive" },
    { label: "Timeline", refs: [["cad", "view_timeline"]] },
    { label: "Internal Chat", refs: [["cad", "internal_chat"]] },
    { label: "Delete Permanently", refs: [["cases", "delete"]], kind: "sensitive" },
  ],
};

function standardModule(key: string): Module {
  return {
    key,
    label: MODULE_LABELS[key] || key,
    description: MODULE_DESCRIPTIONS[key] || "",
    controls: (PERMISSION_MATRIX[key] || []).map((action) => ({
      label: ACTION_LABELS[action] || action.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      refs: [[key, action]],
      kind: action === "view" ? "access" : action.startsWith("view_") ? "scope" : sensitive.has(action) ? "sensitive" : undefined,
    })),
  };
}

function hasControl(role: RoleEntry, control: Control) {
  if (["admin", "super_admin", "superadmin"].includes(role.id.trim().toLowerCase())) return true;
  return control.refs.some(([moduleKey, action]) => Boolean(role.permissions?.[moduleKey]?.[action]));
}

export default function PermissionsMatrixPreviewPage() {
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");

  useEffect(() => {
    getDocs(collection(db, "roles"))
      .then((snapshot) => setRoles(snapshot.docs.map((entry) => ({ id: entry.id, permissions: normalizeRolePermissions(entry.data()?.permissions || {}, entry.id) })).sort((a, b) => a.id.localeCompare(b.id))))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const result = PERMISSION_GROUPS.map((group) => ({ title: group.title, modules: group.modules.filter((key) => !legacy.has(key) && !cadParts.has(key)).map(standardModule) }));
    result.find((group) => group.title === "Operations")?.modules.splice(1, 0, cadModule);
    result.push({ title: "Legacy Compatibility", modules: [...legacy].map(standardModule) });
    const needle = search.trim().toLowerCase();
    return result.map((group) => ({ ...group, modules: group.modules.filter((module) => !needle || [module.label, module.description, ...module.controls.map((control) => control.label)].join(" ").toLowerCase().includes(needle)) })).filter((group) => group.modules.length);
  }, [search]);

  const visibleRoles = useMemo(() => {
    const needle = roleSearch.trim().toLowerCase();
    return roles.filter((role) => !needle || role.id.toLowerCase().includes(needle));
  }, [roleSearch, roles]);

  return (
    <PermissionGuard module="roles" action="view" showMessage>
      <div className="page-shell space-y-5">
        <div className="page-header">
          <div><div className="badge mb-3">Sandbox Preview • Read Only</div><h1 className="page-title">Permissions Matrix</h1><p className="page-subtitle">Compare effective permissions across roles without changing live role data.</p></div>
          <Link href="/admin/roles" className="btn-secondary gap-2"><ArrowLeft size={16} />Back to Current Editor</Link>
        </div>
        <div className="notice-success flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0" size={19} /><div><div className="font-black">Safe comparison mode</div><div className="text-sm">CAD is consolidated for display only. Stored permissions and live access remain unchanged.</div></div></div>
        <div className="card-modern grid gap-3 lg:grid-cols-2">
          <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className="input w-full pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search modules or permissions" /></label>
          <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className="input w-full pl-10" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Filter roles" /></label>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">Enabled</span><span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">Data scope</span><span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">Sensitive</span></div>
        {loading ? <div className="card-modern text-slate-500">Loading role permissions...</div> : groups.map((group) => (
          <section key={group.title} className="space-y-3"><h2 className="text-sm font-black uppercase tracking-wide text-slate-400">{group.title}</h2>{group.modules.map((module) => (
            <details key={module.key} className="card-modern group" open={module.key === "cad_cases_consolidated"}>
              <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-4"><div><h3 className="font-black">{module.label}</h3><p className="mt-1 text-xs text-slate-500">{module.description}</p></div><span className="badge">{module.controls.length} controls</span></div></summary>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-max text-sm"><thead className="sticky top-0 bg-slate-50"><tr><th className="sticky left-0 z-10 min-w-52 border-r bg-slate-50 p-3 text-left">Role</th>{module.controls.map((control) => <th key={control.label} className={`min-w-28 p-3 text-center text-xs ${control.kind === "sensitive" ? "text-rose-700" : control.kind === "scope" ? "text-blue-700" : "text-slate-600"}`}>{control.label}</th>)}</tr></thead>
                  <tbody>{visibleRoles.map((role) => <tr key={role.id} className="border-t hover:bg-slate-50"><td className="sticky left-0 border-r bg-white p-3 font-black">{role.id}</td>{module.controls.map((control) => { const active = hasControl(role, control); return <td key={control.label} className="p-3 text-center"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${active ? control.kind === "sensitive" ? "border-rose-600 bg-rose-600 text-white" : control.kind === "scope" ? "border-blue-600 bg-blue-600 text-white" : "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>{active && <Check size={15} strokeWidth={3} />}</span></td>; })}</tr>)}</tbody>
                </table>
              </div>
            </details>
          ))}</section>
        ))}
      </div>
    </PermissionGuard>
  );
}
