// test-deck.mjs: the self-test of examples/deck.html in headless Chromium, strict file://. Scaling and centring, keyboard
// and fragments, held-key repeats, deep links, accessibility structure and axe-core, the FLIP morph in unscaled pixels,
// reduced motion, touch swipes through CDP, the presenter window (key and button), and print to PDF.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-presentations/scripts/test-deck.mjs          (PW, CHROME, SENSEI_AXE or SENSEI_NODE_MODULES as in pw.mjs)
//
// verified: Windows 10, Node 24, playwright-core 1.62.1, installed Chrome 155, axe-core 4.14.0: every check passes.
// not verified: Firefox and Safari; real touch hardware (touch is synthesised through CDP).
// Origin: code-apps/test-deck.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM and extended.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, findAxe, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = fileUrl(path.join(HERE, '..', 'examples', 'deck.html'));
const { ok, summary } = checker();
const L = { check: ok };
const axeFile = await findAxe();
const axeSrc = axeFile ? fs.readFileSync(axeFile, 'utf8') : null;
const st = (p) => p.evaluate(() => window.__deck.state);
const { browser: b } = await launch();
{
  // ---- scaling ----
  let c = await b.newContext({ viewport: { width: 1280, height: 720 } }); let p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file);
  let r = await p.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); return [b.x, b.y, b.width, b.height, window.__scale]; });
  L.check('16:9 viewport: stage fills it (1280x720 at scale 2/3)', Math.abs(r[0]) < 0.6 && Math.abs(r[1]) < 0.6 && Math.abs(r[2] - 1280) < 1 && Math.abs(r[3] - 720) < 1 && Math.abs(r[4] - 2 / 3) < 1e-6, r);
  await p.waitForFunction(() => window.__centred !== undefined);
  L.check('centre self-check: the viewport centre lands on the stage', await p.evaluate(() => window.__centred === true));
  await p.setViewportSize({ width: 1000, height: 1000 }); await p.waitForFunction(() => Math.abs(window.__scale - 1000 / 1920) < 1e-9);
  r = await p.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; });
  L.check('square viewport: letterboxed, centred vertically', Math.abs(r[0]) < 0.6 && Math.abs(r[2] - 1000) < 1 && Math.abs(r[3] - 562.5) < 1 && Math.abs(r[1] - 218.75) < 1, r);
  await p.setViewportSize({ width: 1280, height: 720 }); await p.waitForFunction(() => Math.abs(window.__scale - 2 / 3) < 1e-9);
  // CSS-only fit (no JS) gives the same number: tan(atan2()) division trick
  const css = await p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;width:calc(100vw*1);--k:tan(atan2(100vw,1920px));height:calc(var(--k)*1080px)'; document.body.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return h; });
  L.check('CSS-only unitless ratio (tan(atan2)) equals JS scale: 1280/1920*1080 = 720', Math.abs(css - 720) < 0.5, css);

  // ---- keyboard and fragments ----
  L.check('starts on slide 0', (await st(p)).i === 0);
  await p.evaluate(() => { const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: true, bubbles: true }); document.body.dispatchEvent(ev); });
  L.check('a repeated keydown (held key or clicker) does not move the deck', (await st(p)).i === 0);
  await p.keyboard.press('ArrowRight');
  L.check('Right -> slide 1 step 0', JSON.stringify(await st(p)) === '{"i":1,"n":0}');
  const vis = () => p.evaluate(() => [...document.querySelectorAll('.slide[data-state=current] .frag')].map((e) => getComputedStyle(e).visibility));
  L.check('fragments hidden at step 0', (await vis()).every((v) => v === 'hidden'), await vis());
  await p.keyboard.press('Space'); await p.waitForTimeout(350);
  L.check('step 1 shows exactly one', JSON.stringify(await vis()) === '["visible","hidden","hidden"]', await vis());
  await p.keyboard.press('Space'); await p.waitForTimeout(350);
  L.check('step 2 shows two with data-step=2 sharing the step', JSON.stringify(await vis()) === '["visible","visible","visible"]', await vis());
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(350);
  L.check('Left steps back one fragment before leaving the slide', JSON.stringify(await vis()) === '["visible","hidden","hidden"]' && (await st(p)).n === 1);
  L.check('hash mirrors state (#/2/1)', (await p.evaluate(() => location.hash)) === '#/2/1');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  L.check('Left from step 0 goes to previous slide', (await st(p)).i === 0);
  await p.keyboard.press('End');
  L.check('End -> last slide', (await st(p)).i === 4);
  await p.keyboard.press('ArrowLeft');
  L.check('Left from slide 5 lands on slide 4 (no fragments)', (await st(p)).i === 3);

  // ---- hash deep link and hashchange ----
  await p.goto(file + '#/2/2'); await p.waitForTimeout(100);
  L.check('deep link #/2/2 restores slide and step', JSON.stringify(await st(p)) === '{"i":1,"n":2}');
  await p.evaluate(() => { location.hash = '#/5'; }); await p.waitForTimeout(100);
  L.check('hashchange (Back button) drives the deck', (await st(p)).i === 4);

  // ---- a11y structure ----
  const a = await p.evaluate(() => ({ inert: [...document.querySelectorAll('.slide')].map((s) => s.inert), live: document.getElementById('live').textContent, label: document.querySelector('.slide[data-state=current]').getAttribute('aria-label') }));
  L.check('only the current slide is interactive (inert on the rest)', a.inert.filter((x) => !x).length === 1 && a.inert[4] === false, a.inert);
  L.check('live region announces slide', /5 of 5/.test(a.live), a.live);
  await p.goto(file + '#/2/2'); await p.waitForTimeout(100);
  if (!axeSrc) console.log('SKIP  axe-core (not found: npm i axe-core, or set SENSEI_AXE)');
  else {
    await p.evaluate(axeSrc);
    const ax = await p.evaluate(async () => (await axe.run(document)).violations.map((v) => v.id + ':' + v.nodes.length));
    L.check('axe-core on the current slide, every rule: no violations', ax.length === 0, ax.join(' '));
  }

  // ---- morph (auto-animate) ----
  await p.goto(file + '#/3'); await p.waitForTimeout(100);
  await p.keyboard.press('ArrowRight');
  const m = await p.evaluate(() => { const an = window.__anims && window.__anims[0]; if (!an) return null; const kf = an.effect.getKeyframes(); return { n: window.__anims.length, from: kf[0].transform, bg0: kf[0].backgroundColor, bg1: kf[1].backgroundColor }; });
  L.check('morph created for the data-id pair, first keyframe is an unscaled offset (-900px even at stage scale 2/3)', m && /translate\(-900px,/.test(m.from) && /scale\(0\.476/.test(m.from), m);
  await p.waitForTimeout(250);
  const mid = await p.evaluate(() => document.querySelector('.slide[data-state=current] .box').getBoundingClientRect().toJSON());
  await p.waitForTimeout(700);
  const end = await p.evaluate(() => document.querySelector('.slide[data-state=current] .box').getBoundingClientRect().toJSON());
  L.check('box is between start and end mid-flight, at the exact layout rect after', mid.width > end.width * 0.5 && mid.width < end.width * 1.01 && Math.abs(end.width - 420 * 2 / 3) < 0.6 && Math.abs(end.height - 120 * 2 / 3) < 0.6, { mid: mid.width, end: end.width });
  await c.close();

  // ---- reduced motion: no morph ----
  c = await b.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); p = await c.newPage(); await p.goto(file + '#/3'); await p.keyboard.press('ArrowRight');
  L.check('prefers-reduced-motion: no morph animation is created', (await p.evaluate(() => (window.__anims || []).length)) === 0);
  await c.close();

  // ---- touch swipe ----
  c = await b.newContext({ viewport: { width: 900, height: 506 }, hasTouch: true, isMobile: true }); p = await c.newPage(); await p.goto(file);
  const cdp = await c.newCDPSession(p);
  const swipe = async (x0, x1, y = 250) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 6, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(120);
  };
  await p.evaluate(() => { window.__ev = []; ['pointerdown','pointerup','pointercancel'].forEach((t) => document.getElementById('stage').addEventListener(t, (e) => window.__ev.push(t + ':' + e.pointerType))); });
  await swipe(700, 300);
  console.log('INFO events', await p.evaluate(() => window.__ev));
  const sw1 = (await st(p)).i;
  await swipe(300, 700);
  const sw2 = (await st(p)).i;
  console.log('INFO swipe left -> slide', sw1, ', swipe right -> slide', sw2);
  L.check('touch swipe left = next, swipe right = previous', sw1 === 1 && sw2 === 0);
  await c.close();

  // ---- presenter view ----
  c = await b.newContext({ viewport: { width: 1280, height: 720 } }); p = await c.newPage(); await p.goto(file);
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.keyboard.press('s')]);
  await pop.waitForLoadState(); await pop.waitForTimeout(300);
  L.check('presenter popup opened with ?presenter', /presenter/.test(pop.url()));
  await p.keyboard.press('ArrowRight'); await pop.waitForTimeout(250);
  let notes = await pop.evaluate(() => document.getElementById('pn').textContent);
  L.check('opener navigation shows that slide\'s notes in the presenter', /2\/5/.test(notes) && /Fragments reveal in DOM order/.test(notes), notes.slice(0, 60));
  await pop.click('#pnx'); await p.waitForTimeout(250);
  L.check('presenter Next drives the audience window', JSON.stringify(await st(p)) === '{"i":1,"n":1}', await st(p));
  L.check('presenter follows (state echoed back)', (await pop.evaluate(() => window.__deck.state)).n === 1);
  await pop.close();
  const [pop2] = await Promise.all([p.waitForEvent('popup'), p.click('#open-presenter')]);
  await pop2.waitForLoadState();
  L.check('the visible Presenter button opens the same window (popups need a gesture)', /presenter/.test(pop2.url()));
  await c.close();

  // ---- print / PDF ----
  c = await b.newContext({ viewport: { width: 1280, height: 720 } }); p = await c.newPage(); await p.goto(file);
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  const txt = pdf.toString('latin1');
  const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const mb = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(txt);
  L.check('PDF has one page per slide (5)', pages === 5, pages);
  L.check('PDF page is 16:9 (1920x1080 css px = 1440x810 pt)', mb && Math.abs(+mb[1] / +mb[2] - 16 / 9) < 0.01, mb && mb.slice(1, 3));
  await p.emulateMedia({ media: 'print' });
  const fr = await p.evaluate(() => [...document.querySelectorAll('.frag')].every((e) => getComputedStyle(e).visibility === 'visible'));
  L.check('print: every fragment visible', fr);
  await c.close();
  L.check('no page errors', errs.length === 0, errs);
  await b.close();
}
process.exitCode = summary();
