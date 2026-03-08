"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import Link from "next/link";

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

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to Lazem HCAD
        </h1>
        <p className="text-sm opacity-70">
          Emergency Dispatch Management Platform
        </p>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
          <div className="text-sm opacity-70">Projects</div>
          <div className="text-3xl font-bold mt-2">{projects}</div>
        </div>

        <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
          <div className="text-sm opacity-70">Ambulances</div>
          <div className="text-3xl font-bold mt-2">{ambulances}</div>
        </div>

        <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
          <div className="text-sm opacity-70">Users</div>
          <div className="text-3xl font-bold mt-2">{users}</div>
        </div>

        <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
          <div className="text-sm opacity-70">Roles</div>
          <div className="text-3xl font-bold mt-2">{roles}</div>
        </div>

      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Quick Actions</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <Link
            href="/dashboard"
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:bg-slate-800"
          >
            🚑 Dispatch Dashboard
          </Link>

          <Link
            href="/projects"
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:bg-slate-800"
          >
            📁 Projects
          </Link>

          <Link
            href="/ambulances"
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:bg-slate-800"
          >
            🚑 Ambulances
          </Link>

          <Link
            href="/transport"
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:bg-slate-800"
          >
            🚐 Transport Coverage
          </Link>

          <Link
            href="/epcr-dashboard"
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:bg-slate-800"
          >
            📊 ePCR Dashboard
          </Link>

          <Link
            href="/users"
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:bg-slate-800"
          >
            👥 Users Management
          </Link>

        </div>
      </div>

      {/* User Info */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div className="text-sm opacity-70">Logged in as</div>
        <div className="font-semibold">{user?.email}</div>
        <div className="text-sm opacity-70">
          Role: {user?.role || "none"}
        </div>
      </div>

    </div>
  );
}