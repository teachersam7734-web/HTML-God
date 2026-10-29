// keep-eol.mjs (PreToolUse and PostToolUse: Write, Edit, MultiEdit): reports when a write changed a file's line endings
// (or dropped its BOM) and gives the command that restores them. Never blocks, never rewrites on its own.
// PreToolUse records the original style; PostToolUse compares and logs the edit for the Stop gate (gate-claim).
import fs from 'node:fs';
import path from 'node:path';
import { readInput, projectDir, toolFile, advise, pluginRoot, run } from '../lib/hookio.mjs';
import { detect } from '../lib/eol.mjs';
import { putRecord, getRecord, recordEdit } from '../lib/state.mjs';

run(async () => {
  const input = await readInput();
  const file = toolFile(input.tool_input);
  if (!file) return;
  const dir = projectDir(input); const sid = input.session_id;
  if (input.hook_event_name === 'PreToolUse') {
    if (fs.existsSync(file)) putRecord(dir, sid, 'eol', file, detect(fs.readFileSync(file)));
    return;
  }
  if (!fs.existsSync(file)) return;
  recordEdit(dir, sid, file);
  const before = getRecord(dir, sid, 'eol', file);
  if (!before) return;                     // a new file: nothing to preserve (new files are LF)
  const after = detect(fs.readFileSync(file));
  const changed = ['lf', 'crlf'].includes(before.style) && after.style !== before.style && after.style !== 'none';
  const lostBom = before.bom && !after.bom;
  putRecord(dir, sid, 'eol', file, after);
  if (!changed && !lostBom) return;
  const tool = path.join(pluginRoot(), 'lib', 'eol.mjs').replace(/\\/g, '/');
  const parts = [];
  if (changed) parts.push(`line endings changed from ${before.style.toUpperCase()} to ${after.style.toUpperCase()} (crlf ${after.crlf}, lf ${after.lf}). Restore with: node "${tool}" --to ${before.style} "${file}"`);
  if (lostBom) parts.push('the UTF-8 byte-order mark was removed; restore it if the file\'s consumers need it.');
  advise('PostToolUse', `HTML-Sensei keep-eol: in ${file}, ${parts.join(' Also, ')}`, `keep-eol: ${path.basename(file)} line endings changed`);
});
