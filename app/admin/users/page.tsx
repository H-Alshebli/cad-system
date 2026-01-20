"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =========================
   TYPES
========================= */
type UserType = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  /* =========================
     LOAD USERS (Realtime)
  ========================= */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UserType, "id">),
      }));
      setUsers(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  /* =========================
     LOAD ROLES (Realtime)
     🔥 THIS IS THE FIX
  ========================= */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "roles"), (snap) => {
      const list = snap.docs.map((d) => d.id);
      setRoles(list);
    });

    return () => unsub();
  }, []);

  /* =========================
     UPDATE ROLE
  ========================= */
  const updateRole = async (userId: string, role: string) => {
    await updateDoc(doc(db, "users", userId), { role });
  };

  /* =========================
     TOGGLE ACTIVE
  ========================= */
  const toggleActive = async (user: UserType) => {
    await updateDoc(doc(db, "users", user.id), {
      active: !user.active,
    });
  };

  if (loading) {
    return <div className="p-6 text-gray-400">Loading users...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">
        Users Management
      </h1>

      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-gray-300">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-center">Active</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-slate-700 hover:bg-slate-800/50"
              >
                {/* NAME */}
                <td className="p-3 text-white">{u.name}</td>

                {/* EMAIL */}
                <td className="p-3 text-gray-300">{u.email}</td>

                {/* ROLE */}
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      updateRole(u.id, e.target.value)
                    }
                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>

                {/* ACTIVE */}
                <td className="p-3 text-center">
                  <button
                    onClick={() => toggleActive(u)}
                    className={`px-3 py-1 rounded text-xs font-semibold
                      ${
                        u.active
                          ? "bg-green-600 text-white"
                          : "bg-gray-600 text-gray-200"
                      }`}
                  >
                    {u.active ? "Active" : "Disabled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
