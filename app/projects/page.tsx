"use client";

import { usePermissions } from "@/lib/usePermissions";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Can from "../components/Can";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function ProjectsPage() {
  const { user, loading } = useCurrentUser();
  const { permissions, loading: permsLoading } = usePermissions(user?.role);

  const [projects, setProjects] = useState<any[]>([]);

  // ✅ view-all scope (admin OR permission)
  const canViewAll = useMemo(() => {
    if (!user) return false;
    return user.role === "admin" || permissions?.projects?.view_all === true;
  }, [user?.role, permissions?.projects?.view_all]);

  useEffect(() => {
    // wait for both user + permissions
    if (!user || permsLoading) return;

    const qRef = canViewAll
      ? collection(db, "projects")
      : query(
          collection(db, "projects"),
          where(`assignedUsers.${user.uid}`, "==", true)
        );

    const unsub = onSnapshot(qRef, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setProjects(data);
    });

    return () => unsub();
  }, [user?.uid, canViewAll, permsLoading]);

  if (loading || permsLoading) {
    return <div className="p-6 text-gray-400">Loading projects...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Projects</h1>

        {/* ✅ CREATE ONLY IF PERMISSION */}
        <Can permission="projects.create">
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            + New Project
          </Link>
        </Can>
      </div>

      {/* ✅ EMPTY STATE */}
      {projects.length === 0 && (
        <div className="text-gray-400 text-sm">
          {canViewAll ? "No projects found." : "No projects assigned to you."}
        </div>
      )}

      <div className="grid gap-4">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="p-4 bg-card rounded border hover:bg-muted"
          >
            <div className="font-semibold">{p.projectName}</div>
            <div className="text-sm text-muted-foreground">
              {p.client} • {p.status}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
