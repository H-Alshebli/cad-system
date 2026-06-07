"use client";

import { useState, useEffect, useMemo } from "react";
import { addDoc, collection, serverTimestamp, Timestamp, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

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

const FieldLabel = ({ text }: { text: string }) => (
  <label className="text-sm text-gray-300 font-medium mb-1 block">{text}</label>
);

const inputClass = "w-full h-11 px-3 rounded bg-[#0f1625] text-white border border-gray-700 focus:outline-none focus:border-blue-500";

function extractLatLngFromGoogleMaps(url: string) {
  const patterns = [/q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/, /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
  }
  return null;
}

function isAmbulanceBusy(amb: any) {
  const status = String(amb.status || "").toLowerCase();
  return status !== "available" || !!amb.currentCase || !!amb.currentCaseId;
}
function getProjectAmbulanceIds(projectData: any) {
  const idsFromAssignedAmbulanceIds = Array.isArray(projectData?.assignedAmbulanceIds)
    ? projectData.assignedAmbulanceIds
    : [];

  const idsFromAssignedAmbulances = Array.isArray(projectData?.assignedAmbulances)
    ? projectData.assignedAmbulances
        .map((a: any) => a?.id)
        .filter(Boolean)
    : [];

  return Array.from(
    new Set([...idsFromAssignedAmbulanceIds, ...idsFromAssignedAmbulances])
  );
}

export default function NewProjectCasePage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const [receivedAt, setReceivedAt] = useState<Timestamp | null>(null);
  const [projectData, setProjectData] = useState<any>(null);

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

  const [unitType, setUnitType] = useState<"ambulance" | "clinic" | "roaming" | "">("ambulance");
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");

  useEffect(() => setReceivedAt(Timestamp.now()), []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "projects", params.projectId), (snap) => {
      if (snap.exists()) setProjectData({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [params.projectId]);

 useEffect(() => {
  if (!unitType) {
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
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (unitType === "ambulance") {
      const projectAmbulanceIds = getProjectAmbulanceIds(projectData);

      list = list.filter((item: any) => {
        if (item.archived) return false;

        const itemAssignedProjectId =
          item.assignedProjectId || item.projectId || null;

        const isInProjectList = projectAmbulanceIds.includes(item.id);
        const isLinkedToProject = itemAssignedProjectId === params.projectId;

        return isInProjectList || isLinkedToProject;
      });
    } else if (unitType === "clinic") {
      const projectHospitalIds = Array.isArray(projectData?.projectHospitalIds)
        ? projectData.projectHospitalIds
        : [];

      const projectHospitals = Array.isArray(projectData?.projectHospitals)
        ? projectData.projectHospitals
        : [];

      const projectClinicIds = projectHospitals
        .filter((h: any) => String(h.type || "").toLowerCase() === "clinic")
        .map((h: any) => h.id)
        .filter(Boolean);

      const allowedClinicIds = Array.from(
        new Set([...projectHospitalIds, ...projectClinicIds])
      );

      list = list.filter((item: any) => {
        if (item.archived) return false;

        const isClinic = String(item.type || "").toLowerCase() === "clinic";

        if (!isClinic) return false;

        if (allowedClinicIds.length === 0) return true;

        return allowedClinicIds.includes(item.id);
      });
    } else {
      list = list.filter((item: any) => !item.archived);
    }

    setUnits(list);

    if (selectedUnitId && !list.some((u: any) => u.id === selectedUnitId)) {
      setSelectedUnitId("");
    }
  });

  return () => unsub();
}, [
  unitType,
  projectData,
  params.projectId,
  selectedUnitId,
]);

  const googleMapLink = lat !== null && lng !== null ? `https://www.google.com/maps?q=${lat},${lng}` : null;
  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedUnitId), [units, selectedUnitId]);
  const selectedAmbulanceBusy = unitType === "ambulance" && selectedUnit ? isAmbulanceBusy(selectedUnit) : false;

  const createCase = async () => {
    if (!chiefComplaint || !triageLevel || !locationText || !selectedUnitId) {
      alert("Please complete chief complaint, triage, location, and unit.");
      return;
    }

    const projectRef = doc(db, "projects", params.projectId);
    const projectSnap = await getDoc(projectRef);
    const project = projectSnap.exists() ? projectSnap.data() : projectData;

    const caseRef = await addDoc(collection(db, "cases"), {
      sourceType: "PROJECT",
      sourceId: params.projectId,
      projectId: params.projectId,
      projectName: project?.projectName ?? project?.name ?? project?.title ?? "Unknown Project",
      projectHospitals: Array.isArray(project?.projectHospitals) ? project.projectHospitals : [],
      projectHospitalIds: Array.isArray(project?.projectHospitalIds) ? project.projectHospitalIds : [],
      callerName,
      contactNumber,
      chiefComplaint: chiefComplaint === "Other" ? otherComplaint : chiefComplaint,
      level: triageLevel,
      patientName,
      location: { text: locationText, lat, lng, googleMapLink, source: isFromMapLink ? "google_link" : "manual" },
      locationText,
      paymentStatus: "NotRequired",
      dispatchStatus: "Assigned",
      assignedUserIds: [],
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      assignedUnit: {
        type: unitType,
        id: selectedUnitId,
        code: selectedUnit?.code || selectedUnit?.name || null,
        wasBusyWhenSelected: selectedAmbulanceBusy,
      },
      status: "Assigned",
      timeline: {
        receivedAt,
        assignedAt: serverTimestamp(),
        enRouteAt: null,
        onSceneAt: null,
        transportingAt: null,
        hospitalAt: null,
        closedAt: null,
      },
      createdAt: serverTimestamp(),
    });
if (unitType === "ambulance") {
  const projectName =
    project?.projectName ??
    project?.name ??
    project?.title ??
    project?.clientName ??
    project?.client ??
    "Unknown Project";

  await updateDoc(doc(db, "ambulances", selectedUnitId), {
    currentCase: caseRef.id,
    currentCaseId: caseRef.id,

    assignedProjectId: params.projectId,
    assignedProjectName: projectName,

    // compatibility fields
    projectId: params.projectId,
    projectName,

    status: "busy",
    updatedAt: serverTimestamp(),
  });
}

    router.push(`/cases/${caseRef.id}`);
  };

  return (
    <div className="page-shell">
      <div className="page-header"><div><h1 className="page-title">New Case (Project)</h1><p className="page-subtitle">Project case form launched from Call Intake. The case will open directly after creation.</p></div></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-modern space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><FieldLabel text="Caller Name" /><input className={inputClass} value={callerName} onChange={(e) => setCallerName(e.target.value)} /></div>
            <div><FieldLabel text="Contact Number" /><input className={inputClass} value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} /></div>
          </div>

          <div>
            <FieldLabel text="Prehospital Chief Complaints *" />
            <select className={inputClass} value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)}>
              <option value="">Select complaint</option>
              {CHIEF_COMPLAINT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {chiefComplaint === "Other" && <input className={`${inputClass} mt-2`} placeholder="Specify other complaint" value={otherComplaint} onChange={(e) => setOtherComplaint(e.target.value)} />}
          </div>

          <div>
            <FieldLabel text="Prehospital Triage Color-Coded Scale *" />
            <select className={inputClass} value={triageLevel} onChange={(e) => setTriageLevel(e.target.value)}>
              <option value="">Select triage level</option>
              {TRIAGE_LEVELS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div><FieldLabel text="Patient Name" /><input className={inputClass} value={patientName} onChange={(e) => setPatientName(e.target.value)} /></div>

          <div className="border border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Location</h3>
            <div><FieldLabel text="Location Description *" /><input className={inputClass} value={locationText} onChange={(e) => setLocationText(e.target.value)} /></div>
            <div><FieldLabel text="Google Maps Link (Auto-Pin)" /><input className={inputClass} value={mapLink} onChange={(e) => { const value = e.target.value; setMapLink(value); const coords = extractLatLngFromGoogleMaps(value); if (coords) { setLat(coords.lat); setLng(coords.lng); setIsFromMapLink(true); } }} /></div>
            <div className="grid grid-cols-2 gap-3">
              <input className={`${inputClass} ${isFromMapLink ? "opacity-50 cursor-not-allowed" : ""}`} placeholder="Latitude" disabled={isFromMapLink} value={lat ?? ""} onChange={(e) => setLat(e.target.value ? Number(e.target.value) : null)} />
              <input className={`${inputClass} ${isFromMapLink ? "opacity-50 cursor-not-allowed" : ""}`} placeholder="Longitude" disabled={isFromMapLink} value={lng ?? ""} onChange={(e) => setLng(e.target.value ? Number(e.target.value) : null)} />
            </div>
            {googleMapLink && <a href={googleMapLink} target="_blank" className="text-sm text-blue-400 underline">Open in Google Maps</a>}
          </div>

          <div className="border border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Assign Unit</h3>
            <div className="flex gap-6 text-white text-sm">
              {["ambulance", "clinic", "roaming"].map((t) => <label key={t} className="flex items-center gap-2"><input type="radio" checked={unitType === t} onChange={() => { setUnitType(t as any); setSelectedUnitId(""); }} />{t}</label>)}
            </div>

            {unitType === "ambulance" && units.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {units.map((u) => {
                  const busy = isAmbulanceBusy(u);
                  const selected = selectedUnitId === u.id;
                  return (
                    <button key={u.id} type="button" onClick={() => setSelectedUnitId(u.id)} className={`rounded-lg border p-3 text-left transition ${selected && busy ? "border-red-500 bg-red-950/40" : selected ? "border-blue-500 bg-blue-500/15" : busy ? "border-red-700 bg-red-950/20 hover:border-red-500" : "border-gray-700 bg-[#0f1625] hover:border-blue-500"}`}>
                      <div className="flex justify-between gap-2"><span className="font-semibold text-white">{u.code || u.id}</span><span className={`text-[10px] rounded-full px-2 py-0.5 ${busy ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"}`}>{busy ? "Busy" : "Available"}</span></div>
                      <div className="mt-1 text-xs text-gray-400">{u.location || "No location"}</div>
                      {selected && busy && <div className="mt-2 text-xs font-semibold text-red-300">Warning: this ambulance is currently busy, but you can still assign it.</div>}
                    </button>
                  );
                })}
              </div>
            )}

            {unitType !== "ambulance" && unitType && units.length > 0 && (
              <select className={inputClass} value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
                <option value="">Select unit</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.code || u.name || u.id}</option>)}
              </select>
            )}

            {unitType && units.length === 0 && <p className="text-sm text-gray-400">No units found for this project/type.</p>}
          </div>

          <button onClick={createCase} className={`w-full h-11 rounded text-white font-semibold ${selectedAmbulanceBusy ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>Create Case</button>
        </div>

        <div className="h-[520px] border border-gray-700 rounded-lg overflow-hidden">
          <Map
            caseLat={lat ?? undefined}
            caseLng={lng ?? undefined}
            caseName={locationText}
            ambulances={unitType === "ambulance" ? units : []}
            clinics={unitType === "clinic" ? units : []}
            roaming={unitType === "roaming" ? units : []}
            centerLat={lat ?? undefined}
            centerLng={lng ?? undefined}
            showRecenterButton={true}
            recenterLabel="Back to location"
          />
        </div>
      </div>
    </div>
  );
}
