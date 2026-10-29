// gate.mjs: the one result format every HTML-Sensei check speaks (lint hooks, guards, and sensei-verify's gate harness).
//
// Finding:  { id, level: 'block' | 'fail' | 'warn' | 'info', message, fix?, evidence?: string[], line? }
//           'block' stops a tool call (guards only); 'fail' is a serious defect that lint reports but never blocks;
//           'warn' is advice; 'info' is a note.
// Result:   { tool, target, at, verdict: 'pass' | 'warn' | 'fail', findings: Finding[] }
// Gate report (written by sensei-verify to .sensei/gate/<name>.json, read by the Stop hook gate-claim):
//           { gate, target, at, verdict, checks: [{ id, status: 'pass'|'fail'|'warn'|'skip'|'not-verified', detail }],
//             verified: string[], not_verified: string[],
//             optional: targets, outputs, sources: string[] (more files the report covers), kind: 'file',
//             freshness: { sha256 } (the target's hash when gated; a report that no longer matches is stale) }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function finding(id, level, message, extra = {}) {
  return { id, level, message, ...extra };
}

export function verdictOf(findings) {
  if (findings.some(f => f.level === 'block' || f.level === 'fail')) return 'fail';
  if (findings.some(f => f.level === 'warn')) return 'warn';
  return 'pass';
}

export function result(tool, target, findings) {
  return { tool, target, at: new Date().toISOString(), verdict: verdictOf(findings), findings };
}

export function lineOf(src, index) {
  if (index == null || index < 0) return undefined;
  let n = 1; for (let i = 0; i < index && i < src.length; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

// Plain text for Claude: one finding per paragraph, the fix spelled out.
export function formatResult(res, { max = 25, header } = {}) {
  const lines = [header || `${res.tool}: ${res.findings.length} finding(s) in ${res.target}`];
  for (const f of res.findings.slice(0, max)) {
    lines.push(`- ${f.level.toUpperCase()} ${f.id}${f.line ? ` (line ${f.line})` : ''}: ${f.message}`);
    if (f.fix) lines.push(`  fix: ${f.fix}`);
    for (const e of (f.evidence || []).slice(0, 3)) lines.push(`  seen: ${String(e).replace(/\s+/g, ' ').slice(0, 110)}`);
  }
  if (res.findings.length > max) lines.push(`(${res.findings.length - max} more not shown)`);
  return lines.join('\n');
}

export function gateDir(projectDir) { return path.join(projectDir, '.sensei', 'gate'); }

export function writeGateReport(projectDir, name, report) {
  const dir = gateDir(projectDir); fs.mkdirSync(dir, { recursive: true });
  const body = { gate: name, at: new Date().toISOString(), verified: [], not_verified: [], checks: [], ...report };
  if (!body.verdict) body.verdict = body.checks.some(c => c.status === 'fail') ? 'fail' : body.checks.some(c => c.status === 'warn') ? 'warn' : 'pass';
  const f = path.join(dir, `${String(name).replace(/[^\w.-]/g, '_')}.json`);
  fs.writeFileSync(f, JSON.stringify(body, null, 2) + '\n');
  return f;
}

// Newest gate report by file time, or null.
export function latestGateReport(projectDir) {
  const dir = gateDir(projectDir);
  if (!fs.existsSync(dir)) return null;
  let best = null;
  for (const n of fs.readdirSync(dir)) {
    if (!n.endsWith('.json')) continue;
    const f = path.join(dir, n); const st = fs.statSync(f);
    if (!best || st.mtimeMs > best.mtimeMs) best = { path: f, mtimeMs: st.mtimeMs };
  }
  if (best) { try { best.report = JSON.parse(fs.readFileSync(best.path, 'utf8')); } catch { best.report = null; } }
  return best;
}

// ---------- which deliverable a gate report covers (used by the Stop hook gate-claim) ----------
//
// A report covers a file when the file is the report's `target`, or is listed in its `targets`, `outputs` or
// `sources` arrays, or lies inside a folder the report names. Relative paths resolve against the project root; URLs
// cover nothing. A packed deliverable is linked to its source through `outputs` in .sensei/profile.json (or
// .sensei/state.json), a map from a source file or folder to the file(s) built from it, relative to the project:
//   "outputs": { "src/index.html": "dist/pol.html", "src/": ["dist/pol.html"] }
// so an edit to src/index.html is covered by a passing gate of dist/pol.html, but only when dist/pol.html was
// rebuilt after the edit. A page asset that is not a page itself (CSS, JS, shaders, JSON) is also covered by a
// report on a page whose folder contains it.
const key = p => { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };
const isUrl = p => /^[a-z][\w+.-]*:\/\//i.test(String(p)) && !/^file:/i.test(String(p));
const fromFileUrl = p => /^file:/i.test(String(p)) ? decodeURIComponent(String(p).replace(/^file:\/\/\/?/i, process.platform === 'win32' ? '' : '/')) : String(p);
export const PAGE = /\.(?:html?|svg)$/i;

export function reportPaths(report, projectDir) {
  if (!report) return [];
  const list = [report.target, ...[].concat(report.targets || [], report.outputs || [], report.sources || [])];
  return list.filter(p => typeof p === 'string' && p && !isUrl(p)).map(p => path.resolve(projectDir, fromFileUrl(p)));
}

const within = (file, dir) => { const f = key(file), d = key(dir); return f === d || f.startsWith(d.endsWith(path.sep) ? d : d + path.sep); };
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

export function reportCovers(report, file, projectDir, { assetByFolder = false } = {}) {
  for (const p of reportPaths(report, projectDir)) {
    if (key(p) === key(file)) return true;
    if (isDir(p) && within(file, p)) return true;
    if (assetByFolder && PAGE.test(p) && within(file, path.dirname(p))) return true;
  }
  return false;
}

// Source file -> packed outputs, from profile.outputs and .sensei/state.json outputs.
export function outputsFor(file, projectDir, profile = {}) {
  const maps = [profile && profile.outputs];
  try { maps.push(JSON.parse(fs.readFileSync(path.join(projectDir, '.sensei', 'state.json'), 'utf8')).outputs); } catch { /* no state file */ }
  const out = [];
  for (const m of maps) {
    if (!m || typeof m !== 'object') continue;
    for (const [src, dst] of Object.entries(m)) {
      const s = path.resolve(projectDir, src);
      if (key(s) === key(file) || ((/[\\/]$/.test(src) || isDir(s)) && within(file, s))) for (const d of [].concat(dst)) if (typeof d === 'string') out.push(path.resolve(projectDir, d));
    }
  }
  return [...new Set(out)];
}

// A report whose file hash no longer matches its target (the target changed after the gate) does not count.
export function hashMatches(report, projectDir) {
  if (!report || report.kind !== 'file' || !report.freshness || !report.freshness.sha256 || !report.target || isUrl(report.target)) return true;
  const t = path.resolve(projectDir, fromFileUrl(report.target));
  try { return crypto.createHash('sha256').update(fs.readFileSync(t)).digest('hex') === report.freshness.sha256; } catch { return false; }
}

// Every gate report written after `after` (ms), parsed. A quick passing run
// must not hide a fuller failing one written in the same round of work, so the
// Stop hook judges all fresh reports, not just the newest.
export function freshGateReports(projectDir, after) {
  const dir = gateDir(projectDir);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    if (!n.endsWith('.json')) continue;
    const f = path.join(dir, n); let st; try { st = fs.statSync(f); } catch { continue; }
    if (st.mtimeMs < after) continue;
    let report = null; try { report = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* unreadable */ }
    out.push({ path: f, mtimeMs: st.mtimeMs, report });
  }
  return out;
}
