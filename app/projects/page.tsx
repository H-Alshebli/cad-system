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
import { MoreHorizontal, Plus } from "lucide-react";
import Can from "../components/Can";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";

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
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#86A7B2]/35 bg-white text-[#274C5A] shadow-sm transition hover:border-[#274C5A]/40 hover:bg-[#f8fbfc]"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 min-w-[160px] overflow-hidden rounded-xl border border-[#86A7B2]/30 bg-white shadow-xl shadow-[#274C5A]/10">
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
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
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
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
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
    return (
      <div className="p-6 text-sm font-semibold text-[#7F7F7F]">
        Loading projects...
      </div>
    );
  }

 return (
  <PermissionGuard module="projects" action="view" showMessage={true}>
    <div className="space-y-5 p-4 sm:p-6">
      <div className="rounded-2xl bg-[#274C5A] p-5 text-white shadow-sm shadow-[#274C5A]/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide">
            HCAD Command Center
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Projects</h1>
          <p className="mt-1 text-sm font-medium text-white/78">
            Manage active and archived projects
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/16"
          >
            {showArchived ? "Show Active" : "Show Archived"}
          </button>

          <Can permission="projects.create">
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-[#274C5A] shadow-sm transition hover:bg-[#f8fbfc]"
            >
              <Plus size={16} />
              New Project
            </Link>
          </Can>
        </div>
      </div>
      </div>

      {projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#86A7B2]/40 bg-white p-8 text-center text-sm font-semibold text-[#7F7F7F] shadow-sm">
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
              className="rounded-2xl border border-[#86A7B2]/25 bg-white p-4 shadow-sm shadow-[#274C5A]/5 transition hover:-translate-y-0.5 hover:border-[#274C5A]/30 hover:shadow-md hover:shadow-[#274C5A]/10"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-sm font-black leading-5 text-[#274C5A]">
                    {p.projectName || "Untitled Project"}
                  </h2>
                </Link>

                <div className="flex items-center gap-2">
                  <Can permission="projects.edit">
                    <Link
                      href={`/projects/${p.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg border border-[#86A7B2]/35 px-3 py-2 text-xs font-bold text-[#274C5A] transition hover:border-[#274C5A]/40 hover:bg-[#f8fbfc]"
                    >
                      Edit
                    </Link>
                  </Can>
                  <Can permission="projects.edit">
                    <ActionMenu
                      isArchived={isArchived}
                      loading={isProcessing}
                      onArchive={() => handleArchive(p.id, p.projectName)}
                      onRestore={() => handleRestore(p.id, p.projectName)}
                    />
                  </Can>
                </div>
              </div>

              <Link href={`/projects/${p.id}`} className="block space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                      isArchived
                        ? "border-amber-500/25 bg-amber-500/10 text-amber-700"
                        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                    }`}
                  >
                    {isArchived ? "Archived" : p.status || "Active"}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-semibold text-[#274C5A]/75">
                  <p className="truncate">
                    <span className="text-[#7F7F7F]">Client:</span> {p.client || "-"}
                  </p>
                  <p className="truncate">
                    <span className="text-[#7F7F7F]">Ambulances:</span>{" "}
                    {Array.isArray(p.assignedAmbulances) && p.assignedAmbulances.length > 0
                      ? p.assignedAmbulances.map((a: any) => a.code || a.id).join(", ")
                      : "-"}
                  </p>
                  <p className="truncate">
                    <span className="text-[#7F7F7F]">Hospitals:</span>{" "}
                    {Array.isArray(p.projectHospitals) && p.projectHospitals.length > 0
                      ? p.projectHospitals.map((h: any) => h.name || h.id).join(", ")
                      : "-"}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  </PermissionGuard>
);
}
