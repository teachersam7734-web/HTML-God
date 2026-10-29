// test-srs.mjs: Node-only tests of srs.js, and a real run of the ts-fsrs package beside it (skipped, and said so, when
// ts-fsrs is not installed: npm i ts-fsrs in the current folder or set SENSEI_NODE_MODULES).
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-courses/scripts/test-srs.mjs
//
// verified: Windows 10, Node 24, ts-fsrs 5.4.2 (installed with npm into a scratch folder): every check passes.
// not verified: anything about learning outcomes.
// Origin: code-apps/test-srs.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { checker, requirePkg } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = createRequire(import.meta.url)(path.join(HERE, 'srs.js'));
const { ok, summary } = checker();
const T0 = Date.UTC(2026, 0, 1);

let c = S.leitner({}, 'good', T0);
ok('Leitner: a new card graded good goes to box 2, due in 1 day', c.box === 2 && c.due === T0 + S.DAY, c);
c = S.leitner(S.leitner(S.leitner(c, 'good', T0), 'good', T0), 'good', T0);
ok('Leitner: caps at box 5 with an 8-day gap', c.box === 5 && c.due === T0 + 8 * S.DAY, c);
ok('Leitner: hard drops one box; again resets to box 1, due today', S.leitner(c, 'hard', T0).box === 4 && S.leitner(c, 'again', T0).box === 1 && S.leitner(c, 'again', T0).due === T0);
ok('Leitner: easy counts as good', S.leitner({ box: 2 }, 'easy', T0).box === 3);
const ub = [0, 1, 2, 4, 8, 16];
ok('Leitner: custom gaps are honoured (Ultra Bookworm\'s table gives 16 days at box 5)', S.leitner({ box: 4 }, 'good', T0, ub).due === T0 + 16 * S.DAY);

let s = S.sm2({}, 5, T0); const i1 = s.interval; s = S.sm2(s, 5, T0); const i2 = s.interval; s = S.sm2(s, 5, T0);
ok('SM-2: intervals 1, 6, then times the ease (16 days at quality 5: 6 times the ease of 2.7 then in force)', i1 === 1 && i2 === 6 && s.interval === 16, [i1, i2, s.interval, s.ef.toFixed(2)]);
ok('SM-2: the ease never drops below 1.3', S.sm2({ rep: 3, ef: 1.35, interval: 20 }, 3, T0).ef >= 1.3);
ok('SM-2: a lapse (quality under 3) resets and returns in 1 day', S.sm2({ rep: 5, ef: 2.5, interval: 40 }, 2, T0).interval === 1);

const cards = ['a1', 'a2', 'a3', 'b1', 'b2', 'c1'].map((id) => ({ id, g: id[0] }));
const mix = S.interleave(cards, (x) => x.g);
let adj = 0; for (let i = 1; i < mix.length; i++) if (mix[i].g === mix[i - 1].g) adj++;
ok('interleave: no neighbours from one lesson when that is possible', adj === 0 && mix.length === 6, mix.map((x) => x.id).join());

const q = S.dueQueue([{ id: 1, due: T0 - 2 * S.DAY }, { id: 2, due: T0 + S.DAY }, { id: 3, due: T0 - 5 * S.DAY }, { id: 4 }, { id: 5 }], T0, 1);
ok('due queue: most overdue first, future cards left out, new cards capped', q.map((x) => x.id).join() === '3,1,4', q.map((x) => x.id).join());

const win = {}; win.self = win; vm.runInNewContext(fs.readFileSync(path.join(HERE, 'srs.js'), 'utf8'), win);
ok('srs.js as a classic script defines self.SenseiSRS (no module system)', win.SenseiSRS && win.SenseiSRS.leitner({}, 'good', T0).box === 2);

const F = requirePkg('ts-fsrs');
if (!F) console.log('SKIP  ts-fsrs not installed (npm i ts-fsrs here, or set SENSEI_NODE_MODULES)');
else {
  const { fsrs, createEmptyCard, Rating, generatorParameters } = F;
  const f = fsrs(generatorParameters({ enable_fuzz: false }));
  const card = createEmptyCard(new Date(T0));
  const r1 = f.repeat(card, new Date(T0));
  const good = r1[Rating.Good].card, again = r1[Rating.Again].card;
  const good2 = f.repeat(good, good.due)[Rating.Good].card;
  const good3 = f.repeat(good2, good2.due)[Rating.Good].card;
  const m1 = (good.due - T0) / 60000, d2 = (good2.due - good.due) / S.DAY, d3 = (good3.due - good2.due) / S.DAY;
  console.log(`INFO  ts-fsrs, fuzz off: first Good due in ${m1.toFixed(0)} min; second Good ${d2.toFixed(1)} days; third ${d3.toFixed(1)} days; stability ${good.stability.toFixed(2)}, ${good2.stability.toFixed(2)}, ${good3.stability.toFixed(2)}`);
  ok('ts-fsrs: Again is due sooner than Good; intervals grow; stability grows once the card is in review', again.due < good.due && d2 >= 1 && d3 > d2 && good3.stability > good2.stability && typeof good3.difficulty === 'number');
}
process.exitCode = summary();
