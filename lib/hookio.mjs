// hookio.mjs: the stdin and exit-code contract every HTML-Sensei hook shares.
// Contract (Claude Code hooks reference, code.claude.com/docs/en/hooks):
//   stdin  one JSON object: session_id, transcript_path, cwd, hook_event_name, plus per-event fields
//          (PreToolUse/PostToolUse: tool_name, tool_input, tool_response; Stop: stop_hook_active, last_assistant_message).
//   exit 0 success; stdout, when it is one JSON object, is read as hook output.
//   exit 2 blocking error on events that can block; stderr is the reason Claude sees.
//   other  non-blocking error; the user sees the first line of stderr and the work continues.
// A bug inside a hook must never block the user's work, so run() turns any crash into exit 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function readInput() {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { _unparsed: raw }; }
}

export function projectDir(input = {}) {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

export function pluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT
    ? path.resolve(process.env.CLAUDE_PLUGIN_ROOT)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

// Text the tool is about to write (PreToolUse) for Write, Edit and MultiEdit.
export function incomingText(toolName, ti = {}) {
  if (toolName === 'Write') return String(ti.content ?? '');
  if (toolName === 'Edit') return String(ti.new_string ?? '');
  if (toolName === 'MultiEdit') return (ti.edits || []).map(e => String(e.new_string ?? '')).join('\n');
  return '';
}

export function toolFile(ti = {}) { return ti.file_path ? path.resolve(String(ti.file_path)) : null; }

// Exit 2 with an actionable message (PreToolUse: the call is denied; Stop: Claude keeps working).
export function block(message) {
  writeNow(2, String(message).trimEnd() + '\n');
  process.exit(2);
}

// Non-blocking feedback that reaches Claude as a system reminder, plus a short line for the user.
export function advise(eventName, context, userLine) {
  const out = { hookSpecificOutput: { hookEventName: eventName, additionalContext: String(context).slice(0, 9500) } };
  if (userLine) out.systemMessage = userLine;
  writeNow(1, JSON.stringify(out));
  process.exit(0);
}

export function pass() { process.exit(0); }

// Synchronous write to the file descriptor, so nothing is lost when process.exit follows (pipes are asynchronous on
// some platforms).
export function writeNow(fd, text) {
  const buf = Buffer.from(text, 'utf8'); let off = 0;
  while (off < buf.length) { try { off += fs.writeSync(fd, buf, off); } catch (e) { if (e.code !== 'EAGAIN') throw e; } }
}

export function run(main) {
  Promise.resolve().then(main).then(() => process.exit(0), err => {
    writeNow(2, `[html-sensei] hook error (work continues): ${err && err.stack || err}\n`);
    process.exit(1);
  });
}
