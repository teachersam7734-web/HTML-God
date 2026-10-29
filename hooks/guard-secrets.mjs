// guard-secrets.mjs (PreToolUse: Write, Edit, MultiEdit, Bash, PowerShell): refuses API keys or tokens written into
// files, and commands that would print them (echo $X_API_KEY, printenv, cat .env ...).
import { readInput, incomingText, toolFile, block, run } from '../lib/hookio.mjs';
import { scanText, scanCommand } from '../lib/lint/secrets.mjs';
import { result, formatResult } from '../lib/gate.mjs';

run(async () => {
  const input = await readInput();
  const tn = input.tool_name; const ti = input.tool_input || {};
  const isShell = tn === 'Bash' || tn === 'PowerShell';
  const found = isShell ? scanCommand(ti.command) : scanText(incomingText(tn, ti));
  if (found.length) block(formatResult(result('guard-secrets', isShell ? `${tn} command` : toolFile(ti), found),
    { header: `HTML-Sensei guard-secrets refused this ${isShell ? 'command' : 'write'} (values are redacted here):` }));
});
