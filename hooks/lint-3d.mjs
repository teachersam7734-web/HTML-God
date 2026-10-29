// lint-3d.mjs (PostToolUse on web files that use WebGL or WebGPU): the 3D lane's rules, ported from lint3d.mjs
// (transposed matrix multiply, context loss, pixel-ratio cap, pause when hidden, Draco from a CDN, playsinline and the
// rest). Never blocks. no-cdn is reported by lint-web and random-in-seek-page by lint-determinism.
import fs from 'node:fs';
import path from 'node:path';
import { readInput, projectDir, toolFile, advise, run } from '../lib/hookio.mjs';
import { loadProfile } from '../lib/profile.mjs';
import { lintThree, uses3D } from '../lib/lint/three.mjs';
import { isWebFile } from '../lib/lint/common.mjs';
import { result, formatResult } from '../lib/gate.mjs';

run(async () => {
  const input = await readInput();
  const file = toolFile(input.tool_input);
  if (!isWebFile(file) || /[\\/]node_modules[\\/]/.test(file) || !fs.existsSync(file)) return;
  if (!loadProfile({ projectDir: projectDir(input), from: file }).found) return;   // not an HTML-Sensei project: stay silent
  const src = fs.readFileSync(file, 'utf8');
  if (!uses3D(src)) return;
  const res = result('lint-3d', file, lintThree(src, { skip: ['no-cdn', 'random-in-seek-page'] }));
  if (!res.findings.length) return;
  advise('PostToolUse', formatResult(res, { header: `HTML-Sensei lint-3d, ${res.findings.length} finding(s) in ${file} (warnings, not blocking):` }),
    `lint-3d: ${res.findings.length} finding(s) in ${path.basename(file)}`);
});
