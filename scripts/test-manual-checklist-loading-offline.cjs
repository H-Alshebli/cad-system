const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../app/projects/[projectId]/checklists/new/page.tsx"),
  "utf8"
);

const manualGate = source.indexOf('if (isManualMode && !selectedProjectId)');
const ambulanceLoad = source.indexOf('collection(db, "ambulances")');
assert(manualGate >= 0 && manualGate < ambulanceLoad, "manual checklist must not load ambulances before a project is selected");
assert(source.includes('where(documentId(), "in", ids)'), "manual checklist must request assigned ambulances only");
assert(source.includes('query(collection(db, "projectChecklists"), where("projectId", "==", checklistProjectId))'), "checklists must be scoped to the selected project");
assert(source.includes('query(collection(db, "cases"), where(field, "==", targetProjectId))'), "mission units must be scoped to the selected project");
assert(!source.includes('onSnapshot(\n      collection(db, "projectChecklists")'), "all-checklist live subscription must not return");

console.log("PASS manual checklist defers data loading until a project is selected and scopes ambulances, checklists, and missions. No network.");
