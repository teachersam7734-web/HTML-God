#!/usr/bin/env node
// test-tokens.mjs: self-test of this skill: the token gate and scanner, and the behaviour of ../examples/tokens.html.
//
//   node test-tokens.mjs        (Playwright and Chrome discovered as in sensei-verify)
//
// Asserts: tokens.mjs check passes ink and paper and fails pulse-bad on exactly the four measured pairs (exit 1);
// scan counts the leaky fixture right; in the page: system dark gives ink and system light gives paper by the time the
// parser inserts <body> (so before any paint: no flash); light-dark() resolves to the dark value under ink; relative colour derives four distinct
// swatches; the typed @property animates (value changes between two reads); the switch runs View Transition pseudo
// animations and stores the theme; a second press mid-transition lands on the theme after next and leaves no stale
// data-vt; the canvas repaints with the new --brand; blocked storage still themes with no page error; reduced
// motion uses the fade (no circle clip) and stops the @property animation; Calm stops it too and survives a reload.
// Exit 0 when all pass, 1 otherwise.
//
// verified: Windows 10, Node 24, Chrome 155 via playwright-core 1.64: every assertion passes (SKILL.md section 8).
// not verified: Firefox and Safari; macOS and Linux.
// Origin: code-ui/ttest.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), turned into assertions and extended.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ex = f => path.join(here, '..', 'examples', f);
let ok = 0, bad = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('ok   ' + name); } else { bad++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } };

// ---- the gate and the scanner (no browser) ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-tokens-'));
let r = spawnSync(process.execPath, [path.join(here, 'tokens.mjs'), 'check', ex('themes.example.json'), '--json', path.join(tmp, 't.json')], { encoding: 'utf8' });
check('tokens check exits 1 on the bad theme', r.status === 1, r.status);
const rep = JSON.parse(fs.readFileSync(path.join(tmp, 't.json'), 'utf8'));
const fails = n => rep.themes[n].pairs.filter(p => p.status !== 'pass').map(p => `${p.f}/${p.g}`).sort();
check('ink and paper pass every pair', fails('ink').length === 0 && fails('paper').length === 0);
check('pulse-bad fails exactly the four measured pairs', JSON.stringify(fails('pulse-bad')) === JSON.stringify(['line/bg', 'line/surface', 'on-brand/brand', 'text-soft/surface']), fails('pulse-bad'));
r = spawnSync(process.execPath, [path.join(here, 'tokens.mjs'), 'build', ex('themes.example.json')], { encoding: 'utf8' });
check('build emits one block per theme', (r.stdout.match(/html\[data-theme="/g) || []).length === 3);
r = spawnSync(process.execPath, [path.join(here, 'tokens.mjs'), 'scan', path.join(here, '..', 'fixtures', 'leaky.css'), '--json', path.join(tmp, 's.json')], { encoding: 'utf8' });
const sc = JSON.parse(fs.readFileSync(path.join(tmp, 's.json'), 'utf8'));
check('scan: 2 token rules, 3 component overrides, 2 colour-named tokens', sc.tokenRules === 2 && sc.componentOverrides === 3 && sc.colourNamed.length === 2, sc);
fs.rmSync(tmp, { recursive: true, force: true });

// ---- the page ----
let browser;
try {
  ({ browser } = await launch());
  const url = fileUrl(ex('tokens.html'));
  for (const scheme of ['dark', 'light']) {
    const c = await browser.newContext({ colorScheme: scheme });
    // record the theme at the moment <body> is inserted by the parser: nothing can have painted before the body exists
    await c.addInitScript(() => { new MutationObserver((ms, o) => { if (document.body) { window.__first = document.documentElement.dataset.theme || '(none)'; o.disconnect(); } }).observe(document, { childList: true, subtree: true }); });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForFunction('window.__done');
    const want = scheme === 'dark' ? 'ink' : 'paper';
    check(`system ${scheme} gives ${want} before first paint`, await p.evaluate(() => window.__first) === want, await p.evaluate(() => window.__first));
    if (scheme === 'dark') {
      check('light-dark() resolves to the dark value under ink', await p.evaluate(() => getComputedStyle(document.querySelector('.note')).backgroundColor) === 'rgb(58, 51, 0)');
      const sw = await p.evaluate(() => [...document.querySelectorAll('.derive i')].map(i => getComputedStyle(i).backgroundColor));
      check('relative colour derives four distinct swatches', new Set(sw).size === 4, sw);
      const h = await p.evaluate(async () => { const g = () => getComputedStyle(document.querySelector('.hue')).getPropertyValue('--accent-h'); const a = g(); await new Promise(r => setTimeout(r, 900)); return [a, g()]; });
      check('typed @property animates', h[0] !== h[1], h);
      const before = await p.evaluate(() => document.getElementById('cv').dataset.painted);
      const s = await p.evaluate(async () => {
        document.getElementById('sw').click(); await new Promise(r => setTimeout(r, 150));
        const pseudo = [...new Set(document.getAnimations({ subtree: true }).map(a => a.effect && a.effect.pseudoElement).filter(Boolean))];
        const clip = document.getAnimations({ subtree: true }).some(a => a.effect && a.effect.getKeyframes().some(k => k.clipPath));
        await new Promise(r => setTimeout(r, 1000));
        return { theme: document.documentElement.dataset.theme, pseudo, clip, stored: localStorage.getItem('lab-theme'), vt: document.documentElement.getAttribute('data-vt'), painted: document.getElementById('cv').dataset.painted };
      });
      check('switch runs view-transition pseudo animations with a circle clip', s.pseudo.includes('::view-transition-new(root)') && s.clip, s);
      check('switch applies and stores paper, cleans data-vt', s.theme === 'paper' && s.stored === 'paper' && s.vt === null, s);
      check('canvas repainted from the new --brand', s.painted && s.painted !== before, [before, s.painted]);
      const d = await p.evaluate(async () => {
        const b = document.getElementById('sw'); b.click(); await new Promise(r => setTimeout(r, 120)); b.click();
        await new Promise(r => setTimeout(r, 1100));
        return { theme: document.documentElement.dataset.theme, vt: document.documentElement.getAttribute('data-vt'), label: b.textContent };
      });
      check('second press mid-transition lands two themes on, no stale data-vt', d.theme === 'ink' && d.vt === null, d);
      check('switch is named by state and action', d.label === 'Ink look. Switch to Paper', d.label);
    }
    check(`no page errors (${scheme})`, errs.length === 0, errs);
    await c.close();
  }
  {
    const c = await browser.newContext({ colorScheme: 'light' });
    await c.addInitScript(() => { new MutationObserver((ms, o) => { if (document.body) { window.__first = document.documentElement.dataset.theme; o.disconnect(); } }).observe(document, { childList: true, subtree: true }); });
    const p = await c.newPage(); await p.goto(fileUrl(path.join(here, '..', 'fixtures', 'late-theme.html'))); await p.waitForFunction('window.__done');
    check('the late-theme fixture is caught showing ink first under a light system', await p.evaluate(() => window.__first) === 'ink');
    await c.close();
  }
  {
    const c = await browser.newContext({ colorScheme: 'light' });
    await c.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForFunction('window.__done');
    check('blocked storage: themed, no page error', await p.evaluate(() => document.documentElement.dataset.theme) === 'paper' && errs.length === 0, errs);
    await c.close();
  }
  {
    const c = await browser.newContext({ reducedMotion: 'reduce' });
    const p = await c.newPage(); await p.goto(url + '?theme=ink'); await p.waitForFunction('window.__done');
    const m = await p.evaluate(async () => {
      const hue = document.getAnimations().filter(a => a.animationName === 'hue').length;
      document.getElementById('sw').click(); await new Promise(r => setTimeout(r, 60));
      const vt = document.documentElement.getAttribute('data-vt');
      const clip = document.getAnimations({ subtree: true }).some(a => a.effect && a.effect.getKeyframes().some(k => k.clipPath));
      await new Promise(r => setTimeout(r, 400));
      return { hue, vt, clip, theme: document.documentElement.dataset.theme };
    });
    check('reduced motion: no hue loop, fade not circle, theme applied', m.hue === 0 && m.vt === 'fade' && !m.clip && m.theme === 'paper', m);
    await c.close();
  }
  {
    const c = await browser.newContext();
    const p = await c.newPage(); await p.goto(url + '?theme=ink'); await p.waitForFunction('window.__done');
    await p.click('#calm'); await p.waitForTimeout(500);
    const a = await p.evaluate(() => ({ pressed: document.getElementById('calm').getAttribute('aria-pressed'), hue: document.getAnimations().filter(x => x.animationName === 'hue').length }));
    await p.reload(); await p.waitForFunction('window.__done');
    const b = await p.evaluate(() => ({ calm: document.documentElement.classList.contains('calm'), hue: document.getAnimations().filter(x => x.animationName === 'hue').length }));
    check('Calm stops the loop, is pressed, and survives a reload', a.pressed === 'true' && a.hue === 0 && b.calm && b.hue === 0, [a, b]);
    await c.close();
  }
  await browser.close();
} catch (e) { bad++; console.log('FAIL browser part could not run: ' + e.message); try { await browser?.close(); } catch {} }
console.log(`${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
