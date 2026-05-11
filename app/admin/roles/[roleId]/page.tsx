"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ACTION_LABELS,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
  PERMISSION_GROUPS,
  PERMISSION_MATRIX,
  PermissionsMap,
  normalizePermissions,
} from "@/lib/permissionsMatrix";

export default function RolePermissionsPage({
  params,
}: {
  params: { roleId: string };
}) {
  const { roleId } = params;

  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadRole() {
      const snap = await getDoc(doc(db, "roles", roleId));

      if (snap.exists()) {
        setPermissions(normalizePermissions(snap.data().permissions || {}));
      } else {
        setPermissions(normalizePermissions({}));
      }

      setLoading(false);
    }

    loadRole();
  }, [roleId]);

  const togglePermission = (moduleKey: string, action: string) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        ...(prev[moduleKey] || {}),
        [action]: !prev?.[moduleKey]?.[action],
      },
    }));
  };

  const setModulePermissions = (moduleKey: string, value: boolean) => {
    const actions = PERMISSION_MATRIX[moduleKey] || [];

    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: actions.reduce<Record<string, boolean>>((acc, action) => {
        acc[action] = value;
        return acc;
      }, {}),
    }));
  };

  const applyClientPreset = () => {
    const next = normalizePermissions({});

    next.client_portal.view = true;
    next.client_cases.view = true;
    next.client_cases.view_own = true;
    next.client_cases.create = true;
    next.client_cases.track = true;
    next.client_dashboards.timeline = true;
    next.client_dashboards.epcr = true;

    setPermissions(next);
  };

  const enableCommonViewPermissions = () => {
    const next = normalizePermissions(permissions);

    Object.keys(PERMISSION_MATRIX).forEach((moduleKey) => {
      if (PERMISSION_MATRIX[moduleKey].includes("view")) {
        next[moduleKey].view = true;
      }
    });

    setPermissions(next);
  };

  const savePermissions = async () => {
    setSaving(true);

    await updateDoc(doc(db, "roles", roleId), {
      permissions: normalizePermissions(permissions),
      updatedAt: serverTimestamp(),
    });

    setSaving(false);
    alert("Permissions saved successfully");
  };

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return PERMISSION_GROUPS;

    return PERMISSION_GROUPS.map((group) => ({
      ...group,
      modules: group.modules.filter((moduleKey) => {
        const label = MODULE_LABELS[moduleKey] || moduleKey;
        const description = MODULE_DESCRIPTIONS[moduleKey] || "";
        const actions = PERMISSION_MATRIX[moduleKey] || [];

        return (
          moduleKey.toLowerCase().includes(q) ||
          label.toLowerCase().includes(q) ||
          description.toLowerCase().includes(q) ||
          actions.some((action) =>
            `${action} ${ACTION_LABELS[action] || ""}`.toLowerCase().includes(q)
          )
        );
      }),
    })).filter((group) => group.modules.length > 0);
  }, [search]);

  const enabledCount = useMemo(() => {
    return Object.values(permissions).reduce((sum, modulePerms) => {
      return sum + Object.values(modulePerms || {}).filter(Boolean).length;
    }, 0);
  }, [permissions]);

  const totalCount = useMemo(() => {
    return Object.values(PERMISSION_MATRIX).reduce(
      (sum, actions) => sum + actions.length,
      0
    );
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading permissions...</div>;
  }

  return (
    <div className="min-h-screen bg-[#030712] p-6 text-white">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Assign Permissions – <span className="capitalize">{roleId}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Control what this role can access across operations, resources,
              client access, reports, and administration.
            </p>
          </div>

          <div className="rounded-full border border-slate-700 bg-[#111827] px-4 py-2 text-sm text-slate-300">
            Enabled: <span className="font-semibold text-blue-300">{enabledCount}</span> / {totalCount}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules or actions..."
              className="h-11 w-full rounded-lg border border-slate-700 bg-[#0b1220] px-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500 lg:max-w-lg"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enableCommonViewPermissions}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
              >
                Enable all View permissions
              </button>

              <button
                type="button"
                onClick={applyClientPreset}
                className="rounded-full border border-blue-700 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-200 hover:bg-blue-500/20"
              >
                Apply Client Preset
              </button>

              <button
                type="button"
                onClick={() => setPermissions(normalizePermissions({}))}
                className="rounded-full border border-red-800 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {filteredGroups.map((group) => (
            <section key={group.title} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {group.title}
              </h2>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {group.modules.map((moduleKey) => {
                  const actions = PERMISSION_MATRIX[moduleKey] || [];
                  const modulePerms = permissions[moduleKey] || {};
                  const selectedCount = actions.filter(
                    (action) => modulePerms[action]
                  ).length;

                  return (
                    <div
                      key={moduleKey}
                      className="rounded-2xl border border-slate-800 bg-[#111827] p-4 shadow-sm"
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-white">
                            {MODULE_LABELS[moduleKey] || moduleKey}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {MODULE_DESCRIPTIONS[moduleKey] || ""}
                          </p>
                        </div>

                        <div className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                          {selectedCount}/{actions.length}
                        </div>
                      </div>

                      <div className="mb-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setModulePermissions(moduleKey, true)}
                          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setModulePermissions(moduleKey, false)}
                          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {actions.map((action) => {
                          const enabled = Boolean(modulePerms[action]);

                          return (
                            <button
                              key={action}
                              type="button"
                              onClick={() => togglePermission(moduleKey, action)}
                              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                                enabled
                                  ? "border-green-600 bg-green-500/10 text-green-200"
                                  : "border-slate-700 bg-[#0b1220] text-slate-300 hover:border-blue-600"
                              }`}
                            >
                              <span>{ACTION_LABELS[action] || action}</span>
                              <span
                                className={`h-4 w-4 rounded-full border ${
                                  enabled
                                    ? "border-green-500 bg-green-500"
                                    : "border-slate-500"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="sticky bottom-4 flex justify-end">
          <button
            onClick={savePermissions}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Permissions"}
          </button>
        </div>
      </div>
    </div>
  );
}
