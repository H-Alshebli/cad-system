// Offline regression entry point; no credentials, network, or real patients.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const status = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/epcrStatus.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: status });
assert.equal(status.getEpcrStatus({ locked: true, finalizedAt: new Date(), status: 'draft' }), 'finalized');
assert.equal(status.getEpcrStatus({ locked: false, finalizedAt: new Date(), status: 'finalized' }), 'draft');
assert.equal(status.getEpcrStatus(null), 'Not Created');
console.log('PASS: status badge follows approval/lock, not a stale status string.');
require('./test-epcr-draft-offline.cjs');
