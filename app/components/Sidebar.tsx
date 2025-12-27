"use client";
import { assignLegacyCasesToMDL } from "@/lib/adminActions";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { can } from "@/lib/can";
import { onAuthStateChanged } from "firebase/auth";


export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const { user, loading } = useCurrentUser();
  const permissions = usePermissions(user?.roleId);

  const [dark, setDark] = useState(false);
  useEffect(() => {
    console.log("ENV:", process.env.NEXT_PUBLIC_ENV);
  }, []);
  
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    console.log("🔥 Firebase Auth user:", user);
  });
  return () => unsub();
}, []);

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
     HELPERS
  ============================= */
  const linkClass = (path: string) =>
    pathname.startsWith(path)
      ? "bg-blue-600 text-white font-semibold"
      : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800";

  /* =============================
     GUARDS (DO NOT HIDE SIDEBAR)
  ============================= */
  if (loading) {
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
     ROLE LOGIC
  ============================= */
  const isAdmin = user.roleId === "admin";

  /* =============================
     UI
  ============================= */
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-900 border-r dark:border-gray-700 flex flex-col">
      
      {/* Header */}
      <div className="p-4 text-lg font-bold border-b dark:border-gray-700">
        CAD System
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {user.name || user.email}
        </div>
        <div className="text-[10px] text-gray-400">
          Role: {user.roleId || "none"}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 text-sm">

        {(isAdmin || can(permissions, "projects", "view")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/projects")}`}
            href="/projects"
          >
            Projects
          </Link>
        )}

        {(isAdmin || can(permissions, "dashboards", "view")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/dashboard")}`}
            href="/dashboard"
          >
            Dashboard
          </Link>
        )}

        {(isAdmin || can(permissions, "cases", "view")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/cases")}`}
            href="/cases"
          >
            Cases
          </Link>
        )}

        {(isAdmin || can(permissions, "cases", "create")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/cases/new")}`}
            href="/cases/new"
          >
            New Case
          </Link>
        )}

        {(isAdmin || can(permissions, "clinics", "view")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/clinic")}`}
            href="/clinic"
          >
            Clinics
          </Link>
        )}

        {(isAdmin || can(permissions, "ambulances", "view")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/ambulances")}`}
            href="/ambulances"
          >
            Ambulances
          </Link>
        )}

        {(isAdmin || can(permissions, "roaming", "view")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/roaming")}`}
            href="/roaming"
          >
            Roaming
          </Link>
        )}

        {(isAdmin || can(permissions, "reports", "view")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/reports")}`}
            href="/reports"
          >
            Reports
          </Link>
        )}

        {(isAdmin || can(permissions, "users", "view")) && (
          <Link
            className={`block rounded px-3 py-2 ${linkClass("/admin/users")}`}
            href="/admin/users"
          >
            Users
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t dark:border-gray-700 space-y-2">

        <button
          onClick={toggleTheme}
          className="w-full px-3 py-2 rounded border bg-gray-100 dark:bg-gray-800 dark:border-gray-600 text-black dark:text-white"
        >
          {dark ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
{/* <button
  onClick={assignLegacyCasesToMDL}
  className="bg-orange-600 text-white px-4 py-2 rounded"
>
  Assign legacy cases to MDL Soundstorm 25
</button> */}

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
