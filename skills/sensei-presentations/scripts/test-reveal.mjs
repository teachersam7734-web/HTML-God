// test-reveal.mjs: builds examples/reveal-slides.html with build-reveal.mjs (into a temporary folder) and tests the single
// file in headless Chromium over strict file://: no requests, scale, keyboard, fragments, auto-animate interpolation,
// vertical stack, hash (debounced), the speaker view window, ?print-pdf page counts with and without --handout, and
// transitions off under reduced motion.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-presentations/scripts/test-reveal.mjs        (reveal.js from SENSEI_NODE_MODULES or the current folder; PW, CHROME)
//
// verified: Windows 10, Node 24, reveal.js 6.0.2, playwright-core 1.62.1, installed Chrome 155: every check passes.
// not verified: Firefox and Safari; other reveal.js plugins and themes.
// Origin: code-apps/test-reveal.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM and extended.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';
import { buildReveal } from './build-reveal.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { ok, summary } = checker();
const slides = fs.readFileSync(path.join(HERE, '..', 'examples', 'reveal-slides.html'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-reveal-'));
const f1 = path.join(tmp, 'deck.html'), f2 = path.join(tmp, 'handout.html');
fs.writeFileSync(f1, buildReveal({ slides, title: 'Reveal test' }));
fs.writeFileSync(f2, buildReveal({ slides, title: 'Reveal handout', handout: true }));
ok('built file carries the reveal.js notice in its head', /reveal\.js [\d.]+ \(MIT/.test(fs.readFileSync(f1, 'utf8').split('</head>')[0]));

const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const { browser: b } = await launch();
const errs = [];
try {
  let c = await b.newContext({ viewport: { width: 1280, height: 720 } }); let p = await c.newPage();
  const reqs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
  await p.goto(fileUrl(f1)); await p.waitForFunction(() => window.__ready);
  const idx = () => p.evaluate(() => { const i = deck.getIndices(); return [i.h, i.v, i.f]; });
  const closers = (fs.readFileSync(f1, 'utf8').match(/<\/script>/gi) || []).length;
  ok('every inline </script inside a library was escaped: closing tags equal the script elements parsed', closers === await p.evaluate(() => document.scripts.length), closers);
  ok('initialised from file:// with no network requests', reqs.length === 0, reqs.join(' '));
  const sc = await p.evaluate(() => deck.getScale());
  ok('scale is 1280/1920 less the margin for a 1920x1080 canvas', Math.abs(sc - (1 - 0.04) * 1280 / 1920) < 0.02, sc);
  ok('the global Reveal is the constructor: Reveal.getScale is not the instance API', await p.evaluate(() => typeof Reveal.getScale !== 'function' || (() => { try { Reveal.getScale(); return false; } catch { return true; } })()));
  await p.keyboard.press('ArrowRight');
  ok('Right moves to slide 1', JSON.stringify(await idx()) === '[1,0,-1]', await idx());
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  const vis = await p.evaluate(() => [...document.querySelectorAll('.slides section.present .fragment')].map((e) => e.classList.contains('visible')));
  ok('fragments revealed in order', JSON.stringify(vis) === '[true,true,false]', vis);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  ok('auto-animate slide reached', (await idx())[0] === 2);
  await p.keyboard.press('ArrowRight');
  const widths = await p.evaluate(async () => {
    const out = []; const t0 = performance.now();
    while (performance.now() - t0 < 1400) {
      const el = document.querySelector('.slides section.present div[data-id="box"]');
      if (el) out.push(Math.round(el.getBoundingClientRect().width));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return out;
  });
  const lo = Math.min(...widths), hi = Math.max(...widths);
  console.log(`INFO  auto-animate: ${widths.length} samples, ${new Set(widths).size} distinct widths, ${lo} to ${hi}`);
  ok('auto-animate interpolates the box width (intermediate widths seen)', widths.some((w) => w > lo + 10 && w < hi - 10) && widths[widths.length - 1] >= 250);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown');
  ok('vertical stack: Down moves inside it', (await idx()).slice(0, 2).join() === '4,1', await idx());
  await p.waitForFunction(() => /#\/4\/1/.test(location.hash), null, { timeout: 4000 }).catch(() => {});
  ok('the hash follows for deep links (#/4/1, written after a debounce)', /#\/4\/1/.test(await p.evaluate(() => location.hash)));
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.keyboard.press('s')]);
  await pop.waitForLoadState();
  ok('the notes plugin opens a speaker view window from the single file', !!pop);
  await pop.close();
  const pa = await c.newPage(); await pa.goto(fileUrl(f1) + '?print-pdf'); await pa.waitForFunction(() => window.__ready); await pa.waitForTimeout(500);
  const n1 = pdfPages(await pa.pdf({ preferCSSPageSize: true, printBackground: true }));
  ok('?print-pdf by default: one page per slide AND per fragment step (10 for 7 slides)', n1 === 10, n1);
  const pb = await c.newPage(); await pb.goto(fileUrl(f2) + '?print-pdf'); await pb.waitForFunction(() => window.__ready); await pb.waitForTimeout(500);
  const n2 = pdfPages(await pb.pdf({ preferCSSPageSize: true, printBackground: true }));
  ok('--handout (pdfSeparateFragments false): one page per slide (7)', n2 === 7, n2);
  await c.close();
  c = await b.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(fileUrl(f1)); await p.waitForFunction(() => window.__ready);
  const rm = await p.evaluate(() => [deck.getConfig().transition, deck.getConfig().autoAnimate, getComputedStyle(document.querySelector('.reveal .slides section.present')).transitionDuration]);
  ok('reduced motion: transition none, auto-animate off, slide transition 0s', rm[0] === 'none' && rm[1] === false && /^0s/.test(rm[2]), rm);
  await c.close();
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
process.exitCode = summary();
