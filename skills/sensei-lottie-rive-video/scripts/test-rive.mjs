// test-rive.mjs: the Rive web runtime as ONE offline HTML file, five ways, in headless Chrome over strict file://.
//
//   RIV=<path to a .riv file> node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-lottie-rive-video/scripts/test-rive.mjs [outDir]
//
// NO .riv FILE SHIPS WITH THIS SKILL. The sample files in the rive-wasm repository have no stated artwork authorship,
// so they are fine to test with on your machine but not to ship. Pass your own file (or a sample you fetched) in RIV;
// a file with a state machine and inputs exercises the most. Run from a work folder with scripts/package.json
// installed (the @rive-app packages and esbuild).
//
// Variants: canvas + setWasmBinary, canvas-lite + setWasmBinary, canvas-single (WASM inside the JS), webgl2 +
// setWasmBinary, and canvas with NO setup (expected to ask unpkg for its WASM: the offline trap). For each: loads, no
// request outside file:, data:, blob:, artboard, animations, state machines; for 2D canvases pixels change while
// playing and pause stops; stateMachineInputs() is empty when the machine was not named at construction and filled
// when it was. Then rive-mount.js: inputs after mount, reduced motion does not play, a hidden tab pauses, teardown.
// verified: Windows 10, Node 24, Playwright 1.63, Chrome 155, @rive-app/* 2.45.0, with the rive-wasm sample
//           statemachine.riv (inputs MyNum, MyBool, MyTrig): every check passes (numbers in SKILL.md).
// not verified: visual parity with the Rive editor; Rive Text and audio (canvas-lite drops both); data binding;
//               webgl2 pixels (SwiftShader, and not readable through a 2D context); Safari and Firefox; phones.
// Adapted from code-media/rive/test-rive.cjs in the HTML-Sensei build project's research notes (not shipped) (run there); assertions, the network block,
// strict file:// and the wrapper test are new here. Original code of this project.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, fileUrl, pkgDir, safe } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RIV = process.env.RIV;
if (!RIV || !fs.existsSync(RIV)) {
  console.error('Set RIV to a .riv file (none ships with this skill: sample files have unknown artwork authorship).');
  process.exit(2);
}
const OUT = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-rive-')));
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const req = createRequire(path.join(process.cwd(), 'noop.js'));
const esbuild = await import(pathToFileURL(req.resolve('esbuild')).href);
const rivB64 = fs.readFileSync(RIV).toString('base64');
const minify = async f => (await esbuild.transform(fs.readFileSync(f, 'utf8'), { minify: true, loader: 'js' })).code;
const wasmSetup = wasm => `<script>(function(){var b=atob('${wasm.toString('base64')}'),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
rive.RuntimeLoader.setWasmBinary(u.buffer);rive.RuntimeLoader.setWasmFallbackUrl(null);})();</script>`;
const page = (lib, setup, extra = '') => `<!doctype html><html lang="en"><meta charset="utf-8"><title>Rive</title><body style="margin:0">
<canvas id="c" width="300" height="300" style="width:300px;height:300px" role="img" aria-label="Rive test animation"></canvas>
<script>${safe(lib)}</script>${setup}<script>window.RIV64='${rivB64}';</script>${extra}</body></html>`;

const browser = await launch();
async function open(file, { reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 320 }, reducedMotion });
  const net = [], errs = [];
  await ctx.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u.slice(0, 100)); return r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message.slice(0, 140))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  await p.goto(fileUrl(file));
  return { ctx, p, net, errs };
}

async function inPage() {
  const o = {}; const cv = document.getElementById('c');
  const buf = Uint8Array.from(atob(RIV64), c => c.charCodeAt(0)).buffer;
  const t0 = performance.now();
  const r = await new Promise((res, rej) => {
    const inst = new rive.Rive({ buffer: buf, canvas: cv, autoplay: false, enableRiveAssetCDN: false, onLoad: () => res(inst), onLoadError: e => rej(new Error('loadError ' + JSON.stringify(e))) });
    setTimeout(() => rej(new Error('timeout 10 s')), 10000);
  });
  o.loadMs = Math.round(performance.now() - t0);
  o.artboard = r.activeArtboard; o.animations = r.animationNames; o.stateMachines = r.stateMachineNames;
  o.inputsNotInstanced = {}; (r.stateMachineNames || []).forEach(n => { o.inputsNotInstanced[n] = (r.stateMachineInputs(n) || []).length; });
  r.resizeDrawingSurfaceToCanvas(1);
  const g = cv.getContext('2d');
  const hash = () => { if (!g) return null; const d = g.getImageData(0, 0, cv.width, cv.height).data; let s = 0; for (let i = 0; i < d.length; i += 28) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3]) >>> 0; return s; };
  // some timeline animations hold still for a while (a rating file's "Example"): try each until the pixels move
  for (const name of r.animationNames.slice(0, 4)) {
    r.stop(); r.play(name); await new Promise(x => setTimeout(x, 150));
    o.playing = r.isPlaying; const h1 = hash(); await new Promise(x => setTimeout(x, 450)); const h2 = hash();
    o.pixelsChange = g ? h1 !== h2 : 'webgl'; o.animationChecked = name;
    r.pause(); o.pausedAfterPause = !r.isPlaying;
    if (o.pixelsChange !== false) break;
  }
  const sm = r.stateMachineNames[0]; r.cleanup();
  if (sm) {
    const r2 = await new Promise((res, rej) => { const i = new rive.Rive({ buffer: buf, canvas: cv, autoplay: true, enableRiveAssetCDN: false, stateMachines: sm, onLoad: () => res(i), onLoadError: rej }); });
    const ins = r2.stateMachineInputs(sm) || [];
    o.inputsInstanced = ins.map(i => i.name + ':' + i.type);
    const num = ins.find(i => i.type === rive.StateMachineInputType.Number); if (num) { num.value = 12; o.numberReadBack = num.value; }
    r2.cleanup();
  }
  return o;
}

const variants = [
  { name: 'canvas + setWasmBinary', pkg: 'canvas', wasm: true },
  { name: 'canvas-lite + setWasmBinary', pkg: 'canvas-lite', wasm: true },
  { name: 'canvas-single', pkg: 'canvas-single', wasm: false },
  { name: 'webgl2 + setWasmBinary', pkg: 'webgl2', wasm: true, gl: true },
  { name: 'canvas, NO setup', pkg: 'canvas', wasm: false, trap: true },
];
let smName = null;
for (const v of variants) {
  const dir = pkgDir('@rive-app/' + v.pkg);
  const lib = await minify(path.join(dir, 'rive.js'));
  const html = page(lib, v.wasm ? wasmSetup(fs.readFileSync(path.join(dir, 'rive.wasm'))) : '');
  const f = path.join(OUT, 'rive-' + v.name.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '') + '.html'); fs.writeFileSync(f, html);
  const { ctx, p, net, errs } = await open(f);
  const r = await p.evaluate(inPage).catch(e => ({ failed: String(e).slice(0, 160) }));
  const mb = (html.length / 1048576).toFixed(2);
  if (v.trap) check(`${v.name}: asks a CDN for its WASM (offline trap)`, net.some(u => /unpkg|jsdelivr|rive\.app/.test(u)), `requested ${net.join(' ') || 'nothing'}; ${r.failed || 'loaded'}`);
  else {
    smName = smName || (r.stateMachines || [])[0] || null;
    const smOk = !r.stateMachines || !r.stateMachines.length || (Object.values(r.inputsNotInstanced).every(n => n === 0) && r.inputsInstanced && r.inputsInstanced.length > 0);
    const motionOk = !r.animations || !r.animations.length || (r.playing && r.pausedAfterPause && (v.gl || r.pixelsChange === true));
    check(`${v.name} (page ${mb} MB)`, !r.failed && !net.length && !errs.length && smOk && motionOk, JSON.stringify(r) + (net.length ? ' NET ' + net : '') + (errs.length ? ' ERR ' + errs.slice(0, 2) : ''));
  }
  await ctx.close();
}

// rive-mount.js on canvas-single
{
  const lib = await minify(path.join(pkgDir('@rive-app/canvas-single'), 'rive.js'));
  const mountJs = fs.readFileSync(path.join(HERE, 'rive-mount.js'), 'utf8');
  const extra = `<script>${safe(mountJs)}</script><script>
window.M = SenseiRive.mount(rive, document.getElementById('c'), { buffer: Uint8Array.from(atob(RIV64), c => c.charCodeAt(0)).buffer,
  stateMachine: ${JSON.stringify(smName)} || undefined, onReady: m => { window.READY = true; } });</script>`;
  const f = path.join(OUT, 'rive-mount.html'); fs.writeFileSync(f, page(lib, '', extra));
  for (const rm of ['no-preference', 'reduce']) {
    const { ctx, p, net, errs } = await open(f, { reducedMotion: rm });
    await p.waitForFunction('window.READY === true', null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(300);
    const s = await p.evaluate(() => ({ ready: !!window.READY, playing: M.isPlaying(), reduced: M.reduced, inputs: M.inputs().map(i => i.name) }));
    if (rm === 'reduce') check('rive-mount: reduced motion does not play', s.ready && s.reduced && !s.playing, JSON.stringify(s));
    else {
      check('rive-mount: plays, inputs present when a state machine is named', s.ready && s.playing && (!smName || s.inputs.length > 0) && !net.length && !errs.length, JSON.stringify(s) + (errs.length ? ' ERR ' + errs : ''));
      const hidden = await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); return M.isPlaying(); });
      check('rive-mount: a hidden tab pauses it', hidden === false);
      const torn = await p.evaluate(() => { M.teardown(); return M.rive === null; });
      check('rive-mount: teardown calls cleanup', torn && !errs.length, errs.join(' | '));
    }
    await ctx.close();
  }
}
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed', '\npages in', OUT);
// Scratch: a folder this test made in the OS temp folder is removed when every check passes and kept (path printed)
// when one fails; a folder given on the command line is always kept.
if (!failed && !process.argv[2]) { fs.rmSync(OUT, { recursive: true, force: true }); console.log(`scratch removed: ${OUT}`); }
process.exit(failed ? 1 : 0);
