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
    return <div className="min-h-screen bg-[#f5f8f9] p-6 text-sm font-semibold text-[#607482]">Loading refusal form...</div>;
  }

  const patientName =
    `${epcrData?.patientInfo?.firstName || ""} ${epcrData?.patientInfo?.lastName || ""}`.trim();

  const chiefComplaint =
    epcrData?.patientInfo?.chiefComplaints?.join(", ") || "—";

  return (
    <div className="min-h-screen bg-[#f5f8f9] px-4 py-6 text-[#274C5A] sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-5 rounded-2xl bg-[#274C5A] p-5 text-white shadow-lg shadow-[#274C5A]/15 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ee3ec]">ePCR Supporting Form</p><h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Refusal of Treatment Form</h1><p className="mt-2 text-sm font-medium text-white/75">Document the refusal decision, explained risks, witnesses, and signatures.</p></div>
        <button
          onClick={() => router.back()}
          className="self-start rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-black transition hover:bg-white/20"
        >
          Back to ePCR
        </button>
      </div>

      <Section title="Main Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            disabled
            label="Project Name"
            value={epcrData?.projectInfo?.projectName || "—"}
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
          <label className="mb-3 block text-sm font-black text-[#274C5A]">Reason for Refusal</label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REFUSAL_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition ${refusalReasons.includes(reason) ? "border-[#74cdda] bg-[#edf8fa] text-[#274C5A]" : "border-[#d8e6ea] bg-[#f7fbfc] text-[#607482] hover:border-[#b9dce2]"}`}
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
          <label className="mb-3 block text-sm font-black text-[#274C5A]">Refusal By</label>
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
          className="rounded-xl bg-[#274C5A] px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-[#274C5A]/15 transition hover:bg-[#1d3b47]"
        >
          Save Form
        </button>
      </div>
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
    <section className="overflow-hidden rounded-2xl border border-[#d8e6ea] bg-white shadow-sm shadow-[#274C5A]/5">
      <div className="border-b border-[#dce9ed] bg-[#edf5f6] px-5 py-3"><h2 className="text-sm font-black uppercase tracking-wide text-[#274C5A]">{title}</h2></div>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-black text-[#274C5A]">{label}</label>
      <input
        {...props}
        className="w-full rounded-xl border border-[#c8dce2] bg-white px-3 py-2.5 text-sm font-semibold text-[#274C5A] outline-none focus:border-[#74cdda] focus:ring-2 focus:ring-[#74cdda]/20 disabled:bg-[#f1f5f6] disabled:text-[#718995]"
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
      <label className="mb-1.5 block text-sm font-black text-[#274C5A]">{label}</label>
      <textarea
        {...props}
        className="min-h-28 w-full resize-y rounded-xl border border-[#c8dce2] bg-white px-3 py-2.5 text-sm font-semibold text-[#274C5A] outline-none focus:border-[#74cdda] focus:ring-2 focus:ring-[#74cdda]/20 disabled:bg-[#f1f5f6] disabled:text-[#718995]"
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

    if (clientX === undefined || clientY === undefined || !rect.width || !rect.height) return null;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (e: any) => {
    if (disabled) return;
    const point = getPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!point || !canvas || !ctx) return;

    e.preventDefault?.();
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (e: any) => {
    if (!drawing.current || disabled) return;
    e.preventDefault?.();

    const point = getPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!point || !canvas || !ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#274C5A";
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const end = (e?: any) => {
    if (!drawing.current || disabled) return;
    e?.preventDefault?.();
    drawing.current = false;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.closePath();
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
      <label className="text-sm font-black text-[#274C5A]">{label}</label>

      <div className="overflow-hidden rounded-2xl border border-[#c8dce2] bg-[#f7fbfc] p-2 shadow-inner">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="block w-full touch-none rounded-xl bg-white"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
          onTouchCancel={end}
        />
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-black text-[#607482] underline decoration-[#74cdda] underline-offset-4"
        >
          Clear signature
        </button>
      )}
    </div>
  );
}
