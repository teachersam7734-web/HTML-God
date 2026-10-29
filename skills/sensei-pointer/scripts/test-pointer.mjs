#!/usr/bin/env node
// test-pointer.mjs: self-test of ../examples/pointer.html in mouse, keyboard, reduced-motion, forced-colours,
// hybrid-touch and phone contexts. Reads window.__state (the page's own numbers) and computed styles.
//
//   node test-pointer.mjs [page.html]     (Playwright and the browser discovered as in sensei-verify)
//
// Asserts: a fine pointer gets the ring and the has-cursor class; the ring lags a jump at 40 ms and sits on the
// pointer within 1 px by 500 ms; the magnet offsets 35 percent of (+90, +10) and returns to 0 outside its radius;
// the spotlight writes its variables on the box and nothing on <html>; keyboard focus reveals the spotlight's hidden
// layer; the tilt reaches over 7 degrees on both axes at the top-right corner and returns to 0; a flick coasts on
// after release; arrows move the puck 20 px, Shift 60 px, Home resets it; the trail draws; the loop sleeps when idle;
// reduced motion snaps the ring, keeps the magnet at 0, draws no trail and gives no coast; forced colours keep the
// system cursor; a touch pointer on a fine-pointer device hides the ring and a mouse brings it back; a phone context
// has no ring at all; no page error anywhere. Exit 0 when all pass, 1 otherwise.
//
// verified: Windows 10, Node 24, Chrome headless via playwright-core 1.62, swiftshader: every assertion passes.
// not verified: real touch screens and pens (touch is emulated or synthetic); Firefox and Safari; frame rate.
// Origin: code-interaction/test-pointer.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), turned into assertions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = fileUrl(process.argv[2] || path.join(here, '..', 'examples', 'pointer.html'));
let ok = 0, nok = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('ok   ' + name + (process.env.VERBOSE && extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } else { nok++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } };
const near = (a, b, t) => Math.abs(a - b) <= t;
const box = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top }; }, sel);
const st = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__state)));
const wait = ms => new Promise(r => setTimeout(r, ms));

const { browser } = await launch();
const errs = [];
async function open(opts) { const c = await browser.newContext({ viewport: { width: 1100, height: 900 }, ...opts }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(url); await wait(300); return { c, p }; }
try {
  const { c, p } = await open({});
  let s = await st(p);
  check('no trail canvas before anyone moves', (await p.locator('canvas').count()) === 0);
  check('fine pointer: ring enabled, has-cursor class', s.fine && (await p.evaluate(() => document.documentElement.classList.contains('has-cursor'))));
  await p.mouse.move(100, 100); await wait(150); const first = (await st(p)).cursor;
  check('first sight places the ring on the pointer (no fly-in from off-screen)', near(first.x, 100, 0.5) && near(first.y, 100, 0.5), first);
  await p.mouse.move(600, 400); await wait(40); const early = (await st(p)).cursor; await wait(500); const late = (await st(p)).cursor;
  check('ring lags at 40 ms (between the old and new point, never behind), on the pointer by 500 ms', early.x > 100 && early.x < 590 && early.y > 100 && near(late.x, 600, 1) && near(late.y, 400, 1), { early, late });
  const m = await box(p, '#mag'); await p.mouse.move(m.x + 90, m.y + 10); await wait(700); s = await st(p);
  check('magnet offset is 35 percent of (+90, +10)', near(s.mag.x, 31.5, 0.6) && near(s.mag.y, 3.5, 0.6), s.mag);
  await p.mouse.move(m.x + 400, m.y + 300); await wait(900); s = await st(p);
  check('magnet returns to 0 outside its radius', s.mag.x === 0 && s.mag.y === 0, s.mag);
  const sp = await box(p, '#spot'); await p.mouse.move(sp.l + 100, sp.t + 120); await wait(100);
  const vars = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('spot')); return [cs.getPropertyValue('--mx').trim(), cs.getPropertyValue('--my').trim(), document.documentElement.style.cssText]; });
  check('spotlight variables on the box, nothing on html', vars[0] === '100px' && vars[1] === '120px' && vars[2] === '', vars);
  const t = await box(p, '#tilt'); await p.mouse.move(t.l + t.w - 10, t.t + 10, { steps: 4 }); await wait(600); s = await st(p);
  check('tilt over 7 degrees on both axes at the top-right corner', s.tilt.rx > 7 && s.tilt.ry > 7, s.tilt);
  await p.mouse.move(5, 5); await wait(900); s = await st(p);
  check('tilt returns to 0 after leaving', s.tilt.rx === 0 && s.tilt.ry === 0, s.tilt);
  const pk = await box(p, '#puck'); await p.mouse.move(pk.x, pk.y); await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(pk.x + i * 25, pk.y + i * 8); await wait(16); }
  const atRel = (await st(p)).puck; await p.mouse.up(); await wait(1400); const rest = (await st(p)).puck;
  check('a flick coasts on after release', rest.x - atRel.x > 50, { atRel, rest });
  await p.focus('#puck'); const k0 = (await st(p)).puck;
  await p.keyboard.press('ArrowLeft'); await wait(120); const k1 = (await st(p)).puck;
  await p.keyboard.press('Shift+ArrowUp'); await wait(120); const k2 = (await st(p)).puck;
  await p.keyboard.press('Home'); await wait(120); const k3 = (await st(p)).puck;
  check('keys: arrow 20 px, Shift 60 px, Home resets', near(k1.x - k0.x, -20, 0.01) && (near(k2.y - k1.y, -60, 0.01) || k2.y === 0) && k3.x === 20 && k3.y === 20, { k0, k1, k2, k3 });
  await p.mouse.move(200, 700, { steps: 10 }); s = await st(p);
  check('trail draws while the mouse moves, on a canvas made on first use', s.trailPts > 3 && (await p.locator('canvas#trail').count()) === 1, s.trailPts);
  await wait(2000); const f1 = (await st(p)).frames; await wait(500); s = await st(p);
  check('loop sleeps when nothing moves', s.running === false && s.frames === f1, { running: s.running, f1, f2: s.frames });
  // keyboard focus reveals the spotlight
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.mouse.click(5, 5);
  let found = false; for (let i = 0; i < 6 && !found; i++) { await p.keyboard.press('Tab'); found = await p.evaluate(() => document.activeElement.id === 'spot'); }
  const mask = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('#spot .hidden')); return cs.maskImage || cs.webkitMaskImage; });
  check('keyboard focus reveals the spotlight layer', found && mask === 'none', { found, mask });
  // hybrid: a touch pointer on this fine-pointer device hides the ring; a mouse move brings it back
  await p.evaluate(() => dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 300, bubbles: true })));
  const hid = await p.evaluate(() => [document.documentElement.classList.contains('touching'), getComputedStyle(document.getElementById('cursor')).display, getComputedStyle(document.documentElement).cursor]);
  await p.mouse.move(320, 320); await wait(50);
  const back = await p.evaluate(() => [document.documentElement.classList.contains('touching'), getComputedStyle(document.getElementById('cursor')).display]);
  check('touch pointer hides the ring and restores the cursor; a mouse brings the ring back', hid[0] && hid[1] === 'none' && hid[2] !== 'none' && !back[0] && back[1] === 'block', { hid, back });
  await c.close();

  const r = await open({ reducedMotion: 'reduce' });
  await r.p.mouse.move(700, 300); await wait(60); const rc = (await st(r.p)).cursor;
  const rm = await box(r.p, '#mag'); await r.p.mouse.move(rm.x + 60, rm.y); await wait(300); s = await st(r.p);
  const rpk = await box(r.p, '#puck'); await r.p.mouse.move(rpk.x, rpk.y); await r.p.mouse.down();
  for (let i = 1; i <= 6; i++) { await r.p.mouse.move(rpk.x + i * 25, rpk.y + i * 8); await wait(16); }
  const rRel = (await st(r.p)).puck; await r.p.mouse.up(); await wait(600); const rRest = (await st(r.p)).puck;
  check('reduced motion: ring snaps, magnet 0, no trail, no coast', near(rc.x, 700, 0.5) && near(rc.y, 300, 0.5) && s.mag.x === 0 && s.trailPts === 0 && (await r.p.locator('canvas').count()) === 0 && near(rRest.x, rRel.x, 0.5), { rc, mag: s.mag, trail: s.trailPts, rRel, rRest });
  await r.c.close();

  const fc = await open({ forcedColors: 'active' });
  const fcs = await fc.p.evaluate(() => [window.__state.fine, document.documentElement.classList.contains('has-cursor'), getComputedStyle(document.getElementById('cursor')).display]);
  check('forced colours: system cursor kept, no ring', fcs[0] === false && fcs[1] === false && fcs[2] === 'none', fcs);
  await fc.c.close();

  const ph = await open({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true });
  const phs = await ph.p.evaluate(() => [window.__state.fine, document.documentElement.className, getComputedStyle(document.getElementById('cursor')).display, document.documentElement.scrollWidth <= innerWidth]);
  check('phone: no ring, no class, no horizontal scroll', phs[0] === false && phs[1] === '' && phs[2] === 'none' && phs[3], phs);
  await ph.c.close();
  check('no page error in any context', errs.length === 0, errs);
} finally { await browser.close(); }
console.log(`\n${ok} passed, ${nok} failed`);
process.exit(nok ? 1 : 0);
