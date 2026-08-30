"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Sidebar from "./Sidebar";
import CaseAlertListener from "./CaseAlertListener";
import ChatNotificationListener from "./ChatNotificationListener";
import EnvironmentBanner from "./EnvironmentBanner";
import ItSupportWidget from "./ItSupportWidget";
import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { isClientAccount } from "@/lib/userAccounts";

const PUBLIC_ROUTES = ["/login", "/register"];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const isCrewProfileRoute =
    pathname === "/crew-profile" || pathname.startsWith("/crew-profile/");
  const isClientPortalRoute =
    pathname === "/client" || pathname.startsWith("/client/");

  useEffect(() => {
    if (isPublicRoute || loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.active === false && !isClientAccount(user) && !isCrewProfileRoute) {
      router.replace("/crew-profile");
      return;
    }
    if (user.active !== false && isClientAccount(user) && !isClientPortalRoute) {
      router.replace("/client");
      return;
    }
    if (user.active !== false && (!user.role || user.role === "none") && !isCrewProfileRoute) {
      router.replace("/login");
    }
  }, [isClientPortalRoute, isCrewProfileRoute, isPublicRoute, loading, router, user]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef4f6] text-sm font-semibold text-[#274C5A]">
        Loading...
      </div>
    );
  }

  if (user.active === false) {
    if (isClientAccount(user)) {
      return (
        <div className="min-h-screen bg-[#eef4f6] text-[#274C5A]">
          <EnvironmentBanner />
          <main className="mx-auto flex min-h-[80vh] w-full max-w-2xl items-center px-4 py-8">
            <div className="card-modern w-full text-center">
              <h1 className="text-2xl font-black">Client account pending activation</h1>
              <p className="mt-2 text-sm font-semibold text-[#607482]">
                An administrator must activate and link this account to a project before portal access is available.
              </p>
              <button
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  router.replace("/login");
                }}
                className="btn-secondary mt-5"
              >
                Logout
              </button>
            </div>
          </main>
        </div>
      );
    }
    if (!isCrewProfileRoute) return null;

    return (
      <div className="min-h-screen bg-[#eef4f6] text-[#274C5A]">
        <EnvironmentBanner />
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#86A7B2]/25 bg-white px-4 py-3 lg:px-6">
          <div>
            <div className="font-black">Lazem HCAD</div>
            <div className="text-xs font-semibold text-[#607482]">
              Account pending activation — complete your crew profile
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut(auth);
              router.replace("/login");
            }}
            className="rounded-xl border border-[#c8dce2] bg-white px-4 py-2 text-sm font-black text-[#274C5A]"
          >
            Logout
          </button>
        </header>
        <main className="mx-auto w-full max-w-[96rem] px-4 py-5 lg:px-6">{children}</main>
      </div>
    );
  }

  if (isClientAccount(user) && !isClientPortalRoute) return null;

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
          <ChatNotificationListener />
          <ItSupportWidget />
        </div>
      </main>
    </div>
  );
}
