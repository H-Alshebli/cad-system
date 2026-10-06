// Executes the real hook/core against an in-memory server and recovery vault.
// No Firebase SDK, credentials, real browser account, or network calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const core = {};
vm.runInNewContext(compile('lib/epcrDraftCore.ts'), { exports: core, Date, Error });
const changedPatient = core.draftPatch({ patientInfo: { patientId: '1234567890', lastName: 'Updated' } }, { patientInfo: { patientId: '123456', lastName: 'Original', firstName: 'Keep' } });
assert.deepEqual(JSON.parse(JSON.stringify(changedPatient)), { 'patientInfo.patientId': '1234567890', 'patientInfo.lastName': 'Updated' });
assert.deepEqual(JSON.parse(JSON.stringify(core.applyDraftPatch({ patientInfo: { patientId: '123456', lastName: 'Original', firstName: 'Keep' } }, changedPatient))), { patientInfo: { patientId: '1234567890', lastName: 'Updated', firstName: 'Keep' } });
function harness(options = {}) {
  const uid = 'SYNTHETIC-USER';
  const original = { caseId: 'SYNTHETIC-CASE', locked: false, status: 'draft', updatedAt: new Date(1000), patientInfo: { firstName: 'TEST', lastName: 'ONLY' }, narrativeVitals: { narrative: 'synthetic' } };
  const server = { ...original, ...(options.remote || {}) };
  const vault = new Map(options.recovery || []);
  const values = [], effects = [], listeners = {};
  const auth = { currentUser: { uid } };
  let callback, writes = 0, lostAck = !!options.lostAck;
  const navigator = { onLine: options.online !== false, locks: { request: async (_name, _opts, fn) => fn({}) } };
  const react = {
    useState: initial => { const index = values.length; values.push(initial); return [initial, next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }]; },
    useRef: value => ({ current: value }),
    useCallback: value => value,
    useEffect: fn => effects.push(fn),
  };
  const snapshot = () => ({ metadata: { fromCache: false, hasPendingWrites: false }, exists: () => true, data: () => ({ ...server }) });
  const api = {
    doc: (_db, ...parts) => parts.join('/'),
    onSnapshot: (_ref, _options, handler) => { callback = handler; void handler(snapshot()); return () => {}; },
    runTransaction: async (_db, fn) => {
      if (options.serverFailure) throw new Error('network unavailable');
      const pending = [];
      const result = await fn({
        get: async ref => ref.includes('/forms/') ? { exists: () => true, data: () => ({ completed: options.consent !== false }) } : snapshot(),
        update: (ref, patch) => pending.push([ref, patch]),
      });
      for (const [ref, patch] of pending) if (ref === 'epcr/TEST') { Object.assign(server, core.applyDraftPatch(server, patch)); writes++; }
      if (lostAck && pending.length) { lostAck = false; throw new Error('commit acknowledged late'); }
      return result;
    },
  };
  const exports = {};
  vm.runInNewContext(compile('lib/useEpcrDraft.ts'), {
    exports, Date, Error, crypto: webcrypto, navigator,
    setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
    window: { addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: () => {} },
    document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
    require: name => {
      if (name === 'react') return react;
      if (name === 'firebase/auth') return { onAuthStateChanged: (_auth, fn) => { void fn(auth.currentUser); return () => {}; } };
      if (name === 'firebase/firestore') return api;
      if (name === './firebase') return { auth, db: { app: { options: { projectId: 'OFFLINE-TEST' } } } };
      if (name === './epcrDraftCore') return core;
      if (name === './epcrDraftClient') return { sendEpcrDraft: async (_id, body) => {
        if (options.serverFailure) throw new Error('network unavailable');
        if (server.locked || server.finalizedAt) throw new Error('REPORT_LOCKED');
        if (server.lastDraftMutationId === body.mutationId) return { record: core.draftPayload(server), version: core.draftVersion(server), duplicate: true };
        if (core.draftVersion(server) !== body.baseVersion) throw new Error('REPORT_CONFLICT');
        const next = core.applyDraftPatch(server, body.patch);
        Object.assign(server, next, { status: 'draft', updatedAt: new Date(server.updatedAt.getTime() + 1), draftRevision: Number(server.draftRevision || 0) + 1, lastDraftMutationId: body.mutationId }); writes++;
        if (lostAck) { lostAck = false; throw new Error('commit acknowledged late'); }
        return { record: core.draftPayload(server), version: core.draftVersion(server), updatedAt: server.updatedAt, draftRevision: server.draftRevision, lastDraftMutationId: server.lastDraftMutationId };
      } };
      if (name === './epcrEditSessionClient') return { claimEpcrEditSession: async () => ({ editor: true }) };
      if (name === './epcrReviewClient') return { sendMedicalReview: async (_id, body) => {
        if (options.consent === false) return { result: 'consent' };
        assert.equal(body.action, 'submit');
        assert.equal(body.baseVersion, core.draftVersion(server));
        Object.assign(server, { locked: true, finalizedAt: new Date(), status: 'finalized' }); writes++;
        return { result: 'done' };
      } };
      if (name === './epcrDraftVault') return {
        restoreDrafts: async (_scope, prefix) => [...vault].filter(([key]) => key.startsWith(prefix)).map(([id, draft]) => ({ id, draft })),
        storeDraft: async (_scope, key, draft) => { if (options.localFailure) throw new Error('quota'); vault.set(key, structuredClone(draft)); },
        removeDraft: async key => vault.delete(key),
      };
      throw new Error('Unexpected dependency blocked: ' + name);
    },
  });
  const hook = exports.useEpcrDraft('TEST', async record => record, patient => ({ patient }));
  effects.forEach(fn => fn());
  return { hook, server, vault, values, navigator, auth, original, writes: () => writes, notify: () => callback(snapshot()) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function ready(h) { for (let i = 0; i < 12 && h.values[1]; i++) await tick(); assert.equal(h.values[1], false); }
const edit = h => h.hook.setData(previous => ({ ...previous, patientInfo: { ...previous.patientInfo, firstName: 'EDITED TEST', employeeId: 'EMP-0012', buildingNumber: '0007-A' } }));
(async () => {
  const offline = harness({ online: false }); await ready(offline); edit(offline);
  assert.equal(await offline.hook.flush(), 'local'); assert.equal(offline.writes(), 0); assert.equal(offline.vault.size, 1);
  const recovery = [...offline.vault];
  const reopened = harness({ online: false, recovery }); await ready(reopened);
  assert.equal(reopened.values[0].patientInfo.firstName, 'EDITED TEST');
  assert.equal(reopened.values[0].patientInfo.employeeId, 'EMP-0012');
  assert.equal(reopened.values[0].patientInfo.buildingNumber, '0007-A');
  offline.navigator.onLine = true;
  assert.equal(await offline.hook.flush(), 'server'); assert.equal(offline.writes(), 1); assert.equal(offline.vault.size, 0);
  assert.equal(offline.server.patientInfo.firstName, 'EDITED TEST');
  assert.equal(offline.server.patientInfo.employeeId, 'EMP-0012');
  assert.equal(offline.server.patientInfo.buildingNumber, '0007-A');
  assert.equal(await offline.hook.flush(), 'server'); assert.equal(offline.writes(), 1);
  const lost = harness({ lostAck: true }); await ready(lost); edit(lost);
  assert.equal(await lost.hook.flush(), 'local'); assert.equal(lost.writes(), 1);
  assert.equal(await lost.hook.flush(), 'server'); assert.equal(lost.writes(), 1); assert.equal(lost.vault.size, 0);
  const conflict = harness(); await ready(conflict); edit(conflict); conflict.server.updatedAt = new Date(2000);
  assert.equal(await conflict.hook.flush(), 'failed'); assert.equal(conflict.writes(), 0); assert.equal(conflict.vault.size, 1);
  const locked = harness(); await ready(locked); edit(locked); locked.server.locked = true;
  assert.equal(await locked.hook.flush(), 'failed'); assert.equal(locked.writes(), 0);
  const consent = harness({ consent: false }); await ready(consent); edit(consent);
  assert.equal(await consent.hook.finalize(), 'consent'); assert.equal(consent.server.patientInfo.firstName, 'EDITED TEST'); assert.equal(consent.server.locked, false);
  assert.equal(consent.server.patientInfo.employeeId, 'EMP-0012');
  assert.equal(consent.server.patientInfo.buildingNumber, '0007-A');
  const final = harness(); await ready(final); edit(final);
  assert.equal(await final.hook.finalize(), 'done'); assert.equal(final.server.locked, true); assert.equal(final.server.status, 'finalized');
  const double = harness(); await ready(double); edit(double);
  const finalizing = double.hook.finalize();
  assert.equal(await double.hook.finalize(), 'failed');
  assert.equal(await finalizing, 'done'); assert.equal(double.writes(), 2); // One draft + one finalization.
  const simultaneous = harness(); await ready(simultaneous); edit(simultaneous);
  await Promise.all([simultaneous.hook.flush(), simultaneous.hook.flush()]);
  assert.equal(simultaneous.writes(), 1);
  const quota = harness({ online: false, localFailure: true }); await ready(quota); edit(quota);
  assert.equal(await quota.hook.flush(), 'failed'); assert.equal(quota.writes(), 0);
  const account = harness(); await ready(account); edit(account); account.auth.currentUser = { uid: 'OTHER-TEST-USER' };
  assert.equal(await account.hook.flush(), 'failed'); assert.equal(account.writes(), 0);
  const pending = harness(); await ready(pending); edit(pending); pending.server.updatedAt = new Date(3000); await pending.notify();
  assert.equal(pending.values[0].patientInfo.firstName, 'EDITED TEST'); assert.equal(pending.writes(), 0);
  assert.equal(core.matchesSubmissionDate(new Date(2026, 8, 17, 12, 30, 59), '2026-09-17T12:30', '2026-09-17T12:30'), true);
  assert.equal(core.matchesSubmissionDate(new Date(2026, 8, 17, 12, 31), '', '2026-09-17T12:30'), false);
  assert.equal(core.matchesSubmissionDate(undefined, '2026-09-17T00:00', ''), false);
  console.log('PASS: local recovery, reconnect, duplicate retry, lost ACK, remote conflict, lock, save before consent, finalization, storage failure, account isolation, snapshot preservation, date boundaries.');
  console.log('All data synthetic; no external reads or writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
