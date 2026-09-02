"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Activity,
  Ambulance,
  Bell,
  BriefcaseMedical,
  ClipboardPlus,
  ClipboardList,
  LayoutDashboard,
  Languages,
  LogOut,
  MapPin,
  Stethoscope,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { isClientAccount } from "@/lib/userAccounts";
import { can } from "@/lib/can";
import { useClientBrand } from "@/lib/useClientBrand";
import { useClientI18n } from "@/lib/clientI18n";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  visible: boolean;
};

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const { user, loading: userLoading } = useCurrentUser();
  const role = user?.role ?? "none";
  const { permissions, loading: permLoading } = usePermissions(role);

  const isAdmin = role === "admin";
  const isClientPortalUser = can(permissions, "client_portal", "view");
  const clientAccount = isClientAccount(user);
  const clientBrand = useClientBrand(clientAccount ? user?.uid : undefined);
  const { t, dir, language, toggleLanguage } = useClientI18n();
  const clientText = (text: string) => clientAccount ? t(text) : text;

  async function logout() {
    await signOut(auth);
    onClose?.();
    router.push("/login");
  }

  function isActive(path: string) {
    if (path === "/client") return pathname === "/client";
    if (path === "/b2c/requests") {
      return pathname === "/b2c/requests" || pathname.startsWith("/b2c/requests/");
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  }

  const linkClass = (path: string) => {
    const active = isActive(path);

    return active
      ? "group flex items-center gap-3 rounded-xl border border-[#274C5A] bg-[#274C5A] px-3 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#274C5A]/20"
      : "group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-semibold text-[#274C5A]/72 transition hover:border-[#86A7B2]/35 hover:bg-[#86A7B2]/12 hover:text-[#274C5A]";
  };

  const sectionTitleClass =
    "px-3 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#7F7F7F]";

  const clientItems: NavItem[] = [
    {
      href: "/client/dashboard",
      label: clientText("Dashboards"),
      icon: <LayoutDashboard size={18} />,
      visible:
        can(permissions, "client_dashboards", "timeline") ||
        can(permissions, "client_dashboards", "epcr"),
    },
    {
      href: "/client/cases/new",
      label: clientText("Create Case"),
      icon: <BriefcaseMedical size={18} />,
      visible: can(permissions, "client_cases", "create"),
    },
    {
      href: "/client/cases",
      label: clientText("My Cases"),
      icon: <ClipboardList size={18} />,
      visible:
        can(permissions, "client_cases", "view") ||
        can(permissions, "client_cases", "view_own"),
    },
  ];

  const operationsItems: NavItem[] = [
    {
      href: "/call-intake",
      label: "New Case / Call Intake",
      icon: <ClipboardPlus size={18} />,
      visible:
        isAdmin ||
        can(permissions, "call_intake", "view") ||
        can(permissions, "cases", "create"),
    },
    {
      href: "/dashboards",
      label: "Dashboards",
      icon: <LayoutDashboard size={18} />,
      visible:
        isAdmin ||
        can(permissions, "dashboards", "timeline") ||
        can(permissions, "dashboards", "epcr") ||
        can(permissions, "checklist_review_global", "view"),
    },
    {
      href: "/cadcases",
      label: "CAD Cases",
      icon: <BriefcaseMedical size={18} />,
      visible: isAdmin || can(permissions, "cad_cases_new", "view"),
    },
    {
      href: "/cases",
      label: "CAD Cases (Old)",
      icon: <BriefcaseMedical size={18} />,
      visible: isAdmin || can(permissions, "cad_cases_old", "view"),
    },
    {
      href: "/b2c/requests",
      label: "B2C Requests",
      icon: <ClipboardList size={18} />,
      visible:
        isAdmin ||
        can(permissions, "b2c_requests", "view") ||
        can(permissions, "call_intake", "view") ||
        can(permissions, "cases", "view"),
    },
    {
      href: "/missions",
      label: "My Missions",
      icon: <Stethoscope size={18} />,
      visible: isAdmin || can(permissions, "missions", "view"),
    },
    {
      href: "/missions-plus",
      label: "My Missions+",
      icon: <Activity size={18} />,
      visible: isAdmin || can(permissions, "missions_plus", "view"),
    },
    {
      href: "/crew-profile",
      label: "Crew Profile",
      icon: <UserRound size={18} />,
      visible: !clientAccount,
    },
    {
      href: "/submissions",
      label: "Submissions",
      icon: <ClipboardList size={18} />,
      visible: isAdmin || can(permissions, "submissions", "view"),
    },
  ];

  const managementItems: NavItem[] = [
    {
      href: "/projects",
      label: "Projects",
      icon: <ClipboardList size={18} />,
      visible: isAdmin || can(permissions, "projects", "view"),
    },
    {
      href: "/ambulances",
      label: "Ambulances",
      icon: <Ambulance size={18} />,
      visible: isAdmin || can(permissions, "ambulances", "view"),
    },
    {
      href: "/transport",
      label: "Transporting/Coverage",
      icon: <Truck size={18} />,
      visible: isAdmin || can(permissions, "transport", "view"),
    },
    {
      href: "/admin/users",
      label: "Users Management",
      icon: <Users size={18} />,
      visible: isAdmin || can(permissions, "users", "view"),
    },
    {
      href: "/admin/crew-profiles",
      label: "Crew Profiles",
      icon: <UserRound size={18} />,
      visible: isAdmin || can(permissions, "crew_profile", "view_all"),
    },
    {
      href: "/admin/employee-entitlements",
      label: "Employee Entitlements",
      icon: <WalletCards size={18} />,
      visible: isAdmin || can(permissions, "employee_entitlements", "view_all"),
    },
    {
      href: "/admin/roles",
      label: "Roles",
      icon: <ShieldCheck size={18} />,
      visible: isAdmin || can(permissions, "roles", "view"),
    },
    {
      href: "/location-picker",
      label: "Location Picker",
      icon: <MapPin size={18} />,
      visible: isAdmin || can(permissions, "location_picker", "view"),
    },
  ];

  if (userLoading || permLoading) {
    return (
      <aside className="h-screen w-[288px] min-w-[288px] shrink-0 border-r border-[#86A7B2]/25 bg-white p-4 text-[#274C5A]">
        <div className="h-full animate-pulse rounded-2xl border border-[#86A7B2]/25 bg-[#f8fbfc] p-4 text-sm text-[#7F7F7F]">
          Loading sidebar...
        </div>
      </aside>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <aside
      className="flex h-screen w-[288px] min-w-[288px] shrink-0 flex-col border-r border-[#86A7B2]/25 bg-white shadow-sm"
      dir={clientAccount ? dir : "ltr"}
      lang={clientAccount ? language : "en"}
    >
      <div className="border-b border-[#86A7B2]/25 p-4">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-xl border border-[#86A7B2]/30 bg-white p-2 text-[#274C5A] shadow-sm lg:hidden"
            aria-label={clientText("Close menu")}
          >
            <X size={16} />
          </button>
        )}

        <div className="flex items-center gap-3 rounded-2xl border border-[#86A7B2]/25 bg-[#f8fbfc] p-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
            <img
              src="/brand/lazem-secondary-logo-solid.svg"
              alt="Lazem Logo"
              className="h-9 w-9 object-contain"
            />
          </div>

          <div className="min-w-0">
            <div className="text-base font-black tracking-tight text-[#274C5A]">
              Lazem HCAD
            </div>
            <div className="text-xs font-semibold text-[#7F7F7F]">
              Emergency Command
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#86A7B2]/25 bg-white p-3 shadow-sm shadow-[#274C5A]/5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#274C5A]/20 bg-white p-1 text-sm font-black uppercase text-[#274C5A]">
              {clientAccount && clientBrand.logoUrl ? (
                <img
                  src={clientBrand.logoUrl}
                  alt={`${clientBrand.clientName} logo`}
                  className="h-full w-full object-contain"
                />
              ) : (
                (user.name || user.email || "U").slice(0, 1)
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-[#274C5A]">
                {user.name || "User"}
              </div>
              <div className="mt-0.5 truncate text-xs text-[#7F7F7F]">
                {user.email}
              </div>
              {clientAccount && clientBrand.clientName !== "Client" && (
                <div className="mt-0.5 truncate text-[11px] font-semibold text-[#274C5A]/70">
                  {clientBrand.clientName}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="rounded-full border border-[#274C5A]/20 bg-[#274C5A]/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#274C5A]">
              {user.role || "none"}
            </span>

            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
              {clientText("Active account")}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        {isClientPortalUser && (
          <div>
            <div className={sectionTitleClass}>{clientText("Client Portal")}</div>

            <div className="space-y-1">
              {clientItems
                .filter((item) => item.visible)
                .map((item) => (
                  <Link
                    key={item.href}
                    className={linkClass(item.href)}
                    href={item.href}
                    onClick={onClose}
                  >
                    <span className="text-current/80">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
            </div>
          </div>
        )}

        {!clientAccount && (
        <div>
          <div className={sectionTitleClass}>Operations</div>

          <div className="space-y-1">
            {operationsItems
              .filter((item) => item.visible)
              .map((item) => (
                <Link
                  key={item.href}
                  className={linkClass(item.href)}
                  href={item.href}
                  onClick={onClose}
                >
                  <span className="text-current/80">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
          </div>
        </div>
        )}

        {!clientAccount && (
        <div>
          <div className={sectionTitleClass}>Management</div>

          <div className="space-y-1">
            {managementItems
              .filter((item) => item.visible)
              .map((item) => (
                <Link
                  key={item.href}
                  className={linkClass(item.href)}
                  href={item.href}
                  onClick={onClose}
                >
                  <span className="text-current/80">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
          </div>
        </div>
        )}
      </nav>

      <div className="border-t border-[#86A7B2]/25 p-4">
        {!clientAccount && (
          <Link
            href="/settings/notifications"
            onClick={onClose}
            className={`mb-2 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-black transition ${isActive("/settings/notifications") ? "border-[#274C5A] bg-[#274C5A] text-white" : "border-[#86A7B2]/35 bg-white text-[#274C5A] hover:bg-[#f5f9fa]"}`}
          >
            <Bell size={16} />
            Notification Settings
          </Link>
        )}
        {clientAccount && (
          <button
            type="button"
            onClick={toggleLanguage}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#86A7B2]/35 bg-white px-3 py-2.5 text-sm font-black text-[#274C5A] transition hover:bg-[#f5f9fa]"
          >
            <Languages size={16} />
            {language === "ar" ? "English" : "العربية"}
          </button>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#274C5A] px-3 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#274C5A]/20 transition hover:bg-[#1f3f4c]"
        >
          <LogOut size={16} />
          {clientText("Logout")}
        </button>
      </div>
    </aside>
  );
}
