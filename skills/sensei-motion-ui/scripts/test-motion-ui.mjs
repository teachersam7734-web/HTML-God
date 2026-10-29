// test-motion-ui.mjs: proves spring-linear.js, motion-gate.js, vendor-inline.mjs and the three examples.
// HTML-Sensei's own code.
//
//   node test-motion-ui.mjs [--libs DIR]   DIR: a folder whose node_modules holds gsap and motion (for engines.html);
//                                          without it the engines part is skipped and says so.
//
// verified: Windows 10, Node 24, playwright-core 1.64, installed Chrome 156 headless, strict file://, gsap 3.15.0,
//           motion 14.6.0.
// not verified: Firefox, Safari; macOS and Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..', 'examples');
const require = createRequire(import.meta.url);
const { ok, summary } = checker();

// ---------- 1. spring-linear.js in Node ----------
const springLinear = require('./spring-linear.js');
{
  const s = springLinear({ stiffness: 260, damping: 16 });
  ok('spring 260/16: about 16.6% overshoot', Math.abs(s.peak - 1.166) < 0.002, `peak ${s.peak}, zeta ${s.zeta}`);
  ok('spring 260/16: settles in about 0.8 s', s.duration > 700 && s.duration < 950, `${s.duration} ms, ${s.stops} stops, ${s.css.length} chars`);
  // Evaluate the linear() stops piecewise and compare with the closed form.
  const pts = s.css.slice(7, -1).split(', ').map((p, i, a) => { const [v, pc] = p.split(' '); return [i === 0 ? 0 : i === a.length - 1 ? 1 : parseFloat(pc) / 100, parseFloat(v)]; });
  let worst = 0;
  for (let u = 0; u <= 1; u += 0.001) {
    const j = pts.findIndex(p => p[0] >= u); const [a, b] = j <= 0 ? [pts[0], pts[0]] : [pts[j - 1], pts[j]];
    const v = b[0] === a[0] ? a[1] : a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0]);
    worst = Math.max(worst, Math.abs(v - (u === 1 ? 1 : springLinear.step(u * s.duration / 1000, 260, 16, 1))));
  }
  ok('linear() stops follow the closed-form spring', worst < 0.004, `max error ${worst.toFixed(4)}`);
  ok('critically damped: no overshoot', springLinear({ stiffness: 170, damping: 2 * Math.sqrt(170) }).peak <= 1.0001);
  ok('over-damped: no overshoot', springLinear({ stiffness: 170, damping: 40 }).peak <= 1.0001);
}

const { browser } = await launch();
const libsI = process.argv.indexOf('--libs');
try {
  async function open(file, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 1100 }, ...opts });
    const p = await ctx.newPage(); const errors = [], external = [];
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('request', q => { if (!/^(file|data|blob|about):/.test(q.url())) external.push(q.url()); });
    await p.goto(fileUrl(file)); await p.waitForFunction('window.__done === true');
    return { p, ctx, errors, external };
  }

  // ---------- 2. micro.html ----------
  {
    const { p, ctx, errors, external } = await open(path.join(EX, 'micro.html'));
    ok('micro: linear() spring accepted by the browser', await p.evaluate(() => CSS.supports('transition-timing-function', window.__spring.css)));
    const bb = await p.locator('#save').boundingBox();
    await p.mouse.move(bb.x + 10, bb.y + 10); await p.mouse.down(); await p.waitForTimeout(250);
    ok('micro: press scales to 0.96 while held', (await p.evaluate(() => getComputedStyle(document.getElementById('save')).scale)) === '0.96');
    await p.mouse.move(5, 5); await p.mouse.up(); await p.waitForTimeout(900);

    // Spring overshoot, sampled per frame on the switch knob.
    const knob = await p.evaluate(() => new Promise(res => { const sw = document.getElementById('sw'); const tr = []; sw.checked = true; const t0 = performance.now();
      (function s() { tr.push(parseFloat(getComputedStyle(sw, '::after').translate) || 0); if (performance.now() - t0 < 1100) requestAnimationFrame(s); else res({ max: Math.max(...tr), end: tr[tr.length - 1] }); })(); }));
    ok('micro: switch knob overshoots its 24 px rest, then settles', knob.max > 25 && Math.abs(knob.end - 24) < 0.3, `max ${knob.max.toFixed(2)}, end ${knob.end.toFixed(2)}`);
    await p.evaluate(() => { document.getElementById('sw').checked = false; }); await p.waitForTimeout(900);
    await p.focus('#sw'); await p.keyboard.press('Space');
    ok('micro: switch toggles by keyboard, role switch', await p.evaluate(() => document.getElementById('sw').checked && document.getElementById('sw').getAttribute('role') === 'switch'));

    // Hover lift composes with the entrance animation (individual translate); a transform hover would not.
    const top0 = (await p.locator('#card').boundingBox()).y;
    await p.hover('#card'); await p.waitForTimeout(400);
    const top1 = (await p.locator('#card').boundingBox()).y;
    ok('micro: hover lift applies over a fill-both entrance (translate)', top0 - top1 > 3, `${(top0 - top1).toFixed(1)} px`);
    await p.mouse.move(5, 5); await p.waitForTimeout(400);
    const blocked = await p.evaluate(async () => { const st = document.createElement('style'); st.textContent = '.card.t{transition:none}.card.t:hover{translate:none!important;transform:translateY(-4px)}'; document.head.append(st);
      const c = document.getElementById('card'); c.classList.add('t'); return c.getBoundingClientRect().top; });
    await p.hover('#card'); await p.waitForTimeout(200);
    const after = (await p.locator('#card').boundingBox()).y;
    ok('micro: a transform hover loses to the animation (the trap reproduces)', Math.abs(after - blocked) < 0.5, `${(blocked - after).toFixed(1)} px moved`);
    await p.evaluate(() => document.getElementById('card').classList.remove('t')); await p.mouse.move(5, 5);

    // Toast in the persistent region, removed after its time.
    await p.evaluate(() => window.toast('Short', 300)); await p.waitForTimeout(100);
    ok('micro: toast inserted into the polite live region', await p.evaluate(() => document.querySelectorAll('#toasts .toast').length === 1 && document.getElementById('toasts').getAttribute('aria-live') === 'polite'));
    await p.waitForTimeout(900);
    ok('micro: toast removed after its exit', await p.evaluate(() => document.querySelectorAll('#toasts .toast').length === 0));

    ok('micro: skeleton replaced, aria-busy false', await p.evaluate(() => window.__loaded && document.getElementById('loading').getAttribute('aria-busy') === 'false'));
    await p.fill('#em', 'nope'); await p.locator('#em').blur();
    ok('micro: invalid on blur with a message', await p.evaluate(() => document.getElementById('em').getAttribute('aria-invalid') === 'true' && document.getElementById('em-err').textContent.length > 5));
    await p.fill('#em', 'a@b.co');
    ok('micro: fixed live once touched', await p.evaluate(() => document.getElementById('em').getAttribute('aria-invalid') === 'false' && document.getElementById('em-err').textContent === ''));

    await p.focus('#save'); await p.keyboard.press('Enter'); await p.waitForTimeout(50);
    ok('micro: pending state keeps focus on the button', await p.evaluate(() => document.getElementById('save').getAttribute('aria-disabled') === 'true' && document.activeElement.id === 'save'));
    await p.keyboard.press('Enter'); await p.waitForTimeout(30);
    ok('micro: a second press while pending is ignored', (await p.textContent('#save')) === 'Saving...');
    await p.waitForTimeout(1100);
    ok('micro: success: check drawn, focus still on the button', await p.evaluate(() => getComputedStyle(document.querySelector('#check path')).strokeDashoffset === '0px' && document.activeElement.id === 'save'));
    ok('micro: no console errors', errors.length === 0, errors.join(' | '));
    ok('micro: no network requests', external.length === 0, external.join(' '));
    await ctx.close();
  }
  {
    const { p, ctx } = await open(path.join(EX, 'micro.html'), { reducedMotion: 'reduce' });
    ok('micro reduced: skeleton shimmer off', await p.evaluate(() => { const s = document.querySelector('.sk'); return !s || getComputedStyle(s).animationName === 'none'; }));
    ok('micro reduced: check shown at once', (await p.evaluate(() => getComputedStyle(document.querySelector('#check path')).strokeDashoffset)) === '0px');
    ok('micro reduced: no infinite animation running', await p.evaluate(() => document.getAnimations().every(a => a.effect.getComputedTiming().iterations !== Infinity)));
    ok('micro reduced: gate attribute set', (await p.getAttribute('html', 'data-motion')) === 'reduce');
    await ctx.close();
  }
  {
    const { p, ctx } = await open(path.join(EX, 'micro.html'), { forcedColors: 'active' });
    ok('micro forced colours: buttons and switch keep a border', await p.evaluate(() => [...document.querySelectorAll('.btn, .sw')].every(e => parseFloat(getComputedStyle(e).borderTopWidth) > 0 && getComputedStyle(e).borderTopStyle !== 'none')));
    await ctx.close();
  }

  // ---------- 3. motion-gate.js live change, and the infinite-duration trap ----------
  {
    const { p, ctx } = await open(path.join(EX, 'micro.html'));
    await p.evaluate(() => { window.__seen = []; SenseiMotionGate.on(r => window.__seen.push(r)); });
    await p.emulateMedia({ reducedMotion: 'reduce' }); await p.waitForTimeout(100);
    ok('gate: a live change of the setting reaches subscribers', await p.evaluate(() => window.__seen.join() === 'false,true' && SenseiMotionGate.reduce));
    ok('gate: animate() lands on the final frame at once under reduce', await p.evaluate(async () => { const d = document.createElement('div'); document.body.append(d);
      const a = SenseiMotionGate.animate(d, [{ transform: 'translateX(0px)' }, { transform: 'translateX(100px)' }], { duration: 1000, fill: 'forwards' });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return getComputedStyle(d).transform.includes('100'); }));
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    const jump = await p.evaluate(async () => { const d = document.createElement('div'); d.style.cssText = 'animation: pulseT 1s linear infinite'; const st = document.createElement('style'); st.textContent = '@keyframes pulseT{to{opacity:.5}}'; document.head.append(st); document.body.append(d);
      await new Promise(r => setTimeout(r, 1250)); const a = d.getAnimations()[0]; const before = a.effect.getComputedTiming().progress; d.style.animationDuration = '2s'; getComputedStyle(d).animationDuration; const after = a.effect.getComputedTiming().progress; return { before, after }; });
    ok('trap: changing an infinite animation\'s duration jumps its phase', Math.abs(jump.after - jump.before) > 0.2, `progress ${jump.before.toFixed(2)} to ${jump.after.toFixed(2)}`);
    await ctx.close();
  }

  // ---------- 4. heartbeat.html on the audio clock ----------
  {
    const { browser: b2 } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
      const ctx = await b2.newContext(); const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.goto(fileUrl(path.join(EX, 'heartbeat.html'))); await p.waitForFunction('window.__done === true');
      await p.click('#start'); await p.waitForTimeout(1400);
      const r1 = await p.evaluate(() => ({ audio: window.__hb.usingAudio, beats: window.__beats.filter(b => b.audio != null).map(b => ({ a: b.audio, booked: b.bookedAt, start: b.anim.startTime, perf: b.perf, bpm: b.bpm })) }));
      ok('heartbeat: follows the audio clock', r1.audio && r1.beats.length >= 2, `${r1.beats.length} beats`);
      const gaps = r1.beats.slice(1).map((b, i) => b.a - r1.beats[i].a);
      ok('heartbeat: beats exactly 60/bpm apart on the audio clock', gaps.every(g => Math.abs(g - 60 / 72) < 1e-6), gaps.map(g => g.toFixed(4)).join(', '));
      ok('heartbeat: every beat booked ahead of the audio clock', r1.beats.every(b => b.a > b.booked));
      ok('heartbeat: each pulse starts at its beat on the document timeline', r1.beats.every(b => Math.abs(b.start - b.perf) < 0.01));
      await p.evaluate(() => { const r = document.getElementById('bpm'); r.value = 120; r.dispatchEvent(new Event('input')); });
      await p.waitForTimeout(1500);
      const r2 = await p.evaluate(() => ({ beats: window.__beats.map(b => ({ a: b.audio, bpm: b.bpm, state: b.anim.playState })) }));
      const fast = r2.beats.filter(b => b.bpm === 120); const fg = fast.slice(1).map((b, i) => b.a - fast[i].a);
      ok('heartbeat: a tempo change takes effect from the next beat', fg.length >= 1 && fg.every(g => Math.abs(g - 0.5) < 1e-6), fg.map(g => g.toFixed(3)).join(', '));
      ok('heartbeat: no pulse cancelled or restarted by the tempo change', r2.beats.every(b => b.state !== 'idle'));
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      ok('heartbeat: stops when the tab is hidden', await p.evaluate(() => window.__stoppedHidden === true && document.getElementById('start').getAttribute('aria-pressed') === 'false'));
      ok('heartbeat: no page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
      // Fallback: no audio at all.
      const ctx2 = await b2.newContext({ reducedMotion: 'reduce' }); const q = await ctx2.newPage();
      await q.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
      await q.goto(fileUrl(path.join(EX, 'heartbeat.html'))); await q.waitForFunction('window.__done === true');
      await q.click('#start'); await q.waitForTimeout(1200);
      const r3 = await q.evaluate(() => ({ audio: window.__hb.usingAudio, n: window.__beats.length, scale: window.__beats.some(b => JSON.stringify(b.anim.effect.getKeyframes()).includes('scale')) }));
      ok('heartbeat: without audio it follows the page clock', !r3.audio && r3.n >= 2, `${r3.n} beats`);
      ok('heartbeat reduced: the pulse has no scale', !r3.scale);
      await ctx2.close();
    } finally { await b2.close(); }
  }

  // ---------- 5. engines.html: vendor-inline, then the three engines behind the gate ----------
  if (libsI < 0) console.log('SKIP  engines: pass --libs DIR (a folder with gsap and motion in node_modules)');
  else {
    const libs = path.resolve(process.argv[libsI + 1]);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'engines-'));
    fs.mkdirSync(path.join(tmp, 'examples')); fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(HERE, 'motion-gate.js'), path.join(tmp, 'scripts', 'motion-gate.js'));
    const out = path.join(tmp, 'examples', 'engines.html');
    const r = spawnSync(process.execPath, [path.join(HERE, 'vendor-inline.mjs'), path.join(EX, 'engines.src.html'), out, '--project', libs], { encoding: 'utf8' });
    console.log(r.stdout.trim());
    ok('vendor-inline: built', r.status === 0, r.stderr.trim());
    const html = fs.readFileSync(out, 'utf8');
    ok('vendor-inline: GSAP header kept', /\/\*!\s*\n \* GSAP 3\.\d+\.\d+[\s\S]{0,200}standard-license/.test(html));
    ok('vendor-inline: Motion MIT text added (its UMD has no banner)', /\/\*! motion [\d.]+ \(dist\/motion\.js\) \| MIT[\s\S]{0,200}Copyright \(c\) 2024 \[Motion\]/.test(html));
    const missing = spawnSync(process.execPath, [path.join(HERE, 'vendor-inline.mjs'), path.join(EX, 'engines.src.html'), path.join(tmp, 'x.html'), '--project', tmp], { encoding: 'utf8' });
    ok('vendor-inline: refuses when a package is missing, writes nothing', missing.status === 1 && !fs.existsSync(path.join(tmp, 'x.html')));

    const settled = p => p.evaluate(() => [...document.querySelectorAll('.it')].map(e => { const cs = getComputedStyle(e); return +cs.opacity === 1 && (cs.transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(cs.transform)); }));
    {
      const { p, ctx, errors, external } = await open(out);
      ok('engines: libraries loaded from the page', await p.evaluate(() => typeof gsap === 'object' && typeof Motion === 'object'));
      const mid = await p.evaluate(() => +getComputedStyle(document.querySelectorAll('#gsap .it')[2]).opacity);
      await p.waitForTimeout(1600);
      ok('engines: every engine ends with the cards in place', (await settled(p)).every(Boolean));
      ok('engines: the entrance was moving at first (not skipped)', mid < 1, `third GSAP card opacity at load ${mid.toFixed(2)}`);
      ok('engines: no errors, no network', errors.length === 0 && external.length === 0, errors.concat(external).join(' | '));
      await ctx.close();
    }
    {
      const { p, ctx } = await open(out, { reducedMotion: 'reduce' });
      await p.waitForTimeout(120);
      ok('engines reduced: every engine at its end state at once', (await settled(p)).every(Boolean));
      const t = await p.evaluate(async () => {
        const el = document.createElement('div'); document.body.append(el); const el2 = el.cloneNode(); document.body.append(el2);
        const t0 = performance.now(); await Motion.animate(el, { x: 100 }, { duration: 1 }); const raw = performance.now() - t0;
        const t1 = performance.now(); await SenseiMotionGate.motion(Motion.animate)(el2, { x: 100 }, { duration: 1 }); const gated = performance.now() - t1;
        return { raw, gated }; });
      ok('trap: vanilla Motion ignores reduced motion (1 s animation still about 1 s)', t.raw > 800, `${Math.round(t.raw)} ms`);
      ok('gate: the wrapped Motion call finishes at once', t.gated < 150, `${Math.round(t.gated)} ms`);
      const g = await p.evaluate(() => { const d = document.createElement('div'); document.body.append(d); let branch = '';
        SenseiMotionGate.gsap(gsap, () => { branch = 'full'; gsap.to(d, { x: 100, duration: 1 }); }, () => { branch = 'reduce'; gsap.set(d, { x: 100 }); });
        return { branch, x: gsap.getProperty(d, 'x') }; });
      ok('gate: gsap() takes the reduce branch and sets the end state', g.branch === 'reduce' && g.x === 100, JSON.stringify(g));
      await ctx.close();
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
} finally { await browser.close(); }
process.exit(summary());
