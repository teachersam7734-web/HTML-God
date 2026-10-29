// test-video.mjs: video inside pages, checked in headless Chrome over STRICT file:// (no --allow-file-access-from-files,
// the way a user's double-click opens a file).
//
//   FFMPEG=<ffmpeg> node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-lottie-rive-video/scripts/test-video.mjs [workDir]       (FFMPEG_PATH also works; never hard-coded)
//
// Makes the clips (make-clips.mjs) and the recipe outputs (ffmpeg-recipes.mjs) in workDir, then:
//   A codec support (canPlayType), WebCodecs and requestVideoFrameCallback present
//   B every clip decodes and draws a non-blank frame; HEVC is reported, not required (it depends on the machine)
//   C VP9 alpha: corner alpha 0, circle alpha 255, also after the CRF 36 re-encode (ffprobe says yuv420p for both)
//   D seek accuracy and time by GOP (frame-coded clips)
//   E muted autoplay from markup alone advances
//   F the same clip from a data: URI and from a blob: URL seeks to the right frames
//   G captions: a data: URI track loads its cues; a relative .vtt beside a strict file:// page is recorded
//   H examples/hero-video.html: plays muted, reduced motion stays on the poster, Pause is remembered over a reload,
//     a hidden tab pauses it, no request outside file:
//   I requestVideoFrameCallback mediaTime steps of one frame
//   J WebCodecs on a raw Annex B stream: random access from the previous keyframe within 2 levels of sequential decode
//   K examples/scrub-video.html: shown frame within one frame of the target at six scroll positions
// verified: Windows 10, Node 24, Playwright 1.63, Chrome 155, ffmpeg 7.1 essentials build: every check passes
//           (numbers in SKILL.md and references/video.md).
// not verified: Safari, Firefox, iOS and Android; real footage; HEVC alpha; an MP4 demuxer for WebCodecs.
// Adapted from code-media/video/test-video.cjs in the HTML-Sensei build project's research notes (not shipped), test-scrub.cjs and test-alpha-check.cjs (run
// there with --allow-file-access-from-files); assertions, strict file:// and the hero example are new here.
// Original code of this project.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl, ffmpeg } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-video-')));
const C = path.join(W, 'clips'), R = path.join(W, 'recipes');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const info = (name, detail) => console.log(`INFO  ${name}  ${detail}`);
if (!(await ffmpeg())) { console.error('ffmpeg not found: set FFMPEG or FFMPEG_PATH'); process.exit(2); }
for (const [s, args] of [['make-clips.mjs', [C]], ['ffmpeg-recipes.mjs', [C, R]]]) {
  const r = spawnSync(process.execPath, [path.join(HERE, s), ...args], { encoding: 'utf8', env: process.env });
  if (r.status !== 0) { console.error(s, 'failed:', r.stderr.slice(0, 400)); process.exit(1); }
}
const b64 = f => fs.readFileSync(f).toString('base64');

const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function open(file, { reducedMotion = 'no-preference', ctx = null } = {}) {
  const c = ctx || await browser.newContext({ viewport: { width: 800, height: 500 }, reducedMotion });
  const net = [], errs = [];
  if (!ctx) await c.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u.slice(0, 100)); return r.abort(); });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.goto(fileUrl(file));
  return { ctx: c, p, net, errs };
}
fs.writeFileSync(path.join(C, 'blank.html'), '<!doctype html><html lang="en"><meta charset=utf-8><title>t</title><body style="margin:0;background:#f0f">');
const { ctx, p, errs } = await open(path.join(C, 'blank.html'));
// every pixel-reading test uses a blob: URL: frames of a file:// video drawn to a canvas may taint it in strict mode
await p.evaluate(() => { window.blobOf = (b64, mime) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return URL.createObjectURL(new Blob([u], { type: mime })); }; });
const mime = f => f.endsWith('.webm') ? 'video/webm' : 'video/mp4';

// A
const A = await p.evaluate(() => {
  const v = document.createElement('video');
  const t = { h264: 'video/mp4; codecs="avc1.640028"', hevc: 'video/mp4; codecs="hvc1.1.6.L93.B0"', vp9: 'video/webm; codecs="vp9"', av1: 'video/mp4; codecs="av01.0.05M.08"', opus: 'audio/webm; codecs="opus"', aac: 'audio/mp4; codecs="mp4a.40.2"' };
  const o = {}; for (const k in t) o[k] = v.canPlayType(t[k]) || 'no';
  o.webcodecs = typeof VideoDecoder === 'function'; o.rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype; return o;
});
check('A codec support: H.264, VP9, AV1 probably; WebCodecs and rVFC present', A.h264 === 'probably' && A.vp9 === 'probably' && A.av1 === 'probably' && A.webcodecs && A.rvfc, JSON.stringify(A));

// B
for (const f of ['h264-default-gop.mp4', 'h264-gop12.mp4', 'h264-allintra.mp4', 'vp9.webm', 'av1.mp4', 'hevc.mp4', 'alpha-vp9.webm']) {
  const r = await p.evaluate(async ([d, m]) => {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = blobOf(d, m); document.body.appendChild(v);
    const res = await Promise.race([new Promise(r => v.addEventListener('loadeddata', () => r('ok'))), new Promise(r => v.addEventListener('error', () => r('error ' + (v.error && v.error.code)))), new Promise(r => setTimeout(() => r('timeout'), 6000))]);
    const o = { res }; if (res === 'ok') {
      v.currentTime = 1; await new Promise(r => v.addEventListener('seeked', r, { once: true }));
      const c = document.createElement('canvas'); c.width = 64; c.height = 36; const g = c.getContext('2d'); g.drawImage(v, 0, 0, 64, 36);
      const px = g.getImageData(0, 0, 64, 36).data; let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i] + px[i + 1] + px[i + 2];
      Object.assign(o, { w: v.videoWidth, h: v.videoHeight, nonBlank: s > 1000 });
    } v.remove(); return o;
  }, [b64(path.join(C, f)), mime(f)]);
  const kb = Math.round(fs.statSync(path.join(C, f)).size / 1024);
  if (f === 'hevc.mp4') info('B hevc.mp4 (machine-dependent, never the only source)', `${JSON.stringify(r)} ${kb} KB`);
  else check(`B decode ${f}`, r.res === 'ok' && r.nonBlank, `${JSON.stringify(r)} ${kb} KB`);
}

// C
for (const f of [path.join(C, 'alpha-vp9.webm'), path.join(R, 'alpha36.webm')]) {
  const r = await p.evaluate(async d => {
    const v = document.createElement('video'); v.muted = true; v.src = blobOf(d, 'video/webm'); await new Promise(r => v.addEventListener('loadeddata', r));
    v.currentTime = 0.5; await new Promise(r => v.addEventListener('seeked', r, { once: true }));
    const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(v, 0, 0);
    const d2 = g.getImageData(0, 0, 640, 360).data; let opaque = 0; for (let i = 3; i < d2.length; i += 4) if (d2[i] === 255) opaque++;
    return { cornerAlpha: g.getImageData(5, 5, 1, 1).data[3], opaquePixels: opaque };
  }, b64(f));
  check(`C alpha survives in ${path.basename(f)}`, r.cornerAlpha === 0 && r.opaquePixels > 10000, JSON.stringify(r));
}

// D
const seekStats = {};
for (const f of ['framecode-gop250.mp4', 'framecode-gop12.mp4', 'framecode-allintra.mp4']) {
  const r = await p.evaluate(async d => {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = blobOf(d, 'video/mp4'); document.body.appendChild(v);
    await new Promise(r => v.addEventListener('loadeddata', r));
    const c = document.createElement('canvas'); c.width = 16; c.height = 9; const g = c.getContext('2d', { willReadFrequently: true });
    const lat = [], err = [];
    for (const k of [10, 55, 90, 33, 77, 5, 60, 99, 20, 45, 70, 12, 88, 3, 66, 95, 40, 15, 80, 25]) {
      const t0 = performance.now(); v.currentTime = (k + 0.5) / 30; await new Promise(r => v.addEventListener('seeked', r, { once: true }));
      lat.push(performance.now() - t0);
      // draw only once the sought frame is presented: straight after "seeked" one run drew a stale frame 79 frames off
      await new Promise(r => { v.requestVideoFrameCallback(() => r()); setTimeout(r, 150); });
      g.drawImage(v, 0, 0, 16, 9); err.push(Math.round(g.getImageData(8, 4, 1, 1).data[0] / 2) - k);
    }
    v.remove(); return { meanMs: +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(1), maxMs: +Math.max(...lat).toFixed(1), maxFrameError: Math.max(...err.map(Math.abs)), offByOne: err.filter(e => e).length };
  }, b64(path.join(C, f)));
  seekStats[f] = r;
  check(`D seek ${f}: every seek within one frame`, r.maxFrameError <= 1, JSON.stringify(r));
}

// E
{
  fs.writeFileSync(path.join(C, 'autoplay.html'), '<!doctype html><html lang="en"><meta charset=utf-8><title>a</title><video id="bg" src="h264-default-gop.mp4" autoplay muted loop playsinline preload="auto" style="width:320px"></video>');
  const o = await open(path.join(C, 'autoplay.html'));
  await o.p.waitForTimeout(1200);
  const r = await o.p.evaluate(() => { const v = document.getElementById('bg'); return { t: +v.currentTime.toFixed(2), paused: v.paused, muted: v.muted }; });
  check('E muted autoplay from markup advances (automation carries activation: proves the markup, not the policy)', r.t > 0.3 && !r.paused && r.muted && !o.net.length, JSON.stringify(r));
  await o.ctx.close();
}

// F
for (const label of ['data: URI', 'blob: URL']) {
  const r = await p.evaluate(async ([label, d]) => {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = label === 'data: URI' ? 'data:video/mp4;base64,' + d : blobOf(d, 'video/mp4'); document.body.appendChild(v);
    await new Promise((r, j) => { v.addEventListener('loadeddata', r); v.addEventListener('error', () => j(new Error('error'))); });
    const c = document.createElement('canvas'); c.width = 16; c.height = 9; const g = c.getContext('2d', { willReadFrequently: true }); const e = [];
    for (const k of [50, 10, 90, 30]) { v.currentTime = (k + 0.5) / 30; await new Promise(r => v.addEventListener('seeked', r, { once: true })); g.drawImage(v, 0, 0, 16, 9); e.push(Math.round(g.getImageData(8, 4, 1, 1).data[0] / 2) - k); }
    v.remove(); return { frameErrors: e };
  }, [label, b64(path.join(C, 'framecode-gop12.mp4'))]).catch(err => ({ failed: String(err).slice(0, 120) }));
  check(`F ${label} seeks to the right frames`, r.frameErrors && r.frameErrors.every(x => Math.abs(x) <= 1), JSON.stringify(r));
}

// G
{
  const r = await p.evaluate(async vtt => {
    const v = document.createElement('video'); v.muted = true; document.body.appendChild(v);
    const t = document.createElement('track'); t.kind = 'captions'; t.srclang = 'en'; t.label = 'English'; t.default = true; t.src = 'data:text/vtt;base64,' + vtt; v.appendChild(t);
    await new Promise(r => { t.addEventListener('load', r); t.addEventListener('error', r); setTimeout(r, 2000); });
    v.textTracks[0].mode = 'hidden'; const cues = v.textTracks[0].cues; const o = { cues: cues ? cues.length : null, first: cues && cues[0] ? cues[0].text : null }; v.remove(); return o;
  }, b64(path.join(C, 'captions.vtt')));
  check('G captions from a data: URI track', r.cues === 2 && r.first === 'First caption', JSON.stringify(r));
  fs.writeFileSync(path.join(C, 'cap-file.html'), '<!doctype html><html lang="en"><meta charset=utf-8><title>c</title><video id=v muted src="framecode-gop12.mp4"><track kind=captions default src="captions.vtt"></video>');
  const o = await open(path.join(C, 'cap-file.html')); await o.p.waitForTimeout(1200);
  const g2 = await o.p.evaluate(() => { const t = document.getElementById('v').textTracks[0]; return { cues: t.cues ? t.cues.length : 0, readyState: document.querySelector('track').readyState }; });
  info('G relative .vtt beside a strict file:// page', `${JSON.stringify(g2)} (readyState 3 = error: inline captions as a data: URI)`);
  await o.ctx.close();
}

// H
{
  for (const f of ['hero.webm', 'hero.mp4', 'poster.webp']) fs.copyFileSync(path.join(R, f), path.join(C, f));
  const hero = path.join(C, 'hero-video.html'); fs.copyFileSync(path.join(HERE, '..', 'examples', 'hero-video.html'), hero);
  const n = await open(hero); await n.p.waitForTimeout(1000);
  const s1 = await n.p.evaluate(() => { const v = document.getElementById('v'); return { t: +v.currentTime.toFixed(2), paused: v.paused, src: v.currentSrc.split('/').pop(), btn: document.getElementById('pause').getAttribute('aria-pressed') }; });
  check('H hero plays muted, VP9 source chosen first', !s1.paused && s1.t > 0.3 && s1.src === 'hero.webm' && s1.btn === 'false', JSON.stringify(s1));
  await n.p.focus('#pause'); await n.p.keyboard.press('Enter'); await n.p.waitForTimeout(200);
  await n.p.reload(); await n.p.waitForTimeout(800);
  const s2 = await n.p.evaluate(() => ({ paused: document.getElementById('v').paused, btn: document.getElementById('pause').getAttribute('aria-pressed'), label: document.getElementById('pause').textContent }));
  check('H Pause by keyboard is remembered over a reload', s2.paused && s2.btn === 'true', JSON.stringify(s2));
  await n.p.evaluate(() => { localStorage.clear(); }); await n.p.reload(); await n.p.waitForTimeout(800);
  const s3 = await n.p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); return document.getElementById('v').paused; });
  check('H a hidden tab pauses it', s3 === true);
  check('H no request outside file:, no page errors', !n.net.length && !n.errs.length, (n.net.join(' ') + ' ' + n.errs.join(' ')).trim());
  await n.ctx.close();
  const rmo = await open(hero, { reducedMotion: 'reduce' }); await rmo.p.waitForTimeout(1000);
  const s4 = await rmo.p.evaluate(() => { const v = document.getElementById('v'); return { paused: v.paused, t: v.currentTime, autoplay: v.hasAttribute('autoplay'), btn: document.getElementById('pause').textContent }; });
  check('H reduced motion: no autoplay, poster stays, button offers Play', s4.paused && s4.t === 0 && !s4.autoplay && /Play/.test(s4.btn), JSON.stringify(s4));
  await rmo.p.click('#pause'); await rmo.p.waitForTimeout(800);
  check('H an explicit Play overrides reduced motion', await rmo.p.evaluate(() => !document.getElementById('v').paused));
  await rmo.ctx.close();
}

// I
{
  const r = await p.evaluate(async d => {
    const v = document.createElement('video'); v.muted = true; v.src = blobOf(d, 'video/mp4'); document.body.appendChild(v);
    await new Promise(r => v.addEventListener('loadeddata', r));
    const fr = []; await new Promise(r => { const cb = (now, meta) => { fr.push(meta.mediaTime); if (fr.length < 12) v.requestVideoFrameCallback(cb); else r(); }; v.requestVideoFrameCallback(cb); v.play(); });
    v.remove(); const dd = fr.slice(1).map((x, i) => x - fr[i]); return { min: +Math.min(...dd).toFixed(4), max: +Math.max(...dd).toFixed(4) };
  }, b64(path.join(C, 'framecode-gop12.mp4')));
  check('I requestVideoFrameCallback steps one frame (1/30 s)', Math.abs(r.min - 1 / 30) < 0.002 && Math.abs(r.max - 1 / 30) < 0.002, JSON.stringify(r));
}

// J
{
  const r = await p.evaluate(async d => {
    const s = atob(d), u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    const sc = i => u8[i] === 0 && u8[i + 1] === 0 && (u8[i + 2] === 1 || (u8[i + 2] === 0 && u8[i + 3] === 1)) ? (u8[i + 2] === 1 ? 3 : 4) : 0;
    const starts = []; for (let i = 0; i + 4 < u8.length; i++) { const n = sc(i); if (n) { if ((u8[i + n] & 31) === 9) starts.push(i); i += n; } }   // access unit delimiters
    const aus = starts.map((st, i) => u8.subarray(st, starts[i + 1] || u8.length));
    const isKey = au => { for (let i = 0; i + 4 < au.length; i++) if (au[i] === 0 && au[i + 1] === 0 && (au[i + 2] === 1 || (au[i + 2] === 0 && au[i + 3] === 1))) { const n = au[i + 2] === 1 ? 3 : 4; if ((au[i + n] & 31) === 5) return true; i += n; } return false; };
    const keys = aus.map(isKey);
    const cfg = { codec: 'avc1.64000a', codedWidth: 160, codedHeight: 90, avc: { format: 'annexb' } };
    const c = document.createElement('canvas'); c.width = 16; c.height = 9; const g = c.getContext('2d', { willReadFrequently: true });
    const red = f => { g.drawImage(f, 0, 0, 16, 9); return g.getImageData(8, 4, 1, 1).data[0]; };
    const seq = []; { const dec = new VideoDecoder({ output: f => { seq[Math.round(f.timestamp * 30 / 1e6)] = red(f); f.close(); }, error: () => {} }); dec.configure(cfg); aus.forEach((au, i) => dec.decode(new EncodedVideoChunk({ type: keys[i] ? 'key' : 'delta', timestamp: Math.round(i * 1e6 / 30), data: au }))); await dec.flush(); dec.close(); }
    const probes = [];
    for (const k of [0, 11, 12, 50, 99, 33, 77, 5, 60]) {
      let st = k; while (st > 0 && !keys[st]) st--; let got = null, n = 0;
      const dec = new VideoDecoder({ output: f => { n++; if (f.timestamp === Math.round(k * 1e6 / 30)) got = red(f); f.close(); }, error: () => {} }); dec.configure(cfg);
      for (let i = st; i <= k; i++) dec.decode(new EncodedVideoChunk({ type: keys[i] ? 'key' : 'delta', timestamp: Math.round(i * 1e6 / 30), data: aus[i] }));
      await dec.flush(); dec.close(); probes.push(Math.abs(got - seq[k]));
    }
    return { accessUnits: aus.length, keyframes: keys.filter(Boolean).length, worst: Math.max(...probes) };
  }, b64(path.join(C, 'framecode-gop12.h264')));
  check('J WebCodecs random access from the previous keyframe matches sequential decode (within 2)', r.accessUnits === 100 && r.keyframes === 9 && r.worst <= 2, JSON.stringify(r));
}

// K
{
  const page = path.join(C, 'scrub-video.html');
  fs.writeFileSync(page, fs.readFileSync(path.join(HERE, '..', 'examples', 'scrub-video.html'), 'utf8')
    .replace('src="framecode-allintra.mp4"', `src="data:video/mp4;base64,${b64(path.join(C, 'framecode-allintra.mp4'))}"`));   // inlined, as one file
  const o = await open(page); await o.p.waitForFunction(() => window.__state && __state().dur > 0, null, { timeout: 15000 });
  const max = await o.p.evaluate(() => document.getElementById('track').offsetHeight - innerHeight);
  const res = [];
  for (const frac of [0, 0.25, 0.5, 0.75, 1, 0.1]) {
    await o.p.evaluate(y => scrollTo(0, y), Math.round(max * frac)); await o.p.waitForTimeout(900);
    const r = await o.p.evaluate(() => { const v = document.getElementById('v'); const c = document.createElement('canvas'); c.width = 16; c.height = 9; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(v, 0, 0, 16, 9); return { frame: Math.round(g.getImageData(8, 4, 1, 1).data[0] / 2), dur: v.duration }; });
    res.push({ frac, want: Math.round(frac * (r.dur * 30 - 1)), got: r.frame });
  }
  check('K scroll scrub within one frame at six positions', res.every(x => Math.abs(x.want - x.got) <= 1) && !o.errs.length, JSON.stringify(res.map(x => `${x.want}/${x.got}`)));
  await o.ctx.close();
}
check('page errors in the harness page', !errs.length, errs.join(' | '));
await ctx.close(); await browser.close();
fs.writeFileSync(path.join(W, 'seek-stats.json'), JSON.stringify(seekStats, null, 1));
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed', '\nwork folder', W);
// Scratch: a folder this test made in the OS temp folder is removed when every check passes and kept (path printed)
// when one fails; a folder given on the command line is always kept.
if (!failed && !process.argv[2]) { fs.rmSync(W, { recursive: true, force: true }); console.log(`scratch removed: ${W}`); }
process.exit(failed ? 1 : 0);
