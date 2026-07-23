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
  <label className="mb-1 block text-sm font-black text-[#274C5A]">{text}</label>
);

const inputClass =
  "w-full h-11 rounded-xl border border-[#c8dce2] bg-[#f7fbfc] px-3 text-sm font-semibold text-[#123746] outline-none transition placeholder:text-[#8aa0aa] focus:border-[#74cdda] focus:bg-white focus:ring-4 focus:ring-[#74cdda]/20 disabled:bg-[#edf3f5] disabled:text-[#607482]";

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

          <div className="space-y-3 rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-4">
            <h3 className="text-sm font-black text-[#123746]">Location</h3>
            <div><FieldLabel text="Location Description *" /><input className={inputClass} value={locationText} onChange={(e) => setLocationText(e.target.value)} /></div>
            <div><FieldLabel text="Google Maps Link (Auto-Pin)" /><input className={inputClass} value={mapLink} onChange={(e) => { const value = e.target.value; setMapLink(value); const coords = extractLatLngFromGoogleMaps(value); if (coords) { setLat(coords.lat); setLng(coords.lng); setIsFromMapLink(true); } }} /></div>
            <div className="grid grid-cols-2 gap-3">
              <input className={`${inputClass} ${isFromMapLink ? "opacity-50 cursor-not-allowed" : ""}`} placeholder="Latitude" disabled={isFromMapLink} value={lat ?? ""} onChange={(e) => setLat(e.target.value ? Number(e.target.value) : null)} />
              <input className={`${inputClass} ${isFromMapLink ? "opacity-50 cursor-not-allowed" : ""}`} placeholder="Longitude" disabled={isFromMapLink} value={lng ?? ""} onChange={(e) => setLng(e.target.value ? Number(e.target.value) : null)} />
            </div>
            {googleMapLink && <a href={googleMapLink} target="_blank" className="text-sm font-black text-[#166575] underline">Open in Google Maps</a>}
          </div>

          <div className="space-y-3 rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-4">
            <h3 className="text-sm font-black text-[#123746]">Assign Unit</h3>
            <div className="flex gap-6 text-sm font-semibold text-[#274C5A]">
              {["ambulance", "clinic", "roaming"].map((t) => <label key={t} className="flex items-center gap-2"><input type="radio" checked={unitType === t} onChange={() => { setUnitType(t as any); setSelectedUnitId(""); }} />{t}</label>)}
            </div>

            {unitType === "ambulance" && units.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {units.map((u) => {
                  const busy = isAmbulanceBusy(u);
                  const selected = selectedUnitId === u.id;
                  return (
                    <button key={u.id} type="button" onClick={() => setSelectedUnitId(u.id)} className={`rounded-2xl border p-3 text-left transition ${selected && busy ? "border-[#b42318] bg-[#fff1f1]" : selected ? "border-[#74cdda] bg-[#effbfc]" : busy ? "border-[#ffc9c9] bg-[#fff8f8] hover:border-[#b42318]" : "border-[#d8e6ea] bg-white hover:border-[#74cdda]"}`}>
                      <div className="flex justify-between gap-2"><span className="font-black text-[#123746]">{u.code || u.id}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${busy ? "bg-[#ffe3e3] text-[#b42318]" : "bg-[#dff8ed] text-[#137a4a]"}`}>{busy ? "Busy" : "Available"}</span></div>
                      <div className="mt-1 text-xs font-semibold text-[#607482]">{u.location || "No location"}</div>
                      {selected && busy && <div className="mt-2 text-xs font-black text-[#b42318]">Warning: this ambulance is currently busy, but you can still assign it.</div>}
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

            {unitType && units.length === 0 && <p className="text-sm font-semibold text-[#607482]">No units found for this project/type.</p>}
          </div>

          <button onClick={createCase} className={`h-11 w-full rounded-xl text-sm font-black text-white shadow-lg transition ${selectedAmbulanceBusy ? "bg-[#b42318] shadow-[#b42318]/15 hover:bg-[#912018]" : "bg-[#274C5A] shadow-[#274C5A]/15 hover:bg-[#1d3b47]"}`}>Create Case</button>
        </div>

        <div className="h-[520px] overflow-hidden rounded-2xl border border-[#d8e6ea] bg-white shadow-sm">
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
