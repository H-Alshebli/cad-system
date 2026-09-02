"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { BriefcaseMedical, ChevronRight } from "lucide-react";

import { db } from "@/lib/firebase";
import { getProjectDisplayName } from "@/lib/displayLabels";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

function isAssignedToAmbulance(ambulance: any, userId: string) {
  const assignedIds = [
    ...(Array.isArray(ambulance?.assignedUserIds) ? ambulance.assignedUserIds : []),
    ...(Array.isArray(ambulance?.crewUserIds) ? ambulance.crewUserIds : []),
  ];
  if (assignedIds.includes(userId)) return true;
  return Array.isArray(ambulance?.crewMembers) &&
    ambulance.crewMembers.some((member: any) => member?.userId === userId);
}

export default function ResponderProjectCaseLauncher() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const { can, isAdmin, loading: permissionLoading } = usePermissions(user?.role);
  const [projects, setProjects] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (userLoading || permissionLoading || !user?.uid) return;
    let projectsLoaded = false;
    let ambulancesLoaded = false;
    const markLoaded = () => {
      if (projectsLoaded && ambulancesLoaded) setDataLoading(false);
    };
    const unsubscribeProjects = onSnapshot(collection(db, "projects"), (snapshot) => {
      setProjects(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      projectsLoaded = true;
      markLoaded();
    });
    const unsubscribeAmbulances = onSnapshot(collection(db, "ambulances"), (snapshot) => {
      setAmbulances(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      ambulancesLoaded = true;
      markLoaded();
    });
    return () => {
      unsubscribeProjects();
      unsubscribeAmbulances();
    };
  }, [permissionLoading, user?.uid, userLoading]);

  const availableProjects = useMemo(() => {
    const assignedProjectIds = new Set(
      ambulances
        .filter((ambulance) => user?.uid && isAssignedToAmbulance(ambulance, user.uid))
        .map((ambulance) => ambulance.assignedProjectId || ambulance.projectId)
        .filter(Boolean)
    );
    return projects
      .filter((project) => project.isArchived !== true && project.archived !== true)
      .filter((project) => isAdmin || assignedProjectIds.has(project.id))
      .sort((a, b) => getProjectDisplayName(a).localeCompare(getProjectDisplayName(b)));
  }, [ambulances, isAdmin, projects, user?.uid]);

  useEffect(() => {
    if (!dataLoading && availableProjects.length === 1) {
      router.replace(`/projects/${availableProjects[0].id}/cases/new?responder=1`);
    }
  }, [availableProjects, dataLoading, router]);

  if (userLoading || permissionLoading || dataLoading || availableProjects.length === 1) {
    return <div className="page-shell"><div className="card-modern">Loading assigned projects...</div></div>;
  }

  if (!can("missions", "create_project_case")) {
    return <div className="page-shell"><div className="card-modern text-sm font-bold text-rose-700">You do not have permission to create project cases.</div></div>;
  }

  return (
    <div className="page-shell space-y-5">
      <div className="page-header">
        <div>
          <span className="badge">Responder Workspace</span>
          <h1 className="page-title mt-3">Create Case</h1>
          <p className="page-subtitle">Select one of your assigned projects to create a new CAD case.</p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#274C5A] text-white">
          <BriefcaseMedical size={26} />
        </div>
      </div>

      {availableProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#86A7B2]/40 bg-white p-8 text-center text-sm font-semibold text-[#607482]">
          No assigned project is available. Ask the dispatcher to assign your ambulance to a project.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {availableProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => router.push(`/projects/${project.id}/cases/new?responder=1`)}
              className="card-modern flex items-center justify-between gap-4 text-left transition hover:-translate-y-0.5 hover:border-[#74cdda]"
            >
              <div>
                <div className="font-black text-[#123746]">{getProjectDisplayName(project)}</div>
                <div className="mt-1 text-xs font-semibold text-[#607482]">
                  {[project.client, project.status].filter(Boolean).join(" • ") || "Active project"}
                </div>
              </div>
              <ChevronRight className="shrink-0 text-[#274C5A]" size={20} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
