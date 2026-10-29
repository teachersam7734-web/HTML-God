// test-marp.mjs: Marp CLI turns examples/marp-deck.md into one self-contained HTML file; this checks the bundle in
// headless Chromium (3 slides at 1280x720, keyboard, no requests, 3 print pages) and proves the stdin trap: without
// --no-stdin, run with a standard input that is not a terminal and never closes, the CLI waits and writes nothing.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-presentations/scripts/test-marp.mjs          (@marp-team/marp-cli from SENSEI_NODE_MODULES or node_modules up from
//                                                the current folder; PW, CHROME as in pw.mjs)
//
// verified: Windows 10, Node 24, @marp-team/marp-cli 4.5.1, playwright-core 1.62.1, installed Chrome 155.
// not verified: marp --pdf and --pptx export (they drive an installed browser, or LibreOffice for --pptx-editable).
// HTML-Sensei's own code. Origin: code-apps/test-decks-others.cjs in the HTML-Sensei build project's research notes (not shipped) (the Marp part).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { ok, summary } = checker();
function findMarp() {
  const bases = [];
  if (process.env.SENSEI_NODE_MODULES) { const e = process.env.SENSEI_NODE_MODULES; bases.push(path.basename(e) === 'node_modules' ? path.dirname(e) : e); }
  bases.push(process.cwd());
  for (const b of bases) {
    let d = path.resolve(b);
    for (;;) {
      const f = path.join(d, 'node_modules', '@marp-team', 'marp-cli', 'marp-cli.js');
      if (fs.existsSync(f)) return f;
      const up = path.dirname(d); if (up === d) break; d = up;
    }
  }
  return null;
}
const marp = findMarp();
if (!marp) { console.log('SKIP  @marp-team/marp-cli not installed (npm i -D @marp-team/marp-cli, or set SENSEI_NODE_MODULES)'); process.exit(0); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-marp-'));
const md = path.join(HERE, '..', 'examples', 'marp-deck.md'), out = path.join(tmp, 'deck.html');
const r = spawnSync(process.execPath, [marp, '--no-stdin', md, '--html', '-o', out], { encoding: 'utf8', timeout: 120000 });
ok('marp --no-stdin writes a self-contained HTML bundle', r.status === 0 && fs.existsSync(out), (r.stderr || '').trim().split('\n').pop());

// the trap: stdin a pipe that never closes, no --no-stdin
const hangOut = path.join(tmp, 'hang.html');
const hang = await new Promise((resolve) => {
  const ch = spawn(process.execPath, [marp, md, '--html', '-o', hangOut], { stdio: ['pipe', 'pipe', 'pipe'] });
  let exited = false; ch.on('exit', () => { exited = true; });
  setTimeout(() => { const res = { exited, wrote: fs.existsSync(hangOut) }; try { ch.kill(); } catch { /* gone */ } resolve(res); }, 15000);
});
ok('without --no-stdin and with an open, non-terminal stdin, the CLI is still waiting after 15 s and has written nothing', !hang.exited && !hang.wrote, hang);

const { browser: b } = await launch();
try {
  const c = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await c.newPage();
  const errs = [], reqs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('request', (q) => { if (!/^(file|data|blob):/.test(q.url())) reqs.push(q.url()); });
  await p.goto(fileUrl(out)); await p.waitForTimeout(600);
  const m0 = await p.evaluate(() => ({ svgs: document.querySelectorAll('svg[data-marpit-svg]').length, sec: (() => { const s = document.querySelector('section'); return s ? [s.clientWidth, s.clientHeight] : null; })() }));
  ok('3 slides, each section 1280x720 (16:9), no network requests', m0.svgs === 3 && m0.sec && m0.sec[0] === 1280 && m0.sec[1] === 720 && reqs.length === 0, { m0, reqs });
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  const idx = await p.evaluate(() => [...document.querySelectorAll('svg[data-marpit-svg]')].findIndex((s) => s.classList.contains('bespoke-marp-active')));
  ok('ArrowRight moves to slide 2 (the inlined runtime)', idx === 1, idx);
  ok('the speaker note comment travels into the bundle (for the presenter view)', await p.evaluate(() => document.documentElement.outerHTML.includes('This is a speaker note')));
  const pages = ((await p.pdf({ preferCSSPageSize: true, printBackground: true })).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok('print: 3 pages', pages === 3, pages);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
process.exitCode = summary();
