import { getCaseDisplayCode, getEpcrDisplayCode } from "./displayLabels";
import { getEpcrStatus } from "./epcrStatus";
import { medicalReviewLabel } from "./epcrMedicalReview";

export type ExportMode = "basic" | "full";
type Doc = Record<string, any>;
export type ExportRow = { caseItem: Doc; epcr?: Doc };
export type ExportColumn = { title: string; width: number; kind?: "date" | "time" | "number"; get: (row: ExportRow) => unknown };
const text = (value: any): string => value == null ? "" : Array.isArray(value) ? value.map(text).filter(Boolean).join("; ") : typeof value === "object" ? "" : String(value);
const e = (r: ExportRow) => r.epcr || {};
const column = (title: string, get: ExportColumn["get"], width = 24, kind?: ExportColumn["kind"]): ExportColumn => ({ title, get, width, kind });
const field = (title: string, path: string, width = 28, kind?: ExportColumn["kind"]) => column(title, r => path.split(".").reduce((value, key) => value?.[key], e(r)), width, kind);
const items = (value: unknown, fields: [string, string][]) => Array.isArray(value) ? value.map((item, i) => typeof item === "object" && item ? `${i + 1}. ` + fields.map(([key, label]) => { const val = key.split(".").reduce((v, k) => v?.[k], item); return text(val) ? `${label}: ${text(val)}` : ""; }).filter(Boolean).join("; ") : text(item)).join("\n") : text(value);

export const BASIC_COLUMNS: ExportColumn[] = [
  column("Case Ref", r => getCaseDisplayCode(r.caseItem), 18),
  column("ePCR Ref", r => r.epcr ? getEpcrDisplayCode(r.epcr) : "Not Created", 18),
  column("Project Name", r => e(r).projectInfo?.projectName || r.caseItem.projectName || r.caseItem.projectId || e(r).projectId, 28),
  column("Patient Name", r => r.caseItem.patient?.name || r.caseItem.patientName || [e(r).patientInfo?.firstName, e(r).patientInfo?.lastName].filter(Boolean).join(" "), 28),
  field("Age", "patientInfo.age", 10, "number"), field("Gender", "patientInfo.gender", 12),
  column("Chief Complaint", r => r.caseItem.chiefComplaint || e(r).patientInfo?.chiefComplaints, 40),
  column("Triage / Level", r => e(r).patientInfo?.triageColor || r.caseItem.level, 25),
  column("Case Status", r => r.caseItem.status, 18), column("ePCR Status", r => getEpcrStatus(r.epcr), 18),
  column("Medical Review", r => r.epcr ? medicalReviewLabel(r.epcr) : "Not Created", 28),
  column("Case Created At", r => r.caseItem.createdAt, 23, "date"),
  field("ePCR Created At", "createdAt", 23, "date"), field("ePCR Finalized At", "finalizedAt", 23, "date"),
  ...([ ["Moving Time", "movingTime"], ["Arrival Time", "arrivalTime"], ["Arrival To Patient Time", "arrivalToPTTime"], ["Leaving Scene Time", "leavingSceneTime"], ["Hospital Time", "hospitalTime"], ["Waiting Time", "waitingTime"], ["Discharge Time", "dischargeTime"], ["Back Time", "backTime"] ] as const).map(([title, key]) => field(title, `time.${key}.timeHHMM`, 20, "time")),
  column("Destination", r => r.caseItem.destination?.name || e(r).outcome?.hospitalName || e(r).outcome?.destination, 32),
];
const complaints = ["Cardiac complaints", "Respiratory complaints", "Musculoskeletal complaints", "Digestive complaints", "Metabolic and endocrine complaints", "General medical complaints", "Environmental and toxicological complaints", "Obstetric and gynecology complaints", "Gastrointestinal complaints", "Behavioral and psychological complaints", "Infectious disease complaints", "Other critical complaints", "Other"];
export const FULL_COLUMNS: ExportColumn[] = [
  ...BASIC_COLUMNS,
  field("Patient ID / Iqama", "patientInfo.patientId"),
  field("Patient Employee ID", "patientInfo.employeeId"),
  field("Building Number", "patientInfo.buildingNumber"),
  field("ID Unavailable Reason", "patientInfo.patientIdUnavailableReason"), field("ID Unavailable Other", "patientInfo.patientIdUnavailableOther"),
  column("Phone Number", r => e(r).patientInfo?.phone || r.caseItem.patient?.phone || r.caseItem.contactNumber),
  field("Nationality", "patientInfo.nationality"), field("Weight (kg)", "patientInfo.weightKg", 16, "number"), field("Factory Name", "patientInfo.factoryName"),
  field("Health Classification", "patientInfo.healthClassification"), field("Prehospital Chief Complaints", "patientInfo.chiefComplaints", 40),
  ...complaints.map(name => column(name === "Other" ? "Other Complaint Details" : name, r => e(r).patientInfo?.chiefComplaintDetails?.[name], 36)),
  field("Signs & Symptoms", "patientInfo.signsAndSymptoms", 40),
  field("Relevant Medical History", "medicalHistory.conditions", 40), field("Eyes", "medicalHistory.eyes"), field("Medical History Other", "medicalHistory.other", 40),
  ...([ ["General Appearance", "generalAppearance"], ["Head / Neck", "headNeck"], ["Chest", "chest"], ["Abdomen", "abdomen"], ["Back / Pelvis", "backPelvis"], ["Extremities", "extremities"], ["Examination Other", "other"], ["Pain Locations", "painLocations"] ] as const).map(([title, key]) => field(title, `headToToe.${key}`, 32)),
  field("Medical Director Contacted", "narrativeVitals.contactedMedicalDirector"),
  column("Narrative", r => e(r).narrativeVitals?.narrative || e(r).narrative?.narrative, 48),
  column("Vital Signs", r => items(e(r).narrativeVitals?.vitalsList, [["time.timeHHMM", "Time"], ["temp", "Temperature"], ["hr", "HR"], ["bp", "BP"], ["spo2", "SpO2"], ["gcs", "GCS"], ["bgl", "BGL"]]), 48),
  column("Medications", r => items(e(r).narrativeVitals?.medications || e(r).treatment?.medications, [["medication", "Medication"], ["name", "Name"], ["other", "Other"], ["qty", "Quantity"]]), 40),
  column("Consumables", r => items(e(r).narrativeVitals?.consumables || e(r).treatment?.consumables, [["consumable", "Consumable"], ["name", "Name"], ["other", "Other"], ["qty", "Quantity"]]), 40),
  field("Primary Assessment", "assessment.primaryAssessment", 40), field("Secondary Assessment", "assessment.secondaryAssessment", 40), field("Impression", "assessment.impression", 40), field("Procedures", "treatment.procedures", 40), field("Oxygen Therapy", "treatment.oxygenTherapy"),
  field("Outcome", "outcome.destination"), field("Hospital Name", "outcome.hospitalName"), field("Hospital Member", "outcome.hospitalMember"),
  field("No Transfer Reason", "outcome.noTransferReason", 32), field("No Transfer Reason Other", "outcome.noTransferReasonOther", 40),
  ...[0, 1].flatMap(index => ([ ["Name", "name"], ["Badge No.", "badgeNo"], ["Unit", "unit"], ["Position", "position"] ] as const).map(([title, key]) => column(`Paramedic ${index + 1} ${title}`, r => e(r).transferTeam?.members?.[index]?.[key]))),
  field("Created By Name", "createdByName"), field("Legacy Notes", "legacyData.notes", 40),
];

export function exportColumns(mode: ExportMode) { return mode === "full" ? FULL_COLUMNS : BASIC_COLUMNS; }
export function exportValue(value: unknown, kind?: ExportColumn["kind"]): string | number {
  if (value == null || value === "") return "";
  if (kind === "date") {
    const raw = value as any;
    const date = raw?.toDate ? raw.toDate() : value instanceof Date ? value : new Date(value as string);
    if (!Number.isFinite(date.getTime())) return text(value);
    // Excel has no timezone. Match the user's local date/time filters and labels.
    return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()) - Date.UTC(1899, 11, 30)) / 86400000;
  }
  if (kind === "time") {
    const match = /^(\d{1,2}):(\d{2})$/.exec(text(value));
    if (match && +match[1] < 24 && +match[2] < 60) return (+match[1] * 60 + +match[2]) / 1440;
  }
  if (kind === "number" && text(value).trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  const output = text(value);
  if (output.length > 32767) throw new Error("A text field exceeds Excel's cell limit. Narrow the export or review the source; no text was truncated.");
  return output;
}
