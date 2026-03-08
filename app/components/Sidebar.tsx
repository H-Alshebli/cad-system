"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { can } from "@/lib/can";
import Can from "./Can";

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const { user, loading: userLoading } = useCurrentUser();
  const role = user?.role ?? "none";
  const { permissions, loading: permLoading } = usePermissions(role);

  const isAdmin = role === "admin";
  const [dark, setDark] = useState(false);

  useEffect(() => {
    console.log("👤 USER:", user);
    console.log("🔑 ROLE:", role);
    console.log("🛂 PERMISSIONS:", permissions);
  }, [user, role, permissions]);

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

  async function logout() {
    await signOut(auth);
    onClose?.();
    router.push("/login");
  }

  const linkClass = (path: string) =>
    pathname.startsWith(path)
      ? "block rounded px-3 py-2 bg-blue-600 text-white font-semibold"
      : "block rounded px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800";

  if (userLoading || permLoading) {
    return (
      <aside className="h-screen w-64 bg-gray-900 text-white p-4">
        Loading sidebar...
      </aside>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-64 bg-gray-400 text-white p-4">
        <img
          src="/icons/icon-512.png"
          alt="Lazem Logo"
          className="w-16 h-16 object-contain"
        />

        <div className="text-lg font-bold text-gray-900 dark:text-white mt-2">
          Lazem HCAD
        </div>
      </div>
    );
  }

  return (
    <aside className="h-screen w-64 bg-white dark:bg-gray-900 border-r dark:border-gray-700 flex flex-col">
    {/* HEADER */}
<div className="p-4 border-b dark:border-gray-700 flex flex-col items-center text-center gap-2 relative">

  {/* CLOSE BUTTON (Mobile only) */}
  {onClose && (
    <button
      onClick={onClose}
      className="absolute right-3 top-3 md:hidden text-gray-500 hover:text-red-500 text-xl"
    >
      ✕
    </button>
  )}

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

        <div className="text-[10px] text-gray-400">Role: {user.role}</div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 p-3 space-y-1 text-sm overflow-y-auto">
        {(isAdmin || can(permissions, "dashboards", "view")) && (
          <Link
            className={linkClass("/dashboard")}
            href="/dashboard"
            onClick={onClose}
          >
            Dashboard
          </Link>
        )}

        {(isAdmin || can(permissions, "dashboards", "view")) && (
          <Link
            className={linkClass("/dashboard/epcr")}
            href="/dashboard/epcr"
            onClick={onClose}
          >
            ePCR Dashboard
          </Link>
        )}

        {(isAdmin || can(permissions, "projects", "view")) && (
          <Link
            className={linkClass("/projects")}
            href="/projects"
            onClick={onClose}
          >
            Projects
          </Link>
        )}

        {(isAdmin || can(permissions, "ambulances", "view")) && (
          <Link
            className={linkClass("/ambulances")}
            href="/ambulances"
            onClick={onClose}
          >
            Ambulances
          </Link>
        )}

        {(isAdmin || can(permissions, "transport", "view")) && (
          <Link
            className={linkClass("/transport")}
            href="/transport"
            onClick={onClose}
          >
            Transporting/Coverage
          </Link>
        )}

        {(isAdmin || can(permissions, "users", "view")) && (
          <Link
            className={linkClass("/admin/users")}
            href="/admin/users"
            onClick={onClose}
          >
            Users Management
          </Link>
        )}

        {(isAdmin || can(permissions, "users", "view")) && (
          <Link
            className={linkClass("/admin/roles")}
            href="/admin/roles"
            onClick={onClose}
          >
            Roles
          </Link>
        )}

        {(isAdmin || can(permissions, "users", "view")) && (
          <Link
            className={linkClass("/location-picker")}
            href="/location-picker"
            onClick={onClose}
          >
            Location Picker
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