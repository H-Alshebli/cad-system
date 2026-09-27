// Synthetic data only. No Firebase, network, or patient records.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app/epcr/[id]/page.tsx'), 'utf8');
const source = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const sync = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'casePatientSyncPayload');
const context = {};
vm.runInNewContext(ts.transpileModule(sync.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
const patient = { firstName: 'SYNTHETIC', lastName: 'ONLY', employeeId: 'EMP-0012', buildingNumber: '0007-A' };
const patch = context.casePatientSyncPayload(patient);
assert.equal(patch['patient.employeeId'], patient.employeeId);
assert.equal(patch['patient.buildingNumber'], patient.buildingNumber);
assert.equal(context.casePatientSyncPayload({})['patient.employeeId'], '');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/epcrPdf.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, {
  exports: exportsObject, require: name => {
    if (name === './epcrMedicalReview') {
      const policy = {};
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/epcrMedicalReview.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: policy });
      return policy;
    }
    if (!['jspdf', 'jspdf-autotable'].includes(name)) throw Error('Unexpected dependency');
    return require(name);
  },
});
for (const info of [patient, {}]) {
  const pdf = exportsObject.buildEpcrPdf({ patientInfo: info, medicalHistory: {}, narrativeVitals: {}, outcome: {}, transferTeam: {}, time: {} });
  const text = pdf.output();
  assert(text.includes('PATIENT EMPLOYEE ID'));
  assert(text.includes('BUILDING NUMBER'));
  if (info.employeeId) {
    assert(text.includes('EMP-0012')); assert(text.includes('0007-A'));
    if (process.argv.includes('--write-fixture')) {
      fs.mkdirSync(path.join(root, 'tmp/patient-fields-qa'), { recursive: true });
      fs.writeFileSync(path.join(root, 'tmp/patient-fields-qa/synthetic.pdf'), Buffer.from(pdf.output('arraybuffer')));
    }
  }
}
console.log('PASS: patient-only case mapping, text identifiers, PDF labels/values, and legacy missing fields. Synthetic data only.');
