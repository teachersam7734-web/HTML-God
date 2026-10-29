// make-fixture.mjs: builds fixtures/pkg, a small multi-file project that exercises every inlining path.
// No dependencies beyond Playwright (only to record a tiny WebM with MediaRecorder; skipped with --no-video).
// verified: Windows 10, Node 24, installed Chrome (writes the pkg fixture used by test-inline, test-bundle, test-protocols).
// not verified: macOS and Linux.
// Origin: code-engineering/make-fixture.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); paths moved to work.mjs and sensei-verify's lib.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch } from '../../sensei-verify/scripts/lib/discover.mjs';
import { PKG, FIXTURES } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = PKG;
fs.mkdirSync(D, { recursive: true });
const w = (f, s) => fs.writeFileSync(path.join(D, f), s);

// PNG: 64x64 gradient, hand encoded
function crc(buf) { return zlib.crc32 ? zlib.crc32(buf) >>> 0 : (() => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } let x = 0xffffffff; for (const b of buf) x = t[(x ^ b) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; })(); }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
function png(wd, ht) {
  const raw = Buffer.alloc((wd * 3 + 1) * ht);
  for (let y = 0; y < ht; y++) { raw[y * (wd * 3 + 1)] = 0; for (let x = 0; x < wd; x++) { const o = y * (wd * 3 + 1) + 1 + x * 3; raw[o] = x * 4; raw[o + 1] = y * 4; raw[o + 2] = 160; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(wd, 0); ihdr.writeUInt32BE(ht, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(D, 'img.png'), png(64, 64));

// WAV: 0.3 s sine
{ const sr = 8000, n = Math.round(sr * 0.3), b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / sr) * 9000), 44 + i * 2); fs.writeFileSync(path.join(D, 'beep.wav'), b); }

// WASM: (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add)
fs.writeFileSync(path.join(D, 'add.wasm'), Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 1, 7, 1, 0x60, 2, 0x7f, 0x7f, 1, 0x7f, 3, 2, 1, 0, 7, 7, 1, 3, 0x61, 0x64, 0x64, 0, 0, 10, 9, 1, 7, 0, 0x20, 0, 0x20, 1, 0x6a, 0x0b]));

w('icon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#6c5ce7"/><text x="16" y="22" font-size="18" text-anchor="middle" fill="#fff">S</text></svg>');
w('bg.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="10" fill="#0af" fill-opacity=".4"/></svg>');
w('other.css', '.imported{color:#0a0}');
w('style.css', `@import url("other.css");
@font-face{font-family:"Fx";src:url("font.woff2") format("woff2");font-display:swap}
body{font-family:"Fx",system-ui,sans-serif;margin:0;padding:16px;background:#fff url("bg.svg") repeat;color:#111}
.box{width:120px;height:40px;background:#6c5ce7;color:#fff}
/* the closing tag below must survive inlining */
.c::after{content:"</style>"}
`);
w('worker.js', `onmessage=function(e){postMessage(e.data*2)}`);
w('data.json', JSON.stringify({ greeting: 'مرحبا שלום héllo ✓', n: 7 }));
w('mod.js', `window.__moduleRan = true; document.documentElement.dataset.mod = 'yes';`);
w('app.js', `// classic script
window.__tricky = "<\/script> and <!-- not a comment -->";
window.__results = {};
(async () => {
  const R = window.__results;
  try { const r = await WebAssembly.instantiateStreaming(fetch('add.wasm')); R.wasmStreaming = r.instance.exports.add(2, 3); } catch (e) { R.wasmStreaming = 'ERR ' + e.message; }
  try { const buf = await (await fetch('./add.wasm')).arrayBuffer(); const r = await WebAssembly.instantiate(buf); R.wasmBuffer = r.instance.exports.add(40, 2); } catch (e) { R.wasmBuffer = 'ERR ' + e.message; }
  try { const j = await (await fetch('data.json')).json(); R.json = j.greeting; } catch (e) { R.json = 'ERR ' + e.message; }
  try { R.worker = await new Promise((res, rej) => { const w = new Worker('worker.js'); w.onmessage = e => res(e.data); w.onerror = e => rej(new Error(e.message || 'worker error')); w.postMessage(21); setTimeout(() => rej(new Error('timeout')), 4000); }); } catch (e) { R.worker = 'ERR ' + e.message; }
  try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const ab = await (await fetch('beep.wav')).arrayBuffer(); const d = await ac.decodeAudioData(ab); R.audioSeconds = +d.duration.toFixed(2); } catch (e) { R.audioSeconds = 'ERR ' + e.message; }
  R.fontLoaded = await document.fonts.load('16px Fx').then(f => f.length > 0).catch(() => false);
  R.done = true; window.__done = true;
})();
`);
w('index.html', `<!doctype html>
<html lang="en" data-sensei-assets="add.wasm,worker.js,data.json,beep.wav">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Packaging fixture</title>
<link rel="icon" href="icon.svg">
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<h1 class="imported c">Packaging fixture</h1>
<img id="png" src="img.png" width="64" height="64" alt="gradient">
<img id="svg" src="icon.svg" width="32" height="32" alt="icon">
<div class="box">box</div>
<video id="vid" src="clip.webm" muted playsinline width="160" height="90"></video>
<audio id="aud" src="beep.wav"></audio>
</main>
<script src="app.js"></script>
<script type="module" src="mod.js"></script>
</body>
</html>
`);

if (!process.argv.includes('--no-video')) {
  const { browser } = await launch();
  const p = await browser.newPage();
  await p.goto('about:blank');
  const b64 = await p.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90; const cx = cv.getContext('2d');
    const st = cv.captureStream(15), rec = new MediaRecorder(st, { mimeType: 'video/webm;codecs=vp8' }), chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    const done = new Promise(r => rec.onstop = r); rec.start();
    const t0 = performance.now(); await new Promise(res => { const f = () => { const t = (performance.now() - t0) / 1000; cx.fillStyle = `hsl(${t * 120},70%,50%)`; cx.fillRect(0, 0, 160, 90); cx.fillStyle = '#fff'; cx.fillRect(t * 60 % 160, 30, 20, 20); t < 1.5 ? requestAnimationFrame(f) : res(); }; f(); });
    rec.stop(); await done;
    const buf = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192)); return btoa(s);
  });
  fs.writeFileSync(path.join(D, 'clip.webm'), Buffer.from(b64, 'base64'));
  await browser.close();
}
// the OFL Vazirmatn lab font, shipped for this test only (fixtures/test-font-OFL.txt travels with it)
const vaz = path.join(FIXTURES, 'test-font.woff2');
if (fs.existsSync(vaz)) fs.copyFileSync(vaz, path.join(D, 'font.woff2'));
console.log('fixture written to', D, fs.readdirSync(D).join(', '));
