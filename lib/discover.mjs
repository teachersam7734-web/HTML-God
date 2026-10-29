// discover.mjs: finds the tools HTML-Sensei drives (Node, Chrome / Chromium / Edge, Playwright or playwright-core,
// ffmpeg, Blender, uv / uvx) on Windows, macOS and Linux. Order for each tool: its environment variable, then PATH,
// then the standard install locations built from the OS's own folders (ProgramFiles, LOCALAPPDATA, HOME and so on).
// No path from any one machine is written here.
//
// CLI: node discover.mjs [--json] [--no-version]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const env = process.env;
const HOME = os.homedir();

const isFile = p => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };
const isDir = p => { try { return !!p && fs.statSync(p).isDirectory(); } catch { return false; } };
const ls = d => { try { return fs.readdirSync(d); } catch { return []; } };
const uniq = a => [...new Set(a.filter(Boolean))];

// Every executable called `name` on PATH (with PATHEXT on Windows).
export function which(name) {
  const exts = WIN ? (env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').map(e => e.toLowerCase()) : [''];
  const dirs = (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  const hits = [];
  for (const d of dirs) for (const e of (WIN && path.extname(name) ? [''] : exts)) {
    const p = path.join(d.replace(/^"|"$/g, ''), name + e);
    if (isFile(p)) hits.push(p);
  }
  return uniq(hits);
}

// Expand "C:/x/Blender */blender.exe" style patterns: one * per segment, newest name first.
function glob(pattern) {
  const parts = pattern.split(/[\\/]/); let bases = [parts[0] === '' ? path.sep : parts[0] + (WIN && /:$/.test(parts[0]) ? path.sep : '')];
  for (const seg of parts.slice(1)) {
    if (!seg) continue;
    const next = [];
    for (const b of bases) {
      if (!seg.includes('*')) { next.push(path.join(b, seg)); continue; }
      const re = new RegExp('^' + seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
      next.push(...ls(b).filter(n => re.test(n)).sort((x, y) => y.localeCompare(x, undefined, { numeric: true })).map(n => path.join(b, n)));
    }
    bases = next;
  }
  return bases;
}

const winRoots = () => uniq([env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432, env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs')]);

function version(file, args, re, timeout = 15000) {
  try {
    const r = spawnSync(file, args, { encoding: 'utf8', timeout, windowsHide: true, shell: false });
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    const m = out.match(re); return m ? m[1] : null;
  } catch { return null; }
}

function pick(name, envVars, pathNames, candidates) {
  const tried = [];
  for (const v of envVars) if (env[v]) {
    let p = env[v];
    if (isDir(p)) p = pathNames.map(n => path.join(p, n + (WIN ? '.exe' : ''))).find(isFile) || p;
    tried.push(`env ${v}`);
    if (isFile(p)) return { found: true, path: path.resolve(p), via: `env ${v}` };
  }
  for (const n of pathNames) { const hit = which(n).find(h => !WIN || /\.exe$/i.test(h)) || which(n)[0]; if (hit) return { found: true, path: hit, via: 'PATH' }; }
  tried.push('PATH');
  for (const c of candidates) for (const p of (c.includes('*') ? glob(c) : [c])) if (isFile(p)) return { found: true, path: p, via: 'standard location' };
  tried.push(`${candidates.length} standard locations`);
  return { found: false, path: null, via: null, tried };
}

export function findNode() {
  return { found: true, path: process.execPath, via: 'running process', version: process.versions.node };
}

export function findChrome() {
  const names = WIN ? ['chrome', 'msedge', 'chromium'] : MAC ? [] : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable'];
  const cands = [];
  if (WIN) for (const r of [...winRoots(), env.LOCALAPPDATA]) cands.push(
    path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(r, 'Google', 'Chrome for Testing', 'Application', 'chrome.exe'),
    path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(r, 'Chromium', 'Application', 'chrome.exe'));
  else if (MAC) for (const base of ['/Applications', path.join(HOME, 'Applications')]) cands.push(
    path.join(base, 'Google Chrome.app/Contents/MacOS/Google Chrome'),
    path.join(base, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    path.join(base, 'Chromium.app/Contents/MacOS/Chromium'),
    path.join(base, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge'));
  else cands.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge', '/opt/google/chrome/chrome');
  // Browsers Playwright has downloaded count too (it ships its own Chromium builds).
  for (const pwDir of playwrightBrowserDirs()) for (const d of ls(pwDir).filter(n => /^chromium(_headless_shell)?-\d+/.test(n)).sort().reverse()) {
    const b = path.join(pwDir, d);
    cands.push(...(WIN ? [path.join(b, 'chrome-win64', 'chrome.exe'), path.join(b, 'chrome-win', 'chrome.exe'), path.join(b, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')]
      : MAC ? [path.join(b, 'chrome-mac', 'Chromium.app/Contents/MacOS/Chromium'), path.join(b, 'chrome-mac-arm64', 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'), path.join(b, 'chrome-mac-x64', 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')]
      : [path.join(b, 'chrome-linux64', 'chrome'), path.join(b, 'chrome-linux', 'chrome'), path.join(b, 'chrome-headless-shell-linux64', 'chrome-headless-shell')]));
  }
  const r = pick('chrome', ['CHROME', 'CHROME_PATH', 'CHROME_BIN', 'PUPPETEER_EXECUTABLE_PATH', 'BROWSER_PATH'], names, cands);
  if (r.found) {
    r.kind = /msedge|Microsoft Edge/i.test(r.path) ? 'edge' : /ms-playwright/i.test(r.path) ? 'playwright-chromium' : /chromium/i.test(r.path) ? 'chromium' : 'chrome';
    // Chrome on Windows prints no version; its sibling folder is named after it.
    // After an update both the old and new version folders can exist for a while: take the highest, not the first.
    if (WIN) {
      const num = v => v.split('.').map(Number);
      const vs = ls(path.dirname(r.path)).filter(n => /^\d+\.\d+\.\d+\.\d+$/.test(n))
        .sort((a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; });
      r.version = vs[0] || null;
    }
  }
  return r;
}

export function playwrightBrowserDirs() {
  return uniq([
    env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0' ? env.PLAYWRIGHT_BROWSERS_PATH : null,
    WIN && env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'ms-playwright') : null,
    MAC ? path.join(HOME, 'Library', 'Caches', 'ms-playwright') : null,
    !WIN && !MAC ? path.join(env.XDG_CACHE_HOME || path.join(HOME, '.cache'), 'ms-playwright') : null,
  ]).filter(isDir);
}

function globalNodeModules() {
  return uniq([
    ...(env.NODE_PATH || '').split(path.delimiter),
    env.npm_config_prefix && path.join(env.npm_config_prefix, WIN ? '' : 'lib', 'node_modules'),
    env.PNPM_HOME && path.join(env.PNPM_HOME, 'global', '5', 'node_modules'),
    WIN && env.APPDATA ? path.join(env.APPDATA, 'npm', 'node_modules') : null,
    path.join(path.dirname(process.execPath), WIN ? '' : '..', WIN ? 'node_modules' : 'lib/node_modules'),
    !WIN ? '/usr/local/lib/node_modules' : null,
    MAC ? '/opt/homebrew/lib/node_modules' : null,
    !WIN ? '/usr/lib/node_modules' : null,
    path.join(HOME, '.npm-global', 'lib', 'node_modules'),
  ]).filter(isDir);
}

// npx keeps packages it ran in <npm cache>/_npx/<hash>/node_modules; a usable last resort (the cache can be cleared).
function npxCacheModules() {
  const cache = env.npm_config_cache || (WIN && env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'npm-cache') : path.join(HOME, '.npm'));
  const root = path.join(cache, '_npx');
  return ls(root).map(h => path.join(root, h, 'node_modules')).filter(d => isDir(path.join(d, 'playwright-core')) || isDir(path.join(d, 'playwright')))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

// Resolve playwright (preferred) or playwright-core from the project, then global installs, then PW / PLAYWRIGHT_PATH.
export function findPlaywright(projectDir = process.cwd()) {
  const tried = [];
  const viaEnv = env.PLAYWRIGHT_PATH || env.PW;
  const npx = npxCacheModules();
  const bases = [...(viaEnv ? [viaEnv] : []), path.join(projectDir, 'noop.js'), ...globalNodeModules().map(d => path.join(d, 'noop.js')), ...npx.map(d => path.join(d, 'noop.js'))];
  for (const base of bases) {
    for (const mod of ['playwright', 'playwright-core']) {
      try {
        let entry;
        if (base === viaEnv) {
          // PW / PLAYWRIGHT_PATH may name the package folder itself, or a folder whose node_modules holds it.
          const pj = path.join(viaEnv, 'package.json');
          const own = isFile(pj) && JSON.parse(fs.readFileSync(pj, 'utf8')).name;
          if (own === mod) entry = createRequire(pj).resolve(path.resolve(viaEnv));
          else if (own && /^playwright(-core)?$/.test(own)) continue;
          else entry = createRequire(path.join(viaEnv, 'noop.js')).resolve(mod);
        } else entry = createRequire(base).resolve(mod);
        const pkgDir = (() => { let d = path.dirname(entry); while (d !== path.dirname(d)) { if (isFile(path.join(d, 'package.json')) && JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')).name === mod) return d; d = path.dirname(d); } return null; })();
        const ver = pkgDir ? JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version : null;
        return { found: true, module: mod, path: entry, importUrl: pathToFileURL(entry).href, version: ver, via: base === viaEnv ? 'env PLAYWRIGHT_PATH/PW' : base.startsWith(projectDir) ? 'project node_modules' : npx.some(d => base.startsWith(d)) ? 'npx cache (may be cleared; install it in the project for a stable path)' : 'global node_modules', browsers: playwrightBrowserDirs() };
      } catch { /* not here */ }
    }
    tried.push(path.dirname(base));
  }
  return { found: false, module: null, path: null, tried, browsers: playwrightBrowserDirs() };
}

export function findFfmpeg() {
  const cands = [];
  if (WIN) {
    for (const r of winRoots()) cands.push(path.join(r, 'ffmpeg', 'bin', 'ffmpeg.exe'));
    if (env.SystemDrive) cands.push(path.join(env.SystemDrive + path.sep, 'ffmpeg', 'bin', 'ffmpeg.exe'));
    if (env.LOCALAPPDATA) cands.push(path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'), path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages', '*FFmpeg*', '*', 'bin', 'ffmpeg.exe'));
    if (env.ProgramData) cands.push(path.join(env.ProgramData, 'chocolatey', 'bin', 'ffmpeg.exe'));
    cands.push(path.join(HOME, 'scoop', 'shims', 'ffmpeg.exe'));
  } else cands.push('/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', '/snap/bin/ffmpeg', path.join(HOME, '.local', 'bin', 'ffmpeg'));
  const r = pick('ffmpeg', ['FFMPEG_PATH', 'FFMPEG_BIN', 'FFMPEG'], ['ffmpeg'], cands);
  if (r.found) { const ff = path.join(path.dirname(r.path), WIN ? 'ffprobe.exe' : 'ffprobe'); r.ffprobe = isFile(ff) ? ff : (which('ffprobe')[0] || null); }
  return r;
}

export function findBlender() {
  const cands = [];
  if (WIN) {
    for (const r of winRoots()) cands.push(path.join(r, 'Blender Foundation', 'Blender*', 'blender.exe'), path.join(r, 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe'));
    if (env.LOCALAPPDATA) cands.push(
      path.join(env.LOCALAPPDATA, 'Programs', 'Blender Foundation', 'Blender*', 'blender.exe'),
      path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages', 'BlenderFoundation.Blender*', 'blender.exe'),
      path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages', 'BlenderFoundation.Blender*', '*', 'blender.exe'),
      path.join(env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'blender.exe'));
    const choco = env.ChocolateyInstall || 'C:\ProgramData\chocolatey';
    cands.push(path.join(HOME, 'scoop', 'apps', 'blender', 'current', 'blender.exe'),
      path.join(choco, 'lib', 'blender', 'tools', 'blender.exe'), path.join(choco, 'lib', 'blender', 'tools', '*', 'blender.exe'),
      path.join(HOME, 'Downloads', 'blender-*', 'blender.exe'), path.join(HOME, 'Downloads', 'blender-*', '*', 'blender.exe'));  // unzipped portable builds
  } else if (MAC) cands.push('/Applications/Blender.app/Contents/MacOS/Blender', path.join(HOME, 'Applications', 'Blender.app/Contents/MacOS/Blender'), '/Applications/Blender*.app/Contents/MacOS/Blender');
  else cands.push('/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender', '/var/lib/flatpak/exports/bin/org.blender.Blender', path.join(HOME, '.local/share/flatpak/exports/bin/org.blender.Blender'), '/opt/blender*/blender', path.join(HOME, 'blender*', 'blender'), path.join(HOME, 'Applications', 'blender*', 'blender'), path.join(HOME, 'Downloads', 'blender-*', 'blender'));
  return pick('blender', ['BLENDER_EXE', 'BLENDER_PATH', 'BLENDER_BIN', 'BLENDER'], ['blender'], cands);  // same order as sensei-blender's blender_locate.py
}

export function findUv() {
  const loc = WIN ? [path.join(HOME, '.local', 'bin'), env.USERPROFILE && path.join(env.USERPROFILE, '.cargo', 'bin'), env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'uv')] : [path.join(HOME, '.local', 'bin'), path.join(HOME, '.cargo', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  const exe = n => n + (WIN ? '.exe' : '');
  const uv = pick('uv', ['UV_PATH'], ['uv'], loc.filter(Boolean).map(d => path.join(d, exe('uv'))));
  const uvx = pick('uvx', ['UVX_PATH'], ['uvx'], loc.filter(Boolean).map(d => path.join(d, exe('uvx'))));
  return { uv, uvx };
}

export function discoverAll({ projectDir = process.cwd(), versions = true, cache = null } = {}) {
  const same = (k, r) => cache && cache[k] && cache[k].path === r.path && cache[k].mtimeMs === mtime(r.path) ? cache[k].version : undefined;
  const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };
  const out = { at: new Date().toISOString(), platform: process.platform, arch: process.arch,
    node: findNode(), chrome: findChrome(), playwright: findPlaywright(projectDir), ffmpeg: findFfmpeg(), blender: findBlender(), ...findUv() };
  for (const k of ['ffmpeg', 'blender']) {
    const r = out[k]; if (!r.found) continue; r.mtimeMs = mtime(r.path);
    const cached = same(k, r);
    if (cached !== undefined) r.version = cached;
    else if (versions) r.version = k === 'ffmpeg' ? version(r.path, ['-hide_banner', '-version'], /ffmpeg version (\S+)/) : version(r.path, ['--version'], /Blender (\d+\.\d+(?:\.\d+)?)/, 30000);
  }
  if (out.chrome.found) out.chrome.mtimeMs = mtime(out.chrome.path);
  return out;
}

export function summarise(d) {
  const row = (label, r, extra = '') => `${label}: ${r.found ? `${r.path}${r.version ? ` (${r.version})` : ''}${extra}` : 'not found'}`;
  return [
    row('Node', d.node),
    row('Browser', d.chrome, d.chrome.kind ? ` [${d.chrome.kind}]` : ''),
    d.playwright.found ? `Playwright: ${d.playwright.module} ${d.playwright.version || ''} via ${d.playwright.via}` : 'Playwright: not found (npm i -D playwright, or set PLAYWRIGHT_PATH)',
    row('ffmpeg', d.ffmpeg),
    row('Blender', d.blender),
    `uv/uvx: ${d.uv.found ? 'uv found' : 'uv not found'}${d.uvx.found ? ', uvx found' : ''}`,
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const d = discoverAll({ versions: !process.argv.includes('--no-version') });
  console.log(process.argv.includes('--json') ? JSON.stringify(d, null, 2) : summarise(d));
}
