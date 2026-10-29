// Copied unchanged from code-engineering/lib/discover.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code) for sensei-gate.mjs.
// verified: Windows 10, Node 24, installed Chrome through playwright-core 1.62, by ../test-gate.mjs (every assertion passes).
// not verified: macOS and Linux (the paths and calls are written for them, not run there).
// discover.mjs: find Playwright and a Chromium-family browser without hard-coded machine paths.
// Order for Playwright: SENSEI_PW / PW env (package dir or entry file) -> resolve from cwd and from the
// target's folder, walking up node_modules -> global npm root -> NODE_PATH.
// Order for the browser: SENSEI_CHROME / CHROME / CHROME_PATH env -> Playwright's own downloaded browser
// (if present on disk) -> well-known system install paths -> PATH lookup.
// Nothing here downloads anything. If both fail, the error says exactly what to install.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const exists = p => { try { return fs.existsSync(p); } catch { return false; } };

function tryRequire(spec, fromDir) {
  try {
    const req = createRequire(path.join(fromDir, 'x.js'));
    return { mod: req(spec), from: req.resolve(spec) };
  } catch { return null; }
}

function walkUpNodeModules(startDir, name) {
  let d = path.resolve(startDir);
  for (;;) {
    const cand = path.join(d, 'node_modules', name);
    if (exists(path.join(cand, 'package.json'))) return cand;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function npmRootGlobal() {
  try { return cp.execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

export function findPlaywright(extraDirs = []) {
  const tried = [];
  for (const e of [process.env.SENSEI_PW, process.env.PW].filter(Boolean)) {
    tried.push('env ' + e);
    try { const m = createRequire(import.meta.url)(e); if (m.chromium) return { chromium: m.chromium, from: e }; } catch {}
  }
  for (const d of [process.cwd(), ...extraDirs]) {
    for (const name of ['playwright-core', 'playwright']) {
      tried.push(name + ' from ' + d);
      const dir = walkUpNodeModules(d, name);
      if (dir) { const r = tryRequire(dir, d); if (r && r.mod.chromium) return { chromium: r.mod.chromium, from: dir }; }
    }
  }
  // npx keeps packages it has run in <npm cache>/_npx/<hash>/node_modules; the plugin's lib/discover.mjs searches it,
  // so this does too (newest first), or a machine with Playwright only from `npx playwright` finds nothing.
  const npmCache = process.env.npm_config_cache || (process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'npm-cache')
    : path.join(os.homedir(), '.npm'));
  const npxDirs = (() => { try { const b = path.join(npmCache, '_npx'); return fs.readdirSync(b).map(n => path.join(b, n, 'node_modules')).filter(exists).sort((a, c) => fs.statSync(c).mtimeMs - fs.statSync(a).mtimeMs); } catch { return []; } })();
  const roots = [npmRootGlobal(), ...(process.env.NODE_PATH || '').split(path.delimiter), ...npxDirs].filter(Boolean);
  for (const root of roots) {
    for (const name of ['playwright-core', 'playwright']) {
      const dir = path.join(root, name); tried.push(dir);
      if (exists(dir)) { const r = tryRequire(dir, root); if (r && r.mod.chromium) return { chromium: r.mod.chromium, from: dir }; }
    }
  }
  const e = new Error('Playwright not found. Tried: ' + tried.join('; ') +
    '\nFix: npm i playwright-core   (no browser download is needed if Chrome, Edge or Chromium is installed), or set SENSEI_PW to the package folder.');
  e.code = 'NO_PLAYWRIGHT';
  throw e;
}

export function systemBrowserCandidates() {
  const home = os.homedir();
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return [
    path.join(pf, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
    path.join(local, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
    path.join(pf, 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/snap/bin/chromium', '/usr/bin/microsoft-edge',
  ];
}

function whichSync(names) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const n of names) for (const x of exts) { const p = path.join(dir, n + x); if (exists(p)) return p; }
  }
  return null;
}

export function findBrowser(chromium) {
  for (const k of ['SENSEI_CHROME', 'CHROME', 'CHROME_PATH']) {
    const v = process.env[k];
    if (v && exists(v)) return { path: v, source: 'env ' + k };
  }
  // Prefer an installed Chrome/Edge over Playwright's bundled headless shell: stable Chrome has H.264 and AAC,
  // the managed Chromium build does not, so video and audio checks would lie.
  for (const p of systemBrowserCandidates()) if (exists(p)) return { path: p, source: 'system' };
  try {
    const p = chromium && chromium.executablePath && chromium.executablePath();
    if (p && exists(p)) return { path: p, source: 'playwright-managed (no H.264 or AAC)' };
  } catch {}
  const w = whichSync(['google-chrome', 'chromium', 'chromium-browser', 'chrome', 'msedge']);
  if (w) return { path: w, source: 'PATH' };
  const e = new Error('No Chromium-family browser found. Install Chrome, Edge or Chromium, or run: npx playwright install chromium   (or set SENSEI_CHROME to an executable).');
  e.code = 'NO_BROWSER';
  throw e;
}

// SwiftShader flags give a software WebGL so 3D pages render in headless/CI/no-GPU machines.
// They verify correctness, not speed. On a machine with a real GPU pass gpu:true to drop them.
// --allow-file-access-from-files is NOT in the default set: it makes file:// behave like http (fetch of sibling files,
// module scripts, workers all start working), which hides the single most common single-file failure. A user
// double-clicking the file has no such flag. Pass lenientFile:true only to reproduce a dev-server-like environment.
export function launchArgs({ gpu = false, lenientFile = false, extra = [] } = {}) {
  const base = ['--autoplay-policy=no-user-gesture-required', '--disable-features=Translate'];
  if (lenientFile) base.push('--allow-file-access-from-files');
  if (!gpu) base.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
  return [...base, ...extra];
}

export async function launch({ gpu = false, lenientFile = false, headless = true, extraArgs = [], extraDirs = [] } = {}) {
  const pw = findPlaywright(extraDirs);
  const br = findBrowser(pw.chromium);
  const browser = await pw.chromium.launch({ executablePath: br.path, headless, args: launchArgs({ gpu, lenientFile, extra: extraArgs }) });
  return { browser, playwrightFrom: pw.from, browserPath: br.path, browserSource: br.source, version: browser.version() };
}

export function findAxe(extraDirs = []) {
  if (process.env.SENSEI_AXE && exists(process.env.SENSEI_AXE)) return process.env.SENSEI_AXE;
  for (const d of [process.cwd(), ...extraDirs]) {
    const dir = walkUpNodeModules(d, 'axe-core');
    if (dir && exists(path.join(dir, 'axe.min.js'))) return path.join(dir, 'axe.min.js');
  }
  const root = npmRootGlobal();
  if (root) { const f = path.join(root, 'axe-core', 'axe.min.js'); if (exists(f)) return f; }
  return null;
}

export const fileUrl = p => pathToFileURL(path.resolve(p)).href;

// Memory of every browser process (browser, GPU, renderers), in MB, via CDP SystemInfo.getProcessInfo plus the OS.
// Working set on Windows, RSS elsewhere. Shared pages are counted per process, so treat it as an upper bound.
export async function browserMemoryMB(browser) {
  try {
    const sess = await browser.newBrowserCDPSession();
    const { processInfo } = await sess.send('SystemInfo.getProcessInfo');
    const pids = processInfo.map(p => p.id);
    await sess.detach().catch(() => {});
    let total = 0, per = {};
    if (process.platform === 'win32') {
      const out = cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id) $($_.WorkingSet64)" }`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const l of out.trim().split(/\r?\n/)) { const [id, ws] = l.trim().split(/\s+/).map(Number); if (id) { per[id] = Math.round(ws / 1048576); total += ws; } }
    } else {
      const out = cp.execSync(`ps -o pid=,rss= -p ${pids.join(',')}`, { encoding: 'utf8' });
      for (const l of out.trim().split('\n')) { const [id, kb] = l.trim().split(/\s+/).map(Number); if (id) { per[id] = Math.round(kb / 1024); total += kb * 1024; } }
    }
    const types = Object.fromEntries(processInfo.map(p => [p.id, p.type]));
    const byType = {}; for (const [id, mb] of Object.entries(per)) byType[types[id] || 'other'] = (byType[types[id] || 'other'] || 0) + mb;
    return { totalMB: Math.round(total / 1048576), byType };
  } catch (e) { return { totalMB: null, error: String(e.message).slice(0, 80) }; }
}
