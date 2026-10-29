// pw.mjs: launch headless Chromium through Playwright for the audio tests. No machine path is written here.
// Order: env CHROME (browser executable) and PW or PLAYWRIGHT_PATH (a playwright or playwright-core package folder);
// then the plugin's lib/discover.mjs (through CLAUDE_PLUGIN_ROOT, or relative to this file inside the plugin);
// then playwright resolved from the current folder.
// verified: Windows 10, Node 24, Playwright 1.63 found by lib/discover.mjs, Chrome 155; every audio test passes with
//           strict file:// (no --allow-file-access-from-files).
// not verified: macOS and Linux.
// Original code of this project (the same discovery order as sensei-3d's browser.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
async function discover() {
  for (const r of [process.env.CLAUDE_PLUGIN_ROOT, path.resolve(HERE, '../../..')].filter(Boolean)) {
    const f = path.join(r, 'lib', 'discover.mjs');
    if (fs.existsSync(f)) { try { return await import(pathToFileURL(f).href); } catch { /* next */ } }
  }
  return null;
}
function resolveFrom(dir) {
  for (const mod of ['playwright', 'playwright-core']) {
    try {
      const pj = path.join(dir, 'package.json');
      if (fs.existsSync(pj) && JSON.parse(fs.readFileSync(pj, 'utf8')).name === mod) return pathToFileURL(createRequire(pj).resolve(path.resolve(dir))).href;
      return pathToFileURL(createRequire(path.join(dir, 'noop.js')).resolve(mod)).href;
    } catch { /* next */ }
  }
  return null;
}
// Strict file:// by default, as a double-click opens the page; { lenientFile: true } adds
// --allow-file-access-from-files for unpacked work in progress only (it hides failures a single file must not have).
export async function launch({ args = [], lenientFile = false } = {}) {
  const d = await discover();
  let pw = process.env.PW || process.env.PLAYWRIGHT_PATH ? resolveFrom(process.env.PW || process.env.PLAYWRIGHT_PATH) : null;
  if (!pw && d) { const r = d.findPlaywright(process.cwd()); if (r.found) pw = r.importUrl; }
  if (!pw) pw = resolveFrom(process.cwd());
  if (!pw) throw new Error('Playwright not found: set PW to a playwright or playwright-core folder, or npm i -D playwright here.');
  let chrome = process.env.CHROME || null;
  if (!chrome && d) { const c = d.findChrome(); if (c.found) chrome = c.path; }
  const mod = await import(pw); const chromium = mod.chromium || (mod.default && mod.default.chromium);
  return chromium.launch({ executablePath: chrome || undefined, args: [...(lenientFile ? ['--allow-file-access-from-files'] : []), ...args] });
}
export const fileUrl = f => pathToFileURL(path.resolve(f)).href;
// ffmpeg: FFMPEG or FFMPEG_PATH (or FFMPEG_BIN), then lib/discover.mjs. Never a hard-coded path.
export async function ffmpeg() {
  const env = process.env.FFMPEG || process.env.FFMPEG_PATH || process.env.FFMPEG_BIN;
  if (env) return env;
  const d = await discover(); if (d) { const r = d.findFfmpeg(); if (r.found) return r.path; }
  return null;
}
