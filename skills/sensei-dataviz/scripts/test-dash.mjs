// test-dash.mjs: builds every library page with build-dash.mjs (into a temporary folder) and tests them, then the two
// library-free examples (examples/dashboard.html, examples/table.html), in headless Chromium, strict file://. Painted
// pixels, resize, animated updates and their absence under reduced motion, text alternatives, axe-core, palettes
// measured in the page, 1,000,000 points, 100,000 rows, WebGL picking, no requests.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-dataviz/scripts/test-dash.mjs     (libraries, axe-core: SENSEI_NODE_MODULES or the current folder; PW, CHROME)
//
// verified: Windows 10, Node 24, playwright-core 1.62.1, installed Chrome 155 (software GL), axe-core 4.14.0 and the
//           library versions in build-dash.mjs: every check passes.
// not verified: Firefox and Safari; real GPUs and frame rates; touch; screen-reader speech.
// Origin: code-apps/test-dash.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM and extended.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, findAxe, checker } from './pw.mjs';
import { buildDash } from './build-dash.mjs';
import { checkCategorical } from './palette-check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EX = path.join(HERE, '..', 'examples');
const { ok, summary } = checker();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-dash-'));
const built = buildDash(tmp);
for (const s of built.skipped) console.log(`SKIP  ${s}: library not installed`);
const has = (n) => built.done.some((d) => d.name === n);
const axeFile = await findAxe(), axeSrc = axeFile ? fs.readFileSync(axeFile, 'utf8') : null;
const axeRun = async (p, label) => {
  if (!axeSrc) { console.log('SKIP  axe-core ' + label); return; }
  await p.evaluate(axeSrc);
  const v = await p.evaluate(async () => (await axe.run(document)).violations.map((x) => x.id + ':' + x.nodes.length));
  ok('axe-core ' + label + ': no violations (every rule)', v.length === 0, v.join(' '));
};
const canvasInk = (p, sel) => p.evaluate((sel) => { const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; }, sel);
const { browser: b } = await launch();
const errs = [], reqs = [];
const open = async (file, vp = { width: 1000, height: 800 }, ctx = {}) => {
  const c = await b.newContext({ viewport: vp, ...ctx }); const p = await c.newPage();
  p.on('pageerror', (e) => errs.push(path.basename(file) + ': ' + e.message));
  p.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
  await p.goto(fileUrl(file)); await p.waitForFunction(() => window.__ready || (window.__dash && window.__dash.ready) || (window.__table && window.__table.ready), null, { timeout: 30000 });
  return { c, p };
};
try {
  let c, p;
  if (has('chartjs')) {
    ({ c, p } = await open(path.join(tmp, 'chartjs.html'))); await p.waitForTimeout(1200);
    ok('Chart.js: canvas painted', (await canvasInk(p, '#c')) > 5000);
    const w1 = await p.evaluate(() => document.getElementById('c').clientWidth);
    await p.evaluate(() => { document.getElementById('wrap').style.width = '400px'; }); await p.waitForTimeout(500);
    const w2 = await p.evaluate(() => document.getElementById('c').clientWidth);
    ok('Chart.js: follows its container (900 to 400)', w1 > 800 && Math.abs(w2 - 400) < 3, [w1, w2]);
    const anim = await p.evaluate(async () => { const m = chart.getDatasetMeta(0); const y0 = m.data[0].y; chart.data.datasets[0].data = chart.data.datasets[0].data.map(() => 5); chart.update(); const seen = []; const t0 = performance.now(); while (performance.now() - t0 < 1100) { seen.push(Math.round(m.data[0].y)); await new Promise((r) => requestAnimationFrame(r)); } return { y0: Math.round(y0), distinct: new Set(seen).size, end: seen[seen.length - 1] }; });
    ok('Chart.js: update() animates through intermediate positions', anim.distinct > 5 && anim.end > anim.y0, anim);
    ok('Chart.js: role=img with a label and a real table of all 36 values', await p.evaluate(() => document.getElementById('c').getAttribute('role') === 'img' && document.querySelectorAll('#t td').length === 36));
    const pal = await p.evaluate(() => chart.data.datasets.map((d) => d.backgroundColor));
    ok('Chart.js: the colours in the page pass the palette check on white', checkCategorical(pal, { bg: '#ffffff' }).ok, pal.join(','));
    await axeRun(p, 'Chart.js'); await c.close();
    ({ c, p } = await open(path.join(tmp, 'chartjs.html'), { width: 900, height: 700 }, { reducedMotion: 'reduce', colorScheme: 'dark' }));
    const rm = await p.evaluate(async () => { const m = chart.getDatasetMeta(0); chart.data.datasets[0].data = chart.data.datasets[0].data.map(() => 5); chart.update(); const seen = new Set(); const t0 = performance.now(); while (performance.now() - t0 < 600) { seen.add(Math.round(m.data[0].y)); await new Promise((r) => requestAnimationFrame(r)); } return { anim: chart.options.animation, distinct: seen.size, pal: chart.data.datasets.map((d) => d.backgroundColor) }; });
    ok('Chart.js under reduced motion: animation false, the update jumps (one position)', rm.anim === false && rm.distinct === 1, rm);
    ok('Chart.js in dark: the dark palette, which passes on #12161c', checkCategorical(rm.pal, { bg: '#12161c' }).ok, rm.pal.join(','));
    await c.close();
  }
  if (has('echarts')) {
    ({ c, p } = await open(path.join(tmp, 'echarts.html'))); await p.waitForTimeout(1200);
    const ec = await p.evaluate(() => ({ paths: document.querySelectorAll('#wrap svg path').length, patterns: document.querySelectorAll('#wrap svg pattern').length, aria: document.getElementById('wrap').getAttribute('aria-label') || '', role: document.getElementById('wrap').getAttribute('role') }));
    ok('ECharts SVG: marks drawn, decal patterns present (a second channel besides colour)', ec.paths > 30 && ec.patterns >= 3, { paths: ec.paths, patterns: ec.patterns });
    ok('ECharts: aria description on the container (role=img), all 12 items with maxCount 12', ec.role === 'img' && /North/.test(ec.aria) && !/first 10 items/.test(ec.aria), ec.aria.slice(0, 100));
    await p.evaluate(() => { document.getElementById('wrap').style.width = '420px'; }); await p.waitForTimeout(600);
    ok('ECharts: ResizeObserver and resize() follow the container', Math.abs((await p.evaluate(() => document.querySelector('#wrap svg').getBoundingClientRect().width)) - 420) < 3);
    const fr = await p.evaluate(async () => { ch.setOption(opt(0.2)); const seen = new Set(); const t0 = performance.now(); while (performance.now() - t0 < 1200) { seen.add(document.querySelector('#wrap svg').innerHTML); await new Promise((r) => requestAnimationFrame(r)); } return seen.size; });
    ok('ECharts: setOption renders intermediate frames', fr > 5, fr);
    await axeRun(p, 'ECharts'); await c.close();
    ({ c, p } = await open(path.join(tmp, 'echarts.html'), { width: 1000, height: 800 }, { reducedMotion: 'reduce' })); await p.waitForTimeout(300);
    const fr2 = await p.evaluate(async () => { ch.setOption(opt(0.2)); const seen = new Set(); const t0 = performance.now(); while (performance.now() - t0 < 900) { seen.add(document.querySelector('#wrap svg').innerHTML); await new Promise((r) => requestAnimationFrame(r)); } return { frames: seen.size, anim: ch.getOption().animation }; });
    ok('ECharts under reduced motion: animation off, the update lands in one frame', fr2.anim === false && fr2.frames <= 2, fr2);
    await c.close();
  }
  if (has('uplot')) {
    ({ c, p } = await open(path.join(tmp, 'uplot.html'))); await p.waitForTimeout(500);
    const up = await p.evaluate(() => ({ ms: Math.round(window.__buildMs), n: u.data[0].length }));
    ok('uPlot: one million points drawn to canvas', up.n === 1000000 && (await canvasInk(p, '#wrap canvas')) > 3000, up);
    console.log(`INFO  uPlot first draw of 1,000,000 points: ${up.ms} ms on this machine (2D canvas; information only)`);
    const cur = await p.evaluate(() => { const r = u.over.getBoundingClientRect(); u.setCursor({ left: r.width / 2, top: 10 }); return u.cursor.idx; });
    ok('uPlot: cursor lookup resolves an index on 1M points', cur > 400000 && cur < 600000, cur);
    await p.evaluate(() => { document.getElementById('wrap').style.width = '500px'; }); await p.waitForTimeout(400);
    ok('uPlot: setSize from a ResizeObserver follows the container', Math.abs((await p.evaluate(() => u.width)) - 500) < 2);
    await c.close();
  }
  if (has('d3')) {
    ({ c, p } = await open(path.join(tmp, 'd3.html')));
    const g = await p.evaluate(async () => { const seen = []; const t0 = performance.now(); while (performance.now() - t0 < 1000) { seen.push(+document.querySelector('rect.b').getAttribute('height')); await new Promise((r) => requestAnimationFrame(r)); } return { distinct: new Set(seen.map(Math.round)).size, end: seen[seen.length - 1] }; });
    ok('D3: bars grow through intermediate heights', g.distinct > 6 && g.end > 50, g);
    ok('D3: every bar focusable with a text label', await p.evaluate(() => { const r = [...document.querySelectorAll('rect.b')]; return r.length === 12 && r.every((x) => x.getAttribute('tabindex') === '0' && /: \d+/.test(x.getAttribute('aria-label'))); }));
    await axeRun(p, 'D3'); await c.close();
    ({ c, p } = await open(path.join(tmp, 'd3.html'), { width: 1000, height: 800 }, { reducedMotion: 'reduce' })); await p.waitForTimeout(100);
    ok('D3 under reduced motion: bars at full height at once', await p.evaluate(() => +document.querySelector('rect.b').getAttribute('height') > 50));
    await c.close();
  }
  if (has('plot')) {
    ({ c, p } = await open(path.join(tmp, 'plot.html'))); await p.waitForTimeout(300);
    ok('Plot: 36 bars as SVG with a legend', await p.evaluate(() => document.querySelectorAll('#wrap svg rect').length >= 36 && !!document.querySelector('#wrap [class*="swatches"]')));
    ok('Plot: every labelled <g> now has a role', await p.evaluate(() => document.querySelectorAll('#wrap g[aria-label]:not([role])').length === 0 && document.querySelectorAll('#wrap g[aria-label][role=group]').length > 0));
    await axeRun(p, 'Plot with role=group added'); await c.close();
  }
  if (has('vegalite')) {
    ({ c, p } = await open(path.join(tmp, 'vegalite.html'))); await p.waitForTimeout(500);
    const vl = await p.evaluate(() => ({ dash: !![...document.querySelectorAll('#wrap svg path')].find((q) => q.getAttribute('stroke-dasharray')), marks: document.querySelectorAll('#wrap [role=graphics-symbol][aria-label]').length }));
    ok('Vega-Lite (inline data): dashes as a second channel, every point a labelled graphics-symbol', vl.dash && vl.marks >= 36, vl);
    await axeRun(p, 'Vega-Lite'); await c.close();
  }
  if (has('deckgl')) {
    ({ c, p } = await open(path.join(tmp, 'deckgl.html'), { width: 1000, height: 700 })); await p.waitForTimeout(5000);
    const shot = (await p.locator('#wrap').screenshot()).toString('base64');
    const px = await p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, cv.width, cv.height).data; let blue = 0, orange = 0; for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], bl = d[i + 2]; if (bl > 120 && r < 90) blue++; else if (r > 150 && g < 140 && bl < 60) orange++; } return { blue, orange }; }, shot);
    ok('deck.gl: 200,000 points as WebGL pixels, both classes present', px.blue > 500 && px.orange > 500, px);
    ok('deck.gl: GPU picking returns an index near the centre', (await p.evaluate(() => { const r = document.querySelector('#wrap canvas').getBoundingClientRect(); const o = deckgl.pickObject({ x: r.width / 2, y: r.height / 2, radius: 30 }); return o ? o.index : null; })) !== null);
    await c.close();
  }

  // ---- examples/dashboard.html (no library) ----
  const dash = path.join(EX, 'dashboard.html');
  ({ c, p } = await open(dash, { width: 1200, height: 900 })); await p.waitForTimeout(900);
  const d0 = await p.evaluate(() => ({ bars: [...document.querySelectorAll('#bars rect')].map((r) => Math.round(r.getBoundingClientRect().width)), kpis: document.querySelectorAll('#kpis .kpi').length, find: document.getElementById('find-bars').textContent, label: document.querySelector('#bars svg').getAttribute('aria-label') }));
  ok('dashboard: three headline numbers, three bars drawn, a finding sentence, a chart label with the values', d0.kpis === 3 && d0.bars.length === 3 && d0.bars.every((w) => w > 20) && /leads with \d+ units/.test(d0.find) && /North \d+/.test(d0.label), d0);
  const sorted = await p.evaluate(() => [...document.querySelectorAll('#bars rect')].map((r) => ({ y: +r.getAttribute('y'), w: r.getBoundingClientRect().width })).sort((a, b) => a.y - b.y).map((r) => r.w));
  ok('dashboard: bars sorted, longest first', sorted.every((w, i) => i === 0 || w <= sorted[i - 1] + 0.5), sorted.map(Math.round));
  const tr = await p.evaluate(async () => { const r = document.querySelector('#bars rect[data-s="West"]'); const w0 = r.getBoundingClientRect().width; document.getElementById('p-h2').click(); const seen = new Set(); const t0 = performance.now(); while (performance.now() - t0 < 800) { seen.add(Math.round(r.getBoundingClientRect().width)); await new Promise((q) => requestAnimationFrame(q)); } return { w0: Math.round(w0), min: Math.min(...seen), distinct: seen.size, end: Math.round(r.getBoundingClientRect().width) }; });
  ok('dashboard: a period change animates from the old width, never from zero', tr.distinct > 4 && tr.min >= Math.min(tr.w0, tr.end) - 1, tr);
  ok('dashboard: the second period shows a delta in words', /per cent on January to June/.test(await p.evaluate(() => document.querySelector('#kpis .d').textContent)));
  const dpal = await p.evaluate(() => ['--s1', '--s2', '--s3'].map((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()));
  ok('dashboard: its light palette passes the palette check on white', checkCategorical(dpal, { bg: '#ffffff' }).ok, dpal.join(','));
  ok('dashboard: line series differ by dash as well as colour, labelled at their ends', await p.evaluate(() => { const s = [...document.querySelectorAll('#line path.series')]; return s.length === 3 && s.filter((x) => x.getAttribute('stroke-dasharray')).length === 2 && [...document.querySelectorAll('#line svg > text')].map((t) => t.textContent).join() === 'North,South,West'; }));
  await p.click('#as-table'); await p.waitForTimeout(150);
  ok('dashboard: "Show as tables" swaps both charts for tables (aria-pressed true)', await p.evaluate(() => document.getElementById('as-table').getAttribute('aria-pressed') === 'true' && document.getElementById('bars').hidden && !document.getElementById('t-line').hidden && document.querySelectorAll('#t-line tbody tr').length === 12));
  await axeRun(p, 'dashboard, tables shown');
  await p.click('#as-table'); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 380, height: 900 }); await p.waitForTimeout(500);
  const narrow = await p.evaluate(() => ({ months: [...document.querySelectorAll('#line .axis text')].filter((t) => /^[A-Z][a-z]{2}$/.test(t.textContent)).length, w: document.querySelector('#line svg').viewBox.baseVal.width, scroll: document.documentElement.scrollWidth <= innerWidth }));
  ok('dashboard: narrow redraw from the container, fewer month labels, no horizontal scroll', narrow.months === 4 && narrow.w < 380 && narrow.scroll, narrow);
  await axeRun(p, 'dashboard, charts, narrow'); await c.close();
  ({ c, p } = await open(dash, { width: 1200, height: 900 }, { reducedMotion: 'reduce', colorScheme: 'dark' })); await p.waitForTimeout(150);
  const rmd = await p.evaluate(async () => { const r = document.querySelector('#bars rect[data-s="West"]'); const first = r.getBoundingClientRect().width; document.getElementById('p-h2').click(); await new Promise((q) => requestAnimationFrame(() => requestAnimationFrame(q))); return { first: Math.round(first), after: Math.round(r.getBoundingClientRect().width), pal: ['--s1', '--s2', '--s3'].map((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()) }; });
  ok('dashboard under reduced motion: bars at full width on arrival, the new width in the next frame', rmd.first > 20 && rmd.after !== rmd.first, rmd);
  ok('dashboard in dark: its dark palette passes on #12161c', checkCategorical(rmd.pal, { bg: '#12161c' }).ok, rmd.pal.join(','));
  await axeRun(p, 'dashboard, dark'); await c.close();

  // ---- examples/table.html: 100,000 rows ----
  ({ c, p } = await open(path.join(EX, 'table.html'))); await p.waitForTimeout(200);
  const t0 = await p.evaluate(() => ({ dom: document.querySelectorAll('#body [role=row]').length, first: document.querySelector('#body [role=row] span').textContent }));
  ok('table: 100,000 rows, only a window in the DOM', t0.dom < 60 && t0.first === '1', t0);
  await p.evaluate(() => { const g = document.getElementById('grid'); g.scrollTop = g.scrollHeight; }); await p.waitForTimeout(250);
  const t1 = await p.evaluate(() => { const r = [...document.querySelectorAll('#body [role=row]')].pop(); return { last: r.querySelector('span').textContent, idx: r.getAttribute('aria-rowindex') }; });
  ok('table: the end shows row 100000 with aria-rowindex 100001', t1.last === '100000' && t1.idx === '100001', t1);
  const ms = await p.evaluate(() => window.__table.sortBy('v')); await p.waitForTimeout(100);
  const s1 = await p.evaluate(() => [document.querySelector('#body [role=row] span:nth-child(4)').textContent, document.querySelector('[role=columnheader] button[data-k=v]').parentElement.getAttribute('aria-sort'), document.getElementById('info').textContent]);
  console.log(`INFO  sorting 100,000 rows took ${Math.round(ms)} ms (information only)`);
  ok('table: a header button sorts, sets aria-sort and says so', s1[0] === '0' && s1[1] === 'ascending' && /Sorted by v, ascending/.test(s1[2]), s1);
  await p.click('[data-k=v]'); await p.waitForTimeout(100);
  await p.fill('#q', 'lim'); await p.waitForTimeout(400);
  const s2 = await p.evaluate(() => ({ n: window.__table.rows(), city: document.querySelector('#body [role=row] span:nth-child(3)').textContent, v: document.querySelector('#body [role=row] span:nth-child(4)').textContent, count: document.getElementById('grid').getAttribute('aria-rowcount') }));
  ok('table: search finds 25,000 rows for "lim", keeps the descending sort, updates aria-rowcount', s2.n === 25000 && s2.city === 'Lima' && s2.v === '999' && s2.count === '25001', s2);
  await p.fill('#q', ''); await p.waitForTimeout(400);
  await p.focus('#grid'); await p.keyboard.press('PageDown'); await p.waitForTimeout(150);
  ok('table: the focused region scrolls with Page Down', (await p.evaluate(() => document.getElementById('grid').scrollTop)) > 100);
  await axeRun(p, 'table'); await c.close();

  ok('no network requests from any page', reqs.length === 0, reqs.join(' '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
process.exitCode = summary();
