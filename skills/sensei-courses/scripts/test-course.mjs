// test-course.mjs: the self-test of the course engine (engine.js) through examples/course.html, in headless Chromium,
// strict file://. Question types by keyboard, feedback, retries, persistence, blocked and full storage, the progress
// code, versioned progress, accessibility (axe-core) and the grading functions.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-courses/scripts/test-course.mjs          (PW, CHROME, SENSEI_AXE or SENSEI_NODE_MODULES as in pw.mjs)
//
// verified: Windows 10, Node 24, playwright-core 1.62.1, installed Chrome 155, axe-core 4: every check passes.
// not verified: Firefox and Safari; screen-reader speech.
// Origin: code-apps/test-course.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM and extended.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, findAxe, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = fileUrl(path.join(HERE, '..', 'examples', 'course.html'));
const { ok, summary } = checker();
const axeFile = await findAxe();
const axeSrc = axeFile ? fs.readFileSync(axeFile, 'utf8') : null;
const axe = async (p, label) => {
  if (!axeSrc) { console.log('SKIP  axe-core ' + label + ' (axe-core not found: npm i axe-core, or set SENSEI_AXE)'); return; }
  await p.evaluate(axeSrc);
  const v = await p.evaluate(async () => (await axe.run(document)).violations.map((x) => x.id + ':' + x.nodes.length));
  ok('axe-core ' + label + ': no violations', v.length === 0, v.join(' '));
};
const { browser: b } = await launch();
const errs = [];
try {
  let c = await b.newContext({ viewport: { width: 800, height: 900 } }); let p = await c.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '#/l1'); await p.waitForTimeout(200);
  await axe(p, 'lesson 1 initial');

  // ---- grading units ----
  const g = await p.evaluate(() => {
    const G = CourseEngine.grade;
    return {
      multiAll: G.multi({ answer: [0, 2] }, [0, 2]).score, multiHalf: G.multi({ answer: [0, 2] }, [0]).score,
      multiPenalty: G.multi({ answer: [0, 2] }, [0, 1]).score, multiWrongOnly: G.multi({ answer: [0, 2] }, [1, 3]).score,
      gapCase: G.gap({ answer: ['detail'] }, '  DeTail ').ok, gapQuote: G.gap({ answer: ["don't"] }, 'don’t').ok,
      order: G.order({ answer: [0, 1, 2] }, [0, 2, 1]).score, match: G.match({ pairs: [['a', 'x'], ['b', 'y']] }, ['x', 'z']).score
    };
  });
  ok('multi-select: full, half, a wrong pick cancels a right one, never negative', g.multiAll === 1 && g.multiHalf === 0.5 && g.multiPenalty === 0 && g.multiWrongOnly === 0, g);
  ok('gap: case, spacing and curly apostrophe tolerant', g.gapCase && g.gapQuote);
  ok('order and match give partial credit', Math.abs(g.order - 1 / 3) < 1e-9 && g.match === 0.5, [g.order, g.match]);

  // ---- lesson 1 by keyboard ----
  await p.focus('fieldset[data-type=mcq] input'); await p.keyboard.press('ArrowDown');
  ok('radio group: an arrow selects option 2 natively (changes allowed until Check)', (await p.evaluate(() => document.querySelector('fieldset[data-type=mcq] input:checked').value)) === '1');
  await p.keyboard.press('Tab'); await p.keyboard.press('Enter');
  let fb = await p.evaluate(() => document.querySelector('.qwrap .fb').textContent);
  ok('feedback says Correct and carries the explanation', /^Correct\. Scanning targets/.test(fb), fb);
  ok('options locked after Check; the key is exposed to screen readers in words', await p.evaluate(() => [...document.querySelectorAll('fieldset[data-type=mcq] input')].every((i) => i.disabled) && /correct answer/.test(document.querySelector('fieldset[data-type=mcq]').textContent)));
  ok('feedback region is role=status and existed before it had text', await p.evaluate(() => document.querySelectorAll('.qwrap .fb[role=status]').length === 3));
  await p.focus('fieldset[data-type=tfng] input'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  await p.locator('.qwrap').nth(1).locator('button.check').click();
  fb = await p.locator('.qwrap').nth(1).locator('.fb').textContent();
  ok('True/False/Not Given: Not Given is a real answer', /^Correct\. Not Given/.test(fb), fb);
  await p.fill('[data-type=gap] input', 'banana');
  await p.locator('.qwrap').nth(2).locator('button.check').click();
  fb = await p.locator('.qwrap').nth(2).locator('.fb').textContent();
  ok('retry: says try again with attempts left and does NOT reveal the answer', /Try again \(1 left\)/.test(fb) && !/detail|fact/i.test(fb), fb);
  await p.fill('[data-type=gap] input', ' Detail ');
  await p.locator('.qwrap').nth(2).locator('button.check').click();
  const last = await p.evaluate(() => window.__last);
  ok('lesson completes with score 1 and status passed', last && last.score === 1 && last.status === 'passed', last);
  await axe(p, 'lesson 1 answered');
  await p.goto(file + '#/l2'); await p.waitForTimeout(150);
  await p.locator('.qwrap').first().locator('button.check').click();
  ok('empty submit is refused with guidance and uses no attempt', /Choose an answer first/.test(await p.locator('.qwrap .fb').first().textContent()));

  // ---- routing ----
  await p.goto(file + '#/nope'); await p.waitForTimeout(150);
  ok('an unknown lesson opens the first lesson under a corrected address', await p.evaluate(() => location.hash === '#/l1' && document.querySelector('main h2').textContent === 'Scanning'));

  // ---- persistence and the progress code ----
  await p.reload(); await p.waitForTimeout(200);
  const nav = await p.evaluate(() => document.querySelector('nav a[data-id=l1]').textContent);
  ok('progress survives a reload (the nav says passed)', /passed/.test(nav), nav);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('mini-course:progress')));
  ok('progress is stored as {schema: 1, lessons} under the course namespace', stored && stored.schema === 1 && stored.lessons.l1.status === 'passed', stored);
  await p.click('#save-open');
  const code = await p.inputValue('#save-code');
  ok('the dialog shows a portable code (CE1.*) and is modal', /^CE1\./.test(code) && await p.evaluate(() => document.getElementById('dlg-save').matches(':modal')), code.slice(0, 16));
  await p.fill('#save-code', 'not a code at all');
  await p.click('#load-go');
  ok('garbage is refused with words, and nothing is written', /could not be read/.test(await p.textContent('#save-out')) && await p.evaluate(() => JSON.parse(localStorage.getItem('mini-course:progress')).lessons.l1.status === 'passed'));
  await p.keyboard.press('Escape');
  ok('Escape closes the dialog and focus returns to its opener', await p.evaluate(() => !document.getElementById('dlg-save').open && document.activeElement.id === 'save-open'));
  await c.close();
  // the code restores into a fresh browser profile
  c = await b.newContext(); p = await c.newPage(); p.on('pageerror', (e) => errs.push('restore: ' + e.message));
  await p.goto(file + '#/l1'); await p.waitForTimeout(150);
  await p.click('#save-open'); await p.fill('#save-code', code); await p.click('#load-go');
  await p.waitForLoadState('load'); await p.waitForTimeout(700);
  ok('a progress code restores progress in a fresh profile', /passed/.test(await p.evaluate(() => document.querySelector('nav a[data-id=l1]').textContent)));
  await c.close();

  // ---- lesson 2: multi, order (Alt+Arrow and buttons), match ----
  c = await b.newContext({ viewport: { width: 800, height: 900 } }); p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '#/l2'); await p.waitForTimeout(200);
  await p.check('fieldset[data-type=multi] input[value="0"]'); await p.check('fieldset[data-type=multi] input[value="2"]');
  await p.locator('.qwrap').nth(0).locator('button.check').click();
  const order0 = await p.evaluate(() => [...document.querySelectorAll('[data-type=order] li')].map((l) => l.dataset.v).join());
  await p.focus('[data-type=order] li:first-child button'); await p.keyboard.press('Alt+ArrowDown');
  const order1 = await p.evaluate(() => [...document.querySelectorAll('[data-type=order] li')].map((l) => l.dataset.v).join());
  const live = await p.evaluate(() => document.querySelector('[data-type=order] [aria-live]').textContent);
  ok('order: Alt+ArrowDown moves the row and announces its new position', order0 === '2,1,0' && order1 === '1,2,0' && /position 2 of 3/.test(live), [order0, order1, live]);
  await p.click('[data-type=order] li:nth-child(3) button[data-d="-1"]'); await p.click('[data-type=order] li:nth-child(2) button[data-d="-1"]');
  const order2 = await p.evaluate(() => [...document.querySelectorAll('[data-type=order] li')].map((l) => l.dataset.v).join());
  ok('order: the buttons reach the target order', order2 === '0,1,2', order2);
  const sels = await p.$$('[data-type=match] select'); await sels[0].selectOption('Get the gist'); await sels[1].selectOption('Find a detail');
  await p.locator('.qwrap').nth(1).locator('button.check').click(); await p.locator('.qwrap').nth(2).locator('button.check').click();
  const l2 = await p.evaluate(() => window.__last);
  ok('lesson 2 recorded: score 1, passed', l2 && l2.id === 'l2' && l2.score === 1 && l2.status === 'passed', l2);
  await axe(p, 'lesson 2 answered (multi, order, match)');
  ok('the summary live region reports the lesson score', /Lesson score 100 per cent/.test(await p.textContent('#sum')));
  await c.close();

  // ---- blocked storage ----
  c = await b.newContext({ viewport: { width: 800, height: 900 } });
  await c.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  p = await c.newPage(); p.on('pageerror', (e) => errs.push('blocked: ' + e.message));
  await p.goto(file + '#/l1'); await p.waitForTimeout(200);
  await p.focus('fieldset[data-type=mcq] input'); await p.keyboard.press('ArrowDown'); await p.locator('.qwrap').first().locator('button.check').click();
  const bs = await p.evaluate(() => [__course.store.persistent, __course.store.cause(), document.getElementById('store-note').hidden, document.getElementById('store-note').textContent, document.getElementById('sum').textContent]);
  ok('storage blocked: works from memory, cause "blocked", the note says so', bs[0] === false && bs[1] === 'blocked' && bs[2] === false && /blocking storage/.test(bs[3]) && /this visit only/.test(bs[4]), bs[1]);
  await c.close();

  // ---- full storage: a write throws QuotaExceededError ----
  c = await b.newContext(); await c.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (String(k).indexOf('mini-course:') === 0) throw new DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); };
  });
  p = await c.newPage(); p.on('pageerror', (e) => errs.push('full: ' + e.message));
  await p.goto(file + '#/l1'); await p.waitForTimeout(150);
  await p.focus('fieldset[data-type=mcq] input'); await p.keyboard.press('ArrowDown'); await p.locator('.qwrap').first().locator('button.check').click();
  await p.check('fieldset[data-type=tfng] input[value="2"]'); await p.locator('.qwrap').nth(1).locator('button.check').click();
  await p.fill('[data-type=gap] input', 'x'); await p.locator('.qwrap').nth(2).locator('button.check').click(); await p.fill('[data-type=gap] input', 'y'); await p.locator('.qwrap').nth(2).locator('button.check').click();
  const fs2 = await p.evaluate(() => [__course.store.cause(), __course.store.persistent, document.getElementById('store-note').textContent, __course.progress.get('l1').status]);
  ok('storage full: cause "full", the note uses the full words, progress kept in memory', fs2[0] === 'full' && fs2[1] === false && /is full/.test(fs2[2]) && fs2[3] === 'attempted', fs2);
  await c.close();

  // ---- versioned progress: unversioned migrates, newer is never overwritten ----
  c = await b.newContext(); p = await c.newPage();
  await p.goto(file + '#/l1');
  await p.evaluate(() => localStorage.setItem('mini-course:progress', JSON.stringify({ l1: { status: 'passed', score: 1, tries: 1 } })));
  await p.reload(); await p.waitForTimeout(150);
  const mig = await p.evaluate(() => [JSON.parse(localStorage.getItem('mini-course:progress')), document.querySelector('nav a[data-id=l1]').textContent]);
  ok('unversioned progress (schema 0) is read and rewritten as schema 1', mig[0].schema === 1 && mig[0].lessons.l1.status === 'passed' && /passed/.test(mig[1]), mig[0]);
  const future = JSON.stringify({ schema: 9, lessons: { l1: { status: 'passed', score: 1, tries: 1, extra: 'from a newer build' } } });
  await p.evaluate((f) => localStorage.setItem('mini-course:progress', f), future);
  await p.reload(); await p.waitForTimeout(150);
  await p.goto(file + '#/l2'); await p.check('fieldset[data-type=multi] input[value="0"]'); await p.locator('.qwrap').nth(0).locator('button.check').click();
  const fut = await p.evaluate(() => [localStorage.getItem('mini-course:progress'), __course.progress.readOnly(), document.getElementById('store-note').hidden, document.getElementById('store-note').textContent]);
  ok('progress from a newer schema is left byte for byte, the session is read-only and says so', fut[0] === future && fut[1] === true && fut[2] === false && /newer version/.test(fut[3]));
  await c.close();

  ok('no page errors in any context (blocked, full, restore included)', errs.length === 0, errs.join(' | '));
} finally { await b.close(); }
process.exitCode = summary();
