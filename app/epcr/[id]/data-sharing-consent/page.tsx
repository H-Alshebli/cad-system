"use client";

import React, { useEffect, useMemo, useState } from "react";
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

export default function DataSharingConsentPage({
  params,
}: {
  params: { id: string };
}) {
  const epcrId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [epcrData, setEpcrData] = useState<EpcrFormData | null>(null);

  const [consentStatus, setConsentStatus] = useState<"Approved" | "Rejected">(
    "Approved"
  );
  const [approvedByType, setApprovedByType] = useState<"patient" | "guardian">(
    "patient"
  );
  const [approvedByName, setApprovedByName] = useState("");
  const [relationToPatient, setRelationToPatient] = useState("");
  const [guardianIdNumber, setGuardianIdNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [clinicianName, setClinicianName] = useState("");

  const [patientSignatureDataUrl, setPatientSignatureDataUrl] = useState("");
  const [guardianSignatureDataUrl, setGuardianSignatureDataUrl] = useState("");
  const [clinicianSignatureDataUrl, setClinicianSignatureDataUrl] =
    useState("");

  useEffect(() => {
    async function loadData() {
      const epcrRef = doc(db, "epcr", epcrId);
      const consentRef = doc(db, "epcr", epcrId, "forms", "dataSharingConsent");

      const [epcrSnap, consentSnap] = await Promise.all([
        getDoc(epcrRef),
        getDoc(consentRef),
      ]);

      let loadedEpcr: EpcrFormData | null = null;

      if (epcrSnap.exists()) {
        loadedEpcr = epcrSnap.data() as EpcrFormData;
        setEpcrData(loadedEpcr);
      }

      const patientFullName = `${loadedEpcr?.patientInfo?.firstName || ""} ${
        loadedEpcr?.patientInfo?.lastName || ""
      }`.trim();

      if (consentSnap.exists()) {
        const saved = consentSnap.data();

        const savedApprovedByType =
          saved.approvedByType === "guardian" ? "guardian" : "patient";

        setConsentStatus(saved.consentStatus || "Approved");
        setApprovedByType(savedApprovedByType);
        setApprovedByName(
          savedApprovedByType === "patient"
            ? patientFullName || saved.approvedByName || ""
            : saved.approvedByName || ""
        );
        setRelationToPatient(saved.relationToPatient || "");
        setGuardianIdNumber(saved.guardianIdNumber || "");
        setNotes(saved.notes || "");
        setClinicianName(saved.clinicianName || "");

        setPatientSignatureDataUrl(saved.patientSignatureDataUrl || "");
        setGuardianSignatureDataUrl(saved.guardianSignatureDataUrl || "");
        setClinicianSignatureDataUrl(saved.clinicianSignatureDataUrl || "");
      } else {
        setApprovedByName(patientFullName);
      }

      setLoading(false);
    }

    loadData();
  }, [epcrId]);

  const patientName = useMemo(() => {
    return `${epcrData?.patientInfo?.firstName || ""} ${
      epcrData?.patientInfo?.lastName || ""
    }`.trim();
  }, [epcrData]);

  useEffect(() => {
    if (approvedByType === "patient") {
      setApprovedByName(patientName);
    } else {
      setApprovedByName("");
    }
  }, [approvedByType, patientName]);

  const saveForm = async () => {
    const ref = doc(db, "epcr", epcrId, "forms", "dataSharingConsent");

    await setDoc(
      ref,
      {
        epcrId,
        projectInfo: epcrData?.projectInfo || {},
        patientInfo: epcrData?.patientInfo || {},
        consentStatus,
        approvedByType,
        approvedByName:
          approvedByType === "patient" ? patientName : approvedByName,
        relationToPatient: approvedByType === "guardian" ? relationToPatient : "",
        guardianIdNumber: approvedByType === "guardian" ? guardianIdNumber : "",
        notes,
        clinicianName,
        patientSignatureDataUrl,
        guardianSignatureDataUrl:
          approvedByType === "guardian" ? guardianSignatureDataUrl : "",
        clinicianSignatureDataUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    alert("Data sharing consent form saved.");
  };

  if (loading) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  const chiefComplaint =
    epcrData?.patientInfo?.chiefComplaints?.join(", ") || "—";

  const projectName = epcrData?.projectInfo?.projectName || "this project";
  const currentYear = new Date().getFullYear();

  const consentMessage = `Do you agree to share and disclose your medical case report number (${epcrId}) dated ____ / ____ / ${currentYear} with ${projectName}?`;

  return (
    <div className="p-6 max-w-5xl mx-auto text-white space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Data Sharing Consent Form</h1>
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

      <Section title="Consent Details">
        <div className="rounded-lg border border-cyan-700 bg-cyan-950/30 p-4 text-sm leading-7 text-cyan-100">
          {consentMessage}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Approval Status"
            value={consentStatus}
            onChange={(e) =>
              setConsentStatus(e.target.value as "Approved" | "Rejected")
            }
          >
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </Select>

          <Input
            label="Clinician / Paramedic Name"
            value={clinicianName}
            onChange={(e) => setClinicianName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-3">Approval Given By</label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="approvedByType"
                checked={approvedByType === "patient"}
                onChange={() => setApprovedByType("patient")}
              />
              <span>Patient</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="approvedByType"
                checked={approvedByType === "guardian"}
                onChange={() => setApprovedByType("guardian")}
              />
              <span>Guardian</span>
            </label>
          </div>
        </div>

        <Input
          disabled={approvedByType === "patient"}
          label={approvedByType === "guardian" ? "Guardian Name" : "Patient Name"}
          value={approvedByType === "patient" ? patientName : approvedByName}
          onChange={(e) => setApprovedByName(e.target.value)}
        />

        {approvedByType === "guardian" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Relation to Patient"
              value={relationToPatient}
              onChange={(e) => setRelationToPatient(e.target.value)}
            />

            <Input
              label="Guardian ID Number"
              value={guardianIdNumber}
              onChange={(e) => setGuardianIdNumber(e.target.value)}
            />
          </div>
        )}

        <Textarea
          label="Additional Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Section>

      <Section title="Declaration & Signatures">
        <div className="rounded-lg border border-gray-700 bg-[#020617] p-4 text-sm text-gray-200">
          I acknowledge that the information and data entered in this form are
          correct.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SignatureBox
            label="Patient Signature"
            value={patientSignatureDataUrl}
            onChange={setPatientSignatureDataUrl}
          />

          {approvedByType === "guardian" && (
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
      <select
        {...props}
        className="w-full p-2 rounded bg-[#020617] border border-gray-700"
      >
        {children}
      </select>
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
    if (e.cancelable) e.preventDefault();

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