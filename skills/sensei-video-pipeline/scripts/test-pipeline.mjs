// test-pipeline.mjs: runs every script and example of sensei-video-pipeline end to end.
//   node test-pipeline.mjs [outDir]       exit 0 = all pass
// Needs Chrome (discovered or CHROME), ffmpeg (FFMPEG_PATH or PATH); Playwright (discovered) only for the player test.
// verified: Windows 10, Node 24.16, Chrome 156 headless with SwiftShader, ffmpeg 7.1, playwright-core 1.64.1: 24 of 24,
//           five runs in a row (2026-10-28), after six in a row of the 21 checks before the cdp shutdown checks were added.
// not verified: macOS, Linux, a real GPU.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { findFfmpeg, findPlaywright, findChrome } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/discover.mjs')).href);
const OUT = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-vp-')));
fs.mkdirSync(OUT, { recursive: true });
const ex = n => path.resolve(HERE, '../examples', n);
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'pass' : 'FAIL'}  ${m}`); if (!c) fails++; };
const node = (args, quiet = true) => { const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: HERE }); if (!quiet || r.status) process.stdout.write((r.stdout + r.stderr).replace(/^/gm, '      ')); return r; };
const ff = findFfmpeg();
const ffr = args => spawnSync(ff.path, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
const probe = f => JSON.parse(spawnSync(ff.ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,nb_frames,width', '-of', 'json', f], { encoding: 'utf8' }).stdout);

ok(node(['test-spring.mjs']).status === 0, 'spring.js numerical tests');

// cdp.mjs shutdown (QC finding 6): a protocol call still waiting when the browser goes away must reject, and close()
// must finish in bounded time, twice in a row, so Node never exits 13 on an unsettled await after a finished render.
{
  const { launch } = await import(pathToFileURL(path.join(HERE, 'cdp.mjs')).href);
  const chrome = await launch({ gl: 'swiftshader' });
  const pg = await chrome.open('about:blank', { width: 320, height: 240 });
  const hung = pg.evaluate('new Promise(() => {})').then(() => 'resolved', e => 'rejected: ' + e.message);
  const t0 = Date.now();
  await Promise.all([chrome.close(), chrome.close()]);
  const outcome = await Promise.race([hung, new Promise(r => setTimeout(() => r('still pending'), 2000))]);
  ok(/^rejected/.test(outcome), `cdp: a call pending at shutdown is rejected (${outcome})`);
  ok(Date.now() - t0 < 15000, `cdp: close() finishes in bounded time (${Date.now() - t0} ms) and a second call shares it`);
  const after = await chrome.send('Browser.getVersion').then(() => 'answered', e => 'rejected');
  ok(after === 'rejected', 'cdp: a call after close() rejects at once instead of waiting');
}
ok(node(['preflight.mjs', OUT]).status === 0, 'preflight finds Chrome, ffmpeg with the needed filters, WebSocket, disk');
for (const p of ['seek-page.html', 'webgl-seek.html', 'player.html']) {
  const r = node(['render.mjs', ex(p), '--probe']);
  ok(r.status === 0 && /"deterministic": true/.test(r.stdout), `probe: ${p} gives the same frame in and out of order`);
}

// full render in chunks, then kill one chunk and resume
const film = path.join(OUT, 'seek.mp4');
let r = node(['render.mjs', ex('seek-page.html'), film, '--chunk', '1', '--workers', '2']);
ok(r.status === 0 && fs.existsSync(film), 'render: 4 s seek page in 1 s chunks on 2 workers');
const info = probe(film); ok(Math.abs(+info.format.duration - 4) < 0.05 && info.streams[0].nb_frames === '120', `render: duration ${info.format.duration} s, ${info.streams[0].nb_frames} frames`);
const chunkDir = film + '.chunks'; const one = fs.readdirSync(chunkDir).find(f => /^seg_.*\.mp4$/.test(f)); fs.rmSync(path.join(chunkDir, one));
r = node(['render.mjs', ex('seek-page.html'), film, '--chunk', '1']);
ok(r.status === 0 && /3 chunk\(s\) reused/.test(r.stdout), 'render: resume re-renders only the missing chunk');
ok(!fs.readdirSync(chunkDir).some(f => f.includes('.part')), 'render: no .part files left behind');

// shutter blur and lossless intermediates
const blur = path.join(OUT, 'blur.mp4');
ok(node(['render.mjs', ex('seek-page.html'), blur, '--from', '0.3', '--to', '0.7', '--shutter', '6', '--png']).status === 0 && probe(blur).streams[0].nb_frames === '12', 'render: 6 sub-frame shutter with PNG intermediates gives 12 output frames for 0.4 s');
const webgl = path.join(OUT, 'webgl.mp4');
ok(node(['render.mjs', ex('webgl-seek.html'), webgl, '--chunk', '3']).status === 0 && fs.existsSync(webgl), 'render: WebGL2 page renders under SwiftShader');

// narration-first timeline from measured lines, normalised mix, mux with captions
const vo = path.join(OUT, 'vo'); fs.mkdirSync(vo, { recursive: true });
[['b1', 1.3, 330], ['b2', 0.9, 440], ['b3', 1.6, 550]].forEach(([id, d, hz]) => ffr(['-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=${d}`, '-ar', '48000', path.join(vo, `${id}.wav`)]));
const script = path.join(OUT, 'script.json');
fs.writeFileSync(script, JSON.stringify({ scenes: [{ id: 'a', pre: 0.5, tail: 0.3, beats: [['b1', 'Skim first.', 0.4], ['b2', 'Then scan.', 0.2]] }, { id: 'b', pre: 0.2, tail: 0.5, beats: [['b3', 'Find the clue.', 0]] }] }));
r = node(['timeline.mjs', script, '--vo', vo, '--srt', path.join(OUT, 'caps.srt'), '--json', path.join(OUT, 'tl.json'), '--js', path.join(OUT, 'tl.js')]);
const tl = JSON.parse(fs.readFileSync(path.join(OUT, 'tl.json'), 'utf8'));
ok(Math.abs(tl.total - (0.5 + 1.3 + 0.4 + 0.9 + 0.2 + 0.3 + 0.2 + 1.6 + 0.5)) < 0.01 && Math.abs(tl.beats.b3.start - 3.8) < 0.01, `timeline: total ${tl.total} s, b3 starts at ${tl.beats.b3.start} s`);
ok(/00:00:00,500 --> 00:00:02,200/.test(fs.readFileSync(path.join(OUT, "caps.srt"), "utf8")), "timeline: SRT caption extends past the speech but is cut where the next caption starts");
const mix = path.join(OUT, 'mix.wav'), norm = path.join(OUT, 'mix-14.wav');
ffr(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=4', '-f', 'lavfi', '-i', 'anoisesrc=d=4:a=0.05', '-filter_complex', 'amix=inputs=2,volume=0.3', '-ar', '48000', mix]);
r = node(['audio.mjs', 'normalize', mix, norm]);
const m = JSON.parse(node(['audio.mjs', 'measure', norm]).stdout);
ok(Math.abs(m.lufs + 14) <= 0.5 && m.truePeak <= -1.5 + 0.1, `audio: normalised to ${m.lufs} LUFS, true peak ${m.truePeak} dBTP`);
const muxed = path.join(OUT, 'final.mp4');
ok(node(['audio.mjs', 'mux', film, norm, muxed, '--srt', path.join(OUT, 'caps.srt')]).status === 0, 'audio: mux wrote the final MP4');
const kinds = probe(muxed).streams.map(s => s.codec_type).sort().join(',');
ok(kinds === 'audio,subtitle,video' && fs.existsSync(film) && fs.existsSync(norm), `audio: final has ${kinds}; sources kept`);

// review images from the master
const sh = node(['sheet.mjs', muxed, '--out', OUT]).stdout.trim(), st = node(['sheet.mjs', muxed, '--strip', '1.4', '--out', OUT]).stdout.trim();
ok(fs.existsSync(sh) && fs.existsSync(st), `sheet: contact sheet and strip written (${path.basename(sh)}, ${path.basename(st)})`);

// the player half
const pw = findPlaywright(HERE);
if (pw.found) {
  const mod = await import(pw.importUrl), chromium = mod.chromium || mod.default.chromium, chrome = findChrome();
  const b = await chromium.launch({ executablePath: chrome.found ? chrome.path : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const url = pathToFileURL(ex('player.html')).href;
  let p = await b.newPage(); await p.goto(url); await p.evaluate(() => window.__ready);
  await p.waitForFunction(() => document.querySelector('.sp-play'));
  await p.click('.sp-play'); await p.waitForTimeout(600);
  const t1 = await p.evaluate(() => window.player.t);
  ok(t1 > 0.2, `player: Play advances the clock (t = ${t1.toFixed(2)} s after 0.6 s)`);
  await p.click('.sp-play'); await p.fill('.sp-scrub', '1.5'); await p.dispatchEvent('.sp-scrub', 'input');
  ok(Math.abs(await p.evaluate(() => window.player.t) - 1.5) < 1e-6 && /scan/i.test(await p.textContent('.sp-cap')), 'player: scrub seeks and the caption follows');
  await p.close();
  p = await b.newPage({ reducedMotion: 'reduce' }); await p.goto(url); await p.evaluate(() => window.__ready); await p.waitForTimeout(300);
  const rm = await p.evaluate(() => ({ t: window.player.t, playing: window.player.playing, reduce: window.player.reduce }));
  ok(rm.reduce && !rm.playing && rm.t > 2.9, `player: reduced motion shows the end frame (t = ${rm.t.toFixed(2)}) and does not play`);
  await p.close();
  p = await b.newPage(); await p.goto(url + '?render=1'); await p.evaluate(() => window.__ready);
  ok(await p.evaluate(() => !document.querySelector('.sp-ui') && window.player === null), 'player: ?render mounts no controls');
  await b.close();
} else ok(false, 'player: Playwright not found, player tests skipped');

// Scratch: a folder this test made itself in the OS temp folder is removed when everything passes and kept (named)
// when something fails; a folder given as outDir is always kept.
if (!fails && !process.argv[2]) { fs.rmSync(OUT, { recursive: true, force: true }); console.log(`scratch removed: ${OUT}`); }
else console.log(`outputs in ${OUT}`);
console.log(fails ? `${fails} failure(s)` : 'all pass');
process.exit(fails ? 1 : 0);
