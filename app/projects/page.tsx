"use client";

import { usePermissions } from "@/lib/usePermissions";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Can from "../components/Can";
import { useCurrentUser } from "@/lib/useCurrentUser";

async function archiveProjectCascade(projectId: string, userId: string) {
  const batch = writeBatch(db);

  // 1) archive project
  batch.update(doc(db, "projects", projectId), {
    isArchived: true,
    archivedAt: serverTimestamp(),
    archivedBy: userId,
    status: "Archived",
  });

  // 2) archive cases
  const casesSnap = await getDocs(
    query(collection(db, "cases"), where("projectId", "==", projectId))
  );

  casesSnap.forEach((d) => {
    batch.update(d.ref, {
      isArchived: true,
      projectArchived: true,
      archivedAt: serverTimestamp(),
      archivedBy: userId,
    });
  });

  // 3) archive epcr
  const epcrByProjectIdSnap = await getDocs(
    query(collection(db, "epcr"), where("projectId", "==", projectId))
  );

  epcrByProjectIdSnap.forEach((d) => {
    batch.update(d.ref, {
      isArchived: true,
      projectArchived: true,
      archivedAt: serverTimestamp(),
      archivedBy: userId,
    });
  });

  await batch.commit();
}

export default function ProjectsPage() {
  const { user, loading } = useCurrentUser();
  const { permissions, loading: permsLoading } = usePermissions(user?.role);

  const [projects, setProjects] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const canViewAll = useMemo(() => {
    if (!user) return false;
    return user.role === "admin" || permissions?.projects?.view_all === true;
  }, [user?.role, permissions?.projects?.view_all]);

  useEffect(() => {
    if (!user || permsLoading) return;

    const baseRef = canViewAll
      ? collection(db, "projects")
      : query(
          collection(db, "projects"),
          where(`assignedUsers.${user.uid}`, "==", true)
        );

    const unsub = onSnapshot(baseRef, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const filtered = data.filter((p: any) =>
        showArchived ? p.isArchived === true : p.isArchived !== true
      );

      setProjects(filtered);
    });

    return () => unsub();
  }, [user?.uid, canViewAll, permsLoading, showArchived]);

  const handleArchive = async (projectId: string, projectName: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Archive project "${projectName}" and its related data?`
    );
    if (!confirmed) return;

    try {
      setArchivingId(projectId);
      await archiveProjectCascade(projectId, user.uid);
    } catch (error) {
      console.error("Archive failed:", error);
      alert("Failed to archive project.");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading || permsLoading) {
    return <div className="p-6 text-gray-400">Loading projects...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center gap-3">
        <h1 className="text-2xl font-bold">Projects</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="px-4 py-2 rounded border border-gray-600 text-white"
          >
            {showArchived ? "Show Active" : "Show Archived"}
          </button>

          <Can permission="projects.create">
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              + New Project
            </Link>
          </Can>
        </div>
      </div>

      {projects.length === 0 && (
        <div className="text-gray-400 text-sm">
          {showArchived
            ? "No archived projects found."
            : canViewAll
            ? "No projects found."
            : "No projects assigned to you."}
        </div>
      )}

      <div className="grid gap-4">
        {projects.map((p: any) => (
          <div
            key={p.id}
            className="p-4 bg-card rounded border hover:bg-muted flex justify-between items-center gap-4"
          >
            <Link href={`/projects/${p.id}`} className="flex-1">
              <div className="font-semibold">{p.projectName}</div>
              <div className="text-sm text-muted-foreground">
                {p.client} • {p.status}
              </div>
            </Link>

            {!showArchived && (
              <Can permission="projects.edit">
                <button
                  onClick={() => handleArchive(p.id, p.projectName)}
                  disabled={archivingId === p.id}
                  className="px-3 py-2 rounded bg-amber-600 text-white disabled:opacity-50"
                >
                  {archivingId === p.id ? "Archiving..." : "Archive"}
                </button>
              </Can>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}