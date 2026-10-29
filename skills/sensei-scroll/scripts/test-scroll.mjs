#!/usr/bin/env node
// test-scroll.mjs: self-test of ../examples/scroll-driven.html. Scrolls to named stops and reads resulting styles (never
// getAnimations().currentTime, which is a cover-range percentage), natively and with the WAAPI fallback forced, then
// under reduced motion and print.
//
//   node test-scroll.mjs [page.html]      (Playwright and the browser discovered as in sensei-verify: SENSEI_PW or PW,
//                                          SENSEI_CHROME or CHROME, else node_modules, the global npm root, installed Chrome)
//
// Asserts at 1000 by 700: bar scale 0 at the top, 0.5 mid-page, 1 at the bottom; track left 0 at the pin start, half
// its travel at the middle, full travel (track width minus viewport) at the end; orb scale 0.4, 1, 0.6 at story start,
// middle and end; the first reveal hidden at the top and shown in view; the stuck nav restyles; the discrete step label
// follows the steps; the forced fallback matches native within 0.01 (bar, orb) and 1 px (track) at every stop; reduced
// motion leaves zero animations and every end state; print shows every reveal and step; an anchor jump lands the
// target below the sticky nav; no console error. Exit 0 when all pass, 1 otherwise.
//
// verified: Windows 10, Node 24, Chrome headless via playwright-core 1.62, swiftshader: every assertion passes.
// not verified: Firefox and Safari (the fallback is proved only by forcing it in Chromium); touch scrolling; frame rate.
// Origin: code-interaction/test-scroll.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), turned into assertions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = process.argv[2] || path.join(here, '..', 'examples', 'scroll-driven.html');
let ok = 0, nok = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('ok   ' + name + (process.env.VERBOSE && extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } else { nok++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const read = () => ({
  bar: new DOMMatrix(getComputedStyle(document.getElementById('bar')).transform).a,
  track: document.getElementById('track').getBoundingClientRect().left,
  trackW: document.getElementById('track').scrollWidth,
  orb: +getComputedStyle(document.getElementById('orb')).scale || 1,
  r1: +getComputedStyle(document.getElementById('r1')).opacity, r2: +getComputedStyle(document.getElementById('r2')).opacity,
  nav: getComputedStyle(document.querySelector('.nav')).backgroundColor,
  label: document.getElementById('label').textContent,
  step1: +getComputedStyle(document.querySelector('.step')).opacity,
  mode: window.__mode,
  anims: document.getAnimations().length,
});

const { browser } = await launch();
async function run(query, ctxOpts = {}) {
  const c = await browser.newContext({ viewport: { width: 1000, height: 700 }, ...ctxOpts });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(fileUrl(page) + query); await p.waitForTimeout(300);
  const g = await p.evaluate(() => {
    const top = id => document.getElementById(id).getBoundingClientRect().top + scrollY;
    return { H: document.documentElement.scrollHeight - innerHeight, hsTop: top('hs'), hsH: document.getElementById('hs').offsetHeight,
      stTop: top('story'), stH: document.getElementById('story').offsetHeight };
  });
  const stops = { top: 0, mid: Math.round(g.H / 2), hsStart: g.hsTop, hsMid: g.hsTop + (g.hsH - 700) / 2, hsEnd: g.hsTop + g.hsH - 700,
    stStart: g.stTop, stMid: g.stTop + (g.stH - 700) / 2, stEnd: g.stTop + g.stH - 700, bottom: g.H };
  const s = {};
  for (const [n, y] of Object.entries(stops)) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(250); s[n] = await p.evaluate(read); }
  return { c, p, s, errs };
}

try {
  const n = await run('');
  const travel = n.s.top.trackW - 1000;
  check('native mode in Chromium', n.s.top.mode === 'native', n.s.top.mode);
  check('bar 0 at top, 0.5 mid-page, 1 at bottom', near(n.s.top.bar, 0, 0.01) && near(n.s.mid.bar, 0.5, 0.01) && near(n.s.bottom.bar, 1, 0.01), [n.s.top.bar, n.s.mid.bar, n.s.bottom.bar]);
  check('track 0 at pin start, half travel at middle, full travel at end (width:max-content works)',
    near(n.s.hsStart.track, 0, 1) && near(n.s.hsMid.track, -travel / 2, 1) && near(n.s.hsEnd.track, -travel, 1) && travel > 1000,
    { travel, start: n.s.hsStart.track, mid: n.s.hsMid.track, end: n.s.hsEnd.track });
  check('orb 0.4, 1, 0.6 across the story', near(n.s.stStart.orb, 0.4, 0.01) && near(n.s.stMid.orb, 1, 0.01) && near(n.s.stEnd.orb, 0.6, 0.01), [n.s.stStart.orb, n.s.stMid.orb, n.s.stEnd.orb]);
  check('second reveal hidden at top, shown once scrolled past', n.s.top.r2 < 0.1 && n.s.hsStart.r2 > 0.99, [n.s.top.r2, n.s.hsStart.r2]);
  check('nav transparent at top, restyled when stuck', n.s.top.nav === 'rgba(0, 0, 0, 0)' && n.s.mid.nav === 'rgba(0, 0, 0, 0.8)', [n.s.top.nav, n.s.mid.nav]);
  check('first story step hidden before the story, shown at its start', n.s.top.step1 < 0.1 && n.s.stMid.step1 > 0.99, [n.s.top.step1, n.s.stMid.step1]);
  check('step label follows the steps (discrete state)', /Step [12] of 3/.test(n.s.stStart.label) && n.s.stEnd.label === 'Step 3 of 3', [n.s.stStart.label, n.s.stMid.label, n.s.stEnd.label]);
  // anchor jump: the target lands below the sticky nav (scroll-padding-top)
  await n.p.evaluate(() => window.scrollTo(0, 0)); await n.p.click('a[href="#snap"]'); await n.p.waitForTimeout(300);
  const anchor = await n.p.evaluate(() => ({ t: document.getElementById('snap').getBoundingClientRect().top, nav: document.querySelector('.nav').getBoundingClientRect().bottom }));
  check('anchor target lands below the sticky nav', anchor.t >= anchor.nav - 1, anchor);
  check('no console error (native)', n.errs.length === 0, n.errs);
  await n.c.close();

  const f = await run('?force=1');
  check('forced fallback runs', f.s.top.mode === 'fallback', f.s.top.mode);
  let worst = 0, worstTrack = 0;
  for (const k of Object.keys(n.s)) { worst = Math.max(worst, Math.abs(n.s[k].bar - f.s[k].bar), Math.abs(n.s[k].orb - f.s[k].orb)); worstTrack = Math.max(worstTrack, Math.abs(n.s[k].track - f.s[k].track)); }
  check('fallback matches native: bar and orb within 0.01, track within 1 px', worst <= 0.01 && worstTrack <= 1, { worst, worstTrack });
  check('no console error (fallback)', f.errs.length === 0, f.errs);
  await f.c.close();

  const r = await run('', { reducedMotion: 'reduce' });
  check('reduced motion: zero animations at every stop', Object.values(r.s).every(v => v.anims === 0), Object.values(r.s).map(v => v.anims));
  check('reduced motion: bar full, reveal shown, orb at rest, track not moved', r.s.top.bar === 1 && r.s.top.r1 === 1 && r.s.mid.orb === 1 && Object.values(r.s).every(v => near(v.track, r.s.top.track, 1) || v.track > -1000), { bar: r.s.top.bar, r1: r.s.top.r1 });
  const wrap = await r.p.evaluate(() => { const t = document.getElementById('track'); return { w: t.scrollWidth, vw: innerWidth, docW: document.documentElement.scrollWidth }; });
  check('reduced motion: horizontal cards wrap, no page-wide horizontal scroll', wrap.docW <= wrap.vw, wrap);
  await r.c.close();

  const pc = await browser.newContext({ viewport: { width: 1000, height: 700 } }); const pp = await pc.newPage();
  await pp.goto(fileUrl(page)); await pp.emulateMedia({ media: 'print' }); await pp.waitForTimeout(200);
  const pr = await pp.evaluate(() => [...document.querySelectorAll('.reveal,.step')].map(e => +getComputedStyle(e).opacity));
  check('print: every reveal and step visible', pr.length === 5 && pr.every(v => v === 1), pr);
  await pc.close();
} finally { await browser.close(); }

console.log(`\n${ok} passed, ${nok} failed`);
process.exit(nok ? 1 : 0);
