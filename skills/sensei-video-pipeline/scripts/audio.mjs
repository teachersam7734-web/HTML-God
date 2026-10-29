// audio.mjs: loudness measurement and two-pass loudness normalisation with ffmpeg, plus a mux that refuses to
// delete anything.
//
//   node audio.mjs measure mix.wav                      integrated LUFS, true peak dBTP, loudness range
//   node audio.mjs normalize in.wav out.wav [--lufs -14] [--tp -1.5] [--lra 11]
//   node audio.mjs mux film.mp4 mix.wav out.mp4 [--srt captions.srt]     video copied, AAC 192k, captions as mov_text
//
// Targets: about -14 LUFS for the web (-16 is also used, as in the Save The Damsel films), true peak at or below
// -1.5 dBTP so AAC stays under 0 dBFS. A loudness number is not listening: a person still has to hear the mix.
//
// verified: ffmpeg 7.1 on Windows 10 with a synthesised test signal (test-pipeline.mjs): after normalize, the
//           re-measured file is within 0.5 LU of the target and its true peak is at or below the ceiling; mux
//           writes an MP4 with video, AAC and a mov_text track.
// not verified: other ffmpeg builds' loudnorm defaults; multichannel audio.
// Original HTML-Sensei code (standard loudnorm two-pass usage from the ffmpeg documentation).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { findFfmpeg } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/discover.mjs')).href);
const ff = findFfmpeg();
const run = args => { const r = spawnSync(ff.path, ['-hide_banner', '-nostats', ...args], { windowsHide: true, encoding: 'utf8', maxBuffer: 1 << 26 }); if(r.error)throw new Error('Could not run ffmpeg: '+r.error.message);return r; };

export function measure(file, { lufs = -14, tp = -1.5, lra = 11 } = {}) {
  const r = run(['-i', file, '-af', `loudnorm=I=${lufs}:TP=${tp}:LRA=${lra}:print_format=json`, '-f', 'null', '-']);
  const m = r.stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!m) throw new Error(`loudnorm gave no measurement: ${r.stderr.slice(-300)}`);
  const j = JSON.parse(m[0]);
  return { lufs: +j.input_i, truePeak: +j.input_tp, lra: +j.input_lra, threshold: +j.input_thresh, offset: +j.target_offset, raw: j };
}

export function normalize(input, output, { lufs = -14, tp = -1.5, lra = 11 } = {}) {
  const m = measure(input, { lufs, tp, lra }).raw;
  const af = `loudnorm=I=${lufs}:TP=${tp}:LRA=${lra}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const r = run(['-y', '-i', input, '-af', af, '-ar', '48000', output]);
  if (r.status !== 0) throw new Error(`normalize failed: ${r.stderr.slice(-300)}`);
  return measure(output, { lufs, tp, lra });
}

export function mux(video, audio, out, { srt = null } = {}) {
  const args = ['-y', '-i', video, '-i', audio];
  if (srt) args.push('-i', srt);
  args.push('-map', '0:v', '-map', '1:a', ...(srt ? ['-map', '2:s', '-c:s', 'mov_text'] : []), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out + '.part.mp4');
  const r = run(args);
  if (r.status !== 0) throw new Error(`mux failed: ${r.stderr.slice(-300)}`);
  fs.renameSync(out + '.part.mp4', out);                 // the sources are never deleted here
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (!ff.found) { console.error('ffmpeg not found: set FFMPEG_PATH'); process.exit(2); }
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const o = { lufs: +opt('--lufs', -14), tp: +opt('--tp', -1.5), lra: +opt('--lra', 11) };
  try {
    if (a[0] === 'measure') { const m = measure(a[1], o); console.log(JSON.stringify({ lufs: m.lufs, truePeak: m.truePeak, lra: m.lra })); }
    else if (a[0] === 'normalize') { const m = normalize(a[1], a[2], o); console.log(`wrote ${a[2]}: ${m.lufs} LUFS, true peak ${m.truePeak} dBTP`); }
    else if (a[0] === 'mux') console.log(`wrote ${mux(a[1], a[2], a[3], { srt: opt('--srt', null) })}`);
    else { console.error('usage: measure f | normalize in out | mux video audio out [--srt f]'); process.exit(2); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
