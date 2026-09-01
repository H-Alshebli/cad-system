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
  const submissionId = text(row["Submission ID"]);
  const date = reportDate(row["Report Date"]);
  const warnings: string[] = [];
  if (!submissionId) warnings.push("Submission ID is missing; duplicate detection will be limited");
  if (!text(row["Project ID"]) && !text(row["Project Name"])) warnings.push("Project is missing");
  if (!date) warnings.push("Report Date is missing or invalid");
  if (!text(row["Patient First Name"]) && !text(row["Patient Last Name"])) warnings.push("Patient name is missing");
  if (!text(row["Chief Complaint"])) warnings.push("Chief Complaint is missing");
  const unknownFields = Object.keys(row).filter((key) => !HEADERS.includes(key as any) && text(row[key]));
  if (unknownFields.length) warnings.push(`${unknownFields.length} additional Jotform field(s) will be preserved in Legacy Data`);
  return {
    rowNumber,
    submissionId,
    reference: submissionId ? `JOTFORM-${submissionId}` : `JOTFORM-ROW-${rowNumber}`,
    projectId: text(row["Project ID"]), projectName: text(row["Project Name"]), date,
    firstName: text(row["Patient First Name"]), lastName: text(row["Patient Last Name"]),
    patientId: text(row["Patient ID / Iqama"]), age: safeAge(row["Age"]), gender: text(row["Gender"]) || "unknown",
    phone: text(row["Phone"]), nationality: text(row["Nationality"]), complaint: text(row["Chief Complaint"]),
    symptoms: list(row["Signs and Symptoms"]), triage: text(row["Triage Level"]), classification: text(row["Health Classification"]),
    narrative: text(row["Narrative"]), primaryAssessment: text(row["Primary Assessment"]), secondaryAssessment: text(row["Secondary Assessment"]),
    impression: text(row["Impression"]), medications: list(row["Medications"]), procedures: list(row["Procedures"]), oxygen: text(row["Oxygen Therapy"]),
    pickup: text(row["Pickup Location"]), destination: text(row["Destination"]), crewNames: list(row["Crew Names"]), unit: text(row["Ambulance / Unit"]),
    originalPdfUrl: text(row["Original PDF URL"]), legacyNotes: text(row["Legacy Notes"]), raw: row, warnings,
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
    return { rowNumber: row.rowNumber, submissionId: row.submissionId, patientName: `${row.firstName} ${row.lastName}`.trim(), project: row.projectName || row.projectId, reportDate: row.date?.toISOString() || "", status: duplicate ? "duplicate" : row.warnings.length ? "needs_review" : "ready", warnings: duplicate ? [...row.warnings, "Submission already exists or is repeated in this file"] : row.warnings };
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
    writer.create(adminDb.collection("cases").doc(id), { ...common, caseNumber, caseSequence: caseStart + index, projectId: row.projectId || null, projectName: row.projectName || null, patientName: `${row.firstName} ${row.lastName}`.trim(), patient: { name: `${row.firstName} ${row.lastName}`.trim(), phone: row.phone, age: row.age, gender: row.gender }, chiefComplaint: row.complaint, level: row.triage, locationText: row.pickup, location: { text: row.pickup, source: "jotform_import" }, destination: { name: row.destination }, assignedUnit: row.unit ? { code: row.unit, type: "ambulance" } : null, status: "Closed", dispatchStatus: "Closed", historicalImport: true, createdAt, updatedAt: FieldValue.serverTimestamp() });
    writer.create(adminDb.collection("epcr").doc(id), { ...common, epcrId: id, epcrNumber, epcrSequence: epcrStart + index, caseId: id, caseNumber, projectId: row.projectId || null, projectName: row.projectName || null, projectInfo: { projectId: row.projectId, projectName: row.projectName }, patientInfo: { patientId: row.patientId, firstName: row.firstName, lastName: row.lastName, age: row.age, gender: row.gender, phone: row.phone, nationality: row.nationality, triageColor: row.triage, healthClassification: row.classification, chiefComplaints: row.complaint ? [row.complaint] : [], signsAndSymptoms: row.symptoms }, narrative: { narrative: row.narrative }, assessment: { primaryAssessment: row.primaryAssessment, secondaryAssessment: row.secondaryAssessment, impression: row.impression }, treatment: { medications: row.medications.map((name) => ({ name, source: "jotform_import" })), procedures: row.procedures, oxygenTherapy: row.oxygen }, outcome: { destination: row.destination }, caseSnapshot: { sourceType: "JOTFORM_IMPORT", assignedAmbulanceCode: row.unit, crewNames: row.crewNames }, legacyData: { source: "Jotform", submissionId: row.submissionId, originalPdfUrl: row.originalPdfUrl, notes: row.legacyNotes, originalRow: row.raw }, status: "draft", locked: false, historicalImport: true, createdAt, updatedAt: FieldValue.serverTimestamp(), createdBy: authenticated.uid, createdByName: authenticated.name });
  });
  await writer.close();
  await batchRef.set({ fileName: text(body.fileName || "Jotform Import.xlsx"), status: "imported_for_review", summary: { ...summary, imported: importable.length, skippedDuplicates: summary.duplicates }, importedBy: authenticated.uid, importedByName: authenticated.name, importedByEmail: authenticated.email, createdAt: FieldValue.serverTimestamp(), rows: preview });
  return NextResponse.json({ batchId: batchRef.id, summary: { ...summary, imported: importable.length, skippedDuplicates: summary.duplicates } });
}
