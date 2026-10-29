// review.mjs: the three-zoom review loop for any seek page (the shape of the whole piece, every frame of a moment,
// full-resolution detail). Every run writes new file names, so an image viewer never shows a cached older sheet.
//
//   node review.mjs page.html --sheet 0.5,1,2,3 [--cols 4] [--w 400]     contact sheet of chosen times
//   node review.mjs page.html --strip 1.8:2.4 [--cols 8] [--w 240]        EVERY frame between two times (at the page fps)
//   node review.mjs page.html --crop 560,180,320,320@2.76 [--zoom 2]      full-resolution crop at a time (zoom 2 = 2x pixels)
//   --out dir (default review/ beside the page)
// Prints the written paths. Then LOOK at them: describe each frame in one sentence before judging.
//
// Uses sensei-video-pipeline's CDP client (no npm packages) and ffmpeg for tiling (FFMPEG_PATH or discovery).
// verified: Windows 10, Chrome 155 headless, ffmpeg 7.1, on examples/hop.html and examples/svg-boil.html; the images
//           were looked at.  not verified: macOS and Linux.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { launch, toUrl } = await import(pathToFileURL(path.resolve(HERE, '../../sensei-video-pipeline/scripts/cdp.mjs')).href);
const { findFfmpeg } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/discover.mjs')).href);

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const page = a[0];
if (!page || !(opt('--sheet') || opt('--strip') || opt('--crop'))) { console.error('usage: node review.mjs page.html --sheet t,t | --strip a:b | --crop x,y,w,h@t [--out dir]'); process.exit(2); }
const out = path.resolve(opt('--out', path.join(path.dirname(path.resolve(page)), 'review')));
fs.mkdirSync(out, { recursive: true });
const stamp = Date.now().toString(36), base = path.basename(page).replace(/\.\w+$/, '');
const ff = findFfmpeg();

const chrome = await launch({ gl: 'swiftshader' });
let code = 0;
try {
  const url = new URL(toUrl(page)); url.searchParams.set('render', '1');
  const pg = await chrome.open(url.href, { width: 1920, height: 1080 });
  let meta = await pg.meta();
  await pg.send('Emulation.setDeviceMetricsOverride', { width: meta.w, height: meta.h, deviceScaleFactor: +opt('--zoom', 1), mobile: false });
  await pg.ready(); meta = await pg.meta();
  const tile = async (times, cols, w, name) => {
    if (!ff.found) throw new Error('ffmpeg not found: set FFMPEG_PATH');
    const dir = fs.mkdtempSync(path.join(out, '.tmp-'));
    try {
      for (const [i, t] of times.entries()) { await pg.seek(t); fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), await pg.shot({ format: 'png' })); }
      const file = path.join(out, `${base}-${name}-${stamp}.png`);
      const r = spawnSync(ff.path, ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-i', path.join(dir, 'f%04d.png'),
        '-vf', `scale=${w}:-2,tile=${cols}x${Math.ceil(times.length / cols)}:padding=3:color=white`, '-frames:v', '1', file], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(r.stderr);
      return file;
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  if (opt('--sheet')) {
    const times = opt('--sheet').split(',').map(Number);
    console.log(await tile(times, +opt('--cols', Math.min(4, times.length)), +opt('--w', 400), 'sheet'));
  }
  if (opt('--strip')) {
    const [t0, t1] = opt('--strip').split(':').map(Number), fps = meta.fps || 24, times = [];
    for (let f = Math.round(t0 * fps); f <= Math.round(t1 * fps); f++) times.push(f / fps);
    console.log(await tile(times, +opt('--cols', 8), +opt('--w', 240), `strip-${t0}-${t1}`));
  }
  if (opt('--crop')) {
    const [box, at] = opt('--crop').split('@'), [x, y, w, h] = box.split(',').map(Number);
    await pg.seek(+at);
    const file = path.join(out, `${base}-crop-${at}-${stamp}.png`);
    fs.writeFileSync(file, await pg.shot({ format: 'png', clip: { x, y, width: w, height: h } }));
    console.log(file);
  }
} catch (e) { console.error(`review failed: ${e.message}`); code = 1; }
finally { await chrome.close(); }
process.exit(code);
