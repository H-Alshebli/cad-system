// Synthetic fixtures only; imports no Firebase SDK and reads no patient files.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { unzipSync, strFromU8 } = require('fflate');
const root = path.resolve(__dirname, '..');
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const exports = {}; cache[file] = exports;
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib', file + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, Date, Uint8Array, Error, require: name => name.startsWith('./') ? load(name.slice(2)) : ['xlsx','fflate'].includes(name) ? require(name) : (() => { throw Error('Unexpected dependency'); })() });
  return exports;
}
const { buildSubmissionsWorkbook } = load('submissionsWorkbook');
const { BASIC_COLUMNS, FULL_COLUMNS, exportValue } = load('submissionsExport');
const narrative = ('Synthetic long narrative only. اختبار نص عربي\n').repeat(150);
const row = {
  caseItem: { id: 'TEST', caseNumber: 'HCAD-TEST', patientName: 'SYNTHETIC ONLY', projectId: 'TEST-PROJECT', status: 'Closed', createdAt: new Date(2026, 8, 21, 12, 30) },
  epcr: { id: 'TEST', epcrNumber: 'ePCR-TEST', status: 'draft', locked: false, patientInfo: { age: 0, patientId: '001234', phone: '005500', chiefComplaints: ['Respiratory complaints'], chiefComplaintDetails: { 'Respiratory complaints': ['SYNTHETIC DETAIL'] } }, narrativeVitals: { narrative, vitalsList: [{ hr: '80', time: { timeHHMM: '00:00' } }], medications: [{ medication: '=1+1', qty: '1' }] }, transferTeam: { members: [{ name: 'TEST CREW 1', badgeNo: '001' }, { name: 'TEST CREW 2' }] }, time: { movingTime: { timeHHMM: '00:00' } }, secretField: 'MUST-NOT-EXPORT', legacyData: { originalRow: { arbitrary: 'MUST-NOT-EXPORT' } }, outcome: { patientSignatureDataUrl: 'data:image/png;base64,MUST-NOT-EXPORT' } },
};
row.epcr.patientInfo.employeeId = 'EMP-0012';
row.epcr.patientInfo.buildingNumber = '0007-A';
for (const mode of ['basic', 'full']) {
  const bytes = buildSubmissionsWorkbook([row, { caseItem: { id: 'NO-REPORT', caseNumber: 'HCAD-NONE', patientName: '=HYPERLINK("https://invalid.example")' } }], mode);
  const files = unzipSync(bytes);
  for (const [name, data] of Object.entries(files)) if (name.endsWith('.xml')) assert(!strFromU8(data).includes('MUST-NOT-EXPORT'));
  const book = XLSX.read(bytes, { type: 'array', cellStyles: true, cellNF: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  const columns = mode === 'full' ? FULL_COLUMNS : BASIC_COLUMNS;
  assert.equal(matrix[0].length, columns.length); assert.equal(matrix.length, 3);
  assert.equal(new Set(matrix[0]).size, matrix[0].length);
  const val = title => matrix[1][matrix[0].indexOf(title)];
  assert.equal(val('Age'), 0); assert.equal(val('Moving Time'), 0);
  assert.equal(matrix[2][1], 'Not Created');
  assert.equal(sheet.D3.t, 's'); assert.equal(sheet.D3.f, undefined);
  assert.equal(sheet['!rows'][1].hpt, 30);
  const xml = strFromU8(files['xl/worksheets/sheet1.xml']);
  assert(xml.includes('state="frozen"')); assert(xml.includes('xSplit="2" ySplit="1"')); assert(xml.includes('<autoFilter'));
  assert(strFromU8(files['xl/styles.xml']).includes('wrapText="1"'));
  if (mode === 'full') {
    assert.equal(val('Narrative'), narrative);
    assert.equal(val('Patient ID / Iqama'), '001234');
    assert.equal(val('Patient Employee ID'), 'EMP-0012');
    assert.equal(val('Building Number'), '0007-A');
    assert.equal(matrix[2][matrix[0].indexOf('Building Number')] || '', '');
    assert.equal(val('Paramedic 2 Name'), 'TEST CREW 2');
    assert.equal(val('Respiratory complaints'), 'SYNTHETIC DETAIL');
    assert(val('Medications').includes('=1+1'));
  } else assert(!matrix[0].includes('Narrative'));
  if (process.argv.includes('--write-fixtures')) {
    fs.mkdirSync(path.join(root, 'tmp/export-qa'), { recursive: true });
    fs.writeFileSync(path.join(root, `tmp/export-qa/${mode}.xlsx`), bytes);
  }
  console.log(`PASS ${mode}: ${columns.length} unique headers, typed dates/numbers, midnight/zero, missing report, long text, privacy allowlist, freeze/filter/compact rows, no formulas.`);
}
assert.throws(() => buildSubmissionsWorkbook([], 'basic'));
assert.throws(() => exportValue('a'.repeat(32768)), /limit/);
assert.equal(exportValue('bad-time', 'time'), 'bad-time');
assert.equal(exportValue('001234'), '001234');
const many = buildSubmissionsWorkbook(Array.from({ length: 55 }, () => row), 'basic');
const manyBook = XLSX.read(many, { type: 'array' });
assert.equal(XLSX.utils.sheet_to_json(manyBook.Sheets[manyBook.SheetNames[0]], { header: 1 }).length, 56);
const integration = fs.readFileSync(path.join(root, 'app/components/CaseEpcrSubmissionsTable.tsx'), 'utf8');
assert(integration.includes('setExportSelection([...filteredRows])'));
assert(!integration.includes('exportToCsv'));
console.log('PASS: empty results and oversized text fail explicitly; identifiers preserved. No real records inspected.');
