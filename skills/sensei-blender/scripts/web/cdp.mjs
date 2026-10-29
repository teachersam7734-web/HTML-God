// cdp.mjs: headless Chrome over the DevTools protocol with Node's built-in WebSocket (Node 22 or newer), no npm
// packages. Shared by verify_page.mjs and capture_frames.mjs.
//
// Browser: env CHROME, else the plugin's lib/discover.mjs (found through CLAUDE_PLUGIN_ROOT, or relative to this file
// when it runs inside the plugin). Never a hard-coded path. Each run gets its own --user-data-dir and closes only the
// process it started (never kill browsers by image name: that closes the user's own browser).
// verified: Windows 10, Node 24, Chrome 155 (found by lib/discover.mjs), SwiftShader; used by test-web.mjs.
// not verified: macOS and Linux (discover.mjs covers them; not run there); Chromium builds without SwiftShader.
// Adapted from blender-demo/web/verify_cdp.mjs in the HTML-Sensei build project's research notes (not shipped) and capture_frames.mjs (run there). The race
// fix (do not await onopen after the socket is already open) comes from the lane, where a harness hung on it.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const roots = [process.env.CLAUDE_PLUGIN_ROOT, path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')].filter(Boolean);
  for (const r of roots) {
    const f = path.join(r, 'lib', 'discover.mjs');
    if (!existsSync(f)) continue;
    try { const d = await import(pathToFileURL(f).href); const c = d.findChrome(); if (c.found) return c.path; } catch { /* next */ }
  }
  throw new Error('No Chrome or Chromium found: set CHROME to the browser executable, or CLAUDE_PLUGIN_ROOT to the HTML-Sensei plugin folder.');
}

export function fileUrl(target) {
  if (/^(https?|file):/.test(target)) return target;
  const i = target.indexOf('?');
  return i < 0 ? pathToFileURL(path.resolve(target)).href : pathToFileURL(path.resolve(target.slice(0, i))).href + target.slice(i);
}

// open({ width, height }) -> { send, evaluate, on, close }
export async function open({ width = 1000, height = 700 } = {}) {
  const chrome = await findChrome();
  const profile = mkdtempSync(path.join(tmpdir(), 'sensei-cdp-'));
  const port = 9300 + Math.floor(Math.random() * 600);
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', ...GL_ARGS,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let ws = null;
  for (let i = 0; i < 75 && !ws; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find(t => t.type === 'page'); if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch { /* not up yet */ }
    if (!ws) await sleep(200);
  }
  if (!ws) { proc.kill(); throw new Error('Chrome did not open its DevTools port: ' + chrome); }
  if (ws.readyState !== 1) await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method) for (const f of listeners) f(d.method, d.params);
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('page evaluate failed: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
    return r.result?.result?.value;
  };
  const close = async () => { try { ws.close(); } catch {} proc.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  return { send, evaluate, on: f => listeners.push(f), close, sleep };
}

export async function screenshot(cdp) {
  return Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
}
