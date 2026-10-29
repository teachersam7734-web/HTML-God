// test-inline.mjs: proves inline.mjs end to end in Chromium. Original project over file:// (expected to fail at run-time
// loads), packed file over file:// (expected to work, zero external requests).  node test-inline.mjs
// verified: Windows 10, Node 24.16, installed Chrome 156 via playwright-core 1.64.1, strict file://: 23 of 23 checks
//           (the command line's missing-folder and missing-entry cases included; 2026-10-28).
// not verified: other browsers; macOS and Linux.
// Origin: code-engineering/test-inline.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); paths moved to work.mjs and sensei-verify's lib.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';
import { WORK, ensurePkg } from './work.mjs';
import { inline } from './inline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = ensurePkg();
let fails = 0; const check = (n, ok, d) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? '  [' + (typeof d === 'string' ? d : JSON.stringify(d)) + ']' : '')); };

const { html, log } = inline(path.join(FX, 'index.html'), { lazyOver: 1 });
const OUT = path.join(WORK, 'pkg-single.html'); fs.writeFileSync(OUT, html);
console.log('packed:', (Buffer.byteLength(html) / 1024).toFixed(1), 'KB;', log.inlined.length, 'inlined;', log.assets.length, 'assets;', 'warnings:', log.warnings.join(' | ') || 'none');
check('no missing files', log.missing.length === 0, log.missing);
check('no remaining relative file references', !/(?:src|href)=["'](?!data:|#|blob:|https?:)[^"']+\.(?:css|js|png|svg|woff2|wav|webm|wasm)["']/i.test(html));
check('charset meta in first 1024 bytes', /<meta[^>]+charset/i.test(html.slice(0, 1024)));
check('the script block still has exactly its own closing tags (escaped </script in string)', (html.match(/<\/script>/gi) || []).length === (html.match(/<script\b/gi) || []).length, { open: (html.match(/<script\b/gi) || []).length, close: (html.match(/<\/script>/gi) || []).length });

async function run(url, lenientFile = false) {
  const { browser } = await launch({ lenientFile });
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const ext = [], errs = [], failed = [];
  page.on('request', r => { const u = r.url(); if (!/^(data|blob|about):/.test(u)) ext.push(u); });
  page.on('requestfailed', r => failed.push(r.url().split('/').pop()));
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });
  await page.goto(url); await page.waitForFunction('window.__done===true', null, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const png = document.getElementById('png'), svg = document.getElementById('svg'), vid = document.getElementById('vid');
    await new Promise(res => { if (vid.readyState >= 2) res(); else { vid.addEventListener('loadeddata', res, { once: true }); setTimeout(res, 3000); } });
    return { results: window.__results, tricky: window.__tricky, moduleRan: window.__moduleRan, pngW: png.naturalWidth, svgW: svg.naturalWidth, bodyFont: getComputedStyle(document.body).fontFamily, importedColour: getComputedStyle(document.querySelector('.imported')).color,
      bgImage: getComputedStyle(document.body).backgroundImage.slice(0, 14), videoReady: vid.readyState, videoW: vid.videoWidth, afterContent: getComputedStyle(document.querySelector('.c'), '::after').content, hasSrc: !!vid.src, favicon: (document.querySelector('link[rel=icon]') || {}).href?.slice(0, 20) };
  });
  await browser.close();
  return { r, ext, errs, failed };
}

const orig = await run(fileUrl(path.join(FX, 'index.html')));
console.log('\nORIGINAL over file:// (what a plain double click gives you):', JSON.stringify({ results: orig.r.results, failedRequests: orig.failed.slice(0, 6), videoReady: orig.r.videoReady }));
check('original fails at least one run-time load (fetch wasm, JSON or worker) over file:// in strict mode', ['wasmStreaming', 'wasmBuffer', 'worker', 'json'].some(k => String(orig.r.results?.[k] ?? 'ERR').startsWith('ERR')) || orig.r.results?.done !== true);
const lenient = await run(fileUrl(path.join(FX, 'index.html')), true);
check('with --allow-file-access-from-files the same original appears to work (the flag hides the bug)', lenient.r.results?.wasmBuffer === 42 && lenient.r.results?.worker === 42, lenient.r.results);

const p = await run(fileUrl(OUT));
console.log('\nPACKED over file://:', JSON.stringify(p.r));
check('packed: wasm via fetch + instantiateStreaming (needs application/wasm)', p.r.results.wasmStreaming === 5, p.r.results.wasmStreaming);
check('packed: wasm via fetch + arrayBuffer', p.r.results.wasmBuffer === 42, p.r.results.wasmBuffer);
check('packed: JSON fetched by path, unicode intact', p.r.results.json === 'مرحبا שלום héllo ✓', p.r.results.json);
check('packed: Worker from path (blob URL)', p.r.results.worker === 42, p.r.results.worker);
check('packed: audio decodes', p.r.results.audioSeconds === 0.3, p.r.results.audioSeconds);
check('packed: font loaded from data URI', p.r.results.fontLoaded === true);
check('packed: module script ran', p.r.moduleRan === true);
check('packed: </script> and <!-- in a JS string survive', p.r.tricky === '</script> and <!-- not a comment -->', p.r.tricky);
check('packed: PNG and SVG decode', p.r.pngW === 64 && p.r.svgW > 0, { png: p.r.pngW, svg: p.r.svgW });
check('packed: @import and url() in CSS resolved', p.r.importedColour === 'rgb(0, 170, 0)' && p.r.bgImage.startsWith('url("data:'), { c: p.r.importedColour, bg: p.r.bgImage });
check('packed: </style> inside a CSS string survives', p.r.afterContent === '"</style>"', p.r.afterContent);
check('packed: lazy video decoded and playable', p.r.videoReady >= 2 && p.r.videoW === 160, { ready: p.r.videoReady, w: p.r.videoW });
check('packed: zero network requests beyond the file itself', p.ext.length === 1, p.ext.length);
check('packed: no errors', p.errs.length === 0, p.errs);

// The command line (QC finding 13): an output folder that does not exist yet is created; a missing entry is a clear
// message and exit 2, not a stack trace.
{
  const { spawnSync } = await import('node:child_process');
  const cli = (...a) => spawnSync(process.execPath, [path.join(HERE, 'inline.mjs'), ...a], { encoding: 'utf8' });
  const outDir = path.join(WORK, 'cli-out-' + process.pid);
  fs.rmSync(outDir, { recursive: true, force: true });
  const made = cli(path.join(FX, 'index.html'), path.join(outDir, 'dist', 'page.html'), '--manifest', path.join(outDir, 'logs', 'manifest.json'));
  check('cli: creates a missing output folder (dist/page.html) and the manifest folder', made.status === 0 && fs.existsSync(path.join(outDir, 'dist', 'page.html')) && fs.existsSync(path.join(outDir, 'logs', 'manifest.json')), (made.stderr || '').slice(0, 300));
  const missing = cli(path.join(outDir, 'nope', 'index.html'), path.join(outDir, 'x.html'));
  check('cli: a missing entry exits 2 with a clear message and no stack trace', missing.status === 2 && /entry not found/.test(missing.stderr) && !/\n\s+at /.test(missing.stderr), missing.stderr);
  const folder = cli(FX, path.join(outDir, 'y.html'));
  check('cli: a folder as the entry exits 2 with a clear message', folder.status === 2 && /not a file/.test(folder.stderr), folder.stderr);
  fs.rmSync(outDir, { recursive: true, force: true });
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
