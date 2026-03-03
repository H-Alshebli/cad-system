"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PERMISSION_MATRIX } from "../../../lib/permissionsMatrix";

export default function RolesPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // Load existing roles
  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    const snap = await getDocs(collection(db, "roles"));
    setRoles(snap.docs.map((d) => d.id));
  };

  const togglePermission = (module: string, action: string) => {
    setPermissions((prev: any) => ({
      ...prev,
      [module]: {
        ...(prev[module] || {}),
        [action]: !prev?.[module]?.[action],
      },
    }));
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
    setRoleName(roleId); // keep EXACT name
    setPermissions(data.permissions || {});
    setLoading(false);
  };

  const saveRole = async () => {
    if (!roleName) return alert("Role name required");

    const ref = doc(db, "roles", roleName); // KEEP EXACT NAME

    const exists = (await getDoc(ref)).exists();

    const payload = {
      name: roleName,
      permissions,
      updatedAt: serverTimestamp(),
    };

    if (exists) {
      await updateDoc(ref, payload);
      alert("Role updated!");
    } else {
      await setDoc(ref, payload);
      alert("Role created!");
    }

    setSelectedRoleId(roleName);
    loadRoles();
  };

  const deleteRoleHandler = async () => {
    if (!selectedRoleId) return;

    if (!confirm(`Delete role "${selectedRoleId}"?`)) return;

    await deleteDoc(doc(db, "roles", selectedRoleId));
    alert("Role deleted!");

    setSelectedRoleId("");
    setRoleName("");
    setPermissions({});
    loadRoles();
  };

  const startNew = () => {
    setSelectedRoleId("");
    setRoleName("");
    setPermissions({});
  };

  return (
    <div className="p-6 space-y-6 text-white">
      <h1 className="text-xl font-bold">Roles Management</h1>

      {/* Select Role */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={selectedRoleId}
          onChange={(e) =>
            e.target.value ? loadRole(e.target.value) : startNew()
          }
          className="bg-slate-800 border px-3 py-2 rounded"
        >
          <option value="">+ New Role</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>

        {/* Role Name */}
        <input
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          placeholder="role name"
          className="bg-slate-800 border px-3 py-2 rounded w-64"
        />

        <button
          onClick={saveRole}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          {selectedRoleId ? "Save Changes" : "Create Role"}
        </button>

        {selectedRoleId && (
          <>
            <button
              onClick={startNew}
              className="border px-4 py-2 rounded"
            >
              New
            </button>

            <button
              onClick={deleteRoleHandler}
              className="bg-red-600 px-4 py-2 rounded"
            >
              Delete
            </button>
          </>
        )}
      </div>

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
    </div>
  );
}