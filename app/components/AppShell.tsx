"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import CaseAlertListener from "./CaseAlertListener";
import EnvironmentBanner from "./EnvironmentBanner";

const PUBLIC_ROUTES = ["/login", "/register"];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#07111f] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="relative z-30 hidden h-screen w-[288px] min-w-[288px] shrink-0 overflow-hidden lg:block">
        <Sidebar />
      </aside>

      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed left-0 top-0 z-50 h-screen w-[288px] min-w-[288px] transition-transform duration-300 lg:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="relative z-10 h-screen min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#07111f] dark:text-slate-100">
        <div
          className="pointer-events-none fixed inset-0 hidden dark:block"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(37,99,235,0.16), transparent 34rem), radial-gradient(circle at top right, rgba(14,165,233,0.08), transparent 30rem), #07111f",
          }}
        />

        <div className="relative z-10">
          <EnvironmentBanner />

          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-[#07111f]/95">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="text-center">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Lazem HCAD
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Command Center
              </div>
            </div>

            <div className="w-10" />
          </div>

          <div className="w-full px-4 py-4 lg:px-6 lg:py-5">
            {children}
          </div>

          <CaseAlertListener />
        </div>
      </main>
    </div>
  );
}
