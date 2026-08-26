import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ProjectInfo = {
  projectId?: string;
  projectName?: string;
};

type PatientInfo = {
  patientId?: string;
  firstName?: string;
  lastName?: string;
  age?: number | null;
  gender?: string;
  chiefComplaints?: string[];
};

type Signature = {
  label: string;
  dataUrl?: string;
};

type CommonFormData = {
  epcrId: string;
  projectInfo?: ProjectInfo;
  patientInfo?: PatientInfo;
};

export type RefusalOfTreatmentPdfData = CommonFormData & {
  refusalReasons: string[];
  otherReason?: string;
  explainedRisks?: string;
  patientDecision?: string;
  refusedBy: "patient" | "guardian";
  guardianName?: string;
  guardianIdNumber?: string;
  witnessName?: string;
  clinicianName?: string;
  notes?: string;
  patientSignatureDataUrl?: string;
  guardianSignatureDataUrl?: string;
  clinicianSignatureDataUrl?: string;
};

export type DataSharingConsentPdfData = CommonFormData & {
  consentStatus: "Approved" | "Rejected";
  approvedByType: "patient" | "guardian";
  approvedByName?: string;
  relationToPatient?: string;
  guardianIdNumber?: string;
  notes?: string;
  clinicianName?: string;
  patientSignatureDataUrl?: string;
  guardianSignatureDataUrl?: string;
  clinicianSignatureDataUrl?: string;
};

const COLORS = {
  navy: [39, 76, 90] as [number, number, number],
  cyan: [116, 205, 218] as [number, number, number],
  slate: [96, 116, 130] as [number, number, number],
  pale: [237, 248, 250] as [number, number, number],
  border: [211, 226, 231] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const safeText = (value: unknown) => {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const safeFilenamePart = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "form";

function createFormPdf(title: string, data: CommonFormData) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const patientName = `${data.patientInfo?.firstName || ""} ${
    data.patientInfo?.lastName || ""
  }`.trim();

  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Lazem HCAD", 14, 15);
  doc.setFontSize(13);
  doc.text(title, 14, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`ePCR ID: ${safeText(data.epcrId)}`, pageWidth - 14, 14, {
    align: "right",
  });
  doc.text(
    `Generated: ${new Date().toLocaleString("en-GB")}`,
    pageWidth - 14,
    21,
    { align: "right" }
  );

  autoTable(doc, {
    startY: 43,
    head: [["Case information", "Value"]],
    body: [
      ["Project", safeText(data.projectInfo?.projectName)],
      ["Project ID", safeText(data.projectInfo?.projectId)],
      ["Patient name", safeText(patientName)],
      ["Patient ID", safeText(data.patientInfo?.patientId)],
      ["Age / Gender", `${safeText(data.patientInfo?.age)} / ${safeText(data.patientInfo?.gender)}`],
      ["Chief complaint", safeText(data.patientInfo?.chiefComplaints)],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: COLORS.navy },
    headStyles: { fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.pale },
    columnStyles: { 0: { cellWidth: 42, fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  return doc;
}

function addDetails(
  doc: jsPDF,
  title: string,
  rows: Array<[string, unknown]>
) {
  const previousY = (doc as any).lastAutoTable?.finalY || 43;
  autoTable(doc, {
    startY: previousY + 8,
    head: [[title, "Value"]],
    body: rows.map(([label, value]) => [label, safeText(value)]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      textColor: COLORS.navy,
      overflow: "linebreak",
    },
    headStyles: { fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.pale },
    columnStyles: { 0: { cellWidth: 52, fontStyle: "bold" } },
    margin: { left: 14, right: 14, bottom: 18 },
  });
}

function addSignatures(doc: jsPDF, signatures: Signature[]) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = ((doc as any).lastAutoTable?.finalY || 45) + 10;

  if (y + 52 > pageHeight - 18) {
    doc.addPage();
    y = 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text("Signatures", 14, y);
  y += 6;

  const gap = 6;
  const boxWidth = (pageWidth - 28 - gap) / 2;
  const boxHeight = 38;

  signatures.forEach((signature, index) => {
    if (index > 0 && index % 2 === 0) {
      y += boxHeight + 7;
      if (y + boxHeight > pageHeight - 18) {
        doc.addPage();
        y = 18;
      }
    }

    const x = 14 + (index % 2) * (boxWidth + gap);
    doc.setDrawColor(...COLORS.border);
    doc.setFillColor(247, 251, 252);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.navy);
    doc.text(signature.label, x + 3, y + 6);

    if (signature.dataUrl) {
      try {
        doc.addImage(signature.dataUrl, "PNG", x + 4, y + 9, boxWidth - 8, 24);
      } catch {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.slate);
        doc.text("Signature image could not be rendered", x + 4, y + 22);
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.slate);
      doc.text("Not signed", x + 4, y + 22);
    }
  });
}

function addFooters(doc: jsPDF, formName: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.border);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.slate);
    doc.text(`Lazem Medical Services - ${formName}`, 14, pageHeight - 7);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 7, {
      align: "right",
    });
  }
}

export function generateRefusalOfTreatmentPdf(data: RefusalOfTreatmentPdfData) {
  const doc = createFormPdf("Refusal of Treatment Form", data);
  const reasons = [...data.refusalReasons];
  if (data.otherReason && reasons.includes("Other")) {
    reasons.push(`Other details: ${data.otherReason}`);
  }

  addDetails(doc, "Refusal details", [
    ["Reason(s) for refusal", reasons],
    ["Risks explained", data.explainedRisks],
    ["Patient decision", data.patientDecision],
    ["Refusal by", data.refusedBy === "guardian" ? "Guardian" : "Patient"],
    ["Guardian name", data.refusedBy === "guardian" ? data.guardianName : "Not applicable"],
    ["Guardian ID", data.refusedBy === "guardian" ? data.guardianIdNumber : "Not applicable"],
    ["Witness name", data.witnessName],
    ["Clinician / Paramedic", data.clinicianName],
    ["Additional notes", data.notes],
  ]);

  addSignatures(doc, [
    { label: "Patient signature", dataUrl: data.patientSignatureDataUrl },
    ...(data.refusedBy === "guardian"
      ? [{ label: "Guardian signature", dataUrl: data.guardianSignatureDataUrl }]
      : []),
    { label: "Clinician / Paramedic signature", dataUrl: data.clinicianSignatureDataUrl },
  ]);
  addFooters(doc, "Refusal of Treatment");
  doc.save(`HCAD-Refusal-${safeFilenamePart(data.patientInfo?.patientId || data.epcrId)}.pdf`);
}

export function generateDataSharingConsentPdf(data: DataSharingConsentPdfData) {
  const doc = createFormPdf("Data Sharing Consent Form", data);

  addDetails(doc, "Consent details", [
    ["Consent status", data.consentStatus],
    ["Decision given by", data.approvedByType === "guardian" ? "Guardian" : "Patient"],
    ["Name", data.approvedByName],
    ["Relation to patient", data.approvedByType === "guardian" ? data.relationToPatient : "Not applicable"],
    ["Guardian ID", data.approvedByType === "guardian" ? data.guardianIdNumber : "Not applicable"],
    ["Clinician / Paramedic", data.clinicianName],
    ["Additional notes", data.notes],
    ["Declaration", "I acknowledge that the information and data entered in this form are correct."],
  ]);

  addSignatures(doc, [
    { label: "Patient signature", dataUrl: data.patientSignatureDataUrl },
    ...(data.approvedByType === "guardian"
      ? [{ label: "Guardian signature", dataUrl: data.guardianSignatureDataUrl }]
      : []),
    { label: "Clinician / Paramedic signature", dataUrl: data.clinicianSignatureDataUrl },
  ]);
  addFooters(doc, "Data Sharing Consent");
  doc.save(`HCAD-Consent-${safeFilenamePart(data.patientInfo?.patientId || data.epcrId)}.pdf`);
}
