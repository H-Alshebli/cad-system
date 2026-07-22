"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#eef4f6] text-[#274C5A]">
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
      <main className="relative z-10 h-screen min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#eef4f6] text-[#274C5A]">
        <div className="relative z-10">
          <EnvironmentBanner />

          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#86A7B2]/25 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-xl border border-[#86A7B2]/30 bg-[#f8fbfc] px-3 py-2 text-sm font-bold text-[#274C5A]"
              aria-label="Open menu"
            >
              Menu
            </button>

            <div className="text-center">
              <div className="text-sm font-bold text-[#274C5A]">
                Lazem HCAD
              </div>
              <div className="text-[11px] text-[#7F7F7F]">
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
