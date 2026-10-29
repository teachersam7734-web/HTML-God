// sheet.mjs: review images from a rendered MP4 (the master, not the page): a contact sheet across the whole film and
// a strip of consecutive frames around a moment. Every call writes a new file name (an image viewer may otherwise
// show a cached older sheet).
//
//   node sheet.mjs film.mp4 [--fps 2] [--cols 6] [--w 320] [--out dir]           contact sheet of the master
//   node sheet.mjs film.mp4 --strip 4.5 [--n 12] [--cols 6] [--out dir]           every frame around 4.5 s
//
// verified: ffmpeg 7.1 on Windows 10 on renders of the examples (test-pipeline.mjs); the sheets were looked at.
// not verified: very long films (a 2 fps sheet of a 4 minute film is 480 tiles: raise --fps divisor or split).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { findFfmpeg } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/discover.mjs')).href);
const ff = findFfmpeg();
if (!ff.found) { console.error('ffmpeg not found: set FFMPEG_PATH'); process.exit(2); }
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const film = a[0];
const probe = spawnSync(ff.ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=r_frame_rate', '-select_streams', 'v:0', '-of', 'json', film], { encoding: 'utf8' });
const info = JSON.parse(probe.stdout), dur = +info.format.duration, [n, d] = info.streams[0].r_frame_rate.split('/').map(Number), fps = n / d;
const outDir = opt('--out', path.dirname(path.resolve(film))), base = path.basename(film).replace(/\.\w+$/, ''), stamp = Date.now().toString(36);
const cols = +opt('--cols', 6), w = +opt('--w', 320);
let out, vf, frames, pre = [];
if (opt('--strip')) {
  const at = +opt('--strip'), count = +opt('--n', 12), start = Math.max(0, at - (count / 2) / fps);
  frames = count; out = path.join(outDir, `${base}-strip-${at}-${stamp}.png`);
  pre = ['-ss', start.toFixed(4)];                     // input seek is frame-accurate when transcoding
  vf = `scale=${w}:-2,tile=${cols}x${Math.ceil(count / cols)}:padding=2:color=white`;
} else {
  const rate = +opt('--fps', 2); frames = Math.ceil(dur * rate);
  out = path.join(outDir, `${base}-sheet-${stamp}.jpg`);
  vf = `fps=${rate},scale=${w}:-2,tile=${cols}x${Math.ceil(frames / cols)}:padding=2:color=white`;
}
const r = spawnSync(ff.path, ['-hide_banner', '-loglevel', 'error', '-y', ...pre, '-i', film, '-vf', vf, '-frames:v', '1', out], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log(out);
