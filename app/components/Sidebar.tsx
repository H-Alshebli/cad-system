"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

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

  const linkClass = (path: string) =>
    pathname === path
      ? "bg-blue-600 text-white font-semibold"
      : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800";

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-900 border-r dark:border-gray-700 flex flex-col">
      
      {/* Logo / Title */}
      <div className="p-4 text-lg font-bold border-b dark:border-gray-700">
        CAD System
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 text-sm">
        <Link className={`block rounded px-3 py-2 ${linkClass("/dev/projects/")}`} href="/dev/projects/">
          Projects
        </Link>
        <Link className={`block rounded px-3 py-2 ${linkClass("/dashboard")}`} href="/dashboard">
          Dashboard
        </Link>

        <Link className={`block rounded px-3 py-2 ${linkClass("/cases")}`} href="/cases">
          Cases
        </Link>

        <Link className={`block rounded px-3 py-2 ${linkClass("/cases/new")}`} href="/cases/new">
          New Case
        </Link>

        <Link className={`block rounded px-3 py-2 ${linkClass("/clinic")}`} href="/clinic">
          Clinic
        </Link>

        <Link className={`block rounded px-3 py-2 ${linkClass("/ambulances")}`} href="/ambulances">
          Ambulances
        </Link>

        <Link className={`block rounded px-3 py-2 ${linkClass("/roaming")}`} href="/roaming">
          Roaming
        </Link>

        <Link className={`block rounded px-3 py-2 ${linkClass("/location-picker")}`} href="/location-picker">
          Location Picker
        </Link>
      </nav>

      {/* Theme Toggle */}
      <div className="p-4 border-t dark:border-gray-700">
        <button
          onClick={toggleTheme}
          className="w-full px-3 py-2 rounded border bg-gray-100 dark:bg-gray-800 dark:border-gray-600 text-black dark:text-white"
        >
          {dark ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>
    </aside>
  );
}
