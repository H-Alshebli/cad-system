"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed top-0 left-0 z-50 md:hidden transition-transform duration-300 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-3 md:p-4 overflow-auto">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between mb-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            ☰
          </button>

          <div className="font-semibold text-sm">Lazem HCAD</div>

          <div className="w-10" />
        </div>

        {children}
      </main>
    </div>
  );
}