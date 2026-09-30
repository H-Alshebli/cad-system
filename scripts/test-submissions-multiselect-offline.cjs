const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const source = fs.readFileSync(path.join(__dirname, '../app/components/CaseEpcrSubmissionsTable.tsx'), 'utf8');
const start = source.indexOf('  const filteredRows = useMemo(() => {');
const end = source.indexOf('  const projectOptions', start);
const filterCode = source.slice(start, end) + '\nfilteredRows;';
const rows = [
  { caseItem: { id: '1', status: 'Closed', project: 'A' }, epcr: { status: 'finalized' } },
  { caseItem: { id: '2', status: 'Open', project: 'B' }, epcr: { status: 'draft' } },
  { caseItem: { id: '3', status: 'Closed', project: 'C' }, epcr: null },
];
function filter(overrides = {}) {
  return vm.runInNewContext(filterCode, {
    rows, search: '', caseStatusFilter: [], epcrStatusFilter: [], selectedProject: [], fromDateTime: '', toDateTime: '',
    useMemo: fn => fn(), getProjectName: c => c.project, getPatientName: () => '', getChiefComplaint: () => '',
    getTriage: () => '', getDestination: () => '', getEpcrStatus: e => e?.status || 'Not Created',
    matchesSubmissionDate: () => true, ...overrides,
  }).map(row => row.caseItem.id).join(',');
}
assert.equal(filter(), '1,2,3');
assert.equal(filter({ selectedProject: ['A', 'B'], caseStatusFilter: ['closed', 'open'], epcrStatusFilter: ['draft', 'finalized'] }), '1,2');
assert.equal(filter({ selectedProject: ['A', 'B'], caseStatusFilter: ['closed'] }), '1');
assert.equal(filter({ epcrStatusFilter: ['Not Created', 'draft'] }), '2,3');
assert.equal(filter({ selectedProject: ['A'], epcrStatusFilter: ['draft'] }), '');
assert.equal(filter({ search: 'B', selectedProject: ['A', 'B'] }), '2');
assert.equal(filter({ fromDateTime: '2026-09-30', toDateTime: '2026-09-01' }), '');
assert.equal(filter({ matchesSubmissionDate: () => false }), '');
assert(source.includes('setExportSelection([...filteredRows])'));
assert(source.includes('setSelectedProject([])') && source.includes('setCaseStatusFilter([])') && source.includes('setEpcrStatusFilter([])'));
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/components/SubmissionsMultiSelect.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject, require: name => name === 'react' ? { useRef: () => ({ current: null }) } : require(name) });
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  return [...(tree.type === type ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => nodes(child, type))];
}
let value = [];
function render() { return exportsObject.default({ label: 'Project', allLabel: 'All projects', options: ['A', 'B'], value, onChange: next => { value = Array.from(next); } }); }
nodes(render(), 'input')[0].props.onChange({ target: { checked: true } });
nodes(render(), 'input')[1].props.onChange({ target: { checked: true } });
assert.deepEqual(value, ['A', 'B']);
assert(nodes(render(), 'input').every(node => node.props.checked));
nodes(render(), 'input')[0].props.onChange({ target: { checked: false } });
assert.deepEqual(value, ['B']);
nodes(render(), 'button')[0].props.onClick();
assert.deepEqual(value, []);
console.log('PASS multiple selections, deselection, clear, OR within filters, AND across filters, search/date compatibility, reset and full matching export wiring. Synthetic data only.');
