#!/usr/bin/env node
// check-directions.mjs: checks a directions comparison page (the explore step) before it is shown to the user.
//
//   node check-directions.mjs directions.html [--width 1280] [--min-distance 0.25] [--json out.json]
//
// The page marks each direction `<article class="direction" data-direction="A" data-prefix="va-">` with
// [data-part=thesis], [data-part=tradeoff], [data-part=grounded] and a `.preview`, and marks the preview's parts with
// data-role="headline | lede | cta | media | proof" (see ../examples/directions.html). Checks:
//   count       3 to 6 directions (fail outside)
//   parts       every direction has a thesis, a trade-off, a grounded-in list and a preview (fail)
//   prefix      every class inside a preview starts with that direction's prefix, so one direction's CSS cannot
//               leak into another (fail)
//   copy        the headline text is the same in every direction: the same real copy, never lorem ipsum (warn when
//               it differs; fail on "lorem")
//   distinct    "the same layout in different colours" is the commonest failure of an explore step. Each preview's
//               headline, lede, cta, media and proof are measured as fractions of the preview (the
//               text's own extent, so a centred line in a full-width block counts as centred); per role the distance is
//               the move of its centre plus half the change of its width and height; the layout distance is the
//               mean over roles, with 0.5 for a role only one direction has. Pairs under --min-distance (0.2) fail
//   external    no http(s) stylesheet, script, image or font (fail): the page must open offline
// Exit 0 pass (warnings allowed), 1 fail, 2 could not run.
//
// verified: Windows 10, Node 24, Chrome 155 via playwright-core 1.64: ../examples/directions.html passes;
//           ../fixtures/same-layout.html fails on distinct, parts, prefix and copy (scripts/test-direction.mjs).
// not verified: the threshold on many real projects (0.2 sits between the example's closest pair, 0.39, and the
//           fixture's twins, 0.00); other browsers.
// HTML-Sensei's own code.
import fs from 'node:fs';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const target = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!target || !fs.existsSync(target)) { console.error('usage: node check-directions.mjs directions.html'); process.exit(2); }
const width = +opt('--width', 1280), minD = +opt('--min-distance', 0.2), jsonOut = opt('--json', null);
const ROLES = ['headline', 'lede', 'cta', 'media', 'proof'];

let browser;
try {
  ({ browser } = await launch());
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  const external = [];
  p.on('request', r => { if (/^https?:/.test(r.url())) external.push(r.url()); });
  await p.route(/^https?:/, r => r.abort());
  await p.goto(fileUrl(target));
  await p.waitForTimeout(500);
  const data = await p.evaluate(roles => [...document.querySelectorAll('.direction')].map(d => {
    const pv = d.querySelector('.preview'); const pr = pv ? pv.getBoundingClientRect() : null;
    const box = {};
    if (pv) for (const role of roles) {
      const el = pv.querySelector(`[data-role="${role}"]`); if (!el) continue;
      // the ink, not the box: a centred line in a full-width block must measure as centred
      const rg = document.createRange(); rg.selectNodeContents(el); const ri = rg.getBoundingClientRect();
      const r = el.textContent.trim() && ri.width > 0 ? ri : el.getBoundingClientRect();
      box[role] = [(r.left + r.width / 2 - pr.left) / pr.width, (r.top + r.height / 2 - pr.top) / pr.height, r.width / pr.width, r.height / pr.height];
    }
    const prefix = d.dataset.prefix || '';
    const bad = pv ? [...new Set([...pv.querySelectorAll('[class]')].flatMap(e => [...e.classList]).filter(c => !c.startsWith(prefix)))] : [];
    const hl = pv && pv.querySelector('[data-role="headline"]');
    return { id: d.dataset.direction || '?', prefix, preview: !!pv,
      parts: Object.fromEntries(['thesis', 'tradeoff', 'grounded'].map(k => [k, !!(d.querySelector(`[data-part="${k}"]`) && d.querySelector(`[data-part="${k}"]`).textContent.trim().length > 10)])),
      badClasses: bad, headline: hl ? hl.textContent.trim() : null, box };
  }), ROLES);
  const extInHtml = [...fs.readFileSync(target, 'utf8').matchAll(/(?:src|href)\s*=\s*["'](https?:[^"']+)/gi)].map(m => m[1])
    .concat([...fs.readFileSync(target, 'utf8').matchAll(/url\(\s*["']?(https?:[^)"']+)/gi)].map(m => m[1]));
  const results = [];
  const add = (status, id, detail) => results.push({ status, id, detail });
  add(data.length >= 3 && data.length <= 6 ? 'pass' : 'fail', 'count', `${data.length} directions (3 to 6 needed)`);
  for (const d of data) {
    const missing = Object.entries(d.parts).filter(([, v]) => !v).map(([k]) => k).concat(d.preview ? [] : ['preview']);
    add(missing.length ? 'fail' : 'pass', `parts-${d.id}`, missing.length ? `missing: ${missing.join(', ')}` : 'thesis, trade-off, grounded-in, preview');
    add(d.badClasses.length ? 'fail' : 'pass', `prefix-${d.id}`, d.badClasses.length ? `classes without "${d.prefix}": ${d.badClasses.slice(0, 8).join(' ')}` : `all classes start with ${d.prefix}`);
  }
  const heads = [...new Set(data.map(d => d.headline))];
  if (data.some(d => /lorem|ipsum/i.test(d.headline || ''))) add('fail', 'copy', 'placeholder text in a headline: use the real copy');
  else add(heads.length === 1 ? 'pass' : 'warn', 'copy', heads.length === 1 ? 'same headline in every direction' : `headlines differ: ${heads.map(h => JSON.stringify(h)).join(' / ')}`);
  const dist = (a, b) => {
    let s = 0, n = 0;
    for (const r of ROLES) {
      if (a.box[r] && b.box[r]) { const [x, y, w, h] = a.box[r], [X, Y, W, H] = b.box[r]; s += Math.hypot(x - X, y - Y) + 0.5 * (Math.abs(w - W) + Math.abs(h - H)); n++; }
      else if (a.box[r] || b.box[r]) { s += 0.5; n++; }
    }
    return n ? s / n : 0;
  };
  const pairs = [];
  for (let i = 0; i < data.length; i++) for (let j = i + 1; j < data.length; j++) {
    const d = +dist(data[i], data[j]).toFixed(3); pairs.push({ a: data[i].id, b: data[j].id, d });
    add(d < minD ? 'fail' : 'pass', `distinct-${data[i].id}${data[j].id}`, `layout distance ${d} (needs ${minD} or more)${d < minD ? ': the same layout in different colours' : ''}`);
  }
  const ext = [...new Set([...external, ...extInHtml])];
  add(ext.length ? 'fail' : 'pass', 'external', ext.length ? `remote references: ${ext.slice(0, 5).join(' ')}` : 'no remote references');
  for (const r of results) console.log(r.status.toUpperCase().padEnd(5), r.id.padEnd(16), r.detail);
  const verdict = results.some(r => r.status === 'fail') ? 'fail' : results.some(r => r.status === 'warn') ? 'warn' : 'pass';
  console.log('verdict:', verdict);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ target, verdict, results, pairs }, null, 2));
  await browser.close();
  process.exit(verdict === 'fail' ? 1 : 0);
} catch (e) {
  console.error('check-directions could not run: ' + e.message);
  try { await browser?.close(); } catch {}
  process.exit(2);
}
