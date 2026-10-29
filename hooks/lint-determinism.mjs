// lint-determinism.mjs (PostToolUse on web files with window.seek, __seek or renderFrame): Date.now, unseeded random,
// timers, free-running CSS animation and media in a page that must render frame N identically every time. Never blocks.
import fs from 'node:fs';
import path from 'node:path';
import { readInput, projectDir, toolFile, advise, run } from '../lib/hookio.mjs';
import { loadProfile } from '../lib/profile.mjs';
import { lintDeterminism } from '../lib/lint/determinism.mjs';
import { isWebFile } from '../lib/lint/common.mjs';
import { result, formatResult } from '../lib/gate.mjs';

run(async () => {
  const input = await readInput();
  const file = toolFile(input.tool_input);
  if (!isWebFile(file) || /[\\/]node_modules[\\/]/.test(file) || !fs.existsSync(file)) return;
  if (!loadProfile({ projectDir: projectDir(input), from: file }).found) return;   // not an HTML-Sensei project: stay silent
  const res = result('lint-determinism', file, lintDeterminism(fs.readFileSync(file, 'utf8')));
  if (!res.findings.length) return;
  advise('PostToolUse', formatResult(res, { header: `HTML-Sensei lint-determinism, seek contract broken in ${file} (warnings, not blocking; the render will differ between runs):` }),
    `lint-determinism: ${res.findings.length} finding(s) in ${path.basename(file)}`);
});
