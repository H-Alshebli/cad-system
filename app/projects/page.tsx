"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import Link from "next/link";
import Can from "../components/Can";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function ProjectsPage() {
  const { user, loading } = useCurrentUser();
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    let q;

    // ✅ ADMIN → see everything
    if (user.role === "admin") {
      q = collection(db, "projects");
    } 
    // ✅ NON-ADMIN → see only assigned projects
    else {
      q = query(
        collection(db, "projects"),
        where(`assignedUsers.${user.uid}`, "==", true)
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setProjects(data);
    });

    return () => unsub();
  }, [user]);

  if (loading) {
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
          No projects assigned to you.
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
