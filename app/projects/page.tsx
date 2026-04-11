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
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Can from "../components/Can";
import { useCurrentUser } from "@/lib/useCurrentUser";

const ARCHIVE_PASSWORD = "727978";

async function archiveProjectCascade(projectId: string, userId: string) {
  const batch = writeBatch(db);

  batch.update(doc(db, "projects", projectId), {
    isArchived: true,
    archivedAt: serverTimestamp(),
    archivedBy: userId,
    status: "Archived",
  });

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

async function restoreProjectCascade(projectId: string, userId: string) {
  const batch = writeBatch(db);

  batch.update(doc(db, "projects", projectId), {
    isArchived: false,
    archivedAt: null,
    archivedBy: null,
    restoredAt: serverTimestamp(),
    restoredBy: userId,
    status: "Active",
  });

  const casesSnap = await getDocs(
    query(collection(db, "cases"), where("projectId", "==", projectId))
  );

  casesSnap.forEach((d) => {
    batch.update(d.ref, {
      isArchived: false,
      projectArchived: false,
      archivedAt: null,
      archivedBy: null,
      restoredAt: serverTimestamp(),
      restoredBy: userId,
    });
  });

  const epcrByProjectIdSnap = await getDocs(
    query(collection(db, "epcr"), where("projectId", "==", projectId))
  );

  epcrByProjectIdSnap.forEach((d) => {
    batch.update(d.ref, {
      isArchived: false,
      projectArchived: false,
      archivedAt: null,
      archivedBy: null,
      restoredAt: serverTimestamp(),
      restoredBy: userId,
    });
  });

  await batch.commit();
}

function ActionMenu({
  isArchived,
  loading,
  onArchive,
  onRestore,
}: {
  isArchived: boolean;
  loading: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 bg-[#0f172a] text-gray-300 hover:bg-[#1e293b] hover:text-white transition"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 min-w-[150px] overflow-hidden rounded-xl border border-gray-700 bg-[#0b1220] shadow-xl">
          {!isArchived ? (
            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onArchive();
              }}
              className="block w-full px-4 py-3 text-left text-sm text-amber-400 hover:bg-white/5 disabled:opacity-50"
            >
              {loading ? "Archiving..." : "Archive Project"}
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onRestore();
              }}
              className="block w-full px-4 py-3 text-left text-sm text-green-400 hover:bg-white/5 disabled:opacity-50"
            >
              {loading ? "Restoring..." : "Restore Project"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const { user, loading } = useCurrentUser();
  const { permissions, loading: permsLoading } = usePermissions(user?.role);

  const [projects, setProjects] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  const askPassword = (projectName: string, action: "archive" | "restore") => {
    const enteredPassword = window.prompt(
      `Enter password to ${action} "${projectName}":`
    );

    if (enteredPassword === null) return false;

    if (enteredPassword !== ARCHIVE_PASSWORD) {
      alert("Wrong password. Action cancelled.");
      return false;
    }

    return true;
  };

  const handleArchive = async (projectId: string, projectName: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Archive project "${projectName}" and its related data?`
    );
    if (!confirmed) return;

    const ok = askPassword(projectName, "archive");
    if (!ok) return;

    try {
      setProcessingId(projectId);
      await archiveProjectCascade(projectId, user.uid);
      alert(`Project "${projectName}" archived successfully.`);
    } catch (error) {
      console.error("Archive failed:", error);
      alert("Failed to archive project.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRestore = async (projectId: string, projectName: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Restore project "${projectName}" and its related data?`
    );
    if (!confirmed) return;

    const ok = askPassword(projectName, "restore");
    if (!ok) return;

    try {
      setProcessingId(projectId);
      await restoreProjectCascade(projectId, user.uid);
      alert(`Project "${projectName}" restored successfully.`);
    } catch (error) {
      console.error("Restore failed:", error);
      alert("Failed to restore project.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || permsLoading) {
    return <div className="p-6 text-gray-400">Loading projects...</div>;
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-gray-400">
            Manage active and archived projects
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="px-4 py-2 rounded-lg border border-gray-600 bg-transparent text-white hover:bg-white/5 transition"
          >
            {showArchived ? "Show Active" : "Show Archived"}
          </button>

          <Can permission="projects.create">
            <Link
              href="/projects/new"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              + New Project
            </Link>
          </Can>
        </div>
      </div>

      {projects.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-sm text-gray-400">
          {showArchived
            ? "No archived projects found."
            : canViewAll
            ? "No projects found."
            : "No projects assigned to you."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {projects.map((p: any) => {
          const isProcessing = processingId === p.id;
          const isArchived = p.isArchived === true;

          return (
            <div
              key={p.id}
              className="rounded-xl border border-gray-700 bg-[#111827] p-4 shadow-sm hover:border-gray-500 hover:bg-[#172033] transition"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-white leading-5 line-clamp-2">
                    {p.projectName || "Untitled Project"}
                  </h2>
                </Link>

                <Can permission="projects.edit">
                  <ActionMenu
                    isArchived={isArchived}
                    loading={isProcessing}
                    onArchive={() => handleArchive(p.id, p.projectName)}
                    onRestore={() => handleRestore(p.id, p.projectName)}
                  />
                </Can>
              </div>

              <Link href={`/projects/${p.id}`} className="block space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                      isArchived
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-green-500/15 text-green-400"
                    }`}
                  >
                    {isArchived ? "Archived" : p.status || "Active"}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-gray-400">
                  <p className="truncate">
                    <span className="text-gray-500">Client:</span> {p.client || "—"}
                  </p>
                  <p className="truncate">
                    <span className="text-gray-500">Project ID:</span> {p.id}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}