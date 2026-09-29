// Synthetic only: real policy, outbox, worker and checklist route; no SDK/network.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict'), crypto = require('node:crypto');
let records = new Map(), actor, sends = 0, sendError, failAfterSend = false;
let serial = Promise.resolve();
const env = { REVIEW_NOTIFICATIONS_ENABLED: 'true', REVIEW_NOTIFICATIONS_START_AT: '2026-09-01T00:00:00+03:00', SMTP_HOST: 'fake', SMTP_USER: 'fake', SMTP_PASS: 'fake', REVIEW_NOTIFICATION_ORIGIN: 'https://test.invalid' };
const field = (obj, key) => key.split('.').reduce((value, part) => value?.[part], obj);
function ref(key) {
  return { key, id: key.split('/').at(-1), collection: name => query(`${key}/${name}`), get: async () => snap(key), update: async patch => {
    if (failAfterSend && patch.status === 'sent') throw Error('simulated crash');
    records.set(key, { ...records.get(key), ...patch });
  } };
}
function snap(key) { return { id: key.split('/').at(-1), ref: ref(key), exists: records.has(key), data: () => records.get(key) }; }
function query(prefix, filters = [], maximum = Infinity) {
  const q = { prefix, doc: id => ref(`${prefix}/${id}`), where: (key, op, value) => query(prefix, [...filters, [key, op, value]], maximum), select: () => q,
    limit: count => query(prefix, filters, count), get: async () => ({ docs: [...records.keys()].filter(key => key.startsWith(prefix + '/') && key.split('/').length === prefix.split('/').length + 1)
      .filter(key => filters.every(([f, op, value]) => { assert.equal(op, '=='); return (f === '__id__' ? key.split('/').at(-1) : field(records.get(key), f)) === value; })).slice(0, maximum).map(snap) }) };
  return q;
}
const db = { collection: query, runTransaction: callback => {
  const promise = serial.then(async () => {
    const writes = []; let wrote = false;
    const result = await callback({ get: async target => { assert(!wrote, 'Firestore reads must precede writes'); return target.prefix ? target.get() : snap(target.key); },
      create: (target, data) => { wrote = true; writes.push(() => { assert(!records.has(target.key), 'duplicate event'); records.set(target.key, data); }); },
      update: (target, data) => { wrote = true; writes.push(() => { assert(records.has(target.key)); records.set(target.key, { ...records.get(target.key), ...data }); }); } });
    writes.forEach(write => write()); return result;
  }); serial = promise.catch(() => {}); return promise;
} };
const cache = {};
function load(file) {
  file = path.normalize(file); if (cache[file]) return cache[file];
  const exports = {}; cache[file] = exports;
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, process: { env }, Date, URL, Error, require: name => {
    if (name === 'node:crypto') return crypto;
    if (name === 'next/server') return { NextResponse: { json: (body, opts) => ({ body, status: opts?.status || 200 }) } };
    if (name === 'firebase-admin/firestore') return { FieldPath: { documentId: () => '__id__' } };
    if (name.endsWith('firebaseAdmin')) return { adminDb: db };
    if (name.endsWith('epcrReviewAuth')) return { epcrActor: async () => actor };
    if (name === 'nodemailer') return { createTransport: () => ({ close() {}, sendMail: async message => { sends++; assert(!message.text.includes('PRIVATE')); if (sendError) throw sendError; return { accepted: [message.to] }; } }) };
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
    if (name.startsWith('.')) return load(path.join(path.dirname(file), name) + '.ts');
    throw Error('Unexpected import ' + name);
  } }); return exports;
}
const policy = load('lib/reviewNotificationPolicy.ts');
const outbox = load('lib/server/reviewNotificationOutbox.ts');
const worker = load('lib/server/reviewNotificationDelivery.ts');
const route = load('app/api/checklists/[id]/lifecycle/route.ts');
const event = { kind: 'epcr', recordId: 'TEST', action: 'submit', ownerId: 'crew', at: '2026-09-29T10:00:00Z' };
function setup() {
  records = new Map([
    ['users/crew', { role: 'Paramedic', active: true, accountType: 'employee', email: 'crew@example.test' }],
    ['users/director', { role: 'Custom reviewer', active: true, accountType: 'employee', email: 'reviewer@example.test' }],
    ['roles/Paramedic', { permissions: { epcr: { view: true }, readiness_checklists: { view_own: true } } }],
    ['roles/Custom reviewer', { permissions: { epcr_medical_review: { view: true, approve: true, receive_notifications: true }, readiness_checklists: { review: true, view_all: true, receive_notifications: true } } }],
  ]); sends = 0; sendError = null; failAfterSend = false;
}
async function enqueue(id = 'event', e = event, cohort = event.at) { await db.runTransaction(async tx => outbox.enqueueReviewNotice(tx, id, e, cohort)); }
(async () => {
  setup(); await enqueue('old', event, '2026-08-31T20:00:00Z'); assert(![...records.keys()].some(k => k.startsWith('reviewNotificationOutbox/')));
  env.REVIEW_NOTIFICATIONS_ENABLED = 'false'; await enqueue(); assert.equal(records.size, 4); env.REVIEW_NOTIFICATIONS_ENABLED = 'true';
  await enqueue(); await Promise.all([worker.deliverReviewNotifications(), worker.deliverReviewNotifications()]);
  assert.equal(sends, 1); assert.equal([...records.keys()].filter(k => k.includes('/reviewNotifications/')).length, 1);
  await worker.deliverReviewNotifications(); assert.equal(sends, 1);
  assert.equal(policy.canReceiveNotice(event, 'a', { role: 'admin', active: true }, {}), false);
  assert.equal(policy.canReceiveNotice(event, 'a', { role: 'Custom reviewer', active: false }, records.get('roles/Custom reviewer').permissions), false);
  setup(); await enqueue('return', { ...event, action: 'return' }); await worker.deliverReviewNotifications();
  assert.equal(sends, 1); assert([...records.keys()].some(k => k.startsWith('users/crew/reviewNotifications/')));
  setup(); sendError = { code: 'ETIMEDOUT' }; await enqueue(); await worker.deliverReviewNotifications(); await worker.deliverReviewNotifications();
  assert.equal(sends, 1); assert([...records.values()].some(v => v.status === 'delivery_unknown'));
  setup(); failAfterSend = true; await enqueue(); await assert.rejects(worker.deliverReviewNotifications()); failAfterSend = false; await worker.deliverReviewNotifications(); assert.equal(sends, 1);
  setup(); delete env.SMTP_HOST; await enqueue(); await worker.deliverReviewNotifications(); assert.equal(sends, 0); assert([...records.keys()].some(k => k.includes('/reviewNotifications/'))); env.SMTP_HOST = 'fake';
  setup(); records.get('roles/Custom reviewer').permissions = {}; await enqueue(); await worker.deliverReviewNotifications(); assert([...records.values()].some(v => v.status === 'blocked_no_recipients'));
  // Actual checklist API: authorization, idempotency, lifecycle, durable event.
  setup(); actor = { uid: 'crew', name: 'Synthetic', can: (_m, a) => ['create','submit','view_own'].includes(a) };
  const body = { action: 'create', status: 'submitted', requestId: crypto.randomUUID(), payload: { projectId: 'P', unitId: 'U', dateKey: '2026-09-29', shiftKey: 'Day', items: [{ id: 'test', label: 'Synthetic', status: 'checked', step: 'vest', section: 'Test', group: 'Test' }], submissionAcknowledgement: { acknowledged: true } } };
  const call = b => route.POST({ headers: { get: () => 'Bearer synthetic' }, json: async () => b }, { params: { id: 'CHECK' } });
  assert.equal((await call(body)).status, 200); const size = records.size;
  assert.equal((await call(body)).status, 200); assert.equal(records.size, size);
  assert.equal(records.get('projectChecklists/CHECK').inspectorUserId, 'crew');
  actor = { uid: 'reviewer', name: 'Synthetic', can: () => true };
  const comment = { action: 'comment', requestId: crypto.randomUUID(), baseVersion: '0', notes: 'PRIVATE COMMENT' };
  assert.equal((await call(comment)).status, 200); assert.equal(records.get('projectChecklists/CHECK').status, 'submitted');
  assert(!JSON.stringify([...records.entries()].filter(([key]) => key.startsWith('reviewNotificationOutbox/'))).includes('PRIVATE'));
  assert.equal((await call({ ...comment, requestId: crypto.randomUUID(), action: 'return', notes: '' })).status, 400);
  assert.equal((await call({ ...comment, requestId: crypto.randomUUID(), action: 'return' })).status, 200);
  actor = null; assert.equal((await call(body)).status, 401);
  console.log('PASS actual notification pipeline and checklist route: future-only, opt-in, owner routing, atomic fanout, concurrent worker, SMTP ambiguity, safe recovery, comments, idempotency and authorization. No network.');
})().catch(error => { console.error(error); process.exitCode = 1; });
