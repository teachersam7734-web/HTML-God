#!/usr/bin/env node
// test-landing.mjs: self-test of this skill against ../examples/landing.html and ../fixtures/bad-hero.html.
//
//   node test-landing.mjs        (Playwright, Chrome and axe-core discovered as in sensei-verify)
//
// Asserts: audit.mjs passes three themes in two languages and fails the bad fixture on network, contrast, overflow,
// target size, alt and lang; axe's label-content-name-mismatch rule (not in the gate's default tag set) flags the
// original lab's theme and language buttons (kept in the fixture) and passes the fixed page; the scroll-driven tiles
// start hidden and are shown after scrolling and in print; the tile hover lift really moves the tile while the reveal
// animation holds transform; the billing toggle works with no script; the FAQ is exclusive; reduced motion leaves no
// running animation and every headline word visible; the gradient emphasis paints on each split word; Persian sets
// rtl and fa and names the switch back in English; the marquee pause button pauses and reports it; the theme chip's
// name is its visible text; the designed theme switch (circle reveal, crossfade under Calm, two quick presses, Calm,
// both kept across a reload); Persian set in the embedded Vazirmatn; the spotlight follows the pointer.
// Exit 0 when all pass, 1 otherwise.
//
// verified: Windows 10, Node 24.16, Chrome 156 via playwright-core 1.64.1, axe-core 4.14.0: 30 of 30 pass.
// not verified: Firefox and Safari; touch devices (hover gating is asserted only for a fine pointer).
// Origin: code-ui/scrolltest.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), turned into assertions and extended.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, findAxe } from '../../sensei-verify/scripts/lib/discover.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = path.join(here, '..', 'examples', 'landing.html'), bad = path.join(here, '..', 'fixtures', 'bad-hero.html');
let ok = 0, nok = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('ok   ' + name); } else { nok++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } };

let r = spawnSync(process.execPath, [path.join(here, 'audit.mjs'), page, '--variants', 'theme=ink,theme=pulse,theme=paper,theme=ink&lang=fa,theme=pulse&lang=fa,theme=paper&lang=fa'], { encoding: 'utf8' });
check('audit passes three themes in two languages', r.status === 0, r.stdout + r.stderr);
r = spawnSync(process.execPath, [path.join(here, 'audit.mjs'), bad], { encoding: 'utf8' });
check('audit fails the bad fixture', r.status === 1, r.status);
for (const k of ['network:', 'contrast:', 'overflow:', 'targets under 24px', 'without alt', 'lang missing']) check(`bad fixture caught: ${k}`, r.stdout.includes(k), r.stdout);

let browser;
try {
  ({ browser } = await launch());
  const axePath = findAxe([here]);
  const mismatch = async url => {
    const p = await browser.newPage(); await p.goto(url); await p.waitForTimeout(400);
    await p.addScriptTag({ content: fs.readFileSync(axePath, 'utf8') });
    const res = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'rule', values: ['label-content-name-mismatch'] } })).violations.flatMap(v => v.nodes.map(n => n.target.join(' '))));
    await p.close(); return res;
  };
  if (axePath) {
    const b = await mismatch(fileUrl(bad));
    check('axe name-mismatch flags the original theme and language buttons', b.includes('#bTheme') && b.includes('#bLang'), b);
    check('axe name-mismatch passes the fixed page (English)', (await mismatch(fileUrl(page))).length === 0);
    check('axe name-mismatch passes the fixed page (Persian)', (await mismatch(fileUrl(page) + '?lang=fa')).length === 0);
  } else { nok++; console.log('FAIL axe-core not found: npm i -D axe-core, or set SENSEI_AXE'); }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); await p.goto(fileUrl(page) + '?theme=ink'); await p.waitForFunction('window.__done'); await p.waitForTimeout(500);
  const op = () => p.evaluate(() => [...document.querySelectorAll('.tile')].map(t => +(+getComputedStyle(t).opacity).toFixed(2)));
  const before = await op();
  await p.evaluate(() => document.getElementById('features').scrollIntoView()); await p.waitForTimeout(700);
  const after = await op();
  check('scroll-driven tiles start hidden and show after scrolling', before.every(v => v < 0.5) && after.slice(0, 3).every(v => v > 0.9), { before, after });
  const t0 = await p.evaluate(() => document.querySelector('.t2').getBoundingClientRect().top);
  await p.hover('.t2'); await p.waitForTimeout(600);
  const t1 = await p.evaluate(() => ({ top: document.querySelector('.t2').getBoundingClientRect().top, tr: getComputedStyle(document.querySelector('.t2')).translate }));
  check('tile hover lift moves the tile while the reveal holds transform', t0 - t1.top > 3 && t1.tr.includes('-4px'), { t0, t1 });
  await p.click('label:has(#bill-year)');
  check('billing toggle shows yearly prices with no script', (await p.evaluate(() => [...document.querySelectorAll('.plan .amt .yearly')].map(e => getComputedStyle(e).display))).every(d => d === 'inline'));
  await p.evaluate(() => { document.querySelectorAll('details')[1].open = true; }); await p.waitForTimeout(100);
  check('FAQ is exclusive', await p.evaluate(() => document.querySelectorAll('details[open]').length) === 1);
  const em = await p.evaluate(() => [...document.querySelectorAll('.hero h1 em .sk-w')].map(w => { const cs = getComputedStyle(w); return cs.backgroundClip + '|' + (cs.backgroundImage !== 'none'); }));
  check('gradient emphasis paints on each split word', em.length > 0 && em.every(s => s === 'text|true'), em);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
  await p.click('#bMq');
  check('marquee pause button pauses and reports it', await p.evaluate(() => ({ s: getComputedStyle(document.querySelector('.mq-track')).animationPlayState, a: document.getElementById('bMq').getAttribute('aria-pressed') })).then(x => x.s === 'paused' && x.a === 'true'));
  // the designed switch from sensei-tokens-theming: a circle reveal from the button, recorded while it runs
  await p.evaluate(() => { window.__vt = []; const o = document.startViewTransition.bind(document); document.startViewTransition = fn => { const vt = o(fn); vt.ready.then(() => new Promise(r => setTimeout(r, 0))).then(() => window.__vt.push({ mode: document.documentElement.dataset.vt, clip: document.getAnimations().some(a => a.effect && a.effect.pseudoElement === '::view-transition-new(root)') })); return vt; }; });
  await p.click('#bTheme'); await p.waitForTimeout(1000);
  const chip = await p.evaluate(() => { const b = document.getElementById('bTheme'); return { theme: document.documentElement.dataset.theme, text: b.textContent, aria: b.getAttribute('aria-label'), vt: window.__vt, left: document.documentElement.dataset.vt || null, stored: localStorage.getItem('lab-theme'), live: document.getElementById('live').textContent }; });
  check('theme chip cycles and its name is its visible text', chip.theme === 'pulse' && chip.text === 'Theme: Pulse' && chip.aria === null, chip);
  check('theme switch: a View Transition in reveal mode with the circle clip on the new snapshot, cleaned up after', chip.vt.length === 1 && chip.vt[0].mode === 'reveal' && chip.vt[0].clip && chip.left === null, chip);
  check('theme switch: stored under the tokens skill key and announced', chip.stored === 'pulse' && chip.live === 'Pulse look.', chip);
  // two presses 100 ms apart from the keyboard (a pointer press during a transition lands on the transition overlay)
  await p.focus('#bTheme'); await p.keyboard.press('Enter'); await p.waitForTimeout(100); await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
  const dbl = await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, vt: document.documentElement.dataset.vt || null }));
  check('a quick second press finishes the first and lands two steps on (pulse, paper, ink)', dbl.theme === 'ink' && dbl.vt === null, dbl);
  await p.click('#bCalm'); await p.waitForTimeout(500);
  const calm = await p.evaluate(() => ({ cls: document.documentElement.classList.contains('calm'), pressed: document.getElementById('bCalm').getAttribute('aria-pressed'), stored: localStorage.getItem('lab-calm'), modes: window.__vt.map(v => v.mode), running: document.getAnimations().filter(a => a.playState === 'running').length }));
  check('Calm chip: crossfade, pressed, stored, and nothing left running', calm.cls && calm.pressed === 'true' && calm.stored === '1' && calm.modes[calm.modes.length - 1] === 'fade' && calm.running === 0, calm);
  await p.click('#bTheme'); await p.waitForTimeout(500);
  check('under Calm the theme switch is a crossfade, not the circle', await p.evaluate(() => window.__vt[window.__vt.length - 1].mode) === 'fade');
  const beforeReload = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.goto(fileUrl(page)); await p.waitForFunction('window.__done');   // no ?theme= (a query wins over storage, for review links)
  const afterReload = await p.evaluate(() => ({ calm: document.documentElement.classList.contains('calm'), theme: document.documentElement.dataset.theme, pressed: document.getElementById('bCalm').getAttribute('aria-pressed'), stored: [localStorage.getItem('lab-theme'), localStorage.getItem('lab-calm')] }));
  check('Calm and the theme survive a reload (read before first paint)', afterReload.calm && afterReload.theme === beforeReload && afterReload.pressed === 'true', { beforeReload, afterReload });
  await p.click('#bCalm'); await p.waitForTimeout(500);
  await p.evaluate(() => localStorage.clear());
  await p.mouse.move(300, 200); await p.waitForTimeout(100); await p.mouse.move(420, 260); await p.waitForTimeout(150);
  await p.goto(fileUrl(page) + '?bg=spotlight'); await p.waitForFunction('window.__done');
  await p.mouse.move(200, 300); await p.mouse.move(640, 320); await p.waitForTimeout(200);
  check('spotlight follows a fine pointer', await p.evaluate(() => document.getElementById('spot').style.getPropertyValue('--mx')) !== '');
  await p.emulateMedia({ media: 'print' }); await p.goto(fileUrl(page)); await p.waitForTimeout(400);
  check('print shows every tile', (await op()).every(v => v === 1), await op());
  await ctx.close();

  const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const q = await rm.newPage(); await q.goto(fileUrl(page)); await q.waitForFunction('window.__done'); await q.waitForTimeout(300);
  const m = await q.evaluate(() => ({ running: document.getAnimations().length, words: [...document.querySelectorAll('.hero h1 .sk-w')].map(w => getComputedStyle(w).opacity) }));
  check('reduced motion: no running animation, every headline word visible', m.running === 0 && m.words.every(o => o === '1'), m);
  await rm.close();

  const fa = await browser.newPage(); await fa.goto(fileUrl(page) + '?lang=fa'); await fa.waitForFunction('window.__done');
  const f = await fa.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, btn: document.getElementById('bLang').textContent, btnLang: document.getElementById('bLang').lang }));
  check('Persian: rtl, fa, and the switch back is named in English', f.dir === 'rtl' && f.lang === 'fa' && f.btn === 'English' && f.btnLang === 'en', f);
  const face = await fa.evaluate(async () => { await document.fonts.ready; const h = document.querySelector('.hero h1'); return { family: getComputedStyle(h).fontFamily, loaded: [...document.fonts].some(x => x.family.replace(/"/g, '') === 'Vazirmatn' && x.status === 'loaded'), check: document.fonts.check('700 32px Vazirmatn', 'فارسی'), faq: document.querySelector('[data-i18n="a3"]').textContent }; });
  check('Persian text is set in the embedded Vazirmatn face, as the FAQ now says', /^"?Vazirmatn/.test(face.family) && face.loaded && face.check && /وزیرمتن/.test(face.faq), face);
  const enFace = await fa.evaluate(() => { document.getElementById('bLang').click(); return getComputedStyle(document.querySelector('.hero h1')).fontFamily; });
  check('English stays on the system stack', /^system-ui/.test(enFace), enFace);
  await fa.close();
  await browser.close();
} catch (e) { nok++; console.log('FAIL browser part could not run: ' + e.message); try { await browser?.close(); } catch {} }
console.log(`${ok} passed, ${nok} failed`);
process.exit(nok ? 1 : 0);
