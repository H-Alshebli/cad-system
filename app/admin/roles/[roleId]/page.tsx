"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =============================
   MODULES & ACTIONS
============================= */

const MODULES = [
  { key: "projects", label: "Projects" },
  { key: "dashboards", label: "Dashboards" },
  { key: "cases", label: "Cases" },
  { key: "epcr", label: "ePCR" },
  { key: "ambulances", label: "Ambulances" },
  { key: "roaming", label: "Roaming" },
  { key: "clinics", label: "Clinics" },
  { key: "users", label: "Users" },
  { key: "reports", label: "Reports" },
];

const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "import",
  "mark_complete",
];

/* =============================
   PAGE
============================= */

export default function RolePermissionsPage({
  params,
}: {
  params: { roleId: string };
}) {
  const { roleId } = params;

  const [permissions, setPermissions] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* =============================
     LOAD ROLE
  ============================= */

  useEffect(() => {
    async function loadRole() {
      const snap = await getDoc(doc(db, "roles", roleId));
      if (snap.exists()) {
        setPermissions(snap.data().permissions || {});
      }
      setLoading(false);
    }
    loadRole();
  }, [roleId]);

  /* =============================
     TOGGLE PERMISSION
  ============================= */

  function togglePermission(moduleKey: string, action: string) {
    setPermissions((prev: any) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [action]: !prev?.[moduleKey]?.[action],
      },
    }));
  }

  /* =============================
     SAVE
  ============================= */

  async function savePermissions() {
    setSaving(true);
    await updateDoc(doc(db, "roles", roleId), {
      permissions,
    });
    setSaving(false);
    alert("Permissions saved successfully");
  }

  if (loading) {
    return <div className="p-6">Loading permissions...</div>;
  }

  /* =============================
     UI
  ============================= */

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Assign Permissions – <span className="capitalize">{roleId}</span>
      </h1>

      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="p-3 text-left border-r">Module</th>
              {ACTIONS.map((action) => (
                <th key={action} className="p-3 text-center capitalize">
                  {action.replace("_", " ")}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {MODULES.map((module) => (
              <tr key={module.key} className="border-t">
                <td className="p-3 font-medium border-r">
                  {module.label}
                </td>

                {ACTIONS.map((action) => {
                  const enabled = !!permissions?.[module.key]?.[action];

                  return (
                    <td key={action} className="p-3 text-center">
                      <button
                        onClick={() =>
                          togglePermission(module.key, action)
                        }
                        className={`h-4 w-4 rounded-full border transition
                          ${
                            enabled
                              ? "bg-green-500 border-green-500"
                              : "bg-transparent border-gray-400"
                          }
                        `}
                        title={enabled ? "Enabled" : "Disabled"}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={savePermissions}
        disabled={saving}
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Permissions"}
      </button>
    </div>
  );
}
