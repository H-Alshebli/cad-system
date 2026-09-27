// Execute the actual route against synthetic, in-memory transactions.
// No Firebase SDK, credentials, network or real records are loaded.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '..');
let actor, records, queue = Promise.resolve();
function ref(key) { return { key, collection: child => ({ doc: id => ref(`${key}/${child}/${id}`) }) }; }
const db = { collection: key => ({ doc: id => ref(`${key}/${id}`) }), runTransaction: fn => {
  const run = queue.then(async () => {
    const writes = [];
    const result = await fn({
      get: async r => ({ exists: records.has(r.key), data: () => structuredClone(records.get(r.key)) }),
      update: (r, data) => writes.push(() => { assert(records.has(r.key)); records.set(r.key, { ...records.get(r.key), ...data }); }),
      create: (r, data) => writes.push(() => { assert(!records.has(r.key)); records.set(r.key, data); }),
    });
    writes.forEach(fn => fn()); return result;
  });
  queue = run.catch(() => {}); return run;
} };
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const exports = {}; cache[file] = exports;
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, Date, Error, require: name => {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
    if (name.endsWith('/server/firebaseAdmin')) return { adminDb: db };
    if (name.endsWith('/server/epcrReviewAuth')) return { epcrActor: async () => actor };
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
    throw Error('Unexpected dependency: ' + name);
  } }); return exports;
}
const route = load('app/api/epcr/[id]/medical-review/route.ts');
const core = load('lib/epcrDraftCore.ts');
const policy = load('lib/epcrMedicalReview.ts');
const now = '2026-09-21T00:00:00Z';
const complete = {
  status: 'draft', locked: false, finalizedAt: null, updatedAt: new Date(1000),
  patientInfo: { firstName: 'SYNTHETIC', lastName: 'ONLY', patientId: 'TEST', age: 20, triageColor: 'TEST', healthClassification: 'TEST', chiefComplaints: ['Other'], chiefComplaintDetails: { Other: ['Other'] }, signsAndSymptoms: ['None'] },
  narrativeVitals: { contactedMedicalDirector: 'No', narrative: 'SYNTHETIC', vitalsList: [{ hr: '80', bp: '120/80', spo2: '99' }] },
  outcome: { destination: 'Treated on Scene' }, transferTeam: { members: [{ name: 'TEST', signatureDataUrl: 'synthetic-signature' }] },
  time: { arrivalTime: { timeHHMM: '10:00' }, movingTime: { timeHHMM: '09:50' } },
};
function user(uid, grants) { return { uid, name: uid, can: (module, action) => grants.includes(`${module}.${action}`) }; }
function reset() { records = new Map([['epcr/TEST', structuredClone(complete)], ['epcr/TEST/forms/dataSharingConsent', { completed: true }]]); actor = user('crew', ['epcr.finalize']); }
let count = 0;
function body(action, extra = {}) { return { action, notes: '', requestId: `00000000-0000-0000-0000-${String(++count).padStart(12,'0')}`, ...extra }; }
function call(data) { return route.POST({ headers: { get: () => 'Bearer TEST' }, json: async () => data }, { params: { id: 'TEST' } }); }
const report = () => records.get('epcr/TEST');
const submit = () => body('submit', { baseVersion: core.draftVersion(report()) });
async function pending() { reset(); const result = await call(submit()); assert.equal(result.status, 200); }
(async () => {
  reset(); actor = null; assert.equal((await call(submit())).status, 401);
  reset(); actor = user('viewer', []); assert.equal((await call(submit())).status, 403);
  reset(); report().patientInfo.firstName = ''; assert.equal((await call(submit())).status, 409); assert.equal(report().locked, false);
  reset(); records.set('epcr/TEST/forms/dataSharingConsent', { completed: false });
  assert.equal((await call(submit())).body.result, 'consent'); assert.equal(records.size, 2);
  reset(); const request = submit();
  const results = await Promise.all([call(request), call(request)]); assert(results.every(r => r.status === 200));
  assert.equal(records.size, 4); assert.equal(report().medicalReview.status, 'pending'); assert.equal(report().locked, true);
  assert.equal((await call(request)).status, 200); assert.equal(records.size, 4);
  actor = user('director', ['epcr_medical_review.view', 'epcr_medical_review.approve', 'epcr_medical_review.return_for_correction', 'epcr_medical_review.review']);
  const review = body('comment', { notes: 'Check narrative', expectedRevision: 1 });
  assert.equal((await call(review)).status, 200); assert.equal(report().locked, true); assert.equal(report().medicalReview.status, 'pending');
  assert.equal((await call(body('approve', { expectedRevision: 1 }))).status, 409);
  assert.equal((await call(body('return', { expectedRevision: 2 }))).status, 409);
  assert.equal((await call(body('return', { expectedRevision: 2, notes: 'Correct narrative' }))).status, 200);
  assert.equal(report().locked, false); assert.equal(report().finalizedAt, null); assert.equal(report().medicalReview.status, 'returned');
  actor = user('crew', ['epcr.finalize']); report().narrativeVitals.narrative = 'CORRECTED';
  assert.equal((await call(submit())).status, 200); assert.equal(report().medicalReview.submission, 2);
  assert.equal(records.get('epcr/TEST/reviewVersions/1').narrativeVitals.narrative, 'SYNTHETIC');
  actor = user('crew', ['epcr_medical_review.view', 'epcr_medical_review.approve']);
  assert.equal((await call(body('approve', { expectedRevision: 4 }))).status, 409);
  actor = user('director', ['epcr_medical_review.view', 'epcr_medical_review.approve']);
  const approval = body('approve', { expectedRevision: 4 }); assert.equal((await call(approval)).status, 200);
  assert.equal(report().medicalReview.status, 'approved'); assert.equal(report().locked, true);
  assert.equal((await call(approval)).status, 200);
  assert.equal((await call({ ...approval, notes: 'changed' })).status, 409);
  await pending();
  actor = user('crew', ['epcr_medical_review.view', 'epcr_medical_review.approve', 'epcr_medical_review.return_for_correction']);
  assert.equal((await call(body('approve', { expectedRevision: 1, isAdmin: true }))).status, 409); // Client cannot claim admin.
  actor.isAdmin = true;
  assert.equal((await call(body('return', { expectedRevision: 1 }))).status, 409); // Reason still mandatory.
  const selfApproval = body('approve', { expectedRevision: 1 });
  assert.equal((await call(selfApproval)).status, 200);
  assert.equal(report().medicalReview.status, 'approved'); assert.equal(report().medicalReview.reviewedBy, 'crew');
  assert.equal(records.get(`epcr/TEST/reviewEvents/${selfApproval.requestId}`).adminSelfApproval, true);
  const recordCount = records.size;
  assert.equal((await call(selfApproval)).status, 200); assert.equal(records.size, recordCount);
  await pending();
  actor = user('crew', ['epcr_medical_review.view', 'epcr_medical_review.return_for_correction']);
  assert.equal((await call(body('return', { expectedRevision: 1, notes: 'Synthetic correction', isAdmin: true }))).status, 409);
  actor.isAdmin = true;
  const selfReturn = body('return', { expectedRevision: 1, notes: 'Synthetic correction' });
  assert.equal((await call(selfReturn)).status, 200);
  assert.equal(report().locked, false); assert.equal(report().medicalReview.status, 'returned');
  assert.equal(records.get(`epcr/TEST/reviewEvents/${selfReturn.requestId}`).adminSelfReturn, true);
  const returnedCount = records.size;
  assert.equal((await call(selfReturn)).status, 200); assert.equal(records.size, returnedCount);
  const historical = date => policy.historicalReviewCandidate({ verifiedCaseDate: date, sourceVerified: true, submitted: true, complete: true });
  assert.equal(historical('2026-08-31T20:59:59Z'), 'eligible_historical');
  assert.equal(historical('2026-08-31T21:00:00Z'), 'requires_review');
  assert.equal(historical('2026-08-31'), 'needs_date_verification');
  assert.equal(historical('2026-02-31T12:00:00Z'), 'needs_date_verification');
  assert.equal(policy.historicalReviewCandidate({ complete: false, submitted: false, sourceVerified: true }), 'incomplete');
  console.log('PASS actual route: auth/permissions, required fields, consent, idempotent concurrent requests, conflict, comment, return, revisions, self-approval denial, immutable snapshots, cutoff. No network or real records.');
})().catch(error => { console.error(error); process.exitCode = 1; });
