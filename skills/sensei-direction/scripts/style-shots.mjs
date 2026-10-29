#!/usr/bin/env node
// style-shots.mjs: photograph every style cell three ways (normal, forced colours, right to left) and check that each
// control keeps a visible edge when forced colours strip every box-shadow.
//
//   node style-shots.mjs page.html [--cell .demo] [--out DIR] [--rtl-query dir=rtl] [--width 1100]
//
// Writes DIR/<cell>-normal.png, -forced.png, -rtl.png (DIR defaults to ./style-shots) and prints one line per cell.
// A control fails when, under forced-colors: active, its border width is 0 (the shape was carried by shadow only and
// is now bare text). Exit 0 when every control keeps an edge, 1 when any does not, 2 when it could not run.
// Look at the pictures: a border that exists can still be invisible against its own fill.
//
// verified: Windows 10, Node 24, Chrome 155 via playwright-core 1.64, on ../examples/styles.html and
//           ../fixtures/shadow-only.html (the fixture fails, the lab passes).
// not verified: real Windows High Contrast themes (Playwright emulates one forced palette); other browsers.
// Origin: code-ui/forced.js in the HTML-Sensei build project's research notes (not shipped) and cellshot.js (HTML-Sensei's own code), merged and generalised.
import fs from 'node:fs';
import path from 'node:path';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const target = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!target || !fs.existsSync(target)) { console.error('usage: node style-shots.mjs page.html [--cell .demo] [--out DIR]'); process.exit(2); }
const cellSel = opt('--cell', '.demo'), out = path.resolve(opt('--out', 'style-shots')), rtlQ = opt('--rtl-query', 'dir=rtl'), width = +opt('--width', 1100);
fs.mkdirSync(out, { recursive: true });
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let browser;
try {
  ({ browser } = await launch());
  const base = fileUrl(target);
  const variants = [['normal', {}, ''], ['forced', { forcedColors: 'active', colorScheme: 'dark' }, ''], ['rtl', {}, rtlQ]];
  const shapeless = [];
  for (const [name, ctxOpt, q] of variants) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, ...ctxOpt });
    const p = await ctx.newPage();
    await p.goto(base + (q ? '?' + q : ''));
    await p.waitForFunction('window.__done !== false && document.readyState === "complete"', null, { timeout: 15000 });
    await p.waitForTimeout(300);
    if (name === 'forced') {
      const active = await p.evaluate(() => matchMedia('(forced-colors: active)').matches);
      if (!active) throw new Error('forced-colors emulation did not apply');
      const found = await p.evaluate(sel => [...document.querySelectorAll(sel)].flatMap((d, i) => {
        const n = d.dataset.style || d.getAttribute('aria-label') || 'cell ' + (i + 1);
        return [...d.querySelectorAll('button, input, select, textarea, a.btn, [role=button]')]
          .filter(el => { const cs = getComputedStyle(el); return parseFloat(cs.borderTopWidth) === 0 && parseFloat(cs.borderBottomWidth) === 0 && cs.outlineStyle === 'none'; })
          .map(el => ({ cell: n, control: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '') }));
      }), cellSel);
      shapeless.push(...found);
    }
    const cells = await p.$$(cellSel);
    for (let i = 0; i < cells.length; i++) {
      const n = await cells[i].evaluate((d, i) => d.dataset.style || d.getAttribute('aria-label') || 'cell ' + (i + 1), i);
      await cells[i].screenshot({ path: path.join(out, `${slug(n)}-${name}.png`) });
    }
    await ctx.close();
  }
  for (const s of shapeless) console.log(`FAIL forced colours: ${s.cell}: ${s.control} has no border and no outline, so it loses its shape`);
  console.log(`${shapeless.length ? 'fail' : 'pass'}: shots in ${out}`);
  await browser.close();
  process.exit(shapeless.length ? 1 : 0);
} catch (e) {
  console.error('style-shots could not run: ' + e.message);
  try { await browser?.close(); } catch {}
  process.exit(2);
}
