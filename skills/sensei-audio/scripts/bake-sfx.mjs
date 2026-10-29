// bake-sfx.mjs: render engine sounds once (OfflineAudioContext), trim them, encode them with ffmpeg, prove every file
// decodes in Chrome, and write a script that carries them as data URIs for a single offline page.
//
//   node bake-sfx.mjs --out baked [--names click,pop,chime,success] [--codecs opus,aac,vorbis,mp3,wav] [--seed 1]
//
// Writes <out>/<name>.wav and one file per codec, <out>/sfx-data.js (window.SFX_DATA = { name: { opus: 'data:...' } })
// and <out>/bake.json (bytes per file, decoded duration, codec). Exit 1 if any file fails to decode.
// Pick per sound at run time: Opus or Vorbis in Ogg for Chromium and Firefox, AAC in m4a for Safari; WAV for very
// short clicks; never MP3 or AAC for loops (encoder delay and padding leave a gap at the loop point).
// ffmpeg: FFMPEG, FFMPEG_PATH or FFMPEG_BIN, else the plugin's discovery. Browser: pw.mjs.
// verified: Windows 10, Chrome 155, ffmpeg 7.1 (gyan.dev essentials build) passed through FFMPEG: every codec of every default
//           sound decodes with decodeAudioData; sizes in SKILL.md.
// not verified: Safari decoding (AAC is there for Safari; not run on it); other ffmpeg builds' encoder availability.
// Adapted from code-media/audio/test-samples.cjs in the HTML-Sensei build project's research notes (not shipped) (original to this project); trimming, the
// data-URI script and the report are new here.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, ffmpeg } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const OUT = path.resolve(opt('--out', 'baked'));
const NAMES = opt('--names', 'click,tick,pop,toggleOn,whoosh,chime,success,error,impact').split(',');
const CODECS = opt('--codecs', 'opus,aac,vorbis,mp3,wav').split(',');
const SEED = +opt('--seed', '1');
const ENC = {
  opus: { args: ['-c:a', 'libopus', '-b:a', '48k'], fmt: 'ogg', ext: 'ogg', mime: 'audio/ogg' },
  aac: { args: ['-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart'], fmt: 'ipod', ext: 'm4a', mime: 'audio/mp4' },
  vorbis: { args: ['-c:a', 'libvorbis', '-q:a', '3'], fmt: 'ogg', ext: 'vorbis.ogg', mime: 'audio/ogg' },
  mp3: { args: ['-c:a', 'libmp3lame', '-b:a', '96k'], fmt: 'mp3', ext: 'mp3', mime: 'audio/mpeg' },
};
fs.mkdirSync(OUT, { recursive: true });
const ff = CODECS.some(c => c !== 'wav') ? await ffmpeg() : null;
if (CODECS.some(c => c !== 'wav') && !ff) { console.error('ffmpeg not found: set FFMPEG (or FFMPEG_PATH) to the ffmpeg executable'); process.exit(2); }

const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
try {
  const p = await (await browser.newContext()).newPage();
  await p.goto('about:blank');
  await p.addScriptTag({ path: path.join(HERE, 'sensei-sfx.js') });
  const wavs = await p.evaluate(async ({ names, seed }) => {
    function wav(buf, frames) {
      const d = buf.getChannelData(0), n = frames, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
      let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s);
    }
    const out = {};
    for (const n of names) {
      const off = new OfflineAudioContext(1, 48000 * 3, 48000);
      const s = SenseiSFX.create({ ctx: off, storageKey: 'bake-' + n, seed, reducedMotion: false });
      const end = s.play(n, { when: 0 });
      const buf = await off.startRendering();
      out[n] = { b64: wav(buf, Math.min(buf.length, Math.ceil((end + 0.03) * 48000))), seconds: +(end + 0.03).toFixed(3) };   // trim the silent tail
    }
    return out;
  }, { names: NAMES, seed: SEED });

  const files = [];
  for (const [n, { b64 }] of Object.entries(wavs)) {
    const w = path.join(OUT, n + '.wav'); fs.writeFileSync(w, Buffer.from(b64, 'base64'));
    if (CODECS.includes('wav')) files.push({ name: n, codec: 'wav', file: w, mime: 'audio/wav' });
    for (const c of CODECS.filter(c => ENC[c])) {
      const e = ENC[c], dst = path.join(OUT, `${n}.${e.ext}`);
      const r = spawnSync(ff, ['-y', '-v', 'error', '-i', w, '-ar', '48000', ...e.args, '-f', e.fmt, dst], { encoding: 'utf8' });
      if (r.status !== 0) { console.log(`FAIL  encode ${n} ${c}: ${r.stderr.trim().slice(0, 160)}`); failed++; continue; }
      files.push({ name: n, codec: c, file: dst, mime: e.mime });
    }
  }
  const decoded = await p.evaluate(async list => {
    const ac = new AudioContext(), res = [];
    for (const f of list) {
      try { const ab = Uint8Array.from(atob(f.b64), ch => ch.charCodeAt(0)).buffer; const b = await ac.decodeAudioData(ab); res.push({ ok: true, seconds: +b.duration.toFixed(3) }); }
      catch (e) { res.push({ ok: false, err: String(e).slice(0, 100) }); }
    }
    return res;
  }, files.map(f => ({ b64: fs.readFileSync(f.file).toString('base64') })));
  const report = files.map((f, i) => ({ name: f.name, codec: f.codec, bytes: fs.statSync(f.file).size, ...decoded[i] }));
  for (const r of report.filter(r => !r.ok)) { console.log(`FAIL  decode ${r.name} ${r.codec}: ${r.err}`); failed++; }
  const data = {};
  for (const f of files) (data[f.name] = data[f.name] || {})[f.codec] = `data:${f.mime};base64,` + fs.readFileSync(f.file).toString('base64');
  fs.writeFileSync(path.join(OUT, 'sfx-data.js'), '// Generated by bake-sfx.mjs from sensei-sfx.js (CC0). Decode once with decodeAudioData; keep the AudioBuffer.\nwindow.SFX_DATA = ' + JSON.stringify(data) + ';\n');
  fs.writeFileSync(path.join(OUT, 'bake.json'), JSON.stringify({ seed: SEED, sounds: Object.fromEntries(Object.entries(wavs).map(([n, v]) => [n, v.seconds])), files: report }, null, 1) + '\n');
  const table = {}; for (const r of report) (table[r.name] = table[r.name] || {})[r.codec] = r.bytes;
  console.table(table);
  console.log(`${report.filter(r => r.ok).length} of ${report.length} files decode in Chrome; data script ${(fs.statSync(path.join(OUT, 'sfx-data.js')).size / 1024).toFixed(1)} KB`);
} finally { await browser.close(); }
process.exit(failed ? 1 : 0);
