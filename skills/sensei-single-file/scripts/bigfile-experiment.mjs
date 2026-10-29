// bigfile-experiment.mjs: what does Chromium do with very large single HTML files, by embedding form?
//   node bigfile-experiment.mjs [sizesMB=10,50,100] [forms=textplain-head,textplain-end,jsstring,imgdata,audiodata]
// Payload sizes are the BASE64 TEXT size in the file. Random bytes (incompressible), so nothing here is flattered by gzip.
// Per run: fresh browser, file:// load. Reports load time, first contentful paint, JS heap, whole-browser memory
// (before and 3 s after), and for the text forms the cost of turning the text back into bytes by three methods.
// Machine paths: none. Output goes to <SENSEI_WORK>/_bigfile/ (deleted at the end unless --keep); results to <SENSEI_WORK>/bigfile-results.json.
// verified: Windows 10, Node 24, installed Chrome via playwright-core 1.62; the research run measured 10 to 200 MB in five forms (references/bigfile-results.json); re-run here at 10 MB, text block and JS string.
// not verified: other browsers, phones, sizes above 200 MB.
// Origin: code-engineering/bigfile-experiment.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); paths moved to work.mjs and sensei-verify's lib.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, browserMemoryMB } from '../../sensei-verify/scripts/lib/discover.mjs';
import { WORK } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const sizes = (args.find(a => /^\d/.test(a)) || '10,50,100').split(',').map(Number);
const forms = (args.find(a => /^[a-z]/.test(a) && !a.startsWith('--')) || 'textplain-head,textplain-end,jsstring,imgdata,audiodata').split(',');
const DIR = path.join(WORK, '_bigfile'); fs.mkdirSync(DIR, { recursive: true });

function writeRandomB64(fd, targetChars) {
  const block = 3 * 1024 * 1024; let written = 0;
  while (written < targetChars) { const b = crypto.randomBytes(block).toString('base64'); fs.writeSync(fd, b); written += b.length; }
  return written;
}
function pngNoise(targetBytes) {
  // RGB noise, stored (level 0) so the file size is the target; returns a Buffer-producing generator of the whole PNG
  const side = Math.ceil(Math.sqrt(targetBytes / 3)); const rowLen = side * 3 + 1;
  const raw = Buffer.alloc(rowLen * side); for (let y = 0; y < side; y++) crypto.randomFillSync(raw, y * rowLen + 1, rowLen - 1), raw[y * rowLen] = 0;
  const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = buf => { let x = 0xffffffff; for (let i = 0; i < buf.length; i++) x = crcT[(x ^ buf[i]) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(side, 0); ihdr.writeUInt32BE(side, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 0 })), chunk('IEND', Buffer.alloc(0))]);
}
function wavNoise(bytes) { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + bytes, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(bytes, 40); return Buffer.concat([h, crypto.randomBytes(bytes)]); }

function build(form, mb) {
  const f = path.join(DIR, `${form}-${mb}.html`); const fd = fs.openSync(f, 'w'); const chars = mb * 1024 * 1024;
  const head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>big</title><style>body{font:20px system-ui;margin:40px}h1{margin:0}</style>';
  const body = '</head><body><h1 id="h">Hello, large file</h1><p>First paint marker.</p>';
  const w = s => fs.writeSync(fd, s);
  if (form === 'textplain-head') { w(head + '<script type="application/x-sensei-asset" id="d">'); writeRandomB64(fd, chars); w('</script>' + body + '</body></html>'); }
  else if (form === 'textplain-end') { w(head + body); w('<script type="application/x-sensei-asset" id="d">'); writeRandomB64(fd, chars); w('</script></body></html>'); }
  else if (form === 'jsstring') { w(head + body + '<script>window.D="'); writeRandomB64(fd, chars); w('";window.__done=true</script></body></html>'); }
  else if (form === 'imgdata') { const png = pngNoise(Math.round(chars * 0.75)); w(head + body + '<img id="i" style="width:300px;height:auto" src="data:image/png;base64,'); const b = png.toString('base64'); w(b); w('"></body></html>'); }
  else if (form === 'audiodata') { const wav = wavNoise(Math.round(chars * 0.75)); w(head + body + '<audio id="a" preload="auto" src="data:audio/wav;base64,'); w(wav.toString('base64')); w('"></audio></body></html>'); }
  fs.closeSync(fd); return f;
}

const results = [];
for (const form of forms) for (const mb of sizes) {
  if (form === 'imgdata' && mb > 100) { results.push({ form, mb, skipped: 'noise PNG over 100 MB needs a decoded bitmap of ~' + Math.round(mb * 4 / 3) + ' MB x4' }); continue; }
  let f; const t0 = Date.now();
  try { f = build(form, mb); } catch (e) { results.push({ form, mb, error: 'build: ' + e.message }); continue; }
  const size = fs.statSync(f).size; const buildMs = Date.now() - t0;
  const { browser } = await launch();
  const r = { form, mb, fileMB: +(size / 1048576).toFixed(1) };
  try {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 120))); page.on('crash', () => errs.push('PAGE CRASHED'));
    const m0 = await browserMemoryMB(browser);
    const t1 = Date.now();
    await page.goto(fileUrl(f), { waitUntil: 'load', timeout: 240000 });
    r.loadMs = Date.now() - t1;
    r.paint = await page.evaluate(() => ({ fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || -1), dcl: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd) }));
    r.jsHeapMB = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
    r.memIdleBeforeMB = m0.totalMB; r.memAfterLoadMB = (await browserMemoryMB(browser)).totalMB;
    await page.waitForTimeout(3000); const m2 = await browserMemoryMB(browser); r.mem3sLaterMB = m2.totalMB; r.mem3sLaterByType = m2.byType;
    if (form.startsWith('textplain')) {
      r.decode = await page.evaluate(async () => {
        const el = document.getElementById('d'); const t = performance.now(); const txt = el.textContent; const readMs = performance.now() - t; const out = { textLen: txt.length, readTextContentMs: +readMs.toFixed(0) };
        const time = async (name, fn) => { const s = performance.now(); try { const v = await fn(); out[name] = { ms: +(performance.now() - s).toFixed(0), bytes: v }; } catch (e) { out[name] = { error: String(e.message).slice(0, 80) }; } };
        await time('fetchDataUrl', async () => (await (await fetch('data:application/octet-stream;base64,' + txt)).blob()).size);
        await time('atobLoop', async () => { const bin = atob(txt), n = bin.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.length; });
        await time('fromBase64', async () => typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(txt).length : Promise.reject(new Error('not supported')));
        return out;
      });
    } else if (form === 'jsstring') { r.stringLen = await page.evaluate(() => window.D && window.D.length); }
    else if (form === 'imgdata') { r.imgOk = await page.evaluate(async () => { const i = document.getElementById('i'); await i.decode().catch(() => {}); return { w: i.naturalWidth, complete: i.complete }; }); }
    else if (form === 'audiodata') { r.audioOk = await page.evaluate(async () => { const a = document.getElementById('a'); await new Promise(res => { if (a.readyState >= 1) res(); else { a.addEventListener('loadedmetadata', res, { once: true }); a.addEventListener('error', res, { once: true }); setTimeout(res, 15000); } }); return { readyState: a.readyState, duration: +a.duration.toFixed(1), error: a.error && a.error.code }; }); }
    r.errors = errs;
  } catch (e) { r.error = String(e.message).split('\n')[0]; }
  await browser.close().catch(() => {});
  try { fs.unlinkSync(f); } catch {}
  results.push(r);
  console.log(JSON.stringify(r));
}
fs.writeFileSync(path.join(WORK, 'bigfile-results.json'), JSON.stringify({ when: new Date().toISOString(), node: process.version, os: `${os.platform()} ${os.release()}`, ramGB: +(os.totalmem() / 2 ** 30).toFixed(1), results }, null, 2));
if (!process.argv.includes('--keep')) { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {} }
