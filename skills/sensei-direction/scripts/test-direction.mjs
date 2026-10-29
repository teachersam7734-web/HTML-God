#!/usr/bin/env node
// test-direction.mjs: self-test of this skill's scripts against its examples and fixtures.
//
//   node test-direction.mjs          (Playwright and a browser are discovered as in sensei-verify)
//
// Asserts: the styles lab passes style-contrast in LTR and RTL; with ?bad=1 it fails, and the failures are exactly
// the rows the research measured (raw neumorphism field and button boundaries, raw clay field boundary, bad dark mode
// body, label, placeholder and field boundary); style-shots passes the lab and fails the shadow-only fixture;
// check-directions passes the example and fails the same-layout fixture on distinct, parts, prefix and copy.
// Exit 0 when every assertion holds, 1 otherwise.
//
// verified: Windows 10, Node 24, Chrome 155 via playwright-core 1.64: every assertion passes (SKILL.md section 8).
// not verified: macOS and Linux.
// HTML-Sensei's own code.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ex = f => path.join(here, '..', 'examples', f), fx = f => path.join(here, '..', 'fixtures', f);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-direction-'));
const run = (script, args) => spawnSync(process.execPath, [path.join(here, script), ...args], { encoding: 'utf8' });
let ok = 0, bad = 0;
const check = (name, cond, extra = '') => { if (cond) { ok++; console.log('ok   ' + name); } else { bad++; console.log('FAIL ' + name + (extra ? '\n' + extra : '')); } };

let r = run('style-contrast.mjs', [ex('styles.html')]);
check('styles lab passes contrast (LTR)', r.status === 0, r.stdout + r.stderr);
r = run('style-contrast.mjs', [ex('styles.html') + '?dir=rtl']);
check('styles lab passes contrast (RTL)', r.status === 0, r.stdout + r.stderr);
const j = path.join(tmp, 'bad.json');
r = run('style-contrast.mjs', [ex('styles.html') + '?bad=1', '--json', j]);
check('bad cells fail contrast', r.status === 1, r.stdout + r.stderr);
if (fs.existsSync(j)) {
  const got = JSON.parse(fs.readFileSync(j, 'utf8')).failures.map(f => `${f.style}|${f.row}`).sort();
  const want = ['claymorphism raw field|field boundary', 'dark mode bad|body text', 'dark mode bad|button label', 'dark mode bad|field boundary',
    'dark mode bad|placeholder', 'neumorphism raw|button boundary', 'neumorphism raw|field boundary'].sort();
  check('bad cells fail on exactly the measured rows', JSON.stringify(got) === JSON.stringify(want), 'got ' + got.join(', '));
}
r = run('style-shots.mjs', [ex('styles.html'), '--out', path.join(tmp, 'shots')]);
check('styles lab keeps every control edge in forced colours', r.status === 0, r.stdout + r.stderr);
check('style-shots wrote 33 pictures', fs.existsSync(path.join(tmp, 'shots')) && fs.readdirSync(path.join(tmp, 'shots')).length === 33);
r = run('style-shots.mjs', [fx('shadow-only.html'), '--out', path.join(tmp, 'shots2')]);
check('shadow-only fixture fails forced colours', r.status === 1, r.stdout + r.stderr);
r = run('check-directions.mjs', [ex('directions.html')]);
check('directions example passes', r.status === 0, r.stdout + r.stderr);
r = run('check-directions.mjs', [fx('same-layout.html')]);
check('same-layout fixture fails', r.status === 1, r.stdout + r.stderr);
for (const id of ['distinct-AB', 'parts-B', 'prefix-C', 'copy']) check(`fixture fails on ${id}`, new RegExp('FAIL\\s+' + id).test(r.stdout), r.stdout);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
