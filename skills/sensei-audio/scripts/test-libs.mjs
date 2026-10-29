// test-libs.mjs: builds ONE offline HTML page with Howler, Tone, ZzFX (ES module) and jsfxr inlined (no network) and
// checks each library's recipe in Chrome. The libraries are not shipped with the plugin: install them in a work folder
// (npm i howler@2.2.4 tone@15.1.22 zzfx@1.4.0 jsfxr@1.4.1) and run from there, or set VENDOR to that node_modules.
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-audio/scripts/test-libs.mjs [outDir]
//
// verified: Windows 10, Chrome 155, those exact versions: one page, zero external requests; Howler sprite, stereo,
//           pos, mute and volume; Tone.Offline note at 0.25 s, Transport steps exact at 120 bpm; ZzFX buildSamples
//           deterministic only with randomness 0; jsfxr same definition gives the same bytes.
// not verified: iOS and Safari behaviour of Howler and Tone; anything audible.
// Adapted from code-media/audio/test-libs.cjs in the HTML-Sensei build project's research notes (not shipped) (original to this project); assertions added.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, fileUrl } from './pw.mjs';

const V = process.env.VENDOR || path.join(process.cwd(), 'node_modules');
for (const m of ['howler', 'tone', 'zzfx', 'jsfxr']) if (!fs.existsSync(path.join(V, m))) { console.error(`${m} not found in ${V}: npm i howler@2.2.4 tone@15.1.22 zzfx@1.4.0 jsfxr@1.4.1, or set VENDOR`); process.exit(2); }
const rd = f => fs.readFileSync(path.join(V, f), 'utf8').replace(/<\/script/gi, '<\\/script');   // doubled backslash: '<\/' in a JS string is only '</'
const OUT = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-libs-')));
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
// a short WAV for Howler (0.4 s, 660 Hz decaying), built here so the page has an inlined sample
function wav() {
  const sr = 22050, n = Math.floor(sr * 0.4), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 660 * i / sr) * Math.exp(-i / sr * 8) * 20000), 44 + i * 2);
  return b.toString('base64');
}
const zz = rd('zzfx/ZzFX.js').replace(/^export\s+/gm, '');
const html = `<!doctype html><meta charset="utf-8"><title>libs</title><button id="b">go</button>
<script>${rd('howler/dist/howler.min.js')}</script>
<script>${rd('tone/build/Tone.js')}</script>
<script>${rd('jsfxr/riffwave.js')}</script>
<script>${rd('jsfxr/sfxr.js')}</script>
<script type="module">${zz}\nwindow.ZZFX=ZZFX;window.ZZFXSound=ZZFXSound;window.__zz=1;</script>
<script>window.WAV64='${wav()}';</script>`;
const file = path.join(OUT, "libs.html"); fs.writeFileSync(file, html);
console.log('single-file page:', file, (fs.statSync(file).size / 1024).toFixed(0) + ' KB');

const b = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const p = await (await b.newContext()).newPage();
  const net = [], errs = [];
  p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(fileUrl(file));
  await p.waitForFunction('window.__zz');
  const r = {};
  r.howler = await p.evaluate(async () => {
    const o = { version: Howler.version, usingWebAudio: Howler.usingWebAudio, ctxState: Howler.ctx && Howler.ctx.state };
    const h = new Howl({ src: ['data:audio/wav;base64,' + WAV64], sprite: { a: [0, 150], b: [150, 250] } });
    await new Promise(r => h.once('load', r)); o.duration = +h.duration().toFixed(3);
    const t0 = performance.now(); const id = h.play('a'); await new Promise(r => h.once('end', r, id)); o.spriteAEndMs = Math.round(performance.now() - t0);
    h.stereo(-1); o.stereo = h.stereo(); h.pos(2, 0, -1); o.pos = h.pos();
    Howler.mute(true); o.muted = Howler._muted; Howler.mute(false); Howler.volume(0.4); o.vol = Howler.volume();
    o.states = [h.state(), h.playing()]; o.hasSpatial = typeof h.pos === 'function';
    return o;
  });
  r.tone = await p.evaluate(async () => {
    const o = { version: Tone.version, ctxState: Tone.getContext().state };
    const buf = await Tone.Offline(({ transport }) => {
      const s = new Tone.Synth({ oscillator: { type: 'triangle' } }).toDestination();
      s.triggerAttackRelease('C5', 0.1, 0.25);
    }, 1);
    const d = buf.getChannelData(0); let first = -1, peak = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (first < 0 && a > 0.001) first = i; }
    o.firstSoundAtS = +(first / buf.sampleRate).toFixed(4); o.expected = 0.25; o.peak = +peak.toFixed(3);
    // Transport: schedule events on the audio clock; check callback 'time' vs the context clock
    await Tone.start(); Tone.Transport.bpm.value = 120; const times = []; const leads = [];
    Tone.Transport.scheduleRepeat(t => { times.push(t); leads.push(t - Tone.getContext().rawContext.currentTime); }, '8n');
    Tone.Transport.start('+0.1'); await new Promise(r => setTimeout(r, 1500)); Tone.Transport.stop(); Tone.Transport.cancel();
    const df = times.slice(1).map((t, i) => t - times[i]);
    o.transport = { events: times.length, step: +Math.min(...df).toFixed(6) + ' to ' + +Math.max(...df).toFixed(6), expectedStep: 0.25, minLeadVsRawClock: +Math.min(...leads).toFixed(3) };
    return o;
  });
  r.zzfx = await p.evaluate(async () => {
    const params = [, , 925, .04, .3, .6, 1, .3, , 6.27, -184, .09, .17]; // ZzFX "coin" style preset
    const o = {};
    const s = ZZFX.buildSamples(...params); o.samples = s.length; o.seconds = +(s.length / ZZFX.sampleRate).toFixed(3);
    const s2 = ZZFX.buildSamples(...params); o.deterministic = s.every((v, i) => v === s2[i]); // randomness param default .05 uses Math.random => expect false
    const p0 = params.slice(); p0[1] = 0; const a = ZZFX.buildSamples(...p0), c = ZZFX.buildSamples(...p0); o.deterministicWhenRandomnessZero = a.every((v, i) => v === c[i]);
    o.ctxState = ZZFX.audioContext.state;
    const off = new OfflineAudioContext(1, 44100, 44100); const buf = off.createBuffer(1, a.length, 44100); buf.getChannelData(0).set(a);
    const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start(); const r = await off.startRendering();
    let peak = 0; r.getChannelData(0).forEach(v => { if (Math.abs(v) > peak) peak = Math.abs(v); }); o.renderedPeak = +peak.toFixed(3);
    const node = ZZFX.play(...params); o.playReturnsSource = node && node.constructor.name;
    return o;
  });
  r.jsfxr = await p.evaluate(async () => {
    const o = {}; const def = sfxr.generate('pickupCoin'); o.keys = Object.keys(def).length;
    const w = sfxr.toWave(def); o.dataUriPrefix = w.dataURI.slice(0, 30); o.wavBytes = Math.round((w.dataURI.length - 22) * 0.75);
    const w2 = sfxr.toWave(def); o.sameDefSameBytes = w.dataURI === w2.dataURI;
    const ab = Uint8Array.from(atob(w.dataURI.split(',')[1]), c => c.charCodeAt(0)).buffer;
    const buf = await new AudioContext().decodeAudioData(ab); o.decodedSeconds = +buf.duration.toFixed(3); o.sr = buf.sampleRate;
    o.b58 = sfxr.b58encode(def).length;
    return o;
  });
  check('one page, no external request', !net.length, net.join(' '));
  check('no page errors', !errs.length, errs.join(' | '));
  check('Howler: sprite a (150 ms) ends near 150 ms', r.howler.spriteAEndMs >= 140 && r.howler.spriteAEndMs < 400, r.howler.spriteAEndMs + ' ms');
  check('Howler: stereo, pos, mute, volume', r.howler.stereo === -1 && r.howler.muted === true && Math.abs(r.howler.vol - 0.4) < 1e-9 && r.howler.usingWebAudio, JSON.stringify(r.howler));
  check('Tone: Offline note starts at 0.25 s', Math.abs(r.tone.firstSoundAtS - 0.25) < 0.005, r.tone.firstSoundAtS + ' s');
  check('Tone: Transport steps exact at 120 bpm (8n = 0.25 s)', /^0\.25 to 0\.25$/.test(r.tone.transport.step), JSON.stringify(r.tone.transport));
  check('ZzFX: deterministic only with randomness 0', r.zzfx.deterministic === false && r.zzfx.deterministicWhenRandomnessZero === true, JSON.stringify(r.zzfx));
  check('jsfxr: same definition, same bytes; decodes', r.jsfxr.sameDefSameBytes && r.jsfxr.decodedSeconds > 0, JSON.stringify(r.jsfxr));
} finally { await b.close(); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
// Scratch: a folder this test made in the OS temp folder is removed when every check passes and kept (path printed)
// when one fails; a folder given on the command line is always kept.
if (!failed && !process.argv[2]) { fs.rmSync(OUT, { recursive: true, force: true }); console.log(`scratch removed: ${OUT}`); }
process.exit(failed ? 1 : 0);
