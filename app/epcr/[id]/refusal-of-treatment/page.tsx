"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

type EpcrFormData = {
  projectInfo?: {
    projectId?: string;
    projectName?: string;
  };
  patientInfo?: {
    patientId?: string;
    firstName?: string;
    lastName?: string;
    age?: number | null;
    gender?: string;
    chiefComplaints?: string[];
  };
};

export default function RefusalOfTreatmentPage({
  params,
}: {
  params: { id: string };
}) {
  const epcrId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [epcrData, setEpcrData] = useState<EpcrFormData | null>(null);

  const [refusalReason, setRefusalReason] = useState("");
  const [explainedRisks, setExplainedRisks] = useState("");
  const [patientDecision, setPatientDecision] = useState("Refused treatment");
  const [witnessName, setWitnessName] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function loadData() {
      const epcrRef = doc(db, "epcr", epcrId);
      const refusalRef = doc(db, "epcr", epcrId, "forms", "refusalOfTreatment");

      const [epcrSnap, refusalSnap] = await Promise.all([
        getDoc(epcrRef),
        getDoc(refusalRef),
      ]);

      if (epcrSnap.exists()) {
        setEpcrData(epcrSnap.data() as EpcrFormData);
      }

      if (refusalSnap.exists()) {
        const saved = refusalSnap.data();
        setRefusalReason(saved.refusalReason || "");
        setExplainedRisks(saved.explainedRisks || "");
        setPatientDecision(saved.patientDecision || "Refused treatment");
        setWitnessName(saved.witnessName || "");
        setClinicianName(saved.clinicianName || "");
        setNotes(saved.notes || "");
      }

      setLoading(false);
    }

    loadData();
  }, [epcrId]);

  const saveForm = async () => {
    const ref = doc(db, "epcr", epcrId, "forms", "refusalOfTreatment");

    await setDoc(
      ref,
      {
        epcrId,
        projectInfo: epcrData?.projectInfo || {},
        patientInfo: epcrData?.patientInfo || {},
        refusalReason,
        explainedRisks,
        patientDecision,
        witnessName,
        clinicianName,
        notes,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    alert("Refusal of treatment form saved.");
  };

  if (loading) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  const patientName = `${epcrData?.patientInfo?.firstName || ""} ${epcrData?.patientInfo?.lastName || ""}`.trim();
  const chiefComplaint =
    epcrData?.patientInfo?.chiefComplaints?.join(", ") || "—";

  return (
    <div className="p-6 max-w-5xl mx-auto text-white space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Refusal of Treatment Form</h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded border border-gray-600"
        >
          Back
        </button>
      </div>

      <Section title="Main Information">
        <div className="grid grid-cols-2 gap-4">
          <Input disabled label="Project Name" value={epcrData?.projectInfo?.projectName || "—"} />
          <Input disabled label="Project ID" value={epcrData?.projectInfo?.projectId || "—"} />
          <Input disabled label="Patient Name" value={patientName || "—"} />
          <Input disabled label="Patient ID" value={epcrData?.patientInfo?.patientId || "—"} />
          <Input disabled label="Age" value={epcrData?.patientInfo?.age?.toString() || "—"} />
          <Input disabled label="Gender" value={epcrData?.patientInfo?.gender || "—"} />
        </div>

        <Textarea disabled label="Chief Complaint" value={chiefComplaint} />
      </Section>

      <Section title="Refusal Details">
        <Textarea
          label="Reason for Refusal"
          value={refusalReason}
          onChange={(e) => setRefusalReason(e.target.value)}
        />

        <Textarea
          label="Risks Explained to Patient"
          value={explainedRisks}
          onChange={(e) => setExplainedRisks(e.target.value)}
        />

        <Input
          label="Patient Decision"
          value={patientDecision}
          onChange={(e) => setPatientDecision(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Witness Name"
            value={witnessName}
            onChange={(e) => setWitnessName(e.target.value)}
          />

          <Input
            label="Clinician Name"
            value={clinicianName}
            onChange={(e) => setClinicianName(e.target.value)}
          />
        </div>

        <Textarea
          label="Additional Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Section>

      <div className="flex justify-end gap-3">
        <button
          onClick={saveForm}
          className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700"
        >
          Save Form
        </button>
      </div>
    </div>
  );
}

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
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
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
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <textarea
        {...props}
        className="w-full h-28 p-2 rounded bg-[#020617] border border-gray-700"
      />
    </div>
  );
}