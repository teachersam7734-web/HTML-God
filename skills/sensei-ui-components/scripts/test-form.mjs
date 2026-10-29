// test-form.mjs: proves examples/form.html in a real browser, strict file://. HTML-Sensei's own code.
//
//   node test-form.mjs [page.html]      (default: ../examples/form.html)
//
// Sections: validation and accessible errors; Persian, RTL and digits; the offline submit (saved here only, nothing
// sent, copy, download, mailto); storage blocked; the hosted submit through Playwright's request routing (success only
// on 2xx, failure states keep the entry, no data in the URL, no success while sending); reduced motion; the form.name
// trap. Nothing is written outside the OS temp folder; the download lands in Playwright's own temporary folder.
//
// verified: Windows 10, Node 24.16, playwright-core 1.64.1, installed Chrome 156 headless, strict file://.
// not verified: a real server and CORS; Firefox, Safari, phones and their autofill; screen-reader speech.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = process.argv[2] || path.join(HERE, '..', 'examples', 'form.html');
const { ok, summary } = checker();
const { browser } = await launch();
const ENDPOINT = 'https://forms.example.test/sign-up';

async function fresh(opts = {}, init) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, ...opts });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(fileUrl(PAGE)); await p.waitForFunction('window.__done === true');
  return { p, ctx, errors };
}
const attr = (p, sel, a) => p.evaluate(([s, n]) => document.querySelector(s).getAttribute(n), [sel, a]);
const text = (p, sel) => p.evaluate(s => document.querySelector(s).textContent.trim(), sel);
const active = p => p.evaluate(() => document.activeElement && document.activeElement.id);
const fillValid = async p => {
  await p.fill('#f-name', 'Sara Ahmadi'); await p.fill('#f-email', 'sara@example.com');
  await p.selectOption('#f-course', 'ielts'); await p.check('#f-ok');
};
const statusSettled = p => p.waitForTimeout(250);

try {
  // 1. validation and accessible errors
  {
    const { p, ctx, errors } = await fresh();
    await p.click('#submit'); await statusSettled(p);
    ok('empty submit: name, email, course and consent marked aria-invalid', (await Promise.all(['#f-name', '#f-email', '#f-course', '#f-ok'].map(s => attr(p, s, 'aria-invalid')))).every(v => v === 'true'));
    ok('empty submit: the optional phone is not marked invalid', (await attr(p, '#f-tel', 'aria-invalid')) === 'false');
    ok('empty submit: focus moves to the first invalid field', (await active(p)) === 'f-name', await active(p));
    ok('error text is in the element aria-describedby names', (await attr(p, '#f-name', 'aria-describedby')).split(' ').includes('f-name-err') && (await text(p, '#f-name-err')) === 'Enter your name.');
    ok('summary: in a live region present from load, with the count and one link per problem', (await attr(p, '#summary', 'role')) === 'alert' && /4 problems/.test(await text(p, '#summary h2')) && (await p.locator('#summary a').count()) === 4);
    await p.click('#summary li:nth-child(3) a');
    ok('summary link focuses its field', (await active(p)) === 'f-course', await active(p));
    await p.fill('#f-name', 'S'); await p.fill('#f-email', 'not-an-email'); await p.click('#submit'); await statusSettled(p);
    ok('too short and wrong type get their own messages', (await text(p, '#f-name-err')) === 'Your name needs at least 2 letters.' && (await text(p, '#f-email-err')) === 'Enter an email address like name@example.com.');
    await p.fill('#f-name', 'Sara'); await p.locator('#f-name').blur();
    ok('after the first try, a field re-validates on blur', (await attr(p, '#f-name', 'aria-invalid')) === 'false' && await p.evaluate(() => document.getElementById('f-name-err').hidden));
    ok('nothing announced as success while the form is invalid', (await text(p, '#status')) === '');
    ok('no page errors', errors.length === 0, errors);
    await ctx.close();
  }
  // 2. Persian, RTL, digits
  {
    const { p, ctx } = await fresh();
    await p.click('#lang');
    ok('language switch: html lang fa, dir rtl, labels translated', (await p.evaluate(() => [document.documentElement.lang, document.documentElement.dir].join())) === 'fa,rtl' && (await text(p, 'label[for=f-name]')) === 'نام شما');
    ok('the switch button names the other language in that language', (await text(p, '#lang')) === 'English' && (await attr(p, '#lang', 'lang')) === 'en');
    await p.click('#submit'); await statusSettled(p);
    ok('errors and summary in Persian, the count in Persian digits', (await text(p, '#f-name-err')) === 'نام خود را وارد کنید.' && (await text(p, '#summary h2')) === 'فرم ۴ مشکل دارد');
    await p.fill('#f-tel', '۰۹۱۲ ۳۴۵ ۶۷۸۹'); await p.locator('#f-tel').blur();
    ok('Persian digits with spaces normalise to ASCII and validate', (await p.inputValue('#f-tel')) === '09123456789' && (await attr(p, '#f-tel', 'aria-invalid')) === 'false', await p.inputValue('#f-tel'));
    await p.fill('#f-tel', '٠٩١٢٣٤٥٦٧٨٩'); await p.locator('#f-tel').blur();
    ok('Arabic-Indic digits normalise too', (await p.inputValue('#f-tel')) === '09123456789');
    await p.fill('#f-tel', '۱۲۳'); await p.locator('#f-tel').blur();
    ok('too few digits: a Persian message', (await attr(p, '#f-tel', 'aria-invalid')) === 'true' && /۷ تا ۱۵/.test(await text(p, '#f-tel-err')));
    ok('email and phone stay left to right inside the RTL page', (await p.evaluate(() => ['f-email', 'f-tel'].map(i => getComputedStyle(document.getElementById(i)).direction).join())) === 'ltr,ltr');
    await p.click('#lang');
    ok('switching back re-renders the current errors in English', (await text(p, '#f-name-err')) === 'Enter your name.');
    await ctx.close();
  }
  // 3. offline submit: saved here only, honest status, copy, download, mailto
  {
    const { p, ctx, errors } = await fresh({ permissions: ['clipboard-read', 'clipboard-write'] });
    const requests = []; p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
    await fillValid(p); await p.fill('#f-tel', '+98 912 345 6789'); await p.click('#submit'); await statusSettled(p);
    const st = await text(p, '#status');
    ok('offline: status says saved on this device only and nothing sent', /Saved on this device only/.test(st) && /Nothing has been sent/.test(st), st);
    ok('offline: no network request at all', requests.length === 0, requests);
    ok('offline: no form data in the URL', (await p.evaluate(() => location.search + location.hash)) === '');
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('sensei-form-entries') || '[]'));
    ok('offline: the entry is in localStorage', saved.length === 1 && saved[0].email === 'sara@example.com' && saved[0].tel === '989123456789', saved);
    ok('offline: copy, download and email actions shown, with the mailto note', await p.isVisible('#actions') && await p.isVisible('#mail-note'));
    const href = await attr(p, '#mail', 'href');
    ok('mailto: address, subject and body encoded', href.startsWith('mailto:school%40example.com?subject=Course%20sign-up&body=') && decodeURIComponent(href.split('body=')[1]).includes('Course: IELTS preparation'), href.slice(0, 120));
    await p.click('#copy'); await statusSettled(p);
    const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(e => 'ERR ' + e.message);
    ok('copy: the entry text is on the clipboard and the status says so', clip.includes('Email: sara@example.com') && (await text(p, '#status')) === 'Copied to the clipboard.', clip.slice(0, 80));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#download')]);
    const body = fs.readFileSync(await dl.path(), 'utf8');
    ok('download: a text file with the entry', dl.suggestedFilename() === 'course-sign-up.txt' && body.includes('Name: Sara Ahmadi'), dl.suggestedFilename());
    ok('offline: no page errors', errors.length === 0, errors);
    await ctx.close();
  }
  // 4. storage blocked (private modes, sandboxed frames): honest message, still copyable
  {
    const { p, ctx } = await fresh({}, () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }, configurable: true }); });
    await fillValid(p); await p.click('#submit'); await statusSettled(p);
    const st = await text(p, '#status');
    ok('storage blocked: says nothing was saved and nothing was sent, offers copy and download', /nothing was saved and nothing was sent/.test(st) && await p.isVisible('#actions'), st);
    await ctx.close();
  }
  // 5. hosted submit, through Playwright's routing (no real server)
  {
    const run = async (handler, extra = async () => {}) => {
      const { p, ctx, errors } = await fresh();
      const seen = [];
      await p.route(ENDPOINT, async route => { seen.push({ method: route.request().method(), url: route.request().url(), body: route.request().postData() }); await handler(route); });
      await p.evaluate(u => { document.getElementById('signup').dataset.endpoint = u; }, ENDPOINT);
      await fillValid(p);
      await extra(p);
      return { p, ctx, errors, seen };
    };
    let release;
    const gate = new Promise(r => { release = r; });
    const a = await run(async route => { await gate; await route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' }); });
    await a.p.click('#submit'); await a.p.waitForTimeout(200);
    ok('hosted: while sending, a sending status, aria-busy, no success text', /Sending/.test(await text(a.p, '#status')) && (await attr(a.p, '#signup', 'aria-busy')) === 'true' && (await attr(a.p, '#submit', 'aria-disabled')) === 'true');
    // force: Playwright treats aria-disabled as disabled and would wait (here until the page's own 15 s timeout).
    await a.p.click('#submit', { force: true }); await a.p.waitForTimeout(100);
    release(); await a.p.waitForTimeout(400);
    ok('hosted: a second press while sending sends nothing more', a.seen.length === 1, a.seen.length);
    ok('hosted: POST with a JSON body, no query string', a.seen[0].method === 'POST' && !a.seen[0].url.includes('?') && JSON.parse(a.seen[0].body).email === 'sara@example.com');
    ok('hosted: success only after the 2xx answer, then the form resets', /confirmed it received/.test(await text(a.p, '#status')) && (await a.p.inputValue('#f-name')) === '' && (await attr(a.p, '#signup', 'aria-busy')) === null);
    ok('hosted: no data in the page URL', (await a.p.evaluate(() => location.search)) === '');
    await a.ctx.close();

    const b = await run(route => route.fulfill({ status: 500, body: 'oops' }));
    await b.p.click('#submit'); await b.p.waitForTimeout(500);
    const bs = await text(b.p, '#status');
    ok('hosted 500: "not sent", the status code, the entry kept in the form, copy offered', /^Not sent: the server answered 500/.test(bs) && (await b.p.inputValue('#f-name')) === 'Sara Ahmadi' && await b.p.isVisible('#actions'), bs);
    ok('hosted 500: no success wording anywhere', !/confirmed|Sent:/.test(bs));
    await b.ctx.close();

    const c = await run(route => route.abort('internetdisconnected'));
    await c.p.click('#submit'); await c.p.waitForTimeout(500);
    ok('hosted, no connection: "not sent: no connection to the server", entry kept', /^Not sent: no connection to the server/.test(await text(c.p, '#status')) && (await c.p.inputValue('#f-email')) === 'sara@example.com');
    await c.p.click('#lang'); await c.p.waitForTimeout(200);
    ok('hosted failure re-renders in Persian on a language switch', /^فرستاده نشد: اتصال به سرور برقرار نشد/.test(await text(c.p, '#status')), await text(c.p, '#status'));
    await c.ctx.close();
  }
  // 6. reduced motion: invalid fields do not move
  {
    const { p, ctx } = await fresh({ reducedMotion: 'reduce' });
    await p.click('#submit'); await p.waitForTimeout(50);
    ok('reduced motion: no animation runs on invalid fields', (await p.evaluate(() => document.getAnimations().length)) === 0);
    await ctx.close();
    const n = await fresh({ reducedMotion: 'no-preference' });
    await n.p.click('#submit'); await n.p.waitForTimeout(50);
    ok('without the preference the nudge does run (so the test above means something)', (await n.p.evaluate(() => document.getAnimations().length)) > 0);
    await n.ctx.close();
  }
  // 7. the form.name trap the example avoids
  {
    const { p, ctx } = await fresh();
    ok('form.name is the input named "name", not a string: read controls through form.elements', await p.evaluate(() => { const f = document.getElementById('signup'); return f.name instanceof HTMLInputElement && f.elements.namedItem('name') === f.name; }));
    await ctx.close();
  }
} finally {
  await browser.close();
}
process.exit(summary());
