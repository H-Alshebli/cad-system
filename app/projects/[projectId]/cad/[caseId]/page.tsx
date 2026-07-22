"use client";

import React, { useEffect, useState } from "react";
import CaseChat from "@/app/components/CaseChat";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

import StatusButtons from "@/app/components/StatusButtons";
import CaseTimeline from "@/app/components/CaseTimeline";
import { createEpcrFromCase, getEpcrByCaseId } from "@/lib/epcr";
import dynamic from "next/dynamic";
import { getCaseDisplayCode, getCaseDisplayTitle } from "@/lib/displayLabels";

const Map = dynamic(() => import("@/app/components/Map"), {
  ssr: false,
});


/* =============================
   TYPES
============================= */
type PatientInfo = {
  idNumber?: string;
  name?: string;
  age?: number | null;
  gender?: "male" | "female" | "";
  phone?: string;
  notes?: string;
};

type CaseInfo = {
  complaint?: string;
  level?: string;
  paramedicNote?: string;
};



type CaseType = {
  id: string;
  status: string;
  lazemCode?: string;
  timeline?: Record<string, any>;
  patient?: PatientInfo;
  caseInfo?: CaseInfo;

  location?: {
    lat: number;
    lng: number;
    address?: string;
  };

  destination?: {
    id: string;
    name: string;
    type: "hospital" | "clinic";
    lat: number;
    lng: number;
    address?: string;
  };

  projectHospitals?: Array<{
    id: string;
    name: string;
    type: "hospital" | "clinic";
    lat?: number | null;
    lng?: number | null;
    address?: string;
  }>;

  // legacy
  patientName?: string;
  contactNumber?: string;
  chiefComplaint?: string;
  level?: string;
};


/* =============================
   PAGE
============================= */
export default function CaseDetailsPage({
  params,
}: {
  params: { projectId: string; caseId: string };
}) {
  const { caseId } = params;
  const router = useRouter();
  const userId = "system-dev";

  const [caseData, setCaseData] = useState<CaseType | null>(null);
  const [loading, setLoading] = useState(true);
  const [epcr, setEpcr] = useState<any | null>(null);

  const [editPatient, setEditPatient] = useState(false);
  const [patientDraft, setPatientDraft] = useState<PatientInfo>({});

  const [editCaseInfo, setEditCaseInfo] = useState(false);
  const [caseInfoDraft, setCaseInfoDraft] = useState<CaseInfo>({
    complaint: "",
    level: "",
    paramedicNote: "",
  });



  /* -----------------------------
     LOAD CASE (Realtime)
  ------------------------------ */
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cases", caseId), (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        return;
      }

      const data = { id: snap.id, ...(snap.data() as any) };
      const patient = data.patient || {};
      const caseInfo = data.caseInfo || {};

      setCaseData({
        ...data,
        patient: {
          ...patient,
          name: patient.name || data.patientName || "",
          phone: patient.phone || data.contactNumber || "",
        },
        caseInfo: {
          complaint: caseInfo.complaint || data.chiefComplaint || "",
          level: caseInfo.level || data.level || "",
          paramedicNote: caseInfo.paramedicNote || "",
        },
      });

      setPatientDraft({
        ...patient,
        name: patient.name || data.patientName || "",
        phone: patient.phone || data.contactNumber || "",
      });

      setCaseInfoDraft({
        complaint: caseInfo.complaint || data.chiefComplaint || "",
        level: caseInfo.level || data.level || "",
        paramedicNote: caseInfo.paramedicNote || "",
      });

      setLoading(false);
    });

    return () => unsub();
  }, [caseId]);



  /* -----------------------------
     CHECK ePCR
  ------------------------------ */
  useEffect(() => {
    getEpcrByCaseId(caseId).then(setEpcr);
  }, [caseId]);

  /* -----------------------------
     SAFE LOADING GUARD (ONLY ONE)
  ------------------------------ */
  if (loading) {
    return (
      <div className="p-6 text-sm font-semibold text-[#7F7F7F]">
        Loading case...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-6 text-sm font-semibold text-red-700">
        Case not found
      </div>
    );
  }

  /* -----------------------------
     ACTIONS
  ------------------------------ */
  const handleEpcr = async () => {
    if (epcr) {
      router.push(`/epcr/${epcr.id}`);
      return;
    }
    const epcrId = await createEpcrFromCase(caseData, userId);
    router.push(`/epcr/${epcrId}`);
  };

  const savePatientInfo = async () => {
    await updateDoc(doc(db, "cases", caseId), { patient: patientDraft });
    setEditPatient(false);
  };

  const saveCaseInfo = async () => {
    await updateDoc(doc(db, "cases", caseId), { caseInfo: caseInfoDraft });
    setEditCaseInfo(false);
  };

  const cardClass =
    "rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5";
  const primaryButtonClass =
    "rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#274C5A] shadow-sm transition hover:bg-[#f8fbfc]";


  /* =============================
     RENDER
  ============================== */
  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#274C5A] p-5 text-white shadow-sm shadow-[#274C5A]/20 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide">
            Project CAD
          </div>
          <h1 className="text-xl font-black text-white">
            Case {getCaseDisplayCode(caseData)}
          </h1>
          <p className="mt-1 text-sm font-medium text-white/78">{getCaseDisplayTitle(caseData)}</p>
          <p className="mt-1 text-sm font-medium text-white/70">
            Status: <span className="font-black text-emerald-200">{caseData.status}</span>
          </p>
        </div>
        <button
          onClick={handleEpcr}
          className={primaryButtonClass}
        >
          {epcr ? "View ePCR" : "Create ePCR"}
        </button>
      </div>

      {/* STATUS + TIMELINE */}
      <div className={`${cardClass} space-y-4`}>
        <StatusButtons
  caseId={caseData.id}
  currentStatus={caseData.status}
  caseLocation={caseData.location}
  projectHospitals={caseData.projectHospitals || []}
  onDestinationSelected={(destination) => {
    setCaseData((prev) =>
      prev ? { ...prev, destination } : prev
    );
  }}
/>

        {caseData.timeline && (
          <CaseTimeline timeline={caseData.timeline} />
        )}
      </div>

      {/* PATIENT INFO */}
      <Section
        title="Patient Information"
        edit={editPatient}
        onEdit={() => setEditPatient(true)}
        onSave={savePatientInfo}
        onCancel={() => {
          setPatientDraft(caseData.patient || {});
          setEditPatient(false);
        }}
      >
        <Grid>
          <Field label="Patient ID" value={patientDraft.idNumber} edit={editPatient}
            onChange={(v) => setPatientDraft({ ...patientDraft, idNumber: v })} />
          <Field label="Name" value={patientDraft.name} edit={editPatient}
            onChange={(v) => setPatientDraft({ ...patientDraft, name: v })} />
          <Field label="Age" type="number" value={patientDraft.age} edit={editPatient}
            onChange={(v) =>
              setPatientDraft({ ...patientDraft, age: v ? Number(v) : null })
            } />
          <Field label="Phone" value={patientDraft.phone} edit={editPatient}
            onChange={(v) => setPatientDraft({ ...patientDraft, phone: v })} />
        </Grid>
      </Section>

      {/* CASE INFO */}
      <Section
        title="Case Information"
        edit={editCaseInfo}
        onEdit={() => setEditCaseInfo(true)}
        onSave={saveCaseInfo}
        onCancel={() => setEditCaseInfo(false)}
      >
        <Grid>
          <Field label="Chief Complaint" value={caseInfoDraft.complaint} edit={editCaseInfo} colSpan
            onChange={(v) => setCaseInfoDraft({ ...caseInfoDraft, complaint: v })} />
          <Field label="Triage Level" value={caseInfoDraft.level} edit={editCaseInfo}
            onChange={(v) => setCaseInfoDraft({ ...caseInfoDraft, level: v })} />
        </Grid>
      </Section>
      {/* PATIENT LOCATION */}
{caseData.location && (
  <div className={cardClass}>
    <h3 className="mb-3 text-sm font-black text-[#274C5A]">
      Patient Location
    </h3>

    <div className="h-[350px] w-full overflow-hidden rounded-xl border border-[#86A7B2]/25">
<Map
  caseLat={caseData.location.lat}
  caseLng={caseData.location.lng}
  caseName={caseData.patient?.name || "Patient"}
  centerLat={caseData.location.lat}
  centerLng={caseData.location.lng}
/>



    </div>
  </div>
)}
{/* DESTINATION LOCATION */}
{caseData.destination && caseData.location && (
  <div className={cardClass}>
    <h3 className="mb-3 text-sm font-black text-[#274C5A]">
      Destination ({caseData.destination.type})
    </h3>

    <div className="h-[350px] w-full overflow-hidden rounded-xl border border-[#86A7B2]/25">
      <Map
        caseLat={caseData.location.lat}
        caseLng={caseData.location.lng}
        caseName={caseData.patient?.name || "Patient"}
        clinics={[
          {
            id: caseData.destination.id,
            name: caseData.destination.name,
            lat: caseData.destination.lat,
            lng: caseData.destination.lng,
          },
        ]}
        centerLat={caseData.destination.lat}
        centerLng={caseData.destination.lng}
      />
    </div>
  </div>
)}

{/* CASE CHAT */}
<CaseChat
  caseId={caseId}
  disabled={caseData.status === "Closed"}
/>



    </div>
  );
}



/* =============================
   UI HELPERS
============================= */
type SectionProps = {
  title: string;
  edit: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
};

function Section({ title, edit, onEdit, onSave, onCancel, children }: SectionProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5">
      <div className="flex justify-between gap-3">
        <h3 className="text-sm font-black text-[#274C5A]">{title}</h3>
        {!edit ? (
          <button onClick={onEdit} className="text-xs font-black text-[#274C5A]">Edit</button>
        ) : (
          <div className="flex gap-3 text-xs font-black">
            <button onClick={onSave} className="text-emerald-700">Save</button>
            <button onClick={onCancel} className="text-[#7F7F7F]">Cancel</button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  value,
  edit,
  type = "text",
  colSpan,
  onChange,
}: {
  label: string;
  value?: string | number | null;
  edit: boolean;
  type?: "text" | "number";
  colSpan?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={colSpan ? "col-span-2" : ""}>
      <label className="text-sm font-bold text-[#7F7F7F]">{label}</label>
      {edit ? (
        <input
          type={type}
          className="mt-1 w-full rounded-xl border border-[#86A7B2]/35 bg-white px-3 py-2 text-[#274C5A] outline-none transition focus:border-[#274C5A] focus:ring-4 focus:ring-[#274C5A]/10"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className="text-[#274C5A]">{value || "-"}</p>
      )}
    </div>
  );
}
