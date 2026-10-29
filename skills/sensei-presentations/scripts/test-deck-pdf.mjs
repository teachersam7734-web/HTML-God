// test-deck-pdf.mjs: the self-test of deck-pdf.mjs on examples/deck.html, through the command line.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-presentations/scripts/test-deck-pdf.mjs
//
// verified: Windows 10, Node 24, playwright-core 1.62.1, installed Chrome 155: every check passes.
// not verified: other print engines.
// HTML-Sensei's own code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { ok, summary } = checker();
const deck = path.join(HERE, '..', 'examples', 'deck.html');
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-pdf-')), 'deck.pdf');
const run = (...args) => { const r = spawnSync(process.execPath, [path.join(HERE, 'deck-pdf.mjs'), ...args], { encoding: 'utf8', env: process.env }); return { code: r.status, out: (r.stdout + r.stderr).trim() }; };
const good = run(deck, '-o', out);
ok('example deck: 5 pages for 5 slides at 1440 x 810 pt (16:9), exit 0', good.code === 0 && /5 page\(s\), expected 5; page shape 1440 x 810 pt/.test(good.out) && fs.existsSync(out), good.out);
const bad = run(deck, '--expect', '7');
ok('a wrong page count fails with exit 1', bad.code === 1 && /FAIL/.test(bad.out), bad.out);
ok('no input exits 2', run().code === 2);
fs.rmSync(path.dirname(out), { recursive: true, force: true });
process.exitCode = summary();
