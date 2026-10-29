// test-typography.mjs: proves examples/kinetic.html, splitkit.js, kinetickit.js and (when Python with fontTools is
// found) fontembed.py and font-coverage.py. HTML-Sensei's own code, rebuilt from the UI research lane's ktest.js.
//
//   node test-typography.mjs [--no-python]
//
// Python: env PYTHON, else python3, python or py on PATH; needs fontTools and brotli (pip install fonttools brotli).
// verified: Windows 10, Node 24, playwright-core 1.64, installed Chrome 156 headless, strict file://; Python 3.13,
//           fontTools 4.63.
// not verified: Firefox, Safari; macOS and Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const PAGE = path.join(SKILL, 'examples', 'kinetic.html');
const FONT = path.join(SKILL, 'assets', 'vazirmatn-fa-latin.woff2');
const { ok, summary } = checker();
const { browser } = await launch();

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, ...opts });
  const p = await ctx.newPage(); const errors = [], external = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', q => { if (!/^(file|data|blob|about):/.test(q.url())) external.push(q.url()); });
  await p.goto(fileUrl(PAGE)); await p.waitForFunction('window.__done === true');
  return { p, ctx, errors, external };
}
// Fonts Chrome actually used for an element's text (CSS.getPlatformFontsForNode).
async function usedFonts(p, sel) {
  const s = await p.context().newCDPSession(p);
  await s.send('DOM.enable'); await s.send('CSS.enable');
  const { root } = await s.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await s.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
  const { fonts } = await s.send('CSS.getPlatformFontsForNode', { nodeId });
  await s.detach(); return fonts.map(f => f.familyName);
}

try {
  // ---------- normal run ----------
  {
    const { p, ctx, errors, external } = await open();
    ok('font loaded from the shipped subset', await p.evaluate(() => [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Vazirmatn' && f.status === 'loaded')));

    // Splitting matrix: width against the unsplit string (joining kept means no growth).
    const w = await p.evaluate(() => {
      const T = 'یادگیری خواندن کارآگاه';
      const mk = (fn) => { const e = document.createElement('div'); e.dir = 'rtl'; e.lang = 'fa';
        e.style.cssText = 'font:700 40px Vazirmatn;position:absolute;white-space:nowrap;inline-size:max-content;top:0;left:0;visibility:hidden';
        e.textContent = T; document.body.append(e); if (fn) fn(e); const r = e.getBoundingClientRect().width; e.remove(); return +r.toFixed(2); };
      const naive = e => { const words = e.textContent.split(' '); e.textContent = '';
        words.forEach((wd, k) => { const ws = document.createElement('span'); ws.style.whiteSpace = 'nowrap';
          for (const c of wd) { const s = document.createElement('span'); s.style.display = 'inline-block'; s.textContent = c; ws.append(s); }
          e.append(ws); if (k < words.length - 1) e.append(' '); }); };
      return { base: mk(), words: mk(e => splitText(e, { by: 'words' })), zwj: mk(e => splitText(e, { by: 'chars', cursive: 'zwj' })),
        inline: mk(e => splitText(e, { by: 'chars', cursive: 'inline' })), charsDefault: mk(e => splitText(e, { by: 'chars' })), naive: mk(naive) };
    });
    const d = k => Math.abs(w[k] - w.base);
    ok('naive per-letter inline-block breaks joining (the trap reproduces)', w.naive - w.base > 40, `+${(w.naive - w.base).toFixed(1)} px`);
    ok('split by words keeps the width', d('words') < 1, `${d('words').toFixed(2)} px`);
    ok('per-letter with joiners keeps the width', d('zwj') < 1, `${d('zwj').toFixed(2)} px`);
    ok('per-letter inline spans keep the width', d('inline') < 1, `${d('inline').toFixed(2)} px`);
    ok('by:"chars" on Persian falls back to words', d('charsDefault') < 1, `${d('charsDefault').toFixed(2)} px`);
    ok('Persian in the page drawn with Vazirmatn', (await usedFonts(p, '#a3 .sk-vis')).includes('Vazirmatn'));

    // Inline spans cannot be transformed.
    ok('transform on an inline span moves nothing', await p.evaluate(() => { const s = document.querySelector('#a4 .sk-c.sk-inl'); s.style.animation = 'none';
      const a = s.getBoundingClientRect().left; s.style.transform = 'translateX(50px)'; return Math.abs(s.getBoundingClientRect().left - a) < .5; }));
    // Accessibility structure and revert.
    ok('one real copy of the text, the moving copy aria-hidden', await p.evaluate(() => { const e = document.getElementById('a2');
      return e.querySelector('.sk-sr').textContent === 'یادگیری خواندن مانند یک کارآگاه' && e.querySelector('.sk-vis').getAttribute('aria-hidden') === 'true'; }));
    ok('the ARIA tree reads the sentence once', (await p.locator('#a1').ariaSnapshot()).includes('Learn to read like a detective'));
    ok('revert() restores the original text', await p.evaluate(() => { const e = document.getElementById('a3'); const t = e.getAttribute('data-sk-text'); window.__sk.r3.revert(); return e.innerHTML === t; }));
    ok('gradient sits on each split word, not the parent', await p.evaluate(() => getComputedStyle(document.querySelector('#a1 .sk-w')).backgroundClip === 'text' && getComputedStyle(document.getElementById('a1')).backgroundClip !== 'text'));

    // Scramble.
    ok('scramble is deterministic for seed and time', await p.evaluate(() => kineticKit.scrambleAt('Hello world', 200, { seed: 9 }) === kineticKit.scrambleAt('Hello world', 200, { seed: 9 })));
    ok('scramble resolves to the final text', await p.evaluate(() => kineticKit.scrambleAt('Hello world', 5000, {}) === 'Hello world'));
    ok('scramble keeps spaces and ZWNJ', await p.evaluate(() => { const s = kineticKit.scrambleAt('می‌خواهم x', 10, { charset: kineticKit.SETS.persian }); return s.includes('‌') && s.includes(' '); }));
    ok('Persian scramble frames use only Persian letters', await p.evaluate(() => { const set = new Set([...kineticKit.SETS.persian, ' ', ...'رمزگشایی متن']);
      for (let t = 0; t < 1500; t += 37) for (const c of kineticKit.scrambleAt('رمزگشایی متن', t, { charset: kineticKit.SETS.persian, seed: 3 })) if (!set.has(c)) return false; return true; }));
    await p.waitForTimeout(1600);
    ok('live scramble ends on the real text', (await p.textContent('#s1')) === 'DECODE THE PASSAGE' && (await p.textContent('#s2')) === 'رمزگشایی متن');
    ok('scramble box width reserved', await p.evaluate(() => parseFloat(document.getElementById('s1').style.minInlineSize) > 100));

    // Fluid type.
    ok('fluid() output', (await p.evaluate(() => kineticKit.fluid(18, 40, 360, 1440))) === 'clamp(1.125rem, 0.6667rem + 2.037vw, 2.5rem)');
    const sizes = [];
    for (const vw of [360, 900, 1440]) { await p.setViewportSize({ width: vw, height: 900 });
      sizes.push(await p.evaluate(f => { const e = document.createElement('p'); e.style.fontSize = f; document.body.append(e); const s = parseFloat(getComputedStyle(e).fontSize); e.remove(); return +s.toFixed(1); }, 'clamp(1.125rem, 0.6667rem + 2.037vw, 2.5rem)')); }
    ok('fluid sizes 18, about 29, 40 px at 360, 900, 1440', sizes[0] === 18 && Math.abs(sizes[1] - 29) < 0.6 && sizes[2] === 40, sizes.join(', '));
    await p.setViewportSize({ width: 1200, height: 900 });

    // Variable weight: naive box changes width, fixed box does not.
    const vw = await p.evaluate(() => {
      const naive = document.createElement('span'); naive.className = 'vwn'; naive.lang = 'fa'; naive.textContent = 'کتابخانه';
      naive.style.cssText = 'display:inline-block;font-size:3rem;animation:vw 3s ease-in-out infinite alternate'; document.querySelector('main').append(naive);
      const anims = document.getAnimations(); anims.forEach(a => a.pause());
      const at = (sel, t) => { anims.forEach(a => { if (a.animationName === 'vw') a.currentTime = t; }); return +document.querySelector(sel).getBoundingClientRect().width.toFixed(1); };
      const r = { naive: [at('.vwn', 0), at('.vwn', 3000)], fixed: [at('#vw2', 0), at('#vw2', 3000)] }; naive.remove(); anims.forEach(a => a.play()); return r;
    });
    ok('naive weight animation changes the width (the trap reproduces)', Math.abs(vw.naive[0] - vw.naive[1]) > 3, vw.naive.join(' to '));
    ok('fixed box keeps one width from weight 100 to 900', vw.fixed[0] === vw.fixed[1], vw.fixed.join(' to '));

    // Marquee seam and pause.
    const mq = await p.evaluate(() => [...document.querySelectorAll('.mq-track')].map(el => { const w = el.getBoundingClientRect().width, h = el.firstElementChild.getBoundingClientRect().width; return Math.abs(w / 2 - h); }));
    ok('marquee: -50% is exactly one copy (seamless), both directions', mq.every(x => x < 0.5), mq.map(x => x.toFixed(2)).join(', '));
    await p.click('#mq-toggle');
    ok('pause button stops both marquees', await p.evaluate(() => [...document.querySelectorAll('.mq-track')].every(t => getComputedStyle(t).animationPlayState === 'paused')));
    ok('pause button state announced', (await p.getAttribute('#mq-toggle', 'aria-pressed')) === 'true');

    // Wipe direction at mid-time.
    const wipe = await p.evaluate(() => { const out = {};
      for (const id of ['w1', 'w2']) { const el = document.getElementById(id); const a = el.getAnimations()[0]; a.pause(); a.currentTime = 700;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el).clipPath; out[id] = cs; a.play(); }
      return out; });
    const nums = s => (s.match(/inset\(([^)]*)\)/) || ['', ''])[1].split(/\s+/).map(parseFloat);
    const [t1, r1, b1, l1] = nums(wipe.w1), [t2, r2, b2, l2] = nums(wipe.w2);
    ok('LTR wipe hides the end (right) side mid-way', r1 > 1 && !(l1 > 0.01), wipe.w1);
    ok('RTL wipe hides the end (left) side mid-way', l2 > 1 && !(r2 > 0.01), wipe.w2);

    // Text on a path: the recommended recipe is visible; direction="rtl" on a left-to-right path is the trap.
    const tp = await p.evaluate(() => {
      const box = id => { const b = document.getElementById(id).getBBox(); return { x: b.x, w: b.width }; };
      const svg = document.querySelectorAll('svg')[1]; const ns = 'http://www.w3.org/2000/svg';
      const t = document.createElementNS(ns, 'text'); t.setAttribute('direction', 'rtl'); const pth = document.createElementNS(ns, 'textPath');
      pth.setAttribute('href', '#arc'); pth.setAttribute('direction', 'rtl'); pth.textContent = 'متن فارسی روی مسیر منحنی'; t.append(pth); svg.append(t);
      const trap = { x: t.getBBox().x, w: t.getBBox().width, len: t.getComputedTextLength() }; t.remove();
      return { en: box('tp-en'), fa: box('tp-fa'), trap };
    });
    ok('Persian on a path, centred, visible inside the frame', tp.fa.w > 150 && tp.fa.x > 0 && tp.fa.x + tp.fa.w < 800, `x ${tp.fa.x.toFixed(0)} w ${tp.fa.w.toFixed(0)}`);
    console.log(`      info: direction="rtl" on a left-to-right path gave bbox x ${tp.trap.x.toFixed(0)} w ${tp.trap.w.toFixed(0)} (research: invisible)`);

    // Digits: ss01 turns Latin digits into Persian ones (compared as pixels).
    const shot = async sel => (await p.locator(sel).screenshot()).toString('base64');
    ok('ss01 draws Persian digits for Latin input', (await shot('#d1')) !== (await shot('#d2')));
    const dg = await p.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.font = '700 40px Vazirmatn';
      const typed = c.measureText('۲۰۲۶').width; c.font = '700 40px Vazirmatn'; const latin = c.measureText('2026').width; return { typed, latin }; });
    console.log(`      info: canvas widths, typed Persian digits ${dg.typed.toFixed(1)} px, Latin digits ${dg.latin.toFixed(1)} px`);
    // Monospace with Persian, and drop caps.
    ok('monospace stack: Persian drawn with Vazirmatn, not a fixed-pitch fallback', (await usedFonts(p, '#m1')).includes('Vazirmatn'), (await usedFonts(p, '#m1')).join(', '));
    ok('drop cap on English only', await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('dc-en'), '::first-letter').fontSize) > 40
      && parseFloat(getComputedStyle(document.getElementById('dc-fa'), '::first-letter').fontSize) === parseFloat(getComputedStyle(document.getElementById('dc-fa')).fontSize)));
    ok('Persian letter-spacing is 0', await p.evaluate(() => getComputedStyle(document.getElementById('a2')).letterSpacing === 'normal' || getComputedStyle(document.getElementById('a2')).letterSpacing === '0px'));

    ok('no console errors', errors.length === 0, errors.join(' | '));
    ok('no network requests', external.length === 0, external.join(' '));
    await ctx.close();
  }
  // ---------- reduced motion ----------
  {
    const { p, ctx } = await open({ reducedMotion: 'reduce' });
    ok('reduced motion: every split unit visible at time zero', (await p.evaluate(() => Math.min(...[...document.querySelectorAll('.sk-w,.sk-c')].map(e => +getComputedStyle(e).opacity)))) === 1);
    ok('reduced motion: marquee stopped and wrapped', await p.evaluate(() => [...document.querySelectorAll('.mq-track')].every(t => getComputedStyle(t).animationName === 'none')));
    ok('reduced motion: wipe shows the whole line', await p.evaluate(() => getComputedStyle(document.getElementById('w1')).clipPath === 'none'));
    ok('reduced motion: scramble shows the real text', (await p.textContent('#s1')) === 'DECODE THE PASSAGE');
    ok('reduced motion: no running animations', await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length === 0));
    await ctx.close();
  }
} finally { await browser.close(); }

// ---------- Python: subsetting and coverage ----------
if (!process.argv.includes('--no-python')) {
  const cands = [process.env.PYTHON, 'python3', 'python', 'py'].filter(Boolean);
  const py = cands.find(c => spawnSync(c, ['-I', '-c', 'import fontTools, brotli'], { encoding: 'utf8' }).status === 0);
  if (!py) console.log('SKIP  python tests: no Python with fontTools and brotli (pip install fonttools brotli)');
  else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'type-test-'));
    const run = (args) => spawnSync(py, ['-I', ...args], { encoding: 'utf8' });
    const cov = path.join(HERE, 'font-coverage.py');
    let r = run([cov, FONT, PAGE]);
    ok('coverage: shipped subset covers the example page', r.status === 0, r.stdout.trim().split('\n').pop());
    // A subset from the "Arabic" range only, and one with an empty feature list: both must be flagged.
    const mk = (out, unicodes, feats) => run(['-c', `from fontTools import subset; from fontTools.ttLib import TTFont
o=subset.Options(); o.flavor='woff2'; o.layout_features=${feats}; o.name_IDs=[0,1,2,3,4,5,6,13,14]
f=TTFont(r'''${FONT}'''); s=subset.Subsetter(o); s.populate(unicodes=subset.parse_unicodes('${unicodes}')); s.subset(f); f.flavor='woff2'; f.save(r'''${out}''')`]);
    const arabicOnly = path.join(tmp, 'arabic-only.woff2'), noFeat = path.join(tmp, 'no-features.woff2');
    mk(arabicOnly, 'U+0020-007E,U+0621-063A,U+0641-064A', "['*']");
    mk(noFeat, 'U+0020-007E,U+0600-06FF,U+200C-200F', '[]');
    r = run([cov, arabicOnly, PAGE]);
    ok('coverage: "Arabic range only" subset flagged, Persian letters named', r.status === 1 && /U\+067E/.test(r.stdout) && /U\+06CC/.test(r.stdout) && /U\+06AF/.test(r.stdout));
    r = run([cov, noFeat, PAGE]);
    ok('coverage: empty feature list flagged (no joining features)', r.status === 1 && /JOINING FEATURES MISSING/.test(r.stdout));
    // fontembed: CSS, woff2 and TTF outputs, licence records kept.
    const woff = path.join(tmp, 'sub.woff2'), ttf = path.join(tmp, 'sub.ttf');
    r = run([path.join(HERE, 'fontembed.py'), FONT, 'Test', '--weight', '400', '--out', woff, '--ttf', ttf]);
    ok('fontembed: prints a data-URI @font-face', r.status === 0 && /^@font-face\{font-family:"Test";font-style:normal;font-weight:400;font-display:block;src:url\(data:font\/woff2;base64,/.test(r.stdout), r.stderr.trim());
    ok('fontembed: woff2 and TTF written', fs.existsSync(woff) && fs.existsSync(ttf) && fs.statSync(ttf).size > fs.statSync(woff).size);
    r = run([cov, woff, '--text', 'می‌خواهم کتاب بخوانم ۱۲۳']);
    ok('fontembed output keeps copyright and licence records and joining', r.status === 0, r.stdout.trim().split('\n').pop());
    // The TTF loads in the browser (troika and some tools need TTF).
    const b2 = (await launch()).browser;
    try {
      const pg = await b2.newPage(); await pg.goto('about:blank');
      const b64 = fs.readFileSync(ttf).toString('base64');
      ok('TTF output loads as a web font', await pg.evaluate(async b => { const f = new FontFace('T', Uint8Array.from(atob(b), c => c.charCodeAt(0)).buffer); await f.load(); return f.status === 'loaded'; }, b64));
    } finally { await b2.close(); }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
process.exit(summary());
