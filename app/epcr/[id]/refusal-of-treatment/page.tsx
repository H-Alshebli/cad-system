"use client";

import React, { useEffect, useState } from "react";
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

const REFUSAL_REASONS = [
  "Patient feels better",
  "Patient refused transport",
  "Patient refused examination",
  "Patient refused treatment",
  "Patient refused hospital transfer",
  "Financial reason",
  "Family decision",
  "Cultural / personal reason",
  "Other",
];

export default function RefusalOfTreatmentPage({
  params,
}: {
  params: { id: string };
}) {
  const epcrId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [epcrData, setEpcrData] = useState<EpcrFormData | null>(null);

  const [refusalReasons, setRefusalReasons] = useState<string[]>([]);
  const [otherReason, setOtherReason] = useState("");
  const [explainedRisks, setExplainedRisks] = useState("");
  const [patientDecision, setPatientDecision] = useState("Refused treatment");
  const [refusedBy, setRefusedBy] = useState<"patient" | "guardian">("patient");

  const [guardianName, setGuardianName] = useState("");
  const [guardianIdNumber, setGuardianIdNumber] = useState("");

  const [witnessName, setWitnessName] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [notes, setNotes] = useState("");

  const [patientSignatureDataUrl, setPatientSignatureDataUrl] = useState("");
  const [guardianSignatureDataUrl, setGuardianSignatureDataUrl] = useState("");
  const [clinicianSignatureDataUrl, setClinicianSignatureDataUrl] = useState("");

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

        setRefusalReasons(saved.refusalReasons || []);
        setOtherReason(saved.otherReason || "");
        setExplainedRisks(saved.explainedRisks || "");
        setPatientDecision(saved.patientDecision || "Refused treatment");
        setRefusedBy(saved.refusedBy || "patient");

        setGuardianName(saved.guardianName || "");
        setGuardianIdNumber(saved.guardianIdNumber || "");

        setWitnessName(saved.witnessName || "");
        setClinicianName(saved.clinicianName || "");
        setNotes(saved.notes || "");

        setPatientSignatureDataUrl(saved.patientSignatureDataUrl || "");
        setGuardianSignatureDataUrl(saved.guardianSignatureDataUrl || "");
        setClinicianSignatureDataUrl(saved.clinicianSignatureDataUrl || "");
      }

      setLoading(false);
    }

    loadData();
  }, [epcrId]);

  const toggleReason = (reason: string) => {
    setRefusalReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  const saveForm = async () => {
    const ref = doc(db, "epcr", epcrId, "forms", "refusalOfTreatment");

    await setDoc(
      ref,
      {
        epcrId,
        projectInfo: epcrData?.projectInfo || {},
        patientInfo: epcrData?.patientInfo || {},
        refusalReasons,
        otherReason,
        explainedRisks,
        patientDecision,
        refusedBy,
        guardianName: refusedBy === "guardian" ? guardianName : "",
        guardianIdNumber: refusedBy === "guardian" ? guardianIdNumber : "",
        witnessName,
        clinicianName,
        notes,
        patientSignatureDataUrl,
        guardianSignatureDataUrl:
          refusedBy === "guardian" ? guardianSignatureDataUrl : "",
        clinicianSignatureDataUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    alert("Refusal of treatment form saved.");
  };

  if (loading) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  const patientName =
    `${epcrData?.patientInfo?.firstName || ""} ${epcrData?.patientInfo?.lastName || ""}`.trim();

  const chiefComplaint =
    epcrData?.patientInfo?.chiefComplaints?.join(", ") || "—";

  return (
    <div className="p-6 max-w-5xl mx-auto text-white space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Refusal of Treatment Form</h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded border border-gray-600 hover:bg-gray-800"
        >
          Back
        </button>
      </div>

      <Section title="Main Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            disabled
            label="Project Name"
            value={epcrData?.projectInfo?.projectName || "—"}
          />
          <Input
            disabled
            label="Project ID"
            value={epcrData?.projectInfo?.projectId || "—"}
          />
          <Input disabled label="Patient Name" value={patientName || "—"} />
          <Input
            disabled
            label="Patient ID"
            value={epcrData?.patientInfo?.patientId || "—"}
          />
          <Input
            disabled
            label="Age"
            value={epcrData?.patientInfo?.age?.toString() || "—"}
          />
          <Input
            disabled
            label="Gender"
            value={epcrData?.patientInfo?.gender || "—"}
          />
        </div>

        <Textarea disabled label="Chief Complaint" value={chiefComplaint} />
      </Section>

      <Section title="Refusal Details">
        <div>
          <label className="block text-sm mb-3">Reason for Refusal</label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REFUSAL_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-2 rounded border border-gray-700 bg-[#020617] p-3"
              >
                <input
                  type="checkbox"
                  checked={refusalReasons.includes(reason)}
                  onChange={() => toggleReason(reason)}
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>

          {refusalReasons.includes("Other") && (
            <div className="mt-4">
              <Textarea
                label="Other Reason - Please specify"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            </div>
          )}
        </div>

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

        <div>
          <label className="block text-sm mb-3">Refusal By</label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="refusedBy"
                checked={refusedBy === "patient"}
                onChange={() => setRefusedBy("patient")}
              />
              <span>Patient</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="refusedBy"
                checked={refusedBy === "guardian"}
                onChange={() => setRefusedBy("guardian")}
              />
              <span>Guardian</span>
            </label>
          </div>
        </div>

        {refusedBy === "guardian" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Guardian Name"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
            />
            <Input
              label="Guardian ID Number"
              value={guardianIdNumber}
              onChange={(e) => setGuardianIdNumber(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Witness Name"
            value={witnessName}
            onChange={(e) => setWitnessName(e.target.value)}
          />

          <Input
            label="Clinician / Paramedic Name"
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

      <Section title="Signatures">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SignatureBox
            label="Patient Signature"
            value={patientSignatureDataUrl}
            onChange={setPatientSignatureDataUrl}
          />

          {refusedBy === "guardian" && (
            <SignatureBox
              label="Guardian Signature"
              value={guardianSignatureDataUrl}
              onChange={setGuardianSignatureDataUrl}
            />
          )}

          <SignatureBox
            label="Clinician / Paramedic Signature"
            value={clinicianSignatureDataUrl}
            onChange={setClinicianSignatureDataUrl}
          />
        </div>
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
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!value) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value;
  }, [value]);

  const getPoint = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const start = (e: any) => {
    if (disabled) return;
    const point = getPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!point || !canvas || !ctx) return;

    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (e: any) => {
    if (!drawing.current || disabled) return;

    const point = getPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!point || !canvas || !ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ff0000";
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const end = () => {
    if (disabled) return;
    drawing.current = false;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.beginPath();
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm">{label}</label>

      <div className="border border-gray-700 rounded bg-[#020617] p-2">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full rounded bg-black touch-none"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={clear}
          className="text-xs underline text-gray-400"
        >
          Clear signature
        </button>
      )}
    </div>
  );
}