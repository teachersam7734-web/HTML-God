// test-lottie.mjs: lottie-web and dotLottie as ONE offline HTML file each, checked in headless Chrome over strict
// file:// (no --allow-file-access-from-files). Run from a work folder with scripts/package.json installed:
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-lottie-rive-video/scripts/test-lottie.mjs [outDir]
//
// 1. make-lottie.mjs writes the original test animation; make-dotlottie.py packs it (Python 3 from PYTHON, python3,
//    python or py)
// 2. each of the five lottie-web builds inlined with lottie-helpers.js and the JSON: 60 frames, 2 s, markers intro
//    and outro, marker seek lands on frame 30, ring pixel at frame 30, recolour turns the star red, setSpeed(8)
//    completes, destroy leaves nothing, no request outside file:, no errors
// 3. mount() under prefers-reduced-motion: reduce holds the poster frame and does not play; without it, it plays;
//    a hidden tab pauses it
// 4. dotLottie with setWasmUrl(data URL): zero requests, loads, markers, the same ring pixel at frame 30;
//    dotLottie WITHOUT setWasmUrl: the page asks the CDN for its WASM (the request is blocked and recorded)
// Pages written to outDir: lottie-<build>.html, dotlottie-offline.html (the single-file recipes).
// verified: Windows 10, Node 24, Playwright 1.63, Chrome 155, lottie-web 5.13.0, dotlottie-web 0.81.0, esbuild 0.28.2:
//           every check passes (numbers in SKILL.md).
// not verified: dotLottie worker mode, themes, state machines, the webgl and webgpu variants; Safari and Firefox.
// Adapted from code-media/lottie/test-lottie-web.cjs in the HTML-Sensei build project's research notes (not shipped) and test-dotlottie.cjs (run there);
// assertions, reduced motion and strict file:// are new here. Original code of this project.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, fileUrl, pkgDir, safe } from './pw.mjs';
import { makeLottie } from './make-lottie.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-lottie-')));
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const near = (a, b, tol = 8) => Array.isArray(a) && a.length >= 3 && [0, 1, 2].every(i => Math.abs(a[i] - b[i]) <= tol);

// 1
const json = JSON.stringify(makeLottie());
fs.writeFileSync(path.join(OUT, 'anim.json'), json);
let py = null;
for (const p of [process.env.PYTHON, 'python3', 'python', 'py'].filter(Boolean)) if (spawnSync(p, ['--version']).status === 0) { py = p; break; }
const pk = py && spawnSync(py, [path.join(HERE, 'make-dotlottie.py'), path.join(OUT, 'anim.json'), path.join(OUT, 'anim.lottie')], { encoding: 'utf8' });
const lottieBytes = fs.existsSync(path.join(OUT, 'anim.lottie')) ? fs.readFileSync(path.join(OUT, 'anim.lottie')) : null;
check('fixtures: JSON and .lottie written', !!lottieBytes, lottieBytes ? `JSON ${json.length} B, .lottie ${lottieBytes.length} B` : (pk ? pk.stderr : 'no Python found (set PYTHON)'));

const helpers = fs.readFileSync(path.join(HERE, 'lottie-helpers.js'), 'utf8');
const LW = path.join(pkgDir('lottie-web'), 'build', 'player');
const browser = await launch();
async function open(file, { reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 300, height: 300 }, reducedMotion });
  const net = [], errs = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u.slice(0, 110)); return r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message.slice(0, 160))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await p.goto(fileUrl(file));
  return { ctx, p, net, errs };
}

// 2
async function inPage({ renderer }) {
  const out = {};
  const data = JSON.parse(document.getElementById('d').textContent);
  const el = document.getElementById('a');
  const a = LottieHelpers.mount(lottie, el, data, { renderer, loop: false, autoplay: false });
  await new Promise(r => a.addEventListener('DOMLoaded', r));
  out.totalFrames = a.totalFrames; out.duration = a.getDuration();
  out.markers = (a.markers || []).map(m => (m.payload && m.payload.name) || m.cm || m.name);
  async function toCanvas(container) {
    if (renderer === 'canvas') return container.querySelector('canvas');
    const s = new XMLSerializer().serializeToString(container.querySelector('svg'));
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); await img.decode();
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; cv.getContext('2d').drawImage(img, 0, 0, 200, 200); return cv;
  }
  const px = async (c, x, y) => { const cv = await toCanvas(c), k = cv.width / 200; return Array.from(cv.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data); };
  a.goToAndStop(30, true); out.f30_ringTop = await px(el, 100, 40);
  a.goToAndStop('outro', true); out.frameAfterMarkerSeek = a.currentFrame;
  const rec = LottieHelpers.recolor(JSON.parse(JSON.stringify(data)), [1, 0.78, 0.2], [1, 0, 0]);
  const el2 = document.createElement('div'); el2.style.cssText = 'width:200px;height:200px;position:absolute;left:0;top:0;background:#fff'; document.body.appendChild(el2);
  const a2 = lottie.loadAnimation({ container: el2, renderer, loop: false, autoplay: false, animationData: rec });
  await new Promise(r => a2.addEventListener('DOMLoaded', r)); a2.goToAndStop(30, true);
  out.recolouredCentre = await px(el2, 100, 100); a2.destroy(); el2.remove();
  a.setSpeed(8); const t0 = performance.now(); a.goToAndStop(0, true);
  await new Promise(r => { a.addEventListener('complete', r); a.play(); setTimeout(r, 4000); });
  out.completeMs = Math.round(performance.now() - t0);
  out.domNodes = el.querySelectorAll('*').length;
  a.__teardown(); out.childrenAfterTeardown = el.children.length;
  return out;
}
const builds = [['lottie.min.js', 'svg'], ['lottie_light.min.js', 'svg'], ['lottie_svg.min.js', 'svg'], ['lottie_canvas.min.js', 'canvas'], ['lottie_light_canvas.min.js', 'canvas']];
const page = (lib, extra = '') => `<!doctype html><html lang="en"><meta charset="utf-8"><title>Lottie</title><body style="margin:0;background:#fff">
<div id="a" role="img" aria-label="A ring, a star and a dot" style="width:200px;height:200px"></div>
<script>${safe(lib)}</script><script>${safe(helpers)}</script>
<script type="application/json" id="d">${safe(json)}</script>${extra}</body></html>`;
for (const [file, renderer] of builds) {
  const lib = fs.readFileSync(path.join(LW, file), 'utf8');
  const f = path.join(OUT, 'lottie-' + file.replace('.min.js', '') + '.html'); fs.writeFileSync(f, page(lib));
  const { ctx, p, net, errs } = await open(f);
  const r = await p.evaluate(inPage, { renderer }).catch(e => ({ failed: String(e).slice(0, 200) }));
  const ok = r.totalFrames === 60 && r.duration === 2 && r.markers && r.markers.join() === 'intro,outro' && r.frameAfterMarkerSeek === 30
    && near(r.f30_ringTop, [107, 99, 255]) && near(r.recolouredCentre, [255, 0, 0]) && r.completeMs < 1500 && r.childrenAfterTeardown === 0 && !net.length && !errs.length;
  check(`lottie-web ${file} (${renderer}, ${Math.round(lib.length / 1024)} KB)`, ok, JSON.stringify(r) + (net.length ? ' NET ' + net : '') + (errs.length ? ' ERR ' + errs : ''));
  await ctx.close();
}

// 3
{
  const lib = fs.readFileSync(path.join(LW, 'lottie_svg.min.js'), 'utf8');
  const f = path.join(OUT, 'lottie-mount.html');
  fs.writeFileSync(f, page(lib, `<script>window.A=LottieHelpers.mount(lottie,document.getElementById('a'),JSON.parse(document.getElementById('d').textContent),{posterFrame:30});</script>`));
  for (const rm of ['reduce', 'no-preference']) {
    const { ctx, p } = await open(f, { reducedMotion: rm });
    await p.waitForTimeout(600);
    const s = await p.evaluate(() => ({ paused: A.isPaused, frame: Math.round(A.currentFrame), still: A.__still }));
    if (rm === 'reduce') check('mount: reduced motion holds the poster frame, no play', s.paused && s.still && s.frame === 30, JSON.stringify(s));
    else {
      check('mount: plays without reduced motion', !s.paused, JSON.stringify(s));
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      check('mount: a hidden tab pauses it', await p.evaluate(() => A.isPaused));
    }
    await ctx.close();
  }
}

// 4
{
  const req = createRequire(path.join(process.cwd(), 'noop.js'));
  const esbuild = await import(pathToFileURL(req.resolve('esbuild')).href);
  const pkg = pkgDir('@lottiefiles/dotlottie-web');
  const entry = path.join(OUT, 'dotlottie-entry.js');
  fs.writeFileSync(entry, `import { DotLottie } from ${JSON.stringify(path.join(pkg, 'dist/index.js').replace(/\\/g, '/'))}; window.DotLottie = DotLottie;`);
  const res = await esbuild.build({ entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, platform: 'browser', logLevel: 'error' });
  const lib = res.outputFiles[0].text;
  const wasm = fs.readFileSync(path.join(pkg, 'dist/dotlottie-player.wasm'));
  const mk = local => `<!doctype html><html lang="en"><meta charset="utf-8"><title>dotLottie</title><body style="margin:0;background:#fff">
<canvas id="c" width="200" height="200" style="width:200px;height:200px" role="img" aria-label="A ring, a star and a dot"></canvas>
<script>${safe(lib)}</script>
<script>${local ? `DotLottie.setWasmUrl('data:application/wasm;base64,${wasm.toString('base64')}');   // BEFORE the first player` : ''}
window.LOTTIE64='${lottieBytes ? lottieBytes.toString('base64') : ''}';</script></body></html>`;
  const probe = async () => {
    const cv = document.getElementById('c');
    const bytes = Uint8Array.from(atob(LOTTIE64), c => c.charCodeAt(0)).buffer;
    const d = new DotLottie({ canvas: cv, data: bytes, autoplay: false, loop: false, renderConfig: { devicePixelRatio: 1 } });
    const ev = []; ['load', 'loadError'].forEach(e => d.addEventListener(e, () => ev.push(e)));
    await Promise.race([new Promise(r => d.addEventListener('load', r)), new Promise(r => d.addEventListener('loadError', r)), new Promise(r => setTimeout(r, 6000))]);
    const o = { events: ev, isLoaded: d.isLoaded };
    if (!d.isLoaded) return o;
    o.totalFrames = d.totalFrames; o.markers = d.markers().map(m => m.name);
    d.setFrame(30); await new Promise(r => setTimeout(r, 250)); o.f30_ringTop = Array.from(cv.getContext('2d').getImageData(100, 40, 1, 1).data);
    d.destroy(); return o;
  };
  for (const local of [true, false]) {
    const f = path.join(OUT, local ? 'dotlottie-offline.html' : 'dotlottie-default-wasm.html'); fs.writeFileSync(f, mk(local));
    const { ctx, p, net, errs } = await open(f);
    const r = await p.evaluate(probe).catch(e => ({ failed: String(e).slice(0, 160) }));
    if (local) check(`dotLottie with setWasmUrl (page ${Math.round(fs.statSync(f).size / 1024)} KB)`, r.isLoaded && !net.length && r.markers.join() === 'intro,outro' && near(r.f30_ringTop, [107, 99, 255]) && !errs.length, JSON.stringify(r) + (net.length ? ' NET ' + net : '') + (errs.length ? ' ERR ' + errs.slice(0, 2) : ''));
    else check('dotLottie WITHOUT setWasmUrl asks a CDN for its WASM (offline trap)', net.some(u => /jsdelivr|unpkg/.test(u)), 'requested: ' + (net.join(' ') || 'nothing') + '; loaded: ' + r.isLoaded);
    await ctx.close();
  }
}
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed', '\npages in', OUT);
// Scratch: a folder this test made in the OS temp folder is removed when every check passes and kept (path printed)
// when one fails; a folder given on the command line is always kept.
if (!failed && !process.argv[2]) { fs.rmSync(OUT, { recursive: true, force: true }); console.log(`scratch removed: ${OUT}`); }
process.exit(failed ? 1 : 0);
