import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function getArg(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
}

const projectId = getArg("--project").trim();
const apply = process.argv.includes("--apply");
if (!projectId) throw new Error("Missing --project=<firebase-project-id>.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

function timestampMillis(data: Record<string, any>) {
  const raw = data.createdAt || data.timeline?.receivedAt || data.timeline?.Received;
  const date = raw?.toDate?.() || (raw ? new Date(raw) : null);
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

async function prepareCollection(
  collectionName: "cases" | "epcr",
  sequenceField: "caseSequence" | "epcrSequence",
  numberField: "caseNumber" | "epcrNumber",
  prefix: "HCAD" | "ePCR"
) {
  const snapshot = await db.collection(collectionName).get();
  const documents = [...snapshot.docs].sort((left, right) => {
    const timeDifference = timestampMillis(left.data()) - timestampMillis(right.data());
    return timeDifference || left.id.localeCompare(right.id);
  });
  const used = new Set(
    documents
      .map((document) => Number(document.get(sequenceField) || 0))
      .filter((value) => Number.isInteger(value) && value > 0)
  );
  let cursor = 1;
  const updates: Array<{
    ref: FirebaseFirestore.DocumentReference;
    sequence: number;
    number: string;
  }> = [];

  for (const document of documents) {
    const existingSequence = Number(document.get(sequenceField) || 0);
    const existingNumber = String(document.get(numberField) || "").trim();
    if (existingSequence > 0 && existingNumber) continue;

    while (used.has(cursor)) cursor += 1;
    updates.push({ ref: document.ref, sequence: cursor, number: `${prefix}-${cursor}` });
    used.add(cursor);
    cursor += 1;
  }

  const highestSequence = Math.max(0, ...used);
  return {
    collectionName,
    sequenceField,
    numberField,
    prefix,
    updates,
    highestSequence,
    total: documents.length,
    documents,
  };
}

async function main() {
  const plans = await Promise.all([
    prepareCollection("cases", "caseSequence", "caseNumber", "HCAD"),
    prepareCollection("epcr", "epcrSequence", "epcrNumber", "ePCR"),
  ]);

  const casePlan = plans[0];
  const epcrPlan = plans[1];
  const plannedCaseNumbers = new Map<string, string>();
  for (const document of casePlan.documents) {
    const existingNumber = String(document.get("caseNumber") || "").trim();
    if (existingNumber) plannedCaseNumbers.set(document.id, existingNumber);
  }
  for (const update of casePlan.updates) {
    plannedCaseNumbers.set(update.ref.id, update.number);
  }

  const epcrCaseNumberUpdates = epcrPlan.documents
  .map((document) => {
    const caseId = String(document.get("caseId") || document.id).trim();
    const caseNumber = plannedCaseNumbers.get(caseId) || "";
    if (!caseNumber || document.get("caseNumber") === caseNumber) return null;
    return { ref: document.ref, caseNumber };
  })
  .filter((value): value is { ref: FirebaseFirestore.DocumentReference; caseNumber: string } => Boolean(value));

  for (const plan of plans) {
    console.log(
      `${apply ? "APPLY" : "DRY RUN"}: ${plan.updates.length} of ${plan.total} ${plan.collectionName} record(s) need operational numbers; highest sequence will be ${plan.highestSequence}.`
    );
  }

  console.log(
    `${apply ? "APPLY" : "DRY RUN"}: ${epcrCaseNumberUpdates.length} ePCR record(s) need their linked HCAD case number.`
  );

  if (!apply) {
    console.log("No database changes were made. Re-run with --apply after reviewing the counts.");
    return;
  }

  for (const plan of plans) {
  for (let offset = 0; offset < plan.updates.length; offset += 400) {
    const batch = db.batch();
    for (const update of plan.updates.slice(offset, offset + 400)) {
      batch.update(update.ref, {
        [plan.sequenceField]: update.sequence,
        [plan.numberField]: update.number,
        operationalNumberBackfilledAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  await db.collection("systemCounters").doc(plan.collectionName === "cases" ? "case" : "epcr").set(
    {
      current: plan.highestSequence,
      prefix: plan.prefix,
      updatedAt: FieldValue.serverTimestamp(),
      source: "backfill",
    },
    { merge: true }
  );
  }


  for (let offset = 0; offset < epcrCaseNumberUpdates.length; offset += 400) {
    const batch = db.batch();
    for (const update of epcrCaseNumberUpdates.slice(offset, offset + 400)) {
      batch.update(update.ref, {
        caseNumber: update.caseNumber,
        operationalNumberBackfilledAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  console.log("Operational numbers were backfilled successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
