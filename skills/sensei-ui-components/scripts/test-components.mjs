// test-components.mjs: proves every behaviour of examples/components.html in a real browser, left to right and right
// to left, plus reduced motion and forced colours. HTML-Sensei's own code.
//
//   node test-components.mjs [page.html]      (default: ../examples/components.html)
//
// verified: Windows 10, Node 24, playwright-core 1.64, installed Chrome 156 headless, strict file://.
// not verified: Firefox, Safari, phones, screen readers; the script fallbacks (Chrome 156 has every native feature).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const page_ = process.argv[2] || path.join(HERE, '..', 'examples', 'components.html');
const { ok, summary } = checker();
const { browser } = await launch();

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, ...opts });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(fileUrl(page_)); await p.waitForFunction('window.__done === true');
  return { p, ctx, errors };
}
const active = p => p.evaluate(() => document.activeElement && document.activeElement.id || document.activeElement.textContent.trim());
const box = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }, sel);

try {
  for (const dir of ['ltr', 'rtl']) {
    const { p, ctx, errors } = await fresh();
    if (dir === 'rtl') await p.click('#dir-btn');
    ok(`${dir}: direction set`, await p.evaluate(() => getComputedStyle(document.body).direction) === dir);

    // Menu: opens, first item focused, arrows move, Escape closes and returns focus, placed by its anchor.
    await p.click('#menu-btn'); await p.waitForTimeout(300);
    ok(`${dir}: menu opens`, await p.evaluate(() => document.getElementById('menu').matches(':popover-open')));
    ok(`${dir}: first item focused on open`, (await active(p)) === 'Duplicate', await active(p));
    await p.keyboard.press('ArrowDown');
    ok(`${dir}: ArrowDown moves to the next item`, (await active(p)) === 'Archive');
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp');
    ok(`${dir}: ArrowUp wraps to the last item`, (await active(p)) === 'Share');
    const b = await box(p, '#menu-btn'), m = await box(p, '#menu');
    ok(`${dir}: menu sits below its button`, m.t >= b.b && m.t - b.b < 20, `gap ${Math.round(m.t - b.b)} px`);
    ok(`${dir}: menu aligned to the button's start edge`, dir === 'ltr' ? Math.abs(m.l - b.l) < 2 : Math.abs(m.r - b.r) < 2,
      dir === 'ltr' ? `left ${Math.round(m.l)} vs ${Math.round(b.l)}` : `right ${Math.round(m.r)} vs ${Math.round(b.r)}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(`${dir}: Escape closes the menu`, !(await p.evaluate(() => document.getElementById('menu').matches(':popover-open'))));
    ok(`${dir}: focus back on the menu button`, (await active(p)) === 'menu-btn', await active(p));
    // Choosing an item announces it in the live region.
    await p.click('#menu-btn'); await p.waitForTimeout(250); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    ok(`${dir}: item announced in the toast region`, (await p.textContent('#toast')) === 'Duplicated');
    ok(`${dir}: toast region is a polite status`, await p.evaluate(() => { const t = document.getElementById('toast'); return t.getAttribute('role') === 'status' && t.getAttribute('aria-live') === 'polite'; }));
    // Light dismiss: a click outside closes it.
    await p.click('#menu-btn'); await p.waitForTimeout(250); await p.mouse.click(5, 880); await p.waitForTimeout(250);
    ok(`${dir}: click outside closes the menu`, !(await p.evaluate(() => document.getElementById('menu').matches(':popover-open'))));

    // Tooltip: opens on keyboard focus (interest), above its button.
    await p.focus('#tip-btn'); await p.waitForTimeout(1200);
    const tipOpen = await p.evaluate(() => document.getElementById('tip').matches(':popover-open'));
    ok(`${dir}: tooltip opens on focus`, tipOpen);
    if (tipOpen) { const tb = await box(p, '#tip-btn'), tt = await box(p, '#tip'); ok(`${dir}: tooltip sits above its button`, tt.b <= tb.t + 1, `gap ${Math.round(tb.t - tt.b)} px`); }
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // Dialog: invoker opens it modal, focus inside, Escape closes, focus returns, the rest of the page inert while open.
    await p.click('#open-dlg'); await p.waitForTimeout(300);
    ok(`${dir}: dialog opens modal`, await p.evaluate(() => document.getElementById('dlg').open && document.getElementById('dlg').matches(':modal')));
    ok(`${dir}: autofocus on Cancel`, (await active(p)) === 'dlg-cancel', await active(p));
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    ok(`${dir}: Tab stays inside the dialog`, await p.evaluate(() => !!document.activeElement.closest('dialog') || document.activeElement === document.body), await active(p));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(`${dir}: Escape closes the dialog`, !(await p.evaluate(() => document.getElementById('dlg').open)));
    ok(`${dir}: focus back on the opener`, (await active(p)) === 'open-dlg', await active(p));
    await p.click('#open-dlg'); await p.waitForTimeout(250); await p.click('#dlg-ok'); await p.waitForTimeout(250);
    ok(`${dir}: returnValue read on close`, (await p.textContent('#dlg-result')) === 'Project deleted.');

    // Accordion: one open at a time, keyboard toggles.
    await p.click('#q2 summary'); await p.waitForTimeout(350);
    ok(`${dir}: opening one closes the other`, await p.evaluate(() => document.getElementById('q2').open && !document.getElementById('q1').open));
    await p.focus('#q3 summary'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
    ok(`${dir}: Enter opens a summary`, await p.evaluate(() => document.getElementById('q3').open && !document.getElementById('q2').open));
    const h = await p.evaluate(() => document.querySelector('#q3 p').getBoundingClientRect().height);
    ok(`${dir}: opened content has height`, h > 10, `${Math.round(h)} px`);

    // Tabs: arrows follow the writing direction, Home and End, one tab stop.
    await p.focus('#t1');
    await p.keyboard.press(dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft');
    ok(`${dir}: the forward arrow selects the next tab`, (await active(p)) === 't2' && await p.evaluate(() => !document.getElementById('p2').hidden && document.getElementById('p1').hidden));
    await p.keyboard.press('End'); ok(`${dir}: End selects the last tab`, (await active(p)) === 't3');
    await p.keyboard.press('Home'); ok(`${dir}: Home selects the first tab`, (await active(p)) === 't1');
    await p.keyboard.press(dir === 'ltr' ? 'ArrowLeft' : 'ArrowRight'); ok(`${dir}: the back arrow wraps to the last tab`, (await active(p)) === 't3');
    ok(`${dir}: one tab stop in the tablist`, await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].filter(t => t.tabIndex === 0).length === 1));
    await p.keyboard.press('Tab');
    ok(`${dir}: Tab leaves the tablist for the panel`, (await active(p)) === 'p3', await active(p));

    // Select is styleable where supported, and still a real select.
    ok(`${dir}: select keeps its value`, (await p.evaluate(() => document.getElementById('speed').value)) === 'Lively');
    ok(`${dir}: no console errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // Reduced motion: no movement left in the menu transition; accordion has no size transition.
  {
    const { p, ctx } = await fresh({ reducedMotion: 'reduce' });
    const t = await p.evaluate(() => getComputedStyle(document.getElementById('menu')).transitionProperty);
    ok('reduced motion: menu transition has no translate', !/translate/.test(t), t);
    const d = await p.evaluate(() => getComputedStyle(document.querySelector('#q1'), '::details-content').transitionProperty);
    ok('reduced motion: accordion has no block-size transition', !/block-size/.test(d), d);
    await ctx.close();
  }
  // Forced colours: every control keeps a visible border.
  {
    const { p, ctx } = await fresh({ forcedColors: 'active' });
    const edges = await p.evaluate(() => [...document.querySelectorAll('.btn, select, [role=tab][aria-selected=true]')].map(e => getComputedStyle(e).borderTopStyle !== 'none' && parseFloat(getComputedStyle(e).borderTopWidth) > 0));
    ok('forced colours: every button, select and the selected tab keeps a border', edges.every(Boolean), `${edges.filter(Boolean).length} of ${edges.length}`);
    await ctx.close();
  }
} finally { await browser.close(); }
process.exit(summary());
