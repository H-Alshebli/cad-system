// Requires a LOCAL emulator. Refuses real Firebase projects/hosts.
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, getDoc, terminate } = require('firebase/firestore');
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host !== '127.0.0.1:8089') throw Error('Refusing to run without isolated local emulator 127.0.0.1:8089');
const project = 'demo-hcad-review';
const apps = [];
function client(uid, owner = false) {
  const app = initializeApp({ projectId: project, apiKey: 'synthetic-key' }, uid); apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8089, { mockUserToken: owner ? 'owner' : { sub: uid, user_id: uid, email: `${uid}@example.invalid` } });
  return db;
}
async function denied(promise) { await assert.rejects(promise, e => e.code === 'permission-denied'); }
(async () => {
  const seed = client('seed', true);
  const roles = { crew: { epcr: { create: true, edit: true, finalize: true } }, dispatcher: { ambulances: { assign: true } }, director: { epcr_medical_review: { view: true, approve: true } } };
  for (const [role, permissions] of Object.entries(roles)) await setDoc(doc(seed, 'roles', role), { permissions });
  for (const [uid, role, active] of [['crew','crew',true], ['admin','admin',true], ['dispatcher','dispatcher',true], ['director','director',true], ['inactive','crew',false]]) {
    await setDoc(doc(seed, 'users', uid), { name: 'SYNTHETIC', role, active, accountType: 'employee' });
  }
  const crew = client('crew'), admin = client('admin'), dispatcher = client('dispatcher'), director = client('director'), inactive = client('inactive'), fresh = client('new');
  await denied(updateDoc(doc(crew, 'users','crew'), { role: 'admin' }));
  await denied(updateDoc(doc(crew, 'users','admin'), { active: false }));
  await denied(updateDoc(doc(crew, 'users','crew'), { uid: 'admin' }));
  await denied(updateDoc(doc(inactive, 'users','inactive'), { active: true }));
  await denied(setDoc(doc(fresh,'users','new'), { role: 'admin', active: true }));
  await setDoc(doc(fresh,'users','new'), { name: 'SYNTHETIC', email: 'new@example.invalid', role: 'none', active: false, accountStatus: 'pending', accountType: 'employee', crewProfileRequirementMode: 'full', createdAt: new Date() });
  await updateDoc(doc(dispatcher,'users','crew'), { ambulanceIds: ['TEST'], updatedAt: new Date() });
  await denied(updateDoc(doc(dispatcher,'users','crew'), { ambulanceIds: ['TEST'], role: 'admin' }));
  await updateDoc(doc(admin,'users','new'), { active: true, role: 'crew' });
  await denied(updateDoc(doc(crew,'roles','crew'), { permissions: { epcr_medical_review: { approve: true } } }));
  const draft = { status: 'draft', locked: false, finalizedAt: null, createdBy: 'crew', caseId: 'TEST' };
  await setDoc(doc(crew,'epcr','TEST'), draft);
  await updateDoc(doc(crew,'epcr','TEST'), { patientInfo: { employeeId: '001', buildingNumber: 'A-7' }, updatedAt: new Date(), draftRevision: 1, lastDraftMutationId: 'test' });
  await setDoc(doc(crew,'epcr','TEST','forms','dataSharingConsent'), { completed: true });
  await denied(updateDoc(doc(crew,'epcr','TEST'), { medicalReview: { status: 'approved' } }));
  await denied(updateDoc(doc(director,'epcr','TEST'), { medicalReview: { status: 'approved' } }));
  await denied(updateDoc(doc(crew,'epcr','TEST'), { createdBy: 'director' }));
  await denied(updateDoc(doc(crew,'epcr','TEST'), { locked: true, finalizedAt: new Date(), status: 'finalized' }));
  await denied(deleteDoc(doc(crew,'epcr','TEST')));
  await denied(setDoc(doc(crew,'epcr','TEST','reviewEvents','fake'), { action: 'approve' }));
  await denied(setDoc(doc(crew,'epcr','TEST','reviewVersions','1'), { patientInfo: {} }));
  await updateDoc(doc(seed,'epcr','TEST'), { locked: true, finalizedAt: new Date(), medicalReview: { status: 'pending' } });
  await denied(updateDoc(doc(crew,'epcr','TEST'), { patientInfo: {} }));
  await denied(setDoc(doc(crew,'epcr','TEST','forms','dataSharingConsent'), { completed: false }));
  await denied(updateDoc(doc(admin,'epcr','TEST'), { locked: false }));
  await denied(getDoc(doc(inactive,'epcr','TEST')));
  await updateDoc(doc(seed,'epcr','TEST'), { locked: false, finalizedAt: null, status: 'draft', medicalReview: { status: 'returned' } });
  await updateDoc(doc(crew,'epcr','TEST'), { patientInfo: { firstName: 'CORRECTED' } });
  console.log('PASS Firestore emulator: safe signup, self-promotion/activation denied, admin user management, assignment compatibility, role forgery, draft/consent writes, server-only review, immutable audit, locked records, returned edits.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await Promise.all(apps.map(async app => { await terminate(getFirestore(app)); await deleteApp(app); }));
});
