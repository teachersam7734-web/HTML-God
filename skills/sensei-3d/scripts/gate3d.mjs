// gate3d.mjs: the automatable gate for a 3D, WebGL or shader page, run headless with a software GL, written as a gate
// report the Stop hook (gate-claim.mjs) accepts.
//
//   node gate3d.mjs page.html [--t=1.2,3.4] [--static] [--no-ctx] [--name=id] [--project=dir] [--w=900 --h=500] [--timeout=30] [--lenient-file]
//
// Checks (each pass, fail, warn or skip):
//   lint       lib/lint/three.mjs, every rule (the lint-3d hook's rules plus no-cdn and random-in-seek-page)
//   load       zero page errors and zero console errors (console warnings are listed as warn)
//   network    no request except file:, data: and blob: (all others are blocked and listed)
//   frames     ?t=A and ?t=B: neither blank, and they differ          (--static: one frame, not blank)
//   motion     no ?t: two frames 0.9 s apart differ (a live loop)     (skipped with --static)
//   reduced    prefers-reduced-motion: reduce, no ?t: two frames 0.9 s apart are identical (no loop)
//   ctxloss    WEBGL_lose_context round trip at ?t=A: the frame comes back, close to the one before (--no-ctx skips)
// The page contract (every example in sensei-3d, sensei-holograms and sensei-shaders-vfx follows it):
//   window.__done = true after the first frame; ?t=<seconds> draws that frame and no loop; window.__seek(t) exists;
//   reduced motion draws one still frame and runs no loop.
//
// Adapted from the 3D lane's shot.js, rmtest.js and ctxloss.js (code-3d in the HTML-Sensei build project's research notes (not shipped)), which were run there;
// the combination, the pixel statistics and the report are new here.
// verified: Windows 10, Node 24, Chrome 155 + SwiftShader, Playwright 1.63, on the sensei-3d examples (starter, glb,
//           text3d, gpu-tier) and on the sensei-holograms and sensei-shaders-vfx examples; a page with no
//           reduced-motion branch and a page that did not re-apply renderer state after a restore were both failed correctly.
// not verified: frame rate on any target GPU (SwiftShader gives no speed numbers); WebGPU (no adapter here);
//               macOS and Linux; browsers other than Chromium.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launch, pageUrl, waitDone } from './browser.mjs';

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const spec = argv.find(a => !a.startsWith('--'));
if (!spec) { console.error('usage: node gate3d.mjs page.html [--t=1.2,3.4] [--static] [--no-ctx] [--name=id] [--project=dir]'); process.exit(2); }
const file = path.resolve(spec.split('?')[0]);
const [tA, tB] = String(opt.t || '1.2,3.4').split(',').map(Number);
const VIEW = { width: +(opt.w || 900), height: +(opt.h || 500) };
const withQ = (s, q) => s + (s.includes('?') ? '&' : '?') + q;
const checks = []; const add = (id, status, detail) => { checks.push({ id, status, detail }); console.log(`${status.toUpperCase().padEnd(12)} ${id}: ${detail}`); };

// 1. static lint
try {
  const { lintThree } = await import(new URL('../../../lib/lint/three.mjs', import.meta.url).href);
  const f = lintThree(fs.readFileSync(file, 'utf8'));
  const bad = f.filter(x => x.level === 'fail'), warn = f.filter(x => x.level === 'warn');
  add('lint', bad.length ? 'fail' : warn.length ? 'warn' : 'pass', f.length ? f.map(x => `${x.level} ${x.id}`).join('; ') : 'clean');
} catch (e) { add('lint', 'skip', 'lib/lint/three.mjs not found next to this skill (run the plugin copy): ' + e.message.slice(0, 80)); }

const { browser } = await launch({ lenientFile: !!opt['lenient-file'] });
const ana = await (await browser.newContext()).newPage();
// Pixel statistics in a blank page: luminance spread of one frame, and the share of pixels that changed between two.
async function stats(a, b = null) {
  return ana.evaluate(async ([a, b]) => {
    const load = async s => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
      const c = new OffscreenCanvas(bm.width, bm.height); const g = c.getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height).data; };
    const A = await load(a); let s = 0, s2 = 0; const n = A.length / 4;
    for (let i = 0; i < A.length; i += 4) { const l = .299 * A[i] + .587 * A[i + 1] + .114 * A[i + 2]; s += l; s2 += l * l; }
    const std = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)); let changed = null;
    if (b) { const B = await load(b); let c = 0; for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 8) c++; changed = c / n; }
    return { std, changed };
  }, [a.toString('base64'), b ? b.toString('base64') : null]);
}
const md5 = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 10);
const BLANK = 1.5;   // luminance standard deviation below this is a flat colour: nothing was drawn

const consoleErrors = [], consoleWarnings = [], pageErrors = [], blocked = [], notDone = [];
async function open(q, { reducedMotion = 'no-preference', watch = false } = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion });
  await ctx.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); blocked.push(u); return r.abort(); });
  const p = await ctx.newPage();
  if (watch) {
    p.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); if (m.type() === 'warning') consoleWarnings.push(m.text().slice(0, 200)); });
    p.on('pageerror', e => pageErrors.push(e.message.slice(0, 200)));
  }
  await p.goto(pageUrl(q));
  const done = await waitDone(p, +(opt.timeout || 30) * 1000);
  if (!done) notDone.push(q);
  return { ctx, p, done };
}

try {
  // 2 to 4. frames (also the load and network evidence)
  const A = await open(opt.static ? spec : withQ(spec, `t=${tA}`), { watch: true });
  await A.p.waitForTimeout(300); const shotA = await A.p.screenshot(); await A.ctx.close();
  const sA = await stats(shotA);
  if (opt.static) add('frames', sA.std > BLANK ? 'pass' : 'fail', `one frame, luminance spread ${sA.std.toFixed(1)} (blank below ${BLANK})`);
  else {
    const B = await open(withQ(spec, `t=${tB}`), { watch: true }); await B.p.waitForTimeout(300); const shotB = await B.p.screenshot(); await B.ctx.close();
    const sB = await stats(shotB, shotA);
    const ok = sA.std > BLANK && sB.std > BLANK && sB.changed > 0.001;
    add('frames', ok ? 'pass' : 'fail', `t=${tA} spread ${sA.std.toFixed(1)}, t=${tB} spread ${sB.std.toFixed(1)}, ${(sB.changed * 100).toFixed(2)}% of pixels differ`);
  }
  // 5. live motion
  if (!opt.static) {
    const M = await open(spec); await M.p.waitForTimeout(500); const m1 = await M.p.screenshot(); await M.p.waitForTimeout(900); const m2 = await M.p.screenshot(); await M.ctx.close();
    const s = await stats(m2, m1);
    add('motion', s.changed > 0.001 ? 'pass' : 'warn', s.changed > 0.001 ? `animating, ${(s.changed * 100).toFixed(2)}% changed in 0.9 s` : 'no change in 0.9 s: no live loop (fine only for a still page; use --static)');
  }
  // 6. reduced motion
  {
    const R = await open(spec, { reducedMotion: 'reduce' }); await R.p.waitForTimeout(500); const r1 = await R.p.screenshot(); await R.p.waitForTimeout(900); const r2 = await R.p.screenshot(); await R.ctx.close();
    const s = await stats(r2, r1); const still = md5(r1) === md5(r2) || s.changed < 0.0001;
    add('reduced', still && s.std > BLANK ? 'pass' : 'fail', `${still ? 'still' : 'ANIMATING'} under prefers-reduced-motion (${(s.changed * 100).toFixed(3)}% changed), spread ${s.std.toFixed(1)}`);
  }
  // 7. context loss round trip
  if (opt['no-ctx']) add('ctxloss', 'skip', '--no-ctx');
  else {
    const C = await open(opt.static ? spec : withQ(spec, `t=${tA}`)); await C.p.waitForTimeout(300); const before = await C.p.screenshot();
    const had = await C.p.evaluate(() => { const c = [...document.querySelectorAll('canvas')].find(c => c.width > 2); if (!c) return 'no canvas';
      const g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return 'no webgl context on the first canvas';
      window.__lost = 0; window.__rest = 0; c.addEventListener('webglcontextlost', () => window.__lost++); c.addEventListener('webglcontextrestored', () => window.__rest++);
      window.__ext = g.getExtension('WEBGL_lose_context'); if (!window.__ext) return 'WEBGL_lose_context missing'; window.__ext.loseContext(); return 'ok'; });
    if (had !== 'ok') add('ctxloss', 'skip', had);
    else {
      await C.p.waitForTimeout(400); await C.p.evaluate(() => window.__ext.restoreContext()); await C.p.waitForTimeout(1200);
      const after = await C.p.screenshot(); const ev = await C.p.evaluate(() => [window.__lost, window.__rest]);
      const s = await stats(after, before);
      const ok = s.std > BLANK && s.changed < 0.02;
      add('ctxloss', ok ? 'pass' : 'fail', `lost ${ev[0]}, restored ${ev[1]}; after restore spread ${s.std.toFixed(1)}, ${(s.changed * 100).toFixed(2)}% differs from before`);
    }
    await C.ctx.close();
  }
  add('load', pageErrors.length || consoleErrors.length || notDone.length ? 'fail' : consoleWarnings.length ? 'warn' : 'pass',
    pageErrors.length || consoleErrors.length || consoleWarnings.length || notDone.length ? [...notDone.map(q => 'window.__done never set: ' + q), ...pageErrors.map(e => 'pageerror ' + e), ...consoleErrors.map(e => 'error ' + e), ...consoleWarnings.map(e => 'warning ' + e)].slice(0, 6).join(' | ') : 'no errors, no warnings');
  add('network', blocked.length ? 'fail' : 'pass', blocked.length ? 'requests outside the file: ' + [...new Set(blocked)].slice(0, 5).join(', ') : 'only file:, data: and blob:');
} finally { await browser.close(); }

// report
const src = fs.readFileSync(file, 'utf8');
const notVerified = ['frame rate on the target device (software GL gives no speed numbers)', 'browsers other than Chromium'];
if (/WebGPURenderer/.test(src)) notVerified.push('the WebGPU backend (only the WebGL2 fallback can run without a GPU adapter)');
const report = { target: file, checks, verified: checks.filter(c => c.status === 'pass').map(c => `${c.id}: ${c.detail}`), not_verified: notVerified };
// Same order as the Stop hook (gate-claim.mjs reads CLAUDE_PROJECT_DIR), so the report lands where it is read.
const findProject = () => { if (opt.project) return path.resolve(opt.project); if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR); let d = path.dirname(file); for (;;) { if (fs.existsSync(path.join(d, '.sensei'))) return d; const u = path.dirname(d); if (u === d) return process.cwd(); d = u; } };
const name = String(opt.name || 'gate3d-' + path.basename(file).replace(/\.[^.]+$/, ''));
let out;
try { const { writeGateReport } = await import(new URL('../../../lib/gate.mjs', import.meta.url).href); out = writeGateReport(findProject(), name, report); }
catch {
  const dir = path.join(findProject(), '.sensei', 'gate'); fs.mkdirSync(dir, { recursive: true }); out = path.join(dir, name + '.json');
  fs.writeFileSync(out, JSON.stringify({ gate: name, at: new Date().toISOString(), verdict: checks.some(c => c.status === 'fail') ? 'fail' : checks.some(c => c.status === 'warn') ? 'warn' : 'pass', ...report }, null, 2) + '\n');
}
const fails = checks.filter(c => c.status === 'fail').length;
console.log(`\n${fails ? 'FAIL' : 'PASS'} (${fails} failing check(s)); report: ${out}`);
process.exit(fails ? 1 : 0);
