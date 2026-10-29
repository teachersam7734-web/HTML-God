#!/usr/bin/env node
// test-vt.mjs: self-test of the transition examples. Same-document and FLIP from strict file://; cross-document over
// http (a local server) AND over strict file://, because lane D5 reported that cross-document transitions ran on
// file:// in Chrome and this skill relies on knowing whether a double-clicked pair of pages gets them.
//
//   node test-vt.mjs        (Playwright and the browser discovered as in sensei-verify)
//
// Asserts: A. the hero group's keyframes start at the card's rectangle and end at the hero's; the forward type is
// active; focus lands on the detail heading and the title changes; back carries the back type, returns focus to the
// card and leaves no element holding the shared name; a second press mid-transition finishes the first and the page
// ends in the right state. B. reduced motion: no ViewTransition, the DOM still changes, focus still moves.
// C. cross-document over http and over strict file://: pagereveal receives a transition, it finishes, the new page
// carries the type set in pagereveal (forward, then back on return) and not the one added in pageswap; under reduced
// motion pagereveal has no transition. D. FLIP: the start transform equals the displacement and ends at none; an
// interrupted FLIP starts from the on-screen position (no jump); reduced motion animates nothing.
// Exit 0 when all pass, 1 otherwise.
//
// verified: Windows 10, Node 24, Chrome headless via playwright-core 1.62, swiftshader: every assertion passes.
// not verified: Firefox and Safari; rendered frames (assertions read keyframes, types and state).
// Origin: code-interaction/test-vt.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), turned into assertions and
// extended with the file:// run, focus, cleanup, the double press and the interrupted FLIP.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';
import { serve } from '../../sensei-verify/scripts/lib/server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ex = path.join(here, '..', 'examples');
let ok = 0, nok = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('ok   ' + name + (process.env.VERBOSE && extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } else { nok++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } };
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
const wait = ms => new Promise(r => setTimeout(r, ms));

const { browser } = await launch();
const srv = await serve(ex);
const errs = [];
async function page(opts = {}) { const c = await browser.newContext({ viewport: { width: 1000, height: 700 }, ...opts }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  p.on('response', r => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) errs.push(r.status() + ' ' + r.url()); }); return { c, p }; }
try {
  // A. same document
  let { c, p } = await page(); await p.goto(fileUrl(path.join(ex, 'vt-same.html')));
  const a = await p.evaluate(async () => {
    const card = document.querySelector('.card[data-i="1"]'); const cr = card.getBoundingClientRect();
    card.click(); const vt = document.activeViewTransition; await vt.ready;
    const an = document.getAnimations().find(x => String(x.effect.pseudoElement) === '::view-transition-group(hero)');
    const kf = an ? an.effect.getKeyframes().map(k => ({ w: parseFloat(k.width), h: parseFloat(k.height), t: k.transform })) : null;
    const types = [...vt.types]; await vt.finished;
    const hr = document.getElementById('hero').getBoundingClientRect();
    return { card: [cr.left, cr.top, cr.width, cr.height], hero: [hr.left, hr.top, hr.width, hr.height], kf, types, focus: document.activeElement.id, title: document.title, log: window.__log.slice() };
  });
  const m = s => (s || '').match(/matrix\(1, 0, 0, 1, ([-\d.]+), ([-\d.]+)\)/) || [];
  const k0 = a.kf && a.kf[0], k1 = a.kf && a.kf[a.kf.length - 1];
  check('hero group keyframes run from the card rectangle to the hero rectangle',
    k0 && near(k0.w, a.card[2]) && near(k0.h, a.card[3]) && near(+m(k0.t)[1], a.card[0]) && near(+m(k0.t)[2], a.card[1]) &&
    near(k1.w, a.hero[2]) && near(k1.h, a.hero[3]) && near(+m(k1.t)[1], a.hero[0]) && near(+m(k1.t)[2], a.hero[1]), a);
  check('forward type active, transition finished', a.types.join() === 'forward' && a.log.includes('finished'), a);
  check('focus moves to the detail heading and the title changes', a.focus === 'title' && a.title === 'Two | Gallery', a);
  const b = await p.evaluate(async () => {
    document.getElementById('back').click(); const vt = document.activeViewTransition; const types = [...vt.types];
    await vt.finished; await new Promise(r => setTimeout(r, 50));
    return { types, body: document.body.className, focus: document.activeElement.textContent, named: document.querySelectorAll('.vt-active').length, title: document.title };
  });
  check('back: back type, focus returns to the card, no element keeps the shared name', b.types.join() === 'back' && b.body === '' && b.focus === 'Two' && b.named === 0 && b.title === 'Gallery', b);
  const dbl = await p.evaluate(async () => {
    const card = document.querySelector('.card[data-i="0"]'); card.click(); const v1 = document.activeViewTransition;
    await v1.ready; document.getElementById('back').click(); const v2 = document.activeViewTransition;
    let r1 = 'pending'; await v1.finished.then(() => r1 = 'finished', () => r1 = 'aborted'); await v2.finished.catch(() => {});
    await new Promise(r => setTimeout(r, 50));
    return { r1, sameVT: v1 === v2, body: document.body.className, named: document.querySelectorAll('.vt-active').length };
  });
  check('a second press mid-transition finishes the first; the page ends on the gallery with no stray name', dbl.r1 === 'finished' && !dbl.sameVT && dbl.body === '' && dbl.named === 0, dbl);
  await c.close();

  // B. reduced motion
  ({ c, p } = await page({ reducedMotion: 'reduce' })); await p.goto(fileUrl(path.join(ex, 'vt-same.html')));
  const rm = await p.evaluate(() => { document.querySelector('.card').click(); return { vt: !!document.activeViewTransition, log: window.__log.slice(), body: document.body.className, focus: document.activeElement.id }; });
  check('reduced motion: no transition, the DOM changes, focus still moves', !rm.vt && rm.log.join() === 'no-vt' && rm.body === 'is-detail' && rm.focus === 'title', rm);
  await c.close();

  // C. cross document, over http and over strict file://
  for (const [label, base] of [['http', srv.origin + '/vt-multi/'], ['strict file://', fileUrl(path.join(ex, 'vt-multi')) + '/']]) {
    ({ c, p } = await page()); await p.goto(base + 'index.html'); await wait(300);
    await Promise.all([p.waitForURL('**/detail.html'), p.click('#go')]); await wait(900);
    const f = await p.evaluate(() => { let swap = null; try { swap = sessionStorage.getItem('pageswap-vt'); } catch (e) {} return { ...window.__reveal, swap }; });
    check(`cross-document (${label}): pagereveal has a transition that finishes, type forward, the old page's pageswap had one and its type is absent`, f && f.vt && f.finished === true && f.types.join() === 'forward' && f.swap === '1', f);
    await Promise.all([p.waitForURL('**/index.html'), p.click('#back')]); await wait(900);
    const g = await p.evaluate(() => window.__reveal);
    check(`cross-document (${label}): the return carries the back type`, g && g.vt && g.finished === true && g.types.join() === 'back', g);
    await c.close();
    ({ c, p } = await page({ reducedMotion: 'reduce' })); await p.goto(base + 'index.html'); await wait(300);
    await Promise.all([p.waitForURL('**/detail.html'), p.click('#go')]); await wait(500);
    const r = await p.evaluate(() => window.__reveal);
    check(`cross-document (${label}): reduced motion gives no transition`, r && r.vt === false, r);
    await c.close();
  }

  // D. FLIP
  ({ c, p } = await page()); await p.goto(fileUrl(path.join(ex, 'flip.html'))); await wait(200);
  const fl = await p.evaluate(async () => {
    const l = document.getElementById('l'), a = document.getElementById('a'), els = [...l.children];
    const before = a.getBoundingClientRect(); const pr = flip(els, () => l.appendChild(a), { duration: 300 });
    const after = a.getAnimations()[0] ? (a.getAnimations()[0].pause(), a.getBoundingClientRect()) : null;
    const startT = getComputedStyle(a).transform; a.getAnimations().forEach(x => x.play());
    await pr; const end = a.getBoundingClientRect();
    return { before: [before.left, before.top], startVisual: after && [after.left, after.top], startT, endT: getComputedStyle(a).transform, end: [end.left, end.top] };
  });
  check('FLIP starts where the tile was (inverse transform) and ends at none in its new place',
    fl.startVisual && near(fl.startVisual[0], fl.before[0]) && near(fl.startVisual[1], fl.before[1]) && fl.endT === 'none' && !near(fl.end[1], fl.before[1], 5), fl);
  const it = await p.evaluate(async () => {
    const l = document.getElementById('l'); const els = () => [...l.children];
    flip(els(), () => l.appendChild(l.firstElementChild), { duration: 600 });
    await new Promise(r => setTimeout(r, 200));
    const t = l.lastElementChild; const mid = t.getBoundingClientRect();
    const pr = flip(els(), () => l.insertBefore(t, l.firstElementChild), { duration: 600 });
    const an = t.getAnimations().find(x => x.id === 'flip'); an.pause(); an.currentTime = 0;
    const start = t.getBoundingClientRect(); an.play(); await pr;
    return { mid: [mid.left, mid.top], start: [start.left, start.top], running: t.getAnimations().length };
  });
  check('an interrupted FLIP starts from the on-screen position (no jump)', near(it.mid[0], it.start[0]) && near(it.mid[1], it.start[1]) && it.running === 0, it);
  await c.close();
  ({ c, p } = await page({ reducedMotion: 'reduce' })); await p.goto(fileUrl(path.join(ex, 'flip.html'))); await wait(200);
  const fr = await p.evaluate(() => { const l = document.getElementById('l'); const els = [...l.children]; flip(els, () => l.appendChild(l.firstElementChild)); return { anims: document.getAnimations().length, last: l.lastElementChild.id }; });
  check('FLIP under reduced motion: the change applies, nothing animates', fr.anims === 0 && fr.last === 'a', fr);
  await c.close();
  check('no page or console error', errs.length === 0, errs);
} finally { await browser.close(); await srv.close(); }
console.log(`\n${ok} passed, ${nok} failed`);
process.exit(nok ? 1 : 0);
