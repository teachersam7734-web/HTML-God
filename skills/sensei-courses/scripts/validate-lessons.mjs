#!/usr/bin/env node
// validate-lessons.mjs: the content gate a course build runs before it writes anything. Content as data plus a
// validator is what makes a course of fifty lessons possible; this is the generic half (Ultra Bookworm's own
// validators add its course-specific rules).
//
//   node validate-lessons.mjs <file.json | folder> [--count N] [--strict] [--json]
//
// Input: a JSON file or a folder of *.json files. Each file holds one lesson, an array of lessons, or {lessons: [...]}.
// A lesson is {id, title, qs | questions: [...]}; a question is the engine's shape ({type, prompt, options, answer,
// explain, items, pairs}) or Ultra Bookworm's ({type, prompt, opts, a, explain}).
//
// Errors (exit 1): duplicate lesson ids; a question with no prompt; an answer index out of range; repeated options;
// no explanation; a gap with no accepted answers; an order answer that is not a permutation; a multi answer empty or out
// of range; a match with fewer than two pairs; a question count other than --count N.
// Warnings (exit 1 only with --strict): the key is the longest option far more often than chance (a learner can answer
// by length); an answer position never used; True/False/Not Given items with no Not Given answer.
//
// verified: Windows 10, Node 24 (test-validate.mjs: the good fixture passes, the bad fixture fails for each named
//           reason, the longest-key giveaway and the unused position are measured; Ultra Bookworm's 50 lessons read).
// not verified: course-specific rules (quotations that must exist in the passage, recycling, lexical quotas): those
//           belong in the course's own validator, as in Ultra Bookworm.
// HTML-Sensei's own code. The longest-key and Not Given checks follow Ultra Bookworm's repair pass (RESUME.md in the owner's Ultra Bookworm project (not shipped)).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LONGEST_MARGIN = 0.15;   // flag when the longest-key share exceeds chance by more than this
const MIN_ITEMS = 8;           // below this many items, shares say nothing

export function loadLessons(target) {
  const files = fs.statSync(target).isDirectory()
    ? fs.readdirSync(target).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(target, f))
    : [target];
  const out = [];
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const list = Array.isArray(j) ? j : Array.isArray(j.lessons) ? j.lessons : [j];
    for (const l of list) out.push({ ...l, __file: path.basename(f) });
  }
  return out;
}

const opts = (q) => q.options || q.opts || [];
const key = (q) => (q.answer !== undefined ? q.answer : q.a);
const isTfng = (q) => q.type === 'tfng' || opts(q).some((o) => /^not given$/i.test(String(o).trim()));
const kind = (q) => (['multi', 'gap', 'order', 'match'].includes(q.type) ? q.type : 'single');

export function validate(lessons, { count = null } = {}) {
  const errors = [], warnings = [], stats = { lessons: lessons.length, questions: 0, single: 0, longestKey: 0, chance: 0, positions: {}, tfng: 0, notGiven: 0 };
  const seen = new Map();
  for (const l of lessons) {
    const where = `lesson ${l.id ?? '?'} (${l.__file})`;
    if (l.id == null) errors.push(`${where}: no id`);
    else if (seen.has(String(l.id))) errors.push(`${where}: duplicate id, also in ${seen.get(String(l.id))}`);
    else seen.set(String(l.id), l.__file);
    const qs = l.qs || l.questions || [];
    if (count != null && qs.length !== count) errors.push(`${where}: ${qs.length} questions, expected exactly ${count}`);
    qs.forEach((q, i) => {
      const at = `${where} q${i + 1}`;
      stats.questions++;
      if (!q.prompt || !String(q.prompt).trim()) errors.push(`${at}: no prompt`);
      if (!q.explain || !String(q.explain).trim()) errors.push(`${at}: no explanation`);
      const k = kind(q), o = opts(q), a = key(q);
      if (k === 'single') {
        const n = q.type === 'tfng' && !o.length ? 3 : o.length;
        if (!Number.isInteger(a) || a < 0 || a >= n) errors.push(`${at}: answer ${JSON.stringify(a)} out of range for ${n} options`);
        if (new Set(o.map((x) => String(x).trim().toLowerCase())).size !== o.length) errors.push(`${at}: repeats an option`);
        if (isTfng(q)) { stats.tfng++; const label = o.length ? String(o[a] || '') : ['True', 'False', 'Not Given'][a]; if (/^not given$/i.test(label.trim())) stats.notGiven++; }
        else if (o.length >= 3 && Number.isInteger(a) && a < o.length) {
          stats.single++; stats.chance += 1 / o.length;
          stats.positions[a] = (stats.positions[a] || 0) + 1;
          const len = o.map((x) => String(x).length), max = Math.max(...len);
          if (len[a] === max && len.filter((x) => x === max).length === 1) stats.longestKey++;
        }
      } else if (k === 'multi') {
        if (!Array.isArray(a) || !a.length || a.some((x) => !Number.isInteger(x) || x < 0 || x >= o.length)) errors.push(`${at}: multi answer must be a non-empty list of option indexes`);
      } else if (k === 'gap') {
        if (!Array.isArray(a) || !a.length || a.some((x) => !String(x).trim())) errors.push(`${at}: gap needs a list of accepted answers`);
      } else if (k === 'order') {
        const n = (q.items || []).length;
        if (!Array.isArray(a) || a.length !== n || [...a].sort((x, y) => x - y).some((x, j) => x !== j)) errors.push(`${at}: order answer is not a permutation of ${n} items`);
      } else if (k === 'match') {
        if (!Array.isArray(q.pairs) || q.pairs.length < 2) errors.push(`${at}: match needs at least two pairs`);
      }
    });
  }
  if (stats.single >= MIN_ITEMS) {
    const share = stats.longestKey / stats.single, chance = stats.chance / stats.single;
    stats.longestShare = +share.toFixed(3); stats.chanceShare = +chance.toFixed(3);
    if (share > chance + LONGEST_MARGIN) warnings.push(`the key is the longest option in ${stats.longestKey} of ${stats.single} choice questions (${Math.round(share * 100)} per cent; chance is about ${Math.round(chance * 100)}): a learner can answer by length`);
    const maxN = Math.max(...lessons.flatMap((l) => (l.qs || l.questions || []).filter((q) => kind(q) === 'single' && !isTfng(q)).map((q) => opts(q).length)), 0);
    for (let p = 0; p < Math.min(maxN, 4); p++) if (!stats.positions[p]) warnings.push(`the answer key never uses position ${'ABCD'[p]} across ${stats.single} choice questions`);
  }
  if (stats.tfng >= 5 && !stats.notGiven) warnings.push(`${stats.tfng} True/False/Not Given items and not one is answered Not Given`);
  return { errors, warnings, stats };
}

function main(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--count') a.count = +argv[++i];
    else if (argv[i] === '--strict') a.strict = true;
    else if (argv[i] === '--json') a.json = true;
    else a._.push(argv[i]);
  }
  if (!a._[0]) { console.error('usage: node validate-lessons.mjs <file.json | folder> [--count N] [--strict] [--json]'); return 2; }
  let lessons;
  try { lessons = loadLessons(a._[0]); } catch (e) { console.error('cannot read: ' + e.message); return 2; }
  const r = validate(lessons, { count: Number.isFinite(a.count) ? a.count : null });
  if (a.json) console.log(JSON.stringify(r, null, 2));
  else {
    for (const e of r.errors) console.log('ERROR  ' + e);
    for (const w of r.warnings) console.log('WARN   ' + w);
    console.log(`${r.stats.lessons} lesson(s), ${r.stats.questions} question(s): ${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
  }
  return r.errors.length || (a.strict && r.warnings.length) ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
