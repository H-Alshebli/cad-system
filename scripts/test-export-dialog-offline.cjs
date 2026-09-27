const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), React = require('react'), assert = require('node:assert/strict');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/components/SubmissionsExportDialog.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
function harness(onExport, count = 5) {
  const slots = [], effects = []; let index = 0, closed = 0, mounted = false, focused = 0;
  const exports = {};
  vm.runInNewContext(code, { exports, Error, setTimeout: fn => { fn(); }, document: { activeElement: { focus: () => focused++ } }, require: name => {
    if (name === 'react') return { useState: value => { const i = index++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; }, useRef: value => { const i = index++; return slots[i] ||= { current: value }; }, useEffect: fn => { if (!mounted) effects.push(fn); } };
    if (['react/jsx-runtime', 'lucide-react'].includes(name)) return require(name);
    throw Error('Unexpected dependency');
  }});
  const render = () => { index = 0; const tree = exports.default({ count, onExport, onClose: () => closed++ }); tree.ref.current = { showModal() {}, close() {} }; if (!mounted) { effects.forEach(fn => fn()); mounted = true; } return tree; };
  return { render, closed: () => closed };
}
function nodes(tree, type) { if (!tree || typeof tree !== 'object') return []; return [...(tree.type === type ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => nodes(child, type))]; }
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const called = []; let complete;
  const h = harness(mode => { called.push(mode); return new Promise(resolve => complete = resolve); });
  let tree = h.render(); const buttons = nodes(tree, 'button');
  buttons[2].props.onClick(); buttons[1].props.onClick(); await tick();
  assert.deepEqual(called, ['full']);
  tree = h.render(); assert(nodes(tree, 'button').every(button => button.props.disabled));
  tree.props.onCancel({ preventDefault() {} }); assert.equal(h.closed(), 0);
  complete(); await tick(); assert.equal(h.closed(), 1);
  const failed = harness(async () => { throw Error('Synthetic export failure'); });
  nodes(failed.render(), 'button')[1].props.onClick(); await tick();
  assert.equal(failed.closed(), 0); assert(JSON.stringify(failed.render()).includes('Synthetic export failure'));
  const empty = harness(async () => { throw Error('Must not run'); }, 0);
  assert(nodes(empty.render(), 'button').slice(1).every(button => button.props.disabled));
  console.log('PASS: full/basic choice, duplicate-click guard, progress lock, Escape guard, error recovery, empty selection. Synthetic only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
