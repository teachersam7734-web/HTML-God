// state.mjs: small per-session state shared between hooks (edit log, line-ending snapshots, stop-gate marks).
// Lives in ${CLAUDE_PLUGIN_DATA}/state (kept across plugin updates), else the OS temp folder, never in the
// user's project, so a project that has not opted in to HTML-Sensei gets no new files.
// Hooks for one event run in parallel, so every record is its own small file or an appended line.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
const norm = p => path.resolve(p).replace(/\\/g, '/').toLowerCase();

export function stateRoot() {
  const base = process.env.CLAUDE_PLUGIN_DATA ? path.join(process.env.CLAUDE_PLUGIN_DATA, 'state') : path.join(os.tmpdir(), 'html-sensei-state');
  fs.mkdirSync(base, { recursive: true });
  return base;
}

export function sessionDir(projectDir, sessionId) {
  const d = path.join(stateRoot(), hash(norm(projectDir)), String(sessionId || 'no-session').replace(/[^\w.-]/g, '_'));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function recordEdit(projectDir, sessionId, file) {
  const line = JSON.stringify({ file: path.resolve(file), at: Date.now() }) + '\n';
  fs.appendFileSync(path.join(sessionDir(projectDir, sessionId), 'edits.jsonl'), line);
}

export function readEdits(projectDir, sessionId) {
  const f = path.join(sessionDir(projectDir, sessionId), 'edits.jsonl');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

export function putRecord(projectDir, sessionId, kind, key, value) {
  fs.writeFileSync(path.join(sessionDir(projectDir, sessionId), `${kind}-${hash(norm(key))}.json`), JSON.stringify(value));
}

export function getRecord(projectDir, sessionId, kind, key) {
  const f = path.join(sessionDir(projectDir, sessionId), `${kind}-${hash(norm(key))}.json`);
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

// Remove session folders untouched for more than `days` (called by the SessionStart probe).
export function prune(days = 7) {
  const root = stateRoot(); const cutoff = Date.now() - days * 864e5;
  for (const p of fs.readdirSync(root)) {
    const pd = path.join(root, p);
    try {
      for (const s of fs.readdirSync(pd)) {
        const sd = path.join(pd, s);
        if (fs.statSync(sd).mtimeMs < cutoff) fs.rmSync(sd, { recursive: true, force: true });
      }
      if (!fs.readdirSync(pd).length) fs.rmdirSync(pd);
    } catch { /* another session may be writing; skip */ }
  }
}
