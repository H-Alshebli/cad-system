import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function argument(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() || "";
}

const projectId = argument("--project");
const apply = process.argv.includes("--apply");

if (!projectId) throw new Error("Missing --project=<firebase-project-id>.");
if (apply && projectId !== "lazem-hcad-sandbox") {
  throw new Error("This repair can only write to lazem-hcad-sandbox. Run without --apply to audit another project.");
}

async function main() {
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(app);
  const users = await db.collection("users").select("active", "accountType", "accountStatus").get();
  const candidates = users.docs.filter((document) => {
    const user = document.data();
    const status = String(user.accountStatus || "").trim().toLowerCase();
    return !("active" in user)
      && user.accountType !== "client"
      && !["inactive", "suspended", "pending"].includes(status);
  });

  const inactive = users.docs.filter((document) => document.data().active === false).length;
  const clients = users.docs.filter((document) => document.data().accountType === "client").length;
  console.log(`${apply ? "APPLY" : "AUDIT"}: ${candidates.length} legacy employee record(s) have no active field in ${projectId}.`);
  console.log(`Summary: ${users.size} users scanned; ${inactive} explicitly inactive; ${clients} client account(s).`);
  if (!apply) {
    console.log("No records were changed. To repair the sandbox records after review, rerun with --apply.");
    return;
  }

  for (let offset = 0; offset < candidates.length; offset += 400) {
    const batch = db.batch();
    for (const document of candidates.slice(offset, offset + 400)) {
      batch.update(document.ref, { active: true, activeBackfilledAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }
  console.log(`Repaired ${candidates.length} sandbox employee record(s).`);
}

main().catch((error) => { console.error(error); process.exit(1); });
