// test-validate.mjs: the self-test of validate-lessons.mjs on its fixtures, through the command line as a build runs it.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-courses/scripts/test-validate.mjs
//
// verified: Windows 10, Node 24: every check passes.
// not verified: macOS and Linux.
// HTML-Sensei's own code.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, '..', 'fixtures');
const { ok, summary } = checker();
const run = (...args) => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'validate-lessons.mjs'), ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};
const json = (...args) => JSON.parse(run(...args, '--json').out);

const good = run(path.join(FX, 'lessons-good.json'));
ok('good fixture: exit 0, no errors, no warnings', good.code === 0 && /0 error\(s\), 0 warning\(s\)/.test(good.out), good.out.trim());
const strictGood = run(path.join(FX, 'lessons-good.json'), '--strict');
ok('good fixture passes --strict too', strictGood.code === 0);

const bad = run(path.join(FX, 'lessons-bad.json'));
ok('bad fixture: exit 1', bad.code === 1);
const r = json(path.join(FX, 'lessons-bad.json'));
const want = ['no explanation', 'out of range', 'repeats an option', 'gap needs', 'not a permutation', 'at least two pairs', 'multi answer', 'no prompt', 'duplicate id'];
for (const w of want) ok(`bad fixture reports: ${w}`, r.errors.some((e) => e.includes(w)));
ok('longest-key giveaway measured and flagged (10 of 13, chance about 27 per cent)', r.stats.longestKey === 10 && r.stats.single === 13 && r.warnings.some((w) => /longest option/.test(w)), `${r.stats.longestKey}/${r.stats.single}`);
ok('unused answer position flagged', r.warnings.some((w) => /never uses position D/.test(w)));
ok('True/False/Not Given with no Not Given answer flagged', r.warnings.some((w) => /not one is answered Not Given/.test(w)));
const cnt = run(path.join(FX, 'lessons-good.json'), '--count', '10');
ok('--count 10 fails a lesson with 3 questions and names it', cnt.code === 1 && /lesson g2 .* 3 questions, expected exactly 10/.test(cnt.out));
const missing = run(path.join(FX, 'nope.json'));
ok('an unreadable input exits 2', missing.code === 2);
process.exitCode = summary();
