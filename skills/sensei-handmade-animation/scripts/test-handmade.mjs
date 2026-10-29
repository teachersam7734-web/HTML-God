// test-handmade.mjs: unit checks of handmade-kit.js, then the examples in headless Chrome (determinism, held
// drawings, boil steps) and the review loop. Run: node test-handmade.mjs [outDir]   exit 0 = all pass.
// Needs Chrome (discovered or CHROME) and ffmpeg (FFMPEG_PATH or discovery).
// verified: Windows 10, Node 24.16, Chrome 155 headless with SwiftShader, ffmpeg 7.1.  not verified: macOS, Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H = createRequire(import.meta.url)('./handmade-kit.js');
const { launch, toUrl } = await import(pathToFileURL(path.resolve(HERE, '../../sensei-video-pipeline/scripts/cdp.mjs')).href);
const OUT = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-hm-')));
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'pass' : 'FAIL'}  ${m}`); if (!c) fails++; };
const near = (a, b, e) => Math.abs(a - b) <= e;

// kit
ok(H.jit('arm', 3, 0.01) === H.jit('arm', 3, 0.08) && H.jit('arm', 3, 0.08) !== H.jit('arm', 3, 0.09), 'jit holds inside a 1/12 s boil step and changes at the next');
ok(H.jit('arm', 3, 0.5, 0) === H.jit('arm', 3, 2.7, 0), 'boil rate 0 freezes the line (the "no boil" setting)');
ok(H.jit('arm', 3, 0.5) !== H.jit('leg', 3, 0.5), 'named seeds: two elements boil independently');
ok(H.onTwos(1 / 24 + 0.001) === 0 && near(H.onTwos(2 / 24 + 0.001), 2 / 24, 1e-12), 'onTwos holds each pose for two frames at 24 fps');
ok(near(H.exposure(1.0 + 1 / 24 + 0.001, [{ at: 0, on: 2 }, { at: 1, on: 1 }]), 1 + 1 / 24, 1e-9), 'exposure switches to ones for a fast action');
const sq = H.squash(1.35); ok(near(sq.x * sq.y, 1, 1e-12) && sq.y > 1, 'squash keeps area');
let peak = 0; for (let i = 0; i <= 1000; i++) peak = Math.max(peak, H.ease.back(i / 1000)); ok(peak > 1.05 && peak < 1.2 && near(H.ease.back(1), 1, 1e-12), `back ease overshoots to ${peak.toFixed(3)} and lands on 1`);
const m = H.mood(1.2 + 0.1, [[0, 'calm'], [1.2, 'curious']]); ok(m.squint > 0.5 && m.face === 'calm' && H.mood(1.7, [[0, 'calm'], [1.2, 'curious']]).face === 'curious', 'mood: eyes squint shut before the new face opens');
ok(H.ring(0.9, 1) === 0 && H.ring(1, 1) === 1 && Math.abs(H.ring(2, 1)) < 0.01, 'ring: zero before the hit, rings down after');

// examples in Chrome
const sha = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 12);
const chrome = await launch({ gl: 'swiftshader' });
try {
  for (const [file, w, h, times] of [['hop.html', 1280, 720, [0.3, 1.6, 1.95, 2.76, 3.3, 5.6]], ['svg-boil.html', 960, 540, [0, 0.5, 1.2, 2.9]]]) {
    const u = new URL(toUrl(path.resolve(HERE, '../examples', file))); u.searchParams.set('render', '1');
    const pg = await chrome.open(u.href, { width: w, height: h }); await pg.ready();
    const seq = {};
    for (const t of times) { await pg.seek(t); seq[t] = sha(await pg.shot()); }
    let same = 0; for (const t of [...times].reverse()) { await pg.seek(1.11); await pg.seek(t); if (sha(await pg.shot()) === seq[t]) same++; }
    if (file === 'svg-boil.html') {
      // tested behaviour: Chrome's cached turbulence result differs by a few edge pixels on a revisit, so SVG boil is
      // repeatable between fresh in-order renders but not bit-exact under out-of-order seeks (reported, not failed)
      console.log(`info  svg-boil.html: ${same}/${times.length} frames bit-identical after out-of-order revisits (known: a few edge pixels differ)`);
      const fresh = [];
      for (let r = 0; r < 2; r++) { const c2 = await launch({ gl: 'swiftshader' }); const p2 = await c2.open(u.href, { width: w, height: h }); await p2.ready();
        const hs = []; for (const t of times) { await p2.seek(t); hs.push(sha(await p2.shot())); } fresh.push(hs.join()); await c2.close(); }
      ok(fresh[0] === fresh[1], 'svg-boil.html: two fresh in-order renders are identical');
    } else ok(same === times.length, `${file}: ${same}/${times.length} frames identical in and out of order`);
    if (file === 'svg-boil.html') {
      const at = async t => { await pg.seek(t); return sha(await pg.shot()); };
      ok(await at(0.01) === await at(0.07) && await at(0.07) !== await at(0.09), 'svg-boil: the drawing holds inside a boil step and changes at the next');
    } else {
      await pg.seek(1.0); const ink = await pg.evaluate(`(() => { const d = document.getElementById('c').getContext('2d').getImageData(0, 0, 1280, 720).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 70 && d[i + 1] < 60 && d[i + 2] < 80) n++; return n; })()`);   // evaluate takes an expression string
      ok(ink > 2000, `hop.html: ink line present at 1.0 s (${ink} dark pixels)`);
    }
    await pg.close();
  }
} finally { await chrome.close(); }

// the review loop writes its three kinds of image
const rv = args => spawnSync(process.execPath, ['review.mjs', '../examples/hop.html', ...args, '--out', OUT], { cwd: HERE, encoding: 'utf8' });
const files = [rv(['--sheet', '0.3,1.95,2.76,3.4']), rv(['--strip', '2.6:2.9']), rv(['--crop', '700,240,280,300@3.4', '--zoom', '2'])].map(r => r.stdout.trim());
ok(files.every(f => f && fs.existsSync(f)), `review: sheet, strip and crop written (${files.map(f => path.basename(f)).join(', ')})`);
// Scratch: a folder this test made in the OS temp folder is removed when every check passes and kept (path printed)
// when one fails; a folder given on the command line is always kept.
if (!fails && !process.argv[2]) { fs.rmSync(OUT, { recursive: true, force: true }); console.log(`scratch removed: ${OUT}`); } else console.log(`outputs in ${OUT}`);
console.log(fails ? `${fails} failure(s)` : 'all pass');
process.exit(fails ? 1 : 0);
