// storyboard-check.mjs: the cheap gate before any build. Reads a storyboard as JSON and checks rhythm, reading time,
// carries across boundaries and the shape of the opening and ending. Thresholds come from the research (onetake's
// rhythm numbers, lemo-opuscar's reading-time formula, motionmaxxing's end-hold gate); they are starting points.
//
//   node storyboard-check.mjs STORYBOARD.json        exit 0 pass, 1 fail, 2 unreadable
//
// Storyboard JSON (one row per beat, times in seconds):
//   { "duration": 5, "fps": 30, "lang": "en",
//     "beats": [ { "t": 0, "end": 1.7, "beat": "hook", "buys": "the promise", "moves": "words rise", "still": false,
//                  "text": "Read like a detective.", "carries": "the full stop becomes the ground", "cut": "carry" }, ... ] }
//   cut: "carry" | "anchor" | "burst" | "end-card" | "hard" (what happens at the boundary AFTER this beat; the last beat
//   may omit it). "carries" names what survives the boundary; it may be empty only when cut is burst or end-card.
//   still: true marks a designed rest. text: everything the viewer must read in that beat.
//
// verified: Node 24 on Windows 10 against examples/sting.storyboard.json (passes) and a metronome fixture (fails), in
//           test-examples.mjs.  not verified: storyboards in right-to-left scripts (reading time for Persian is not in
//           the research; the Latin formula is applied and flagged).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const K = createRequire(import.meta.url)('./motion-kit.js');

const file = process.argv[2];
let sb; try { sb = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`cannot read ${file}: ${e.message}`); process.exit(2); }
const beats = sb.beats || [], dur = sb.duration || (beats.length ? beats[beats.length - 1].end : 0);
const issues = [], notes = [];
const fail = (rule, msg) => issues.push(`${rule}: ${msg}`);

if (beats.length < 2) fail('shape', 'a film needs at least two beats');
const lens = beats.map(b => b.end - b.t);
// rhythm: shot lengths vary (coefficient of variation at least 0.25) and differ by at least 4x across the film
const c = K.cv(lens);
if (beats.length >= 3 && c < 0.25) fail('rhythm', `beat lengths are a metronome (cv ${c.toFixed(2)}, want at least 0.25): ${lens.map(x => x.toFixed(2)).join(', ')} s`);
if (beats.length >= 4 && Math.max(...lens) / Math.min(...lens) < 4) notes.push(`longest beat is only ${(Math.max(...lens) / Math.min(...lens)).toFixed(1)}x the shortest (onetake asks for at least 4x in a multi-scene film)`);
// at least one designed rest, and rests are not the whole film
const rest = beats.filter(b => b.still).reduce((s, b) => s + (b.end - b.t), 0);
if (dur >= 8 && !beats.some(b => b.still)) fail('rest', 'no designed rest: rests are what make bursts land (mark one beat still: true)');
if (rest > 0.6 * dur) fail('rest', `${(100 * rest / dur).toFixed(0)}% of the film is marked still`);
// carries: every boundary names what survives it, unless it is a burst or the end card
beats.slice(0, -1).forEach((b, i) => {
  if (!b.cut) fail('carry', `beat ${i + 1} (${b.beat || '?'}) does not say how it hands off (cut: carry, anchor, burst, end-card or hard)`);
  else if (!['burst', 'end-card'].includes(b.cut) && !(b.carries && b.carries.trim())) fail('carry', `beat ${i + 1} (${b.beat || '?'}) to ${i + 2}: nothing carries across the boundary (name the object, or mark it burst)`);
  if (!(b.buys && b.buys.trim())) fail('buys', `beat ${i + 1} (${b.beat || '?'}) does not say what belief it buys`);
});
// reading time: every text stays fully readable for characters / 15 + 1.5 s (Latin script)
for (const [i, b] of beats.entries()) {
  if (!b.text) continue;
  if (/[؀-ۿ]/.test(b.text)) notes.push(`beat ${i + 1}: Arabic-script text; the reading-time formula in the research is for Latin and Chinese, check by eye`);
  const need = K.readTime(b.text), have = (b.readFrom !== undefined ? b.end - b.readFrom : b.end - b.t);
  if (have + 1e-9 < need) fail('reading time', `beat ${i + 1}: "${b.text.slice(0, 40)}" is on screen ${have.toFixed(2)} s, needs ${need.toFixed(2)} s`);
}
// opening and ending: the hook reads within 3 s; the end card holds 0.6 to 1.4 s of resolved picture
if (beats[0] && beats[0].t > 0.01) fail('opening', 'frame 0 must already be part of the film (the first beat starts at 0)');
const last = beats[beats.length - 1];
if (last && last.hold !== undefined && (last.hold > 1.4)) fail('end hold', `the last hold is ${last.hold} s; keep it at most 1.4 s (and something alive on it)`);
if (beats.length && beats[0].end > 3 && !beats[0].hookAt) notes.push('the first beat runs past 3 s: say when the hook reads (hookAt)');

console.log(`storyboard ${file}: ${beats.length} beats over ${dur} s, beat-length cv ${c.toFixed(2)}, rest ${(100 * rest / (dur || 1)).toFixed(0)}%`);
for (const n of notes) console.log(`note: ${n}`);
for (const x of issues) console.log(`FAIL ${x}`);
console.log(issues.length ? `GATE storyboard: FAIL (${issues.length})` : 'GATE storyboard: PASS');
process.exit(issues.length ? 1 : 0);
