// guard-process.mjs (PreToolUse: Bash, PowerShell): refuses killing browsers by image name, paid generation without
// an approved plan hash, and esbuild bundles of three.js loaders without the import.meta.url define.
import { readInput, projectDir, block, run } from '../lib/hookio.mjs';
import { scanProcess } from '../lib/lint/process.mjs';
import { result, formatResult } from '../lib/gate.mjs';

run(async () => {
  const input = await readInput();
  const cmd = (input.tool_input || {}).command;
  if (!cmd) return;
  const dir = projectDir(input);
  const found = scanProcess(cmd, { projectDir: dir, cwd: input.cwd || dir });
  if (found.length) block(formatResult(result('guard-process', `${input.tool_name} command`, found), { header: 'HTML-Sensei guard-process refused this command:' }));
});
