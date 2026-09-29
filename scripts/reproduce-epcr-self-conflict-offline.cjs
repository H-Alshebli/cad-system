// Regression for the diagnosed self-conflict. Real hook, synthetic SDK/storage only.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const filename = path.join(__dirname, 'test-epcr-draft-offline.cjs');
const source = fs.readFileSync(filename, 'utf8');
const boundary = source.indexOf('(async () => {');
assert(boundary > 0);
const context = { require, __dirname, structuredClone, setImmediate, console, exports: {} };
vm.runInNewContext(source.slice(0, boundary) + '\nexports.harness=harness; exports.ready=ready; exports.edit=edit;', context);
const { harness, ready, edit } = context.exports;
(async () => {
  const h = harness({ lostAck: true });
  await ready(h);
  edit(h);
  assert.equal(await h.hook.flush(), 'local');
  assert.equal(h.writes(), 1); // Server accepted first save but caller did not get ACK.
  h.hook.setData(p => ({ ...p, narrativeVitals: { ...p.narrativeVitals, narrative: 'SECOND SYNTHETIC EDIT' } }));
  await new Promise(resolve => setImmediate(resolve));
  await h.notify(); // Delayed snapshot from this user's own first save.
  assert.doesNotMatch(h.values[2], /Conflict: server report changed/);
  assert.equal(h.server.locked, false);
  assert.equal(h.server.finalizedAt, undefined);
  assert.equal(await h.hook.flush(), 'server');
  assert.equal(h.server.narrativeVitals.narrative, 'SECOND SYNTHETIC EDIT');
  h.hook.setData(p => ({ ...p, narrativeVitals: { narrative: 'THIRD SYNTHETIC EDIT' } }));
  assert.equal(h.values[0].narrativeVitals.narrative, 'THIRD SYNTHETIC EDIT');
  assert.equal(await h.hook.flush(), 'server');
  assert.equal(h.writes(), 3);
  assert.equal(h.vault.size, 0);
  console.log('PASS: lost acknowledgement + subsequent edit + own delayed snapshot reconciles without duplicate writes or lost edits.');

  const recovering = harness({ lostAck: true }); await ready(recovering); edit(recovering);
  await recovering.hook.flush();
  recovering.hook.setData(p => ({ ...p, narrativeVitals: { narrative: 'RECOVERED NEW EDIT' } }));
  await new Promise(resolve => setImmediate(resolve));
  const reopened = harness({ remote: recovering.server, recovery: [...recovering.vault] });
  await ready(reopened);
  assert.equal(await reopened.hook.flush(), 'server');
  assert.equal(reopened.server.narrativeVitals.narrative, 'RECOVERED NEW EDIT');
  console.log('PASS: encrypted-vault receipt survives synthetic reopen and reconciles the previous own commit.');

  for (const change of [
    remote => { remote.narrativeVitals = { narrative: 'ANOTHER EDITOR' }; },
    remote => { remote.updatedAt = new Date(123456); },
    remote => { remote.locked = true; remote.finalizedAt = new Date(); },
  ]) {
    const other = harness({ lostAck: true }); await ready(other); edit(other);
    await other.hook.flush();
    other.hook.setData(p => ({ ...p, narrativeVitals: { narrative: 'KEEP LOCAL' } }));
    await new Promise(resolve => setImmediate(resolve));
    change(other.server);
    await other.notify();
    assert.equal(await other.hook.flush(), 'failed');
    assert.equal(other.writes(), 1);
    assert.equal([...other.vault.values()][0].record.narrativeVitals.narrative, 'KEEP LOCAL');
  }
  console.log('PASS: foreign payload, changed server version, and finalized report all remain blocked; local recovery retained.');
  const metadata = harness(); await ready(metadata); edit(metadata);
  await new Promise(resolve => setImmediate(resolve));
  metadata.server.updatedAt = new Date(2000);
  await metadata.notify();
  assert.match(metadata.values[2], /Conflict: server report changed/);
  assert.equal(metadata.writes(), 0);
  console.log('REPRODUCED: updatedAt-only change also blocks; conflict message does not prove clinical fields changed.');
  console.log('Synthetic regression only. No production reads/writes. Does not establish which sequence happened in the reported incident.');
})().catch(error => { console.error(error); process.exitCode = 1; });
