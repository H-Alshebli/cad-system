"use client";
import * as XLSX from "xlsx";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import PermissionGuard from "@/app/components/PermissionGuard";

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
  const exportToExcel = () => {
  if (!users.length) return;

  // Prepare clean export data
  const exportData = users.map((u) => ({
    Name: u.name,
    Email: u.email,
    Role: u.role,
    Status: u.active ? "Active" : "Disabled",
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

  // Auto column width
  const maxWidth = exportData.reduce((w, r) => Math.max(w, r.Name.length), 10);
  worksheet["!cols"] = [
    { wch: 25 },
    { wch: 30 },
    { wch: 20 },
    { wch: 15 },
  ];

  // Download file
  XLSX.writeFile(workbook, "Users_List.xlsx");
};

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
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-[#d8e6ea] bg-white p-6 text-sm font-semibold text-[#274C5A] shadow-sm">
          Loading users...
        </div>
      </div>
    );
  }

return (
  <PermissionGuard module="users" action="view" showMessage={true}>
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-[#d8e6ea] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#74cdda]">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-black text-[#123746]">
            Users Management
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#607482]">
            Review users, assign roles, and control active access.
          </p>
        </div>

        <button
          onClick={exportToExcel}
          className="inline-flex items-center justify-center rounded-2xl bg-[#274C5A] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-[#274C5A]/15 transition hover:bg-[#1d3b47]"
        >
          Export to Excel
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#d8e6ea] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[#d8e6ea] bg-[#f7fbfc] text-xs uppercase tracking-wide text-[#607482]">
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
                className="border-t border-[#e1ebef] transition hover:bg-[#f7fbfc]"
              >
                {/* NAME */}
                <td className="p-3 font-black text-[#123746]">{u.name}</td>

                {/* EMAIL */}
                <td className="p-3 font-semibold text-[#274C5A]">{u.email}</td>

                {/* ROLE */}
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      updateRole(u.id, e.target.value)
                    }
                    className="rounded-xl border border-[#c8dce2] bg-[#f7fbfc] px-3 py-2 text-sm font-semibold text-[#123746] outline-none transition focus:border-[#74cdda] focus:bg-white"
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
                    className={`rounded-full border px-3 py-1 text-xs font-black
                      ${
                        u.active
                          ? "border-[#137a4a]/20 bg-[#dff8ed] text-[#137a4a]"
                          : "border-[#c8dce2] bg-[#edf3f5] text-[#607482]"
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
  </PermissionGuard>
);
}
