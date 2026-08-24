import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function getArg(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
}

const projectId = getArg("--project").trim();
const apply = process.argv.includes("--apply");

if (!projectId) {
  throw new Error("Missing --project=<firebase-project-id>.");
}

type MasterProjectMapping = {
  documentId: string;
  currentNames: string[];
  projectName: string;
  masterProjectId: string;
  projectCode: string | null;
  masterProjectName: string;
  masterSiteId: string;
  siteCode: string;
};

const mappings: MasterProjectMapping[] = [
  {
    documentId: "7YTNfV0Fry97HUPOEXps",
    currentNames: ["KAPSARC"],
    projectName: "KAPSARC",
    masterProjectId: "PRJ-0005",
    projectCode: "LZM-FMC-A+-KAP-23",
    masterProjectName: "KAPSARC",
    masterSiteId: "SIT-0005",
    siteCode: "SIT-KAP-01",
  },
  {
    documentId: "7iuta9OYFLATgesHcpE1",
    currentNames: ["National Museum", "Ministry of Culture – National Museum"],
    projectName: "Ministry of Culture – National Museum",
    masterProjectId: "PRJ-0001",
    projectCode: "LZM-CWA-B+-MOC-25",
    masterProjectName: "Ministry of Culture – National Museum",
    masterSiteId: "SIT-0001",
    siteCode: "SIT-MOC-01",
  },
  {
    documentId: "7tC67Gps2smBPRRe4B0D",
    currentNames: ["SCCF-Rumah", "Saudi Chemical – Remah"],
    projectName: "Saudi Chemical – Remah",
    masterProjectId: "PRJ-0006",
    projectCode: "LZM-CWA-B+-SCC-23",
    masterProjectName: "Saudi Chemical – Remah",
    masterSiteId: "SIT-0006",
    siteCode: "SIT-SCC-01",
  },
  {
    documentId: "AIeZRvUaMe7rc81qY5Sn",
    currentNames: ["Military Academy", "Academy of Defense Industries"],
    projectName: "Academy of Defense Industries",
    masterProjectId: "PRJ-0002",
    projectCode: "LZM-CLI-B+-ADI-24",
    masterProjectName: "Academy of Defense Industries",
    masterSiteId: "SIT-0002",
    siteCode: "SIT-ADI-01",
  },
  {
    documentId: "HxPnQ2Mj4pErqhQ2V2qY",
    currentNames: ["ICAD"],
    projectName: "ICAD",
    masterProjectId: "PRJ-0007",
    projectCode: "LZM-CWA-B+-ICD-25",
    masterProjectName: "ICAD",
    masterSiteId: "SIT-0007",
    siteCode: "SIT-ICD-01",
  },
  {
    documentId: "NfSHWIrP44jfiTLVwhol",
    currentNames: ["Ma’aden", "Ma'aden Ivanhoe – Mahd Al Dhahab"],
    projectName: "Ma'aden Ivanhoe – Mahd Al Dhahab",
    masterProjectId: "PRJ-0004",
    projectCode: "LZM-FMC-B+-MIE-24",
    masterProjectName: "Ma'aden Ivanhoe – Mahd Al Dhahab",
    masterSiteId: "SIT-0004",
    siteCode: "SIT-MIE-01",
  },
  {
    documentId: "y2QfHgrv50V4MYWqXVsC",
    currentNames: ["Qiddiya", "Senyar – Qiddiya"],
    projectName: "Senyar – Qiddiya",
    masterProjectId: "PRJ-0003",
    projectCode: "LZM-FMC-A-SYG-25",
    masterProjectName: "Senyar – Qiddiya",
    masterSiteId: "SIT-0003",
    siteCode: "SIT-SYG-01",
  },
  {
    documentId: "U5sXrmUMsN8PDIPZWlgg",
    currentNames: ["Modon Dmm", "MODON – Dammam"],
    projectName: "MODON – Dammam",
    masterProjectId: "PRJ-0009",
    projectCode: "LZM-FMC-A+-MDN-24",
    masterProjectName: "MODON",
    masterSiteId: "SIT-0011",
    siteCode: "SIT-MDN-03",
  },
  {
    documentId: "bkNwWwO9GAyPqWtYXtMP",
    currentNames: ["MODON – Jeddah (2nd & 3rd)", "MODON – Jeddah"],
    projectName: "MODON – Jeddah",
    masterProjectId: "PRJ-0009",
    projectCode: "LZM-FMC-A+-MDN-24",
    masterProjectName: "MODON",
    masterSiteId: "SIT-0012",
    siteCode: "SIT-MDN-04",
  },
  {
    documentId: "eAdizvdsQvLlfUcaFNjk",
    currentNames: ["MODON – Al Kharj", "MODON – Al-Kharj"],
    projectName: "MODON – Al-Kharj",
    masterProjectId: "PRJ-0009",
    projectCode: "LZM-FMC-A+-MDN-24",
    masterProjectName: "MODON",
    masterSiteId: "SIT-0009",
    siteCode: "SIT-MDN-01",
  },
  {
    documentId: "l5cI1AvdSHDKzzPSHZVV",
    currentNames: ["MODON – Sudair"],
    projectName: "MODON – Sudair",
    masterProjectId: "PRJ-0009",
    projectCode: "LZM-FMC-A+-MDN-24",
    masterProjectName: "MODON",
    masterSiteId: "SIT-0010",
    siteCode: "SIT-MDN-02",
  },
  {
    documentId: "xC3DCOoR5qFvPhXEeqG5",
    currentNames: ["MODON – Wa’ad Al-Shamal", "MODON – Wa'ad Al-Shamal"],
    projectName: "MODON – Wa'ad Al-Shamal",
    masterProjectId: "PRJ-0009",
    projectCode: "LZM-FMC-A+-MDN-24",
    masterProjectName: "MODON",
    masterSiteId: "SIT-0013",
    siteCode: "SIT-MDN-05",
  },
  {
    documentId: "eqCFgTnxkESSdNukfoli",
    currentNames: ["Pilot Project 01", "Lazem Ambulance Centre"],
    projectName: "Lazem Ambulance Centre",
    masterProjectId: "PRJ-0010",
    projectCode: null,
    masterProjectName: "Lazem Ambulance Centre",
    masterSiteId: "SIT-0014",
    siteCode: "SIT-LZM-01",
  },
];

async function main() {
  const app =
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  const db = getFirestore(app);

  const resolved = [] as Array<MasterProjectMapping & { currentName: string }>;
  const skipped: string[] = [];

  for (const mapping of mappings) {
  const snapshot = await db.collection("projects").doc(mapping.documentId).get();
  if (!snapshot.exists) {
    skipped.push(`${mapping.documentId}: document does not exist`);
    continue;
  }

  const currentName = String(snapshot.data()?.projectName || "").trim();
  if (!mapping.currentNames.includes(currentName)) {
    skipped.push(
      `${mapping.documentId}: expected ${mapping.currentNames.join(" | ")}, found ${currentName || "<blank>"}`
    );
    continue;
  }

  resolved.push({ ...mapping, currentName });
  }

  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${resolved.length} safe project mapping(s) in ${projectId}.`);
  for (const item of resolved) {
  console.log(
    `- ${item.documentId}: ${item.currentName} -> ${item.projectName} | ${item.masterProjectId} | ${item.projectCode || "pending official code"}`
  );
  }
  if (skipped.length) {
  console.log("Skipped for safety:");
  skipped.forEach((message) => console.log(`- ${message}`));
  }

  if (!apply) {
  console.log("No database changes were made. Re-run with --apply after reviewing this output.");
  process.exit(0);
  }

  if (skipped.length) {
  throw new Error("Apply stopped because one or more production records did not match the expected names.");
  }

  type PendingWrite = { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> };
  const writes: PendingWrite[] = [];

  for (const item of resolved) {
  const referenceData = {
    projectName: item.projectName,
    masterProjectId: item.masterProjectId,
    projectCode: item.projectCode,
    masterProjectName: item.masterProjectName,
    masterSiteId: item.masterSiteId,
    siteCode: item.siteCode,
    masterDataSource: "Lazem Operations Project and Job Master Data v1.0",
    masterDataSyncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  writes.push({ ref: db.collection("projects").doc(item.documentId), data: referenceData });

  for (const collectionName of ["cases", "epcr"] as const) {
    const related = await db
      .collection(collectionName)
      .where("projectId", "==", item.documentId)
      .get();
    related.docs.forEach((document) =>
      writes.push({
        ref: document.ref,
        data: {
          projectName: item.projectName,
          masterProjectId: item.masterProjectId,
          projectCode: item.projectCode,
          updatedAt: FieldValue.serverTimestamp(),
        },
      })
    );
  }

  const ambulances = await db
    .collection("ambulances")
    .where("assignedProjectId", "==", item.documentId)
    .get();
  ambulances.docs.forEach((document) =>
    writes.push({
      ref: document.ref,
      data: {
        assignedProjectName: item.projectName,
        projectName: item.projectName,
        masterProjectId: item.masterProjectId,
        projectCode: item.projectCode,
        updatedAt: FieldValue.serverTimestamp(),
      },
    })
  );
  }

  for (let offset = 0; offset < writes.length; offset += 400) {
  const batch = db.batch();
  for (const write of writes.slice(offset, offset + 400)) {
    batch.set(write.ref, write.data, { merge: true });
  }
  await batch.commit();
  }

  console.log(`Updated ${resolved.length} project master record(s) and ${writes.length - resolved.length} related record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
