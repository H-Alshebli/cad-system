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
type ProjectOption = { id: string; projectName: string; projectCode: string; masterProjectId: string; aliases: string[] };

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

function yesNo(value: unknown) {
  const normalized = text(value).toLowerCase();
  if (normalized.startsWith("yes")) return "yes";
  if (normalized.startsWith("no")) return "no";
  return "";
}

function parseVitals(value: unknown) {
  const raw = text(value);
  const read = (label: string) => raw.match(new RegExp(`${label}:\\s*([^,]*)`, "i"))?.[1]?.trim() || "";
  return [{ temp: read("Temp"), hr: read("HR"), bp: read("BP"), spo2: read("SPo2"), gcs: read("GCS"), bgl: read("BGL"), time: { timeHHMM: read("Time") } }];
}

function parseItems(value: unknown, kind: "Medications" | "Consumables") {
  const raw = text(value);
  if (!raw) return [];
  return raw.split(new RegExp(`\\n(?=${kind}:)`, "i")).map((entry) => {
    const read = (label: string, next: string) => entry.match(new RegExp(`${label}:\\s*(.*?)(?=,\\s*(?:${next}):|$)`, "i"))?.[1]?.trim() || "";
    const name = read(kind, "Other|Qty|Routes of Drug Administration|Drug Dose");
    const other = read("Other", "Qty|Routes of Drug Administration|Drug Dose");
    const qty = read("Qty", "Routes of Drug Administration|Drug Dose");
    if (kind === "Medications") {
      const route = read("Routes of Drug Administration", "Drug Dose");
      const dose = read("Drug Dose", "$a");
      return { medication: name || "Other", other: [other, route && `Route: ${route}`, dose && `Dose: ${dose}`].filter(Boolean).join("; "), qty };
    }
    return { consumable: name || "Other", other, qty };
  });
}

function normalizeTriage(value: string) {
  if (/level\s*5/i.test(value)) return "Level 5 (non-urgent)";
  if (/level\s*4/i.test(value)) return "Level 4 (Less Urgent)";
  if (/level\s*3/i.test(value)) return "Level 3 (Urgent)";
  if (/level\s*2/i.test(value)) return "Level 2 (Emergent)";
  if (/level\s*1/i.test(value)) return "Level 1 (Resuscitation)";
  if (/death/i.test(value)) return "death";
  return value;
}

function normalizeClassification(value: string) {
  if (/occupational injuries|^occupational$/i.test(value)) return "Occupational";
  if (/non.?occupational/i.test(value)) return "Non-Occupational";
  if (/general health/i.test(value)) return "General Health Illnesses";
  if (/unspecified/i.test(value)) return "Unspecified Medical Conditions";
  return value ? "other" : "";
}

function clinicalFields(row: ReturnType<typeof normalize>) {
  const raw = row.raw;
  const names = row.crewNames; const badges = row.crewBadges; const units = row.crewUnits;
  const positions = repeated(raw, "Position"); const crewSignatures = repeated(raw, "Signature");
  const destinationRaw = row.destination;
  const refused = yesNo(row.refusal) === "yes";
  const destination = refused ? "No Transport and/or Treatment" : /treated on scene/i.test(destinationRaw) ? "Treated on Scene" : /hospital/i.test(destinationRaw) ? "Scene to Hospital" : destinationRaw;
  const knownComplaints = ["Cardiac complaints", "Respiratory complaints", "Musculoskeletal complaints", "Digestive complaints", "Metabolic and endocrine complaints", "General medical complaints", "Environmental and toxicological complaints", "Obstetric and gynecology complaints", "Gastrointestinal complaints", "Behavioral and psychological complaints", "Infectious disease complaints", "Other critical complaints"];
  const primaryComplaints = list(raw["Prehospital Chief Complaints"]);
  const chiefComplaints = Array.from(new Set((primaryComplaints.length ? primaryComplaints : row.complaintCategories).map((item) => knownComplaints.find((known) => known.toLowerCase() === item.toLowerCase()) || "Other")));
  const detailSources: Array<[string, string]> = [["Cardiac Complaints", "Cardiac complaints"], ["Respiratory Complaints", "Respiratory complaints"], ["Neurological Complaints", "Other"], ["Gastrointestinal Complaints", "Gastrointestinal complaints"], ["Psychiatric and Behavioral Complaints", "Behavioral and psychological complaints"], ["Metabolic and Endocrine Complaints", "Metabolic and endocrine complaints"], ["Infectious Disease Complaints", "Infectious disease complaints"], ["General Medical Complaints", "General medical complaints"], ["Obstetric and Gynecological Complaints", "Obstetric and gynecology complaints"], ["Environmental and Toxicological Complaints", "Environmental and toxicological complaints"], ["Other Critical Complaints", "Other critical complaints"]];
  const chiefComplaintDetails = detailSources.reduce<Record<string, string[]>>((result, [source, target]) => {
    const values = list(raw[source]);
    if (values.length) result[target] = [...(result[target] || []), ...values];
    return result;
  }, {});
  return {
    patientInfo: {
      patientId: row.patientId, firstName: row.firstName, lastName: row.lastName, age: row.age, gender: row.gender.toLowerCase(), phone: row.phone,
      weightKg: safeAge(raw["Weight KG"]), factoryName: row.originalProjectName, nationality: row.nationality,
      triageColor: normalizeTriage(row.triage), healthClassification: normalizeClassification(row.classification), chiefComplaints,
      chiefComplaintDetails, signsAndSymptoms: row.symptoms,
    },
    medicalHistory: { conditions: list(raw["Relevant Medical History"]), eyes: list(raw["Eyes"]), other: text(raw["Other"]) },
    headToToe: { generalAppearance: text(raw["General Appearance"]), headNeck: text(raw["Head/Neck"]), chest: text(raw["Chest"]), abdomen: text(raw["Abdomen"]), backPelvis: text(raw["Back/Pelvis"]), extremities: text(raw["Extremities"]), other: text(raw["Other_1"] || raw["Physical Examination"]), painLocations: [] },
    narrativeVitals: { contactedMedicalDirector: yesNo(row.medicalDirectorContacted), narrative: row.narrative, vitalsList: parseVitals(row.vitals), medications: parseItems(row.medications.join("\n"), "Medications"), consumables: parseItems(row.consumables.join("\n"), "Consumables") },
    outcome: { destination, noTransferReason: refused ? "Patient Refused Transport" : destination === "Treated on Scene" ? "Transport No Longer Required" : "", noTransferReasonOther: "", hospitalName: row.hospitalName, hospitalMember: text(raw["Hospital Member"]), hospitalSignatureDataUrl: text(raw["Hospital Signature"]), patientSignatureDataUrl: text(raw["Patient Signature"]) },
    transferTeam: { members: [0, 1].map((index) => ({ name: names[index] || "", badgeNo: badges[index] || "", unit: units[index] || "", position: positions[index] || "", signatureDataUrl: crewSignatures[index] || "" })) },
    time: { movingTime: { timeHHMM: row.timeline.movingTime }, arrivalToPTTime: { timeHHMM: row.timeline.arrivalToPatientTime }, leavingSceneTime: { timeHHMM: row.timeline.leavingSceneTime }, hospitalTime: { timeHHMM: row.timeline.hospitalTime }, waitingTime: { timeHHMM: row.timeline.waitingTime }, dischargeTime: { timeHHMM: row.timeline.dischargeTime }, arrivalTime: { timeHHMM: row.timeline.arrivalTime }, backTime: { timeHHMM: row.timeline.backTime } },
  };
}

function projectKey(value: unknown) {
  return text(value).toLocaleLowerCase("en").normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
}

function resolveProject(projectId: string, projectName: string, projects: ProjectOption[]) {
  const direct = projectId ? projects.find((project) => project.id === projectId) : null;
  if (direct) return direct;
  const wanted = projectKey(projectName);
  if (!wanted) return null;
  return projects.find((project) => [project.projectName, project.projectCode, project.masterProjectId, ...project.aliases].some((value) => projectKey(value) === wanted)) || null;
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

function normalize(row: ImportRow, rowNumber: number, projects: ProjectOption[], projectMappings: Record<string, string>) {
  const rawJotform = isJotformExport(row);
  const submissionId = text(row["Submission ID"]);
  const date = reportDate(pick(row, "Report Date", "Submission Date", "Date", "Date 1"));
  const fullPatientName = pick(row, "Patient Name", "Patient Name / اسم المريض:", "Patient Name / اسم المريض");
  const configuredFirstName = text(row["Patient First Name"]);
  const configuredLastName = text(row["Patient Last Name"]);
  const patientNameParts = fullPatientName.split(/\s+/).filter(Boolean);
  const firstName = configuredFirstName || (patientNameParts.length > 1 ? patientNameParts.slice(0, -1).join(" ") : fullPatientName);
  const lastName = configuredLastName || (patientNameParts.length > 1 ? patientNameParts.at(-1) || "" : "");
  const primaryProjectName = pick(row, "Project Name", "Factory Name", "Test project 1");
  const projectName = projectKey(primaryProjectName) === "other" ? pick(row, "Project Name Other", "Factory Name", "Test project 1") : primaryProjectName || text(row["Project Name Other"]);
  const suppliedProjectId = text(row["Project ID"]);
  const mappedProjectId = text(projectMappings[projectName]);
  const matchedProject = resolveProject(mappedProjectId || suppliedProjectId, projectName, projects);
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
  if (!suppliedProjectId && !projectName) warnings.push("Project is missing");
  else if (!matchedProject) warnings.push(`Project \"${projectName || suppliedProjectId}\" is not linked to an HCAD project`);
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
    projectId: matchedProject?.id || suppliedProjectId, projectName: matchedProject?.projectName || projectName, originalProjectName: projectName, date,
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
  const projectMappings: Record<string, string> = body.projectMappings && typeof body.projectMappings === "object" && !Array.isArray(body.projectMappings) ? body.projectMappings : {};
  const projectSnapshot = await adminDb.collection("projects").get();
  const projects: ProjectOption[] = projectSnapshot.docs.map((document) => {
    const data = document.data() || {};
    return {
      id: document.id,
      projectName: text(data.projectName || data.name),
      projectCode: text(data.projectCode),
      masterProjectId: text(data.masterProjectId),
      aliases: Array.isArray(data.importAliases) ? data.importAliases.map(text).filter(Boolean) : [],
    };
  });
  if (action === "repair") {
    const imported = await adminDb.collection("epcr").where("sourceType", "==", "JOTFORM_IMPORT").limit(200).get();
    const repairable = imported.docs.filter((document) => {
      const data = document.data() || {};
      return data.clinicalMappingVersion !== 1 && data.legacyData?.originalRow && typeof data.legacyData.originalRow === "object";
    });
    const writer = adminDb.bulkWriter();
    repairable.forEach((document, index) => {
      const data = document.data() || {};
      const normalized = normalize(data.legacyData.originalRow as ImportRow, index + 2, projects, {});
      writer.update(document.ref, { ...clinicalFields(normalized), clinicalMappingVersion: 1, clinicalMappingRepairedAt: FieldValue.serverTimestamp(), clinicalMappingRepairedBy: authenticated.uid, updatedAt: FieldValue.serverTimestamp() });
    });
    await writer.close();
    return NextResponse.json({ repaired: repairable.length, inspected: imported.size });
  }
  if (!rows.length || rows.length > 200) return NextResponse.json({ error: "Upload between 1 and 200 rows per batch." }, { status: 400 });
  const normalized = rows.map((row, index) => normalize(row, index + 2, projects, projectMappings));
  const duplicateIds = new Set<string>();
  const seen = new Set<string>();
  normalized.forEach((row) => { if (row.submissionId && seen.has(row.submissionId)) duplicateIds.add(row.submissionId); seen.add(row.submissionId); });
  const checks = await Promise.all(normalized.map((row) => adminDb.collection("epcr").doc(`jotform_${referenceHash(row.reference)}`).get()));
  const preview = normalized.map((row, index) => {
    const duplicate = checks[index].exists || Boolean(row.submissionId && duplicateIds.has(row.submissionId));
    return { rowNumber: row.rowNumber, submissionId: row.submissionId, patientName: row.fullPatientName, project: row.projectName || row.projectId, originalProject: row.originalProjectName, projectId: row.projectId, reportDate: row.date?.toISOString() || "", sourceFormat: row.sourceFormat, legacyEpcrNumber: row.legacyEpcrNumber, status: duplicate ? "duplicate" : row.warnings.length ? "needs_review" : "ready", warnings: duplicate ? [...row.warnings, "Submission already exists or is repeated in this file"] : row.warnings };
  });
  const summary = { total: preview.length, ready: preview.filter((row) => row.status === "ready").length, needsReview: preview.filter((row) => row.status === "needs_review").length, duplicates: preview.filter((row) => row.status === "duplicate").length };
  if (action === "preview") return NextResponse.json({ preview, summary, projectOptions: projects.map(({ id, projectName, projectCode }) => ({ id, projectName, projectCode })).sort((left, right) => left.projectName.localeCompare(right.projectName)) });
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
    writer.create(adminDb.collection("epcr").doc(id), { ...common, epcrId: id, epcrNumber, epcrSequence: epcrStart + index, caseId: id, caseNumber, projectId: row.projectId || null, projectName: row.projectName || null, projectInfo: { projectId: row.projectId, projectName: row.projectName }, narrative: { narrative: row.narrative }, assessment: { primaryAssessment: row.primaryAssessment, secondaryAssessment: row.secondaryAssessment, impression: row.impression, physicalExam: row.physicalExam, vitalsRaw: row.vitals }, treatment: { medications: row.medications.map((name) => ({ name, source: "jotform_import" })), consumables: row.consumables.map((name) => ({ name, source: "jotform_import" })), procedures: row.procedures, oxygenTherapy: row.oxygen }, timeline: row.timeline, caseSnapshot: { sourceType: "JOTFORM_IMPORT", assignedAmbulanceCode: row.unit, crewNames: row.crewNames, crewBadges: row.crewBadges, crewUnits: row.crewUnits }, legacyData: { source: "Jotform", sourceFormat: row.sourceFormat, submissionId: row.submissionId, legacyEpcrNumber: row.legacyEpcrNumber, originalPdfUrl: row.originalPdfUrl, signedDocument: row.signedDocument, signatureUrls: row.signatures, notes: row.legacyNotes, originalRow: row.raw }, ...clinicalFields(row), clinicalMappingVersion: 1, status: "draft", locked: false, historicalImport: true, createdAt, updatedAt: FieldValue.serverTimestamp(), createdBy: authenticated.uid, createdByName: authenticated.name });
  });
  await writer.close();
  await batchRef.set({ fileName: text(body.fileName || "Jotform Import.xlsx"), status: "imported_for_review", summary: { ...summary, imported: importable.length, skippedDuplicates: summary.duplicates }, importedBy: authenticated.uid, importedByName: authenticated.name, importedByEmail: authenticated.email, createdAt: FieldValue.serverTimestamp(), rows: preview });
  return NextResponse.json({ batchId: batchRef.id, summary: { ...summary, imported: importable.length, skippedDuplicates: summary.duplicates } });
}
