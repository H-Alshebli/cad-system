import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


/**
 * Lazem – Electronic Patient Care Report (ePCR)
 */
export function generateEpcrPdf(data: {
  projectInfo?: {
    projectId?: string;
    projectName?: string;
  };
  patientInfo: any;
  medicalHistory: any;
  headToToe?: any;
  narrativeVitals: any;
  outcome: any;
  transferTeam: any;
  time: any;
}) {

  const doc = new jsPDF("p", "mm", "a4");
  let y = 15;

  /* ================= HELPERS ================= */

  const ensurePage = (space = 20) => {
    if (y + space > 280) {
      doc.addPage();
      y = 20;
    }
  };
const safeText = (v: any) => {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "-";
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
};

  const sectionTitle = (title: string) => {
    ensurePage(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 15, y);
    doc.line(15, y + 1, 195, y + 1);
    doc.setFont("helvetica", "normal");
    y += 6;
  };

  const keyValue = (label: string, value: any, x = 15) => {
    doc.setFontSize(9);
    doc.text(`${label}:`, x, y);
    doc.text(value ? String(value) : "-", x + 35, y);
  };

  const multiline = (label: string, value: string[] | string) => {
    ensurePage(15);
    doc.setFontSize(9);
    doc.text(`${label}:`, 15, y);

    const text = Array.isArray(value)
      ? value.length
        ? value.join(", ")
        : "-"
      : value || "-";

    const lines = doc.splitTextToSize(text, 140);
    doc.text(lines, 50, y);
    y += lines.length * 5 + 2;
  };
 
 /* ================= HEADER ================= */

// Logo
doc.addImage("/lazem-logo.png", "PNG", 15, 10, 25, 25);

// Title
doc.setFontSize(14);
doc.setFont("helvetica", "bold");
doc.text("Electronic Patient Care Report (ePCR)", 105, 18, {
  align: "center",
});

// Generated date
doc.setFontSize(9);
doc.setFont("helvetica", "normal");
doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 24, {
  align: "center",
});


// ✅ START CONTENT AFTER HEADER
y = 38;


/* ================= PROJECT INFO BOX ================= */

doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text("Project Information", 15, y);

doc.line(15, y + 2, 195, y + 2);
y += 8;

doc.setFontSize(9);

doc.setFont("helvetica", "bold");
doc.text("Project Name:", 15, y);
doc.setFont("helvetica", "normal");
doc.text(data.projectInfo?.projectName || "-", 45, y);

doc.setFont("helvetica", "bold");
doc.text("Project ID:", 120, y);
doc.setFont("helvetica", "normal");
doc.text(data.projectInfo?.projectId || "-", 145, y);

y += 10;



  /* ================= PATIENT INFO ================= */

  sectionTitle("Patient Information");

  keyValue("Patient ID", data.patientInfo.patientId, 15);
  keyValue(
    "Name",
    `${data.patientInfo.firstName} ${data.patientInfo.lastName}`,
    105
  );
  y += 6;

  keyValue("Age", data.patientInfo.age, 15);
  keyValue("Gender", data.patientInfo.gender, 105);
  y += 6;

  keyValue("Phone", data.patientInfo.phone, 15);
  keyValue("Nationality", data.patientInfo.nationality, 105);
  y += 6;

  keyValue("Weight (kg)", data.patientInfo.weightKg, 15);
  keyValue("Factory", data.patientInfo.factoryName, 105);
  y += 8;

  /* ================= TRIAGE ================= */

  sectionTitle("Triage & Complaints");

  keyValue("Triage Level", data.patientInfo.triageColor, 15);
  keyValue(
    "Health Classification",
    data.patientInfo.healthClassification,
    105
  );
  y += 6;

  multiline("Chief Complaints", data.patientInfo.chiefComplaints);
  multiline("Signs & Symptoms", data.patientInfo.signsAndSymptoms);

  /* ================= MEDICAL HISTORY ================= */

  sectionTitle("Relevant Medical History");

  multiline("Conditions", data.medicalHistory.conditions);
  multiline("Eyes", data.medicalHistory.eyes);
  keyValue("Other", data.medicalHistory.other, 15);
  y += 8;

  /* ================= HEAD TO TOE ================= */

  sectionTitle("Head - To - Toe - Physical Examination");

// ⬅️ ارسم المخطط مباشرة بعد العنوان
if (data.headToToe?.diagramImage) {
  ensurePage(110);

  doc.setFontSize(9);
  doc.text("Body Pain Diagram:", 15, y);
  y += 4;

  doc.addImage(
    data.headToToe.diagramImage,
    "PNG",
    15,
    y,
    180,
    90
  );

  y += 95;
}



keyValue(
  "General Appearance",
  safeText(data.headToToe?.generalAppearance),
  15
); y += 5;

keyValue(
  "Head / Neck",
  safeText(data.headToToe?.headNeck),
  15
); y += 5;

keyValue(
  "Chest",
  safeText(data.headToToe?.chest),
  15
); y += 5;

keyValue(
  "Abdomen",
  safeText(data.headToToe?.abdomen),
  15
); y += 5;

keyValue(
  "Back / Pelvis",
  safeText(data.headToToe?.backPelvis),
  15
); y += 5;

keyValue(
  "Extremities",
  safeText(data.headToToe?.extremities),
  15
); y += 6;

multiline(
  "Pain Locations",
  safeText(data.headToToe?.painLocations)
);

keyValue(
  "Other",
  safeText(data.headToToe?.other),
  15
);


  y += 8;

  /* ================= NARRATIVE ================= */

  sectionTitle("Narrative");

  keyValue(
    "Contacted Medical Director",
    data.narrativeVitals.contactedMedicalDirector,
    15
  );
  y += 6;

  const narrativeLines = doc.splitTextToSize(
    data.narrativeVitals.narrative || "-",
    180
  );
  doc.text(narrativeLines, 15, y);
  y += narrativeLines.length * 5 + 4;

  /* ================= VITAL SIGNS ================= */

  sectionTitle("Vital Signs");

  autoTable(doc, {
    startY: y,
    head: [["Time", "HR", "BP", "SpO2", "Temp", "GCS", "BGL"]],
    body: data.narrativeVitals.vitalsList.map((v: any) => [
      v.time?.timeHHMM || "",
      v.hr,
      v.bp,
      v.spo2,
      v.temp,
      v.gcs,
      v.bgl,
    ]),
    theme: "grid",
    styles: { fontSize: 8 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  /* ================= MEDICATIONS ================= */

  sectionTitle("Medications");

  autoTable(doc, {
    startY: y,
    head: [["Medication", "Other", "Qty"]],
    body: data.narrativeVitals.medications.map((m: any) => [
      m.medication,
      m.other,
      m.qty,
    ]),
    theme: "grid",
    styles: { fontSize: 8 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  /* ================= CONSUMABLES ================= */

  sectionTitle("Consumables");

  autoTable(doc, {
    startY: y,
    head: [["Consumable", "Other", "Qty"]],
    body: data.narrativeVitals.consumables.map((c: any) => [
      c.consumable,
      c.other,
      c.qty,
    ]),
    theme: "grid",
    styles: { fontSize: 8 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

/* ================= OUTCOME ================= */

sectionTitle("Outcome");

keyValue("Destination", data.outcome.destination, 15);
keyValue("Hospital", data.outcome.hospitalName, 105);
y += 6;

keyValue("Hospital Member", data.outcome.hospitalMember, 15);
y += 10;

/* ===== Signatures (inside Outcome) ===== */

// تأكد أن فيه مساحة للتواقيع
ensurePage(35);

doc.setFontSize(9);
doc.text("Hospital Signature", 15, y);
doc.text("Patient Signature", 120, y);

y += 4;

if (data.outcome.hospitalSignatureDataUrl) {
  doc.addImage(
    data.outcome.hospitalSignatureDataUrl,
    "PNG",
    15,
    y,
    60,
    20
  );
}

if (data.outcome.patientSignatureDataUrl) {
  doc.addImage(
    data.outcome.patientSignatureDataUrl,
    "PNG",
    120,
    y,
    60,
    20
  );
}

y += 26;

  /* ================= TRANSFER TEAM ================= */

  sectionTitle("Transfer Team");

  data.transferTeam?.members?.forEach((m: any, idx: number) => {
    ensurePage(30);

    doc.setFont("helvetica", "bold");
    doc.text(`Paramedic #${idx + 1}`, 15, y);
    doc.setFont("helvetica", "normal");
    y += 5;

    keyValue("Name", m.name, 15); y += 4;
    keyValue("Badge No", m.badgeNo, 15); y += 4;
    keyValue("Unit", m.unit, 15); y += 4;
    keyValue("Position", m.position, 15); y += 5;

    if (m.signatureDataUrl) {
      doc.text("Signature:", 15, y);
      doc.addImage(m.signatureDataUrl, "PNG", 40, y - 4, 45, 18);
      y += 22;
    }

    y += 4;
  });

  /* ================= TIME ================= */

  sectionTitle("Time");

  const t = data.time || {};

  keyValue("Moving Time", t.movingTime?.timeHHMM, 15);
  keyValue("Arrival Time", t.arrivalTime?.timeHHMM, 105);
  y += 4;

  keyValue("Arrival to PT", t.arrivalToPTTime?.timeHHMM, 15);
  keyValue("Leaving Scene", t.leavingSceneTime?.timeHHMM, 105);
  y += 4;

  keyValue("Hospital Time", t.hospitalTime?.timeHHMM, 15);
  keyValue("Waiting Time", t.waitingTime?.timeHHMM, 105);
  y += 4;

  keyValue("Discharge Time", t.dischargeTime?.timeHHMM, 15);
  keyValue("Back Time", t.backTime?.timeHHMM, 105);
  y += 8;


  /* ================= SAVE ================= */

  doc.save(`ePCR-${data.patientInfo.patientId || "case"}.pdf`);
}
