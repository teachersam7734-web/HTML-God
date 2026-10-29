// lint-web.mjs (PostToolUse: Write, Edit, MultiEdit on web files): reduced motion per animation system,
// transition: all, smooth scroll on html, unguarded scroll-driven and View Transition features, cursor: none without a
// hover query, drag without keys, toasts without a live region, network references when the profile is offline,
// vendored code without a notice. Warns with fixes; never blocks. Silent in a project with no .sensei/profile.json.
import fs from 'node:fs';
import path from 'node:path';
import { readInput, projectDir, toolFile, advise, run } from '../lib/hookio.mjs';
import { loadProfile } from '../lib/profile.mjs';
import { lintWeb } from '../lib/lint/web.mjs';
import { isWebFile } from '../lib/lint/common.mjs';
import { result, formatResult } from '../lib/gate.mjs';

run(async () => {
  const input = await readInput();
  const file = toolFile(input.tool_input);
  if (!isWebFile(file) || /[\\/]node_modules[\\/]/.test(file) || !fs.existsSync(file)) return;
  // A project that has not opted in (no .sensei/profile.json) gets nothing: plugin hooks run in every project, and a
  // backend's API calls are not offline-page failures. The SessionStart probe says once that the profile is missing.
  const { profile, found } = loadProfile({ projectDir: projectDir(input), from: file });
  if (!found) return;
  const res = result('lint-web', file, lintWeb(fs.readFileSync(file, 'utf8'), { file, profile }));
  if (!res.findings.length) return;
  advise('PostToolUse', formatResult(res, { header: `HTML-Sensei lint-web, ${res.findings.length} finding(s) in ${file} (warnings, not blocking; fix before release):` }),
    `lint-web: ${res.findings.length} finding(s) in ${path.basename(file)}`);
});
