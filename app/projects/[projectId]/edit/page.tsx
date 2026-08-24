"use client";

import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PermissionGuard from "@/app/components/PermissionGuard";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { isClientAccount, type UserAccountType } from "@/lib/userAccounts";
import {
  CREW_COMPLIANCE_ENFORCEMENT_ENABLED,
  getCrewDeploymentReadiness,
  isCrewComplianceSubject,
} from "@/lib/crewProfile";
import {
  DEPLOYMENT_TYPES as READINESS_DEPLOYMENT_TYPES,
  PROJECT_SHIFT_PRESETS,
  ProjectReadinessUnitOverride,
  ProjectShift,
  SERVICE_TYPES as READINESS_SERVICE_TYPES,
  ServiceType,
  DeploymentType,
  normalizeProjectShifts,
} from "@/lib/readinessChecklist";

const REQUEST_TYPES = [
  "Clinic",
  "Ambulance Coverage",
  "Ambulance Transportation",
  "Station Operation",
  "Other",
];

const READINESS_DEPLOYMENT_OPTIONS = READINESS_DEPLOYMENT_TYPES.filter(
  (type) => type !== "With Ambulance" && type !== "Medical Team Standby"
);

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
  crew?: string[];
  crewUserIds?: string[];
  crewMembers?: Array<{
    userId?: string;
    name?: string;
    email?: string;
    role?: string;
  }>;
  archived?: boolean;
};

type User = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  accountType?: UserAccountType;
  crewProfile?: Record<string, string>;
  crewProfileAttachments?: Record<string, any>;
};

type Hospital = {
  id: string;
  name?: string;
  address?: string;
  type?: string;
  lat?: number | null;
  lng?: number | null;
  archived?: boolean;
};

function ambulanceIsSelectableForProject(amb: Ambulance, projectId: string) {
  if (amb.archived) return false;

  const assignedProjectId = amb.assignedProjectId || amb.projectId || null;
  const status = String(amb.status || "").toLowerCase();

  if (assignedProjectId === projectId) return true;

  return (
    status === "available" &&
    !amb.currentCase &&
    !amb.currentCaseId &&
    !assignedProjectId
  );
}

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

function getAmbulanceCrewUserIds(amb: Ambulance) {
  if (Array.isArray(amb.crewUserIds)) {
    return amb.crewUserIds.filter(Boolean);
  }

  if (Array.isArray(amb.crewMembers)) {
    return amb.crewMembers.map((m) => m?.userId).filter(Boolean) as string[];
  }

  return [];
}

type AmbulanceCrewAssignment = Record<string, string[]>;
type CrewComplianceOverrides = Record<
  string,
  {
    reason: string;
    approvedById: string;
    approvedByName: string;
    approvedAt: string;
    complianceStatus: string;
    blockers: string[];
  }
>;
type ReadinessUnitOverrides = Record<string, ProjectReadinessUnitOverride>;

export default function EditProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  const router = useRouter();
  const projectId = params.projectId;
  const { user: currentUser } = useCurrentUser();
  const { isAdmin } = usePermissions(currentUser?.role);

  const [loading, setLoading] = useState(true);

  const [projectName, setProjectName] = useState("");
  const [masterProjectId, setMasterProjectId] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectLocationsCount, setProjectLocationsCount] = useState(0);
  const [client, setClient] = useState("");
  const [siteDetails, setSiteDetails] = useState("");
  const [requestType, setRequestType] = useState("");
  const [eventType, setEventType] = useState("");
  const [equipment, setEquipment] = useState("");
  const [medicalBagNumber, setMedicalBagNumber] = useState("");
  const [medicationBagNumber, setMedicationBagNumber] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerMobile, setOrganizerMobile] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [shiftPreset, setShiftPreset] = useState<"one" | "two" | "three">("one");
  const [defaultReadinessServiceType, setDefaultReadinessServiceType] =
    useState<ServiceType>("BLS");
  const [defaultReadinessDeploymentType, setDefaultReadinessDeploymentType] =
    useState<Extract<DeploymentType, "Clinic" | "Ambulance" | "Ambulance + Clinic" | "Walking Team">>("Ambulance");
  const [readinessUnitOverrides, setReadinessUnitOverrides] =
    useState<ReadinessUnitOverrides>({});

  const [users, setUsers] = useState<User[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  const [assignedUsers, setAssignedUsers] = useState<Record<string, boolean>>(
    {}
  );
  const [clientUserIds, setClientUserIds] = useState<string[]>([]);
  const [crewComplianceOverrides, setCrewComplianceOverrides] =
    useState<CrewComplianceOverrides>({});

  const [selectedAmbulanceIds, setSelectedAmbulanceIds] = useState<string[]>(
    []
  );

  const [originalAmbulanceIds, setOriginalAmbulanceIds] = useState<string[]>(
    []
  );

  const [selectedHospitalIds, setSelectedHospitalIds] = useState<string[]>([]);

  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  const [ambulanceDropdownOpen, setAmbulanceDropdownOpen] = useState(false);
  const [ambulanceSearch, setAmbulanceSearch] = useState("");

  const [hospitalDropdownOpen, setHospitalDropdownOpen] = useState(false);
  const [hospitalSearch, setHospitalSearch] = useState("");

  const [ambulanceCrewAssignments, setAmbulanceCrewAssignments] =
    useState<AmbulanceCrewAssignment>({});

  useEffect(() => {
    const loadProject = async () => {
      const snap = await getDoc(doc(db, "projects", projectId));

      if (!snap.exists()) {
        setLoading(false);
        return;
      }

      const data: any = snap.data();
      const details = data.projectDetails || {};

      setProjectName(data.projectName || "");
      setMasterProjectId(data.masterProjectId || "");
      setProjectCode(data.projectCode || "");
      setProjectLocationsCount(
        Array.isArray(data.projectLocations)
          ? data.projectLocations.filter((item: any) => item?.status !== "archived").length
          : Number(data.projectLocationsCount || 0)
      );
      setClient(data.client || "");
      setAssignedUsers(data.assignedUsers || {});
      setClientUserIds(
        Array.isArray(data.clientUserIds) ? data.clientUserIds.filter(Boolean) : []
      );
      setCrewComplianceOverrides(data.crewComplianceOverrides || {});
      setShiftPreset(
        data.shiftSchedulePreset === "two" || data.shiftSchedulePreset === "three"
          ? data.shiftSchedulePreset
          : "one"
      );
      setDefaultReadinessServiceType(
        (data.readinessDefaults?.serviceType ||
          details.readinessServiceType ||
          details.serviceType ||
          "BLS") as ServiceType
      );
      setDefaultReadinessDeploymentType(
        (data.readinessDefaults?.deploymentType ||
          details.readinessDeploymentType ||
          "Ambulance") as Extract<DeploymentType, "Clinic" | "Ambulance" | "Ambulance + Clinic" | "Walking Team">
      );
      setReadinessUnitOverrides(data.readinessUnitOverrides || {});

      const ambIds = Array.isArray(data.assignedAmbulanceIds)
        ? data.assignedAmbulanceIds
        : Array.isArray(data.assignedAmbulances)
        ? data.assignedAmbulances.map((a: any) => a?.id).filter(Boolean)
        : [];

      setSelectedAmbulanceIds(ambIds);
      setOriginalAmbulanceIds(ambIds);

      setSelectedHospitalIds(
        Array.isArray(data.projectHospitalIds)
          ? data.projectHospitalIds
          : Array.isArray(data.projectHospitals)
          ? data.projectHospitals.map((h: any) => h?.id).filter(Boolean)
          : []
      );

      setSiteDetails(details.siteDetails || "");
      setRequestType(details.requestType || "");
      setEventType(details.eventType || "");
      setEquipment(details.equipment || "");
      setMedicalBagNumber(details.medicalBagNumber || "");
      setMedicationBagNumber(details.medicationBagNumber || "");
      setOrganizerName(details.organizerName || "");
      setOrganizerMobile(details.organizerMobile || "");
      setEventLocation(details.eventLocation || "");

      setLoading(false);
    };

    loadProject();
  }, [projectId]);

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

  useEffect(() => {
    if (!selectedAmbulanceIds.length) {
      setAmbulanceCrewAssignments({});
      return;
    }

    setAmbulanceCrewAssignments((prev) => {
      const next: AmbulanceCrewAssignment = {};

      selectedAmbulanceIds.forEach((ambId) => {
        const existing = prev[ambId];

        if (existing) {
          next[ambId] = existing;
          return;
        }

        const ambulance = ambulances.find((a) => a.id === ambId);
        next[ambId] = getAmbulanceCrewUserIds(
          ambulance || ({ id: ambId } as Ambulance)
        );
      });

      return next;
    });
  }, [selectedAmbulanceIds.join("|"), ambulances]);

  const selectedAmbulances = useMemo(
    () => ambulances.filter((a) => selectedAmbulanceIds.includes(a.id)),
    [ambulances, selectedAmbulanceIds]
  );

  const selectedHospitals = useMemo(
    () => hospitals.filter((h) => selectedHospitalIds.includes(h.id)),
    [hospitals, selectedHospitalIds]
  );

  const selectedShiftSchedule = useMemo<ProjectShift[]>(() => {
    return normalizeProjectShifts(PROJECT_SHIFT_PRESETS[shiftPreset]).map((shift) => ({ ...shift }));
  }, [shiftPreset]);

  const getReadinessOverrideForAmbulance = (ambulanceId: string) => {
    return readinessUnitOverrides[ambulanceId] || { useProjectDefault: true };
  };

  const updateReadinessOverride = (
    ambulanceId: string,
    patch: ProjectReadinessUnitOverride
  ) => {
    setReadinessUnitOverrides((prev) => ({
      ...prev,
      [ambulanceId]: {
        useProjectDefault: true,
        serviceType: defaultReadinessServiceType,
        deploymentType: defaultReadinessDeploymentType,
        ...(prev[ambulanceId] || {}),
        ...patch,
      },
    }));
  };

  const cleanReadinessUnitOverrides = () => {
    return Object.fromEntries(
      selectedAmbulanceIds
        .map((ambulanceId) => {
          const override = readinessUnitOverrides[ambulanceId];
          if (!override || override.useProjectDefault !== false) return null;
          return [
            ambulanceId,
            {
              useProjectDefault: false,
              serviceType: override.serviceType || defaultReadinessServiceType,
              deploymentType: override.deploymentType || defaultReadinessDeploymentType,
            },
          ];
        })
        .filter(Boolean) as Array<[string, ProjectReadinessUnitOverride]>
    );
  };

  const visibleUsers = useMemo(() => {
    return users.filter((u) => u.role !== "admin" && !isClientAccount(u));
  }, [users]);

  const clientPortalUsers = useMemo(() => {
    return users
      .filter((u) => isClientAccount(u))
      .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));
  }, [users]);

  const toggleClientAccess = (userId: string) => {
    setClientUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  };

  const selectedUsers = useMemo(() => {
    return visibleUsers.filter((u) => !!assignedUsers[u.id]);
  }, [visibleUsers, assignedUsers]);

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

  const requestComplianceOverride = (user: User, forceCrew = false) => {
    if (!CREW_COMPLIANCE_ENFORCEMENT_ENABLED) return true;

    const readiness = getCrewDeploymentReadiness(user);
    if ((!forceCrew && !isCrewComplianceSubject(user)) || readiness.ready) return true;
    if (crewComplianceOverrides[user.id]) return true;

    if (!isAdmin) {
      alert(
        `${getUserName(user)} cannot be assigned because their crew profile is not compliant.\n\n${readiness.blockers.join("\n")}`
      );
      return false;
    }

    const reason = window.prompt(
      `This crew member is not compliant:\n\n${readiness.blockers.join("\n")}\n\nEnter the administrative override reason:`
    );
    if (!reason?.trim()) return false;

    setCrewComplianceOverrides((prev) => ({
      ...prev,
      [user.id]: {
        reason: reason.trim(),
        approvedById: currentUser?.uid || "unknown",
        approvedByName:
          currentUser?.name || currentUser?.email || currentUser?.uid || "Admin",
        approvedAt: new Date().toISOString(),
        complianceStatus: readiness.complianceStatus,
        blockers: readiness.blockers,
      },
    }));
    return true;
  };

  const toggleUser = (uid: string) => {
    const user = users.find((item) => item.id === uid);
    if (!assignedUsers[uid] && user && !requestComplianceOverride(user)) return;

    setAssignedUsers((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));

    if (assignedUsers[uid]) {
      setCrewComplianceOverrides((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    }
  };

  const removeSelectedUser = (uid: string) => {
    setAssignedUsers((prev) => ({
      ...prev,
      [uid]: false,
    }));
    setCrewComplianceOverrides((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  };

  const clearSelectedUsers = () => {
    setAssignedUsers({});
    setCrewComplianceOverrides({});
  };

  const toggleAmbulance = (amb: Ambulance) => {
    if (!ambulanceIsSelectableForProject(amb, projectId)) return;

    setSelectedAmbulanceIds((prev) =>
      prev.includes(amb.id)
        ? prev.filter((id) => id !== amb.id)
        : [...prev, amb.id]
    );
  };

  const removeSelectedAmbulance = (ambId: string) => {
    setSelectedAmbulanceIds((prev) => prev.filter((id) => id !== ambId));
    setAmbulanceCrewAssignments((prev) => {
      const next = { ...prev };
      delete next[ambId];
      return next;
    });
  };

  const updateAmbulanceCrewAssignment = (
    ambulanceId: string,
    index: number,
    userId: string
  ) => {
    const user = users.find((item) => item.id === userId);
    if (userId && user && !requestComplianceOverride(user, true)) return;

    setAmbulanceCrewAssignments((prev) => {
      const current = [...(prev[ambulanceId] || [])];

      if (userId && current.some((id, i) => id === userId && i !== index)) {
        alert("This team member is already assigned to this ambulance.");
        return prev;
      }

      current[index] = userId;

      return {
        ...prev,
        [ambulanceId]: current,
      };
    });
  };

  const addAmbulanceCrewSlot = (ambulanceId: string) => {
    setAmbulanceCrewAssignments((prev) => {
      const current = [...(prev[ambulanceId] || [])];

      if (current.length >= selectedUsers.length) return prev;

      return {
        ...prev,
        [ambulanceId]: [...current, ""],
      };
    });
  };

  const removeAmbulanceCrewSlot = (ambulanceId: string, index: number) => {
    setAmbulanceCrewAssignments((prev) => {
      const current = [...(prev[ambulanceId] || [])];
      current.splice(index, 1);

      return {
        ...prev,
        [ambulanceId]: current,
      };
    });
  };

  const getCrewMembersForAmbulance = (ambulanceId: string) => {
    const selectedCrewUserIds = Array.from(
      new Set(
        (ambulanceCrewAssignments[ambulanceId] || []).filter(
          (uid) => uid && assignedUsers[uid]
        )
      )
    );

    return selectedCrewUserIds
      .map((uid) => {
        const user = users.find((u) => u.id === uid);
        if (!user) return null;

        return {
          userId: user.id,
          name: getUserName(user),
          email: user.email || "",
          role: user.role || "team",
        };
      })
      .filter(Boolean) as Array<{
      userId: string;
      name: string;
      email: string;
      role: string;
    }>;
  };

  const toggleHospital = (id: string) => {
    setSelectedHospitalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const removeSelectedHospital = (hospitalId: string) => {
    setSelectedHospitalIds((prev) => prev.filter((id) => id !== hospitalId));
  };

  const saveProject = async () => {
    if (!projectName.trim()) {
      alert("Project name is required.");
      return;
    }

    const selectedCrewIds = new Set(
      selectedAmbulances.flatMap((ambulance) =>
        (ambulanceCrewAssignments[ambulance.id] || []).filter(Boolean)
      )
    );
    const blocked = users.filter(
      (user) =>
        ((assignedUsers[user.id] && isCrewComplianceSubject(user)) ||
          selectedCrewIds.has(user.id)) &&
        !getCrewDeploymentReadiness(user).ready &&
        !crewComplianceOverrides[user.id]
    );
    if (CREW_COMPLIANCE_ENFORCEMENT_ENABLED && blocked.length) {
      alert(
        `Project cannot be saved. Resolve crew compliance for:\n${blocked
          .map((user) => `- ${getUserName(user)}`)
          .join("\n")}`
      );
      return;
    }

    const cleanAssignedUsers = Object.fromEntries(
      Object.entries(assignedUsers).filter(([, v]) => v)
    );

    const selectedProjectName = projectName.trim();

    const selectedAmbulancesWithCrew = selectedAmbulances.map((a) => {
      const crewMembers = getCrewMembersForAmbulance(a.id);

      return {
        id: a.id,
        code: a.code || "",
        location: a.location || "",
        status: a.status || "",
        crewUserIds: crewMembers.map((m) => m.userId),
        crewMembers,
        readinessOverride:
          readinessUnitOverrides[a.id]?.useProjectDefault === false
            ? {
                serviceType: readinessUnitOverrides[a.id]?.serviceType || defaultReadinessServiceType,
                deploymentType: readinessUnitOverrides[a.id]?.deploymentType || defaultReadinessDeploymentType,
              }
            : null,
      };
    });
    const cleanedReadinessUnitOverrides = cleanReadinessUnitOverrides();

    await updateDoc(doc(db, "projects", projectId), {
      projectName: selectedProjectName,
      masterProjectId: masterProjectId.trim() || null,
      projectCode: projectCode.trim() || null,
      client: client.trim(),
      clientUserIds: Array.from(new Set(clientUserIds)),

      assignedUsers: cleanAssignedUsers,
      crewComplianceOverrides: Object.fromEntries(
        Object.entries(crewComplianceOverrides).filter(
          ([userId]) => assignedUsers[userId] || selectedCrewIds.has(userId)
        )
      ),

      assignedAmbulanceIds: selectedAmbulanceIds,
      assignedAmbulances: selectedAmbulancesWithCrew,
      shiftSchedule: selectedShiftSchedule,
      shiftSchedulePreset: shiftPreset,
      readinessDefaults: {
        serviceType: defaultReadinessServiceType,
        deploymentType: defaultReadinessDeploymentType,
      },
      readinessUnitOverrides: cleanedReadinessUnitOverrides,

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
        serviceType: defaultReadinessServiceType,
        readinessServiceType: defaultReadinessServiceType,
        readinessDeploymentType: defaultReadinessDeploymentType,
        eventType,
        ambulanceNumber: selectedAmbulances.map(getAmbulanceLabel).join(", "),
        equipment: equipment.trim(),
        medicalBagNumber: medicalBagNumber.trim(),
        medicationBagNumber: medicationBagNumber.trim(),
        organizerName: organizerName.trim(),
        organizerMobile: organizerMobile.trim(),
        eventLocation: eventLocation.trim(),
      },

      updatedAt: serverTimestamp(),
    });

    const removed = originalAmbulanceIds.filter(
      (id) => !selectedAmbulanceIds.includes(id)
    );

    const ambulanceUpdates = selectedAmbulances.map((amb) => {
      const crewMembers = getCrewMembersForAmbulance(amb.id);
      const crewUserIds = crewMembers.map((m) => m.userId);
      const oldCrewUserIds = getAmbulanceCrewUserIds(amb);
      const usersToRemove = oldCrewUserIds.filter(
        (uid) => !crewUserIds.includes(uid)
      );

      return {
        ambulanceId: amb.id,
        crewMembers,
        crewUserIds,
        usersToRemove,
      };
    });

    const removedAmbulances = ambulances.filter((a) => removed.includes(a.id));

    await Promise.all([
      ...ambulanceUpdates.map((item) =>
        updateDoc(doc(db, "ambulances", item.ambulanceId), {
          assignedProjectId: projectId,
          assignedProjectName: selectedProjectName,

          // compatibility fields
          projectId,
          projectName: selectedProjectName,

          // crew assignment for alert listener
          crewMembers: item.crewMembers,
          crewUserIds: item.crewUserIds,
          crew: item.crewMembers.map((m) => m.name),
          crewComplianceOverrides: Object.fromEntries(
            Object.entries(crewComplianceOverrides).filter(([userId]) =>
              item.crewUserIds.includes(userId)
            )
          ),

          updatedAt: serverTimestamp(),
        })
      ),

      ...removedAmbulances.map((amb) =>
        updateDoc(doc(db, "ambulances", amb.id), {
          assignedProjectId: null,
          assignedProjectName: null,

          // compatibility fields
          projectId: null,
          projectName: null,

          // remove crew when ambulance is removed from this project
          crewMembers: [],
          crewUserIds: [],
          crew: [],

          updatedAt: serverTimestamp(),
        })
      ),

      ...ambulanceUpdates.flatMap((item) => [
        ...item.crewUserIds.map((uid) =>
          updateDoc(doc(db, "users", uid), {
            ambulanceIds: arrayUnion(item.ambulanceId),
            updatedAt: serverTimestamp(),
          })
        ),
        ...item.usersToRemove.map((uid) =>
          updateDoc(doc(db, "users", uid), {
            ambulanceIds: arrayRemove(item.ambulanceId),
            updatedAt: serverTimestamp(),
          })
        ),
      ]),

      ...removedAmbulances.flatMap((amb) =>
        getAmbulanceCrewUserIds(amb).map((uid) =>
          updateDoc(doc(db, "users", uid), {
            ambulanceIds: arrayRemove(amb.id),
            updatedAt: serverTimestamp(),
          })
        )
      ),
    ]);

    router.push(`/projects/${projectId}`);
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

  if (loading) {
    return <div className="p-6 text-[#607482]">Loading project...</div>;
  }

return (
  <PermissionGuard module="projects" action="edit" showMessage={true}>
    <div className="min-h-screen bg-[#eef5f7] p-6">
      <div className="w-full max-w-none space-y-4">
        <div>
          <h1 className="text-3xl font-black text-[#123746]">Edit Project</h1>
          <p className="mt-1 text-sm font-semibold text-[#607482]">
            Update project details, team, ambulances, and hospitals.
          </p>
        </div>

        <div className={`${cardClass} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
          <div>
            <h2 className="text-sm font-black text-[#123746]">Project Locations</h2>
            <p className="mt-1 text-sm font-semibold text-[#607482]">
              Manage the factories and operational sites used when creating project cases.
            </p>
            <div className="mt-3 inline-flex rounded-full border border-[#c8dce2] bg-[#f7fbfc] px-3 py-1 text-xs font-black text-[#274C5A]">
              {projectLocationsCount} active {projectLocationsCount === 1 ? "location" : "locations"}
            </div>
          </div>
          <Link
            href={`/projects/${projectId}/locations`}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#274C5A] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#274C5A]/15 transition hover:bg-[#1d3b47]"
          >
            {projectLocationsCount > 0 ? "Manage Locations" : "Add Project Locations"}
          </Link>
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

              <div>
                <label className={labelClass}>Master Project ID</label>
                <input
                  className={inputClass}
                  value={masterProjectId}
                  onChange={(e) => setMasterProjectId(e.target.value)}
                  placeholder="PRJ-0001"
                />
              </div>

              <div>
                <label className={labelClass}>Project Code</label>
                <input
                  className={inputClass}
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  placeholder="LZM-CWA-B+-MOC-25"
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

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <label className={labelClass}>Service Level</label>
                  <select
                    className={selectClass}
                    value={defaultReadinessServiceType}
                    onChange={(e) => setDefaultReadinessServiceType(e.target.value as ServiceType)}
                  >
                    {READINESS_SERVICE_TYPES.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Deployment Type</label>
                  <select
                    className={selectClass}
                    value={defaultReadinessDeploymentType}
                    onChange={(e) =>
                      setDefaultReadinessDeploymentType(
                        e.target.value as Extract<DeploymentType, "Clinic" | "Ambulance" | "Ambulance + Clinic" | "Walking Team">
                      )
                    }
                  >
                    {READINESS_DEPLOYMENT_OPTIONS.map((x) => (
                      <option key={x} value={x}>{x}</option>
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

        <div className={cardClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-[#123746]">Client Portal Access</h2>
              <p className="mt-1 text-xs font-semibold text-[#607482]">
                Select the external client accounts allowed to create and track cases for this project.
              </p>
            </div>
            <span className="rounded-full border border-[#b9ecf2] bg-[#effbfc] px-3 py-1 text-xs font-black text-[#166575]">
              {clientUserIds.length} selected
            </span>
          </div>

          {clientPortalUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#c8dce2] bg-[#f7fbfc] p-4 text-sm font-semibold text-[#607482]">
              No Client accounts found. Set the user Account Type to Client in User Management first.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {clientPortalUsers.map((clientUser) => (
                <label
                  key={clientUser.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] p-3 transition hover:border-[#74cdda] hover:bg-white"
                >
                  <input
                    type="checkbox"
                    checked={clientUserIds.includes(clientUser.id)}
                    onChange={() => toggleClientAccess(clientUser.id)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#123746]">
                      {getUserName(clientUser)}
                    </span>
                    <span className="block truncate text-xs font-semibold text-[#607482]">
                      {clientUser.email || clientUser.id}
                    </span>
                    <span className="mt-1 block text-[11px] font-bold text-[#166575]">
                      {clientUser.active === false ? "Pending activation" : "Active"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={cardClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-[#123746]">Shift Schedule</h2>
              <p className="mt-1 text-xs font-semibold text-[#607482]">
                This controls which readiness checklist window opens automatically.
              </p>
            </div>

            <div className="rounded-full border border-[#b9ecf2] bg-[#effbfc] px-3 py-1 text-xs font-black text-[#166575]">
              {selectedShiftSchedule.length} shift(s)
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { id: "one" as const, label: "One shift", hint: "24-hour coverage" },
              { id: "two" as const, label: "Two shifts", hint: "Day / Night" },
              { id: "three" as const, label: "Three shifts", hint: "Morning / Evening / Night" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setShiftPreset(preset.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  shiftPreset === preset.id
                    ? "border-[#274C5A] bg-[#274C5A]/10 text-[#123746]"
                    : "border-[#86A7B2]/25 bg-[#f8fbfc] text-[#274C5A] hover:border-[#274C5A]/40"
                }`}
              >
                <span className="block text-sm font-black">{preset.label}</span>
                <span className="mt-1 block text-xs font-semibold text-[#607482]">{preset.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {selectedShiftSchedule.map((shift) => (
              <div key={shift.id} className="rounded-xl border border-[#86A7B2]/25 bg-[#f8fbfc] p-4">
                <div className="text-sm font-black text-[#123746]">{shift.name}</div>
                <div className="mt-1 text-xs font-semibold text-[#607482]">
                  {shift.startTime} - {shift.endTime}
                  {shift.crossesMidnight ? " (next day)" : ""}
                </div>
              </div>
            ))}
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
              <div className="mb-3 rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] p-3">
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

                <span className="text-xs text-[#607482]">
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
                      className="w-full rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] px-3 py-2 text-sm text-[#123746] outline-none placeholder:text-[#8aa0aa] focus:border-[#74cdda]"
                    />
                  </div>

                  <div className="max-h-[320px] overflow-y-auto">
                    {groupedFilteredUsers.length === 0 ? (
                      <div className="p-4 text-sm text-[#607482]">
                        No team members found.
                      </div>
                    ) : (
                      groupedFilteredUsers.map(([group, list]) => (
                        <div key={group}>
                          <div className="sticky top-0 z-10 border-b border-[#e1ebef] bg-[#f7fbfc] px-3 py-2 text-xs font-semibold text-[#607482]">
                            {group}
                          </div>

                          {list.map((u) => {
                            const checked = !!assignedUsers[u.id];
                            const crewSubject = isCrewComplianceSubject(u);
                            const readiness = getCrewDeploymentReadiness(u);
                            const overridden = Boolean(
                              crewComplianceOverrides[u.id]
                            );

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
                                  <span className="block truncate text-sm font-semibold text-[#123746]">
                                    {getUserName(u)}
                                  </span>

                                  <span className="block truncate text-xs text-[#607482]">
                                    {getUserRole(u)}
                                  </span>
                                  {crewSubject && (
                                    <span
                                      className={`mt-1 block text-[10px] font-semibold ${
                                        readiness.ready
                                          ? "text-emerald-400"
                                          : overridden
                                          ? "text-amber-400"
                                          : "text-red-400"
                                      }`}
                                    >
                                      {readiness.ready
                                        ? "Compliant"
                                        : overridden
                                        ? "Administrative override"
                                        : CREW_COMPLIANCE_ENFORCEMENT_ENABLED
                                        ? `${readiness.complianceStatus} - assignment blocked`
                                        : "Profile pending - not enforced"}
                                    </span>
                                  )}
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
                      className="text-xs font-semibold text-red-300 hover:text-red-200"
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
                <h2 className="text-sm font-semibold text-[#123746]">
                  Project Ambulances
                </h2>
                <p className="mt-1 text-xs text-[#607482]">
                  You can select free ambulances or ambulances already assigned
                  to this project.
                </p>
              </div>

              <div className="rounded-full bg-[#effbfc] px-3 py-1 text-xs font-semibold text-[#166575]">
                {selectedAmbulanceIds.length} selected
              </div>
            </div>

            {selectedAmbulances.length > 0 && (
              <div className="mb-3 rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] p-3">
                <p className="mb-2 text-xs text-[#607482]">
                  Selected Ambulances
                </p>

                <div className="flex flex-wrap gap-2">
                  {selectedAmbulances.map((amb) => (
                    <button
                      key={amb.id}
                      type="button"
                      onClick={() => removeSelectedAmbulance(amb.id)}
                      className="rounded-full bg-[#effbfc] px-3 py-1 text-xs text-[#166575] transition hover:bg-red-500/20 hover:text-red-200"
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

                <span className="text-xs text-[#607482]">
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
                      className="w-full rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] px-3 py-2 text-sm text-[#123746] outline-none placeholder:text-[#8aa0aa] focus:border-[#74cdda]"
                    />
                  </div>

                  <div className="max-h-[320px] overflow-y-auto">
                    {filteredAmbulances.length === 0 ? (
                      <div className="p-4 text-sm text-[#607482]">
                        No ambulances found.
                      </div>
                    ) : (
                      filteredAmbulances.map((amb) => {
                        const selectable = ambulanceIsSelectableForProject(
                          amb,
                          projectId
                        );
                        const selected = selectedAmbulanceIds.includes(amb.id);
                        const assignedToThisProject =
                          (amb.assignedProjectId || amb.projectId) ===
                          projectId;
                        const free = ambulanceIsFree(amb);

                        return (
                          <button
                            key={amb.id}
                            type="button"
                            disabled={!selectable}
                            onClick={() => toggleAmbulance(amb)}
                            className={`flex w-full items-start gap-3 border-b border-[#e1ebef] p-3 text-left transition last:border-b-0 ${
                              selected
                                ? "bg-[#effbfc]"
                                : selectable
                                ? "hover:bg-[#f7fbfc]"
                                : "bg-red-950/20 cursor-not-allowed opacity-80"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!selectable}
                              readOnly
                              className="mt-1"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-[#123746]">
                                  {getAmbulanceLabel(amb)}
                                </p>

                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                                    assignedToThisProject || free
                                      ? "bg-green-500/15 text-green-400"
                                      : "bg-red-500/15 text-red-300"
                                  }`}
                                >
                                  {assignedToThisProject
                                    ? "This project"
                                    : free
                                    ? "Free"
                                    : amb.status || "Unavailable"}
                                </span>
                              </div>

                              <p className="mt-1 truncate text-xs text-[#607482]">
                                {amb.location || "No location"}
                              </p>

                              {!selectable && (
                                <p className="mt-1 text-xs text-red-300">
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
                      onClick={() => setSelectedAmbulanceIds([])}
                      className="text-xs font-semibold text-red-300 hover:text-red-200"
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

            {selectedAmbulances.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] p-3">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-[#123746]">
                    Ambulance Crew Assignment
                  </h3>
                  <p className="mt-1 text-xs text-[#607482]">
                    Assign crew members from the selected project team. This will
                    update the ambulance crew and team alert automatically.
                  </p>
                </div>

                {selectedUsers.length === 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    Select project team members first, then assign them to each
                    ambulance.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedAmbulances.map((amb) => {
                      const crewIds = ambulanceCrewAssignments[amb.id] || [];
                      const readinessOverride = getReadinessOverrideForAmbulance(amb.id);
                      const usesProjectDefault = readinessOverride.useProjectDefault !== false;

                      return (
                        <div
                          key={amb.id}
                          className="rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] p-3"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[#123746]">
                                {getAmbulanceLabel(amb)}
                              </p>
                              <p className="text-xs text-[#607482]">
                                {amb.location || "No location"}
                              </p>
                            </div>

                            <span className="rounded-full bg-[#effbfc] px-2 py-1 text-[10px] text-[#166575]">
                              {(crewIds || []).filter(Boolean).length} crew
                            </span>
                          </div>

                          <div className="space-y-3">
                            {(crewIds.length > 0 ? crewIds : [""]).map(
                              (crewUserId, index) => {
                                const usedByOtherSlots = crewIds.filter(
                                  (id, i) => id && i !== index
                                );

                                return (
                                  <div
                                    key={`${amb.id}-crew-${index}`}
                                    className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]"
                                  >
                                    <div>
                                      <label className={labelClass}>
                                        Crew Member {index + 1}
                                      </label>
                                      <select
                                        className={selectClass}
                                        value={crewUserId || ""}
                                        onChange={(e) =>
                                          updateAmbulanceCrewAssignment(
                                            amb.id,
                                            index,
                                            e.target.value
                                          )
                                        }
                                      >
                                        <option value="">Select crew member</option>
                                        {selectedUsers
                                          .filter(
                                            (u) =>
                                              !usedByOtherSlots.includes(u.id)
                                          )
                                          .map((u) => (
                                            <option key={u.id} value={u.id}>
                                              {getUserName(u)} - {getUserRole(u)}
                                              {getCrewDeploymentReadiness(u).ready
                                                ? " - Compliant"
                                                : crewComplianceOverrides[u.id]
                                                ? " - Override approved"
                                                : CREW_COMPLIANCE_ENFORCEMENT_ENABLED
                                                ? " - Blocked"
                                                : " - Profile pending"}
                                            </option>
                                          ))}
                                      </select>
                                    </div>

                                    <div className="flex items-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeAmbulanceCrewSlot(amb.id, index)
                                        }
                                        className="h-11 rounded-xl border border-red-500/40 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/10"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                );
                              }
                            )}

                            <button
                              type="button"
                              onClick={() => addAmbulanceCrewSlot(amb.id)}
                              disabled={
                                (crewIds || []).length >= selectedUsers.length
                              }
                              className="rounded-xl border border-blue-500/40 px-3 py-2 text-xs font-semibold text-[#166575] transition hover:bg-[#effbfc] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              + Add Crew Member
                            </button>
                          </div>

                          <div className="mt-4 rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-[#607482]">
                                  Readiness Settings
                                </div>
                                <p className="mt-1 text-xs text-[#607482]">
                                  Default: {defaultReadinessServiceType} / {defaultReadinessDeploymentType}
                                </p>
                              </div>

                              <label className="flex items-center gap-2 text-xs font-semibold text-[#274C5A]">
                                <input
                                  type="checkbox"
                                  checked={usesProjectDefault}
                                  onChange={(e) =>
                                    updateReadinessOverride(amb.id, {
                                      useProjectDefault: e.target.checked,
                                    })
                                  }
                                />
                                Use project default
                              </label>
                            </div>

                            {!usesProjectDefault && (
                              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                  <label className={labelClass}>Service Level</label>
                                  <select
                                    className={selectClass}
                                    value={readinessOverride.serviceType || defaultReadinessServiceType}
                                    onChange={(e) =>
                                      updateReadinessOverride(amb.id, {
                                        useProjectDefault: false,
                                        serviceType: e.target.value as ServiceType,
                                      })
                                    }
                                  >
                                    {READINESS_SERVICE_TYPES.map((type) => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className={labelClass}>Deployment Type</label>
                                  <select
                                    className={selectClass}
                                    value={readinessOverride.deploymentType || defaultReadinessDeploymentType}
                                    onChange={(e) =>
                                      updateReadinessOverride(amb.id, {
                                        useProjectDefault: false,
                                        deploymentType: e.target.value as Extract<DeploymentType, "Clinic" | "Ambulance" | "Ambulance + Clinic" | "Walking Team">,
                                      })
                                    }
                                  >
                                    {READINESS_DEPLOYMENT_OPTIONS.map((type) => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* HOSPITALS + MEDICAL INFO */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* PROJECT HOSPITALS */}
          <div className={cardClass}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#123746]">
                  Project Hospitals
                </h2>
                <p className="mt-1 text-xs text-[#607482]">
                  These hospitals will appear when the case status changes to
                  Transporting.
                </p>
              </div>

              <div className="rounded-full bg-[#effbfc] px-3 py-1 text-xs font-semibold text-[#166575]">
                {selectedHospitalIds.length} selected
              </div>
            </div>

            {selectedHospitals.length > 0 && (
              <div className="mb-3 rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] p-3">
                <p className="mb-2 text-xs text-[#607482]">
                  Selected Hospitals
                </p>

                <div className="flex flex-wrap gap-2">
                  {selectedHospitals.map((hospital) => (
                    <button
                      key={hospital.id}
                      type="button"
                      onClick={() => removeSelectedHospital(hospital.id)}
                      className="rounded-full bg-[#effbfc] px-3 py-1 text-xs text-[#166575] transition hover:bg-red-500/20 hover:text-red-200"
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

                <span className="text-xs text-[#607482]">
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
                      className="w-full rounded-xl border border-[#d8e6ea] bg-[#f7fbfc] px-3 py-2 text-sm text-[#123746] outline-none placeholder:text-[#8aa0aa] focus:border-[#74cdda]"
                    />
                  </div>

                  <div className="max-h-[320px] overflow-y-auto">
                    {filteredHospitals.length === 0 ? (
                      <div className="p-4 text-sm text-[#607482]">
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
                              <p className="truncate text-sm font-semibold text-[#123746]">
                                {hospital.name || hospital.id}
                              </p>

                              <p className="mt-1 truncate text-xs text-[#607482]">
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
                      className="text-xs font-semibold text-red-300 hover:text-red-200"
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
            <h2 className="mb-4 text-sm font-semibold text-[#123746]">
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
                  <label className={labelClass}>Medication Bag Number</label>
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
              onClick={saveProject}
              className="rounded-xl bg-[#274C5A] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#1d3b47]"
            >
              Save Changes
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-[#d8e6ea] px-4 py-2.5 text-sm font-semibold text-[#607482] transition hover:bg-[#f7fbfc]"
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
