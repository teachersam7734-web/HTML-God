// test-examples.mjs: runs this skill's examples and scripts end to end.
//   node test-examples.mjs [outDir]      exit 0 = all pass
// 1. motion-kit self-test; 2. storyboard gate on the example (pass) and on a metronome fixture (fail);
// 3. examples/sting.html in headless Chrome: sequential and out-of-order seeks give identical screenshot hashes at
//    times straddling every hand-off; stills and a contact sheet written for a human or model to look at;
// 4. a half-size draft MP4 of the sting piped to ffmpeg, then film-gates G0/G2/G3 on it (pass) and on bad fixtures
//    (a flat stretch, a frozen end: fail); 5. G5 on the sting (pass) and on a page-chrome fixture (fail).
// Needs: Chrome or Playwright's Chromium, Playwright (found by discovery), ffmpeg (FFMPEG_PATH or PATH).
// verified: Windows 10, Node 24, system Chrome 155, Playwright 1.63 from the npx cache, ffmpeg 7.1.
// not verified: macOS, Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { findPlaywright, findChrome, findFfmpeg } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/discover.mjs')).href);
const OUT = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-mg-')));
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'pass' : 'FAIL'}  ${m}`); if (!c) fails++; };
const node = (args) => spawnSync(process.execPath, args, { encoding: 'utf8', cwd: HERE });

ok(node(['test-motion-kit.mjs']).status === 0, 'motion-kit self-test');
ok(node(['storyboard-check.mjs', '../examples/sting.storyboard.json']).status === 0, 'storyboard gate passes the example');
const metro = path.join(OUT, 'metronome.json');
fs.writeFileSync(metro, JSON.stringify({ duration: 8, beats: [0, 2, 4, 6].map(t => ({ t, end: t + 2, beat: 'b', buys: 'x', cut: 'hard' })) }));
ok(node(['storyboard-check.mjs', metro]).status === 1, 'storyboard gate fails a metronome with no carries');

const pw = findPlaywright(HERE), chrome = findChrome(), ff = findFfmpeg();
if (!pw.found || !ff.found) { console.log('FAIL  Playwright or ffmpeg not found; browser tests skipped'); process.exit(1); }
const pwm = await import(pw.importUrl); const chromium = pwm.chromium || pwm.default.chromium;
const browser = await chromium.launch({ executablePath: chrome.found ? chrome.path : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const open = async (file, scale = 1) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(file).href); await page.evaluate(() => window.__ready); return page;
};
const sha = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 12);
const sting = path.resolve(HERE, '../examples/sting.html');

// 3. determinism: frame N is the same whether reached in order or by a jump
{
  const page = await open(sting, 0.5);
  const times = [0.2, 0.65, 3.64, 3.66, 4.24, 4.26, 4.86, 7.99];
  const seq = {};
  for (const t of times) { await page.evaluate(t => window.__seek(t), t); seq[t] = sha(await page.screenshot()); }
  let same = 0;
  for (const t of [...times].reverse()) { await page.evaluate(t => { window.__seek(7.5 - t); window.__seek(t); }, t); if (sha(await page.screenshot()) === seq[t]) same++; }
  ok(same === times.length, `sting: ${same}/${times.length} frames identical in and out of order`);
  ok(new Set(Object.values(seq)).size === times.length, 'sting: the sampled frames all differ (the film moves)');
  for (const t of [0.3, 1.0, 3.7, 4.0, 4.4, 4.87, 5.3, 7.9]) { await page.evaluate(t => window.__seek(t), t); await page.screenshot({ path: path.join(OUT, `still-${t.toFixed(2)}.png`) }); }
  await page.close();
}

// 4. a draft MP4 (960x540, 30 fps) piped to ffmpeg as PNG frames
async function draft(file, mp4, { dur, fps = 30, mutate = null } = {}) {
  const page = await open(file, 0.5);
  if (mutate) await page.evaluate(mutate);
  const meta = await page.evaluate(() => window.__meta);
  const D = dur || meta.dur, n = Math.round(D * fps);
  const enc = spawn(ff.path, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', mp4]);
  const done = new Promise(r => enc.on('close', r));
  for (let i = 0; i < n; i++) { await page.evaluate(t => window.__seek(t), i / fps); const b = await page.screenshot(); if (!enc.stdin.write(b)) await new Promise(r => enc.stdin.once('drain', r)); }
  enc.stdin.end(); const code = await done; await page.close(); return code;
}
const t0 = Date.now();
const mp4 = path.join(OUT, 'sting-draft.mp4');
ok(await draft(sting, mp4) === 0, `draft MP4 encoded (${((Date.now() - t0) / 1000).toFixed(1)} s for 240 frames at 960x540)`);
const gates = node(['film-gates.mjs', '--video', mp4, '--expect', '8', '--json', path.join(OUT, 'gates.json')]);
console.log(gates.stdout.trim().replace(/^/gm, '      '));
ok(gates.status === 0, 'film-gates G0 G2 G3 pass on the sting draft');
const sheet = path.join(OUT, 'contact-sheet.jpg');
spawnSync(ff.path, ['-hide_banner', '-loglevel', 'error', '-y', '-i', mp4, '-vf', 'fps=2,scale=320:-2,tile=4x4', '-frames:v', '1', sheet]);
ok(fs.existsSync(sheet), `contact sheet written: ${sheet}`);

// bad fixtures: a frozen ending (the sting stopped at 4 s and held to 8 s), and a flat stretch
const frozen = path.join(OUT, 'frozen.mp4');
await draft(sting, frozen, { mutate: () => { const s = window.__seek; window.__seek = t => s(Math.min(t, 4)); } });
ok(node(['film-gates.mjs', '--video', frozen]).status === 1, 'film-gates fails a 4 s frozen end hold (G3)');
const flat = path.join(OUT, 'flat.mp4');
await draft(sting, flat, { mutate: () => { const s = window.__seek; window.__seek = t => { s(t); document.getElementById('stage').style.opacity = t > 2 && t < 3 ? '0' : '1'; }; } });
ok(node(['film-gates.mjs', '--video', flat]).status === 1, 'film-gates fails a one-second blank stretch (G2)');

// 5. G5 page chrome
ok(node(['film-gates.mjs', '--page', sting, '--samples', '16']).status === 0, 'G5 passes the sting (no page chrome)');
const chromeFix = path.join(OUT, 'chrome-fixture.html');
fs.writeFileSync(chromeFix, `<!doctype html><html><body style="margin:0;width:1920px;height:1080px;background:#111">
<div style="position:absolute;left:40px;top:30px;font:500 22px sans-serif;letter-spacing:4px;color:#fff;text-transform:uppercase">launch film</div>
<div style="position:absolute;left:0;bottom:20px;width:1920px;height:6px;background:#f60"></div>
<div style="position:absolute;right:40px;bottom:40px;font:20px monospace;color:#fff">00:12</div>
<h1 style="position:absolute;top:400px;width:100%;text-align:center;color:#fff">Headline</h1>
<script>window.__meta={dur:2,fps:30,w:1920,h:1080};window.__seek=function(t){return true};window.__ready=Promise.resolve(true)</script></body></html>`);
const g5 = node(['film-gates.mjs', '--page', chromeFix, '--samples', '4']);
ok(g5.status === 1 && /C1/.test(g5.stdout) && /C2/.test(g5.stdout) && /P1/.test(g5.stdout), 'G5 fails a page with a corner label, tracked caps and a progress bar');

await browser.close();
// Scratch: a folder this test made in the OS temp folder is removed when every check passes and kept (path printed)
// when one fails; a folder given on the command line is always kept.
if (!fails && !process.argv[2]) { fs.rmSync(OUT, { recursive: true, force: true }); console.log(`scratch removed: ${OUT}`); } else console.log(`outputs in ${OUT}`);
console.log(fails ? `${fails} failure(s)` : 'all pass');
process.exit(fails ? 1 : 0);
