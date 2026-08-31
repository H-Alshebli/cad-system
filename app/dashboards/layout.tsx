"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardCheck, LayoutDashboard, Sparkles } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

export default function DashboardsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: userLoading } = useCurrentUser();
  const { can, isAdmin, loading: permissionsLoading } = usePermissions(user?.role);

  const tabs = [
    {
      href: "/dashboards/timeline",
      label: "Timeline Dashboard",
      icon: <LayoutDashboard size={17} />,
      visible: isAdmin || can("dashboards", "timeline"),
    },
    {
      href: "/dashboards/cases",
      label: "Cases Dashboard",
      icon: <BarChart3 size={17} />,
      visible: isAdmin || can("dashboards", "epcr"),
    },
    {
      href: "/dashboards/cases-plus",
      label: "Cases Dashboard Plus",
      icon: <Sparkles size={17} />,
      visible: isAdmin || can("dashboards", "epcr"),
    },
    {
      href: "/dashboards/checklists",
      label: "Checklist Review",
      icon: <ClipboardCheck size={17} />,
      visible: isAdmin || can("checklist_review_global", "view"),
    },
  ].filter((tab) => tab.visible);

  if (userLoading || permissionsLoading) {
    return <div className="p-6 text-sm font-semibold text-[#607482]">Loading dashboards...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f5f7f8]">
      <div className="border-b border-[#86A7B2]/25 bg-white px-4 py-2 md:px-6">
        <div className="flex min-h-12 items-center gap-3 rounded-xl border border-[#86A7B2]/20 bg-white px-2">
          <div className="hidden shrink-0 px-2 text-sm font-black text-[#274C5A] md:block">
            Dashboards
          </div>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Dashboard navigation">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                  active
                    ? "border-[#274C5A] bg-[#274C5A] text-white shadow-sm"
                    : "border-transparent text-[#607482] hover:bg-[#f5f9fa] hover:text-[#274C5A]"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
