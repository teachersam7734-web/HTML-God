#!/usr/bin/env node
// blur-cost.mjs: relative frame rate of glass panels and big blurred layers over a moving ground.
//
//   node blur-cost.mjs [page.html] [query ...]      default page ../examples/blurcost.html and the research variants
//
// Each variant opens in a fresh page at 1280x800 and counts requestAnimationFrame callbacks for 3 s. Software raster
// (--disable-gpu), so the numbers rank variants against each other; they say nothing about a target device, and by
// the owner's rule they are never a reason to remove an effect (add a quality tier, keep a still ground behind glass
// when the ground need not move). Also prints whether prefers-reduced-transparency is a recognised query.
//
// verified: Windows 10, Node 24, Chrome 155 via playwright-core 1.64 (see SKILL.md section 8 for the run).
// not verified: GPU raster, phones, Firefox and Safari.
// Origin: code-ui/fps2.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM with discovery.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const page = args[0] && args[0].endsWith('.html') ? args.shift() : path.join(here, '..', 'examples', 'blurcost.html');
const variants = args.length ? args : ['n=0', 'n=1', 'n=4', 'n=8&b=8', 'n=8&b=18', 'n=8&b=40', 'big=1', 'big=1&n=8'];
let browser;
try {
  ({ browser } = await launch({ extraArgs: ['--disable-gpu'] }));
  const rows = [];
  for (const q of variants) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto(fileUrl(page) + '?' + q); await p.waitForTimeout(1200);
    const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); (function l(t) { n++; if (t - t0 < 3000) requestAnimationFrame(l); else r(n / 3); })(t0); }));
    rows.push({ variant: q, fps: +fps.toFixed(1) }); console.log(q.padEnd(16), fps.toFixed(1), 'fps (software raster, relative only)');
    await p.close();
  }
  const p = await browser.newPage();
  console.log('prefers-reduced-transparency recognised:', await p.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').media !== 'not all'));
  await browser.close();
} catch (e) { console.error('blur-cost could not run: ' + e.message); try { await browser?.close(); } catch {} process.exit(2); }
