"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Headphones, TicketCheck } from "lucide-react";

import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { isClientAccount } from "@/lib/userAccounts";

const IT_TICKETING_URL =
  process.env.NEXT_PUBLIC_IT_TICKETING_URL ||
  "https://lazem-it-ticketing.vercel.app/";

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const clientAccount = isClientAccount(user);
  const { can, isAdmin, loading: permissionsLoading } = usePermissions(user?.role);
  const canOpenItSupport = isAdmin || can("it_support", "view");

  const [projects, setProjects] = useState(0);
  const [ambulances, setAmbulances] = useState(0);
  const [users, setUsers] = useState(0);
  const [roles, setRoles] = useState(0);

  useEffect(() => {
    if (loading || !user || clientAccount) return;

    async function loadStats() {
      const projectsSnap = await getDocs(collection(db, "projects"));
      const ambulancesSnap = await getDocs(collection(db, "ambulances"));
      const usersSnap = await getDocs(collection(db, "users"));
      const rolesSnap = await getDocs(collection(db, "roles"));

      setProjects(projectsSnap.size);
      setAmbulances(ambulancesSnap.size);
      setUsers(usersSnap.size);
      setRoles(rolesSnap.size);
    }

    loadStats();
  }, [clientAccount, loading, user]);

  useEffect(() => {
    if (!loading && user && clientAccount) {
      router.replace("/client");
    }
  }, [clientAccount, loading, router, user]);

  if (loading || permissionsLoading || clientAccount) {
    return <div className="p-6 text-[#274C5A]">Loading...</div>;
  }

  const stats = [
    { label: "Projects", value: projects },
    { label: "Ambulances", value: ambulances },
    { label: "Users", value: users },
    { label: "Roles", value: roles },
  ];

  const quickActions = [
    { href: "/dashboards/timeline", label: "Timeline Dashboard" },
    { href: "/projects", label: "Projects" },
    { href: "/ambulances", label: "Ambulances" },
    { href: "/transport", label: "Transport Coverage" },
    { href: "/dashboards/cases", label: "Cases Dashboard" },
    { href: "/admin/users", label: "Users Management" },
  ];

  return (
    <div className="space-y-6 p-6 text-[#274C5A]">
      <section className="rounded-2xl border border-[#86A7B2]/25 bg-[#274C5A] p-6 text-white shadow-sm">
        <div className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide">
          HCAD Command Center
        </div>
        <h1 className="text-3xl font-black tracking-tight">
          Welcome to Lazem HCAD
        </h1>
        <p className="mt-2 text-sm text-white/80">
          Emergency Dispatch Management Platform
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm"
          >
            <div className="text-sm font-semibold text-[#7F7F7F]">
              {stat.label}
            </div>
            <div className="mt-2 text-3xl font-black text-[#274C5A]">
              {stat.value}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-black">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 font-bold text-[#274C5A] shadow-sm transition hover:border-[#274C5A]/35 hover:bg-[#f8fbfc]"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className={canOpenItSupport ? "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.62fr)]" : undefined}>
        <div className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-[#7F7F7F]">Logged in as</div>
          <div className="font-black text-[#274C5A]">{user?.email}</div>
          <div className="text-sm text-[#7F7F7F]">
            Role: {user?.role || "none"}
          </div>
        </div>

        {canOpenItSupport && (
          <div className="relative overflow-hidden rounded-2xl border border-[#86A7B2]/30 bg-gradient-to-br from-white via-[#f7fbfc] to-[#dff0f4] p-5 shadow-sm">
            <div className="absolute -right-7 -top-8 h-28 w-28 rounded-full bg-[#86A7B2]/15" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-xl font-black text-[#274C5A]">
                  <Headphones size={22} />
                  Need IT help?
                </div>
                <p className="max-w-sm text-sm font-medium leading-6 text-[#637982]">
                  Report a technical issue or request support from the IT team.
                </p>
                <a
                  href={IT_TICKETING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#274C5A] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#1f3f4c]"
                >
                  <TicketCheck size={17} />
                  Create Ticket
                </a>
              </div>

              <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/70 bg-white/80 text-[#274C5A] shadow-md sm:flex">
                <Headphones size={48} strokeWidth={1.7} />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
