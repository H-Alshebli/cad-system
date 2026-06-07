"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  Activity,
  Ambulance,
  BarChart3,
  BriefcaseMedical,
  ClipboardPlus,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  Stethoscope,
  ShieldCheck,
  Sun,
  Truck,
  Users,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { can } from "@/lib/can";

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
  const isDispatcher =
    isAdmin ||
    role === "dispatcher" ||
    role === "dispatch" ||
    can(permissions, "call_intake", "view") ||
    can(permissions, "cases", "create") ||
    can(permissions, "cases", "view");

  const isParamedic =
    role === "paramedic" ||
    role === "emt" ||
    role === "medical" ||
    can(permissions, "missions", "view");

  const isClientPortalUser = can(permissions, "client_portal", "view");

  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");

    const shouldUseDark = !saved || saved === "dark";

    if (shouldUseDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setDark(false);
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

  async function logout() {
    await signOut(auth);
    onClose?.();
    router.push("/login");
  }

  function isActive(path: string) {
    if (path === "/dashboard") return pathname === "/dashboard";
    if (path === "/client") return pathname === "/client";
    if (path === "/b2c/requests") {
      return pathname === "/b2c/requests" || pathname.startsWith("/b2c/requests/");
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  }

  const linkClass = (path: string) => {
    const active = isActive(path);

    return active
      ? "group flex items-center gap-3 rounded-2xl border border-blue-400/30 bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-950/20"
      : "group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/80 dark:hover:text-white";
  };

  const sectionTitleClass =
    "px-3 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500";

  const clientItems: NavItem[] = [
    {
      href: "/client",
      label: "Client Home",
      icon: <LayoutDashboard size={18} />,
      visible: isClientPortalUser,
    },
    {
      href: "/client/cases/new",
      label: "Create Case",
      icon: <BriefcaseMedical size={18} />,
      visible: can(permissions, "client_cases", "create"),
    },
    {
      href: "/client/cases",
      label: "My Cases",
      icon: <ClipboardList size={18} />,
      visible:
        can(permissions, "client_cases", "view") ||
        can(permissions, "client_cases", "view_own"),
    },
    {
      href: "/client/dashboard/timeline",
      label: "Timeline Dashboard",
      icon: <Activity size={18} />,
      visible: can(permissions, "client_dashboards", "timeline"),
    },
    {
      href: "/client/dashboard/epcr",
      label: "ePCR Dashboard",
      icon: <BarChart3 size={18} />,
      visible: can(permissions, "client_dashboards", "epcr"),
    },
  ];

  const operationsItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dispatch Dashboard",
      icon: <LayoutDashboard size={18} />,
      visible: isAdmin || can(permissions, "dashboards", "timeline"),
    },
    {
      href: "/call-intake",
      label: "New Case / Call Intake",
      icon: <ClipboardPlus size={18} />,
      visible:
        isAdmin ||
        can(permissions, "call_intake", "view") ||
        can(permissions, "cases", "create") ||
        can(permissions, "client_cases", "create"),
    },
    {
      href: "/b2c/requests",
      label: "B2C Requests",
      icon: <ClipboardList size={18} />,
      visible:
        isDispatcher ||
        isAdmin ||
        can(permissions, "b2c_requests", "view") ||
        can(permissions, "call_intake", "view") ||
        can(permissions, "cases", "view"),
    },
    {
      href: "/cases",
      label: "CAD Cases",
      icon: <BriefcaseMedical size={18} />,
      visible:
        isAdmin ||
        can(permissions, "cases", "view") ||
        can(permissions, "dashboards", "timeline"),
    },
    {
      href: "/missions",
      label: "My Missions",
      icon: <Stethoscope size={18} />,
      visible: isAdmin || isParamedic || can(permissions, "missions", "view"),
    },
    {
      href: "/dashboard/epcr",
      label: "ePCR Dashboard",
      icon: <BarChart3 size={18} />,
      visible: isAdmin || can(permissions, "dashboards", "epcr"),
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
      <aside className="h-screen w-[288px] min-w-[288px] shrink-0 border-r border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-800 dark:bg-[#020817] dark:text-white">
        <div className="h-full animate-pulse rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
          Loading sidebar...
        </div>
      </aside>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <aside className="flex h-screen w-[288px] min-w-[288px] shrink-0 flex-col border-r border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-[#020817]/95">
      <div className="border-b border-slate-200/70 p-4 dark:border-slate-800">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        )}

        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-950">
            <img
              src="/icons/icon-512.png"
              alt="Lazem Logo"
              className="h-10 w-10 object-contain"
            />
          </div>

          <div className="min-w-0">
            <div className="text-base font-black tracking-tight text-slate-950 dark:text-white">
              Lazem HCAD
            </div>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-300">
              Emergency Command
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-sm font-black uppercase text-blue-700 dark:text-blue-300">
              {(user.name || user.email || "U").slice(0, 1)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-950 dark:text-white">
                {user.name || "User"}
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              {user.role || "none"}
            </span>

            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Active
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        {isClientPortalUser && (
          <div>
            <div className={sectionTitleClass}>Client Portal</div>

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
      </nav>

      <div className="space-y-2 border-t border-slate-200/70 p-4 dark:border-slate-800">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? "Light Mode" : "Command Dark"}
        </button>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}