"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PERMISSION_MATRIX } from "../../../lib/permissionsMatrix";


export default function RolesPage() {
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<any>({});

  const togglePermission = (module: string, action: string) => {
    setPermissions((prev: any) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev?.[module]?.[action],
      },
    }));
  };

  const createRole = async () => {
    if (!roleName) return alert("Role name required");

    await setDoc(doc(db, "roles", roleName), {
      name: roleName,
      permissions,
    });

    alert("Role created!");
    setRoleName("");
    setPermissions({});
  };

  return (
    <div className="p-6 space-y-6 text-white">
      <h1 className="text-xl font-bold">Roles Management</h1>

      {/* Role Name */}
      <input
        value={roleName}
        onChange={(e) => setRoleName(e.target.value)}
        placeholder="role name (dispatcher)"
        className="bg-slate-800 border px-3 py-2 rounded w-64"
      />

      {/* Permissions */}
      <div className="space-y-4">
        {Object.entries(PERMISSION_MATRIX).map(([module, actions]) => (
          <div key={module}>
            <h3 className="font-semibold">{module}</h3>
            <div className="flex gap-4 flex-wrap">
              {(actions as string[]).map((action) => (
                <label key={action} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissions?.[module]?.[action] || false}
                    onChange={() => togglePermission(module, action)}
                  />
                  {action}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={createRole}
        className="bg-blue-600 px-4 py-2 rounded"
      >
        Create Role
      </button>
    </div>
  );
}
