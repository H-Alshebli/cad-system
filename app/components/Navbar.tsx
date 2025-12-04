"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  // Toggle theme button
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
      ? "text-blue-600 font-semibold dark:text-blue-400"
      : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white";

  return (
    <nav className="w-full bg-white dark:bg-gray-900 border-b dark:border-gray-700 p-4 shadow-sm">
      <div className="max-w-5xl mx-auto flex gap-6 items-center justify-between">

        {/* LEFT MENU LINKS */}
        <div className="flex gap-6">
          <Link className={linkClass("/dashboard")} href="/dashboard">
            Dashboard
          </Link>

          <Link className={linkClass("/cases")} href="/cases">
            Cases
          </Link>

          <Link className={linkClass("/cases/new")} href="/cases/new">
            New Case
          </Link>

          <Link className={linkClass("/clinic")} href="/clinic">
            Clinic
          </Link>

          <Link className={linkClass("/ambulances")} href="/ambulances">
            Ambulances
          </Link>
        </div>

        {/* DARK MODE BUTTON */}
        <button
          onClick={toggleTheme}
          className="px-3 py-1 text-sm border rounded dark:border-gray-600
                     bg-gray-100 dark:bg-gray-800
                     text-black dark:text-white"
        >
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>

      </div>
    </nav>
  );
}
