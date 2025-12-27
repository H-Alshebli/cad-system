"use client";

import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BodyPainSelector from "@/app/components/epcr/BodyPainSelector";

/* =========================
   TYPES
========================= */
type Patient = {
  name?: string;
  age?: number;
  gender?: string;
};

type Vitals = {
  bp?: string;
  hr?: string;
  rr?: string;
  spo2?: string;
  temp?: string;
};

type PhysicalExam = {
  painLocations: string[];
  notes: string;
};

type Epcr = {
  id: string;
  chiefComplaint?: string;
  triageLevel?: number;
  patient?: Patient;
  vitals?: Vitals;
  assessment?: string;
  treatment?: string;
  outcome?: string;
  physicalExam?: PhysicalExam;
};

/* =========================
   PAGE
========================= */
export default function EpcrPage({
  params,
}: {
  params: { id: string };
}) {
  const epcrId = params.id;
  const router = useRouter();

  const [epcr, setEpcr] = useState<Epcr | null>(null);
  const [physicalExam, setPhysicalExam] = useState<PhysicalExam>({
    painLocations: [],
    notes: "",
  });
  const [loading, setLoading] = useState(true);

  /* =========================
     LOAD ePCR
  ========================= */
  useEffect(() => {
    const ref = doc(db, "epcr", epcrId);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Omit<Epcr, "id">;

        setEpcr({
          id: snap.id,
          ...data,
        });

        setPhysicalExam(
          data.physicalExam ?? {
            painLocations: [],
            notes: "",
          }
        );
      }
      setLoading(false);
    });

    return () => unsub();
  }, [epcrId]);

  if (loading) return <div className="p-6">Loading ePCR...</div>;
  if (!epcr) return <div className="p-6">ePCR not found</div>;

  /* =========================
     SAVE
  ========================= */
  const saveEpcr = async () => {
    await updateDoc(doc(db, "epcr", epcrId), {
      ...epcr,
      physicalExam,
      updatedAt: new Date(),
    });

    alert("ePCR saved");
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6 max-w-4xl mx-auto text-white space-y-6">
      <h1 className="text-3xl font-bold">ePCR</h1>

      {/* ================= CASE INFO ================= */}
      <Section title="Case Information">
        <ReadOnly label="Chief Complaint" value={epcr.chiefComplaint} />
        <ReadOnly
          label="Triage Level"
          value={epcr.triageLevel ? `Level ${epcr.triageLevel}` : ""}
        />
      </Section>

      {/* ================= PATIENT INFO ================= */}
      <Section title="Patient Information">
        <Input
          label="Patient Name"
          value={epcr.patient?.name || ""}
          onChange={(e) =>
            setEpcr({
              ...epcr,
              patient: { ...epcr.patient, name: e.target.value },
            })
          }
        />

        <Input
          label="Age"
          type="number"
          value={epcr.patient?.age || ""}
          onChange={(e) =>
            setEpcr({
              ...epcr,
              patient: {
                ...epcr.patient,
                age: Number(e.target.value),
              },
            })
          }
        />

        <Select
          label="Gender"
          value={epcr.patient?.gender || ""}
          onChange={(e) =>
            setEpcr({
              ...epcr,
              patient: { ...epcr.patient, gender: e.target.value },
            })
          }
        />
      </Section>

      {/* ================= PHYSICAL EXAM ================= */}
      <Section title="Physical Examination">
        <BodyPainSelector
          values={physicalExam.painLocations}
          onChange={(vals) =>
            setPhysicalExam({
              ...physicalExam,
              painLocations: vals,
            })
          }
        />

        <textarea
          className="w-full mt-3 p-2 rounded bg-[#020617] border border-gray-700"
          placeholder="Physical examination notes"
          value={physicalExam.notes}
          onChange={(e) =>
            setPhysicalExam({
              ...physicalExam,
              notes: e.target.value,
            })
          }
        />
      </Section>

      {/* ================= VITALS ================= */}
      <Section title="Vital Signs">
        {[
          { key: "bp", label: "Blood Pressure" },
          { key: "hr", label: "Heart Rate" },
          { key: "rr", label: "Respiratory Rate" },
          { key: "spo2", label: "SpO2" },
          { key: "temp", label: "Temperature" },
        ].map((v) => (
          <Input
            key={v.key}
            label={v.label}
            value={(epcr.vitals as any)?.[v.key] || ""}
            onChange={(e) =>
              setEpcr({
                ...epcr,
                vitals: {
                  ...epcr.vitals,
                  [v.key]: e.target.value,
                },
              })
            }
          />
        ))}
      </Section>

      {/* ================= CLINICAL NOTES ================= */}
      <Section title="Clinical Notes">
        <Textarea
          placeholder="Assessment"
          value={epcr.assessment || ""}
          onChange={(e) =>
            setEpcr({ ...epcr, assessment: e.target.value })
          }
        />

        <Textarea
          placeholder="Treatment"
          value={epcr.treatment || ""}
          onChange={(e) =>
            setEpcr({ ...epcr, treatment: e.target.value })
          }
        />

        <Textarea
          placeholder="Outcome"
          value={epcr.outcome || ""}
          onChange={(e) =>
            setEpcr({ ...epcr, outcome: e.target.value })
          }
        />
      </Section>

      {/* ================= ACTIONS ================= */}
      <div className="flex gap-4">
        <button
          onClick={saveEpcr}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
        >
          Save ePCR
        </button>

        <button
          onClick={() => router.back()}
          className="border border-gray-600 px-6 py-2 rounded"
        >
          Back
        </button>
      </div>
    </div>
  );
}

/* =========================
   UI HELPERS
========================= */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-700 rounded-lg p-6 bg-[#0F172A] space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

function Input({
  label,
  ...props
}: {
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        {...props}
        className="w-full p-2 rounded bg-[#020617] border border-gray-700"
      />
    </div>
  );
}

function Textarea({
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full h-24 p-2 rounded bg-[#020617] border border-gray-700"
    />
  );
}

function ReadOnly({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        readOnly
        value={value || ""}
        className="w-full p-2 rounded bg-[#020617] border border-gray-700 text-gray-300"
      />
    </div>
  );
}

function Select({
  label,
  ...props
}: {
  label: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <select
        {...props}
        className="w-full p-2 rounded bg-[#020617] border border-gray-700"
      >
        <option value="">Select</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="unknown">Unknown</option>
      </select>
    </div>
  );
}
