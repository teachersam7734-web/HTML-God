// test-protocols.mjs: the SAME page opened over file://, http://127.0.0.1 (secure context) and http://insecure.test (an
// insecure context made with a host-resolver rule). Prints a matrix of what works where. Nothing leaves the machine.
//   node test-protocols.mjs
// verified: Windows 10, Node 24, installed Chrome: the matrix in references/protocol-matrix.json (file://, http://127.0.0.1, an insecure host by resolver rule).
// not verified: Firefox and Safari; a real LAN host; real hosting providers.
// Origin: code-engineering/test-protocols.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); paths moved to work.mjs and sensei-verify's lib.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';
import { serve } from '../../sensei-verify/scripts/lib/server.mjs';
import { WORK, ensurePkg } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PK = ensurePkg(); const D = path.join(WORK, 'proto'); fs.mkdirSync(D, { recursive: true });
fs.copyFileSync(path.join(PK, 'add.wasm'), path.join(D, 'add.wasm'));
fs.writeFileSync(path.join(D, 'mod.js'), 'export const v = 1; window.__mod = "ran";');
fs.writeFileSync(path.join(D, 'sw.js'), 'self.addEventListener("fetch", () => {});');
fs.writeFileSync(path.join(D, 'w.js'), 'postMessage(1)');
fs.writeFileSync(path.join(D, 'probe.html'), `<!doctype html><meta charset=utf-8><title>probe</title>
<script type="module" src="mod.js"></script>
<script>
window.__probe = async () => {
  const R = {}, t = async (k, f) => { try { R[k] = await f(); } catch (e) { R[k] = 'ERR ' + (e.name || '') + ' ' + String(e.message).slice(0, 50); } };
  R.origin = location.origin; R.isSecureContext = isSecureContext; R.crossOriginIsolated = crossOriginIsolated;
  await t('moduleScriptSrc', async () => window.__mod === 'ran');
  await t('fetchSibling', async () => (await (await fetch('add.wasm')).arrayBuffer()).byteLength > 0);
  await t('wasmStreaming', async () => { await WebAssembly.instantiateStreaming(fetch('add.wasm')); return true; });
  await t('workerFromFile', () => new Promise((res, rej) => { const w = new Worker('w.js'); w.onmessage = () => res(true); w.onerror = e => rej(new Error('worker error')); setTimeout(() => rej(new Error('timeout')), 2000); }));
  await t('workerFromBlob', () => new Promise((res, rej) => { const w = new Worker(URL.createObjectURL(new Blob(['postMessage(1)']))); w.onmessage = () => res(true); w.onerror = () => rej(new Error('worker error')); setTimeout(() => rej(new Error('timeout')), 2000); }));
  await t('importModuleDynamic', async () => { const m = await import('./mod.js'); return m.v === 1; });
  await t('serviceWorker', async () => { if (!navigator.serviceWorker) return 'navigator.serviceWorker undefined'; const r = await navigator.serviceWorker.register('sw.js'); await r.unregister(); return true; });
  await t('localStorage', async () => { localStorage.setItem('k', 'v'); return localStorage.getItem('k') === 'v'; });
  await t('indexedDB', () => new Promise((res, rej) => { const q = indexedDB.open('t' + Math.random()); q.onsuccess = () => res(true); q.onerror = () => rej(q.error); }));
  await t('cryptoSubtle', async () => !!(crypto.subtle && await crypto.subtle.digest('SHA-256', new Uint8Array(1))));
  await t('randomUUID', async () => typeof crypto.randomUUID === 'function' && crypto.randomUUID().length === 36);
  await t('clipboardWrite', async () => typeof navigator.clipboard === 'object' && !!navigator.clipboard.writeText);
  await t('sharedArrayBuffer', async () => typeof SharedArrayBuffer === 'function');
  await t('mediaDevices', async () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  await t('audioContext', async () => { const c = new AudioContext(); const s = c.state; c.close(); return s; });
  await t('webgl2', async () => !!document.createElement('canvas').getContext('webgl2'));
  await t('xhrSibling', () => new Promise((res, rej) => { const x = new XMLHttpRequest(); x.open('GET', 'add.wasm'); x.onload = () => res(true); x.onerror = () => rej(new Error('xhr error')); x.send(); }));
  await t('canvasTaintFromFile', async () => { const i = new Image(); i.src = 'img.png'; await new Promise(r => { i.onload = i.onerror = r; }); const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d'); try { x.drawImage(i, 0, 0); x.getImageData(0, 0, 1, 1); return 'readable'; } catch (e) { return 'tainted: ' + e.name; } });
  return R;
};
</script>`);
fs.copyFileSync(path.join(PK, 'img.png'), path.join(D, 'img.png'));
// cross-document view transitions: a -> b, both opt in
const vt = (n, other) => `<!doctype html><meta charset=utf-8><style>@view-transition{navigation:auto}body{font:20px sans-serif}</style><title>${n}</title><a id=go href="${other}.html">go</a>
<script>addEventListener('pagereveal', e => { window.name = (window.name || '') + '|${n}:reveal:' + (e.viewTransition ? 'vt' : 'none'); });</script>`;
fs.writeFileSync(path.join(D, 'a.html'), vt('a', 'b')); fs.writeFileSync(path.join(D, 'b.html'), vt('b', 'a'));

const srv = await serve(D); const port = new URL(srv.origin).port;
const { browser, version } = await launch({ extraArgs: ['--host-resolver-rules=MAP insecure.test 127.0.0.1'] });
console.log('browser', version);
const targets = { 'file://': fileUrl(path.join(D, 'probe.html')), 'http://127.0.0.1': srv.origin + '/probe.html', 'http://insecure.test': `http://insecure.test:${port}/probe.html` };
const matrix = {};
for (const [name, url] of Object.entries(targets)) {
  const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(300);
  matrix[name] = await p.evaluate(() => window.__probe()); await ctx.close();
}
const keys = Object.keys(matrix['file://']);
const rows = keys.map(k => ({ probe: k, 'file://': String(matrix['file://'][k]), 'http 127.0.0.1': String(matrix['http://127.0.0.1'][k]), 'http insecure host': String(matrix['http://insecure.test'][k]) }));
console.table(rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.length > 38 ? v.slice(0, 38) + '..' : v]))));

// cross-document view transition
const vtRes = {};
for (const [name, base] of Object.entries({ 'file://': fileUrl(D) + '/', 'http 127.0.0.1': srv.origin + '/' })) {
  const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto(base + 'a.html'); await p.waitForTimeout(300);
  await p.click('#go'); await p.waitForTimeout(600); vtRes[name] = { sawViewTransitionObject: await p.evaluate(() => window.name), api: await p.evaluate(() => 'ViewTransition' in window && CSS.supports('selector(:root)')) }; await ctx.close();
}
console.log('cross-document view transition a -> b (pagereveal records vt when a transition object exists):'); console.log(JSON.stringify(vtRes, null, 1));
await browser.close(); await srv.close();
fs.writeFileSync(path.join(WORK, 'protocol-matrix.json'), JSON.stringify({ browser: version, matrix, vtRes }, null, 2));
