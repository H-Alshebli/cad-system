"use client";

import { useState, useEffect, useMemo } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  doc,
  updateDoc,
  where,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";
import LocationSearch, {
  LocationSearchResult,
} from "@/app/components/LocationSearch";
import ProjectLocationSelector from "@/app/components/ProjectLocationSelector";
import { ProjectLocation, readProjectLocations } from "@/lib/projectLocations";
import { reserveOperationalNumber } from "@/lib/operationalNumbers";
import { useClientI18n } from "@/lib/clientI18n";

const Map = dynamic(() => import("@/app/components/Map"), { ssr: false });

const CHIEF_COMPLAINT_OPTIONS = [
  "Cardiac complaints",
  "Musculoskeletal complaints",
  "Metabolic and endocrine complaints",
  "Environmental and toxicological complaints",
  "Gastrointestinal complaints",
  "Infectious disease complaints",
  "Other",
];

const TRIAGE_LEVELS = [
  "Level 1 (Resuscitation)",
  "Level 2 (Emergent)",
  "Level 3 (Urgent)",
  "Level 4 (Less Urgent)",
  "Level 5 (Non-Urgent)",
  "Death",
];

type UnitType = "ambulance" | "clinic" | "roaming" | "";

type ClientProject = {
  id: string;
  projectName?: string;
  name?: string;
  title?: string;
  client?: string;
  clientName?: string;
  assignedAmbulanceIds?: string[];
  assignedAmbulances?: any[];
  projectHospitalIds?: string[];
  projectHospitals?: any[];
  assignedClinicIds?: string[];
  projectClinicIds?: string[];
  assignedClinics?: any[];
  projectClinics?: any[];
  assignedRoamingIds?: string[];
  projectRoamingIds?: string[];
  assignedRoamingUnits?: any[];
  projectRoamingUnits?: any[];
  projectLocations?: ProjectLocation[];
};

const FieldLabel = ({ text }: { text: string }) => (
  <label className="field-label">
    {text}
  </label>
);

const inputClass =
  "input";

function extractLatLngFromGoogleMaps(url: string) {
  const patterns = [
    /q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match) {
      return {
        lat: Number(match[1]),
        lng: Number(match[2]),
      };
    }
  }

  return null;
}

function isAmbulanceBusy(amb: any) {
  const status = String(amb.status || "").toLowerCase();

  return status !== "available" || !!amb.currentCase || !!amb.currentCaseId;
}

function getProjectAmbulanceIds(projectData: any) {
  const idsFromAssignedAmbulanceIds = Array.isArray(
    projectData?.assignedAmbulanceIds
  )
    ? projectData.assignedAmbulanceIds
    : [];

  const idsFromAssignedAmbulances = Array.isArray(
    projectData?.assignedAmbulances
  )
    ? projectData.assignedAmbulances
        .map((a: any) => a?.id)
        .filter(Boolean)
    : [];

  return Array.from(
    new Set([...idsFromAssignedAmbulanceIds, ...idsFromAssignedAmbulances])
  );
}

function getProjectClinicIds(projectData: any) {
  const ids = [
    ...(Array.isArray(projectData?.assignedClinicIds)
      ? projectData.assignedClinicIds
      : []),
    ...(Array.isArray(projectData?.projectClinicIds)
      ? projectData.projectClinicIds
      : []),
  ];
  const embedded = [
    ...(Array.isArray(projectData?.assignedClinics)
      ? projectData.assignedClinics
      : []),
    ...(Array.isArray(projectData?.projectClinics)
      ? projectData.projectClinics
      : []),
    ...(Array.isArray(projectData?.projectHospitals)
      ? projectData.projectHospitals
      : []),
  ]
        .filter((item: any) => String(item?.type || "").toLowerCase() === "clinic")
        .map((item: any) => item?.id)
        .filter(Boolean);

  return Array.from(new Set([...ids, ...embedded].map(String).filter(Boolean)));
}

function getProjectRoamingIds(projectData: any) {
  const directIds = [
    ...(Array.isArray(projectData?.assignedRoamingIds)
      ? projectData.assignedRoamingIds
      : []),
    ...(Array.isArray(projectData?.projectRoamingIds)
      ? projectData.projectRoamingIds
      : []),
  ];
  const embeddedIds = [
    ...(Array.isArray(projectData?.assignedRoamingUnits)
      ? projectData.assignedRoamingUnits
      : []),
    ...(Array.isArray(projectData?.projectRoamingUnits)
      ? projectData.projectRoamingUnits
      : []),
  ]
    .map((item: any) => item?.id)
    .filter(Boolean);

  return Array.from(new Set([...directIds, ...embeddedIds].map(String).filter(Boolean)));
}

function getProjectName(project: any) {
  return (
    project?.projectName ??
    project?.name ??
    project?.title ??
    project?.clientName ??
    project?.client ??
    "Unknown Project"
  );
}

function normalizeMapUnits(list: any[]) {
  return list.map((item) => ({
    ...item,
    lat: item.lat ?? undefined,
    lng: item.lng ?? undefined,
  }));
}

export default function ClientNewCasePage() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const { t, translateValue, dir, language } = useClientI18n();

  const [receivedAt, setReceivedAt] = useState<Timestamp | null>(null);

  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectData, setProjectData] = useState<ClientProject | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [callerName, setCallerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [otherComplaint, setOtherComplaint] = useState("");
  const [triageLevel, setTriageLevel] = useState("");
  const [patientName, setPatientName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isFromMapLink, setIsFromMapLink] = useState(false);
  const [isFromLocationSearch, setIsFromLocationSearch] = useState(false);
  const [selectedProjectLocation, setSelectedProjectLocation] = useState<ProjectLocation | null>(null);

  const [unitType, setUnitType] = useState<UnitType>("ambulance");
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReceivedAt(Timestamp.now());
  }, []);

  useEffect(() => {
    if (userLoading) return;

    if (!user?.uid) {
      setProjects([]);
      setLoadingProjects(false);
      return;
    }

    const q = query(
      collection(db, "projects"),
      where("clientUserIds", "array-contains", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setProjects(list);

        if (list.length === 1) {
          setProjectId(list[0].id);
        }

        setLoadingProjects(false);
      },
      (error) => {
        console.error("Client projects listener error:", error);
        setProjects([]);
        setLoadingProjects(false);
      }
    );

    return () => unsub();
  }, [user?.uid, userLoading]);

  useEffect(() => {
    const selected = projects.find((p) => p.id === projectId) || null;
    setProjectData(selected);
    setSelectedUnitId("");
    setUnits([]);
    setSelectedProjectLocation(null);
    setLocationText("");
    setMapLink("");
    setLat(null);
    setLng(null);
    setIsFromMapLink(false);
    setIsFromLocationSearch(false);
  }, [projectId, projects]);

  useEffect(() => {
    if (!unitType || !projectData?.id) {
      setUnits([]);
      setSelectedUnitId("");
      return;
    }

    const collectionName =
      unitType === "ambulance"
        ? "ambulances"
        : unitType === "clinic"
        ? "destinations"
        : "Roaming";

    const unsub = onSnapshot(collection(db, collectionName), (snap) => {
      let list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      if (unitType === "ambulance") {
        const projectAmbulanceIds = getProjectAmbulanceIds(projectData);

        list = list.filter((item: any) => {
          if (item.archived) return false;

          const itemAssignedProjectId =
            item.assignedProjectId || item.projectId || null;

          const isInProjectList = projectAmbulanceIds.includes(item.id);
          const isLinkedToProject = itemAssignedProjectId === projectData.id;

          return isInProjectList || isLinkedToProject;
        });
      } else if (unitType === "clinic") {
        const allowedClinicIds = getProjectClinicIds(projectData);

        list = list.filter((item: any) => {
          if (item.archived) return false;

          const isClinic = String(item.type || "").toLowerCase() === "clinic";

          if (!isClinic) return false;

          return allowedClinicIds.includes(item.id);
        });
      } else {
        const allowedRoamingIds = getProjectRoamingIds(projectData);
        list = list.filter((item: any) => {
          if (item.archived) return false;
          const linkedProjectId = String(
            item.assignedProjectId || item.projectId || ""
          );
          return (
            allowedRoamingIds.includes(item.id) ||
            linkedProjectId === projectData.id
          );
        });
      }

      setUnits(list);

      if (selectedUnitId && !list.some((u: any) => u.id === selectedUnitId)) {
        setSelectedUnitId("");
      }
    });

    return () => unsub();
  }, [unitType, projectData, selectedUnitId]);

  const googleMapLink =
    lat !== null && lng !== null
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId),
    [units, selectedUnitId]
  );

  const selectedAmbulanceBusy =
    unitType === "ambulance" && selectedUnit
      ? isAmbulanceBusy(selectedUnit)
      : false;

  const availableUnitTypes = useMemo<UnitType[]>(() => {
    const types: UnitType[] = ["ambulance"];
    if (getProjectClinicIds(projectData).length > 0) types.push("clinic");
    if (getProjectRoamingIds(projectData).length > 0) types.push("roaming");
    return types;
  }, [projectData]);

  useEffect(() => {
    if (!availableUnitTypes.includes(unitType)) {
      setUnitType("ambulance");
      setSelectedUnitId("");
    }
  }, [availableUnitTypes, unitType]);

  function selectSearchedLocation(result: LocationSearchResult) {
    setSelectedProjectLocation(null);
    setLocationText(result.displayName);
    setLat(result.lat);
    setLng(result.lng);
    setMapLink(`https://www.google.com/maps?q=${result.lat},${result.lng}`);
    setIsFromMapLink(false);
    setIsFromLocationSearch(true);
  }

  const createCase = async () => {
    if (!user?.uid) {
      alert(t("User is missing."));
      return;
    }

    if (!projectData?.id) {
      alert(t("Please select a project."));
      return;
    }

    if (!chiefComplaint || !triageLevel || !locationText || !selectedUnitId) {
      alert(t("Please complete chief complaint, triage, location, and unit."));
      return;
    }

    if (!availableUnitTypes.includes(unitType) || !selectedUnit) {
      alert(t("The selected unit is not assigned to this project."));
      return;
    }

    const projectName = getProjectName(projectData);

    setSaving(true);

    try {
      const operationalNumber = await reserveOperationalNumber("case");
      const caseRef = await addDoc(collection(db, "cases"), {
        caseNumber: operationalNumber.number,
        caseSequence: operationalNumber.sequence,
        projectId: projectData.id,
        projectName,

        projectHospitals: Array.isArray(projectData?.projectHospitals)
          ? projectData.projectHospitals
          : [],
        projectHospitalIds: Array.isArray(projectData?.projectHospitalIds)
          ? projectData.projectHospitalIds
          : [],

        callerName,
        contactNumber,
        chiefComplaint:
          chiefComplaint === "Other" ? otherComplaint : chiefComplaint,
        level: triageLevel,
        patientName,

        location: {
          text: locationText,
          lat,
          lng,
          googleMapLink,
          source: selectedProjectLocation
            ? "project_location"
            : isFromLocationSearch
            ? "location_search"
            : isFromMapLink
            ? "google_link"
            : "manual",
        },

        locationDescription: locationText,
        googleMapsLink: mapLink,
        projectLocationId: selectedProjectLocation?.id || null,
        projectLocationNumber: selectedProjectLocation?.siteNumber || null,
        projectLocationName: selectedProjectLocation?.siteName || null,

        assignedUnit: {
          type: unitType,
          id: selectedUnitId,
          code: selectedUnit?.code || selectedUnit?.name || null,
          wasBusyWhenSelected: selectedAmbulanceBusy,
        },

        // Legacy fields kept because older dashboards/alerts read these directly.
        ambulanceCode:
          unitType === "ambulance" ? selectedUnit?.code || selectedUnit?.name || null : null,
        clinicId: unitType === "clinic" ? selectedUnitId : null,
        roaming: unitType === "roaming" ? selectedUnit?.code || selectedUnit?.name || null : null,

        clientSelectedUnit: {
          type: unitType,
          id: selectedUnitId,
          code: selectedUnit?.code || selectedUnit?.name || null,
          wasBusyWhenSelected: selectedAmbulanceBusy,
        },

        status: "Assigned",
        source: "client_portal",
        createdByRole: "client",
        createdByUid: user.uid,
        clientId: user.uid,
        requiresDispatchReview: true,

        timeline: {
          receivedAt,
          Received: serverTimestamp(),
          assignedAt: serverTimestamp(),
          Assigned: serverTimestamp(),
          enRouteAt: null,
          onSceneAt: null,
          transportingAt: null,
          hospitalAt: null,
          closedAt: null,
        },

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (unitType === "ambulance") {
        await updateDoc(doc(db, "ambulances", selectedUnitId), {
          currentCase: caseRef.id,
          currentCaseId: caseRef.id,

          assignedProjectId: projectData.id,
          assignedProjectName: projectName,

          projectId: projectData.id,
          projectName,

          status: "busy",
          updatedAt: serverTimestamp(),
        });
      }

      alert(t("Case submitted successfully."));
      router.push("/client/cases");
    } catch (error) {
      console.error("Create client case error:", error);
      alert(t("Failed to submit case."));
    } finally {
      setSaving(false);
    }
  };

  if (userLoading || loadingProjects) {
    return (
      <div className="p-6">
        <div className="card-modern text-sm font-semibold text-[#274C5A]">
          {t("Loading...")}
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard module="client_cases" action="create" showMessage={true}>
      <div className="page-shell p-6" dir={dir} lang={language}>
        <div className="page-header">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#74cdda]">
              {t("Client Case")}
            </p>
            <h1 className="page-title">{t("New Case (Project)")}</h1>
            <p className="page-subtitle mt-1">
              {t("Create a case request linked to one of your assigned projects.")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(520px,0.95fr)_minmax(520px,1.05fr)]">
          <div className="card-modern space-y-5">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#c8dce2] bg-[#f7fbfc] p-6 text-center text-sm font-semibold text-[#607482]">
                {t("No assigned projects found. Please contact Lazem team.")}
              </div>
            ) : (
              <>
                <div>
                  <FieldLabel text={t("Project *")} />
                  <select
                    className={inputClass}
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setSelectedUnitId("");
                    }}
                  >
                    <option value="">{t("Select project")}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {getProjectName(project)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel text={t("Caller Name")} />
                    <input
                      className={inputClass}
                      value={callerName}
                      onChange={(e) => setCallerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <FieldLabel text={t("Contact Number")} />
                    <input
                      className={inputClass}
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel text={t("Prehospital Chief Complaints *")} />
                  <select
                    className={inputClass}
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                  >
                    <option value="">{t("Select complaint")}</option>
                    {CHIEF_COMPLAINT_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {translateValue(c)}
                      </option>
                    ))}
                  </select>

                  {chiefComplaint === "Other" && (
                    <input
                      className={`${inputClass} mt-2`}
                      placeholder={t("Specify other complaint")}
                      value={otherComplaint}
                      onChange={(e) => setOtherComplaint(e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <FieldLabel text={t("Prehospital Triage Color-Coded Scale *")} />
                  <select
                    className={inputClass}
                    value={triageLevel}
                    onChange={(e) => setTriageLevel(e.target.value)}
                  >
                    <option value="">{t("Select triage level")}</option>
                    {TRIAGE_LEVELS.map((t) => (
                      <option key={t} value={t}>
                        {translateValue(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel text={t("Patient Name")} />
                  <input
                    className={inputClass}
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>

                <div className="space-y-3 rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-4">
                  <h3 className="text-sm font-black text-[#123746]">
                    {t("Location")}
                  </h3>

                  <ProjectLocationSelector
                    localized
                    locations={readProjectLocations(projectData)}
                    selectedId={selectedProjectLocation?.id || ""}
                    onSelect={(location) => {
                      setSelectedProjectLocation(location);
                      setLocationText(location.siteName);
                      setLat(location.lat);
                      setLng(location.lng);
                      setMapLink(`https://www.google.com/maps?q=${location.lat},${location.lng}`);
                      setIsFromMapLink(true);
                      setIsFromLocationSearch(false);
                    }}
                    onManual={() => {
                      setSelectedProjectLocation(null);
                      setLocationText("");
                      setMapLink("");
                      setLat(null);
                      setLng(null);
                      setIsFromMapLink(false);
                      setIsFromLocationSearch(false);
                    }}
                  />

                  <div>
                    <FieldLabel text={t("Search Location")} />
                    <LocationSearch localized onSelect={selectSearchedLocation} />
                  </div>

                  <div>
                    <FieldLabel text={t("Location Description *")} />
                    <input
                      className={inputClass}
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                    />
                  </div>

                  <div>
                    <FieldLabel text={t("Google Maps Link (Auto-Pin)")} />
                    <input
                      className={inputClass}
                      value={mapLink}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMapLink(value);

                        const coords = extractLatLngFromGoogleMaps(value);

                        if (coords) {
                          setLat(coords.lat);
                          setLng(coords.lng);
                          setIsFromMapLink(true);
                          setIsFromLocationSearch(false);
                        }
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className={`${inputClass} ${
                        isFromMapLink ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      placeholder={t("Latitude")}
                      disabled={isFromMapLink}
                      value={lat ?? ""}
                      onChange={(e) =>
                        setLat(e.target.value ? Number(e.target.value) : null)
                      }
                    />

                    <input
                      className={`${inputClass} ${
                        isFromMapLink ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      placeholder={t("Longitude")}
                      disabled={isFromMapLink}
                      value={lng ?? ""}
                      onChange={(e) =>
                        setLng(e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </div>

                  {googleMapLink && (
                    <a
                      href={googleMapLink}
                      target="_blank"
                      className="text-sm font-bold text-[#274C5A] underline"
                    >
                      {t("Open in Google Maps")}
                    </a>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-4">
                  <h3 className="text-sm font-black text-[#123746]">
                    {t("Assign Unit")}
                  </h3>

                  <div className="flex flex-wrap gap-3 text-sm font-bold text-[#274C5A]">
                    {availableUnitTypes.map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 rounded-full border border-[#c8dce2] bg-white px-3 py-2"
                      >
                        <input
                          type="radio"
                          checked={unitType === type}
                          onChange={() => {
                            setUnitType(type as UnitType);
                            setSelectedUnitId("");
                          }}
                        />
                        {translateValue(type)}
                      </label>
                    ))}
                  </div>

                  {unitType === "ambulance" && units.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {units.map((u) => {
                        const busy = isAmbulanceBusy(u);
                        const selected = selectedUnitId === u.id;

                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSelectedUnitId(u.id)}
                            className={`rounded-2xl border p-3 text-left transition ${
                              selected && busy
                                ? "border-red-500 bg-red-500/10"
                                : selected
                                ? "border-[#274C5A] bg-[#274C5A]/10"
                                : busy
                                ? "border-red-500/35 bg-red-500/8 hover:border-red-500"
                                : "border-[#d8e6ea] bg-white hover:border-[#74cdda]"
                            }`}
                          >
                            <div className="flex justify-between gap-2">
                              <span className="font-black text-[#123746]">
                                {u.code || u.id}
                              </span>

                              <span
                                className={`text-[10px] rounded-full px-2 py-0.5 ${
                                  busy
                                    ? "border border-red-500/25 bg-red-500/10 text-red-800"
                                    : "border border-emerald-500/25 bg-emerald-500/10 text-emerald-800"
                                }`}
                              >
                                {busy ? t("Busy") : t("Available")}
                              </span>
                            </div>

                            <div className="mt-1 text-xs font-semibold text-[#607482]">
                              {u.location || t("No location")}
                            </div>

                            {selected && busy && (
                              <div className="mt-2 text-xs font-bold text-red-800">
                                {t("Warning: this ambulance is currently busy, but you can still assign it.")}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {unitType !== "ambulance" && unitType && units.length > 0 && (
                    <select
                      className={inputClass}
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                    >
                      <option value="">{t("Select unit")}</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code || u.name || u.id}
                        </option>
                      ))}
                    </select>
                  )}

                  {unitType && units.length === 0 && (
                    <p className="text-sm font-semibold text-[#607482]">
                      {t("No units found for this project/type.")}
                    </p>
                  )}
                </div>

                <button
                  onClick={createCase}
                  disabled={saving}
                  className={`h-11 w-full rounded-2xl text-sm font-black text-white shadow-lg disabled:opacity-50 ${
                    selectedAmbulanceBusy
                      ? "bg-red-700 hover:bg-red-800"
                      : "bg-[#274C5A] hover:bg-[#1d3b47]"
                  }`}
                >
                  {saving ? t("Creating...") : t("Create Case")}
                </button>
              </>
            )}
          </div>

          <div className="h-[620px] overflow-hidden rounded-3xl border border-[#d8e6ea] bg-white shadow-sm">
            <Map
              caseLat={lat ?? undefined}
              caseLng={lng ?? undefined}
              caseName={locationText}
              ambulances={
                unitType === "ambulance" ? normalizeMapUnits(units) : []
              }
              clinics={unitType === "clinic" ? normalizeMapUnits(units) : []}
              roaming={unitType === "roaming" ? normalizeMapUnits(units) : []}
              centerLat={lat ?? undefined}
              centerLng={lng ?? undefined}
              showRecenterButton={true}
              recenterLabel={t("Back to location")}
            />
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
