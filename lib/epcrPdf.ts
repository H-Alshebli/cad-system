import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Lazem – Modern Electronic Patient Care Report (ePCR)
 */
export function generateEpcrPdf(data: {
  projectInfo?: {
    projectId?: string;
    projectName?: string;
    tripLeg?: string;
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

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 14;
  let y = 14;

  const colors = {
    navy: [15, 23, 42] as [number, number, number],
    blue: [37, 99, 235] as [number, number, number],
    cyan: [14, 165, 233] as [number, number, number],
    slate: [71, 85, 105] as [number, number, number],
    lightSlate: [241, 245, 249] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    green: [22, 163, 74] as [number, number, number],
    amber: [217, 119, 6] as [number, number, number],
  };

  const safeText = (v: any) => {
    if (Array.isArray(v)) return v.length ? v.join(", ") : "-";
    if (v === null || v === undefined || v === "") return "-";
    return String(v);
  };

  const ensurePage = (space = 30) => {
    if (y + space > pageHeight - 18) {
      drawFooter();
      doc.addPage();
      y = 18;
    }
  };

  const drawFooter = () => {
    const page = doc.getNumberOfPages();

    doc.setDrawColor(...colors.border);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.slate);
    doc.text("Lazem Medical Services – ePCR Report", marginX, pageHeight - 7);
    doc.text(`Page ${page}`, pageWidth - marginX, pageHeight - 7, {
      align: "right",
    });
  };

  const drawHeader = () => {
    doc.setFillColor(...colors.navy);
    doc.roundedRect(marginX, 10, pageWidth - marginX * 2, 28, 4, 4, "F");

    try {
      doc.addImage("/lazem-logo.png", "PNG", marginX + 5, 14, 18, 18);
    } catch {
      doc.setFillColor(...colors.blue);
      doc.circle(marginX + 14, 23, 8, "F");
      doc.setTextColor(...colors.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("L", marginX + 14, 25, { align: "center" });
    }

    doc.setTextColor(...colors.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Electronic Patient Care Report", marginX + 28, 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Generated: ${new Date().toLocaleString()}`, marginX + 28, 29);

    doc.setFillColor(...colors.green);
    doc.roundedRect(pageWidth - marginX - 34, 18, 26, 8, 2, 2, "F");
    doc.setTextColor(...colors.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("ePCR", pageWidth - marginX - 21, 23.5, { align: "center" });

    y = 46;
  };

  const sectionTitle = (title: string) => {
    ensurePage(16);

    doc.setFillColor(...colors.lightSlate);
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 10, 2, 2, "F");

    doc.setTextColor(...colors.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, marginX + 4, y + 6.5);

    y += 14;
  };

  const infoCard = (
    items: { label: string; value: any }[],
    columns: 1 | 2 = 2
  ) => {
    ensurePage(12 + Math.ceil(items.length / columns) * 12);

    const cardX = marginX;
    const cardW = pageWidth - marginX * 2;
    const colW = columns === 2 ? cardW / 2 : cardW;
    const rowH = 12;
    const rows = Math.ceil(items.length / columns);
    const cardH = rows * rowH + 4;

    doc.setDrawColor(...colors.border);
    doc.setFillColor(...colors.white);
    doc.roundedRect(cardX, y, cardW, cardH, 3, 3, "FD");

    items.forEach((item, index) => {
      const col = columns === 2 ? index % 2 : 0;
      const row = Math.floor(index / columns);

      const x = cardX + col * colW + 4;
      const itemY = y + 7 + row * rowH;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.slate);
      doc.text(item.label.toUpperCase(), x, itemY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...colors.navy);

      const value = safeText(item.value);
      const lines = doc.splitTextToSize(value, colW - 10);
      doc.text(lines.slice(0, 2), x, itemY + 4);
    });

    y += cardH + 6;
  };

  const multilineCard = (label: string, value: any) => {
    ensurePage(22);

    const text = safeText(value);
    const lines = doc.splitTextToSize(text, pageWidth - marginX * 2 - 10);
    const h = Math.max(18, lines.length * 5 + 12);

    doc.setDrawColor(...colors.border);
    doc.setFillColor(...colors.white);
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, h, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...colors.slate);
    doc.text(label.toUpperCase(), marginX + 4, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.navy);
    doc.text(lines, marginX + 4, y + 12);

    y += h + 6;
  };

  const modernTable = (
    head: string[][],
    body: any[][],
    spaceAfter = 8
  ) => {
    ensurePage(30);

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      margin: { left: marginX, right: marginX },
      headStyles: {
        fillColor: colors.navy,
        textColor: colors.white,
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: colors.navy,
      },
      alternateRowStyles: {
        fillColor: colors.lightSlate,
      },
      styles: {
        lineColor: colors.border,
        lineWidth: 0.2,
        cellPadding: 2.5,
      },
    });

    y = ((doc as any).lastAutoTable?.finalY || y) + spaceAfter;
  };

  drawHeader();

  /* ================= PROJECT INFO ================= */

  sectionTitle("Case Information");

  infoCard(
    [
      {
        label: "Project Name",
        value: data.projectInfo?.projectName || "-",
      },
      {
        label: "Trip Leg",
        value: data.projectInfo?.tripLeg || "-",
      },
      {
        label: "Report Type",
        value: "Electronic Patient Care Report",
      },
    ],
    2
  );

  /* ================= PATIENT INFO ================= */

  sectionTitle("Patient Information");

  infoCard(
    [
      { label: "Patient ID", value: data.patientInfo?.patientId },
      {
        label: "Patient Name",
        value: `${data.patientInfo?.firstName || ""} ${
          data.patientInfo?.lastName || ""
        }`.trim(),
      },
      { label: "Age", value: data.patientInfo?.age },
      { label: "Gender", value: data.patientInfo?.gender },
      { label: "Phone", value: data.patientInfo?.phone },
      { label: "Nationality", value: data.patientInfo?.nationality },
      { label: "Weight KG", value: data.patientInfo?.weightKg },
      { label: "Factory", value: data.patientInfo?.factoryName },
    ],
    2
  );

  /* ================= TRIAGE ================= */

  sectionTitle("Triage & Complaints");

  infoCard(
    [
      { label: "Triage Level", value: data.patientInfo?.triageColor },
      {
        label: "Health Classification",
        value: data.patientInfo?.healthClassification,
      },
    ],
    2
  );

  multilineCard("Chief Complaints", data.patientInfo?.chiefComplaints);
  multilineCard("Signs & Symptoms", data.patientInfo?.signsAndSymptoms);

  /* ================= MEDICAL HISTORY ================= */

  sectionTitle("Relevant Medical History");

  multilineCard("Conditions", data.medicalHistory?.conditions);
  multilineCard("Eyes", data.medicalHistory?.eyes);
  multilineCard("Other", data.medicalHistory?.other);

  /* ================= HEAD TO TOE ================= */

  sectionTitle("Head-to-Toe Physical Examination");

  if (data.headToToe?.diagramImage) {
    ensurePage(105);

    doc.setDrawColor(...colors.border);
    doc.setFillColor(...colors.white);
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 100, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...colors.slate);
    doc.text("BODY PAIN DIAGRAM", marginX + 4, y + 6);

    doc.addImage(
      data.headToToe.diagramImage,
      "PNG",
      marginX + 5,
      y + 10,
      pageWidth - marginX * 2 - 10,
      84
    );

    y += 106;
  }

  infoCard(
    [
      {
        label: "General Appearance",
        value: data.headToToe?.generalAppearance,
      },
      { label: "Head / Neck", value: data.headToToe?.headNeck },
      { label: "Chest", value: data.headToToe?.chest },
      { label: "Abdomen", value: data.headToToe?.abdomen },
      { label: "Back / Pelvis", value: data.headToToe?.backPelvis },
      { label: "Extremities", value: data.headToToe?.extremities },
    ],
    2
  );

  multilineCard("Pain Locations", data.headToToe?.painLocations);
  multilineCard("Other", data.headToToe?.other);

  /* ================= NARRATIVE ================= */

  sectionTitle("Narrative");

  infoCard(
    [
      {
        label: "Contacted Medical Director",
        value: data.narrativeVitals?.contactedMedicalDirector,
      },
    ],
    1
  );

  multilineCard("Narrative", data.narrativeVitals?.narrative);

  /* ================= VITAL SIGNS ================= */

  sectionTitle("Vital Signs");

  modernTable(
    [["Time", "HR", "BP", "SpO2", "Temp", "GCS", "BGL"]],
    (data.narrativeVitals?.vitalsList || []).map((v: any) => [
      v.time?.timeHHMM || "-",
      safeText(v.hr),
      safeText(v.bp),
      safeText(v.spo2),
      safeText(v.temp),
      safeText(v.gcs),
      safeText(v.bgl),
    ])
  );

  /* ================= MEDICATIONS ================= */

  sectionTitle("Medications");

  modernTable(
    [["Medication", "Other", "Qty"]],
    (data.narrativeVitals?.medications || []).map((m: any) => [
      safeText(m.medication),
      safeText(m.other),
      safeText(m.qty),
    ])
  );

  /* ================= CONSUMABLES ================= */

  sectionTitle("Consumables");

  modernTable(
    [["Consumable", "Other", "Qty"]],
    (data.narrativeVitals?.consumables || []).map((c: any) => [
      safeText(c.consumable),
      safeText(c.other),
      safeText(c.qty),
    ])
  );

  /* ================= OUTCOME ================= */

  sectionTitle("Outcome");

  infoCard(
    [
      { label: "Destination", value: data.outcome?.destination },
      { label: "Hospital", value: data.outcome?.hospitalName },
      { label: "Hospital Member", value: data.outcome?.hospitalMember },
    ],
    2
  );

  ensurePage(42);

  doc.setDrawColor(...colors.border);
  doc.setFillColor(...colors.white);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, 38, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...colors.slate);
  doc.text("HOSPITAL SIGNATURE", marginX + 4, y + 6);
  doc.text("PATIENT SIGNATURE", pageWidth / 2 + 4, y + 6);

  if (data.outcome?.hospitalSignatureDataUrl) {
    doc.addImage(
      data.outcome.hospitalSignatureDataUrl,
      "PNG",
      marginX + 4,
      y + 10,
      62,
      22
    );
  }

  if (data.outcome?.patientSignatureDataUrl) {
    doc.addImage(
      data.outcome.patientSignatureDataUrl,
      "PNG",
      pageWidth / 2 + 4,
      y + 10,
      62,
      22
    );
  }

  y += 44;

  /* ================= TRANSFER TEAM ================= */

  sectionTitle("Transfer Team");

  (data.transferTeam?.members || []).forEach((member: any, idx: number) => {
    ensurePage(50);

    doc.setDrawColor(...colors.border);
    doc.setFillColor(...colors.white);
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 46, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...colors.blue);
    doc.text(`Paramedic #${idx + 1}`, marginX + 4, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.navy);

    doc.text(`Name: ${safeText(member.name)}`, marginX + 4, y + 14);
    doc.text(`Badge No: ${safeText(member.badgeNo)}`, marginX + 4, y + 20);
    doc.text(`Unit: ${safeText(member.unit)}`, marginX + 4, y + 26);
    doc.text(`Position: ${safeText(member.position)}`, marginX + 4, y + 32);

    if (member.signatureDataUrl) {
      doc.text("Signature:", pageWidth / 2 + 4, y + 14);
      doc.addImage(
        member.signatureDataUrl,
        "PNG",
        pageWidth / 2 + 4,
        y + 17,
        58,
        20
      );
    }

    y += 52;
  });

  /* ================= TIME ================= */

  sectionTitle("Time");

  const t = data.time || {};

  infoCard(
    [
      { label: "Moving Time", value: t.movingTime?.timeHHMM },
      { label: "Arrival Time", value: t.arrivalTime?.timeHHMM },
      { label: "Arrival to PT", value: t.arrivalToPTTime?.timeHHMM },
      { label: "Leaving Scene", value: t.leavingSceneTime?.timeHHMM },
      { label: "Hospital Time", value: t.hospitalTime?.timeHHMM },
      { label: "Waiting Time", value: t.waitingTime?.timeHHMM },
      { label: "Discharge Time", value: t.dischargeTime?.timeHHMM },
      { label: "Back Time", value: t.backTime?.timeHHMM },
    ],
    2
  );

  drawFooter();

  doc.save(`ePCR-${data.patientInfo?.patientId || "case"}.pdf`);
}
