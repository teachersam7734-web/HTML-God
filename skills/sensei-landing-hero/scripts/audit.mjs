#!/usr/bin/env node
// audit.mjs: quick landing-page gates for every theme and language a page offers, by query string.
//
//   node audit.mjs page.html [--variants "theme=ink,theme=paper,theme=ink&lang=fa"] [--json out.json]
//
// The page gate (sensei-verify) takes a file, not a query, so it sees one theme; this runs the cheap checks on each
// variant. Per variant: console errors and warnings, page errors, any request that is not file:, data:, blob: or
// about: (aborted and failed), horizontal overflow at 360, 768, 1280 and 1920 px, text contrast on solid backgrounds
// (text over gradients or images is listed as skipped: pixel-sample it), controls under 24 CSS px, images without
// alt, a missing lang. Exit 0 when every variant passes, 1 when any fails, 2 when it could not run.
//
// verified: Windows 10, Node 24, Chrome 155 via playwright-core 1.64, strict file://, on ../examples/landing.html for
//           ink, pulse and paper in English and Persian (every variant passes; see SKILL.md section 8).
// not verified: other browsers; contrast of gradient-text words and text over the hero background (skipped by design).
// Origin: code-ui/audit.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM with tool discovery, strict
//         file://, variants, network blocking, exit codes and JSON.
import fs from 'node:fs';
import path from 'node:path';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const target = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!target || !fs.existsSync(target)) { console.error('usage: node audit.mjs page.html [--variants "theme=ink,theme=paper"]'); process.exit(2); }
const variants = opt('--variants', '').split(',').map(s => s.trim()).filter(Boolean);
if (!variants.length) variants.push('');

const CONTRAST = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = c => { if (!c) return null; cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = el => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return { unknown: true };
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return base;
  };
  const out = [], seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.textContent.trim()) continue; const el = n.parentElement; if (seen.has(el)) continue; seen.add(el);
    if (el.closest('[aria-hidden="true"], .sk-sr, .sr-only, script, style')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const t = el.textContent.trim().slice(0, 24);
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.color === 'rgba(0, 0, 0, 0)') { out.push({ t, skip: 'gradient text' }); continue; }
    const bg = bgOf(el); if (bg.unknown) { out.push({ t, skip: 'gradient or image background' }); continue; }
    const fg = parse(cs.color); if (!fg) continue; const r = ratio(over(fg, bg), bg);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    out.push({ t, ratio: +r.toFixed(2), need: large ? 3 : 4.5, ok: r >= (large ? 3 : 4.5) });
  }
  return out;
};

let browser, failed = 0;
const report = { target, variants: {} };
try {
  ({ browser } = await launch());
  for (const v of variants) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
    const errs = [], net = [];
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 160)); });
    p.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 160)));
    await p.route(u => !/^(file|data|blob|about):/.test(u.href), r => { net.push(r.request().url().slice(0, 120)); r.abort(); });
    await p.goto(fileUrl(target) + (v ? '?' + v : '')); await p.waitForTimeout(1500);
    const overflow = [];
    for (const w of [360, 768, 1280, 1920]) {
      await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(150);
      const o = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      if (o[0] > o[1]) overflow.push(`${w}px: ${o[0]} > ${o[1]}`);
    }
    await p.setViewportSize({ width: 1280, height: 800 });
    // scroll through once so scroll-driven reveals have run before contrast is read
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
    await p.waitForTimeout(300);
    const rows = await p.evaluate(CONTRAST);
    const bad = rows.filter(r => r.ok === false), skipped = rows.filter(r => r.skip);
    const small = await p.evaluate(() => [...document.querySelectorAll('a,button,summary,label,input,select,textarea')].filter(e => {
      const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 24 || r.width < 24) && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.sr-only,.sk-sr') && +getComputedStyle(e).opacity !== 0;
    }).map(e => `${e.tagName.toLowerCase()} "${(e.textContent || e.name || '').trim().slice(0, 16)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
    const noAlt = await p.evaluate(() => [...document.images].filter(i => !i.hasAttribute('alt')).length);
    const lang = await p.evaluate(() => document.documentElement.lang || '');
    const fails = [];
    if (errs.length) fails.push('console: ' + errs.join(' | '));
    if (net.length) fails.push('network: ' + net.join(' '));
    if (overflow.length) fails.push('overflow: ' + overflow.join(', '));
    if (bad.length) fails.push('contrast: ' + bad.map(b => `"${b.t}" ${b.ratio} < ${b.need}`).join('; '));
    if (small.length) fails.push('targets under 24px: ' + small.join('; '));
    if (noAlt) fails.push(`${noAlt} image(s) without alt`);
    if (!lang) fails.push('html lang missing');
    report.variants[v || '(default)'] = { fails, contrastChecked: rows.length - skipped.length, contrastSkipped: skipped.map(s => `${s.t} (${s.skip})`) };
    console.log(`${fails.length ? 'FAIL' : 'PASS'}  ${v || '(default)'}: contrast ${rows.length - skipped.length} checked, ${skipped.length} skipped (gradient or image ground: sample by eye or pixels)`);
    for (const f of fails) console.log('      ' + f);
    if (fails.length) failed++;
    await ctx.close();
  }
  await browser.close();
} catch (e) { console.error('audit could not run: ' + e.message); try { await browser?.close(); } catch {} process.exit(2); }
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
