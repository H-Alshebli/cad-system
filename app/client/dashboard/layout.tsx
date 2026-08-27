"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3 } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

export default function ClientDashboardsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: userLoading } = useCurrentUser();
  const { can, loading: permissionsLoading } = usePermissions(user?.role);

  const tabs = [
    {
      href: "/client/dashboard/timeline",
      label: "Timeline Dashboard",
      icon: <Activity size={17} />,
      visible: can("client_dashboards", "timeline"),
    },
    {
      href: "/client/dashboard/epcr",
      label: "Cases Dashboard",
      icon: <BarChart3 size={17} />,
      visible: can("client_dashboards", "epcr"),
    },
  ].filter((tab) => tab.visible);

  if (userLoading || permissionsLoading) {
    return <div className="p-6 text-sm font-semibold text-[#607482]">Loading dashboards...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f5f7f8]">
      <div className="border-b border-[#86A7B2]/25 bg-white px-6 pt-5">
        <div className="mb-4">
          <h1 className="text-2xl font-black text-[#274C5A]">Dashboards</h1>
          <p className="mt-1 text-sm font-medium text-[#607482]">
            Case monitoring and clinical analytics for your assigned projects.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Client dashboard navigation">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center gap-2 rounded-t-xl border px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? "border-[#86A7B2]/35 border-b-white bg-white text-[#274C5A]"
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
      {children}
    </div>
  );
}
