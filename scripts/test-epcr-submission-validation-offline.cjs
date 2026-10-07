const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "lib", "epcrSubmissionValidation.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const validation = {};
vm.runInNewContext(compiled, { exports: validation, Set });

const report = (chiefComplaints, chiefComplaintDetails = {}) => ({
  patientInfo: { patientId: "1000000000", firstName: "Test", lastName: "Patient", age: 30, triageColor: "Green", healthClassification: "Stable", chiefComplaints, chiefComplaintDetails, signsAndSymptoms: ["None"] },
  narrativeVitals: { contactedMedicalDirector: "No", narrative: "Synthetic test", vitalsList: [{ hr: "70", bp: "120/80", spo2: "99" }] },
  outcome: { destination: "Home" },
  transferTeam: { members: [{ name: "Medic", signatureDataUrl: "synthetic" }] },
  time: { arrivalTime: { timeHHMM: "10:00" }, movingTime: { timeHHMM: "10:05" } },
});

assert(!validation.submissionErrors(report(["General health illness"])).some(error => error.startsWith("Complaint details:")));
assert(validation.submissionErrors(report(["Cardiac complaints"])).includes("Complaint details: Cardiac complaints"));
assert(!validation.submissionErrors(report(["Cardiac complaints"], { "Cardiac complaints": ["Chest Pain"] })).some(error => error.startsWith("Complaint details:")));
console.log("PASS: legacy complaint names do not block finalization; supported complaints still require details.");
