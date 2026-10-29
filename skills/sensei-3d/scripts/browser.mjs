// browser.mjs: launch headless Chromium with a software GL for 3D, WebGL and shader pages. Shared by shot.mjs and
// gate3d.mjs (this folder) and by the sensei-holograms and sensei-shaders-vfx scripts.
//
// verified: Windows 10, Node 24, Playwright 1.63 found in the npx cache by the plugin's lib/discover.mjs, installed
//           Chrome 155 with SwiftShader; pages rendered, rAF ran, reduced motion and context loss emulated.
// not verified: macOS and Linux (the discovery code covers them; not run there); a real GPU (SwiftShader only).
//
// Order: env CHROME (browser executable) and PW or PLAYWRIGHT_PATH (playwright or playwright-core package folder);
// then the plugin's lib/discover.mjs when this file sits inside the plugin; then playwright resolved from the
// current folder. No machine path is written here.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// The flags that gave a working WebGL2 context with no usable GPU (3D lane, SENSEI-LOG). SwiftShader is a CPU GL:
// correct pixels, no speed numbers.
export const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// Strict file:// by default, as a double-click opens the page. --allow-file-access-from-files makes file:// behave
// like http (sibling fetches, workers, modules all work) and so hides exactly the failures a single file must not
// have; pass { lenientFile: true } (gate3d --lenient-file) only for unpacked work in progress.
export const LENIENT_FILE_ARGS = ['--allow-file-access-from-files'];

async function pluginDiscover() {
  try { return await import(new URL('../../../lib/discover.mjs', import.meta.url).href); } catch { return null; }
}

function resolveFrom(dir) {
  for (const mod of ['playwright', 'playwright-core']) {
    try {
      const pj = path.join(dir, 'package.json');
      if (fs.existsSync(pj) && JSON.parse(fs.readFileSync(pj, 'utf8')).name === mod) return pathToFileURL(createRequire(pj).resolve(path.resolve(dir))).href;
      return pathToFileURL(createRequire(path.join(dir, 'noop.js')).resolve(mod)).href;
    } catch { /* try the next */ }
  }
  return null;
}

export async function findTools() {
  const d = await pluginDiscover();
  let pw = null, chrome = process.env.CHROME || null;
  const envPw = process.env.PW || process.env.PLAYWRIGHT_PATH;
  if (envPw) pw = resolveFrom(envPw);
  if (!pw && d) { const r = d.findPlaywright(process.cwd()); if (r.found) pw = r.importUrl; }
  if (!pw) pw = resolveFrom(process.cwd());
  if (!chrome && d) { const c = d.findChrome(); if (c.found) chrome = c.path; }
  return { pw, chrome };
}

// launch({ args, reducedMotion }) -> { browser, chromium }. Without CHROME and with no discovered browser, Playwright
// uses its own downloaded Chromium if it has one.
export async function launch({ args = [], lenientFile = false } = {}) {
  const { pw, chrome } = await findTools();
  if (!pw) throw new Error('Playwright not found: set PW to a playwright or playwright-core folder, or install playwright in this project (npm i -D playwright).');
  const mod = await import(pw); const chromium = mod.chromium || (mod.default && mod.default.chromium);
  const browser = await chromium.launch({ executablePath: chrome || undefined, args: [...GL_ARGS, ...(lenientFile ? LENIENT_FILE_ARGS : []), ...args] });
  return { browser, chromium, chrome, pw };
}

// "page.html?t=2" -> file URL with the query kept.
export function pageUrl(spec) {
  const i = spec.indexOf('?'); const file = i < 0 ? spec : spec.slice(0, i); const q = i < 0 ? '' : spec.slice(i);
  return pathToFileURL(path.resolve(file)).href + q;
}

// The page contract every example in these skills follows: window.__done = true after the first frame is drawn.
export async function waitDone(page, timeout = 90000) {
  try { await page.waitForFunction('window.__done === true', null, { timeout }); return true; } catch { return false; }
}
