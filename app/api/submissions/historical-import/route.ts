import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { getUserAccountType } from "@/lib/userAccounts";

export const runtime = "nodejs";

const HEADERS = [
  "Submission ID", "Project ID", "Project Name", "Report Date", "Patient First Name",
  "Patient Last Name", "Patient ID / Iqama", "Age", "Gender", "Phone", "Nationality",
  "Chief Complaint", "Signs and Symptoms", "Triage Level", "Health Classification",
  "Narrative", "Primary Assessment", "Secondary Assessment", "Impression", "Medications",
  "Procedures", "Oxygen Therapy", "Pickup Location", "Destination", "Crew Names",
  "Ambulance / Unit", "Original PDF URL", "Legacy Notes",
] as const;

type ImportRow = Record<string, unknown>;

function text(value: unknown) { return String(value ?? "").trim(); }
function list(value: unknown) { return text(value).split(/[;,\n]+/).map((item) => item.trim()).filter(Boolean); }
function safeAge(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 && parsed <= 130 ? parsed : null; }
function reportDate(value: unknown) { const date = new Date(text(value)); return Number.isNaN(date.getTime()) ? null : date; }
function referenceHash(value: string) { return createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 28); }

function pick(row: ImportRow, ...keys: string[]) {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return "";
}

function repeated(row: ImportRow, key: string) {
  return Object.entries(row)
    .filter(([candidate, value]) => (candidate === key || candidate.startsWith(`${key}_`)) && text(value))
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, value]) => text(value));
}

function jotformNumber(value: unknown) {
  const match = text(value).match(/(\d{3,})/);
  return match?.[1] || "";
}

function isJotformExport(row: ImportRow) {
  return "Submission Date" in row || "Prehospital Chief Complaints" in row || "Nerrative" in row || "Vital Sings" in row;
}

async function actor(request: NextRequest) {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const snapshot = await adminDb.collection("users").doc(token.uid).get();
    if (!snapshot.exists) return null;
    const user = snapshot.data() || {};
    if (user.active === false || getUserAccountType(user) === "client") return null;
    const role = String(user.role || "").trim();
    const isAdmin = ["admin", "super_admin", "superadmin"].includes(role.toLowerCase());
    const roleSnapshot = role && !isAdmin ? await adminDb.collection("roles").doc(role).get() : null;
    const canImport = isAdmin || roleSnapshot?.data()?.permissions?.submissions?.import === true;
    return canImport ? { uid: token.uid, email: token.email || text(user.email), name: text(user.name || user.displayName || token.email) } : null;
  } catch { return null; }
}

function normalize(row: ImportRow, rowNumber: number) {
  const rawJotform = isJotformExport(row);
  const submissionId = text(row["Submission ID"]);
  const date = reportDate(pick(row, "Report Date", "Submission Date", "Date", "Date 1"));
  const fullPatientName = pick(row, "Patient Name", "Patient Name / اسم المريض:", "Patient Name / اسم المريض");
  const configuredFirstName = text(row["Patient First Name"]);
  const configuredLastName = text(row["Patient Last Name"]);
  const firstName = configuredFirstName || fullPatientName;
  const lastName = configuredLastName;
  const projectName = pick(row, "Project Name", "Factory Name", "Project Name Other", "Test project 1");
  const complaintCategories = [
    "Prehospital Chief Complaints", "Cardiac Complaints", "Respiratory Complaints", "Neurological Complaints",
    "Gastrointestinal Complaints", "Psychiatric and Behavioral Complaints", "Metabolic and Endocrine Complaints",
    "Infectious Disease Complaints", "General Medical Complaints", "Obstetric and Gynecological Complaints",
    "Environmental and Toxicological Complaints", "Other Critical Complaints",
  ].flatMap((key) => list(row[key]));
  const complaint = pick(row, "Chief Complaint") || complaintCategories.join(" • ");
  const crewNames = rawJotform ? repeated(row, "Paramedic Name") : list(row["Crew Names"]);
  const crewBadges = repeated(row, "Badge NO.");
  const crewUnits = repeated(row, "Unit");
  const signatures = [
    ...repeated(row, "Signature"), ...repeated(row, "Paramedic Signature / توقيع الأخصائي"),
    ...repeated(row, "Patient Signature"), ...repeated(row, "Hospital Signature"),
    ...repeated(row, "Patient or guardian signature field /  خانة توقيع المريض او ولي الامر"),
    ...repeated(row, "Signature of the patient or guardian / توقيع المريض أو ولي الأمر"),
  ].filter(Boolean);
  const warnings: string[] = [];
  if (!submissionId) warnings.push("Submission ID is missing; duplicate detection will be limited");
  if (!text(row["Project ID"]) && !projectName) warnings.push("Project is missing");
  if (!date) warnings.push("Report Date is missing or invalid");
  if (!firstName && !lastName) warnings.push("Patient name is missing");
  if (!complaint) warnings.push("Chief Complaint is missing");
  if (rawJotform && !text(row["Nerrative"])) warnings.push("Jotform Narrative is missing");
  const unknownFields = Object.keys(row).filter((key) => !HEADERS.includes(key as any) && text(row[key]));
  if (unknownFields.length && !rawJotform) warnings.push(`${unknownFields.length} additional Jotform field(s) will be preserved in Legacy Data`);
  return {
    rowNumber,
    submissionId,
    reference: submissionId ? `JOTFORM-${submissionId}` : `JOTFORM-ROW-${rowNumber}`,
    sourceFormat: rawJotform ? "JOTFORM_EPCR_V1" : "HCAD_IMPORT_TEMPLATE",
    projectId: text(row["Project ID"]), projectName, date,
    firstName, lastName, fullPatientName: `${firstName} ${lastName}`.trim(),
    patientId: pick(row, "Patient ID / Iqama", "ID/Iqama", "ID Number / رقم الهوية الوطنية/ الإقامة:", "ID Number / رقم الهوية الوطنية/ الإقامة"),
    age: safeAge(row["Age"]), gender: text(row["Gender"]) || "unknown",
    phone: pick(row, "Phone", "Phone Number"), nationality: text(row["Nationality"]), complaint,
    complaintCategories, symptoms: list(pick(row, "Signs and Symptoms", "Signs & Symptoms")),
    triage: pick(row, "Triage Level", "Prehospital Triage Color-Coded Scale", "Final Reassessment Level"),
    finalTriage: text(row["Final Reassessment Level"]), classification: pick(row, "Health Classification", "Classification of Health Conditions"),
    narrative: pick(row, "Narrative", "Nerrative"), primaryAssessment: pick(row, "Primary Assessment", "Physical Examination"),
    secondaryAssessment: text(row["Secondary Assessment"]), impression: text(row["Impression"]),
    medicalHistory: text(row["Relevant Medical History"]), vitals: text(row["Vital Sings"]),
    medications: rawJotform ? repeated(row, "Medications") : list(row["Medications"]),
    consumables: repeated(row, "Consumables"), procedures: list(row["Procedures"]), oxygen: text(row["Oxygen Therapy"]),
    pickup: text(row["Pickup Location"]), destination: text(row["Destination"]), hospitalName: text(row["Hospital Name"]),
    crewNames, crewBadges, crewUnits, unit: pick(row, "Ambulance / Unit", "Unit"), signatures,
    refusal: pick(row, "Was care or transportation refused\\ هل تم رفض الرعاية أو النقل"),
    medicalDirectorContacted: text(row["Have you contacted the Medical Director?"]),
    legacyEpcrNumber: jotformNumber(pick(row, "ePCR No. / رقم التقرير:", "ePCR No. / رقم التقرير", "Unique ID")),
    timeline: {
      movingTime: text(row["Moving Time"]), arrivalToPatientTime: text(row["Arrival to PT Time"]), leavingSceneTime: text(row["Leaving Scene Time"]),
      hospitalTime: text(row["Hospital Time"]), waitingTime: text(row["Waiting Time"]), dischargeTime: text(row["Discharge Time"]),
      arrivalTime: text(row["Arrival Time"]), backTime: text(row["Back Time"]),
    },
    physicalExam: Object.fromEntries(["Eyes", "General Appearance", "Head/Neck", "Chest", "Abdomen", "Back/Pelvis", "Extremities", "Physical Examination"].map((key) => [key, text(row[key])]).filter(([, value]) => value)),
    originalPdfUrl: text(row["Original PDF URL"]), signedDocument: text(row["Signed Document"]),
    legacyNotes: text(row["Legacy Notes"]), raw: row, warnings,
  };
}

async function reserveRanges(count: number, actorId: string) {
  async function reserve(kind: "case" | "epcr", collection: string) {
    const counterRef = adminDb.collection("systemCounters").doc(kind);
    const [total, latest] = await Promise.all([
      adminDb.collection(collection).count().get(), adminDb.collection(collection).orderBy(kind === "case" ? "caseSequence" : "epcrSequence", "desc").limit(1).get(),
    ]);
    const liveCurrent = Math.max(Number(total.data().count || 0), latest.empty ? 0 : Number(latest.docs[0].get(kind === "case" ? "caseSequence" : "epcrSequence") || 0));
    return adminDb.runTransaction(async (transaction) => {
      const counter = await transaction.get(counterRef);
      const current = Math.max(Number(counter.get("current") || 0), liveCurrent);
      transaction.set(counterRef, { current: current + count, prefix: kind === "case" ? "HCAD" : "ePCR", updatedAt: FieldValue.serverTimestamp(), updatedBy: actorId }, { merge: true });
      return current + 1;
    });
  }
  return Promise.all([reserve("case", "cases"), reserve("epcr", "epcr")]);
}

export async function POST(request: NextRequest) {
  const authenticated = await actor(request);
  if (!authenticated) return NextResponse.json({ error: "Submissions import permission is required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = text(body.action || "preview");
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length || rows.length > 200) return NextResponse.json({ error: "Upload between 1 and 200 rows per batch." }, { status: 400 });
  const normalized = rows.map((row, index) => normalize(row, index + 2));
  const duplicateIds = new Set<string>();
  const seen = new Set<string>();
  normalized.forEach((row) => { if (row.submissionId && seen.has(row.submissionId)) duplicateIds.add(row.submissionId); seen.add(row.submissionId); });
  const checks = await Promise.all(normalized.map((row) => adminDb.collection("epcr").doc(`jotform_${referenceHash(row.reference)}`).get()));
  const preview = normalized.map((row, index) => {
    const duplicate = checks[index].exists || Boolean(row.submissionId && duplicateIds.has(row.submissionId));
    return { rowNumber: row.rowNumber, submissionId: row.submissionId, patientName: row.fullPatientName, project: row.projectName || row.projectId, reportDate: row.date?.toISOString() || "", sourceFormat: row.sourceFormat, legacyEpcrNumber: row.legacyEpcrNumber, status: duplicate ? "duplicate" : row.warnings.length ? "needs_review" : "ready", warnings: duplicate ? [...row.warnings, "Submission already exists or is repeated in this file"] : row.warnings };
  });
  const summary = { total: preview.length, ready: preview.filter((row) => row.status === "ready").length, needsReview: preview.filter((row) => row.status === "needs_review").length, duplicates: preview.filter((row) => row.status === "duplicate").length };
  if (action === "preview") return NextResponse.json({ preview, summary });
  if (action !== "import") return NextResponse.json({ error: "Invalid import action." }, { status: 400 });

  const importable = normalized.filter((_, index) => preview[index].status !== "duplicate");
  const batchRef = adminDb.collection("epcrImportBatches").doc();
  const [caseStart, epcrStart] = await reserveRanges(importable.length, authenticated.uid);
  const writer = adminDb.bulkWriter();
  importable.forEach((row, index) => {
    const id = `jotform_${referenceHash(row.submissionId ? row.reference : `${batchRef.id}-${row.rowNumber}`)}`;
    const caseNumber = `HCAD-${caseStart + index}`; const epcrNumber = `ePCR-${epcrStart + index}`;
    const createdAt = row.date ? Timestamp.fromDate(row.date) : FieldValue.serverTimestamp();
    const common = { sourceType: "JOTFORM_IMPORT", externalReference: row.reference, importBatchId: batchRef.id, importReviewStatus: row.warnings.length ? "needs_review" : "ready_for_review", importWarnings: row.warnings, importedAt: FieldValue.serverTimestamp(), importedBy: authenticated.uid, importedByName: authenticated.name };
    writer.create(adminDb.collection("cases").doc(id), { ...common, caseNumber, caseSequence: caseStart + index, projectId: row.projectId || null, projectName: row.projectName || null, patientName: row.fullPatientName, patient: { name: row.fullPatientName, phone: row.phone, age: row.age, gender: row.gender }, chiefComplaint: row.complaint, level: row.triage, locationText: row.pickup, location: { text: row.pickup, source: "jotform_import" }, destination: { name: row.hospitalName || row.destination, type: row.destination }, assignedUnit: row.unit ? { code: row.unit, type: "ambulance" } : null, status: "Closed", dispatchStatus: "Closed", historicalImport: true, createdAt, updatedAt: FieldValue.serverTimestamp() });
    writer.create(adminDb.collection("epcr").doc(id), { ...common, epcrId: id, epcrNumber, epcrSequence: epcrStart + index, caseId: id, caseNumber, projectId: row.projectId || null, projectName: row.projectName || null, projectInfo: { projectId: row.projectId, projectName: row.projectName }, patientInfo: { patientId: row.patientId, firstName: row.firstName, lastName: row.lastName, fullName: row.fullPatientName, age: row.age, gender: row.gender, phone: row.phone, nationality: row.nationality, triageColor: row.triage, finalReassessmentLevel: row.finalTriage, healthClassification: row.classification, chiefComplaints: row.complaintCategories.length ? row.complaintCategories : row.complaint ? [row.complaint] : [], signsAndSymptoms: row.symptoms, relevantMedicalHistory: row.medicalHistory }, narrative: { narrative: row.narrative }, assessment: { primaryAssessment: row.primaryAssessment, secondaryAssessment: row.secondaryAssessment, impression: row.impression, physicalExam: row.physicalExam, vitalsRaw: row.vitals }, treatment: { medications: row.medications.map((name) => ({ name, source: "jotform_import" })), consumables: row.consumables.map((name) => ({ name, source: "jotform_import" })), procedures: row.procedures, oxygenTherapy: row.oxygen }, outcome: { destination: row.destination, hospitalName: row.hospitalName, refusal: row.refusal, medicalDirectorContacted: row.medicalDirectorContacted }, timeline: row.timeline, caseSnapshot: { sourceType: "JOTFORM_IMPORT", assignedAmbulanceCode: row.unit, crewNames: row.crewNames, crewBadges: row.crewBadges, crewUnits: row.crewUnits }, legacyData: { source: "Jotform", sourceFormat: row.sourceFormat, submissionId: row.submissionId, legacyEpcrNumber: row.legacyEpcrNumber, originalPdfUrl: row.originalPdfUrl, signedDocument: row.signedDocument, signatureUrls: row.signatures, notes: row.legacyNotes, originalRow: row.raw }, status: "draft", locked: false, historicalImport: true, createdAt, updatedAt: FieldValue.serverTimestamp(), createdBy: authenticated.uid, createdByName: authenticated.name });
  });
  await writer.close();
  await batchRef.set({ fileName: text(body.fileName || "Jotform Import.xlsx"), status: "imported_for_review", summary: { ...summary, imported: importable.length, skippedDuplicates: summary.duplicates }, importedBy: authenticated.uid, importedByName: authenticated.name, importedByEmail: authenticated.email, createdAt: FieldValue.serverTimestamp(), rows: preview });
  return NextResponse.json({ batchId: batchRef.id, summary: { ...summary, imported: importable.length, skippedDuplicates: summary.duplicates } });
}
