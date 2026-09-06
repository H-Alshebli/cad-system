"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Activity, Ambulance, Bell, BriefcaseMedical, ClipboardList, ClipboardPlus, Stethoscope, UserRound } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

type PortalItem = {
  href: string;
  label: string;
  arabicLabel: string;
  description: string;
  icon: ReactNode;
  visible: boolean;
  attention?: string;
  primary?: boolean;
};

export default function DashboardsIndexPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const { can, isAdmin, loading: permissionsLoading } = usePermissions(user?.role);

  const destination =
    isAdmin || can("dashboards", "timeline")
      ? "/dashboards/timeline"
      : can("dashboards", "epcr")
      ? "/dashboards/cases"
      : can("checklist_review_global", "view")
      ? "/dashboards/checklists"
      : "";

  useEffect(() => {
    if (!userLoading && !permissionsLoading && destination) router.replace(destination);
  }, [destination, permissionsLoading, router, userLoading]);

  if (userLoading || permissionsLoading || destination) {
    return <div className="p-6 text-sm font-semibold text-[#607482]">Opening your workspace...</div>;
  }

  const profileStatus = String(user?.crewProfileReviewStatus || "draft").toLowerCase();
  const profileNeedsAttention =
    ["draft", "reopened", "changes_required", "update_requested"].includes(profileStatus) ||
    user?.crewProfileIsComplete === false;

  const items: PortalItem[] = [
    {
      href: "/missions",
      label: "My Missions",
      arabicLabel: "مهامي",
      description: "Open your assigned missions and continue field work.",
      icon: <Stethoscope size={24} />,
      visible: isAdmin || can("missions", "view"),
      primary: true,
    },
    {
      href: "/cadcases",
      label: "CAD Cases",
      arabicLabel: "بلاغات CAD",
      description: "View the cases available to your role and assignment.",
      icon: <BriefcaseMedical size={24} />,
      visible: isAdmin || can("cad_cases_new", "view"),
    },
    {
      href: "/missions/cases/new",
      label: "Create Case",
      arabicLabel: "إنشاء بلاغ",
      description: "Create a project case when field support is required.",
      icon: <ClipboardPlus size={24} />,
      visible: isAdmin || can("missions", "create_project_case"),
    },
    {
      href: "/missions-plus",
      label: "My Missions+",
      arabicLabel: "مهامي المطورة",
      description: "Use the enhanced mission workspace available to your role.",
      icon: <Activity size={24} />,
      visible: isAdmin || can("missions_plus", "view"),
    },
    {
      href: "/b2c/requests",
      label: "B2C Requests",
      arabicLabel: "طلبات الأفراد",
      description: "Review customer transport and coverage requests.",
      icon: <ClipboardList size={24} />,
      visible: isAdmin || can("b2c_requests", "view") || can("call_intake", "view") || can("cases", "view"),
    },
    {
      href: "/ambulances",
      label: "Ambulances",
      arabicLabel: "سيارات الإسعاف",
      description: "View ambulance availability and assignment information.",
      icon: <Ambulance size={24} />,
      visible: isAdmin || can("ambulances", "view"),
    },
    {
      href: "/crew-profile",
      label: "Crew Profile",
      arabicLabel: "ملف الموظف",
      description: "Review your employment, credential, and project information.",
      icon: <UserRound size={24} />,
      visible: true,
      attention: profileNeedsAttention ? "Profile needs completion / الملف يحتاج إكمال" : undefined,
    },
    {
      href: "/settings/notifications",
      label: "Notification Settings",
      arabicLabel: "إعدادات الإشعارات",
      description: "Enable or update assignment and operational notifications.",
      icon: <Bell size={24} />,
      visible: true,
    },
  ].filter((item) => item.visible);

  return (
    <main className="page-shell space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#274C5A] p-5 text-white shadow-lg shadow-[#274C5A]/10 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider">Active Workspace</span>
            <h1 className="mt-3 text-2xl font-black sm:text-3xl">Welcome, {user?.name || user?.displayName || "Team Member"}</h1>
            <p className="mt-2 text-sm font-semibold text-[#dce9ec]">Your account is active. Choose a service to continue.</p>
            <p className="mt-1 text-right text-sm font-semibold text-[#dce9ec]" dir="rtl">حسابك مفعّل. اختر الخدمة التي تريد المتابعة إليها.</p>
          </div>
          <div className="self-start rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 sm:self-center">Active Account / حساب مفعّل</div>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-xl font-black text-[#123746]">Available Services</h2>
          <p className="mt-1 text-sm font-semibold text-[#607482]">Only services available to your role are shown.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={`group rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.primary ? "border-[#274C5A] bg-[#274C5A] text-white" : "border-[#d8e6ea] bg-white text-[#123746] hover:border-[#74cdda]"}`}>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.primary ? "bg-white/15" : "bg-[#effbfc] text-[#166575]"}`}>{item.icon}</div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div><h3 className="text-lg font-black">{item.label}</h3><div className={`mt-0.5 text-right text-sm font-bold ${item.primary ? "text-[#dce9ec]" : "text-[#607482]"}`} dir="rtl">{item.arabicLabel}</div></div>
                <span className="text-xl transition group-hover:translate-x-1">→</span>
              </div>
              <p className={`mt-3 text-sm font-semibold leading-6 ${item.primary ? "text-[#dce9ec]" : "text-[#607482]"}`}>{item.description}</p>
              {item.attention && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">{item.attention}</div>}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
