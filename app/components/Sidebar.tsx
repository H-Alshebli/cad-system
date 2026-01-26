"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { can } from "@/lib/can";
import Can from "./Can";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const { user, loading: userLoading } = useCurrentUser();

  const role = user?.role ?? "none";

  // ✅ FIX: destructure correctly
  const { permissions, loading: permLoading } = usePermissions(role);

  const isAdmin = role === "admin";

  const [dark, setDark] = useState(false);

  /* =============================
     DEBUG LOGS (KEEP FOR NOW)
  ============================= */
  useEffect(() => {
    console.log("👤 USER:", user);
    console.log("🔑 ROLE:", role);
    console.log("🛂 PERMISSIONS:", permissions);
  }, [user, role, permissions]);

  /* =============================
     THEME
  ============================= */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  function toggleTheme() {
    if (dark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDark(true);
    }
  }

  /* =============================
     LOGOUT
  ============================= */
  async function logout() {
    await signOut(auth);
    router.push("/login");
  }

  /* =============================
     LINK STYLE
  ============================= */
  const linkClass = (path: string) =>
    pathname.startsWith(path)
      ? "bg-blue-600 text-white font-semibold"
      : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800";

  /* =============================
     LOADING GUARD
  ============================= */
  if (userLoading || permLoading) {
    return (
      <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white p-4">
        Loading sidebar...
      </aside>
    );
  }

  if (!user) {
    return (
      <aside className="fixed left-0 top-0 h-screen w-64 bg-red-900 text-white p-4">
        Not logged in
      </aside>
    );
  }

  /* =============================
     UI
  ============================= */
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-900 border-r dark:border-gray-700 flex flex-col">

      {/* HEADER */}
      <div className="p-4 border-b dark:border-gray-700 flex flex-col items-center text-center gap-2">
        <img
          src="/icons/icon-512.png"
          alt="Lazem Logo"
          className="w-16 h-16 object-contain"
        />

        <div className="text-lg font-bold text-gray-900 dark:text-white">
          Lazem HCAD
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          {user.name || user.email}
        </div>

        <div className="text-[10px] text-gray-400">
          Role: {user.role}
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 p-3 space-y-1 text-sm">

        {(isAdmin || can(permissions, "dashboards", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/dashboard")}`} href="/dashboard">
            Dashboard
          </Link>
        )}
        {(isAdmin || can(permissions, "dashboards", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/dashboard/epcr")}`} href="/dashboard/epcr">
            ePCR Dashboard
          </Link>
        )}

        {(isAdmin || can(permissions, "projects", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/projects")}`} href="/projects">
            Projects
          </Link>
        )}

        {(isAdmin || can(permissions, "cases", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/cases")}`} href="/cases">
            Cases
          </Link>
        )}

        {(isAdmin || can(permissions, "cases", "create")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/cases/new")}`} href="/cases/new">
            New Case
          </Link>
        )}

        {(isAdmin || can(permissions, "clinics", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/clinic")}`} href="/clinic">
            Clinics
          </Link>
        )}

        {(isAdmin || can(permissions, "ambulances", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/ambulances")}`} href="/ambulances">
            Ambulances
          </Link>
        )}

        {(isAdmin || can(permissions, "roaming", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/roaming")}`} href="/roaming">
            Roaming
          </Link>
        )}

        {(isAdmin || can(permissions, "reports", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/reports")}`} href="/reports">
            Reports
          </Link>
        )}

        {(isAdmin || can(permissions, "users", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/admin/users")}`} href="/admin/users">
            Users Management
          </Link>
        )}
         {(isAdmin || can(permissions, "users", "view")) && (
          <Link className={`block rounded px-3 py-2 ${linkClass("/admin/roles")}`} href="/admin/roles">
            Roles
          </Link>
        )}
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t dark:border-gray-700 space-y-2">

        <button
          onClick={toggleTheme}
          className="w-full px-3 py-2 rounded border bg-gray-100 dark:bg-gray-800 dark:border-gray-600 text-black dark:text-white"
        >
          {dark ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>

        {/* PERMISSION TEST */}
        <Can permission="projects.view">
          <div className="text-green-400 text-xs text-center">
            ✅ projects.view granted
          </div>
        </Can>

        <button
          onClick={logout}
          className="w-full px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
