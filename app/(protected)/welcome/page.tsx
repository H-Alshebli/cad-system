"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";

import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function WelcomePage() {
  const { user, loading } = useCurrentUser();

  const [projects, setProjects] = useState(0);
  const [ambulances, setAmbulances] = useState(0);
  const [users, setUsers] = useState(0);
  const [roles, setRoles] = useState(0);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return <div className="p-6 text-[#274C5A]">Loading...</div>;
  }

  const stats = [
    { label: "Projects", value: projects },
    { label: "Ambulances", value: ambulances },
    { label: "Users", value: users },
    { label: "Roles", value: roles },
  ];

  const quickActions = [
    { href: "/dashboard", label: "Dispatch Dashboard" },
    { href: "/projects", label: "Projects" },
    { href: "/ambulances", label: "Ambulances" },
    { href: "/transport", label: "Transport Coverage" },
    { href: "/dashboard/epcr", label: "ePCR Dashboard" },
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

      <section className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#7F7F7F]">Logged in as</div>
        <div className="font-black text-[#274C5A]">{user?.email}</div>
        <div className="text-sm text-[#7F7F7F]">
          Role: {user?.role || "none"}
        </div>
      </section>
    </div>
  );
}
