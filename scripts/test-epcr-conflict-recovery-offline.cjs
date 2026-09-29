// Real hook with synthetic Firebase/storage only; no real records or network.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, 'test-epcr-draft-offline.cjs'), 'utf8');
const context = { require, __dirname, structuredClone, setImmediate, console, exports: {} };
vm.runInNewContext(source.slice(0, source.indexOf('(async () => {')) + '\nexports.harness=harness; exports.ready=ready; exports.edit=edit; exports.fields=core.DRAFT_FIELDS;', context);
const { harness, ready, edit, fields } = context.exports;
const choices = () => Object.fromEntries(fields.map(field => [field, 'local']));
async function paused(options) {
  const h = harness(options); await ready(h); edit(h);
  await new Promise(resolve => setImmediate(resolve));
  h.server.updatedAt = new Date(2000);
  h.server.narrativeVitals = { narrative: 'SERVER COPY' };
  await h.notify();
  return h;
}
(async () => {
  const h = await paused();
  const preview = await h.hook.previewRecovery();
  assert.equal(h.writes(), 0);
  assert.equal(preview.server.narrativeVitals.narrative, 'SERVER COPY');
  const selected = choices(); selected.narrativeVitals = 'server';
  assert.equal(await h.hook.recoverDraft(preview.token, selected), 'server');
  assert.equal(h.server.patientInfo.firstName, 'EDITED TEST');
  assert.equal(h.server.narrativeVitals.narrative, 'SERVER COPY');
  assert.equal(h.server.status, 'draft'); assert.equal(h.server.locked, false);
  assert.equal(h.writes(), 1);
  assert.equal([...h.vault.keys()].filter(k => k.includes(':recovery-archive:')).length, 2);
  await assert.rejects(() => h.hook.recoverDraft(preview.token, selected), /expired/);
  const archiveRecords = [...h.vault.values()].map(v => v.record);
  assert(archiveRecords.some(r => r.patientInfo.firstName === 'EDITED TEST'));
  assert(archiveRecords.some(r => r.patientInfo.firstName === 'TEST'));

  for (const mutate of [r => {r.updatedAt = new Date(3000);}, r => {r.locked = true;}, r => {r.narrativeVitals = { narrative: 'CHANGED WITHOUT VERSION' };}]) {
    const x = await paused(); const p = await x.hook.previewRecovery(); mutate(x.server);
    await assert.rejects(() => x.hook.recoverDraft(p.token, choices()), /Server changed/);
    assert.equal(x.writes(), 0); assert(x.vault.size > 0);
  }
  const account = await paused(); const p = await account.hook.previewRecovery(); account.auth.currentUser = { uid: 'OTHER' };
  await assert.rejects(() => account.hook.recoverDraft(p.token, choices()), /expired/);
  assert.equal(account.writes(), 0);
  const incomplete = await paused(); const q = await incomplete.hook.previewRecovery();
  await assert.rejects(() => incomplete.hook.recoverDraft(q.token, {}), /every section/);
  assert.equal(incomplete.writes(), 0);
  const quota = await paused({ localFailure: true });
  await assert.rejects(() => quota.hook.previewRecovery(), /quota/);
  assert.equal(quota.writes(), 0);
  console.log('PASS: read-only comparison, explicit section selection, draft-only restore, both originals archived, replay rejected, stale version/payload/lock/account blocked, storage failure fails closed. Synthetic only.');
})().catch(e => {console.error(e); process.exitCode = 1;});
