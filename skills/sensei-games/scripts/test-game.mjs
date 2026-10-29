// test-game.mjs: proves game-core.js and examples/coin-run.html in headless Chromium, strict file://.
// HTML-Sensei's own code, ported from the research lane's code-apps/test-game.cjs, with assertions added for the three
// fixes in game-core.js (latched taps, pauseOnHidden:false, Input.destroy).
//
//   node test-game.mjs [page.html]      default: ../examples/coin-run.html
//
// The page must expose window.__ready and window.__g = { state, loop, input, newState, step, save, opts, persist }
// as coin-run.html does; adapt the names for a project's own game.
// Playwright and the browser are discovered by pw.mjs (SENSEI_PW, PW, CHROME, or the plugin's lib/discover.mjs).
// Accessibility (axe), forced colours and the keyboard walk are sensei-verify's gate, not repeated here.
//
// verified: Windows 10, Node 24, Playwright 1.63, installed Chrome 155, software GL: all assertions pass.
// not verified: macOS and Linux; real gamepads (navigator.getGamepads is mocked); real touch.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const page = process.argv[2] || path.join(HERE, '..', 'examples', 'coin-run.html');
const file = fileUrl(page);
const { ok, summary } = checker();

const { browser: b } = await launch();
const errs = [];
const mk = async (ctxOpts = {}, init) => {
  const c = await b.newContext({ viewport: { width: 1000, height: 800 }, ...ctxOpts });
  if (init) await c.addInitScript(init);
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file); await p.waitForFunction(() => window.__ready); return { c, p };
};
const hide = (v) => { Object.defineProperty(document, 'hidden', { get: () => v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };

try {
  let { c, p } = await mk();

  // ---------- real-time rate ----------
  await p.waitForTimeout(300); const s0 = await p.evaluate(() => __g.loop.steps); await p.waitForTimeout(2000); const s1 = await p.evaluate(() => __g.loop.steps);
  ok('real rAF: about 60 fixed steps per second (120 +/- 12 over 2 s)', Math.abs(s1 - s0 - 120) <= 12, String(s1 - s0));

  // ---------- determinism across frame patterns ----------
  const det = await p.evaluate(() => {
    __g.loop.stop();
    function run(pattern) {
      const st = __g.newState(); let n = 0;
      const lp = new GameCore.Loop({ update: (dt) => { if (n >= 600) return; __g.step(st, 1, n % 50 === 0, dt); n++; }, render: () => {} });
      let t = 0, i = 0; lp.advance(0);
      while (n < 600 && i < 100000) { t += pattern(i++); lp.advance(t); }
      lp.destroy(); return { json: JSON.stringify(st), n, frames: i };
    }
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let alphaOk = true; const l2 = new GameCore.Loop({ update() {}, render: (a) => { if (!(a >= 0 && a < 1.0000001)) alphaOk = false; } });
    l2.advance(0); for (let k = 1; k < 200; k++) l2.advance(k * 7.3); l2.destroy();
    return { alphaOk, runs: { r60: run(() => 1000 / 60), r144: run(() => 1000 / 144), r30: run(() => 1000 / 30), jit: run(() => 3 + rnd() * 40), r240: run(() => 1000 / 240) } };
  });
  const js = Object.values(det.runs).map((r) => r.json);
  ok('same input script gives byte-identical state at 30, 60, 144, 240 Hz and with random jitter (600 steps)',
    js.every((j) => j === js[0]) && Object.values(det.runs).every((r) => r.n === 600),
    Object.entries(det.runs).map(([k, r]) => k + ' ' + r.frames + ' frames').join(', '));
  ok('render alpha stays in [0,1)', det.alphaOk);

  // ---------- spiral of death ----------
  const sp = await p.evaluate(() => { let calls = 0; const lp = new GameCore.Loop({ update() { calls++; }, render() {} }); lp.advance(0); lp.advance(16); const c0 = calls; lp.advance(5016); const r = { steps: calls - c0, dropped: +lp.dropped.toFixed(2), acc: lp.acc }; lp.destroy(); return r; });
  ok('a 5 second stall runs at most maxSteps (10) updates, drops the rest, leaves no backlog', sp.steps <= 10 && sp.dropped > 4 && sp.acc === 0, JSON.stringify(sp));

  // ---------- hidden tab ----------
  await p.evaluate(() => { __g.loop.start(); });
  await p.waitForTimeout(300);
  const hid = await p.evaluate(async (hideSrc) => {
    const hide = eval(hideSrc), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    hide(true); await sleep(100); const a = __g.loop.steps; await sleep(700); const b2 = __g.loop.steps;
    hide(false); await sleep(200); const c2 = __g.loop.steps;
    return { frozen: b2 - a, resumed: c2 - b2, auto: __g.loop.autoPaused };
  }, hide.toString());
  ok('hidden: loop pauses (0 steps in 700 ms), resumes without catching up the hidden time', hid.frozen === 0 && hid.resumed > 5 && hid.resumed < 20 && !hid.auto, JSON.stringify(hid));

  // fix 1: pauseOnHidden:false must not leave the loop paused for ever
  const poh = await p.evaluate(async (hideSrc) => {
    const hide = eval(hideSrc), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let n = 0; const lp = new GameCore.Loop({ pauseOnHidden: false, update() { n++; } }); lp.start();
    await sleep(150); hide(true); await sleep(150); const paused = lp.autoPaused; hide(false); const before = n; await sleep(300);
    const r = { paused, after: n - before }; lp.destroy(); return r;
  }, hide.toString());
  ok('pauseOnHidden:false: never auto-pauses, keeps stepping after the tab returns (the lane code stayed paused)', !poh.paused && poh.after > 8, JSON.stringify(poh));

  // ---------- input ----------
  await p.evaluate(() => { __g.loop.stop(); __g.input.sample(); });
  const I = (fn) => p.evaluate(fn);
  await p.keyboard.down('Space'); const r1 = await I(() => { const i = __g.input.sample(); return [i.pressed.jump, i.down.jump]; });
  const r2 = await I(() => { const i = __g.input.sample(); return [i.pressed.jump, i.down.jump]; });
  await p.keyboard.up('Space'); const r3 = await I(() => { const i = __g.input.sample(); return [i.released.jump, i.down.jump]; });
  ok('edges: pressed is true for exactly one step; down persists; released fires once', r1.join() === 'true,true' && r2.join() === 'false,true' && r3.join() === 'true,false', JSON.stringify([r1, r2, r3]));
  // fix 2: a tap shorter than one step
  await p.keyboard.down('Space'); await p.keyboard.up('Space');
  const tap = await I(() => { const a = __g.input.sample(); const r = [a.pressed.jump, a.down.jump]; const b2 = __g.input.sample(); return r.concat([b2.pressed.jump, b2.down.jump, b2.released.jump]); });
  ok('a tap pressed and released between two steps is still seen once (latched), then released', tap.join() === 'true,true,false,false,true', tap.join());
  await p.keyboard.down('ArrowRight'); await p.keyboard.down('ArrowUp');
  const diag = await I(() => { const m = __g.input.sample().move; return Math.hypot(m.x, m.y); });
  ok('diagonal movement is normalised (length 1, not 1.41)', Math.abs(diag - 1) < 1e-9, String(diag));
  await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  const stuck = await I(() => __g.input.sample().down.right);
  ok('stuck key: window blur releases every held key', stuck === false);
  await p.keyboard.up('ArrowRight'); await p.keyboard.up('ArrowUp');
  await p.evaluate(() => { __g.loop.setPaused(false); });
  const pd = await I(() => {
    const a = new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true }); window.dispatchEvent(a);
    const b2 = new KeyboardEvent('keydown', { code: 'ArrowLeft', ctrlKey: true, cancelable: true }); window.dispatchEvent(b2);
    const c2 = new KeyboardEvent('keydown', { code: 'KeyZ', cancelable: true }); window.dispatchEvent(c2);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); __g.input.sample(); __g.input.sample();
    return [a.defaultPrevented, b2.defaultPrevented, c2.defaultPrevented];
  });
  ok('only game keys are preventDefault-ed (Space yes; Ctrl+Left and unbound Z no)', pd.join() === 'true,false,false', pd.join());
  await I(() => __g.input.rebind('jump', ['KeyJ']));
  await p.keyboard.down('Space'); const rb1 = await I(() => __g.input.sample().down.jump); await p.keyboard.up('Space');
  await p.keyboard.down('j'); const rb2 = await I(() => __g.input.sample().down.jump); await p.keyboard.up('j');
  ok('rebinding: Space no longer jumps, J does (bound by physical code)', rb1 === false && rb2 === true, JSON.stringify([rb1, rb2]));
  await I(() => { __g.input.rebind('jump', ['Space']); __g.input.sample(); __g.input.toggleMode.jump = true; __g.input.toggled = {}; });
  await p.keyboard.down('Space'); await I(() => __g.input.sample()); await p.keyboard.up('Space'); const t1 = await I(() => __g.input.sample().down.jump);
  await p.keyboard.down('Space'); await I(() => __g.input.sample()); await p.keyboard.up('Space'); const t2 = await I(() => __g.input.sample().down.jump);
  ok('toggle mode: one press holds, the next releases (edges from physical input, not the toggled state)', t1 === true && t2 === false, JSON.stringify([t1, t2]));
  await I(() => { __g.input.toggleMode.jump = false; });
  const box = await p.locator('#stage').boundingBox();
  await p.mouse.move(box.x + 200, box.y + 100); await p.mouse.down(); await p.mouse.move(box.x + 240, box.y + 100, { steps: 4 });
  const ps = await I(() => __g.input.sample().move.x);
  await p.mouse.move(box.x + 980, box.y + 100, { steps: 4 }); const ps2 = await I(() => __g.input.sample().move.x);
  await p.mouse.up(); const ps3 = await I(() => __g.input.sample().move.x);
  ok('pointer stick: drag right = +1 (clamped), keeps tracking outside the element via pointer capture, release = 0', ps > 0.99 && ps2 > 0.99 && ps3 === 0, JSON.stringify([ps, ps2, ps3]));
  // fix 3: destroy removes every listener
  const des = await I(() => { const i = new GameCore.Input(null); i.destroy(); i.raw.KeyD = true; document.dispatchEvent(new Event('visibilitychange')); return i.raw.KeyD === true; });
  ok('Input.destroy() removes its visibilitychange listener too', des);
  await c.close();

  // ---------- gamepad (mocked navigator.getGamepads) ----------
  ({ c, p } = await mk({}, () => { window.__pad = null; navigator.getGamepads = () => [window.__pad]; }));
  await p.evaluate(() => __g.loop.stop());
  const pad = async (axes, btn0, extra) => p.evaluate(({ axes, btn0, extra }) => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })); buttons[0].pressed = !!btn0;
    if (extra) Object.keys(extra).forEach((k) => { buttons[k].pressed = true; });
    window.__pad = { connected: true, axes, buttons, index: 0 }; const i = __g.input.sample();
    return { x: +i.move.x.toFixed(3), y: +i.move.y.toFixed(3), jp: i.pressed.jump };
  }, { axes, btn0, extra });
  const g1 = await pad([0.1, 0.05]), g2 = await pad([0.6, 0]), g3 = await pad([1, 1]), g4 = await pad([0, 0], true), g5 = await pad([0, 0], true);
  ok('gamepad: inside the 0.2 deadzone gives exactly 0; 0.6 rescales to 0.5', g1.x === 0 && g1.y === 0 && g2.x === 0.5, JSON.stringify([g1, g2]));
  ok('gamepad: full diagonal is clamped to length 1', Math.abs(Math.hypot(g3.x, g3.y) - 1) < 0.01, JSON.stringify(g3));
  ok('gamepad: button A edge fires once', g4.jp === true && g5.jp === false);
  const dp = await pad([0, 0], false, { 15: 1 }); ok('gamepad: d-pad right moves right', dp.x === 1, JSON.stringify(dp));
  await c.close();

  // ---------- game behaviour, pause, saves ----------
  ({ c, p } = await mk());
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  const pa = await p.evaluate(() => ({ up: __g.loop.userPaused, pressed: document.getElementById('pause').getAttribute('aria-pressed'), hud: document.getElementById('hud').textContent }));
  const st1 = await p.evaluate(() => __g.loop.steps); await p.waitForTimeout(400); const st2 = await p.evaluate(() => __g.loop.steps);
  ok('Escape pauses (steps stop, button state and HUD follow)', pa.up && pa.pressed === 'true' && /Paused/.test(pa.hud) && st2 === st1, JSON.stringify(pa));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('Escape again resumes (the pause key is read outside the fixed update)', (await p.evaluate(() => !__g.loop.userPaused && __g.loop.steps)) > st2);
  await p.keyboard.down('ArrowRight'); for (let i = 0; i < 12; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(260); } await p.keyboard.up('ArrowRight');
  const play = await p.evaluate(() => ({ x: __g.state.x, score: __g.state.score, text: document.getElementById('score').textContent }));
  ok('player moved with the keyboard through the real loop and the score text matches state', play.x > 100 && play.text === String(play.score), JSON.stringify(play));
  ok('score events go to a polite live region', (await p.evaluate(() => document.getElementById('status').getAttribute('aria-live'))) === 'polite');
  await p.evaluate(() => { __g.persist(); }); await p.reload(); await p.waitForFunction(() => window.__ready);
  ok('save survives reload (options and best are read back)', await p.evaluate(() => JSON.parse(localStorage.getItem('coinrun')).v === 2 && document.getElementById('o-shake').checked === __g.opts.shake));
  // The page saves on pagehide, so seeding storage and then reloading would be overwritten: seed in a fresh context.
  const seeded = async (value) => {
    const cc = await b.newContext({ viewport: { width: 1000, height: 800 } });
    await cc.addInitScript((v) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('coinrun', v); } }, value);
    const pp = await cc.newPage(); pp.on('pageerror', (e) => errs.push(e.message)); await pp.goto(file); await pp.waitForFunction(() => window.__ready); return { cc, pp };
  };
  let S = await seeded(JSON.stringify({ v: 1, data: { hi: 7 } }));
  ok('migration: a version 1 save ({hi}) loads as version 2 best=7', (await S.pp.evaluate(() => document.getElementById('best').textContent)) === '7'); await S.cc.close();
  S = await seeded('{not json');
  const cor = await S.pp.evaluate(() => [document.getElementById('best').textContent, __g.save.lastError]);
  ok('corrupt save: starts from defaults, records why, does not throw', cor[0] === '0' && !!cor[1], cor.join(' | ')); await S.cc.close();
  S = await seeded(JSON.stringify({ v: 9, data: { best: 99 } }));
  const nw = await S.pp.evaluate(() => [document.getElementById('best').textContent, __g.save.lastError]);
  ok('a save from a NEWER build is refused, not misread', nw[0] === '0' && /newer/.test(nw[1] || ''), nw.join(' | ')); await S.cc.close();
  await p.evaluate((hideSrc) => { localStorage.removeItem('coinrun'); eval(hideSrc)(true); }, hide.toString());
  ok('autosave on visibilitychange to hidden (unload does not fire on mobile)', await p.evaluate(() => !!localStorage.getItem('coinrun')));
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); });
  await p.click('#fs'); await p.waitForTimeout(300);
  ok('fullscreen request is guarded: no exception, orientation lock failure swallowed', errs.length === 0, errs.join(' | '));
  await c.close();

  ({ c, p } = await mk({}, () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); }));
  ok('storage blocked: game starts and persist() returns false instead of throwing', (await p.evaluate(() => __g.persist())) === false);
  await c.close();
  ({ c, p } = await mk({ reducedMotion: 'reduce' }));
  ok('prefers-reduced-motion: screen shake defaults off', (await p.evaluate(() => __g.opts.shake)) === false);
  await c.close();
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await b.close();
}
process.exitCode = summary();
