"use client";

import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import BodyPainSelector from "@/app/components/epcr/BodyPainSelector";


/* =========================
   TYPES
========================= */
const NATIONALITIES = [
  "Saudi",
  "Egyptian",
  "Indian",
  "Pakistani",
  "Bangladeshi",
  "Filipino",
  "Sudanese",
  "Yemeni",
  "Other",
] as const;

type Gender = "male" | "female" | "unknown";
type TriageColor = "Level 1 (Resuscitation)" | "Level 2 (Emergent)" | "Level 3 (Urgent)" | "Level 4 (Less Urgent)" | "Level 5 (non-urgent)" | "death";




type HealthClassification =
  | "Occupational"
  | "Non-Occupational"
  | "General Health Illnesses"
  | "Unspecified Medical Conditions"
  | "other";

type PatientInfo = {
  firstName: string;
  lastName: string;
  age: number | null;
  gender: Gender;
  phone?: string;
  weightKg?: number | null;
  factoryName?: string;
  nationality?: string;

  triageColor: TriageColor | "";
  healthClassification: HealthClassification | "";

  chiefComplaints: string[];
  signsAndSymptoms: string[];
};

type MedicalHistory = {
  conditions: string[];
  eyes: string[];
  other: string;
};

type HeadToToeExam = {
  generalAppearance: string;
  headNeck: string;
  chest: string;
  abdomen: string;
  backPelvis: string;
  extremities: string;
  other: string;
  painLocations: string[];
};

type YesNo = "yes" | "no" | "";

type VitalItem = {
  temp: string;
  hr: string;
  bp: string;
  spo2: string;
  gcs: string;
  bgl: string;
  time: {
    timeHHMM: string;
    ampm: "AM" | "PM" | "";
  };
};


type MedicationItem = {
  medication: string;
  other: string;
  qty: string;
};

type ConsumableItem = {
  consumable: string;
  other: string;
  qty: string;
};

type NarrativeVitals = {
  contactedMedicalDirector: YesNo;
  narrative: string;
  vitalsList: VitalItem[];
  medications: MedicationItem[];
  consumables: ConsumableItem[];
};


type Outcome = {
  destination: string;
  hospitalName: string;
  hospitalMember: string;
  hospitalSignatureDataUrl: string;
  patientSignatureDataUrl: string;
};

type TransferMember = {
  name: string;
  badgeNo: string;
  unit: string;
  position: string;
  signatureDataUrl: string;
};

type TransferTeam = {
  members: [TransferMember, TransferMember];
};

type TimeValue = {
  timeHHMM: string;
  ampm: "AM" | "PM" | "";
};

type TimeSection = {
  movingTime: TimeValue;
  leavingSceneTime: TimeValue;
  waitingTime: TimeValue;
  arrivalTime: TimeValue;
  arrivalToPTTime: TimeValue;
  hospitalTime: TimeValue;
  dischargeTime: TimeValue;
  backTime: TimeValue;
};

type EpcrDoc = {
  locked?: boolean;

  patientInfo?: PatientInfo;
  medicalHistory?: MedicalHistory;
  headToToe?: HeadToToeExam;
  narrativeVitals?: NarrativeVitals;
  outcome?: Outcome;
  transferTeam?: TransferTeam;
  time?: TimeSection;

  updatedAt?: unknown;
  finalizedAt?: unknown;
};

/* =========================
   FACTORIES
========================= */

const emptyPatientInfo = (): PatientInfo => ({
  firstName: "",
  lastName: "",
  age: null,
  gender: "unknown",
  phone: "",
  weightKg: null,
  factoryName: "",
  nationality: "",
  triageColor: "",
  healthClassification: "",
  chiefComplaints: [],
  signsAndSymptoms: [],
});

const emptyMedicalHistory = (): MedicalHistory => ({
  conditions: [],
  eyes: [],
  other: "",
});

const emptyHeadToToe = (): HeadToToeExam => ({
  generalAppearance: "",
  headNeck: "",
  chest: "",
  abdomen: "",
  backPelvis: "",
  extremities: "",
  other: "",
  painLocations: [],
});

const emptyVitalItem = (): VitalItem => ({
  temp: "",
  hr: "",
  bp: "",
  spo2: "",
  gcs: "",
  bgl: "",
  time: {
    timeHHMM: "",
    ampm: "",
  },
});


const emptyMedicationItem = (): MedicationItem => ({
  medication: "",
  other: "",
  qty: "",
});

const emptyConsumableItem = (): ConsumableItem => ({
  consumable: "",
  other: "",
  qty: "",
});

const emptyNarrativeVitals = (): NarrativeVitals => ({
  contactedMedicalDirector: "",
  narrative: "",
  vitalsList: [emptyVitalItem()],
  medications: [emptyMedicationItem()],
  consumables: [emptyConsumableItem()],
});


const emptyOutcome = (): Outcome => ({
  destination: "",
  hospitalName: "",
  hospitalMember: "",
  hospitalSignatureDataUrl: "",
  patientSignatureDataUrl: "",
});

const emptyTransferMember = (): TransferMember => ({
  name: "",
  badgeNo: "",
  unit: "",
  position: "",
  signatureDataUrl: "",
});

const emptyTransferTeam = (): TransferTeam => ({
  members: [emptyTransferMember(), emptyTransferMember()],
});

const emptyTimeValue = (): TimeValue => ({
  timeHHMM: "",
  ampm: "",
});

const emptyTime = (): TimeSection => ({
  movingTime: emptyTimeValue(),
  leavingSceneTime: emptyTimeValue(),
  waitingTime: emptyTimeValue(),
  arrivalTime: emptyTimeValue(),
  arrivalToPTTime: emptyTimeValue(),
  hospitalTime: emptyTimeValue(),
  dischargeTime: emptyTimeValue(),
  backTime: emptyTimeValue(),
});

/* =========================
   OPTIONS
========================= */

const MED_HISTORY_CONDITIONS = [
  "Cardiac",
  "Respiratory",
  "Stroke/TIA",
  "Seizures",
  "Not Determined",
  "Diabetes",
  "HTN",
  "Falls",
  "Cancer",
  "Psychiatric",
] as const;

const EYES_OPTIONS = ["Equal", "Light", "Reactive", "Non-Reactive"] as const;

const CHIEF_COMPLAINTS = [
  "Cardiac complaints",
  "Respiratory complaints",
  "Musculoskeletal complaints",
  "Digestive complaints",
  "Metabolic and endocrine complaints",
  "General medical complaints",
  "Environmental and toxicological complaints",
  "Obstetric and gynecology complaints",
  "Gastrointestinal complaints",
  "Behavioral and psychological complaints",
  "Infectious disease complaints",
  "Other critical complaints",
  "Other",
] as const;

const SIGNS_SYMPTOMS = [
  "Unconscious",
  "Breathing Difficulties",
  "Deaf",
  "Drainage/Discharge",
  "Vision Loss",
  "Pain",
  "Swelling",
  "Bleeding",
  "Choking",
  "Diarrhea",
  "Nausea/Vomiting",
  "Rash/Itching",
  "Wound",
  "None",
  "Hypertension",
  "Chest pain",
  "Loss/Weakness",
  "Fever/Cough",
  "Dizzy",
  "Metal/Pelvic",
  "Palpitations",
  "Shortness of breath",
  "Other",
] as const;

const DESTINATIONS = [
  "Emergency Room",
  "Clinic",
  "On Scene (No Transport)",
  "Other",
] as const;

const UNITS = ["Unit 1", "Unit 2", "Unit 3", "Other"] as const;
const POSITIONS = ["Paramedic", "EMT", "Nurse", "Doctor", "Other"] as const;

const MEDICATIONS_LIST = [
  "Oxygen",
  "IV Fluids",
  "Aspirin",
  "Nitroglycerin",
  "Epinephrine",
  "Other",
] as const;

const QTY_LIST = ["1", "2", "3", "4", "5", "Other"] as const;

const CONSUMABLES_LIST = [
  "Gauze",
  "Bandage",
  "Cannula",
  "Syringe",
  "Gloves",
  "Other",
] as const;

const BODY_AREAS = [
  "Head",
  "Neck",
  "Chest",
  "Back",
  "Abdomen",
  "Pelvis",
  "Left Arm",
  "Right Arm",
  "Left Leg",
  "Right Leg",
] as const;

/* =========================
   PAGE
========================= */

export default function EpcrPage({ params }: { params: { id: string } }) {
  const epcrId = params.id;
  const router = useRouter();

  const [data, setData] = useState<EpcrDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "epcr", epcrId);
    const unsub = onSnapshot(ref, (snap) => {
      setData(snap.exists() ? (snap.data() as EpcrDoc) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [epcrId]);

 const locked = data?.locked === true;

// controlled sections (آمنة حتى لو data = null)
const patientInfo = data?.patientInfo ?? emptyPatientInfo();
const medicalHistory = data?.medicalHistory ?? emptyMedicalHistory();
const headToToe = data?.headToToe ?? emptyHeadToToe();
const narrativeVitals = data?.narrativeVitals ?? emptyNarrativeVitals();
const outcome = data?.outcome ?? emptyOutcome();
const transferTeam = data?.transferTeam ?? emptyTransferTeam();
const time = data?.time ?? emptyTime();

const missing = useMemo(() => {
  if (!data) return [];

  const m: string[] = [];

  if (!patientInfo.firstName.trim()) m.push("Patient: First Name");
  if (!patientInfo.lastName.trim()) m.push("Patient: Last Name");
  if (!patientInfo.age || patientInfo.age <= 0) m.push("Patient: Age");
  if (!patientInfo.triageColor) m.push("Patient: Triage Color");
  if (!patientInfo.healthClassification) m.push("Patient: Health Classification");
  if (!patientInfo.chiefComplaints.length) m.push("Patient: Chief Complaints");
  if (!patientInfo.signsAndSymptoms.length) m.push("Patient: Signs & Symptoms");

  if (!narrativeVitals.contactedMedicalDirector)
    m.push("Narrative: Contacted Medical Director");
  if (!narrativeVitals.narrative.trim())
    m.push("Narrative: Narrative");

if (!narrativeVitals.vitalsList.length) {
  m.push("Vitals: At least one vital set required");
} else {
  narrativeVitals.vitalsList.forEach((v, i) => {
    const idx = i + 1;

    if (!v.hr.trim()) m.push(`Vitals #${idx}: HR`);
    if (!v.bp.trim()) m.push(`Vitals #${idx}: BP`);
    if (!v.spo2.trim()) m.push(`Vitals #${idx}: SpO2`);
  });
}


  if (!outcome.destination.trim()) m.push("Outcome: Destination");
  if (!outcome.hospitalName.trim()) m.push("Outcome: Hospital Name");
  if (!outcome.hospitalMember.trim()) m.push("Outcome: Hospital Member");
  if (!outcome.hospitalSignatureDataUrl)
    m.push("Outcome: Hospital Signature");

  transferTeam.members.forEach((mem, idx) => {
    const n = idx + 1;
    if (!mem.name.trim())
      m.push(`Transfer Team #${n}: Paramedic Name`);
    if (!mem.signatureDataUrl)
      m.push(`Transfer Team #${n}: Signature`);
  });

  if (!time.arrivalTime.timeHHMM || !time.arrivalTime.ampm)
    m.push("Time: Arrival Time");
  if (!time.movingTime.timeHHMM || !time.movingTime.ampm)
    m.push("Time: Moving Time");

  return m;
}, [data, patientInfo, narrativeVitals, outcome, transferTeam, time]);
  
if (loading) {
  return <div className="p-6 text-white">Loading ePCR...</div>;
}

if (!data) {
  return <div className="p-6 text-white">ePCR not found</div>;
}

  const canFinalize = missing.length === 0;

  const saveDraft = async () => {
    const ref = doc(db, "epcr", epcrId);
    await updateDoc(ref, {
      locked: false,
      patientInfo,
      medicalHistory,
      headToToe,
      narrativeVitals,
      outcome,
      transferTeam,
      time,
      updatedAt: new Date(),
    } satisfies EpcrDoc);

    alert("Saved");
  };

  const finalize = async () => {
    if (!canFinalize) {
      alert("Please complete required fields:\n\n- " + missing.join("\n- "));
      return;
    }

    const ref = doc(db, "epcr", epcrId);
    await updateDoc(ref, {
      locked: true,
      patientInfo,
      medicalHistory,
      headToToe,
      narrativeVitals,
      outcome,
      transferTeam,
      time,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    } satisfies EpcrDoc);

    alert("Finalized & Locked");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto text-white space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">ePCR</h1>
        {locked ? (
          <span className="text-sm px-3 py-1 rounded bg-green-700">Locked</span>
        ) : (
          <span className="text-sm px-3 py-1 rounded bg-yellow-700">Draft</span>
        )}
      </div>

      {!locked && missing.length > 0 && (
        <Section title="Missing Required Fields">
          <ul className="list-disc ml-6 text-sm text-yellow-200">
            {missing.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* ================= PATIENT INFORMATION ================= */}
      <Section title="Patient Information">
        <div className="grid grid-cols-2 gap-4">
          <Input
            disabled={locked}
            label="First Name *"
            value={patientInfo.firstName}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  firstName: e.target.value,
                },
              }))
            }
          />
          <Input
            disabled={locked}
            label="Last Name *"
            value={patientInfo.lastName}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  lastName: e.target.value,
                },
              }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            disabled={locked}
            label="Age *"
            type="number"
            value={patientInfo.age ?? ""}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  age: e.target.value === "" ? null : Number(e.target.value),
                },
              }))
            }
          />

          <Select
            disabled={locked}
            label="Gender *"
            value={patientInfo.gender}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  gender: e.target.value as Gender,
                },
              }))
            }
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="unknown">Unknown</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            disabled={locked}
            label="Phone Number"
            value={patientInfo.phone ?? ""}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  phone: e.target.value,
                },
              }))
            }
          />
          <Input
            disabled={locked}
            label="Weight (kg)"
            type="number"
            value={patientInfo.weightKg ?? ""}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  weightKg: e.target.value === "" ? null : Number(e.target.value),
                },
              }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            disabled={locked}
            label="Factory Name"
            value={patientInfo.factoryName ?? ""}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  factoryName: e.target.value,
                },
              }))
            }
          />
      <Select
  disabled={locked}
  label="Nationality"
  value={patientInfo.nationality ?? ""}
  onChange={(e) =>
    setData((prev) => ({
      ...(prev ?? {}),
      patientInfo: {
        ...(prev?.patientInfo ?? emptyPatientInfo()),
        nationality: e.target.value,
      },
    }))
  }
>
  {NATIONALITIES.map((n) => (
    <option key={n} value={n}>
      {n}
    </option>
  ))}
</Select>

        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            disabled={locked}
            label="Prehospital Triage Color-Coded Scale *"
            value={patientInfo.triageColor}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  triageColor: e.target.value as TriageColor,
                },
              }))
            }
          >
            <option value="Level 1 (Resuscitation)">Level 1 (Resuscitation)</option>
            <option value="Level 2 (Emergent)">Level 2 (Emergent)</option>
            <option value="Level 3 (Urgent)">Level 3 (Urgent)</option>
            <option value="Level 4 (Less Urgent)">Level 4 (Less Urgent)</option>
            <option value="Level 5 (non-urgent)">Level 5 (non-urgent)</option>
            <option value="death">death</option>
          </Select>

          <Select
            disabled={locked}
            label="Classification of Health Conditions *"
            value={patientInfo.healthClassification}
            onChange={(e) =>
              setData((prev) => ({
                ...(prev ?? {}),
                patientInfo: {
                  ...(prev?.patientInfo ?? emptyPatientInfo()),
                  healthClassification: e.target.value as HealthClassification,
                },
              }))
            }
          >
            <option value="Occupational">Occupational</option>
            <option value="Non-Occupational">Non-Occupational</option>
            <option value="General Health Illnesses">General Health Illnesses</option>
            <option value="Unspecified Medical Conditions">Unspecified Medical Conditions</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <MultiCheckbox
          disabled={locked}
          title="Prehospital Chief Complaints *"
          options={[...CHIEF_COMPLAINTS]}
          value={patientInfo.chiefComplaints}
          onChange={(vals) =>
            setData((prev) => ({
              ...(prev ?? {}),
              patientInfo: {
                ...(prev?.patientInfo ?? emptyPatientInfo()),
                chiefComplaints: vals,
              },
            }))
          }
        />

        <MultiCheckbox
          disabled={locked}
          title="Signs & Symptoms *"
          options={[...SIGNS_SYMPTOMS]}
          value={patientInfo.signsAndSymptoms}
          onChange={(vals) =>
            setData((prev) => ({
              ...(prev ?? {}),
              patientInfo: {
                ...(prev?.patientInfo ?? emptyPatientInfo()),
                signsAndSymptoms: vals,
              },
            }))
          }
        />
      </Section>

      {/* ================= RELEVANT MEDICAL HISTORY ================= */}
      <Section title="Relevant Medical History">
        <MultiCheckbox
          disabled={locked}
          title="Relevant Medical History"
          options={[...MED_HISTORY_CONDITIONS]}
          value={medicalHistory.conditions}
          onChange={(vals) =>
            setData((prev) => ({
              ...(prev ?? {}),
              medicalHistory: {
                ...(prev?.medicalHistory ?? emptyMedicalHistory()),
                conditions: vals,
              },
            }))
          }
        />

        <MultiCheckbox
          disabled={locked}
          title="Eyes"
          options={[...EYES_OPTIONS]}
          value={medicalHistory.eyes}
          onChange={(vals) =>
            setData((prev) => ({
              ...(prev ?? {}),
              medicalHistory: {
                ...(prev?.medicalHistory ?? emptyMedicalHistory()),
                eyes: vals,
              },
            }))
          }
        />

        <Textarea
          disabled={locked}
          label="Other"
          value={medicalHistory.other}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              medicalHistory: {
                ...(prev?.medicalHistory ?? emptyMedicalHistory()),
                other: e.target.value,
              },
            }))
          }
        />
      </Section>

      {/* ================= HEAD-TO-TOE ================= */}
      <Section title="Head - To - Toe - Physical Examination">
        <Input
          disabled={locked}
          label="General Appearance"
          value={headToToe.generalAppearance}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              headToToe: {
                ...(prev?.headToToe ?? emptyHeadToToe()),
                generalAppearance: e.target.value,
              },
            }))
          }
        />

        <Input
          disabled={locked}
          label="Head/Neck"
          value={headToToe.headNeck}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              headToToe: {
                ...(prev?.headToToe ?? emptyHeadToToe()),
                headNeck: e.target.value,
              },
            }))
          }
        />

        <Input
          disabled={locked}
          label="Chest"
          value={headToToe.chest}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              headToToe: {
                ...(prev?.headToToe ?? emptyHeadToToe()),
                chest: e.target.value,
              },
            }))
          }
        />

        <Input
          disabled={locked}
          label="Abdomen"
          value={headToToe.abdomen}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              headToToe: {
                ...(prev?.headToToe ?? emptyHeadToToe()),
                abdomen: e.target.value,
              },
            }))
          }
        />

        <Input
          disabled={locked}
          label="Back/Pelvis"
          value={headToToe.backPelvis}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              headToToe: {
                ...(prev?.headToToe ?? emptyHeadToToe()),
                backPelvis: e.target.value,
              },
            }))
          }
        />

        <Input
          disabled={locked}
          label="Extremities"
          value={headToToe.extremities}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              headToToe: {
                ...(prev?.headToToe ?? emptyHeadToToe()),
                extremities: e.target.value,
              },
            }))
          }
        />

        <Textarea
          disabled={locked}
          label="Other"
          value={headToToe.other}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              headToToe: {
                ...(prev?.headToToe ?? emptyHeadToToe()),
                other: e.target.value,
              },
            }))
          }
        />

       <BodyPainSelector
  values={headToToe.painLocations}
  onChange={(vals) =>
    setData((prev) => ({
      ...(prev ?? {}),
      headToToe: {
        ...(prev?.headToToe ?? emptyHeadToToe()),
        painLocations: vals,
      },
    }))
  }
/>


      </Section>

      {/* ================= NARRATIVE & VITALS ================= */}
      <SectionInnerTitle>Vital Signs</SectionInnerTitle>

{narrativeVitals.vitalsList.map((vital, idx) => (
  <div
    key={idx}
    className="border border-gray-700 rounded-lg p-4 bg-[#0B1220] space-y-3"
  >
    <div className="text-sm font-semibold text-gray-300">
      Vital Set #{idx + 1}
    </div>

    <div className="grid grid-cols-4 gap-4">
      <Input
        disabled={locked}
        label="Temp"
        value={vital.temp}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const list = [...nv.vitalsList];
            list[idx] = { ...list[idx], temp: e.target.value };
            return {
              ...(prev ?? {}),
              narrativeVitals: { ...nv, vitalsList: list },
            };
          })
        }
      />

      <Input
        disabled={locked}
        label="HR"
        value={vital.hr}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const list = [...nv.vitalsList];
            list[idx] = { ...list[idx], hr: e.target.value };
            return {
              ...(prev ?? {}),
              narrativeVitals: { ...nv, vitalsList: list },
            };
          })
        }
      />

      <Input
        disabled={locked}
        label="BP"
        value={vital.bp}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const list = [...nv.vitalsList];
            list[idx] = { ...list[idx], bp: e.target.value };
            return {
              ...(prev ?? {}),
              narrativeVitals: { ...nv, vitalsList: list },
            };
          })
        }
      />

      <Input
        disabled={locked}
        label="SpO2"
        value={vital.spo2}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const list = [...nv.vitalsList];
            list[idx] = { ...list[idx], spo2: e.target.value };
            return {
              ...(prev ?? {}),
              narrativeVitals: { ...nv, vitalsList: list },
            };
          })
        }
      />
    </div>

    <div className="grid grid-cols-3 gap-4">
      <Input
        disabled={locked}
        label="GCS"
        value={vital.gcs}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const list = [...nv.vitalsList];
            list[idx] = { ...list[idx], gcs: e.target.value };
            return {
              ...(prev ?? {}),
              narrativeVitals: { ...nv, vitalsList: list },
            };
          })
        }
      />

      <Input
        disabled={locked}
        label="BGL"
        value={vital.bgl}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const list = [...nv.vitalsList];
            list[idx] = { ...list[idx], bgl: e.target.value };
            return {
              ...(prev ?? {}),
              narrativeVitals: { ...nv, vitalsList: list },
            };
          })
        }
      />

      <TimeMini
        disabled={locked}
        label="Time"
        value={vital.time}
        onChange={(t) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const list = [...nv.vitalsList];
            list[idx] = { ...list[idx], time: t };
            return {
              ...(prev ?? {}),
              narrativeVitals: { ...nv, vitalsList: list },
            };
          })
        }
      />
    </div>

    {!locked && (
      <div className="flex gap-2">
        <button
          className="border border-gray-600 px-3 py-1 rounded"
          onClick={() =>
            setData((prev) => {
              const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
              return {
                ...(prev ?? {}),
                narrativeVitals: {
                  ...nv,
                  vitalsList: [...nv.vitalsList, emptyVitalItem()],
                },
              };
            })
          }
        >
          + Add Vital
        </button>

        {narrativeVitals.vitalsList.length > 1 && (
          <button
            className="border border-gray-600 px-3 py-1 rounded"
            onClick={() =>
              setData((prev) => {
                const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
                const list = nv.vitalsList.slice();
                list.splice(idx, 1);
                return {
                  ...(prev ?? {}),
                  narrativeVitals: { ...nv, vitalsList: list },
                };
              })
            }
          >
            Remove
          </button>
        )}
      </div>
    )}
  </div>
))}


        {/* Medications */}
       <SectionInnerTitle>Medications</SectionInnerTitle>

{narrativeVitals.medications.map((item, idx) => (
  <div
    key={idx}
    className="border border-gray-700 rounded-lg p-4 bg-[#0B1220] space-y-3"
  >
    <div className="text-sm font-semibold text-gray-300">
      Medication #{idx + 1}
    </div>

    <div className="grid grid-cols-3 gap-4">
      <Select
        disabled={locked}
        label="Medication"
        value={item.medication}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const meds = [...nv.medications];
            meds[idx] = { ...meds[idx], medication: e.target.value };
            return { ...(prev ?? {}), narrativeVitals: { ...nv, medications: meds } };
          })
        }
      >
        {MEDICATIONS_LIST.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </Select>

      <Input
        disabled={locked}
        label="Other"
        value={item.other}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const meds = [...nv.medications];
            meds[idx] = { ...meds[idx], other: e.target.value };
            return { ...(prev ?? {}), narrativeVitals: { ...nv, medications: meds } };
          })
        }
      />

      <Select
        disabled={locked}
        label="Qty"
        value={item.qty}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const meds = [...nv.medications];
            meds[idx] = { ...meds[idx], qty: e.target.value };
            return { ...(prev ?? {}), narrativeVitals: { ...nv, medications: meds } };
          })
        }
      >
        {QTY_LIST.map((q) => (
          <option key={q} value={q}>{q}</option>
        ))}
      </Select>
    </div>

    {!locked && (
      <div className="flex gap-2">
        <button
          className="border border-gray-600 px-3 py-1 rounded"
          onClick={() =>
            setData((prev) => {
              const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
              return {
                ...(prev ?? {}),
                narrativeVitals: {
                  ...nv,
                  medications: [...nv.medications, emptyMedicationItem()],
                },
              };
            })
          }
        >
          + Add Medication
        </button>

        {narrativeVitals.medications.length > 1 && (
          <button
            className="border border-gray-600 px-3 py-1 rounded"
            onClick={() =>
              setData((prev) => {
                const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
                const meds = [...nv.medications];
                meds.splice(idx, 1);
                return { ...(prev ?? {}), narrativeVitals: { ...nv, medications: meds } };
              })
            }
          >
            Remove
          </button>
        )}
      </div>
    )}
  </div>
))}

        {/* Consumables */}
       <SectionInnerTitle>Consumables</SectionInnerTitle>

{narrativeVitals.consumables.map((item, idx) => (
  <div
    key={idx}
    className="border border-gray-700 rounded-lg p-4 bg-[#0B1220] space-y-3"
  >
    <div className="text-sm font-semibold text-gray-300">
      Consumable #{idx + 1}
    </div>

    <div className="grid grid-cols-3 gap-4">
      <Select
        disabled={locked}
        label="Consumable"
        value={item.consumable}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const cons = [...nv.consumables];
            cons[idx] = { ...cons[idx], consumable: e.target.value };
            return { ...(prev ?? {}), narrativeVitals: { ...nv, consumables: cons } };
          })
        }
      >
        {CONSUMABLES_LIST.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>

      <Input
        disabled={locked}
        label="Other"
        value={item.other}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const cons = [...nv.consumables];
            cons[idx] = { ...cons[idx], other: e.target.value };
            return { ...(prev ?? {}), narrativeVitals: { ...nv, consumables: cons } };
          })
        }
      />

      <Select
        disabled={locked}
        label="Qty"
        value={item.qty}
        onChange={(e) =>
          setData((prev) => {
            const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
            const cons = [...nv.consumables];
            cons[idx] = { ...cons[idx], qty: e.target.value };
            return { ...(prev ?? {}), narrativeVitals: { ...nv, consumables: cons } };
          })
        }
      >
        {QTY_LIST.map((q) => (
          <option key={q} value={q}>{q}</option>
        ))}
      </Select>
    </div>

    {!locked && (
      <div className="flex gap-2">
        <button
          className="border border-gray-600 px-3 py-1 rounded"
          onClick={() =>
            setData((prev) => {
              const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
              return {
                ...(prev ?? {}),
                narrativeVitals: {
                  ...nv,
                  consumables: [...nv.consumables, emptyConsumableItem()],
                },
              };
            })
          }
        >
          + Add Consumable
        </button>

        {narrativeVitals.consumables.length > 1 && (
          <button
            className="border border-gray-600 px-3 py-1 rounded"
            onClick={() =>
              setData((prev) => {
                const nv = prev?.narrativeVitals ?? emptyNarrativeVitals();
                const cons = [...nv.consumables];
                cons.splice(idx, 1);
                return { ...(prev ?? {}), narrativeVitals: { ...nv, consumables: cons } };
              })
            }
          >
            Remove
          </button>
        )}
      </div>
    )}
  </div>
))}

     

      {/* ================= OUTCOME ================= */}
      <Section title="Outcome">
        <Select
          disabled={locked}
          label="Destination *"
          value={outcome.destination}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              outcome: { ...(prev?.outcome ?? emptyOutcome()), destination: e.target.value },
            }))
          }
        >
          {DESTINATIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>

        <Input
          disabled={locked}
          label="Hospital Name *"
          value={outcome.hospitalName}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              outcome: { ...(prev?.outcome ?? emptyOutcome()), hospitalName: e.target.value },
            }))
          }
        />

        <Input
          disabled={locked}
          label="Hospital Member *"
          value={outcome.hospitalMember}
          onChange={(e) =>
            setData((prev) => ({
              ...(prev ?? {}),
              outcome: { ...(prev?.outcome ?? emptyOutcome()), hospitalMember: e.target.value },
            }))
          }
        />

        <div className="grid grid-cols-2 gap-6">
          <SignatureBox
            disabled={locked}
            label="Hospital Signature *"
            value={outcome.hospitalSignatureDataUrl}
            onChange={(dataUrl) =>
              setData((prev) => ({
                ...(prev ?? {}),
                outcome: { ...(prev?.outcome ?? emptyOutcome()), hospitalSignatureDataUrl: dataUrl },
              }))
            }
          />

          <SignatureBox
            disabled={locked}
            label="Patient Signature"
            value={outcome.patientSignatureDataUrl}
            onChange={(dataUrl) =>
              setData((prev) => ({
                ...(prev ?? {}),
                outcome: { ...(prev?.outcome ?? emptyOutcome()), patientSignatureDataUrl: dataUrl },
              }))
            }
          />
        </div>
      </Section>

      {/* ================= TRANSFER TEAM ================= */}
      <Section title="Transfer Team">
        {transferTeam.members.map((mem, idx) => (
          <div key={idx} className="border border-gray-700 rounded-lg p-4 bg-[#0B1220] space-y-4">
            <div className="text-sm font-semibold text-gray-200">Paramedic #{idx + 1}</div>

            <Input
              disabled={locked}
              label="Paramedic Name *"
              value={mem.name}
              onChange={(e) =>
                setData((prev) => {
                  const tt = prev?.transferTeam ?? emptyTransferTeam();
                  const members: TransferTeam["members"] = [tt.members[0], tt.members[1]];
                  members[idx] = { ...members[idx], name: e.target.value };
                  return { ...(prev ?? {}), transferTeam: { ...tt, members } };
                })
              }
            />

            <Input
              disabled={locked}
              label="Badge No."
              value={mem.badgeNo}
              onChange={(e) =>
                setData((prev) => {
                  const tt = prev?.transferTeam ?? emptyTransferTeam();
                  const members: TransferTeam["members"] = [tt.members[0], tt.members[1]];
                  members[idx] = { ...members[idx], badgeNo: e.target.value };
                  return { ...(prev ?? {}), transferTeam: { ...tt, members } };
                })
              }
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                disabled={locked}
                label="Unit"
                value={mem.unit}
                onChange={(e) =>
                  setData((prev) => {
                    const tt = prev?.transferTeam ?? emptyTransferTeam();
                    const members: TransferTeam["members"] = [tt.members[0], tt.members[1]];
                    members[idx] = { ...members[idx], unit: e.target.value };
                    return { ...(prev ?? {}), transferTeam: { ...tt, members } };
                  })
                }
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>

              <Select
                disabled={locked}
                label="Position"
                value={mem.position}
                onChange={(e) =>
                  setData((prev) => {
                    const tt = prev?.transferTeam ?? emptyTransferTeam();
                    const members: TransferTeam["members"] = [tt.members[0], tt.members[1]];
                    members[idx] = { ...members[idx], position: e.target.value };
                    return { ...(prev ?? {}), transferTeam: { ...tt, members } };
                  })
                }
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>

            <SignatureBox
              disabled={locked}
              label="Signature *"
              value={mem.signatureDataUrl}
              onChange={(dataUrl) =>
                setData((prev) => {
                  const tt = prev?.transferTeam ?? emptyTransferTeam();
                  const members: TransferTeam["members"] = [tt.members[0], tt.members[1]];
                  members[idx] = { ...members[idx], signatureDataUrl: dataUrl };
                  return { ...(prev ?? {}), transferTeam: { ...tt, members } };
                })
              }
            />
          </div>
        ))}
      </Section>

      {/* ================= TIME ================= */}
      <Section title="Time">
        <div className="grid grid-cols-2 gap-6">
          <TimeField
            disabled={locked}
            label="Moving Time *"
            value={time.movingTime}
            onChange={(v) =>
              setData((prev) => ({
                ...(prev ?? {}),
                time: { ...(prev?.time ?? emptyTime()), movingTime: v },
              }))
            }
          />

          <TimeField
            disabled={locked}
            label="Arrival to PT Time"
            value={time.arrivalToPTTime}
            onChange={(v) =>
              setData((prev) => ({
                ...(prev ?? {}),
                time: { ...(prev?.time ?? emptyTime()), arrivalToPTTime: v },
              }))
            }
          />

          <TimeField
            disabled={locked}
            label="Leaving Scene Time"
            value={time.leavingSceneTime}
            onChange={(v) =>
              setData((prev) => ({
                ...(prev ?? {}),
                time: { ...(prev?.time ?? emptyTime()), leavingSceneTime: v },
              }))
            }
          />

          <TimeField
            disabled={locked}
            label="Hospital Time"
            value={time.hospitalTime}
            onChange={(v) =>
              setData((prev) => ({
                ...(prev ?? {}),
                time: { ...(prev?.time ?? emptyTime()), hospitalTime: v },
              }))
            }
          />

          <TimeField
            disabled={locked}
            label="Waiting Time"
            value={time.waitingTime}
            onChange={(v) =>
              setData((prev) => ({
                ...(prev ?? {}),
                time: { ...(prev?.time ?? emptyTime()), waitingTime: v },
              }))
            }
          />

          <TimeField
            disabled={locked}
            label="Discharge Time"
            value={time.dischargeTime}
            onChange={(v) =>
              setData((prev) => ({
                ...(prev ?? {}),
                time: { ...(prev?.time ?? emptyTime()), dischargeTime: v },
              }))
            }
          />

          <TimeField
            disabled={locked}
            label="Arrival Time *"
            value={time.arrivalTime}
            onChange={(v) =>
              setData((prev) => ({
                ...(prev ?? {}),
                time: { ...(prev?.time ?? emptyTime()), arrivalTime: v },
              }))
            }
          />

          <TimeField
            disabled={locked}
            label="Back Time"
            value={time.backTime}
            onChange={(v) =>
              setData((prev) => ({
                ...(prev ?? {}),
                time: { ...(prev?.time ?? emptyTime()), backTime: v },
              }))
            }
          />
        </div>
      </Section>

      {/* ================= ACTIONS ================= */}
      <div className="flex gap-4 justify-end">
        {!locked && (
          <>
            <button onClick={saveDraft} className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700">
              Save Draft
            </button>

            <button
              onClick={finalize}
              disabled={!canFinalize}
              className="px-6 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-40"
            >
              Finalize ePCR
            </button>
          </>
        )}

        <button onClick={() => router.back()} className="px-6 py-2 rounded border border-gray-600">
          Back
        </button>
      </div>
    </div>
  );
}

/* =========================
   UI HELPERS
========================= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-700 rounded-lg p-6 bg-[#0F172A] space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

function SectionInnerTitle({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 mb-2 text-sm font-semibold text-gray-300">{children}</div>;
}

function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input {...props} className="w-full p-2 rounded bg-[#020617] border border-gray-700" />
    </div>
  );
}

function Textarea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <textarea {...props} className="w-full h-24 p-2 rounded bg-[#020617] border border-gray-700" />
    </div>
  );
}

function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <select {...props} className="w-full p-2 rounded bg-[#020617] border border-gray-700">
        <option value="">Select</option>
        {children}
      </select>
    </div>
  );
}

function MultiCheckbox({
  title,
  options,
  value,
  onChange,
  disabled,
}: {
  title: string;
  options: readonly string[];
  value: string[];
  onChange: (vals: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.includes(opt)}
              onChange={() => toggle(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: TimeValue;
  onChange: (v: TimeValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm">{label}</label>
      <div className="flex gap-2">
        <input
          type="time"
          disabled={disabled}
          value={value.timeHHMM}
          onChange={(e) => onChange({ ...value, timeHHMM: e.target.value })}
          className="flex-1 p-2 rounded bg-[#020617] border border-gray-700"
        />
        <select
          disabled={disabled}
          value={value.ampm}
          onChange={(e) => onChange({ ...value, ampm: e.target.value as "AM" | "PM" | "" })}
          className="w-20 p-2 rounded bg-[#020617] border border-gray-700"
        >
          <option value="">--</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

/** This is used in Narrative vitals time (your vitals type has timeHHMM + ampm) */
function TimeMini({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: { timeHHMM: string; ampm: "AM" | "PM" | "" };
  onChange: (v: { timeHHMM: string; ampm: "AM" | "PM" | "" }) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm">{label}</label>
      <div className="flex gap-2">
        <input
          type="time"
          disabled={disabled}
          value={value.timeHHMM}
          onChange={(e) => onChange({ ...value, timeHHMM: e.target.value })}
          className="flex-1 p-2 rounded bg-[#020617] border border-gray-700"
        />
        <select
          disabled={disabled}
          value={value.ampm}
          onChange={(e) => onChange({ ...value, ampm: e.target.value as "AM" | "PM" | "" })}
          className="w-20 p-2 rounded bg-[#020617] border border-gray-700"
        >
          <option value="">--</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

/**
 * SignatureBox:
 * - Upload image file (png/jpg)
 * - Store as base64 dataURL in Firestore
 * - Works now, no external libraries
 */
function SignatureBox({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const onPickFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      onChange(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm">{label}</label>

      <div className="border border-gray-700 rounded p-3 bg-[#020617] space-y-2">
        {value ? (
          <img src={value} alt="Signature" className="h-20 object-contain" />
        ) : (
          <div className="text-xs text-gray-400">No signature uploaded</div>
        )}

        {!disabled && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
              className="text-xs"
            />
            {value && (
              <button
                type="button"
                className="text-xs underline"
                onClick={() => onChange("")}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
  function BodyDiagram({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (vals: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (area: string) => {
    if (disabled) return;

    if (value.includes(area)) {
      onChange(value.filter((v) => v !== area));
    } else {
      onChange([...value, area]);
    }
  };

  const isActive = (area: string) =>
    value.includes(area)
      ? "bg-blue-600/70 border-blue-400"
      : "bg-gray-700/40 border-gray-600";

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">
        Physical Examination – Pain Locations
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* FRONT */}
        <div className="space-y-2">
          <div className="text-xs text-center text-gray-400">FRONT</div>

          {[
            "Head",
            "Neck",
            "Chest",
            "Abdomen",
            "Pelvis",
            "Left Arm",
            "Right Arm",
            "Left Leg",
            "Right Leg",
          ].map((area) => (
            <button
              key={area}
              type="button"
              disabled={disabled}
              onClick={() => toggle(area)}
              className={`w-full text-sm p-2 rounded border transition ${isActive(
                area
              )}`}
            >
              {area}
            </button>
          ))}
        </div>

        {/* BACK */}
        <div className="space-y-2">
          <div className="text-xs text-center text-gray-400">BACK</div>

          {[
            "Back - Head",
            "Back - Upper",
            "Back - Lower",
            "Back - Left Arm",
            "Back - Right Arm",
            "Back - Left Leg",
            "Back - Right Leg",
          ].map((area) => (
            <button
              key={area}
              type="button"
              disabled={disabled}
              onClick={() => toggle(area)}
              className={`w-full text-sm p-2 rounded border transition ${isActive(
                area
              )}`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {/* Selected summary */}
      {value.length > 0 && (
        <div className="text-xs text-gray-400">
          Selected: {value.join(", ")}
        </div>
      )}
    </div>
  );
}
