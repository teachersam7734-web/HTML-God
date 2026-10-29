// pw.mjs: find Playwright, a Chromium-family browser, axe-core and npm packages for this skill's tests. HTML-Sensei's
// own code (the discovery order of sensei-ui-components' pw.mjs, plus axe and package lookup).
//
// Playwright: env PW or PLAYWRIGHT_PATH (a playwright or playwright-core folder); then the plugin's lib/discover.mjs
// (project node_modules, global installs, the npx cache); then resolved from the current folder.
// Browser: env CHROME, then lib/discover.mjs (installed Chrome or Edge, then Playwright's own build).
// axe-core: env SENSEI_AXE (the axe.min.js file), then sensei-verify's findAxe (node_modules up from the cwd, global).
// Other packages (ts-fsrs): env SENSEI_NODE_MODULES (a node_modules folder or its parent), then the current folder.
// No machine path is written here.
//
// verified: Windows 10, Node 24, playwright-core 1.62.1 from PW, installed Chrome 155 found by lib/discover.mjs.
// not verified: macOS and Linux (the discovery code covers them; not run there).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

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
  let pw = null, chrome = process.env.CHROME || null;
  const envPw = process.env.PW || process.env.PLAYWRIGHT_PATH;
  if (envPw) pw = resolveFrom(envPw);
  if (!pw && d) { const r = d.findPlaywright(process.cwd()); if (r.found) pw = r.importUrl; }
  if (!pw) pw = resolveFrom(process.cwd());
  if (!chrome && d) { const c = d.findChrome(); if (c.found) chrome = c.path; }
  return { pw, chrome };
}

// Strict file:// (no --allow-file-access-from-files): pages open the way a double-click opens them.
export async function launch({ args = [] } = {}) {
  const { pw, chrome } = await findTools();
  if (!pw) throw new Error('Playwright not found: set PW to a playwright or playwright-core folder, or run npm i -D playwright-core in the project.');
  const mod = await import(pw); const chromium = mod.chromium || (mod.default && mod.default.chromium);
  const browser = await chromium.launch({ executablePath: chrome || undefined, args: [...GL_ARGS, ...args] });
  return { browser, chrome };
}

export async function findAxe() {
  if (process.env.SENSEI_AXE && fs.existsSync(process.env.SENSEI_AXE)) return process.env.SENSEI_AXE;
  try {
    const v = await import(new URL('../../sensei-verify/scripts/lib/discover.mjs', import.meta.url).href);
    const f = v.findAxe([path.resolve(process.env.SENSEI_NODE_MODULES || process.cwd())]);
    if (f) return f;
  } catch { /* outside the plugin */ }
  try { return requirePkgPath('axe-core/axe.min.js'); } catch { return null; }
}

function bases() {
  const out = [];
  const env = process.env.SENSEI_NODE_MODULES;
  if (env) out.push(path.basename(env) === 'node_modules' ? path.dirname(env) : env);
  out.push(process.cwd());
  return out;
}
function requirePkgPath(spec) {
  for (const b of bases()) { try { return createRequire(path.join(b, 'noop.js')).resolve(spec); } catch { /* next */ } }
  throw new Error(spec + ' not found: npm i ' + spec.split('/')[0] + ' in the current folder, or set SENSEI_NODE_MODULES');
}
// require() a CommonJS package (ts-fsrs ships CommonJS and ESM) from SENSEI_NODE_MODULES or the current folder.
export function requirePkg(name) {
  for (const b of bases()) { try { return createRequire(path.join(b, 'noop.js'))(name); } catch { /* next */ } }
  return null;
}

export const fileUrl = f => pathToFileURL(path.resolve(f)).href;

// A tiny assertion log: ok(name, condition, detail). summary() prints and returns the exit code.
export function checker() {
  const rows = [];
  const ok = (name, cond, detail = '') => { rows.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''}`); return !!cond; };
  const summary = () => { const bad = rows.filter(r => !r.pass).length; console.log(`\n${rows.length - bad} of ${rows.length} passed`); return bad ? 1 : 0; };
  return { ok, summary, rows };
}
