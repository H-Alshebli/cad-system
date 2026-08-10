import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Lazem – Modern Electronic Patient Care Report (ePCR)
 */
export type EpcrPdfData = {
  brandLogoDataUrl?: string;
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
};

export function buildEpcrPdf(data: EpcrPdfData) {
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 14;
  let y = 14;

  const colors = {
    navy: [31, 70, 84] as [number, number, number],
    blue: [39, 76, 90] as [number, number, number],
    cyan: [116, 205, 218] as [number, number, number],
    slate: [118, 139, 148] as [number, number, number],
    lightSlate: [238, 244, 246] as [number, number, number],
    border: [211, 226, 231] as [number, number, number],
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
      drawContinuationHeader();
      y = 30;
    }
  };

  const drawFooter = () => {
    const page = doc.getNumberOfPages();

    doc.setDrawColor(...colors.border);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.slate);
    doc.text("Lazem Medical Services - ePCR Report", marginX, pageHeight - 7);
    doc.text(`Page ${page}`, pageWidth - marginX, pageHeight - 7, {
      align: "right",
    });
  };

  const drawHeader = () => {
    if (data.brandLogoDataUrl) {
      doc.addImage(data.brandLogoDataUrl, "PNG", marginX, 8, 18, 19.5);
    } else {
      doc.setFillColor(...colors.navy);
      doc.circle(marginX + 7, 20, 7, "F");
      doc.setTextColor(...colors.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("L", marginX + 7, 23.5, { align: "center" });
      doc.setTextColor(...colors.navy);
      doc.setFontSize(18);
      doc.text("Lazem", marginX + 18, 19);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.slate);
      doc.text("EMERGENCY MEDICAL SERVICES", marginX + 18, 25);
    }

    doc.setTextColor(...colors.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("PATIENT CARE REPORT", pageWidth - marginX, 18, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.slate);
    doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - marginX, 25, { align: "right" });

    doc.setDrawColor(...colors.navy);
    doc.setLineWidth(0.8);
    doc.line(marginX, 32, pageWidth - marginX, 32);

    y = 39;
  };

  const drawBodyFigure = (
    centerX: number,
    topY: number,
    side: "front" | "back",
    selected: string[]
  ) => {
    const drawZone = (
      id: string,
      label: string,
      shape: () => void,
      labelX: number,
      labelY: number,
      fontSize = 4.8
    ) => {
      const active = selected.includes(id);
      doc.setFillColor(...(active ? colors.navy : [222, 243, 247] as [number, number, number]));
      doc.setDrawColor(...(active ? colors.navy : [147, 190, 200] as [number, number, number]));
      doc.setLineWidth(active ? 0.8 : 0.45);
      shape();
      doc.setFont("helvetica", active ? "bold" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(...(active ? colors.white : colors.blue));
      doc.text(label, labelX, labelY, { align: "center" });
    };

    const isFront = side === "front";
    const ids = isFront
      ? {
          head: "Head", neck: "Neck", upper: "Chest", lower: "Abdomen",
          pelvis: "Pelvis", leftArm: "Left Arm", rightArm: "Right Arm",
          leftLeg: "Left Leg", rightLeg: "Right Leg",
        }
      : {
          head: "Back Head", neck: "__back_neck__", upper: "Back - Upper",
          lower: "Back - Lower", pelvis: "__back_pelvis__",
          leftArm: "Back - Left Arm", rightArm: "Back - Right Arm",
          leftLeg: "Back - Left Leg", rightLeg: "Back - Right Leg",
        };

    drawZone(ids.head, isFront ? "Head" : "Head", () => {
      doc.ellipse(centerX, topY + 6, 6.2, 6.8, "FD");
    }, centerX, topY + 7.5, 4.6);
    drawZone(ids.neck, "Neck", () => {
      doc.roundedRect(centerX - 3.2, topY + 13, 6.4, 4.5, 1.5, 1.5, "FD");
    }, centerX, topY + 16, 4);
    drawZone(ids.upper, isFront ? "Chest" : "Upper Back", () => {
      doc.roundedRect(centerX - 10.5, topY + 18, 21, 13.5, 4, 4, "FD");
    }, centerX, topY + 25.5, 4.5);
    drawZone(ids.lower, isFront ? "Abdomen" : "Lower Back", () => {
      doc.roundedRect(centerX - 9.2, topY + 32.5, 18.4, 11, 3, 3, "FD");
    }, centerX, topY + 38.8, 4.3);
    drawZone(ids.pelvis, "Pelvis", () => {
      doc.roundedRect(centerX - 8, topY + 44.5, 16, 7.5, 3, 3, "FD");
    }, centerX, topY + 49.2, 4.2);
    drawZone(ids.leftArm, "L Arm", () => {
      doc.roundedRect(centerX - 17.5, topY + 19.5, 5.8, 27, 2.5, 2.5, "FD");
    }, centerX - 14.6, topY + 34, 4);
    drawZone(ids.rightArm, "R Arm", () => {
      doc.roundedRect(centerX + 11.7, topY + 19.5, 5.8, 27, 2.5, 2.5, "FD");
    }, centerX + 14.6, topY + 34, 4);
    drawZone(ids.leftLeg, "L Leg", () => {
      doc.roundedRect(centerX - 8, topY + 53, 7, 24, 3, 3, "FD");
    }, centerX - 4.5, topY + 66, 4);
    drawZone(ids.rightLeg, "R Leg", () => {
      doc.roundedRect(centerX + 1, topY + 53, 7, 24, 3, 3, "FD");
    }, centerX + 4.5, topY + 66, 4);
  };

  const drawContinuationHeader = () => {
    doc.setTextColor(...colors.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Lazem EMS", marginX, 18);
    doc.text("PATIENT CARE REPORT - CONTINUED", pageWidth - marginX, 18, {
      align: "right",
    });
    doc.setDrawColor(...colors.navy);
    doc.setLineWidth(0.6);
    doc.line(marginX, 23, pageWidth - marginX, 23);
  };

  const sectionTitle = (title: string) => {
    ensurePage(16);

    doc.setFillColor(...colors.lightSlate);
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 8, 1.5, 1.5, "F");

    doc.setTextColor(...colors.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(title.toUpperCase(), marginX + 4, y + 5.5);

    y += 11;
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
    const text = safeText(value);
    const lines = doc.splitTextToSize(text, pageWidth - marginX * 2 - 10);
    const h = Math.max(18, lines.length * 5 + 12);
    ensurePage(h + 6);

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

  const summaryItems = [
    { label: "Age", value: data.patientInfo?.age ? `${data.patientInfo.age} yrs` : "-" },
    { label: "Sex", value: data.patientInfo?.gender },
    { label: "Triage", value: data.patientInfo?.triageColor },
    { label: "Class", value: data.patientInfo?.healthClassification },
    { label: "Project", value: data.projectInfo?.projectName },
  ];
  const summaryGap = 3;
  const summaryW = (pageWidth - marginX * 2 - summaryGap * 4) / 5;

  summaryItems.forEach((item, index) => {
    const x = marginX + index * (summaryW + summaryGap);
    doc.setFillColor(...colors.lightSlate);
    doc.setDrawColor(...colors.border);
    doc.roundedRect(x, y, summaryW, 18, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...colors.slate);
    doc.text(item.label.toUpperCase(), x + 3, y + 5);
    doc.setTextColor(...colors.navy);
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(safeText(item.value), summaryW - 6);
    doc.text(lines.slice(0, 2), x + 3, y + 11);
  });
  y += 23;

  doc.setFillColor(...colors.navy);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, 23, 3, 3, "F");
  doc.setTextColor(183, 219, 226);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CHIEF COMPLAINT", marginX + 5, y + 7);
  doc.setTextColor(...colors.white);
  doc.setFontSize(14);
  const complaint = doc.splitTextToSize(
    safeText(data.patientInfo?.chiefComplaints),
    pageWidth - marginX * 2 - 10
  );
  doc.text(complaint.slice(0, 1), marginX + 5, y + 16);
  y += 29;

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

  const complaintDetails = Object.entries(
    data.patientInfo?.chiefComplaintDetails || {}
  )
    .map(([key, value]) => `${key}: ${safeText(value)}`)
    .join("; ");
  multilineCard("Complaint Details", complaintDetails);
  multilineCard("Signs & Symptoms", data.patientInfo?.signsAndSymptoms);

  /* ================= MEDICAL HISTORY ================= */

  sectionTitle("Relevant Medical History");

  infoCard(
    [
      { label: "Conditions", value: data.medicalHistory?.conditions },
      { label: "Eyes", value: data.medicalHistory?.eyes },
      { label: "Other", value: data.medicalHistory?.other },
    ],
    2
  );

  /* ================= HEAD TO TOE ================= */

  sectionTitle("Head-to-Toe Physical Examination");

  ensurePage(111);
  const selectedPainLocations: string[] = data.headToToe?.painLocations || [];
  doc.setDrawColor(...colors.border);
  doc.setFillColor(...colors.white);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, 105, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...colors.slate);
  doc.text("BODY PAIN ASSESSMENT", marginX + 4, y + 7);
  doc.setFontSize(7);
  doc.text("FRONT", marginX + 55, y + 14, { align: "center" });
  doc.text("BACK", pageWidth - marginX - 55, y + 14, { align: "center" });
  drawBodyFigure(marginX + 55, y + 16, "front", selectedPainLocations);
  drawBodyFigure(pageWidth - marginX - 55, y + 16, "back", selectedPainLocations);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.slate);
  doc.text(
    `Selected areas: ${safeText(selectedPainLocations)}`,
    marginX + 4,
    y + 101
  );
  y += 111;

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

  drawFooter();
  doc.addPage();
  drawContinuationHeader();
  y = 30;
  sectionTitle("Outcome");

  infoCard(
    [
      {
        label: "Destination",
        value:
          data.outcome?.destination === "Won't Transfer or Treat"
            ? "No Transport and/or Treatment"
            : data.outcome?.destination,
      },
      ...(["No Transport and/or Treatment", "Won't Transfer or Treat"].includes(
        data.outcome?.destination
      )
        ? [
            {
              label: "No Transfer / Treatment Reason",
              value: data.outcome?.noTransferReason,
            },
            ...(data.outcome?.noTransferReason === "Other"
              ? [
                  {
                    label: "Other Reason Details",
                    value: data.outcome?.noTransferReasonOther,
                  },
                ]
              : []),
          ]
        : []),
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

  ensurePage(65);
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

  ensurePage(58);
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

  return doc;
}

export function generateEpcrPdf(data: EpcrPdfData) {
  const doc = buildEpcrPdf(data);
  doc.save(`ePCR-${data.patientInfo?.patientId || "case"}.pdf`);
}
