import { getCaseDisplayCode } from "@/lib/displayLabels";

export type ClientCaseExportLabels = {
  reportTitle: string;
  generatedAt: string;
  caseNumber: string;
  project: string;
  dateTime: string;
  status: string;
  caller: string;
  patient: string;
  complaint: string;
  location: string;
  unit: string;
  received: string;
  assigned: string;
  enRoute: string;
  onScene: string;
  transporting: string;
  hospital: string;
  returning: string;
  closed: string;
  timelineDetails: string;
};

type ExportOptions = {
  filename: string;
  sheetName?: string;
  locale: string;
  labels: ClientCaseExportLabels;
  statusLabel?: (status?: string) => string;
};

function asDate(value: any): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : value?.toDate?.() || new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function caseDate(item: any) {
  return asDate(
    item?.timeline?.receivedAt ||
      item?.timeline?.Received ||
      item?.createdAt ||
      item?.created_at ||
      item?.date
  );
}

function timelineDate(item: any, newKey: string, oldKey: string) {
  return asDate(item?.timeline?.[newKey] || item?.timeline?.[oldKey]);
}

function formatDate(value: Date | null, locale: string) {
  return value
    ? value.toLocaleString(locale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

function unitName(item: any) {
  return (
    item?.assignedUnit?.code ||
    item?.assignedUnit?.name ||
    item?.ambulanceCode ||
    item?.roaming ||
    item?.clinicName ||
    "-"
  );
}

function rows(cases: any[], options: ExportOptions) {
  const { labels, locale, statusLabel = (value) => value || "-" } = options;
  return cases.map((item) => {
    const stages = [
      [labels.received, "receivedAt", "Received"],
      [labels.assigned, "assignedAt", "Assigned"],
      [labels.enRoute, "enRouteAt", "EnRoute"],
      [labels.onScene, "onSceneAt", "OnScene"],
      [labels.transporting, "transportingAt", "Transporting"],
      [labels.hospital, "hospitalAt", "Hospital"],
      [labels.returning, "returningAt", "Returning"],
      [labels.closed, "closedAt", "Closed"],
    ] as const;
    const stageValues = stages.map(([label, newKey, oldKey]) =>
      `${label}: ${formatDate(timelineDate(item, newKey, oldKey), locale)}`
    );
    return ({
    [labels.caseNumber]: getCaseDisplayCode(item),
    [labels.project]: item?.projectName || "-",
    [labels.dateTime]: formatDate(caseDate(item), locale),
    [labels.status]: statusLabel(item?.status),
    [labels.caller]: item?.callerName || "-",
    [labels.patient]: item?.patientName || "-",
    [labels.complaint]: item?.chiefComplaint || "-",
    [labels.location]: item?.locationDescription || item?.location?.text || "-",
    [labels.unit]: unitName(item),
    [labels.received]: formatDate(timelineDate(item, "receivedAt", "Received"), locale),
    [labels.assigned]: formatDate(timelineDate(item, "assignedAt", "Assigned"), locale),
    [labels.enRoute]: formatDate(timelineDate(item, "enRouteAt", "EnRoute"), locale),
    [labels.onScene]: formatDate(timelineDate(item, "onSceneAt", "OnScene"), locale),
    [labels.transporting]: formatDate(timelineDate(item, "transportingAt", "Transporting"), locale),
    [labels.hospital]: formatDate(timelineDate(item, "hospitalAt", "Hospital"), locale),
    [labels.returning]: formatDate(timelineDate(item, "returningAt", "Returning"), locale),
    [labels.closed]: formatDate(timelineDate(item, "closedAt", "Closed"), locale),
    [labels.timelineDetails]: stageValues.join(" | "),
  });
  });
}

export async function exportClientCasesExcel(cases: any[], options: ExportOptions) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows(cases, options));
  worksheet["!cols"] = [
    { wch: 16 }, { wch: 28 }, { wch: 23 }, { wch: 20 },
    { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 36 }, { wch: 18 },
    ...Array.from({ length: 8 }, () => ({ wch: 23 })),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, (options.sheetName || "Cases").slice(0, 31));
  XLSX.writeFile(workbook, `${options.filename}.xlsx`);
}

export async function exportClientCasesPdf(cases: any[], options: ExportOptions) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const data = rows(cases, options);
  const compactHeaders = [
    options.labels.caseNumber,
    options.labels.project,
    options.labels.dateTime,
    options.labels.status,
    options.labels.patient,
    options.labels.complaint,
    options.labels.location,
    options.labels.unit,
    options.labels.timelineDetails,
  ];

  doc.setFillColor(39, 76, 90);
  doc.rect(0, 0, pageWidth, 27, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Lazem HCAD", 12, 11);
  doc.setFontSize(12);
  doc.text(options.labels.reportTitle, 12, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${options.labels.generatedAt}: ${new Date().toLocaleString(options.locale)}`,
    pageWidth - 12,
    19,
    { align: "right" }
  );

  autoTable(doc, {
    startY: 33,
    head: [compactHeaders],
    body: data.map((row) => compactHeaders.map((header) => row[header] || "-")),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, textColor: [39, 76, 90] },
    headStyles: { fillColor: [39, 76, 90], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [237, 248, 250] },
    margin: { left: 8, right: 8 },
  });

  doc.save(`${options.filename}.pdf`);
}
