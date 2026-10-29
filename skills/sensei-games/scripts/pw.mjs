// pw.mjs: find Playwright and a Chromium-family browser, launch headless, open a page by file URL. Used by this skill's
// tests. HTML-Sensei's own code (copied from sensei-motion-ui, with SENSEI_PW and SENSEI_CHROME added).
//
// Order: env SENSEI_PW, PW or PLAYWRIGHT_PATH (a playwright or playwright-core folder) and SENSEI_CHROME or CHROME; then the plugin's
// lib/discover.mjs (project node_modules, global installs, the npx cache; installed Chrome or Edge, then Playwright's
// own build); then playwright resolved from the current folder. No machine path is written here.
//
// verified: Windows 10, Node 24, Playwright 1.63 found by lib/discover.mjs, installed Chrome 155 (sensei-games tests).
// not verified: macOS and Linux (the discovery code covers them; not run there).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Software GL, so canvases render on a machine with no usable GPU. Correct pixels, no speed numbers.
export const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

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

export async function findTools() {
  let d = null;
  try { d = await import(new URL('../../../lib/discover.mjs', import.meta.url).href); } catch { /* outside the plugin */ }
  let pw = null, chrome = process.env.SENSEI_CHROME || process.env.CHROME || null;
  const envPw = process.env.SENSEI_PW || process.env.PW || process.env.PLAYWRIGHT_PATH;
  if (envPw) pw = resolveFrom(envPw);
  if (!pw && d) { const r = d.findPlaywright(process.cwd()); if (r.found) pw = r.importUrl; }
  if (!pw) pw = resolveFrom(process.cwd());
  if (!chrome && d) { const c = d.findChrome(); if (c.found) chrome = c.path; }
  return { pw, chrome };
}

// Strict file:// (no --allow-file-access-from-files): the page is opened the way a double-click opens it.
export async function launch({ args = [] } = {}) {
  const { pw, chrome } = await findTools();
  if (!pw) throw new Error('Playwright not found: set PW to a playwright or playwright-core folder, or run npm i -D playwright-core in the project.');
  const mod = await import(pw); const chromium = mod.chromium || (mod.default && mod.default.chromium);
  const browser = await chromium.launch({ executablePath: chrome || undefined, args: [...GL_ARGS, ...args] });
  return { browser, chrome };
}

export const fileUrl = f => pathToFileURL(path.resolve(f)).href;

// A tiny assertion log: ok(name, condition, detail). summary() prints and returns the exit code.
export function checker() {
  const rows = [];
  const ok = (name, cond, detail = '') => { rows.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); return !!cond; };
  const summary = () => { const bad = rows.filter(r => !r.pass).length; console.log(`\n${rows.length - bad} of ${rows.length} passed`); return bad ? 1 : 0; };
  return { ok, summary, rows };
}
