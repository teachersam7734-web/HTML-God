#!/usr/bin/env node
// style-contrast.mjs: pixel-sampled contrast for visual styles whose backgrounds are gradients, blur, translucency or
// shadows, where a colour-pair calculation cannot work.
//
//   node style-contrast.mjs page.html[?query] [--cell .demo] [--json out.json] [--width 1100]
//
// Each cell (default `.demo`; its name from data-style, else aria-label, else its index) must hold the shared
// component layer: `.card h2`, `.card p`, `.btn`, `.field`. For each:
//   text contrast     = the WORST WCAG ratio between the text colour and every pixel behind the text (all text is
//                       made transparent, the region is screenshotted). Body, label, placeholder need 4.5; a large
//                       heading needs 3.
//   boundary contrast = WCAG 1.4.11 non-text contrast: the better of (fill against the pixels just outside) and
//                       (border colour against them). Field and button need 3. The card row is information only.
// Rounded controls are sampled in their central part, so corner pixels outside the curve are not counted.
// Exit 0 when every required ratio passes, 1 when any fails, 2 when the browser could not run.
//
// verified: Windows 10, Node 24, Chrome 155 through playwright-core 1.64 (found by sensei-verify's discover.mjs),
//           on ../examples/styles.html: every default cell passes; with ?bad=1 the raw neumorphism, raw clay field
//           and bad dark mode cells fail on the rows the research measured (see SKILL.md section 8).
// not verified: other browsers; text over video or mix-blend-mode grounds (a single screenshot cannot judge moving
//           media: sample several frames yourself); transparent text with gradient fills (background-clip: text).
// Origin: code-ui/style-contrast.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM with tool
//         discovery, a cell option, JSON output and exit codes.
import fs from 'node:fs';
import path from 'node:path';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const target = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!target) { console.error('usage: node style-contrast.mjs page.html[?query] [--cell .demo] [--json out.json]'); process.exit(2); }
const cellSel = opt('--cell', '.demo');
const width = +opt('--width', 1100);
const jsonOut = opt('--json', null);

export const NEED = { 'body text': 4.5, heading: 3, 'button label': 4.5, placeholder: 4.5, 'card boundary': 1, 'field boundary': 3, 'button boundary': 3 };
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

let browser;
try {
  const [file, query] = target.split('?');
  if (!/^https?:/.test(file) && !fs.existsSync(file)) { console.error('not found: ' + file); process.exit(2); }
  const url = (/^https?:/.test(file) ? file : fileUrl(path.resolve(file))) + (query ? '?' + query : '');
  ({ browser } = await launch());
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  await p.goto(url);
  await p.waitForFunction('window.__done !== false && document.readyState === "complete"', null, { timeout: 15000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const items = await p.evaluate(sel => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgba = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const rr = e => { const r = e.getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY, r.width, r.height]; };
    const out = [];
    document.querySelectorAll(sel).forEach((d, i) => {
      const name = d.dataset.style || d.getAttribute('aria-label') || 'cell ' + (i + 1);
      const h = d.querySelector('.card h2'), pp = d.querySelector('.card p'), btn = d.querySelector('.btn'), f = d.querySelector('.field'), card = d.querySelector('.card');
      if (pp) out.push({ name, kind: 'body text', rect: rr(pp), color: rgba(getComputedStyle(pp).color) });
      if (h) out.push({ name, kind: 'heading', rect: rr(h), color: rgba(getComputedStyle(h).color) });
      if (btn) out.push({ name, kind: 'button label', rect: rr(btn), color: rgba(getComputedStyle(btn).color), inset: 6 });
      if (f) out.push({ name, kind: 'placeholder', rect: rr(f), color: rgba(getComputedStyle(f, '::placeholder').color), inset: 10 });
      for (const [el, kind] of [[card, 'card boundary'], [f, 'field boundary'], [btn, 'button boundary']]) {
        if (!el) continue; const cs = getComputedStyle(el);
        out.push({ name, kind, rect: rr(el), border: rgba(cs.borderTopColor), bw: parseFloat(cs.borderTopWidth) });
      }
    });
    return out;
  }, cellSel);
  if (!items.length) { console.error(`no cells matched ${cellSel}`); process.exit(2); }

  async function pixels(rect) {
    const [x, y, w, h] = rect; const clip = { x: Math.max(0, x), y: Math.max(0, y), width: Math.max(1, w), height: Math.max(1, h) };
    const buf = await p.screenshot({ clip, fullPage: true });
    return p.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const k = c.getContext('2d');
      k.drawImage(img, 0, 0); return Array.from(k.getImageData(0, 0, img.width, img.height).data);
    }, buf.toString('base64'));
  }
  // hide every glyph (and the CRT-style overlays stay: they are part of what sits behind the text)
  await p.addStyleTag({ content: '*{color:transparent!important;text-shadow:none!important;caret-color:transparent!important}::placeholder{color:transparent!important}' });
  await p.waitForTimeout(100);
  const rows = {};
  for (const it of items) {
    let res;
    if (it.color) {
      const ix = it.inset ? Math.max(it.inset, it.rect[2] * 0.2) : 0, iy = it.inset ? Math.max(it.inset, it.rect[3] * 0.25) : 0;
      const d = await pixels([it.rect[0] + ix, it.rect[1] + iy, Math.max(4, it.rect[2] - 2 * ix), Math.max(4, it.rect[3] - 2 * iy)]);
      let worst = 99;
      for (let k = 0; k < d.length; k += 12) { const r = ratio(it.color, [d[k], d[k + 1], d[k + 2]]); if (r < worst) worst = r; }
      res = +worst.toFixed(2);
    } else {
      const g = (await pixels([it.rect[0] - 6, it.rect[1] + it.rect[3] / 2, 1, 1])).slice(0, 3);
      const f = (await pixels([it.rect[0] + 6, it.rect[1] + it.rect[3] / 2, 1, 1])).slice(0, 3);
      const bc = it.bw > 0 && it.border[3] > 0 ? it.border : null;
      res = +Math.max(ratio(f, g), bc ? ratio(bc, g) : 1).toFixed(2);
    }
    (rows[it.name] = rows[it.name] || {})[it.kind] = res;
  }
  const failures = [];
  console.log('style'.padEnd(26) + Object.keys(NEED).map(k => k.slice(0, 11).padEnd(12)).join(''));
  for (const [n, r] of Object.entries(rows)) {
    console.log(n.padEnd(26) + Object.keys(NEED).map(k => {
      const v = r[k]; const bad = v != null && v < NEED[k]; if (bad) failures.push({ style: n, row: k, ratio: v, need: NEED[k] });
      return ((v != null ? v.toFixed(2) : '-') + (bad ? '!' : '')).padEnd(12);
    }).join(''));
  }
  console.log('(! = below the WCAG minimum: text 4.5, large heading 3, field and button boundary 3; card boundary is information)');
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ target, rows, failures, need: NEED }, null, 2));
  await browser.close();
  process.exit(failures.length ? 1 : 0);
} catch (e) {
  console.error('style-contrast could not run: ' + e.message);
  try { await browser?.close(); } catch {}
  process.exit(2);
}
