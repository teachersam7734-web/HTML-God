// cdp.mjs: a dependency-free Chrome DevTools Protocol client for rendering and reviewing seek pages.
// Launches its own headless Chrome (found by lib/discover.mjs), talks to it over Node's built-in WebSocket, and closes
// exactly the process it started (by its handle, never by image name).
//
//   import { launch } from './cdp.mjs';
//   const chrome = await launch({ gl: 'swiftshader' });
//   const page = await chrome.open(url, { width: 1920, height: 1080, scale: 1 });
//   await page.ready();                    // waits for window.__ready / READY / ready
//   const meta = await page.meta();        // { dur, fps, w, h, seekName }
//   await page.seek(1.25); const png = await page.shot({ format: 'png' });
//   await chrome.close();
//
// verified: Node 24.16 (global WebSocket) on Windows 10 with system Chrome 156, headless=new, SwiftShader flags;
//           used by render.mjs, probe and stills, and by sensei-handmade-animation's review.mjs. Shutdown: every
//           pending call rejects when the socket closes or errors or Chrome exits; Browser.close has a 3 s limit;
//           close() is idempotent and bounded (test-pipeline.mjs checks all three; 11 runs in a row passed, 2026-10-28).
// not verified: macOS and Linux Chrome (the flags and protocol calls are standard); Node below 22 (no global
//           WebSocket: upgrade Node rather than adding a package).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { findChrome } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/discover.mjs')).href);

const GL_FLAGS = {
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  gpu: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  none: ['--disable-gpu'],
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const toUrl = p => (/^(https?|file|data):/i.test(p) ? p : pathToFileURL(path.resolve(p)).href);

// One retry: a cold Chrome start occasionally fails to open its port or socket (seen once in about ten test runs).
export async function launch(o = {}) {
  try { return await launchOnce(o); } catch (e) { await sleep(500); return launchOnce(o); }
}

async function launchOnce({ gl = 'swiftshader', chromePath = process.env.CHROME || null, args = [], timeoutMs = 30000 } = {}) {
  if (typeof WebSocket === 'undefined') throw new Error('this Node has no global WebSocket: use Node 22 or newer');
  const exe = chromePath || (findChrome().found ? findChrome().path : null);
  if (!exe) throw new Error('Chrome or Chromium not found: set CHROME (or CHROME_PATH) to its executable');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-cdp-'));
  const flags = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb',
    ...(GL_FLAGS[gl] || GL_FLAGS.swiftshader), ...args, 'about:blank'];
  const proc = spawn(exe, flags, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; proc.stderr.on('data', d => { stderr = (stderr + d).slice(-4000); });
  const portFile = path.join(profile, 'DevToolsActivePort');
  const t0 = Date.now();
  while (!fs.existsSync(portFile) || fs.readFileSync(portFile, 'utf8').split('\n').length < 2) {
    if (proc.exitCode !== null) throw new Error(`Chrome exited (${proc.exitCode}): ${stderr.slice(-400)}`);
    if (Date.now() - t0 > timeoutMs) { proc.kill(); throw new Error('Chrome did not open a debugging port'); }
    await sleep(50);
  }
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => { proc.kill(); rej(new Error('cannot connect to Chrome')); }; });   // never leave our own Chrome behind
  // Every pending call and every event waiter is rejected the moment the socket closes or errors, or Chrome exits.
  // Before this, a call whose reply never came (Chrome dropping the socket during Browser.close) waited for ever; with
  // nothing else pending Node exited 13 ("unsettled top-level await") after the MP4 was already written (QC finding 6).
  let id = 0, gone = null; const pending = new Map(), listeners = new Set(), waiters = new Set();
  const fail = why => {
    if (gone) return; gone = new Error(why);
    for (const { rej } of pending.values()) rej(gone);
    pending.clear();
    for (const w of waiters) w(gone);
    waiters.clear(); listeners.clear();
  };
  ws.onmessage = ev => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(`${m.error.message} ${m.error.data || ''}`)) : res(m.result); }
    else for (const l of listeners) l(m);
  };
  ws.onclose = () => fail('the DevTools socket closed');
  ws.onerror = () => fail('the DevTools socket failed');
  proc.once('exit', code => fail(`Chrome exited (${code})`));
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    if (gone) return rej(gone);
    const msg = { id: ++id, method, params }; if (sessionId) msg.sessionId = sessionId;
    pending.set(msg.id, { res, rej });
    try { ws.send(JSON.stringify(msg)); } catch (e) { pending.delete(msg.id); rej(e); }
  });
  const waitFor = (pred, ms = 60000) => new Promise((res, rej) => {
    if (gone) return rej(gone);
    const done = () => { clearTimeout(timer); listeners.delete(l); waiters.delete(onGone); };
    const timer = setTimeout(() => { done(); rej(new Error('timed out waiting for a DevTools event')); }, ms);
    const onGone = e => { done(); rej(e); };
    const l = m => { if (pred(m)) { done(); res(m); } };
    listeners.add(l); waiters.add(onGone);
  });
  const within = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`no reply in ${ms} ms`)), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });

  async function open(url, { width = 1920, height = 1080, scale = 1 } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await s('Page.enable'); await s('Runtime.enable');
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    const loaded = waitFor(m => m.sessionId === sessionId && m.method === 'Page.loadEventFired', 120000);
    await s('Page.navigate', { url: toUrl(url) });
    await loaded;
    const evaluate = async (expression, { awaitPromise = true } = {}) => {
      const r = await s('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`page error: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
      return r.result.value;
    };
    return {
      sessionId, send: s, evaluate,
      // the page contract: window.__ready (promise) or READY / ready flags; seek is __seek, seek or renderFrame
      async ready(timeoutMs = 300000) {
        const t1 = Date.now();
        for (;;) {
          const st = await evaluate(`(() => { const r = window.__ready; if (r && typeof r.then === 'function') return 'promise';
            return (window.READY === true || window.ready === true || r === true) ? 'flag' : 'wait'; })()`);
          if (st === 'promise') { await evaluate('Promise.resolve(window.__ready).then(() => true)'); return; }
          if (st === 'flag') return;
          if (Date.now() - t1 > timeoutMs) throw new Error('the page never signalled ready (window.__ready, READY or ready)');
          await sleep(100);
        }
      },
      meta: () => evaluate(`(() => { const m = window.__meta || {};
        const dur = m.dur ?? window.DURATION ?? window.DUR ?? window.__duration ?? (window.film && window.film.total);
        const seekName = typeof window.__seek === 'function' ? '__seek' : typeof window.seek === 'function' ? 'seek' : typeof window.renderFrame === 'function' ? 'renderFrame' : null;
        return { dur, fps: m.fps ?? window.FPS ?? null, w: m.w ?? innerWidth, h: m.h ?? innerHeight, seekName,
                 events: Array.isArray(window.__events) ? window.__events : Array.isArray(window.EV) ? window.EV : null }; })()`),
      seek: t => evaluate(`Promise.resolve((window.__seek || window.seek || window.renderFrame)(${Number(t)})).then(() => true)`),
      async shot({ format = 'png', quality = 95, clip = null } = {}) {
        const p = { format, captureBeyondViewport: false }; if (format === 'jpeg') p.quality = quality;
        if (clip) p.clip = { scale: 1, ...clip };
        const { data } = await s('Page.captureScreenshot', p);
        return Buffer.from(data, 'base64');
      },
      glRenderer: () => evaluate(`(() => { try { const g = document.createElement('canvas').getContext('webgl');
        if (!g) return 'no WebGL'; const e = g.getExtension('WEBGL_debug_renderer_info');
        return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (x) { return 'error: ' + x.message; } })()`),
      close: () => send('Target.closeTarget', { targetId }).catch(() => {}),
    };
  }

  // Deterministic shutdown, in a fixed order, each step bounded: ask Chrome to close (3 s), close the socket, wait for
  // the process to exit (5 s), kill exactly that process if it has not (then wait up to 3 s more), remove the profile.
  // Calling close() twice returns the same promise.
  let closing = null;
  function close() {
    if (closing) return closing;
    closing = (async () => {
      try { await within(send('Browser.close'), 3000); } catch { /* no reply, socket gone or already closed */ }
      fail('closed by close()');
      try { ws.close(); } catch { /* closed */ }
      const exited = () => proc.exitCode !== null || proc.signalCode !== null;
      let t1 = Date.now(); while (!exited() && Date.now() - t1 < 5000) await sleep(50);
      if (!exited()) { try { proc.kill(); } catch { /* gone */ } t1 = Date.now(); while (!exited() && Date.now() - t1 < 3000) await sleep(50); }   // only the process this module started
      for (let i = 0; i < 10; i++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(200); } }
    })();
    return closing;
  }
  return { open, close, send, exe, pid: proc.pid };
}
