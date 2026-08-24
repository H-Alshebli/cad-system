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

const app =
  getApps()[0] ||
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
const db = getFirestore(app);

function isPartTime(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "") === "parttime";
}

const snapshot = await db.collection("users").get();
const matches = snapshot.docs.filter((document) => {
  const data = document.data();
  return (
    isPartTime(data.crewProfile?.employmentType) ||
    isPartTime(data.employmentType)
  );
});

console.log(
  `${apply ? "APPLY" : "DRY RUN"}: found ${matches.length} user profile(s) to change from Part Time to Locum in ${projectId}.`
);

if (!apply) {
  console.log("No database changes were made. Re-run with --apply after reviewing the count.");
  process.exit(0);
}

for (let offset = 0; offset < matches.length; offset += 400) {
  const batch = db.batch();
  for (const document of matches.slice(offset, offset + 400)) {
    const data = document.data();
    const update: Record<string, any> = {
      "crewProfile.employmentType": "Locum",
      crewProfileUpdatedAt: FieldValue.serverTimestamp(),
      profileUpdatedAt: FieldValue.serverTimestamp(),
      crewProfileEmploymentTypeMigratedAt: FieldValue.serverTimestamp(),
      crewProfileEmploymentTypeMigratedFrom: "Part Time",
    };
    if (isPartTime(data.employmentType)) {
      update.employmentType = "Locum";
    }
    batch.update(document.ref, update);
  }
  await batch.commit();
}

console.log(`Updated ${matches.length} user profile(s) successfully.`);
