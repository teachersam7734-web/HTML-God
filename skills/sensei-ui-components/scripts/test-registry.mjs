// test-registry.mjs: proves registry-fetch.mjs on the local fixture, proves it refuses a plugin folder, and, with
// --live <item-url> --notice <template>, fetches one real item into a scratch project. HTML-Sensei's own code.
//
//   node test-registry.mjs [--live <registry item url> --notice <template.txt> [--keep]]
//
// verified: Windows 10, Node 24 (fixture, refusal, and one live item over https).
// not verified: macOS and Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const run = a => spawnSync(process.execPath, [path.join(HERE, 'registry-fetch.mjs'), ...a], { encoding: 'utf8' });
const { ok, summary } = checker();
const { checkLedger } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/ledger.mjs')).href);

// 1. Local fixture into a scratch project.
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-test-'));
let r = run([path.join(SKILL, 'fixtures', 'registry-item.json'), '--out', 'src/components/pill', '--notice', path.join(SKILL, 'fixtures', 'notice-fixture.txt'), '--project', proj, '--id', 'pill-fixture', '--licence', 'MIT']);
console.log(r.stdout.trim());
ok('fixture: exit 0', r.status === 0, r.stderr.trim());
const jsx = path.join(proj, 'src/components/pill/Pill.jsx'), css = path.join(proj, 'src/components/pill/Pill.css');
ok('fixture: both files written', fs.existsSync(jsx) && fs.existsSync(css));
const j = fs.existsSync(jsx) ? fs.readFileSync(jsx, 'utf8') : '';
ok('fixture: notice header first, filled in', /^\/\*!\n \* Pill \(Pill-JS-CSS\), fixture item from file:/.test(j) && /Copyright \(c\) 2026 HTML-Sensei/.test(j) && !/\{\{/.test(j));
ok('fixture: original text kept verbatim after the header', j.endsWith("'use client';\n\nimport './Pill.css';\n\nexport default function Pill({ children }) {\n  return <span className=\"pill\">{children}</span>;\n}\n"));
ok('fixture: dependencies listed for install', /npm i -E clsx@2\.1\.1/.test(r.stdout));
const led = checkLedger(proj);
const row = led.rows.find(x => x.id === 'pill-fixture');
ok('fixture: ledger row written and valid', row && row.files.length === 2 && row.notice === 'header' && row.ships_in_plugin === false && led.errors.length === 0, led.errors.join('; '));

// 2. Refusal inside the plugin (this skill sits under a .claude-plugin root).
const target = path.join(SKILL, 'tmp-should-not-exist');
r = run([path.join(SKILL, 'fixtures', 'registry-item.json'), '--out', target, '--notice', path.join(SKILL, 'fixtures', 'notice-fixture.txt'), '--project', SKILL]);
ok('plugin folder: refused with exit 3', r.status === 3, (r.stderr || '').trim().slice(0, 120));
ok('plugin folder: nothing written', !fs.existsSync(target));

// 3. Optional live fetch.
const li = process.argv.indexOf('--live'), ni = process.argv.indexOf('--notice');
if (li > 0) {
  const live = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-live-'));
  r = run([process.argv[li + 1], '--out', 'src/components/fetched', '--notice', path.resolve(process.argv[ni + 1]), '--project', live, '--licence', 'MIT + Commons Clause']);
  console.log(r.stdout.trim());
  ok('live: exit 0', r.status === 0, r.stderr.trim());
  const files = fs.existsSync(path.join(live, 'src/components/fetched')) ? fs.readdirSync(path.join(live, 'src/components/fetched')) : [];
  ok('live: files written', files.length > 0, files.join(', '));
  ok('live: every file starts with the notice', files.length > 0 && files.every(f => /^(\/\*!|<!--)/.test(fs.readFileSync(path.join(live, 'src/components/fetched', f), 'utf8'))));
  const l2 = checkLedger(live);
  ok('live: ledger row valid', l2.rows.length === 1 && l2.errors.length === 0, l2.errors.join('; '));
  if (process.argv.includes('--keep')) console.log('live project kept at ' + live); else fs.rmSync(live, { recursive: true, force: true });
}
fs.rmSync(proj, { recursive: true, force: true });
process.exit(summary());
