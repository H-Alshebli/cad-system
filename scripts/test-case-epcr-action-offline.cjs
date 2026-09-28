const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const source = fs.readFileSync(require.resolve('../app/cases/[id]/page.tsx'), 'utf8');
const handler = source.slice(source.indexOf('  async function handleEpcr()'), source.indexOf('  async function handleCreateReturnCad()'));
assert(handler && !handler.includes('system-dev'));
const code = ts.transpileModule(handler + '\nexports.run = handleEpcr;', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
function harness(overrides = {}) {
  const calls = [], errors = []; const exports = {};
  const context = { exports, user: { uid: 'AUTHENTICATED', active: true, accountType: 'employee' }, permissionsLoading: false, isAdmin: false,
    can: () => true, epcr: null, epcrOpeningRef: { current: false }, setEpcrOpening: () => {}, setEpcrError: msg => errors.push(msg),
    caseId: 'CASE', caseData: { id: 'UNTRUSTED-ID', sourceType: 'B2C' }, db: {}, doc: (_db, ...parts) => parts.join('/'),
    createEpcrFromCase: async (data, uid) => { calls.push(['create', data.id, uid]); return 'CASE'; },
    updateDoc: async () => { calls.push(['link']); }, router: { push: url => calls.push(['navigate', url]) }, ...overrides };
  vm.runInNewContext(code, context);
  return { run: exports.run, calls, errors, context };
}
(async () => {
  const good = harness(); await good.run();
  assert.deepEqual(good.calls, [['create', 'CASE', 'AUTHENTICATED'], ['link'], ['navigate', '/epcr/CASE']]);
  for (const overrides of [{ user: null }, { user: { uid: 'X', active: false } }, { user: { uid: 'X', active: true, accountType: 'client' } }, { permissionsLoading: true }, { can: () => false }]) {
    const denied = harness(overrides); await denied.run(); assert.equal(denied.calls.length, 0); assert(denied.errors.at(-1));
  }
  const existing = harness({ epcr: { id: 'EXISTING' }, can: (_m, action) => action === 'view' });
  await existing.run(); assert.deepEqual(existing.calls, [['navigate', '/epcr/EXISTING']]);
  let release, creates = 0;
  const busy = harness({ createEpcrFromCase: () => { creates++; return new Promise(resolve => release = resolve); } });
  const first = busy.run(); await busy.run(); assert.equal(creates, 1); release('CASE'); await first;
  for (const stage of ['createEpcrFromCase', 'updateDoc']) {
    const failure = harness({ [stage]: async () => { throw { code: 'permission-denied' }; } });
    await failure.run(); assert(failure.errors.at(-1).includes('Access denied')); assert.equal(failure.context.epcrOpeningRef.current, false);
    assert(!failure.calls.some(c => c[0] === 'navigate'));
  }
  const network = harness({ createEpcrFromCase: async () => { throw Error('private details'); } });
  await network.run(); assert(network.errors.at(-1).includes('retry')); assert(!network.errors.at(-1).includes('private details'));
  assert(source.includes('role="alert"'));
  console.log('PASS actual case ePCR handler: authenticated UID, canonical case ID, permissions, existing report, double-click guard, visible safe errors. Synthetic only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
