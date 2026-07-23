"use client";

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PermissionGuard from "@/app/components/PermissionGuard";

const REQUEST_TYPES = [
  "Clinic",
  "Ambulance Coverage",
  "Ambulance Transportation",
  "Station Operation",
  "Other",
];

const SERVICE_TYPES = ["BLS", "ALS"];

const EVENT_TYPES = [
  "Factory",
  "Ceremony",
  "Sports",
  "Festival",
  "Construction Site",
  "Corporate Event",
  "School",
  "Other",
];

type CrewMember = {
  userId: string;
  name: string;
  email?: string;
  role?: string;
};

type Ambulance = {
  id: string;
  code?: string;
  location?: string;
  status?: string;
  currentCase?: string | null;
  currentCaseId?: string | null;
  assignedProjectId?: string | null;
  assignedProjectName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  archived?: boolean;
  crew?: string[];
  crewUserIds?: string[];
  crewMembers?: CrewMember[];
};

type User = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
};

type Hospital = {
  id: string;
  name?: string;
  address?: string;
  type?: string;
  lat?: number;
  lng?: number;
  archived?: boolean;
};

type AmbulanceCrewAssignments = Record<string, string[]>;

function ambulanceIsFree(amb: Ambulance) {
  const status = String(amb.status || "").toLowerCase();

  return (
    !amb.archived &&
    status === "available" &&
    !amb.currentCase &&
    !amb.currentCaseId &&
    !amb.assignedProjectId &&
    !amb.projectId
  );
}

function getAmbulanceLabel(amb: Ambulance) {
  return amb.code || amb.id;
}

function getAmbulanceProjectName(amb: Ambulance) {
  return amb.assignedProjectName || amb.projectName || "another project";
}

function getUserName(user: User) {
  return user.name || user.email || user.id;
}

function getUserRole(user: User) {
  return user.role || "No role";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default function NewProjectPage() {
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [siteDetails, setSiteDetails] = useState("");
  const [requestType, setRequestType] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [eventType, setEventType] = useState("");
  const [equipment, setEquipment] = useState("");
  const [medicalBagNumber, setMedicalBagNumber] = useState("");
  const [medicationBagNumber, setMedicationBagNumber] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerMobile, setOrganizerMobile] = useState("");
  const [eventLocation, setEventLocation] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  const [assignedUsers, setAssignedUsers] = useState<Record<string, boolean>>(
    {}
  );

  const [selectedAmbulanceIds, setSelectedAmbulanceIds] = useState<string[]>(
    []
  );

  const [ambulanceCrewAssignments, setAmbulanceCrewAssignments] =
    useState<AmbulanceCrewAssignments>({});

  const [selectedHospitalIds, setSelectedHospitalIds] = useState<string[]>([]);

  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  const [ambulanceDropdownOpen, setAmbulanceDropdownOpen] = useState(false);
  const [ambulanceSearch, setAmbulanceSearch] = useState("");

  const [hospitalDropdownOpen, setHospitalDropdownOpen] = useState(false);
  const [hospitalSearch, setHospitalSearch] = useState("");

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    });

    const unsubAmbulances = onSnapshot(collection(db, "ambulances"), (snap) => {
      setAmbulances(
        snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
          .filter((a: any) => !a.archived)
      );
    });

    const unsubHospitals = onSnapshot(collection(db, "destinations"), (snap) => {
      setHospitals(
        snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
          .filter(
            (h: any) =>
              !h.archived && String(h.type || "").toLowerCase() === "hospital"
          )
      );
    });

    return () => {
      unsubUsers();
      unsubAmbulances();
      unsubHospitals();
    };
  }, []);

  const selectedAmbulances = useMemo(
    () => ambulances.filter((a) => selectedAmbulanceIds.includes(a.id)),
    [ambulances, selectedAmbulanceIds]
  );

  const selectedHospitals = useMemo(
    () => hospitals.filter((h) => selectedHospitalIds.includes(h.id)),
    [hospitals, selectedHospitalIds]
  );

  const visibleUsers = useMemo(() => {
    return users.filter((u) => u.role !== "admin");
  }, [users]);

  const selectedUsers = useMemo(() => {
    return visibleUsers.filter((u) => !!assignedUsers[u.id]);
  }, [visibleUsers, assignedUsers]);

  const selectedUserIds = useMemo(
    () => selectedUsers.map((user) => user.id),
    [selectedUsers]
  );

  useEffect(() => {
    setAmbulanceCrewAssignments((prev) => {
      const next: AmbulanceCrewAssignments = {};

      selectedAmbulanceIds.forEach((ambId) => {
        const existing = Array.isArray(prev[ambId]) ? prev[ambId] : [""];
        const filtered = existing.filter(
          (userId) => !userId || selectedUserIds.includes(userId)
        );

        next[ambId] = filtered.length > 0 ? filtered : [""];
      });

      return next;
    });
  }, [selectedAmbulanceIds.join("|"), selectedUserIds.join("|")]);

  const filteredUsers = useMemo(() => {
    const search = teamSearch.trim().toLowerCase();

    if (!search) return visibleUsers;

    return visibleUsers.filter((u) => {
      const name = getUserName(u).toLowerCase();
      const role = getUserRole(u).toLowerCase();
      const email = String(u.email || "").toLowerCase();

      return (
        name.includes(search) ||
        role.includes(search) ||
        email.includes(search)
      );
    });
  }, [visibleUsers, teamSearch]);

  const groupedFilteredUsers = useMemo(() => {
    const groups: Record<string, User[]> = {
      Paramedics: [],
      Managers: [],
      Sales: [],
      Others: [],
    };

    filteredUsers.forEach((u) => {
      const role = String(u.role || "").toLowerCase();

      if (role.includes("paramedic")) {
        groups.Paramedics.push(u);
      } else if (role.includes("manager") || role.includes("quality")) {
        groups.Managers.push(u);
      } else if (role.includes("sales")) {
        groups.Sales.push(u);
      } else {
        groups.Others.push(u);
      }
    });

    return Object.entries(groups).filter(([, list]) => list.length > 0);
  }, [filteredUsers]);

  const filteredAmbulances = useMemo(() => {
    const search = ambulanceSearch.trim().toLowerCase();

    if (!search) return ambulances;

    return ambulances.filter((amb) => {
      const code = String(amb.code || "").toLowerCase();
      const location = String(amb.location || "").toLowerCase();
      const status = String(amb.status || "").toLowerCase();
      const projectName = String(
        amb.assignedProjectName || amb.projectName || ""
      ).toLowerCase();

      return (
        code.includes(search) ||
        location.includes(search) ||
        status.includes(search) ||
        projectName.includes(search)
      );
    });
  }, [ambulances, ambulanceSearch]);

  const filteredHospitals = useMemo(() => {
    const search = hospitalSearch.trim().toLowerCase();

    if (!search) return hospitals;

    return hospitals.filter((hospital) => {
      const name = String(hospital.name || "").toLowerCase();
      const address = String(hospital.address || "").toLowerCase();

      return name.includes(search) || address.includes(search);
    });
  }, [hospitals, hospitalSearch]);

  const toggleUser = (uid: string) => {
    setAssignedUsers((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const removeSelectedUser = (uid: string) => {
    setAssignedUsers((prev) => ({
      ...prev,
      [uid]: false,
    }));
  };

  const clearSelectedUsers = () => {
    setAssignedUsers({});
    setAmbulanceCrewAssignments((prev) => {
      const next: AmbulanceCrewAssignments = {};

      Object.keys(prev).forEach((ambId) => {
        next[ambId] = [""];
      });

      return next;
    });
  };

  const toggleAmbulance = (amb: Ambulance) => {
    if (!ambulanceIsFree(amb)) return;

    setSelectedAmbulanceIds((prev) => {
      const exists = prev.includes(amb.id);

      if (exists) {
        return prev.filter((id) => id !== amb.id);
      }

      return [...prev, amb.id];
    });

    setAmbulanceCrewAssignments((prev) => {
      if (selectedAmbulanceIds.includes(amb.id)) {
        const next = { ...prev };
        delete next[amb.id];
        return next;
      }

      return {
        ...prev,
        [amb.id]: prev[amb.id]?.length ? prev[amb.id] : [""],
      };
    });
  };

  const removeSelectedAmbulance = (ambId: string) => {
    setSelectedAmbulanceIds((prev) => prev.filter((id) => id !== ambId));

    setAmbulanceCrewAssignments((prev) => {
      const next = { ...prev };
      delete next[ambId];
      return next;
    });
  };

  const clearSelectedAmbulances = () => {
    setSelectedAmbulanceIds([]);
    setAmbulanceCrewAssignments({});
  };

  const toggleHospital = (hospitalId: string) => {
    setSelectedHospitalIds((prev) =>
      prev.includes(hospitalId)
        ? prev.filter((id) => id !== hospitalId)
        : [...prev, hospitalId]
    );
  };

  const removeSelectedHospital = (hospitalId: string) => {
    setSelectedHospitalIds((prev) => prev.filter((id) => id !== hospitalId));
  };

  const updateAmbulanceCrewMember = (
    ambulanceId: string,
    index: number,
    userId: string
  ) => {
    setAmbulanceCrewAssignments((prev) => {
      const current = prev[ambulanceId]?.length ? [...prev[ambulanceId]] : [""];
      current[index] = userId;

      return {
        ...prev,
        [ambulanceId]: current,
      };
    });
  };

  const addCrewMemberRow = (ambulanceId: string) => {
    setAmbulanceCrewAssignments((prev) => ({
      ...prev,
      [ambulanceId]: [...(prev[ambulanceId] || []), ""],
    }));
  };

  const removeCrewMemberRow = (ambulanceId: string, index: number) => {
    setAmbulanceCrewAssignments((prev) => {
      const current = [...(prev[ambulanceId] || [])];
      current.splice(index, 1);

      return {
        ...prev,
        [ambulanceId]: current.length ? current : [""],
      };
    });
  };

  const getCrewUserIdsForAmbulance = (ambulanceId: string) => {
    return unique(ambulanceCrewAssignments[ambulanceId] || []);
  };

  const getCrewMembersForAmbulance = (ambulanceId: string): CrewMember[] => {
    const userIds = getCrewUserIdsForAmbulance(ambulanceId);

    return userIds
      .map((userId) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return null;

        return {
          userId: user.id,
          name: getUserName(user),
          email: user.email || "",
          role: user.role || "",
        };
      })
      .filter(Boolean) as CrewMember[];
  };

  const getSelectableCrewUsers = (ambulanceId: string, currentUserId: string) => {
    const selectedForAmbulance = getCrewUserIdsForAmbulance(ambulanceId);

    return selectedUsers.filter(
      (user) =>
        user.id === currentUserId || !selectedForAmbulance.includes(user.id)
    );
  };

  const createProject = async () => {
    if (!projectName.trim()) {
      alert("Project name is required.");
      return;
    }

    const cleanAssignedUsers = Object.fromEntries(
      Object.entries(assignedUsers).filter(([, v]) => v)
    );

    const assignedAmbulancesPayload = selectedAmbulances.map((a) => {
      const crewMembers = getCrewMembersForAmbulance(a.id);

      return {
        id: a.id,
        code: a.code || "",
        location: a.location || "",
        status: a.status || "",
        crewUserIds: crewMembers.map((member) => member.userId),
        crewMembers,
      };
    });

    const docRef = await addDoc(collection(db, "projects"), {
      projectName: projectName.trim(),
      client: client.trim(),
      status: "Active",
      isArchived: false,

      assignedUsers: cleanAssignedUsers,

      assignedAmbulanceIds: selectedAmbulanceIds,
      assignedAmbulances: assignedAmbulancesPayload,

      projectHospitalIds: selectedHospitalIds,
      projectHospitals: selectedHospitals.map((h) => ({
        id: h.id,
        name: h.name || "",
        address: h.address || "",
        type: "hospital",
        lat: h.lat ?? null,
        lng: h.lng ?? null,
      })),

      projectDetails: {
        siteDetails: siteDetails.trim(),
        requestType,
        serviceType,
        eventType,
        ambulanceNumber: selectedAmbulances.map(getAmbulanceLabel).join(", "),
        equipment: equipment.trim(),
        medicalBagNumber: medicalBagNumber.trim(),
        medicationBagNumber: medicationBagNumber.trim(),
        organizerName: organizerName.trim(),
        organizerMobile: organizerMobile.trim(),
        eventLocation: eventLocation.trim(),
      },

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const ambulanceUpdates = selectedAmbulances.map((amb) => {
      const crewMembers = getCrewMembersForAmbulance(amb.id);

      return updateDoc(doc(db, "ambulances", amb.id), {
        assignedProjectId: docRef.id,
        assignedProjectName: projectName.trim(),

        // compatibility fields
        projectId: docRef.id,
        projectName: projectName.trim(),

        // ambulance-specific crew assignment
        crewMembers,
        crewUserIds: crewMembers.map((member) => member.userId),
        crew: crewMembers.map((member) => member.name),

        updatedAt: serverTimestamp(),
      });
    });

    const crewUserUpdates = selectedAmbulances.flatMap((amb) => {
      const crewMembers = getCrewMembersForAmbulance(amb.id);

      return crewMembers.map((member) =>
        updateDoc(doc(db, "users", member.userId), {
          ambulanceIds: arrayUnion(amb.id),
          updatedAt: serverTimestamp(),
        })
      );
    });

    await Promise.all([...ambulanceUpdates, ...crewUserUpdates]);

    router.push(`/projects/${docRef.id}`);
  };

  const inputClass =
    "w-full h-11 rounded-xl border border-[#c8dce2] bg-[#f7fbfc] px-3 text-sm font-semibold text-[#123746] placeholder:text-[#8aa0aa] outline-none transition focus:border-[#74cdda] focus:bg-white focus:ring-4 focus:ring-[#74cdda]/20";

  const selectClass = inputClass;

  const textareaClass =
    "w-full rounded-xl border border-[#c8dce2] bg-[#f7fbfc] px-3 py-3 text-sm font-semibold text-[#123746] placeholder:text-[#8aa0aa] outline-none transition focus:border-[#74cdda] focus:bg-white focus:ring-4 focus:ring-[#74cdda]/20";

  const labelClass = "mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[#274C5A]";

  const cardClass =
    "rounded-2xl border border-[#d8e6ea] bg-white p-4 shadow-sm md:p-5";

  const dropdownButtonClass =
    "flex w-full items-center justify-between rounded-xl border border-[#c8dce2] bg-[#f7fbfc] px-3 py-2.5 text-left text-sm font-semibold text-[#123746] transition hover:border-[#74cdda] hover:bg-white";

  const dropdownPanelClass =
    "absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[#d8e6ea] bg-white shadow-2xl shadow-[#274C5A]/10";

  return (
    <PermissionGuard module="projects" action="create" showMessage={true}>
      <div className="min-h-screen bg-[#f3f8fa] p-6">
        <div className="w-full max-w-none space-y-4">
          <div>
            <h1 className="text-3xl font-black text-[#123746]">New Project</h1>
            <p className="mt-1 text-sm font-semibold text-[#607482]">
              Create the project, assign team, assign free ambulances, assign
              crew under each ambulance, and register allowed hospitals.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={cardClass}>
              <h2 className="mb-4 text-sm font-black text-[#123746]">
                Basic Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Project Name</label>
                  <input
                    className={inputClass}
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Client</label>
                  <input
                    className={inputClass}
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="mb-4 text-sm font-black text-[#123746]">
                Project / Site Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Project / Site Details</label>
                  <textarea
                    className={`${textareaClass} min-h-[120px]`}
                    value={siteDetails}
                    onChange={(e) => setSiteDetails(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Request Type</label>
                    <select
                      className={selectClass}
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value)}
                    >
                      <option value="">Select</option>
                      {REQUEST_TYPES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Service Type</label>
                    <select
                      className={selectClass}
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                    >
                      <option value="">Select</option>
                      {SERVICE_TYPES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Event Type</label>
                    <select
                      className={selectClass}
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                    >
                      <option value="">Select</option>
                      {EVENT_TYPES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TEAM + AMBULANCES */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* ASSIGNED TEAM */}
            <div className={cardClass}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black text-[#123746]">
                    Assigned Team
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-[#607482]">
                    Select team members from a dropdown list.
                  </p>
                </div>

                <div className="rounded-full border border-[#b9ecf2] bg-[#effbfc] px-3 py-1 text-xs font-black text-[#166575]">
                  {selectedUsers.length} selected
                </div>
              </div>

              {selectedUsers.length > 0 && (
                <div className="mb-3 rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#607482]">Selected Team</p>

                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => removeSelectedUser(u.id)}
                        className="rounded-full border border-[#b9ecf2] bg-white px-3 py-1 text-xs font-black text-[#166575] transition hover:border-[#ffc9c9] hover:bg-[#fff1f1] hover:text-[#b42318]"
                      >
                        {getUserName(u)} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTeamDropdownOpen((prev) => !prev)}
                  className={dropdownButtonClass}
                >
                  <span>
                    {selectedUsers.length > 0
                      ? `${selectedUsers.length} team member(s) selected`
                      : "Select team members"}
                  </span>

                  <span className="text-xs font-semibold text-[#607482]">
                    {teamDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>

                {teamDropdownOpen && (
                  <div className={dropdownPanelClass}>
                    <div className="border-b border-[#d8e6ea] p-3">
                      <input
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Search by name, role, or email..."
                        className="w-full rounded-xl border border-[#c8dce2] bg-[#f7fbfc] px-3 py-2 text-sm font-semibold text-[#123746] outline-none placeholder:text-[#8aa0aa] focus:border-[#74cdda] focus:bg-white"
                      />
                    </div>

                    <div className="max-h-[320px] overflow-y-auto">
                      {groupedFilteredUsers.length === 0 ? (
                        <div className="p-4 text-sm font-semibold text-[#607482]">
                          No team members found.
                        </div>
                      ) : (
                        groupedFilteredUsers.map(([group, list]) => (
                          <div key={group}>
                            <div className="sticky top-0 z-10 border-b border-[#d8e6ea] bg-[#effbfc] px-3 py-2 text-xs font-black text-[#274C5A]">
                              {group}
                            </div>

                            {list.map((u) => {
                              const checked = !!assignedUsers[u.id];

                              return (
                                <label
                                  key={u.id}
                                  className={`flex cursor-pointer items-center gap-3 border-b border-[#e1ebef] p-3 transition last:border-b-0 ${
                                    checked
                                      ? "bg-[#effbfc]"
                                      : "hover:bg-[#f7fbfc]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleUser(u.id)}
                                  />

                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-black text-[#123746]">
                                      {getUserName(u)}
                                    </span>

                                    <span className="block truncate text-xs font-semibold text-[#607482]">
                                      {getUserRole(u)}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#d8e6ea] p-3">
                      <button
                        type="button"
                        onClick={clearSelectedUsers}
                        className="text-xs font-black text-[#b42318] hover:text-[#912018]"
                      >
                        Clear
                      </button>

                      <button
                        type="button"
                        onClick={() => setTeamDropdownOpen(false)}
                        className="rounded-xl bg-[#274C5A] px-3 py-1.5 text-xs font-black text-white hover:bg-[#1d3b47]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PROJECT AMBULANCES */}
            <div className={cardClass}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black text-[#123746]">
                    Project Ambulances
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-[#607482]">
                    All ambulances are visible. Only free ambulances can be
                    selected.
                  </p>
                </div>

                <div className="rounded-full border border-[#b9ecf2] bg-[#effbfc] px-3 py-1 text-xs font-black text-[#166575]">
                  {selectedAmbulanceIds.length} selected
                </div>
              </div>

              {selectedAmbulances.length > 0 && (
                <div className="mb-3 rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#607482]">
                    Selected Ambulances
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {selectedAmbulances.map((amb) => (
                      <button
                        key={amb.id}
                        type="button"
                        onClick={() => removeSelectedAmbulance(amb.id)}
                        className="rounded-full border border-[#b9ecf2] bg-white px-3 py-1 text-xs font-black text-[#166575] transition hover:border-[#ffc9c9] hover:bg-[#fff1f1] hover:text-[#b42318]"
                      >
                        {getAmbulanceLabel(amb)} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAmbulanceDropdownOpen((prev) => !prev)}
                  className={dropdownButtonClass}
                >
                  <span>
                    {selectedAmbulanceIds.length > 0
                      ? `${selectedAmbulanceIds.length} ambulance(s) selected`
                      : "Select ambulances"}
                  </span>

                  <span className="text-xs font-semibold text-[#607482]">
                    {ambulanceDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>

                {ambulanceDropdownOpen && (
                  <div className={dropdownPanelClass}>
                    <div className="border-b border-[#d8e6ea] p-3">
                      <input
                        value={ambulanceSearch}
                        onChange={(e) => setAmbulanceSearch(e.target.value)}
                        placeholder="Search ambulance by code, location, status, or project..."
                        className="w-full rounded-xl border border-[#c8dce2] bg-[#f7fbfc] px-3 py-2 text-sm font-semibold text-[#123746] outline-none placeholder:text-[#8aa0aa] focus:border-[#74cdda] focus:bg-white"
                      />
                    </div>

                    <div className="max-h-[320px] overflow-y-auto">
                      {filteredAmbulances.length === 0 ? (
                        <div className="p-4 text-sm font-semibold text-[#607482]">
                          No ambulances found.
                        </div>
                      ) : (
                        filteredAmbulances.map((amb) => {
                          const free = ambulanceIsFree(amb);
                          const selected = selectedAmbulanceIds.includes(
                            amb.id
                          );

                          return (
                            <button
                              key={amb.id}
                              type="button"
                              disabled={!free}
                              onClick={() => toggleAmbulance(amb)}
                              className={`flex w-full items-start gap-3 border-b border-[#e1ebef] p-3 text-left transition last:border-b-0 ${
                                selected
                                  ? "bg-[#effbfc]"
                                  : free
                                  ? "hover:bg-[#f7fbfc]"
                                  : "bg-[#fff1f1] cursor-not-allowed opacity-80"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={!free}
                                readOnly
                                className="mt-1"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-black text-[#123746]">
                                    {getAmbulanceLabel(amb)}
                                  </p>

                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                                      free
                                        ? "bg-[#dff8ed] text-[#137a4a]"
                                        : "bg-[#ffe3e3] text-[#b42318]"
                                    }`}
                                  >
                                    {free
                                      ? "Free"
                                      : amb.status || "Unavailable"}
                                  </span>
                                </div>

                                <p className="mt-1 truncate text-xs font-semibold text-[#607482]">
                                  {amb.location || "No location"}
                                </p>

                                {!free && (
                                  <p className="mt-1 text-xs font-semibold text-[#b42318]">
                                    {amb.currentCase || amb.currentCaseId
                                      ? "Busy on active case"
                                      : amb.assignedProjectId || amb.projectId
                                      ? `Assigned to ${getAmbulanceProjectName(
                                          amb
                                        )}`
                                      : "Not available"}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#d8e6ea] p-3">
                      <button
                        type="button"
                        onClick={clearSelectedAmbulances}
                        className="text-xs font-black text-[#b42318] hover:text-[#912018]"
                      >
                        Clear
                      </button>

                      <button
                        type="button"
                        onClick={() => setAmbulanceDropdownOpen(false)}
                        className="rounded-xl bg-[#274C5A] px-3 py-1.5 text-xs font-black text-white hover:bg-[#1d3b47]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AMBULANCE CREW ASSIGNMENT */}
          {selectedAmbulances.length > 0 && (
            <div className={cardClass}>
              <div className="mb-4">
                <h2 className="text-sm font-black text-[#123746]">
                  Ambulance Crew Assignment
                </h2>
                <p className="mt-1 text-xs font-semibold text-[#607482]">
                  Assign crew members under each selected ambulance. The crew
                  list comes from the Assigned Team selected above.
                </p>
              </div>

              {selectedUsers.length === 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-[#9a6700] font-semibold">
                  Select team members first, then choose who belongs to each
                  ambulance.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedAmbulances.map((amb) => {
                    const crewRows = ambulanceCrewAssignments[amb.id] || [""];

                    return (
                      <div
                        key={amb.id}
                        className="rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-4"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-black text-[#123746]">
                              {getAmbulanceLabel(amb)}
                            </h3>
                            <p className="mt-1 text-xs font-semibold text-[#607482]">
                              {amb.location || "No location"}
                            </p>
                          </div>

                          <div className="rounded-full border border-[#b9ecf2] bg-[#effbfc] px-3 py-1 text-xs font-black text-[#166575]">
                            {getCrewUserIdsForAmbulance(amb.id).length} crew
                          </div>
                        </div>

                        <div className="space-y-2">
                          {crewRows.map((userId, index) => (
                            <div
                              key={`${amb.id}-${index}`}
                              className="flex flex-col gap-2 md:flex-row"
                            >
                              <select
                                className={selectClass}
                                value={userId}
                                onChange={(e) =>
                                  updateAmbulanceCrewMember(
                                    amb.id,
                                    index,
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">
                                  Select crew member {index + 1}
                                </option>

                                {getSelectableCrewUsers(amb.id, userId).map(
                                  (user) => (
                                    <option key={user.id} value={user.id}>
                                      {getUserName(user)}
                                      {user.email ? ` - ${user.email}` : ""}
                                    </option>
                                  )
                                )}
                              </select>

                              <button
                                type="button"
                                onClick={() =>
                                  removeCrewMemberRow(amb.id, index)
                                }
                                className="rounded-xl border border-[#ffc9c9] bg-[#fff1f1] px-3 py-2 text-xs font-black text-[#b42318] hover:bg-[#ffe3e3]"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => addCrewMemberRow(amb.id)}
                          className="mt-3 rounded-xl border border-[#c8dce2] bg-white px-3 py-2 text-xs font-black text-[#274C5A] hover:border-[#74cdda] hover:bg-[#f7fbfc]"
                        >
                          + Add Crew Member
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HOSPITALS + MEDICAL INFO */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* PROJECT HOSPITALS */}
            <div className={cardClass}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black text-[#123746]">
                    Project Hospitals
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-[#607482]">
                    These hospitals will appear when the case status changes to
                    Transporting.
                  </p>
                </div>

                <div className="rounded-full border border-[#b9ecf2] bg-[#effbfc] px-3 py-1 text-xs font-black text-[#166575]">
                  {selectedHospitalIds.length} selected
                </div>
              </div>

              {selectedHospitals.length > 0 && (
                <div className="mb-3 rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#607482]">
                    Selected Hospitals
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {selectedHospitals.map((hospital) => (
                      <button
                        key={hospital.id}
                        type="button"
                        onClick={() => removeSelectedHospital(hospital.id)}
                        className="rounded-full border border-[#b9ecf2] bg-white px-3 py-1 text-xs font-black text-[#166575] transition hover:border-[#ffc9c9] hover:bg-[#fff1f1] hover:text-[#b42318]"
                      >
                        {hospital.name || hospital.id} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHospitalDropdownOpen((prev) => !prev)}
                  className={dropdownButtonClass}
                >
                  <span>
                    {selectedHospitalIds.length > 0
                      ? `${selectedHospitalIds.length} hospital(s) selected`
                      : "Select hospitals"}
                  </span>

                  <span className="text-xs font-semibold text-[#607482]">
                    {hospitalDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>

                {hospitalDropdownOpen && (
                  <div className={dropdownPanelClass}>
                    <div className="border-b border-[#d8e6ea] p-3">
                      <input
                        value={hospitalSearch}
                        onChange={(e) => setHospitalSearch(e.target.value)}
                        placeholder="Search hospital by name or address..."
                        className="w-full rounded-xl border border-[#c8dce2] bg-[#f7fbfc] px-3 py-2 text-sm font-semibold text-[#123746] outline-none placeholder:text-[#8aa0aa] focus:border-[#74cdda] focus:bg-white"
                      />
                    </div>

                    <div className="max-h-[320px] overflow-y-auto">
                      {filteredHospitals.length === 0 ? (
                        <div className="p-4 text-sm font-semibold text-[#607482]">
                          No hospitals found.
                        </div>
                      ) : (
                        filteredHospitals.map((hospital) => {
                          const selected = selectedHospitalIds.includes(
                            hospital.id
                          );

                          return (
                            <button
                              key={hospital.id}
                              type="button"
                              onClick={() => toggleHospital(hospital.id)}
                              className={`flex w-full items-start gap-3 border-b border-[#e1ebef] p-3 text-left transition last:border-b-0 ${
                                selected
                                  ? "bg-[#effbfc]"
                                  : "hover:bg-[#f7fbfc]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                readOnly
                                className="mt-1"
                              />

                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-[#123746]">
                                  {hospital.name || hospital.id}
                                </p>

                                <p className="mt-1 truncate text-xs font-semibold text-[#607482]">
                                  {hospital.address || "No address"}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#d8e6ea] p-3">
                      <button
                        type="button"
                        onClick={() => setSelectedHospitalIds([])}
                        className="text-xs font-black text-[#b42318] hover:text-[#912018]"
                      >
                        Clear
                      </button>

                      <button
                        type="button"
                        onClick={() => setHospitalDropdownOpen(false)}
                        className="rounded-xl bg-[#274C5A] px-3 py-1.5 text-xs font-black text-white hover:bg-[#1d3b47]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MEDICAL / ORGANIZER INFO */}
            <div className={cardClass}>
              <h2 className="mb-4 text-sm font-black text-[#123746]">
                Medical / Organizer Information
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Medical Bag Number</label>
                    <input
                      className={inputClass}
                      value={medicalBagNumber}
                      onChange={(e) => setMedicalBagNumber(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Medication Bag Number
                    </label>
                    <input
                      className={inputClass}
                      value={medicationBagNumber}
                      onChange={(e) => setMedicationBagNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Equipment</label>
                  <textarea
                    className={`${textareaClass} min-h-[90px]`}
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Organizer Name</label>
                    <input
                      className={inputClass}
                      value={organizerName}
                      onChange={(e) => setOrganizerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Organizer Mobile</label>
                    <input
                      className={inputClass}
                      value={organizerMobile}
                      onChange={(e) => setOrganizerMobile(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Event Location</label>
                  <textarea
                    className={`${textareaClass} min-h-[90px]`}
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-3">
              <button
                onClick={createProject}
                className="rounded-xl bg-[#274C5A] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-[#274C5A]/15 transition hover:bg-[#1d3b47]"
              >
                Save Project
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-xl border border-[#c8dce2] bg-white px-4 py-2.5 text-sm font-bold text-[#274C5A] transition hover:border-[#74cdda] hover:bg-[#f7fbfc]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}

