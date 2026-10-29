// guard-licence.mjs (PreToolUse: Write, Edit, MultiEdit): refuses never-ship source code written into a plugin path,
// and ideas-only (onetake, no-licence repos, lygia, Shadertoy) code anywhere. Stricter in commercial licence mode.
import { readInput, projectDir, incomingText, toolFile, block, advise, run } from '../lib/hookio.mjs';
import { loadProfile } from '../lib/profile.mjs';
import { scanLicence } from '../lib/lint/licence.mjs';
import { result, formatResult } from '../lib/gate.mjs';

run(async () => {
  const input = await readInput();
  const ti = input.tool_input || {};
  const text = incomingText(input.tool_name, ti);
  if (!text) return;
  const file = toolFile(ti);
  const { profile } = loadProfile({ projectDir: projectDir(input), from: file });
  const found = scanLicence(text, { file, mode: profile.licence_mode });
  const blocks = found.filter(f => f.level === 'block');
  if (blocks.length) block(formatResult(result('guard-licence', file, blocks), { header: `HTML-Sensei guard-licence refused this write to ${file}:` }));
  const warns = found.filter(f => f.level !== 'block');
  if (warns.length) advise('PreToolUse', formatResult(result('guard-licence', file, warns)));
});
