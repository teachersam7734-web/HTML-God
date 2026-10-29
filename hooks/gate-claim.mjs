// gate-claim.mjs (Stop): evidence before claims. When a sentence of the reply says the work is done, but a deliverable
// edited this session has no fresh passing gate report that covers it, or, for a film, no MP4 and no contact sheet
// newer than the last edit, Claude is sent back to run the gate.
//
// Claims are judged per sentence: "The page is finished. The email sending is not done yet." is a claim (the second
// sentence negates only itself); "I have done the hero; next I will build the form." is a progress note.
//
// Coverage (lib/gate.mjs reportCovers): a report covers an edited file when its target (or a file in its targets,
// outputs or sources) is that file or a folder holding it, or when the file is a source whose packed output (the
// profile's "outputs" map, e.g. { "src/index.html": "dist/pol.html" }) was rebuilt after the edit and gated. The
// report must be written after that file's last edit and, when it carries a content hash, still match its target.
// CSS, JS and other assets are also covered by a report on a page in a folder above them.
//
// Blocks once per set of edits (stop_hook_active and a per-session mark stop it looping). In a project with no
// .sensei/profile.json it only tells the user, because plugin hooks run in every project.
import fs from 'node:fs';
import path from 'node:path';
import { readInput, projectDir, block, writeNow, run } from '../lib/hookio.mjs';
import { loadProfile } from '../lib/profile.mjs';
import { freshGateReports, reportCovers, outputsFor, hashMatches, PAGE } from '../lib/gate.mjs';
import { readEdits, getRecord, putRecord } from '../lib/state.mjs';

const DELIVERABLE = /\.(?:html?|css|m?js|cjs|jsx|tsx?|svelte|vue|glsl|frag|vert|wgsl|svg|json)$/i;

// A sentence that says the work is done. "complete" counts as a state (is complete, now complete), not the verb.
const CLAIM = new RegExp([
  String.raw`\b(?:done|finished|all set|shipped|delivered|good to go|ready)\b`,
  String.raw`\b(?:it'?s|it is|is|are|now|went|gone) live\b`,
  String.raw`(?:^|\b(?:is|are|now|fully|been|was|all|feature)\s+)complete(?:d)?\b`,
  String.raw`\b(?:it|this|that|everything|all|page|site|form|switch|deck|film|game|build)\s+(?:now\s+|all\s+)?works\b`,
  String.raw`\bworks\s+(?:now|fine|correctly|perfectly|everywhere|as (?:expected|intended))\b`,
  String.raw`\beverything (?:works|passes|passed)\b`,
  String.raw`\ball(?:\s+\d+)?\s+(?:of\s+the\s+)?(?:\w+\s+)?(?:tests|checks|gates|steps)\s+(?:now\s+)?pass(?:ed|es)?\b`,
  String.raw`\b(?:every|each) (?:check|test|gate|step) pass(?:ed|es)?\b`,
  String.raw`\b\d+\s*/\s*\d+\s+(?:tests|checks)\s+pass(?:ed|es)?\b`,
].join('|'), 'i');
// Words just before the claim that turn it into a negation, a condition or a plan.
const NEG_BEFORE = /\b(?:not|never|no longer|nothing|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|won't|can't|cannot|couldn't|doesn't|don't|didn't|yet to|before|until|once|when|whenever|if|after|will|would|should|could|might|almost|nearly|how|until)\b[^.!?]{0,30}$/i;
// Sentences that report progress or a plan, not completion.
const PROGRESS = /\b(?:next|then I(?:'ll| will)|so far|still (?:to|need|have to)|is in progress|work in progress)\b/i;

export function claimSentences(text) {
  const plain = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' x ');
  const sentences = plain.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  return sentences.filter(s => {
    if (/\?\s*$/.test(s) || PROGRESS.test(s)) return false;
    const re = new RegExp(CLAIM.source, 'gi'); let m;
    while ((m = re.exec(s))) {
      if (!NEG_BEFORE.test(s.slice(0, m.index))) return true;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return false;
  });
}

function lastAssistantText(input) {
  if (typeof input.last_assistant_message === 'string') return input.last_assistant_message;
  try {
    const lines = fs.readFileSync(input.transcript_path, 'utf8').trim().split('\n').reverse();
    for (const l of lines) {
      const e = JSON.parse(l); const m = e.message || e;
      if ((e.type || m.role) !== 'assistant') continue;
      const c = m.content; const t = typeof c === 'string' ? c : (c || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
      if (t) return t;
    }
  } catch { /* no transcript */ }
  return '';
}

function newestMatching(dir, test, after, { depth = 5, budget = 8000 } = {}) {
  let n = 0;
  const walk = (d, level) => {
    if (level > depth || n > budget) return null;
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return null; }
    for (const e of entries) {
      if (++n > budget) return null;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!/^(?:node_modules|\.git|\.cache|dist-cache)$/.test(e.name)) { const r = walk(p, level + 1); if (r) return r; } }
      else if (test(e.name, p)) { try { if (fs.statSync(p).mtimeMs > after) return p; } catch { /* gone */ } }
    }
    return null;
  };
  return walk(dir, 0);
}

run(async () => {
  const input = await readInput();
  if (input.stop_hook_active) return;
  const claims = claimSentences(lastAssistantText(input));
  if (!claims.length) return;
  const dir = projectDir(input); const sid = input.session_id;
  // A file time in the future (a clock that moved back, an extracted archive) would make every report look stale
  // for ever, so cap file times at now.
  const now = Date.now();
  const mtime = f => { try { return Math.min(fs.statSync(f).mtimeMs, now); } catch { return 0; } };
  const lastBy = new Map();
  for (const e of readEdits(dir, sid)) {
    if (!DELIVERABLE.test(e.file) || /[\\/]\.sensei[\\/]/.test(e.file) || !fs.existsSync(e.file)) continue;
    const t = Math.max(Math.min(e.at, now), mtime(e.file));
    lastBy.set(e.file, Math.max(lastBy.get(e.file) || 0, t));
  }
  if (!lastBy.size) return;
  const lastEdit = Math.max(...lastBy.values());
  const { profile, found } = loadProfile({ projectDir: dir });
  const reasons = [];
  if (profile.deliverable === 'film') {
    if (!newestMatching(dir, n => /\.mp4$/i.test(n) && !/\.part\.mp4$/i.test(n), lastEdit)) reasons.push('no MP4 newer than the last edit to the film source');
    if (!newestMatching(dir, n => /contact|sheet/i.test(n) && /\.(?:png|jpe?g|webp)$/i.test(n), lastEdit)) reasons.push('no contact sheet newer than the last edit');
  } else {
    const reports = freshGateReports(dir, 0);
    if (!reports.length) reasons.push('no gate report in .sensei/gate/');
    else {
      const rel = f => path.relative(dir, f) || f;
      for (const [file, at] of lastBy) {
        const asset = !PAGE.test(file);
        const outputs = outputsFor(file, dir, profile);
        // Direct coverage first, then each packed output (which must itself be newer than the edit).
        const targets = [{ file, after: at }, ...outputs.map(o => ({ file: o, after: at, output: true }))];
        let ok = false; const why = [];
        for (const t of targets) {
          if (t.output && !fs.existsSync(t.file)) continue;            // not packed yet: only direct coverage counts
          if (t.output && mtime(t.file) < at) { why.push(`${rel(t.file)} was not rebuilt after ${rel(file)} changed (pack it again, then gate it)`); continue; }
          const cov = reports.filter(r => r.report && reportCovers(r.report, t.file, dir, { assetByFolder: asset && !t.output }));
          const fresh = cov.filter(r => r.mtimeMs >= t.after && hashMatches(r.report, dir));
          const failed = fresh.filter(r => r.report.verdict === 'fail');
          if (failed.length) { why.push(`a gate report written since the last edit failed (${failed.map(r => path.basename(r.path)).join(', ')})`); ok = false; break; }
          if (fresh.some(r => r.report.verdict === 'pass' || r.report.verdict === 'warn')) { ok = true; break; }
          if (cov.length) why.push(`the newest gate report covering ${rel(t.file)} (${path.basename(cov.sort((a, b) => b.mtimeMs - a.mtimeMs)[0].path)}) is older than the last edit or no longer matches the file`);
        }
        if (!ok) {
          if (!why.length) {
            const newest = reports.slice().sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
            why.push(`no gate report covers ${rel(file)}${outputs.length ? ` or its packed output ${outputs.map(rel).join(', ')}` : ''} (the newest, ${path.basename(newest.path)}, is for ${newest.report && newest.report.target || 'an unknown target'})`);
          }
          reasons.push(`${rel(file)}: ${[...new Set(why)].join('; ')}`);
        }
      }
    }
  }
  if (!reasons.length) return;
  const mark = getRecord(dir, sid, 'stopgate', 'last');
  if (mark && mark.lastEdit === lastEdit) return;           // once per set of edits
  putRecord(dir, sid, 'stopgate', 'last', { lastEdit, at: Date.now() });
  const files = [...lastBy.keys()].map(f => path.relative(dir, f) || f).slice(0, 6).join(', ');
  const claim = claims[0].length > 100 ? claims[0].slice(0, 97) + '...' : claims[0];
  const msg = `HTML-Sensei gate-claim: the reply says the work is done ("${claim}"), but ${reasons.slice(0, 6).join('; and ')} (edited this session: ${files}).\n` +
    (profile.deliverable === 'film'
      ? 'Render the film to an MP4 and make a contact sheet from it, look at them, then report what was verified and what was not.'
      : 'Run the gate harness on the deliverable you changed (/sensei-gate <file>, or the packed file when the source is packed; list a source to packed-file link under "outputs" in .sensei/profile.json) so it writes .sensei/gate/<name>.json, read it, fix any failure, then report what was verified and what was not. If a check cannot run on this machine, say so in the report rather than claiming it.');
  if (!found) { writeNow(1, JSON.stringify({ systemMessage: msg + ' (No .sensei/profile.json, so this is a note, not a block.)' })); return; }
  block(msg);
});
