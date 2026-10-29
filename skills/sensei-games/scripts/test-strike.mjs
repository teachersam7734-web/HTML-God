// test-strike.mjs: proves examples/strike.html, the turn-based patterns taken from Save The Damsel.
// HTML-Sensei's own code.
//
//   node test-strike.mjs [page.html]      default: ../examples/strike.html
//
// What it proves: the plate opens only after the dart's flight has finished, even with every WAAPI animation slowed
// to half speed; with the flight frozen (as in a hidden tab) the backstop still lands it; a restart while the dart
// is in the air never touches the new run; the plate's parent has perspective and does not clip; reduced motion runs the
// same steps with no animation; keyboard play to a loss and to a win.
// verified: Windows 10, Node 24, Playwright 1.63, installed Chrome 155 headless, strict file://.
// not verified: Firefox and Safari; a real hidden tab on a phone.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = fileUrl(process.argv[2] || path.join(HERE, '..', 'examples', 'strike.html'));
const { ok, summary } = checker();
const { browser: b } = await launch();
const errs = [];
const mk = async (ctxOpts = {}, init) => {
  const c = await b.newContext({ viewport: { width: 1100, height: 800 }, ...ctxOpts });
  if (init) await c.addInitScript(init);
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file); await p.waitForFunction(() => window.__ready); return { c, p };
};
// wrong answer index for the current question
const wrong = (p) => p.evaluate(() => { const r = __strike.run, keys = [1, 0, 0, 1, 0, 1]; return 1 - keys[r.i]; });
const right = (p) => p.evaluate(() => [1, 0, 0, 1, 0, 1][__strike.run.i]);
const waitIdle = (p) => p.waitForFunction(() => !document.getElementById('next').hidden || __strike.run.over, null, { timeout: 15000 });

try {
  // 1) slowed: every WAAPI animation at half speed (the field-log test); the hit must still wait for the flight.
  //    Keep the slowed flight well inside the backstop: at quarter speed (1680 ms against a 1920 ms backstop) the
  //    backstop won on this software-GL machine, which is the field log's warning about slowed tests, reproduced here.
  let { c, p } = await mk({}, () => { const a = Element.prototype.animate; Element.prototype.animate = function (k, o) { const an = a.call(this, k, o); an.playbackRate = 0.5; return an; }; });
  const t0 = Date.now(); await p.keyboard.press(String((await wrong(p)) + 1));
  await p.waitForFunction(() => __strike.events.some((e) => e.ev === 'open'), null, { timeout: 10000 });
  const ev = await p.evaluate(() => __strike.events);
  const open = ev.find((e) => e.ev === 'open'), land = ev.find((e) => e.ev === 'land');
  ok('slowed x2: the plate opens only when the flight has finished (landed on the animation clock, not a timer)', open.flight === 'finished' && land.by === 'finished', `${JSON.stringify(ev)} after ${Date.now() - t0} ms`);
  await waitIdle(p);
  ok('after the plate falls it is marked broken and the counter reads 1', await p.evaluate(() => document.querySelectorAll('.cell.was').length === 1 && document.getElementById('hits').textContent === '1'));
  const geo = await p.evaluate(() => { const cell = document.querySelector('.cell'), win = cell.querySelector('.win'); const s = getComputedStyle(cell); return { persp: s.perspective, overflow: s.overflow, win: getComputedStyle(win).overflow }; });
  ok('hinged plate: perspective on the plate\'s own parent, which does not clip; the picture clips in its own window', geo.persp !== 'none' && geo.overflow === 'visible' && geo.win === 'hidden', JSON.stringify(geo));
  await c.close();

  // 2) frozen flight (what a hidden tab does to animations): the backstop lands it
  ({ c, p } = await mk({}, () => { const a = Element.prototype.animate; Element.prototype.animate = function (k, o) { const an = a.call(this, k, o); if (this.classList.contains('dart')) an.pause(); return an; }; }));
  const t1 = Date.now(); await p.keyboard.press(String((await wrong(p)) + 1));
  await p.waitForFunction(() => __strike.events.some((e) => e.ev === 'open'), null, { timeout: 6000 });
  const ev2 = await p.evaluate(() => __strike.events);
  ok('frozen flight: the backstop lands the hit (flight + 1500 ms) and the game goes on', ev2.find((e) => e.ev === 'land').by === 'backstop', `${JSON.stringify(ev2)} after ${Date.now() - t1} ms`);
  await waitIdle(p);
  await c.close();

  // 3) restart while the dart is in the air: the old run's callbacks must not touch the new run
  ({ c, p } = await mk({}, () => { const a = Element.prototype.animate; Element.prototype.animate = function (k, o) { const an = a.call(this, k, o); an.playbackRate = 0.25; return an; }; }));
  await p.keyboard.press(String((await wrong(p)) + 1)); await p.waitForTimeout(200);
  await p.click('#again'); await p.waitForTimeout(2500);
  const fresh = await p.evaluate(() => ({ open: document.querySelectorAll('.cell.open,.cell.was').length, hits: document.getElementById('hits').textContent, darts: document.querySelectorAll('.dart').length, timers: __strike.run.timers.length }));
  ok('restart mid-flight: no plate opens in the new run, the counter stays 0, the dart is gone', fresh.open === 0 && fresh.hits === '0' && fresh.darts === 0, JSON.stringify(fresh));
  await c.close();

  // 4) keyboard play to a loss (four wrong answers), with the live region and focus on the result
  ({ c, p } = await mk());
  for (let k = 0; k < 4; k++) {
    await p.keyboard.press(String((await wrong(p)) + 1)); await waitIdle(p);
    if (k < 3) { await p.keyboard.press('Enter'); }
  }
  const lost = await p.evaluate(() => ({ over: __strike.run.over, h: document.querySelector('.end h2') && document.querySelector('.end h2').textContent, focus: document.activeElement.className, broken: document.querySelectorAll('.cell.was').length }));
  await p.waitForTimeout(150);
  const say = await p.evaluate(() => document.getElementById('live').textContent);
  ok('keyboard play: four wrong answers break four plates and end the run; focus moves to the result', lost.over && lost.h === 'Broken' && lost.focus === 'end' && lost.broken === 4, JSON.stringify(lost));
  ok('the result is announced in the polite live region', /^Broken\./.test(say), say);
  await c.close();

  // 5) reduced motion: same steps, no animation, still reaches a win
  ({ c, p } = await mk({ reducedMotion: 'reduce' }));
  await p.keyboard.press(String((await wrong(p)) + 1)); await waitIdle(p);
  const rm = await p.evaluate(() => ({ broken: document.querySelectorAll('.cell.was').length, darts: document.querySelectorAll('.dart').length, anims: document.getAnimations().length }));
  ok('reduced motion: a wrong answer breaks the plate with no dart and no running animation', rm.broken === 1 && rm.darts === 0 && rm.anims === 0, JSON.stringify(rm));
  for (let k = 0; k < 6; k++) {
    if (k > 0) { await p.keyboard.press(String((await right(p)) + 1)); await waitIdle(p); }
    if (k < 5) await p.click('#next');
  }
  ok('reduced motion: the run can be won (five right after one wrong)', await p.evaluate(() => __strike.run.over && document.querySelector('.end h2').textContent === 'Held'));
  await c.close();
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await b.close();
}
process.exitCode = summary();
