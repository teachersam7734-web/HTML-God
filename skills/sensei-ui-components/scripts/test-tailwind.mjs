// test-tailwind.mjs: runs tailwind-one-file.mjs on fixtures/tailwind-page.src.html and proves the result in a browser.
// HTML-Sensei's own code.
//
//   node test-tailwind.mjs [--project DIR]   (DIR holds node_modules with tailwindcss and @tailwindcss/cli)
//
// verified: Windows 10, Node 24, Tailwind 4.3.3, playwright-core 1.64, Chrome 156 headless, strict file://.
// not verified: Tailwind 3; other browsers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--project');
const project = path.resolve(i > 0 ? process.argv[i + 1] : (process.env.CLAUDE_PROJECT_DIR || process.cwd()));
const src = path.join(HERE, '..', 'fixtures', 'tailwind-page.src.html');
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tw-test-')), 'page.html');
const { ok, summary } = checker();

const r = spawnSync(process.execPath, [path.join(HERE, 'tailwind-one-file.mjs'), src, out, '--project', project], { encoding: 'utf8' });
console.log(r.stdout.trim()); if (r.stderr.trim()) console.log(r.stderr.trim());
if (!ok('compile ran', r.status === 0 && fs.existsSync(out))) process.exit(summary());

const html = fs.readFileSync(out, 'utf8');
ok('CDN script removed', !/cdn\.tailwindcss\.com/.test(html));
ok('CSS inlined in the marker', /<style data-tailwind>\s*\S/.test(html));
ok('MIT licence header kept', /\/\*! tailwindcss v[\d.]+ \| MIT License/.test(html));
ok('used class generated (.ps-8)', /\.ps-8\{/.test(html));
ok('rtl: variant generated', /rtl\\:text-right/.test(html));
ok('arbitrary value generated', /text-\\\[0\\\.8125rem\\\]/.test(html));
ok('unused class not generated (.bg-red-500)', !/\.bg-red-500\{/.test(html));

const { browser } = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const p = await ctx.newPage(); const external = [];
  p.on('request', q => { if (!/^(file|data|blob|about):/.test(q.url())) external.push(q.url()); });
  await p.goto(fileUrl(out)); await p.waitForFunction('window.__done === true');
  ok('no network requests', external.length === 0, external.join(' '));
  const bg = await p.evaluate(() => getComputedStyle(document.querySelector('button')).backgroundColor);
  ok('button styled by the inlined CSS', bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(239, 239, 239)', bg);
  const edge = async () => p.evaluate(() => { const cs = getComputedStyle(document.querySelector('.border-s-4')); return { l: cs.borderLeftWidth, r: cs.borderRightWidth }; });
  const ltr = await edge();
  await p.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const rtl = await edge();
  ok('border-s follows the writing direction', ltr.l === '4px' && rtl.r === '4px', `ltr ${JSON.stringify(ltr)} rtl ${JSON.stringify(rtl)}`);
  await ctx.close();
} finally { await browser.close(); }
// Scratch: a folder this test made in the OS temp folder is removed when every check passes and kept (path printed)
// when one fails; a folder given on the command line is always kept.
const code = summary();
if (!code) fs.rmSync(path.dirname(out), { recursive: true, force: true });
console.log(code ? 'output kept at ' + out : 'scratch removed: ' + path.dirname(out));
process.exit(code);
