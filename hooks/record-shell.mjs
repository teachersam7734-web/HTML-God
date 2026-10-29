// record-shell.mjs (PostToolUse: Bash, PowerShell): logs the deliverable files a shell command clearly wrote
// (redirection, sed -i, Set-Content, Out-File, cp, build and inline scripts with an output path; see
// lib/shell-writes.mjs for the list and its limits) as edits, so the Stop hook gate-claim asks for a gate after them
// too. Only files that exist after the command are logged, and only in a project with .sensei/profile.json. Never
// blocks and prints nothing.
import fs from 'node:fs';
import { readInput, projectDir, run } from '../lib/hookio.mjs';
import { shellWrites } from '../lib/shell-writes.mjs';
import { recordEdit } from '../lib/state.mjs';
import { loadProfile } from '../lib/profile.mjs';

run(async () => {
  const input = await readInput();
  const cmd = (input.tool_input || {}).command;
  if (!cmd) return;
  const dir = projectDir(input);
  if (!loadProfile({ projectDir: dir }).found) return;      // not an HTML-Sensei project: record nothing
  for (const f of shellWrites(cmd, input.cwd || dir)) if (fs.existsSync(f)) recordEdit(dir, input.session_id, f);
});
