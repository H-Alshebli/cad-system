// Actual creation functions, in-memory mocks only. No Firebase or network access.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.resolve(__dirname, '../lib/epcr.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function setup() {
  const records = new Map();
  let ids = 0, numbers = 0, writes = 0;
  let queue = Promise.resolve();
  const api = {
    collection: (_db, name) => ({ name }),
    doc: (base, name, id) => base.name ? { id: `fake-${++ids}`, key: `${base.name}/fake-${ids}` } : { id, key: `${name}/${id}` },
    getDoc: async ref => { const value = records.get(ref.key); return { exists: () => !!value, data: () => value, id: ref.id }; },
    setDoc: async (ref, value) => { writes++; records.set(ref.key, value); },
    serverTimestamp: () => 'FAKE-TIMESTAMP',
    runTransaction: (_db, fn) => {
      const result = queue.then(async () => {
        const pending = [];
        await fn({ get: api.getDoc, set: (ref, value) => pending.push([ref, value]) });
        for (const [ref, value] of pending) { writes++; records.set(ref.key, value); }
      });
      queue = result.catch(() => {});
      return result;
    },
    writeBatch: () => {
      const pending = [];
      return { set: (ref, value) => pending.push([ref, value]), commit: async () => { for (const [ref, value] of pending) { writes++; records.set(ref.key, value); } } };
    },
  };
  const exports = {};
  const ctx = vm.createContext({ exports, require: name => {
    if (name === 'firebase/firestore') return api;
    if (name === '@/lib/firebase') return { db: {} };
    if (name === '@/lib/operationalNumbers') return { reserveOperationalNumber: async kind => ({ number: `${kind}-${++numbers}`, sequence: numbers }) };
    throw new Error(`Unmocked import blocked: ${name}`);
  } });
  vm.runInContext(js, ctx);
  return { exports, records, stats: () => ({ writes, numbers, reports: [...records.keys()].filter(k => k.startsWith('epcr/')).length, cases: [...records.keys()].filter(k => k.startsWith('cases/')).length }) };
}
(async () => {
  const sequential = setup();
  await sequential.exports.createEpcrFromCase({ id: 'TEST-CASE' }, 'TEST-USER');
  await sequential.exports.createEpcrFromCase({ id: 'TEST-CASE' }, 'TEST-USER');
  assert.equal(sequential.stats().writes, 1);
  console.log('Same case, sequential:', sequential.stats());
  const concurrent = setup();
  await Promise.all([concurrent.exports.createEpcrFromCase({ id: 'TEST-CASE' }, 'TEST-A'), concurrent.exports.createEpcrFromCase({ id: 'TEST-CASE' }, 'TEST-B')]);
  assert.equal(concurrent.stats().reports, 1);
  assert.equal(concurrent.stats().writes, 1);
  console.log('Same case, simultaneous:', concurrent.stats());
  const manual = setup();
  const args = { requestId: '00000000-0000-4000-8000-000000000001', projectId: 'TEST-PROJECT', projectName: 'Synthetic', createdBy: 'TEST-USER' };
  await Promise.all([manual.exports.createManualEpcr(args), manual.exports.createManualEpcr(args)]);
  assert.equal(manual.stats().reports, 1);
  assert.equal(manual.stats().cases, 1);
  await manual.exports.createManualEpcr(args);
  assert.equal(manual.stats().reports, 1);
  await manual.exports.createManualEpcr({ ...args, requestId: '00000000-0000-4000-8000-000000000002' });
  assert.equal(manual.stats().reports, 2);
  console.log('Manual creation, repeated:', manual.stats());
  console.log('Mocked reproduction only; no production records inspected or changed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
