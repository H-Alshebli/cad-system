"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function NewRolePage() {
  const router = useRouter();

  const [roleName, setRoleName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* =============================
     CREATE ROLE
  ============================= */

  async function createRole() {
    if (!roleName.trim()) {
      setError("Role name is required");
      return;
    }

    const roleId = roleName.trim().toLowerCase().replace(/\s+/g, "_");

    setLoading(true);
    setError("");

    const ref = doc(db, "roles", roleId);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      setLoading(false);
      setError("Role already exists");
      return;
    }

    await setDoc(ref, {
      name: roleName.trim(),
      permissions: {},
      createdAt: new Date(),
    });

    setLoading(false);

    // Redirect to permissions page
    router.push(`/admin/roles/${roleId}`);
  }

  /* =============================
     UI
  ============================= */

  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create New Role</h1>

      <div className="space-y-2">
        <label className="text-sm font-medium">Role Name</label>
        <input
          type="text"
          placeholder="Dispatcher"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      {error && (
        <div className="text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={createRole}
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Role"}
        </button>

        <button
          onClick={() => router.back()}
          className="px-5 py-2 border rounded dark:border-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
