import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function getArg(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
}

const projectId = getArg("--project").trim();
const apply = process.argv.includes("--apply");
if (!projectId) throw new Error("Missing --project=<firebase-project-id>.");

type ProjectRepair = { documentId: string; projectName: string; removeMasterReference?: boolean };
const repairs: ProjectRepair[] = [
  { documentId: "7YTNfV0Fry97HUPOEXps", projectName: "KAPSARC" },
  { documentId: "7iuta9OYFLATgesHcpE1", projectName: "Ministry of Culture – National Museum" },
  { documentId: "7tC67Gps2smBPRRe4B0D", projectName: "Saudi Chemical – Remah" },
  { documentId: "AIeZRvUaMe7rc81qY5Sn", projectName: "Academy of Defense Industries" },
  { documentId: "HxPnQ2Mj4pErqhQ2V2qY", projectName: "ICAD" },
  { documentId: "NfSHWIrP44jfiTLVwhol", projectName: "Ma'aden Ivanhoe – Mahd Al Dhahab" },
  { documentId: "y2QfHgrv50V4MYWqXVsC", projectName: "Senyar – Qiddiya" },
  { documentId: "U5sXrmUMsN8PDIPZWlgg", projectName: "MODON – Dammam" },
  { documentId: "bkNwWwO9GAyPqWtYXtMP", projectName: "MODON – Jeddah" },
  { documentId: "eAdizvdsQvLlfUcaFNjk", projectName: "MODON – Al-Kharj" },
  { documentId: "l5cI1AvdSHDKzzPSHZVV", projectName: "MODON – Sudair" },
  { documentId: "xC3DCOoR5qFvPhXEeqG5", projectName: "MODON – Wa'ad Al-Shamal" },
  { documentId: "eqCFgTnxkESSdNukfoli", projectName: "Pilot Project 01", removeMasterReference: true },
];

function differs(value: unknown, expected: string) {
  return typeof value === "string" && value.trim() !== expected;
}

async function findRelatedDocuments(
  db: FirebaseFirestore.Firestore,
  collectionName: "cases" | "epcr" | "projectChecklists",
  documentId: string
) {
  const fieldsByCollection = {
    cases: ["projectId", "assignedProjectId", "sourceId"],
    epcr: ["projectId", "projectInfo.projectId", "projectInfo.id"],
    projectChecklists: ["projectId"],
  } as const;
  const documents = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const field of fieldsByCollection[collectionName]) {
    const snapshot = await db.collection(collectionName).where(field, "==", documentId).get();
    for (const document of snapshot.docs) documents.set(document.ref.path, document);
  }
  return [...documents.values()];
}

async function main() {
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(app);
  const pending: Array<{ path: string; before: string; after: string; ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];

  for (const repair of repairs) {
    const projectRef = db.collection("projects").doc(repair.documentId);
    const projectSnapshot = await projectRef.get();
    if (!projectSnapshot.exists) throw new Error(`Project ${repair.documentId} does not exist; audit stopped.`);
    const projectData = projectSnapshot.data() || {};
    const projectPatch: Record<string, unknown> = {};
    if (projectData.projectName !== repair.projectName) projectPatch.projectName = repair.projectName;
    if (repair.removeMasterReference) {
      for (const field of ["masterProjectId", "projectCode", "masterProjectName", "masterSiteId", "siteCode", "masterDataSource", "masterDataSyncedAt"])
        if (field in projectData) projectPatch[field] = FieldValue.delete();
    }
    if (Object.keys(projectPatch).length) {
      projectPatch.updatedAt = FieldValue.serverTimestamp();
      pending.push({ path: projectRef.path, before: String(projectData.projectName || "<blank>"), after: repair.projectName, ref: projectRef, data: projectPatch });
    }

    for (const collectionName of ["cases", "epcr", "projectChecklists"] as const) {
      const documents = await findRelatedDocuments(db, collectionName, repair.documentId);
      for (const document of documents) {
        const current = document.data();
        const patch: Record<string, unknown> = {};
        const oldNames: string[] = [];
        if (differs(current.projectName, repair.projectName)) { oldNames.push(`projectName=${current.projectName}`); patch.projectName = repair.projectName; }
        if (differs(current.assignedProjectName, repair.projectName)) { oldNames.push(`assignedProjectName=${current.assignedProjectName}`); patch.assignedProjectName = repair.projectName; }
        if (current.projectInfo && differs(current.projectInfo.projectName, repair.projectName)) {
          oldNames.push(`projectInfo.projectName=${current.projectInfo.projectName}`);
          patch.projectInfo = { ...current.projectInfo, projectName: repair.projectName };
        }
        if (repair.removeMasterReference)
          for (const field of ["masterProjectId", "projectCode"]) if (field in current) patch[field] = FieldValue.delete();
        if (Object.keys(patch).length) {
          patch.updatedAt = FieldValue.serverTimestamp();
          pending.push({ path: document.ref.path, before: oldNames.join(", ") || "incorrect test-project master reference", after: repair.projectName, ref: document.ref, data: patch });
        }
      }
    }

    const ambulances = await db.collection("ambulances").where("assignedProjectId", "==", repair.documentId).get();
    for (const document of ambulances.docs) {
      const current = document.data();
      const patch: Record<string, unknown> = {};
      const oldNames: string[] = [];
      for (const field of ["assignedProjectName", "projectName"] as const) {
        if (differs(current[field], repair.projectName)) { oldNames.push(`${field}=${current[field]}`); patch[field] = repair.projectName; }
      }
      if (repair.removeMasterReference)
        for (const field of ["masterProjectId", "projectCode"]) if (field in current) patch[field] = FieldValue.delete();
      if (Object.keys(patch).length) {
        patch.updatedAt = FieldValue.serverTimestamp();
        pending.push({ path: document.ref.path, before: oldNames.join(", ") || "incorrect test-project master reference", after: repair.projectName, ref: document.ref, data: patch });
      }
    }
  }

  console.log(`${apply ? "APPLY" : "AUDIT"}: ${pending.length} document(s) require correction in ${projectId}.`);
  for (const item of pending) console.log(`- ${item.path}: ${item.before} -> ${item.after}`);
  if (!apply) {
    console.log("No database changes were made. Use --apply only after explicit production approval.");
    return;
  }
  for (let offset = 0; offset < pending.length; offset += 400) {
    const batch = db.batch();
    for (const item of pending.slice(offset, offset + 400)) batch.set(item.ref, item.data, { merge: true });
    await batch.commit();
  }
  console.log(`Corrected ${pending.length} production document(s).`);
}

main().catch((error) => { console.error(error); process.exit(1); });
