#!/usr/bin/env node
// deck-pdf.mjs: print a deck to PDF the way Chrome's Save as PDF does (print media, the page's own @page size,
// backgrounds on) and check the page count and the page shape, so a promised handout is proved, not assumed.
//
//   node deck-pdf.mjs deck.html -o deck.pdf [--expect N] [--slides ".slide"] [--query print-pdf] [--wait-for EXPR]
//
// --expect N        pages expected; default: the number of elements matching --slides (default ".slide"); a reveal.js
//                   deck: give --expect, because vertical stacks and fragments change the count (see SKILL.md)
// --query print-pdf open the page with ?print-pdf (reveal.js's print layout)
// --wait-for EXPR   a JavaScript expression that is truthy once the deck is ready (reveal.js: "window.__ready")
// Exit 0 when the count matches and every page has one aspect ratio; 1 otherwise; 2 when it could not run.
// Strict file:// (no --allow-file-access-from-files). Browser and Playwright found as in pw.mjs.
//
// verified: Windows 10, Node 24, playwright-core 1.62.1, installed Chrome 155 (test-deck-pdf.mjs): examples/deck.html
//           gives 5 pages at 1440 by 810 pt (16:9) and passes; a wrong --expect fails with exit 1.
// not verified: Firefox and Safari print engines (their PDFs can differ); fonts or filters that rasterise in print
//           must still be looked at in the PDF itself.
// HTML-Sensei's own code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from './pw.mjs';

export function pdfInfo(buf) {
  const t = buf.toString('latin1');
  const pages = (t.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const boxes = [...t.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [+m[1], +m[2]]);
  return { pages, boxes };
}

async function main(argv) {
  const a = { _: [], slides: '.slide' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '-o') a.out = argv[++i]; else if (k === '--expect') a.expect = +argv[++i];
    else if (k === '--slides') a.slides = argv[++i]; else if (k === '--query') a.query = argv[++i];
    else if (k === '--wait-for') a.waitFor = argv[++i]; else a._.push(k);
  }
  if (!a._[0]) { console.error('usage: node deck-pdf.mjs deck.html [-o deck.pdf] [--expect N] [--slides SEL] [--query print-pdf] [--wait-for EXPR]'); return 2; }
  let browser;
  try { ({ browser } = await launch()); } catch (e) { console.error(e.message); return 2; }
  try {
    const p = await (await browser.newContext()).newPage();
    await p.goto(fileUrl(a._[0]) + (a.query ? '?' + a.query : ''));
    if (a.waitFor) await p.waitForFunction(a.waitFor, null, { timeout: 30000 });
    await p.evaluate(() => document.fonts && document.fonts.ready);
    await p.waitForTimeout(300);
    const expect = Number.isFinite(a.expect) ? a.expect : await p.evaluate((sel) => document.querySelectorAll(sel).length, a.slides);
    const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    if (a.out) fs.writeFileSync(a.out, buf);
    const { pages, boxes } = pdfInfo(buf);
    const ratios = [...new Set(boxes.map(([w, h]) => (w / h).toFixed(3)))];
    const okCount = pages === expect, okShape = ratios.length === 1;
    console.log(`${okCount && okShape ? 'PASS' : 'FAIL'}  ${pages} page(s), expected ${expect}; page shape ${boxes[0] ? boxes[0].join(' x ') + ' pt' : 'unknown'} (ratio ${ratios.join(', ')})${a.out ? '; wrote ' + a.out : ''}`);
    return okCount && okShape ? 0 : 1;
  } finally { await browser.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
