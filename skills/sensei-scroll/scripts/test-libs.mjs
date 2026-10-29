#!/usr/bin/env node
// test-libs.mjs: builds ../examples/scroll-libs.template.html with inline-libs.mjs, then proves the Lenis and
// ScrollTrigger page in strict file://.
//
//   npm i -D lenis@1.3.27 gsap@3.15.0      (in the project, or point LIBS_DIR at a folder whose node_modules has them)
//   node test-libs.mjs [--keep out.html]   (Playwright and the browser discovered as in sensei-verify)
//
// Asserts: the build keeps the GSAP headers and adds a Lenis notice; the page loads with no console error or request;
// Lenis 1.3.x and GSAP 3.15.0 are running and <html> carries Lenis's classes; while the section is pinned its top stays
// at 0 and the panels move from 0 to the full overflow (track width minus viewport) with the smoothed scrub settled;
// a wheel turn glides (part way after 60 ms, arrived later) under normal motion and lands at once under reduced
// motion; lenis.scrollTo is instant under reduced motion; reduced motion creates no ScrollTrigger and leaves the
// panels wrapped with no horizontal page scroll; the nested box scrolls natively (data-lenis-prevent) and the page
// does not move; an anchor click lands the target below the sticky header. Exit 0 all pass, 1 any fail, 2 no libs.
//
// verified: Windows 10, Node 24, Chrome headless via playwright-core 1.62, swiftshader, lenis 1.3.27, gsap 3.15.0:
//           every assertion passes.
// not verified: the feel of the smoothing; touch input; Firefox and Safari; other library versions.
// HTML-Sensei's own code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tpl = path.join(here, '..', 'examples', 'scroll-libs.template.html');
const ki = process.argv.indexOf('--keep');
const out = ki > 0 ? path.resolve(process.argv[ki + 1]) : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-scroll-')), 'scroll-libs.html');
const b = spawnSync(process.execPath, [path.join(here, 'inline-libs.mjs'), tpl, out, '--from', process.cwd()], { encoding: 'utf8' });
if (b.status !== 0) { console.log('could not build: ' + (b.stderr || b.stdout) + '\nInstall: npm i -D lenis@1.3.27 gsap@3.15.0, or set LIBS_DIR.'); process.exit(2); }

let ok = 0, nok = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('ok   ' + name + (process.env.VERBOSE && extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } else { nok++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } };
const html = fs.readFileSync(out, 'utf8');
check('build keeps the GSAP headers', (html.match(/@license Copyright \d{4}, GreenSock/g) || []).length === 2);
check('build adds a Lenis notice', /\/\*! lenis 1\.3\.\d+ \| MIT \| Copyright/.test(html));

const { browser } = await launch();
async function open(opts = {}) {
  const c = await browser.newContext({ viewport: { width: 1000, height: 700 }, ...opts });
  const p = await c.newPage(); const errs = [], reqs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('request', r => { if (!r.url().startsWith('file:')) reqs.push(r.url()); });
  await p.goto(fileUrl(out)); await p.waitForFunction('window.__ready === true', null, { timeout: 10000 });
  return { c, p, errs, reqs };
}
const settle = ms => new Promise(r => setTimeout(r, ms));
try {
  const n = await open();
  const info = await n.p.evaluate(() => ({ lenis: typeof Lenis, gsap: gsap.version, cls: document.documentElement.className, st: ScrollTrigger.getAll().length }));
  check('Lenis and GSAP 3.15.0 running, html has the lenis classes, one ScrollTrigger', info.gsap === '3.15.0' && /\blenis\b/.test(info.cls) && info.st === 1, info);
  const g = await n.p.evaluate(() => { const st = ScrollTrigger.getAll()[0]; const t = document.getElementById('track'); return { start: st.start, end: st.end, travel: t.scrollWidth - innerWidth }; });
  const at = async y => { await n.p.evaluate(y => { window.__lenis.scrollTo(y, { immediate: true }); }, y); await settle(1600);
    return n.p.evaluate(() => ({ top: document.getElementById('hs').getBoundingClientRect().top, x: gsap.getProperty('#track', 'x') })); };
  const s0 = await at(g.start), s1 = await at((g.start + g.end) / 2), s2 = await at(g.end);
  check('pin holds the section at the top through the scrub', [s0, s1, s2].every(s => Math.abs(s.top) < 1), [s0.top, s1.top, s2.top]);
  check('panels travel 0, half, full overflow once the smoothed scrub settles', Math.abs(s0.x) < 1 && Math.abs(s1.x + g.travel / 2) < 2 && Math.abs(s2.x + g.travel) < 1 && g.travel > 1000, { travel: g.travel, x: [s0.x, s1.x, s2.x] });
  await n.p.evaluate(() => window.__lenis.scrollTo(0, { immediate: true })); await settle(300);
  await n.p.mouse.move(500, 200); await n.p.mouse.wheel(0, 600); await settle(60);
  const early = await n.p.evaluate(() => scrollY); await settle(2000); const late = await n.p.evaluate(() => scrollY);
  check('wheel glides under normal motion (part way at 60 ms, arrived later)', early > 0 && early < late - 50 && late >= 590, { early, late });
  await n.p.evaluate(() => window.__lenis.scrollTo(document.getElementById('nested').offsetTop, { immediate: true })); await settle(1600);
  const y0 = await n.p.evaluate(() => scrollY);
  const bb = await n.p.locator('#box').boundingBox(); await n.p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await n.p.mouse.wheel(0, 200); await settle(600);
  const nested = await n.p.evaluate(() => ({ box: document.getElementById('box').scrollTop, y: scrollY }));
  check('nested box scrolls natively and the page stays put', nested.box > 0 && Math.abs(nested.y - y0) < 2, { ...nested, y0 });
  await n.p.evaluate(() => window.__lenis.scrollTo(0, { immediate: true })); await settle(300);
  await n.p.click('a[href="#end"]'); await settle(2500);
  const anc = await n.p.evaluate(() => ({ t: document.getElementById('end').getBoundingClientRect().top, hdr: document.querySelector('header').getBoundingClientRect().bottom }));
  check('anchor through Lenis lands the target in view, not under the header', anc.t >= anc.hdr - 1 && anc.t < 200, anc);
  check('no console error and no request off file://', n.errs.length === 0 && n.reqs.length === 0, { errs: n.errs, reqs: n.reqs });
  await n.c.close();

  const r = await open({ reducedMotion: 'reduce' });
  const ri = await r.p.evaluate(() => ({ st: ScrollTrigger.getAll().length, pin: document.documentElement.classList.contains('js-pin'), rm: window.__lenis.prefersReducedMotion,
    docW: document.documentElement.scrollWidth, vw: innerWidth }));
  check('reduced motion: Lenis reports it, no ScrollTrigger, no pin, no horizontal scroll', ri.rm === true && ri.st === 0 && !ri.pin && ri.docW <= ri.vw, ri);
  await r.p.mouse.move(500, 200); await r.p.mouse.wheel(0, 600); await settle(60);
  const rEarly = await r.p.evaluate(() => scrollY);
  check('reduced motion: a wheel turn lands at once (no glide)', rEarly >= 590, rEarly);
  const jump = await r.p.evaluate(() => { window.__lenis.scrollTo(1500); return scrollY; });
  check('reduced motion: lenis.scrollTo is instant', Math.abs(jump - 1500) < 2, jump);
  check('no console error (reduced motion)', r.errs.length === 0, r.errs);
  await r.c.close();
} finally { await browser.close(); }
console.log(`\n${ok} passed, ${nok} failed${ki > 0 ? '' : '\nbuilt file: ' + out}`);
// Scratch: a folder this test made in the OS temp folder is removed when every check passes and kept (path printed)
// when one fails; a folder given on the command line is always kept.
if (!nok && !(ki > 0)) fs.rmSync(path.dirname(out), { recursive: true, force: true });
process.exit(nok ? 1 : 0);
