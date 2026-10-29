// probe.mjs (SessionStart): in a project with a .sensei folder, finds Node, a Chromium-family browser, Playwright,
// ffmpeg, Blender and uv, writes .sensei/env.json and tells Claude what is available and whether the profile exists.
// In any other project it says one short line (no profile, lint hooks silent) and runs no discovery. Never blocks.
import fs from 'node:fs';
import path from 'node:path';
import { readInput, projectDir, advise, run } from '../lib/hookio.mjs';
import { discoverAll, summarise } from '../lib/discover.mjs';
import { loadProfile, DEFAULTS } from '../lib/profile.mjs';
import { prune } from '../lib/state.mjs';

run(async () => {
  const input = await readInput();
  const dir = projectDir(input);
  try { prune(7); } catch { /* best effort */ }
  const senseiDir = path.join(dir, '.sensei');
  // A project that has not opted in gets one short line, no tool discovery and no file anywhere: the plugin's hooks
  // run in every project once installed, and most of them are not HTML-Sensei projects.
  if (!fs.existsSync(senseiDir)) {
    advise('SessionStart', 'HTML-Sensei: Profile: none (no .sensei/profile.json in this project), so its lint hooks stay silent here; run /sensei-start to opt an HTML project in.');
  }
  const envFile = path.join(senseiDir, 'env.json');
  let cache = null; try { cache = JSON.parse(fs.readFileSync(envFile, 'utf8')); } catch { /* first run */ }
  const env = discoverAll({ projectDir: dir, cache });
  fs.writeFileSync(envFile, JSON.stringify(env, null, 2) + '\n');
  const { found, path: pp, warnings } = loadProfile({ projectDir: dir });
  const lines = ['HTML-Sensei probe (tools found on this machine; judge quality by the target device, not by this one):', summarise(env)];
  if (found) lines.push(`Profile: ${path.relative(dir, pp) || pp}${warnings.length ? ` (problems: ${warnings.join('; ')})` : ''}`);
  else lines.push(`Profile: none (.sensei/profile.json missing${warnings.length ? `; ${warnings.join('; ')}` : ''}), so the lint hooks stay silent until one exists. Run /sensei-start to write one (the defaults it starts from: ${JSON.stringify(DEFAULTS)}).`);
  lines.push(`Environment record: ${envFile}`);
  advise('SessionStart', lines.join('\n'));
});
