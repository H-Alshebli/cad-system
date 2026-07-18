"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CaseTimeline from "@/app/components/CaseTimeline";
import CaseChat from "@/app/components/CaseChat";
import StatusButtons from "@/app/components/StatusButtons";
import { createEpcrFromCase, getEpcrByCaseId } from "@/lib/epcr";
import { createReturnCadCaseFromB2CRequest } from "@/lib/b2cRequests";
import { getCaseDisplayCode, getCaseDisplayTitle, getUnitDisplayName } from "@/lib/displayLabels";
import {
  Activity,
  ArrowLeft,
  CreditCard,
  ExternalLink,
  MapPin,
  ShieldCheck,
  UserRound,
  Navigation,
} from "lucide-react";

const Map = dynamic(() => import("@/app/components/Map"), { ssr: false });

type PatientInfo = {
  idNumber?: string;
  name?: string;
  age?: number | null;
  gender?: string;
  phone?: string;
  notes?: string;
};

type CaseInfo = {
  complaint?: string;
  level?: string;
  paramedicNote?: string;
};

type NormalizedLocation = {
  text?: string;
  googleMapLink?: string;
  lat?: number;
  lng?: number;
};

function toNumber(value: any): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizePatient(data: any): PatientInfo {
  return {
    ...(data.patient || {}),
    name:
      data.patient?.name ||
      data.patientName ||
      data.customer?.name ||
      data.customerName ||
      "",
    phone:
      data.patient?.phone ||
      data.contactNumber ||
      data.customer?.mobile ||
      data.customerMobile ||
      "",
    idNumber:
      data.patient?.idNumber ||
      data.patientIdOrIqama ||
      data.idNumber ||
      "",
    age: data.patient?.age || data.patientAge || null,
    gender: data.patient?.gender || data.patientGender || "",
    notes:
      data.patient?.notes ||
      data.patientCondition ||
      data.caseInfo?.paramedicNote ||
      data.paramedicNote ||
      "",
  };
}

function normalizeCaseInfo(data: any): CaseInfo {
  return {
    ...(data.caseInfo || {}),
    complaint:
      data.caseInfo?.complaint ||
      data.chiefComplaint ||
      data.diagnosisOrReason ||
      data.serviceType ||
      "",
    level: data.caseInfo?.level || data.level || data.triageLevel || "",
    paramedicNote:
      data.caseInfo?.paramedicNote || data.paramedicNote || "",
  };
}

function normalizePickupLocation(data: any): NormalizedLocation {
  const nested = data.location || data.pickup || {};

  return {
    text:
      nested.text ||
      data.locationText ||
      data.pickupText ||
      data.pickupLocation ||
      data.pickupLocationName ||
      "",
    googleMapLink:
      nested.googleMapLink ||
      data.googleMapLink ||
      data.pickupMapLink ||
      data.pickupLocationLink ||
      "",
    lat:
      toNumber(nested.lat) ||
      toNumber(data.lat) ||
      toNumber(data.pickupLat),
    lng:
      toNumber(nested.lng) ||
      toNumber(data.lng) ||
      toNumber(data.pickupLng),
  };
}

function normalizeDestinationLocation(data: any): NormalizedLocation {
  const nested = data.destination || {};

  return {
    text:
      nested.hospitalName ||
      nested.name ||
      nested.text ||
      data.destinationHospitalName ||
      data.destinationText ||
      data.destinationName ||
      data.destinationLocation ||
      data.destinationLocationName ||
      "",
    googleMapLink:
      nested.googleMapLink ||
      data.destinationMapLink ||
      data.destinationLocationLink ||
      "",
    lat:
      toNumber(nested.lat) ||
      toNumber(data.destinationLat),
    lng:
      toNumber(nested.lng) ||
      toNumber(data.destinationLng),
  };
}

export default function CaseDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const caseId = params.id;
  const router = useRouter();

  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [epcr, setEpcr] = useState<any | null>(null);
  const [creatingReturnCad, setCreatingReturnCad] = useState(false);

  const [editPatient, setEditPatient] = useState(false);
  const [editCaseInfo, setEditCaseInfo] = useState(false);

  const [patientDraft, setPatientDraft] = useState<PatientInfo>({});
  const [caseInfoDraft, setCaseInfoDraft] = useState<CaseInfo>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cases", caseId), (snap) => {
      if (!snap.exists()) {
        setCaseData(null);
        setLoading(false);
        return;
      }

      const data = { id: snap.id, ...(snap.data() as any) };

      const patient = normalizePatient(data);
      const caseInfo = normalizeCaseInfo(data);
      const pickupLocation = normalizePickupLocation(data);
      const destinationLocation = normalizeDestinationLocation(data);

      const normalized = {
        ...data,
        patient,
        caseInfo,
        pickupLocation,
        destinationLocation,
      };

      setCaseData(normalized);
      setPatientDraft(patient);
      setCaseInfoDraft(caseInfo);
      setLoading(false);
    });

    return () => unsub();
  }, [caseId]);

  useEffect(() => {
    getEpcrByCaseId(caseId)
      .then(setEpcr)
      .catch(() => setEpcr(null));
  }, [caseId]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading case...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="page-shell">
        <div className="card-modern text-red-500">Case not found.</div>
      </div>
    );
  }

  const sourceType =
    caseData.sourceType || (caseData.projectId ? "PROJECT" : "GENERAL");

  const acknowledged =
    caseData.acknowledgement?.acknowledged || caseData.acknowledged;

  const pickupLocation = caseData.pickupLocation;
  const destinationLocation = caseData.destinationLocation;

  const canCreateReturnCad =
    sourceType === "B2C" &&
    caseData.tripType === "Round Trip" &&
    caseData.tripLeg === "outbound" &&
    caseData.status === "Closed" &&
    !!caseData.b2cRequestId &&
    !caseData.linkedReturnCaseId &&
    !caseData.returnCadCaseId;

  async function handleEpcr() {
    if (epcr) {
      router.push(`/epcr/${epcr.id}`);
      return;
    }

    const epcrId = await createEpcrFromCase(caseData, "system-dev");

    await updateDoc(doc(db, "cases", caseId), {
      epcrId,
    });

    router.push(`/epcr/${epcrId}`);
  }

  async function handleCreateReturnCad() {
    if (!caseData?.b2cRequestId) {
      alert("B2C request ID is missing.");
      return;
    }

    if (!confirm("Create return CAD case for this round trip?")) {
      return;
    }

    setCreatingReturnCad(true);

    try {
      const returnCaseId = await createReturnCadCaseFromB2CRequest(
        caseData.b2cRequestId,
        "dispatch"
      );

      router.push(`/cases/${returnCaseId}`);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to create return CAD case.");
    } finally {
      setCreatingReturnCad(false);
    }
  }

  async function savePatientInfo() {
    await updateDoc(doc(db, "cases", caseId), {
      patient: patientDraft,
      patientName: patientDraft.name || "",
      contactNumber: patientDraft.phone || "",
      customerMobile: patientDraft.phone || "",
      patientIdOrIqama: patientDraft.idNumber || "",
      patientAge: patientDraft.age || "",
      patientGender: patientDraft.gender || "",
    });

    setEditPatient(false);
  }

  async function saveCaseInfo() {
    await updateDoc(doc(db, "cases", caseId), {
      caseInfo: caseInfoDraft,
      chiefComplaint: caseInfoDraft.complaint || "",
      level: caseInfoDraft.level || "",
      paramedicNote: caseInfoDraft.paramedicNote || "",
    });

    setEditCaseInfo(false);
  }

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-950 dark:text-white">
                Case {getCaseDisplayCode(caseData)}
              </h1>

              <Badge tone="blue">{sourceType}</Badge>

              {caseData.tripLeg && (
                <Badge tone="blue">
                  {caseData.tripLeg === "return" ? "Return Trip" : "Outbound"}
                </Badge>
              )}

              <Badge tone={caseData.status === "Closed" ? "slate" : "green"}>
                {caseData.status || "—"}
              </Badge>

              {acknowledged && <Badge tone="green">Acknowledged</Badge>}
            </div>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {getCaseDisplayTitle(caseData) ||
                (sourceType === "B2C"
                  ? caseData.customer?.name ||
                    caseData.customerName ||
                    caseData.callerName ||
                    "B2C Customer"
                  : caseData.projectName || "Project Case")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {caseData.missionLink && (
              <a
                href={caseData.missionLink}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <ExternalLink size={16} />
                Mission Link
              </a>
            )}

            <button
              onClick={handleEpcr}
              className="rounded-2xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700"
            >
              {epcr ? "View ePCR" : "Create ePCR"}
            </button>

            {canCreateReturnCad && (
              <button
                onClick={handleCreateReturnCad}
                disabled={creatingReturnCad}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {creatingReturnCad
                  ? "Creating Return CAD..."
                  : "Create Return CAD Case"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left Content */}
        <div className="space-y-6">
          <Section title="Status & Timeline" icon={<Activity size={18} />}>
            <StatusButtons
              caseId={caseData.id}
              currentStatus={caseData.status}
              caseLocation={pickupLocation}
              projectHospitals={caseData.projectHospitals || []}
              sourceType={sourceType}
              caseType={caseData.caseType}
              b2cDestination={caseData.destination}
              destinationHospitalName={caseData.destinationHospitalName}
              destinationText={caseData.destinationText}
              destinationMapLink={caseData.destinationMapLink}
              destinationLat={caseData.destinationLat}
              destinationLng={caseData.destinationLng}
              destinationFloor={caseData.destinationFloor}
              onDestinationSelected={() => {}}
            />

            {caseData.timeline && (
              <div className="mt-4">
                <CaseTimeline timeline={caseData.timeline} />
              </div>
            )}
          </Section>

          <EditableSection
            title="Patient Information"
            icon={<UserRound size={18} />}
            editing={editPatient}
            onEdit={() => setEditPatient(true)}
            onSave={savePatientInfo}
            onCancel={() => {
              setPatientDraft(normalizePatient(caseData));
              setEditPatient(false);
            }}
          >
            <Grid>
              <Field
                label="Name"
                value={patientDraft.name}
                edit={editPatient}
                onChange={(v) =>
                  setPatientDraft({ ...patientDraft, name: v })
                }
              />

              <Field
                label="Phone"
                value={patientDraft.phone}
                edit={editPatient}
                onChange={(v) =>
                  setPatientDraft({ ...patientDraft, phone: v })
                }
              />

              <Field
                label="ID Number"
                value={patientDraft.idNumber}
                edit={editPatient}
                onChange={(v) =>
                  setPatientDraft({ ...patientDraft, idNumber: v })
                }
              />

              <Field
                label="Age"
                value={patientDraft.age}
                edit={editPatient}
                type="number"
                onChange={(v) =>
                  setPatientDraft({
                    ...patientDraft,
                    age: v ? Number(v) : null,
                  })
                }
              />

              <Field
                label="Gender"
                value={patientDraft.gender}
                edit={editPatient}
                onChange={(v) =>
                  setPatientDraft({ ...patientDraft, gender: v })
                }
              />

              <Field
                label="Notes"
                value={patientDraft.notes}
                edit={editPatient}
                colSpan
                onChange={(v) =>
                  setPatientDraft({ ...patientDraft, notes: v })
                }
              />
            </Grid>
          </EditableSection>

          <EditableSection
            title="Case Information"
            icon={<ShieldCheck size={18} />}
            editing={editCaseInfo}
            onEdit={() => setEditCaseInfo(true)}
            onSave={saveCaseInfo}
            onCancel={() => {
              setCaseInfoDraft(normalizeCaseInfo(caseData));
              setEditCaseInfo(false);
            }}
          >
            <Grid>
              <Field
                label="Chief Complaint / Service"
                value={caseInfoDraft.complaint}
                edit={editCaseInfo}
                colSpan
                onChange={(v) =>
                  setCaseInfoDraft({ ...caseInfoDraft, complaint: v })
                }
              />

              <Field
                label="Triage Level"
                value={caseInfoDraft.level}
                edit={editCaseInfo}
                onChange={(v) =>
                  setCaseInfoDraft({ ...caseInfoDraft, level: v })
                }
              />

              <Field
                label="Paramedic Note"
                value={caseInfoDraft.paramedicNote}
                edit={editCaseInfo}
                colSpan
                onChange={(v) =>
                  setCaseInfoDraft({ ...caseInfoDraft, paramedicNote: v })
                }
              />
            </Grid>
          </EditableSection>

          <Section title="Case Chat" icon={<ShieldCheck size={18} />}>
            <CaseChat
              caseId={caseId}
              disabled={caseData.status === "Closed"}
            />
          </Section>
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          <Section title="Dispatch Summary" icon={<AmbulanceIcon />}>
            <Info label="Source" value={sourceType} />
            <Info
              label="Trip Type"
              value={
                caseData.tripType
                  ? `${caseData.tripType}${
                      caseData.tripLeg ? ` / ${caseData.tripLeg}` : ""
                    }`
                  : "—"
              }
            />
            <Info label="Project" value={caseData.projectName || "—"} />
            <Info
              label="Customer"
              value={
                caseData.customer?.name ||
                caseData.customerName ||
                caseData.callerName ||
                "—"
              }
            />
            <Info
              label="Unit"
              value={
                caseData.ambulanceCode ||
                caseData.assignedUnit?.code ||
                caseData.assignedUnit?.unitCode ||
                caseData.assignedUnit?.id ||
                "—"
              }
            />

            {sourceType === "B2C" && (
              <Info
                label="Destination Hospital"
                value={
                  caseData.destinationHospitalName ||
                  caseData.destination?.hospitalName ||
                  caseData.destination?.name ||
                  caseData.destinationText ||
                  "—"
                }
              />
            )}

            {sourceType === "B2C" && caseData.tripType === "Round Trip" && (
              <Info
                label="Return CAD"
                value={
                  caseData.linkedReturnCaseId ||
                  caseData.returnCadCaseId ||
                  "Not Created"
                }
              />
            )}

            <Info
              label="Payment"
              value={
                caseData.paymentStatus ||
                (sourceType === "B2C" ? "—" : "Contract / N/A")
              }
            />

            {acknowledged && (
              <Info
                label="Acknowledged By"
                value={
                  caseData.acknowledgement?.acknowledgedBy ||
                  caseData.acknowledgedBy ||
                  "—"
                }
              />
            )}
          </Section>

          {sourceType === "B2C" && (
            <Section title="B2C Payment" icon={<CreditCard size={18} />}>
              <Info label="Payment Status" value={caseData.paymentStatus || "—"} />
              <Info
                label="Price"
                value={caseData.price ? `${caseData.price} SAR` : "—"}
              />
              <Info label="Payer" value={caseData.payer || "—"} />
              <Info
                label="Payment Link Sent"
                value={caseData.paymentLinkSentAt || "—"}
              />
            </Section>
          )}

          <Section title="Pickup Location" icon={<MapPin size={18} />}>
            <LocationBlock
              title="Pickup"
              location={pickupLocation}
              mapName={patientDraft.name || "Pickup Location"}
            />
          </Section>

          <Section title="Destination Location" icon={<Navigation size={18} />}>
            <LocationBlock
              title="Destination"
              location={destinationLocation}
              mapName={destinationLocation?.text || "Destination"}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
      <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
        <span className="text-blue-500">{icon}</span>
        {title}
      </div>

      {children}
    </div>
  );
}

function EditableSection({
  title,
  icon,
  editing,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
          <span className="text-blue-500">{icon}</span>
          {title}
        </div>

        {!editing ? (
          <button
            onClick={onEdit}
            className="text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-3 text-sm font-bold">
            <button
              onClick={onSave}
              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-300"
            >
              Save
            </button>

            <button onClick={onCancel} className="text-slate-500">
              Cancel
            </button>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Field({
  label,
  value,
  edit,
  onChange,
  type = "text",
  colSpan,
}: {
  label: string;
  value?: any;
  edit: boolean;
  onChange: (value: string) => void;
  type?: string;
  colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "md:col-span-2" : ""}>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </label>

      {edit ? (
        <input
          type={type}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className="mt-1 font-semibold text-slate-900 dark:text-white">
          {value || "—"}
        </p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
        {value || "—"}
      </div>
    </div>
  );
}

function LocationBlock({
  title,
  location,
  mapName,
}: {
  title: string;
  location?: NormalizedLocation;
  mapName: string;
}) {
  const hasCoords =
    typeof location?.lat === "number" && typeof location?.lng === "number";

  return (
    <div>
      <Info label={title} value={location?.text || "—"} />

      {location?.googleMapLink && (
        <a
          href={location.googleMapLink}
          target="_blank"
          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-300"
        >
          <ExternalLink size={15} />
          Open Google Maps
        </a>
      )}

      {hasCoords && (
        <div className="mt-4 h-[260px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <Map
            caseLat={location.lat!}
            caseLng={location.lng!}
            caseName={mapName}
            ambulances={[]}
          />
        </div>
      )}

      {!hasCoords && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          No coordinates available for this location.
        </div>
      )}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "blue" | "green" | "slate";
}) {
  const cls =
    tone === "blue"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
      : tone === "green"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "bg-slate-500/10 text-slate-600 dark:text-slate-300";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${cls}`}
    >
      {children}
    </span>
  );
}

function AmbulanceIcon() {
  return <span>🚑</span>;
}
