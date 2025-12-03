"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    pathname === path
      ? "text-blue-600 font-semibold"
      : "text-gray-700 hover:text-black";

  return (
    <nav className="w-full bg-white border-b p-4 shadow-sm">
      <div className="max-w-5xl mx-auto flex gap-6">
        <Link className={linkClass("/")} href="/dashboard">
          Home
        </Link>

        <Link className={linkClass("/cases")} href="/cases">
          Cases
        </Link>

        <Link className={linkClass("/cases/new")} href="/cases/new">
          New Case
        </Link>

        <Link className={linkClass("/ambulances")} href="/ambulances">
          Ambulances
        </Link>
      </div>
    </nav>
  );
}
