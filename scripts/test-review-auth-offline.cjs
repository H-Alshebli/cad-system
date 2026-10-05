const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const permissions = {};
vm.runInNewContext(compile('lib/permissionsMatrix.ts'), { exports: permissions });
let user, grants, revoked = false;
const auth = {};
vm.runInNewContext(compile('lib/server/epcrReviewAuth.ts'), { exports: auth, require: name => {
  if (name === '../permissionsMatrix') return permissions;
  if (name !== './firebaseAdmin') throw Error('Unexpected dependency');
  return { adminAuth: { verifyIdToken: async (_token, checkRevoked) => { assert.equal(checkRevoked, true); if (revoked) throw Error('Revoked'); return { uid: 'SYNTHETIC' }; } },
    adminDb: { collection: collection => ({ doc: () => ({ get: async () => ({ data: () => collection === 'users' ? user : { permissions: grants } }) }) }) } };
} });
(async () => {
  user = { active: true, accountType: 'employee', role: 'arbitrary-custom-role' }; grants = { epcr_medical_review: { view: true, approve: true } };
  const actor = await auth.epcrActor('Bearer synthetic'); assert(actor.can('epcr_medical_review','approve')); assert(!actor.can('epcr_medical_review','return_for_correction'));
  user.role = 'Medical Director'; grants = {}; assert(!(await auth.epcrActor('Bearer synthetic')).can('epcr_medical_review','approve'));
  for (const role of ['admin','super_admin','superadmin']) { user.role = role; assert((await auth.epcrActor('Bearer synthetic')).can('epcr_medical_review','approve')); }
  user.active = false; assert.equal(await auth.epcrActor('Bearer synthetic'), null);
  delete user.active; user.accountType = 'employee'; assert((await auth.epcrActor('Bearer synthetic')).can('epcr_medical_review','approve'));
  user.active = true; user.accountType = 'client'; assert.equal(await auth.epcrActor('Bearer synthetic'), null);
  user.accountType = 'employee'; revoked = true; assert.equal(await auth.epcrActor('Bearer synthetic'), null);
  assert.equal(await auth.epcrActor(null), null);
  console.log('PASS server authentication: active and legacy employee records, revoked-token check, role-configured actions, no hardcoded director, admin aliases preserved. Synthetic only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
