"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import PermissionGuard from "@/app/components/PermissionGuard";

function getProjectDisplayName(project: any) {
  return (
    project?.name ||
    project?.title ||
    project?.projectName ||
    project?.project_title ||
    project?.clientName ||
    project?.client ||
    project?.code ||
    project?.id ||
    "Unknown Project"
  );
}

type CrewMember = {
  userId: string;
  name: string;
  email?: string;
  role?: string;
};

type AppUser = {
  id: string;
  name?: string;
  displayName?: string;
  fullName?: string;
  email?: string;
  role?: string;
  ambulanceIds?: string[];
  archived?: boolean;
  disabled?: boolean;
};

type Ambulance = {
  id: string;
  code?: string;
  location?: string;

  // old compatibility
  crew?: any[];

  // new recommended structure
  crewMembers?: CrewMember[];

  status?: string;
  currentCase?: string | null;

  assignedProjectId?: string | null;
  assignedProjectName?: string | null;

  projectId?: string | null;
  projectName?: string | null;

  lat?: number | null;
  lng?: number | null;
  archived?: boolean;
};

function getUserDisplayName(user: AppUser) {
  return (
    user.name ||
    user.displayName ||
    user.fullName ||
    user.email ||
    user.id ||
    "Unknown User"
  );
}

function getAmbulanceCrewDisplay(amb: Ambulance) {
  if (Array.isArray(amb.crewMembers) && amb.crewMembers.length > 0) {
    return amb.crewMembers.map((m) => m.name || m.email || m.userId).join(", ");
  }

  if (Array.isArray(amb.crew) && amb.crew.length > 0) {
    return amb.crew
      .map((m: any) => {
        if (typeof m === "string") return m;
        return m?.name || m?.email || m?.userId || "Unknown";
      })
      .join(", ");
  }

  return "unknown";
}

export default function AmbulancesPage() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [crewUserId1, setCrewUserId1] = useState("");
  const [crewUserId2, setCrewUserId2] = useState("");
  const [status, setStatus] = useState("available");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [assignedProjectId, setAssignedProjectId] = useState("");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingAmbulance, setEditingAmbulance] = useState<Ambulance | null>(
    null
  );

  const [editCode, setEditCode] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCrewUserId1, setEditCrewUserId1] = useState("");
  const [editCrewUserId2, setEditCrewUserId2] = useState("");
  const [editStatus, setEditStatus] = useState("available");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editAssignedProjectId, setEditAssignedProjectId] = useState("");

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Ambulance))
        .filter((amb) => !amb.archived);

      setAmbulances(list);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setProjects(list);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AppUser))
        .filter((user) => !user.archived && !user.disabled);

      setUsers(list);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) =>
      getProjectDisplayName(a).localeCompare(getProjectDisplayName(b))
    );
  }, [projects]);

  const selectableCrewUsers = useMemo(() => {
    return [...users].sort((a, b) =>
      getUserDisplayName(a).localeCompare(getUserDisplayName(b))
    );
  }, [users]);

  const getSelectedCrewMembers = (firstUserId: string, secondUserId: string) => {
    const selectedIds = [firstUserId, secondUserId].filter(Boolean);
    const uniqueIds = Array.from(new Set(selectedIds));

    return uniqueIds
      .map((userId) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return null;

        return {
          userId: user.id,
          name: getUserDisplayName(user),
          email: user.email || "",
          role: user.role || "team",
        };
      })
      .filter(Boolean) as CrewMember[];
  };

  const getAmbulanceProjectName = (amb: Ambulance) => {
    if (
      amb.assignedProjectName &&
      amb.assignedProjectName !== "Unknown Project"
    ) {
      return amb.assignedProjectName;
    }

    if (amb.projectName && amb.projectName !== "Unknown Project") {
      return amb.projectName;
    }

    const projectId = amb.assignedProjectId || amb.projectId;

    if (!projectId) return "None";

    const project = projects.find((p) => p.id === projectId);

    return project ? getProjectDisplayName(project) : "Unknown Project";
  };

  const addAmbulance = async () => {
    if (!code || !location || !crewUserId1) return;

    const selectedProject = sortedProjects.find(
      (p) => p.id === assignedProjectId
    );

    const selectedProjectName = selectedProject
      ? getProjectDisplayName(selectedProject)
      : "";

    const crewMembers = getSelectedCrewMembers(crewUserId1, crewUserId2);

    const ambulanceRef = await addDoc(collection(db, "ambulances"), {
      code,
      location,

      // new structure
      crewMembers,

      // compatibility with old display/pages
      crew: crewMembers.map((m) => m.name),
      crewUserIds: crewMembers.map((m) => m.userId),

      status,
      currentCase: null,

      assignedProjectId: assignedProjectId || null,
      assignedProjectName: selectedProjectName || null,

      projectId: assignedProjectId || null,
      projectName: selectedProjectName || null,

      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      archived: false,
      createdAt: serverTimestamp(),
    });

    await Promise.all(
      crewMembers.map((member) =>
        updateDoc(doc(db, "users", member.userId), {
          ambulanceIds: arrayUnion(ambulanceRef.id),
          updatedAt: serverTimestamp(),
        })
      )
    );

    setCode("");
    setLocation("");
    setCrewUserId1("");
    setCrewUserId2("");
    setStatus("available");
    setLat("");
    setLng("");
    setAssignedProjectId("");
  };

  const archiveAmbulance = async (id: string) => {
    const confirmArchive = window.confirm(
      "Are you sure you want to archive this ambulance?"
    );
    if (!confirmArchive) return;

    await updateDoc(doc(db, "ambulances", id), {
      archived: true,
      archivedAt: serverTimestamp(),
    });

    setOpenMenuId(null);
  };

  const openEditModal = (amb: Ambulance) => {
    setEditingAmbulance(amb);
    setEditCode(amb.code ?? "");
    setEditLocation(amb.location ?? "");

    const oldCrewUserIds =
      Array.isArray((amb as any).crewUserIds) && (amb as any).crewUserIds.length
        ? (amb as any).crewUserIds
        : Array.isArray(amb.crewMembers)
        ? amb.crewMembers.map((m) => m.userId)
        : [];

    setEditCrewUserId1(oldCrewUserIds[0] ?? "");
    setEditCrewUserId2(oldCrewUserIds[1] ?? "");

    setEditStatus(amb.status ?? "available");
    setEditLat(amb.lat != null ? String(amb.lat) : "");
    setEditLng(amb.lng != null ? String(amb.lng) : "");

    const existingProjectId = amb.assignedProjectId || amb.projectId || "";
    setEditAssignedProjectId(existingProjectId);

    setOpenMenuId(null);
  };

  const saveEditAmbulance = async () => {
    if (!editingAmbulance) return;
    if (!editCode || !editLocation || !editCrewUserId1) return;

    const selectedProject = sortedProjects.find(
      (p) => p.id === editAssignedProjectId
    );

    const selectedProjectName = selectedProject
      ? getProjectDisplayName(selectedProject)
      : "";

    const crewMembers = getSelectedCrewMembers(
      editCrewUserId1,
      editCrewUserId2
    );

    await updateDoc(doc(db, "ambulances", editingAmbulance.id), {
      code: editCode,
      location: editLocation,

      // new structure
      crewMembers,

      // compatibility fields
      crew: crewMembers.map((m) => m.name),
      crewUserIds: crewMembers.map((m) => m.userId),

      status: editStatus,
      lat: editLat ? Number(editLat) : null,
      lng: editLng ? Number(editLng) : null,

      assignedProjectId: editAssignedProjectId || null,
      assignedProjectName: selectedProjectName || null,

      projectId: editAssignedProjectId || null,
      projectName: selectedProjectName || null,

      updatedAt: serverTimestamp(),
    });

    await Promise.all(
      crewMembers.map((member) =>
        updateDoc(doc(db, "users", member.userId), {
          ambulanceIds: arrayUnion(editingAmbulance.id),
          updatedAt: serverTimestamp(),
        })
      )
    );

    setEditingAmbulance(null);
  };

  return (
    <PermissionGuard module="ambulances" action="view" showMessage={true}>
      <div className="p-6 bg-[#020817] min-h-screen text-white">
        <h1 className="text-3xl font-bold mb-6">Ambulances</h1>

        <div className="mb-6 rounded-2xl border border-slate-700 bg-[#162033] p-4 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Add New Ambulance</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Ambulance Code (e.g. AMB-003)"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <input
              type="text"
              placeholder="Zone / Location"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              value={crewUserId1}
              onChange={(e) => setCrewUserId1(e.target.value)}
            >
              <option value="">Select Crew Member 1</option>
              {selectableCrewUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserDisplayName(user)}
                  {user.email ? ` - ${user.email}` : ""}
                </option>
              ))}
            </select>

            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              value={crewUserId2}
              onChange={(e) => setCrewUserId2(e.target.value)}
            >
              <option value="">Select Crew Member 2 (optional)</option>
              {selectableCrewUsers
                .filter((user) => user.id !== crewUserId1)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {getUserDisplayName(user)}
                    {user.email ? ` - ${user.email}` : ""}
                  </option>
                ))}
            </select>

            <input
              type="number"
              placeholder="Latitude (optional)"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />

            <input
              type="number"
              placeholder="Longitude (optional)"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />

            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              value={assignedProjectId}
              onChange={(e) => setAssignedProjectId(e.target.value)}
            >
              <option value="">Select Project (optional)</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {getProjectDisplayName(project)}
                </option>
              ))}
            </select>

            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <button
            onClick={addAmbulance}
            className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 font-medium transition hover:bg-blue-700"
          >
            Add Ambulance
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ambulances.map((amb) => (
            <div
              key={amb.id}
              className="relative rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-lg"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{amb.code}</h2>
                  <div className="mt-2 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    {amb.status ?? "unknown"}
                  </div>
                </div>

                <div
                  className="relative"
                  ref={openMenuId === amb.id ? menuRef : null}
                >
                  <button
                    onClick={() =>
                      setOpenMenuId(openMenuId === amb.id ? null : amb.id)
                    }
                    className="rounded-lg border border-slate-700 px-3 py-1 text-lg text-slate-300 hover:bg-slate-800"
                  >
                    ...
                  </button>

                  {openMenuId === amb.id && (
                    <div className="absolute right-0 top-12 z-20 w-40 rounded-xl border border-slate-700 bg-[#111827] p-2 shadow-xl">
                      <button
                        onClick={() => openEditModal(amb)}
                        className="mb-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-800"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => {
                          if (amb.lat && amb.lng) {
                            window.open(
                              `https://www.google.com/maps?q=${amb.lat},${amb.lng}`,
                              "_blank"
                            );
                          }
                          setOpenMenuId(null);
                        }}
                        className="mb-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-800"
                      >
                        Navigate
                      </button>

                      <button
                        onClick={() => archiveAmbulance(amb.id)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-800"
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  <span className="text-slate-400">Zone:</span>{" "}
                  {amb.location || "—"}
                </p>
                <p>
                  <span className="text-slate-400">Crew:</span>{" "}
                  {getAmbulanceCrewDisplay(amb)}
                </p>
                <p>
                  <span className="text-slate-400">Project:</span>{" "}
                  {getAmbulanceProjectName(amb)}
                </p>
                <p>
                  <span className="text-slate-400">Current Case:</span>{" "}
                  {amb.currentCase || "None"}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {amb.lat && amb.lng ? "GPS attached" : "No GPS attached"}
                </span>
                <button
                  onClick={() => openEditModal(amb)}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {editingAmbulance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0f172a] p-6 shadow-2xl">
              <h3 className="mb-4 text-2xl font-bold">Edit Ambulance</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Ambulance Code"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Zone / Location"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />

                <select
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                  value={editCrewUserId1}
                  onChange={(e) => setEditCrewUserId1(e.target.value)}
                >
                  <option value="">Select Crew Member 1</option>
                  {selectableCrewUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {getUserDisplayName(user)}
                      {user.email ? ` - ${user.email}` : ""}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                  value={editCrewUserId2}
                  onChange={(e) => setEditCrewUserId2(e.target.value)}
                >
                  <option value="">Select Crew Member 2</option>
                  {selectableCrewUsers
                    .filter((user) => user.id !== editCrewUserId1)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {getUserDisplayName(user)}
                        {user.email ? ` - ${user.email}` : ""}
                      </option>
                    ))}
                </select>

                <input
                  type="number"
                  placeholder="Latitude"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                  value={editLat}
                  onChange={(e) => setEditLat(e.target.value)}
                />

                <input
                  type="number"
                  placeholder="Longitude"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                  value={editLng}
                  onChange={(e) => setEditLng(e.target.value)}
                />

                <select
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                  value={editAssignedProjectId}
                  onChange={(e) => setEditAssignedProjectId(e.target.value)}
                >
                  <option value="">Select Project</option>
                  {sortedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {getProjectDisplayName(project)}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setEditingAmbulance(null)}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditAmbulance}
                  className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}