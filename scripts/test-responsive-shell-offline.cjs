// Exercises the actual shell with synthetic authentication; no SDK/network.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const code = ts.transpileModule(fs.readFileSync(path.join(root, 'app/components/AppShell.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
function harness(saved = null, storageFails = false) {
  const slots = [], deps = [], pending = [], listeners = {};
  let cursor = 0, effectCursor = 0, route = '/submissions';
  const store = new Map(saved === null ? [] : [['hcad.sidebar.collapsed', saved]]);
  const exports = {};
  vm.runInNewContext(code, { exports, window: { addEventListener: (key, fn) => listeners[key] = fn, removeEventListener: key => delete listeners[key] }, document: { documentElement: { classList: { remove() {} } } }, localStorage: { getItem: key => { if (storageFails) throw Error('denied'); return store.get(key); }, setItem: (key, value) => { if (storageFails && key !== 'theme') throw Error('denied'); store.set(key, value); } }, require: name => {
    if (name === 'react') return { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; }, useEffect: (fn, next) => { const i = effectCursor++; if (!deps[i] || next.some((x, j) => x !== deps[i][j])) { deps[i] = next; pending.push(fn); } } };
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'next/navigation') return { usePathname: () => route, useRouter: () => ({ replace() {} }) };
    if (name === '@/lib/useCurrentUser') return { useCurrentUser: () => ({ user: { role: 'admin', active: true }, loading: false }) };
    if (name === '@/lib/userAccounts') return { isClientAccount: () => false };
    if (name === 'firebase/auth') return { signOut() {} };
    if (name === '@/lib/firebase') return { auth: {} };
    if (name === 'lucide-react') return { PanelLeftOpen: () => null, PanelLeftClose: () => null };
    if (name.startsWith('./')) return { default: () => null };
    throw Error('Unexpected dependency: ' + name);
  } });
  function render() { cursor = 0; effectCursor = 0; const tree = exports.default({ children: React.createElement('div', null, 'Synthetic content') }); pending.splice(0).forEach(fn => fn()); return tree; }
  return { render, store, listeners, route: next => { route = next; } };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree.props || {})) return tree;
  for (const child of React.Children.toArray(tree.props?.children)) { const result = find(child, predicate); if (result) return result; }
  return null;
}
const h = harness(); h.render(); let tree = h.render();
const get = (predicate) => { const node = find(tree, predicate); assert(node); return node; };
assert(get(p => p.id === 'desktop-sidebar').props.className.includes('w-[288px]'));
get(p => typeof p.onToggle === 'function' && !p.collapsed).props.onToggle(); tree = h.render();
assert(!get(p => p.id === 'desktop-sidebar').props.className.includes('w-[288px]'));
assert.equal(h.store.get('hcad.sidebar.collapsed'), 'true');
h.route('/projects'); tree = h.render(); assert.equal(get(p => typeof p.onToggle === 'function' && p.collapsed).props.collapsed, true);
get(p => typeof p.onToggle === 'function' && p.collapsed).props.onToggle(); tree = h.render();
assert(get(p => p.id === 'desktop-sidebar').props.className.includes('w-[288px]'));
assert.equal(get(p => p.id === 'mobile-sidebar').props.hidden, true);
get(p => p['aria-label'] === 'Open menu').props.onClick(); tree = h.render(); assert.equal(get(p => p.id === 'mobile-sidebar').props.hidden, false);
h.listeners.keydown({ key: 'Escape' }); tree = h.render(); assert.equal(get(p => p.id === 'mobile-sidebar').props.hidden, true);
const restored = harness('true'); restored.render(); assert(find(restored.render(), p => typeof p.onToggle === 'function' && p.collapsed));
const denied = harness(null, true); denied.render(); const deniedTree = denied.render(); find(deniedTree, p => typeof p.onToggle === 'function' && !p.collapsed).props.onToggle(); assert(find(denied.render(), p => typeof p.onToggle === 'function' && p.collapsed));
const table = fs.readFileSync(path.join(root, 'app/components/CaseEpcrSubmissionsTable.tsx'), 'utf8');
assert(table.includes('const [detailed, setDetailed] = useState(true)'));
assert(table.includes('w-full min-w-[1720px]'));
console.log('PASS: default detailed table, full-width table, desktop collapse/expand, preference persistence, route retention, mobile close/Escape, storage unavailable. Synthetic only.');
