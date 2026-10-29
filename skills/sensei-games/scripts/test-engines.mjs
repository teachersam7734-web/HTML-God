// test-engines.mjs: the atlas packer in Node, then the Phaser, PixiJS and Kaplay pages from build-engines.mjs in
// headless Chromium with software WebGL, strict file://, network watched.
// HTML-Sensei's own code, ported from the research lane's code-apps/test-engines.cjs.
//
//   node test-engines.mjs --libs DIR [--out DIR]     (DIR as for build-engines.mjs; or env GAME_LIBS)
//   Without --libs only the packer tests run, and the engine part says it was skipped.
//
// verified: Windows 10, Node 24, Playwright 1.63, installed Chrome 155, swiftshader; phaser 4.2.1, pixi.js 8.22.0,
//           kaplay 3001.0.19.
// not verified: frame rate (software GL proves pixels, not speed); real GPUs; Firefox and Safari.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const AP = require('./atlas-pack.js');
const { ok, summary } = checker();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIBS = arg('--libs', process.env.GAME_LIBS);
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), 'sensei-games-engines')));

// ---------- packer ----------
const items = []; for (let i = 0; i < 40; i++) items.push({ name: 'i' + i, w: 16 + (i * 7) % 40, h: 16 + (i * 11) % 40 });
const P = AP.pack(items, { maxW: 256, pad: 2 });
const R = Object.values(P.frames);
let overlap = false;
for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i], b = R[j]; if (a.x < b.x + b.w + 2 && b.x < a.x + a.w + 2 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2) overlap = true; }
ok('packer: 40 frames, none overlap and each keeps a 2 px gutter', !overlap && R.length === 40);
ok('packer: all frames inside the sheet; sheet is a power of two', R.every((f) => f.x + f.w <= P.w && f.y + f.h <= P.h) && (P.w & (P.w - 1)) === 0 && (P.h & (P.h - 1)) === 0, `${P.w}x${P.h}`);
const used = R.reduce((s, f) => s + f.w * f.h, 0);
console.log(`INFO packing efficiency ${(used / (P.w * P.h) * 100).toFixed(0)}% of a ${P.w}x${P.h} sheet (shelf packer; use MaxRects for production)`);
ok('packer: JSON is the hash format (frames.name.frame.{x,y,w,h}) with meta.size', P.json.frames.i0.frame.w === 16 && P.json.meta.size.w === P.w);

if (!LIBS) {
  console.log('SKIP  engine pages: give --libs DIR (a folder with node_modules/phaser, pixi.js, kaplay) or GAME_LIBS');
  process.exit(summary());
}
const built = spawnSync(process.execPath, [path.join(HERE, 'build-engines.mjs'), '--libs', LIBS, '--out', OUT], { encoding: 'utf8' });
if (built.status !== 0) { console.error(built.stderr); process.exit(1); }
console.log('INFO versions', fs.readFileSync(path.join(OUT, 'versions.json'), 'utf8').replace(/\s+/g, ' '));
const url = (n) => fileUrl(path.join(OUT, n));

// count pixels near the sprite colour #ff7a59 in a page screenshot
async function ink(p) {
  const shot = (await p.screenshot()).toString('base64');
  return p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 255) < 12 && Math.abs(d[i + 1] - 122) < 12 && Math.abs(d[i + 2] - 89) < 12) n++; return n; }, shot);
}
const frameSet = (p, expr) => p.evaluate(async (e) => { const f = new Function('return ' + e), seen = new Set(), t0 = performance.now(); while (performance.now() - t0 < 1200) { seen.add(f()); await new Promise((r) => setTimeout(r, 20)); } return [...seen].sort(); }, expr);

const { browser: b } = await launch();
const errs = [], reqs = [];
const open = async (n, vp = { width: 960, height: 540 }) => {
  const c = await b.newContext({ viewport: vp }); const p = await c.newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
  p.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
  await p.goto(url(n)); await p.waitForFunction(() => window.__ready, null, { timeout: 30000 }); return { c, p };
};
try {
  // ---------- Phaser ----------
  let { c, p } = await open('phaser.html');
  const frames = await frameSet(p, '__ph.sprite.frame.name');
  ok('Phaser: atlas from a runtime canvas, animation cycles all four frames (f0..f3)', frames.length === 4, frames.join());
  await p.waitForTimeout(1500);
  const ph = await p.evaluate(() => ({ down: __ph.sprite.body.blocked.down || __ph.sprite.body.touching.down, y: Math.round(__ph.sprite.y), renderer: __ph.game.renderer.type === Phaser.WEBGL ? 'WEBGL' : 'CANVAS' }));
  ok('Phaser arcade: sprite falls and rests on the static ground (blocked.down)', ph.down && ph.y > 120 && ph.y < 165, JSON.stringify(ph));
  const sz = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  ok('Phaser Scale.FIT: 320x180 canvas scaled to the 960x540 viewport (3x)', sz[0] === 960 && sz[1] === 540, sz.join('x'));
  ok('Phaser draws sprite-colour pixels (screenshot)', (await ink(p)) > 200);
  const hid = await p.evaluate(async () => {
    const g = __ph.game, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Math.round(__ph.scene.time.now);
    const hide = (v) => { Object.defineProperty(document, 'hidden', { get: () => v, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => (v ? 'hidden' : 'visible'), configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };
    // 1) default: take the page's own pause recipe off, and see whether Phaser pauses by itself
    const ev = []; g.events.off('hidden'); g.events.off('visible');
    g.events.on('hidden', () => ev.push('hidden')); g.events.on('visible', () => ev.push('visible'));
    const t0 = now(); hide(true); await sleep(500); const defaultAdvance = now() - t0; hide(false); await sleep(100);
    // 2) the recipe: pause on 'hidden', resume on 'visible'
    g.events.on('hidden', () => g.pause()); g.events.on('visible', () => g.resume());
    hide(true); await sleep(300); const t2 = now(); await sleep(500); const frozen = now() - t2; hide(false); await sleep(400); const after = now() - t2;
    return { ev: ev.join(), defaultAdvance, frozen, after };
  });
  ok('Phaser does NOT pause its clock on hidden by itself (it only emits events)', hid.defaultAdvance > 300 && /hidden/.test(hid.ev), `clock advanced ${hid.defaultAdvance} ms in 500 ms hidden; events ${hid.ev}`);
  ok('Phaser: game.pause() on the hidden event freezes the scene clock; game.resume() restarts it', hid.frozen === 0 && hid.after > 100, JSON.stringify(hid));
  console.log('INFO Phaser renderer:', ph.renderer);
  await c.close();

  // ---------- PixiJS ----------
  ({ c, p } = await open('pixi.html'));
  const pf = await frameSet(p, '__px.spr.currentFrame');
  ok('PixiJS: Spritesheet from a runtime atlas, AnimatedSprite advances through 4 frames', pf.length === 4, pf.join());
  await p.waitForTimeout(1200);
  const py = await p.evaluate(() => Math.round(__px.spr.y));
  ok('PixiJS: ticker-driven fall lands on the floor line (y = 138)', py === 138, String(py));
  ok('PixiJS draws sprite-colour pixels', (await ink(p)) > 200);
  console.log('INFO PixiJS renderer:', await p.evaluate(() => __px.app.renderer.name || __px.app.renderer.type));
  await c.close();

  // ---------- Kaplay ----------
  ({ c, p } = await open('kaplay.html'));
  await p.waitForTimeout(2000);
  const kp = await p.evaluate(() => ({ grounded: __kp.p.isGrounded(), add: typeof window.add, kaboom: typeof window.kaboom, kaplay: typeof window.kaplay }));
  ok('Kaplay: body falls and is grounded on the static platform', kp.grounded, JSON.stringify(kp));
  const kf = await frameSet(p, '__kp.p.frame');
  ok('Kaplay: sliced sprite animation cycles 4 frames', kf.length === 4, kf.join());
  ok('Kaplay global:false keeps add() off window', kp.add === 'undefined');
  console.log(`INFO Kaplay with global:false still defines window.kaboom (${kp.kaboom}) and window.kaplay (${kp.kaplay})`);
  ok('Kaplay draws sprite-colour pixels', (await ink(p)) > 100);
  await c.close();
  ok('no network requests from any engine page', reqs.length === 0, reqs.join(' '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await b.close();
}
process.exitCode = summary();
