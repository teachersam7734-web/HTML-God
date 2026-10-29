// test-build-single.mjs: proves build-single.mjs and the order lesson. Everything is written under SENSEI_WORK.
//   node test-build-single.mjs        (needs Playwright and Chrome, discovered as in sensei-verify)
// 1. the course-shape example builds with fonts grouped by content hash and a real film; the file passes
//    sensei-verify's gate in strict file:// and the film plays from its inert block after a click;
// 2. every refusal fires and writes nothing; inline.mjs refuses leftover placeholders too;
// 3. the order lesson, measured: the same 60 MB payload, once after the app script with a direct boot() (good) and once
//    in <head> with boot on DOMContentLoaded (bad). Good boots before DOMContentLoaded and paints early; bad does not.
// verified: Windows 10, Node 24, installed Chrome through playwright-core 1.62 (all checks pass; timings printed).
// not verified: macOS, Linux, phones, other browsers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from '../../sensei-verify/scripts/lib/discover.mjs';
import { runGate } from '../../sensei-verify/scripts/sensei-gate.mjs';
import { WORK, ensurePkg, FIXTURES } from './work.mjs';
import { build } from './build-single.mjs';
import { inline } from './inline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.resolve(HERE, '..', 'examples', 'course-shape');
let fails = 0; const check = (n, ok, d) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? '  [' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 220) + ']' : '')); };
const copyEx = name => {
  const d = path.join(WORK, name); fs.mkdirSync(path.join(d, 'media'), { recursive: true }); fs.mkdirSync(path.join(d, 'fonts'), { recursive: true });
  for (const f of ['template.html', 'app.js', 'style.css', 'lessons.json', 'build.json']) fs.copyFileSync(path.join(EX, f), path.join(d, f));
  return d;
};
const setManifest = (d, fn) => { const f = path.join(d, 'build.json'); const m = JSON.parse(fs.readFileSync(f, 'utf8')); fn(m); fs.writeFileSync(f, JSON.stringify(m, null, 2)); return f; };

// 1. the example
{
  const d = copyEx('course');
  fs.copyFileSync(path.join(ensurePkg(), 'clip.webm'), path.join(d, 'media', 'film.webm'));
  fs.copyFileSync(path.join(FIXTURES, 'test-font.woff2'), path.join(d, 'fonts', 'read.woff2'));
  const man = setManifest(d, m => { m.slots.FONTS.faces = [{ family: 'Read', path: 'fonts/read.woff2', weight: 400 }, { family: 'Read', path: 'fonts/read.woff2', weight: 700 }]; });
  const r = build(man);
  check('example builds with no errors', !r.errors.length && fs.existsSync(r.out), r.errors);
  check('fonts grouped by content hash: two faces, one embed with a weight range', r.warnings.some(w => /2 faces listed, 1 distinct/.test(w)) && /font-weight:400 700/.test(fs.readFileSync(r.out, 'utf8')), r.warnings);
  const html = fs.readFileSync(r.out, 'utf8');
  check('no placeholder left in the output', !/\/\*__[A-Z0-9_]+__\*\//.test(html));
  check('</script> inside the lesson JSON is escaped', html.includes('\\u003c/script>') && (html.match(/<\/script>/gi) || []).length === (html.match(/<script\b/gi) || []).length);
  const steps = path.join(d, 'steps.json');
  fs.writeFileSync(steps, JSON.stringify([{ do: 'text', has: '3 lessons ready.' }, { do: 'click', sel: '#play' }, { do: 'wait', ms: 1500 },
    { do: 'eval', expr: "document.getElementById('video').readyState >= 1 && !!document.getElementById('video').duration", expect: 'true' }]));
  const { out } = await runGate({ _: [r.out], project: d, widths: [375, 1280], settle: 400, noFull: true, steps });
  const bad = out.results.filter(x => x.status === 'fail' || x.status === 'warn').map(x => `${x.id}: ${x.summary}`);
  check('built file passes the gate in strict file:// (no fail)', out.verdict !== 'fail', bad.join(' | '));
  check('the film decodes from its inert block and plays after the click', (out.results.find(x => x.id === 'steps') || {}).status === 'pass', bad.join(' | '));
  check('no external request', (out.results.find(x => x.id === 'offline-self-contained') || {}).status === 'pass');
}

// 2. refusals
{
  const d = copyEx('refuse');
  const tryBuild = (label, fn, re) => { const man = setManifest(d, fn); const out = path.join(d, 'dist', 'course.html'); if (fs.existsSync(out)) fs.unlinkSync(out); const r = build(man); check(`refuses ${label}`, r.errors.some(e => re.test(e)) && !fs.existsSync(out), r.errors); setManifest(d, m => Object.assign(m, JSON.parse(fs.readFileSync(path.join(EX, 'build.json'), 'utf8')))); };
  tryBuild('a slot whose token is not in the template', m => { m.slots.NOPE = { path: 'app.js', kind: 'js' }; }, /slot NOPE: no/);
  tryBuild('a missing file that is not optional', m => { m.slots.FILM.optional = false; }, /missing file media\/film.webm/);
  tryBuild('a path outside the project folder', m => { m.slots.CSS.path = '../outside.css'; }, /escapes the project folder/);
  fs.writeFileSync(path.join(d, 'vendor.js'), 'var x = "</script>";');
  fs.writeFileSync(path.join(d, 'template.html'), fs.readFileSync(path.join(EX, 'template.html'), 'utf8').replace('</body>', '<script type="text/x-lib">/*__LIB__*/</script>\n</body>'));
  tryBuild('inert-js holding </script', m => { m.slots.LIB = { path: 'vendor.js', kind: 'inert-js' }; }, /would end its inert/);
  fs.writeFileSync(path.join(d, 'template.html'), fs.readFileSync(path.join(EX, 'template.html'), 'utf8').replace('<header>', '<header><img alt="" src="/*__GHOST__*/">'));
  tryBuild('a placeholder nobody replaced', () => {}, /never replaced: GHOST/);
  fs.copyFileSync(path.join(EX, 'template.html'), path.join(d, 'template.html'));
  const out = path.join(d, 'dist', 'course.html'); if (fs.existsSync(out)) fs.unlinkSync(out);
  const c = build(path.join(d, 'build.json'), { check: true });
  check('--check validates and writes nothing', !c.errors.length && !fs.existsSync(out), c.errors);
  fs.writeFileSync(path.join(d, 'ghost.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><title>g</title><img alt="" src="/*__LOGO__*/">');
  check('inline.mjs also refuses a leftover placeholder', inline(path.join(d, 'ghost.html')).log.placeholders.includes('LOGO'));
}

// 3. the order lesson, measured
{
  const payload = crypto.randomBytes(45 * 1048576);                    // 45 MB of bytes, 60 MB of base64 text
  const waitForDcl = d => {                                            // the app's direct boot() becomes a DOMContentLoaded listener
    const f = path.join(d, 'app.js'), src = fs.readFileSync(f, 'utf8'), at = src.lastIndexOf('  boot();');
    fs.writeFileSync(f, src.slice(0, at) + "  document.addEventListener('DOMContentLoaded', boot);" + src.slice(at + '  boot();'.length));
  };
  const variant = (name, bad, dclOnly = false) => {
    const d = copyEx(name); fs.writeFileSync(path.join(d, 'media', 'film.webm'), payload);
    if (dclOnly) waitForDcl(d);
    if (bad) {
      let t = fs.readFileSync(path.join(d, 'template.html'), 'utf8');
      const block = t.match(/<script type="application\/x-sensei-film"[^\n]*<\/script>\n/)[0];
      t = t.replace(block, '').replace('</head>', block + '</head>');
      fs.writeFileSync(path.join(d, 'template.html'), t);
      waitForDcl(d);
    }
    return build(path.join(d, 'build.json'));
  };
  const good = variant('order-good', false), bad = variant('order-bad', true), wait = variant('order-dcl', false, true);
  check('good order builds without order warnings', !good.errors.length && !good.warnings.some(w => /inert|DOMContentLoaded/.test(w)), good.warnings);
  check('bad order is warned about (payload in head, boot on DOMContentLoaded)', bad.warnings.some(w => /in <head>/.test(w)) && bad.warnings.some(w => /sits before an executable script/.test(w)), bad.warnings);
  check('payload at the end but boot on DOMContentLoaded is warned about', wait.warnings.some(w => /waits for DOMContentLoaded/.test(w)), wait.warnings);
  const { browser } = await launch();
  const measure = async file => {
    const rows = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext(); const p = await ctx.newPage();
      await p.goto(fileUrl(file), { waitUntil: 'load', timeout: 120000 });
      await p.waitForFunction('window.__done === true', null, { timeout: 60000 }); await p.waitForTimeout(600);
      rows.push(await p.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        return { fcp: fcp ? Math.round(fcp.startTime) : null, booted: Math.round(window.__marks.booted), dcl: Math.round(nav.domContentLoadedEventStart) }; }));
      await ctx.close();
    }
    return rows;
  };
  { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(fileUrl(good.out)); await p.waitForTimeout(500); await c.close(); }   // warm-up: the first navigation of a fresh browser is slow
  const g = await measure(good.out), b = await measure(bad.out), w = await measure(wait.out);
  const med = (rows, k) => rows.map(r => r[k] ?? Infinity).sort((x, y) => x - y)[1];
  await browser.close();
  console.log('  good order (payload after the app, direct boot):', JSON.stringify(g));
  console.log('  bad order (payload in <head>, boot on DOMContentLoaded):', JSON.stringify(b));
  console.log('  payload at the end, boot on DOMContentLoaded:', JSON.stringify(w));
  check('payload at the end alone does not help a boot that waits for DOMContentLoaded', w.every(r => r.booted >= r.dcl), w);
  check('good: the app boots before DOMContentLoaded', g.every(r => r.booted < r.dcl), g);
  check('bad: the app cannot boot before DOMContentLoaded', b.every(r => r.booted >= r.dcl), b);
  check('good boots sooner than bad', Math.max(...g.map(r => r.booted)) < Math.min(...b.map(r => r.booted)), { g, b });
  check('good paints sooner than bad (median of three)', med(g, 'fcp') < med(b, 'fcp'), { g, b });
}
console.log(fails ? `\n${fails} FAILED (work: ${WORK})` : `\nALL PASSED (work: ${WORK})`);
process.exit(fails ? 1 : 0);
