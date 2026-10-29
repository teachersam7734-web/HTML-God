// test-bundle.mjs: esbuild to a single IIFE with assets inside it, then run it from file:// in Chromium.
//   SENSEI_NPM=<dir with esbuild> node test-bundle.mjs
// Covers: wasm via loader base64, image via dataurl, CSS imported from JS (extracted, then inlined), a Worker built
// separately and embedded as text -> Blob URL, import.meta.url define, "</script" escaping of the final bundle.
// verified: Windows 10, Node 24, esbuild from SENSEI_NPM, installed Chrome, strict file://: wasm 3, worker 42, PNG 64, import.meta.url define, </script escape, no errors.
// not verified: esbuild splitting (not for single files); other browsers.
// Origin: code-engineering/test-bundle.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); paths moved to work.mjs and sensei-verify's lib.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';
import { WORK, ensurePkg, npmRequire } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const esbuild = npmRequire('esbuild');
const FX = ensurePkg(); const W = path.join(WORK, 'bundle'); fs.mkdirSync(W, { recursive: true });
if (!fs.existsSync(path.join(FX, 'add.wasm'))) throw new Error('run make-fixture.mjs first');
for (const f of ['add.wasm', 'img.png']) fs.copyFileSync(path.join(FX, f), path.join(W, f));
fs.writeFileSync(path.join(W, 'worker-src.js'), 'onmessage=e=>postMessage(e.data+1)');
fs.writeFileSync(path.join(W, 'x.css'), '.x{color:rgb(1,2,3)}');
fs.writeFileSync(path.join(W, 'entry.js'), `
import wasmB64 from './add.wasm';          // loader base64 -> string
import png from './img.png';                // loader dataurl -> string
import workerText from './worker.bundle.js' with { type: 'text' }; // worker built first; .js defaults to the js loader, so the import attribute is REQUIRED (without it workerText is an object and the Worker dies with SyntaxError)
import './x.css';
const url = new URL('./thing', import.meta.url).href;   // would throw in a classic script without the define
const bytes = Uint8Array.fromBase64 ? Uint8Array.fromBase64(wasmB64) : Uint8Array.from(atob(wasmB64), c => c.charCodeAt(0));
(async () => {
  const { instance } = await WebAssembly.instantiate(bytes);
  const wurl = URL.createObjectURL(new Blob([workerText], { type: 'text/javascript' }));
  const w = new Worker(wurl); const wr = await new Promise(r => { w.onmessage = e => r(e.data); w.postMessage(41); });
  const img = new Image(); img.src = png; await img.decode();
  window.__r = { wasm: instance.exports.add(1, 2), worker: wr, png: img.naturalWidth, url, tricky: '</script>', cssClass: document.body.className };
  window.__done = true;
})();
`);
// 1. worker first
await esbuild.build({ entryPoints: [path.join(W, 'worker-src.js')], bundle: true, format: 'iife', minify: true, outfile: path.join(W, 'worker.bundle.js') });
// 2. main bundle
const r = await esbuild.build({ entryPoints: [path.join(W, 'entry.js')], bundle: true, format: 'iife', minify: true, write: false, outdir: W,
  loader: { '.wasm': 'base64', '.png': 'dataurl', '.css': 'css' }, define: { 'import.meta.url': '"https://invalid.local/app/"' }, legalComments: 'none', target: 'es2020' });
const js = r.outputFiles.find(f => f.path.endsWith('.js')).text, css = (r.outputFiles.find(f => f.path.endsWith('.css')) || { text: '' }).text;
const safe = js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
fs.writeFileSync(path.join(W, 'bundle.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>b</title><style>${css}</style><body class="x"><script>${safe}</script>`);
console.log('bundle bytes', js.length, 'css', css.length, 'contains raw </script ?', /<\/script/i.test(js));
const { browser } = await launch(); const p = await browser.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(fileUrl(path.join(W, 'bundle.html'))); await p.waitForFunction('window.__done===true', null, { timeout: 8000 }).catch(() => {});
const res = await p.evaluate(() => window.__r); await browser.close();
console.log(JSON.stringify(res), errs.length ? 'ERRORS ' + errs : 'no errors');
const ok = res && res.wasm === 3 && res.worker === 42 && res.png === 64 && res.url === 'https://invalid.local/app/thing' && res.tricky === '</script>' && !errs.length;
console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
