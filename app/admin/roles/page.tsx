"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
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
import PermissionGuard from "@/app/components/PermissionGuard";

export default function RolesPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    const snap = await getDocs(collection(db, "roles"));
    setRoles(snap.docs.map((d) => d.id).sort((a, b) => a.localeCompare(b)));
  };

  const loadRole = async (roleId: string) => {
    setLoading(true);

    const snap = await getDoc(doc(db, "roles", roleId));

    if (!snap.exists()) {
      alert("Role not found");
      setLoading(false);
      return;
    }

    const data = snap.data();

    setSelectedRoleId(roleId);
    setRoleName(roleId);
    setPermissions(normalizePermissions(data.permissions || {}));
    setLoading(false);
  };

  const startNew = () => {
    setSelectedRoleId("");
    setRoleName("");
    setPermissions(normalizePermissions({}));
    setSearch("");
  };

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

  const setPermissionSafe = (
    target: PermissionsMap,
    moduleKey: string,
    action: string,
    value: boolean
  ) => {
    if (!target[moduleKey]) {
      target[moduleKey] = {};
    }

    target[moduleKey][action] = value;
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

  const applyClientPreset = () => {
    const next = normalizePermissions({});

    setPermissionSafe(next, "client_portal", "view", true);
    setPermissionSafe(next, "client_cases", "view", true);
    setPermissionSafe(next, "client_cases", "view_own", true);
    setPermissionSafe(next, "client_cases", "create", true);
    setPermissionSafe(next, "client_cases", "track", true);
    setPermissionSafe(next, "client_dashboards", "timeline", true);
    setPermissionSafe(next, "client_dashboards", "epcr", true);

    setPermissions(next);
  };

  const applyDispatchPreset = () => {
    const next = normalizePermissions({});

    setPermissionSafe(next, "call_intake", "view", true);
    setPermissionSafe(next, "call_intake", "create", true);

    setPermissionSafe(next, "b2c_requests", "view", true);
    setPermissionSafe(next, "b2c_requests", "create", true);
    setPermissionSafe(next, "b2c_requests", "update", true);
    setPermissionSafe(next, "b2c_requests", "activate_cad", true);

    setPermissionSafe(next, "cases", "view", true);
    setPermissionSafe(next, "cases", "create", true);
    setPermissionSafe(next, "cases", "update", true);

    setPermissionSafe(next, "missions", "view", true);

    setPermissionSafe(next, "dashboards", "timeline", true);
    setPermissionSafe(next, "dashboards", "epcr", true);

    setPermissionSafe(next, "ambulances", "view", true);
    setPermissionSafe(next, "projects", "view", true);
    setPermissionSafe(next, "location_picker", "view", true);

    setPermissions(next);
  };

  const applyParamedicPreset = () => {
    const next = normalizePermissions({});

    setPermissionSafe(next, "missions", "view", true);
    setPermissionSafe(next, "missions", "update", true);

    setPermissionSafe(next, "b2c_requests", "view", true);

    setPermissionSafe(next, "cases", "view", true);
    setPermissionSafe(next, "cases", "update", true);

    setPermissionSafe(next, "epcr", "view", true);
    setPermissionSafe(next, "epcr", "create", true);
    setPermissionSafe(next, "epcr", "update", true);

    setPermissionSafe(next, "location_picker", "view", true);

    setPermissions(next);
  };

  const saveRole = async () => {
    const cleanRoleName = roleName.trim();

    if (!cleanRoleName) {
      alert("Role name required");
      return;
    }

    setSaving(true);

    const ref = doc(db, "roles", cleanRoleName);
    const exists = (await getDoc(ref)).exists();

    const payload = {
      name: cleanRoleName,
      permissions: normalizePermissions(permissions),
      updatedAt: serverTimestamp(),
    };

    if (exists) {
      await updateDoc(ref, payload);
      alert("Role updated!");
    } else {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
      alert("Role created!");
    }

    setSaving(false);
    setSelectedRoleId(cleanRoleName);
    setRoleName(cleanRoleName);
    await loadRoles();
  };

  const deleteRoleHandler = async () => {
    if (!selectedRoleId) return;

    if (!confirm(`Delete role "${selectedRoleId}"?`)) return;

    await deleteDoc(doc(db, "roles", selectedRoleId));
    alert("Role deleted!");

    startNew();
    await loadRoles();
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
            `${action} ${ACTION_LABELS[action] || ""}`
              .toLowerCase()
              .includes(q)
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

  return (
    <PermissionGuard module="roles" action="view" showMessage={true}>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <div className="badge mb-3">Access Control</div>

            <h1 className="page-title">Roles & Permissions</h1>

            <p className="page-subtitle">
              Manage what each role can see and do across HCAD, B2C requests,
              CAD cases, ePCR, resources, dashboards, and client access.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            Enabled:{" "}
            <span className="font-black text-blue-600 dark:text-blue-300">
              {enabledCount}
            </span>{" "}
            / {totalCount}
          </div>
        </div>

        <div className="card-modern">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[260px_1fr_auto]">
            <select
              value={selectedRoleId}
              onChange={(e) =>
                e.target.value ? loadRole(e.target.value) : startNew()
              }
              className="select"
            >
              <option value="">+ New Role</option>

              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="role name, example: dispatcher / paramedic / client"
              className="input"
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveRole}
                disabled={saving || loading}
                className="btn-primary"
              >
                {saving
                  ? "Saving..."
                  : selectedRoleId
                  ? "Save Changes"
                  : "Create Role"}
              </button>

              {selectedRoleId && (
                <>
                  <button onClick={startNew} className="btn-secondary">
                    New
                  </button>

                  <button onClick={deleteRoleHandler} className="btn-danger">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enableCommonViewPermissions}
              className="btn-secondary"
            >
              Enable All View
            </button>

            <button
              type="button"
              onClick={applyDispatchPreset}
              className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-500/20 dark:text-blue-200"
            >
              Apply Dispatch Preset
            </button>

            <button
              type="button"
              onClick={applyParamedicPreset}
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-200"
            >
              Apply Paramedic Preset
            </button>

            <button
              type="button"
              onClick={applyClientPreset}
              className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-bold text-purple-700 transition hover:bg-purple-500/20 dark:text-purple-200"
            >
              Apply Client Preset
            </button>

            <button
              type="button"
              onClick={() => setPermissions(normalizePermissions({}))}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-500/20 dark:text-red-200"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="card-modern">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules or actions..."
            className="input"
          />
        </div>

        {loading ? (
          <div className="card-modern text-slate-500 dark:text-slate-400">
            Loading role permissions...
          </div>
        ) : (
          <div className="space-y-6">
            {filteredGroups.map((group) => (
              <section key={group.title} className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">
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
                      <div key={moduleKey} className="card-modern">
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-black text-slate-950 dark:text-white">
                              {MODULE_LABELS[moduleKey] || moduleKey}
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              {MODULE_DESCRIPTIONS[moduleKey] || ""}
                            </p>
                          </div>

                          <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            {selectedCount}/{actions.length}
                          </div>
                        </div>

                        <div className="mb-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setModulePermissions(moduleKey, true)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Select all
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setModulePermissions(moduleKey, false)
                            }
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
                                onClick={() =>
                                  togglePermission(moduleKey, action)
                                }
                                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                                  enabled
                                    ? "border-green-600 bg-green-500/10 text-green-700 dark:text-green-200"
                                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-500 dark:border-slate-700 dark:bg-[#0b1220] dark:text-slate-300"
                                }`}
                              >
                                <span>{ACTION_LABELS[action] || action}</span>

                                <span
                                  className={`h-4 w-4 rounded-full border ${
                                    enabled
                                      ? "border-green-500 bg-green-500"
                                      : "border-slate-400"
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
        )}
      </div>
    </PermissionGuard>
  );
}