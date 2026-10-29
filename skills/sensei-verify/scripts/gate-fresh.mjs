#!/usr/bin/env node
// gate-fresh.mjs: is the last gate report newer than the work it covers? Run it before writing "done".
//
//   node gate-fresh.mjs [report.json | project-dir] [--hook]
//
// With no argument it reads the newest report in <CLAUDE_PROJECT_DIR or cwd>/.sensei/gate/ (the same file the Stop
// hook gate-claim.mjs reads). Exit 0 and "fresh" when the verdict is pass or warn and nothing in the target changed
// since the gate saw it (sha256 for a file, newest mtime for a folder; a URL cannot be checked and says so).
// Exit 1 and "STALE" otherwise, with the reason.
// --hook speaks the Stop-hook protocol ({"decision":"block","reason":...} on stdout, nothing when fine) and honours
// stop_hook_active so it can never loop. Inside the plugin the real Stop hook is hooks/gate-claim.mjs; --hook is for
// a project that wires its own hooks.
//
// Stricter than the plugin's Stop hook in one way: gate-claim compares the report's time with the last edit; this
// compares the content hash, so a file touched without a change stays fresh and a file changed by another tool
// (a build step, a formatter) is caught even when no edit was recorded.
//
// verified: Node 24 on Windows 10, by test-gate.mjs (fresh after a passing run, stale after the page changes,
//           stale on a failing report, missing report).
// not verified: macOS and Linux file times (standard fs.statSync).
// Origin: code-engineering/gate-fresh.mjs in the HTML-Sensei build project's research notes (not shipped), adapted to the plugin's report location and verdicts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), hook = args.includes('--hook');
const given = args.find(a => !a.startsWith('--'));

function newest(dir, limit = 5000) { let n = 0, m = 0; const st = [dir]; while (st.length && n < limit) { const d = st.pop(); for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name.startsWith('.')) continue; const p = path.join(d, e.name); if (e.isDirectory()) st.push(p); else { n++; m = Math.max(m, fs.statSync(p).mtimeMs); } } } return m; }

export function findReport(arg) {
  if (arg && fs.existsSync(arg) && fs.statSync(arg).isFile()) return arg;
  const dir = path.join(path.resolve(arg || process.env.CLAUDE_PROJECT_DIR || process.cwd()), '.sensei', 'gate');
  if (!fs.existsSync(dir)) return null;
  let best = null;
  for (const n of fs.readdirSync(dir)) {
    if (!n.endsWith('.json')) continue;
    const f = path.join(dir, n), t = fs.statSync(f).mtimeMs;
    if (!best || t > best.t) best = { f, t };
  }
  return best && best.f;
}

export function freshness(file) {
  if (!file || !fs.existsSync(file)) return { ok: false, why: 'no gate report found (run scripts/sensei-gate.mjs or scripts/verify.mjs first)' };
  let s; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { ok: false, why: `report is not valid JSON: ${e.message}` }; }
  if (s.verdict === 'fail') return { ok: false, why: `the last gate FAILED: ${(s.failing || (s.checks || []).filter(c => c.status === 'fail')).map(f => f.id).join(', ') || 'see report'}` };
  if (s.verdict !== 'pass' && s.verdict !== 'warn') return { ok: false, why: `unknown verdict "${s.verdict}"` };
  if (s.kind === 'url') return { ok: true, why: 'URL target: freshness cannot be checked, only the verdict' };
  if (!s.freshness || !s.target) return { ok: true, why: `verdict ${s.verdict}; this report carries no content hash, so only its time can be compared (the Stop hook does that)` };
  if (!fs.existsSync(s.target)) return { ok: false, why: 'gate target no longer exists: ' + s.target };
  if (s.kind === 'file') {
    const now = crypto.createHash('sha256').update(fs.readFileSync(s.target)).digest('hex');
    if (now !== s.freshness.sha256) return { ok: false, why: 'the file changed after the last gate run; run the gate again' };
  } else if (newest(s.target) > s.freshness.newestSourceMtimeMs + 1) return { ok: false, why: 'files in the folder changed after the last gate run; run the gate again' };
  return { ok: true, why: `gate ${s.verdict} at ${s.finishedAt || s.at}, nothing changed since` };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let stdin = ''; if (hook) { try { stdin = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ } }
  const report = findReport(given);
  const v = freshness(report);
  if (hook) {
    let input = {}; try { input = JSON.parse(stdin || '{}'); } catch { /* not JSON */ }
    if (!v.ok && !input.stop_hook_active) console.log(JSON.stringify({ decision: 'block', reason: 'Verification gate: ' + v.why }));
    process.exit(0);
  }
  console.log((v.ok ? 'fresh: ' : 'STALE: ') + v.why + (report ? `\nreport: ${report}` : ''));
  process.exit(v.ok ? 0 : 1);
}
