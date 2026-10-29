// render.mjs: renders a seek page (window.__seek / seek / renderFrame, pure in t) to MP4 through headless Chrome
// and ffmpeg. No npm packages: Chrome over CDP (cdp.mjs), ffmpeg found by lib/discover.mjs.
//
//   node render.mjs page.html --probe [--times 0.5,2,4]           determinism hash (in order, then out of order),
//                                                                  ms per frame, WebGL renderer, time estimate
//   node render.mjs page.html --stills 0.5,2,4 --out stills/       PNG stills
//   node render.mjs page.html --sheet 0.5,1,2,3 --cols 4 --out sheet.png   contact sheet of chosen times
//   node render.mjs page.html out.mp4 [options]                    full render
// Options: --fps 30  --from S --to S  --chunk 10 (seconds per resumable chunk)  --workers 1  --scale 1 (device scale)
//          --shutter 0 (sub-frames per frame for motion blur; 6 or more at 30 fps)  --angle 180
//          --png (lossless intermediates for a master; default JPEG q95 for drafts)  --crf 17
//          --audio file [--audio-offset 0]  --srt file  --gl swiftshader|gpu|none  --force (re-render chunks)
//          --timeout 300 (seconds to wait for the page to be ready)
// The page is opened with ?render=1 so a player script (player.js) mounts nothing.
// Chunks go to <out>.chunks/seg_<from>_<to>.mp4, written as .part.mp4 then renamed, so a killed render resumes
// without redoing finished chunks. A render.json report sits beside the output.
//
// verified: Windows 10, Node 24.16, system Chrome 155 headless with SwiftShader flags, ffmpeg 7.1: probe, stills,
//           sheet, chunked render with resume, two workers, shutter blur with tmix, PNG intermediates, audio and SRT
//           mux, on examples/seek-page.html, examples/webgl-seek.html and sensei-motion-graphics/examples/sting.html.
// not verified: a real GPU (--gl gpu); macOS and Linux; renders longer than a few minutes; 4K.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, toUrl } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { findFfmpeg } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/discover.mjs')).href);

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; return v === undefined || v.startsWith('--') ? true : v; };
const positional = argv.filter((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--') || ['--probe', '--png', '--force'].includes(argv[i - 1])));
const page = positional[0], outFile = positional[1];
if (!page) { console.error('usage: node render.mjs page.html [out.mp4] [--probe | --stills t,t | --sheet t,t] [options]'); process.exit(2); }
const FPS = +opt('--fps', 0) || null, GL = opt('--gl', 'swiftshader'), SCALE = +opt('--scale', 1);
const sha = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 12);
const list = s => String(s).split(',').map(Number).filter(Number.isFinite);
const ff = findFfmpeg();
const needFf = () => { if (!ff.found) { console.error('ffmpeg not found: set FFMPEG_PATH'); process.exit(2); } };

async function openFilm(chrome) {
  const url = new URL(toUrl(page)); url.searchParams.set('render', '1');      // the player half stays out of renders
  const pg = await chrome.open(url.href, { width: 1920, height: 1080, scale: SCALE });
  const first = await pg.meta();                      // size the viewport from the page's own metadata
  if (first.w !== 1920 || first.h !== 1080) await pg.send('Emulation.setDeviceMetricsOverride', { width: first.w, height: first.h, deviceScaleFactor: SCALE, mobile: false });
  await pg.ready(+opt('--timeout', 300) * 1000);
  const meta = await pg.meta();
  if (!meta.seekName) throw new Error('the page has no window.__seek, window.seek or window.renderFrame');
  if (!(meta.dur > 0)) throw new Error('the page states no duration (window.__meta.dur, DURATION, DUR, __duration or film.total)');
  meta.fps = FPS || meta.fps || 30;
  return { pg, meta };
}

async function probe() {
  const chrome = await launch({ gl: GL });
  try {
    const { pg, meta } = await openFilm(chrome);
    const times = opt('--times') ? list(opt('--times')) : [0.1, 0.35, 0.6, 0.9].map(k => +(k * meta.dur).toFixed(3));
    const seq = {}; const t0 = Date.now();
    for (const t of times) { await pg.seek(t); seq[t] = sha(await pg.shot({ format: 'png' })); }
    const msPerFrame = (Date.now() - t0) / times.length;
    let same = 0; const bad = [];
    for (const t of [...times].reverse()) { await pg.seek((t + meta.dur / 2) % meta.dur); await pg.seek(t); const h = sha(await pg.shot({ format: 'png' })); h === seq[t] ? same++ : bad.push(t); }
    const gl = await pg.glRenderer();
    const frames = Math.round(meta.dur * meta.fps);
    const report = { page, meta: { ...meta, events: meta.events ? meta.events.length : 0 }, glRenderer: gl, deterministic: bad.length === 0, sameInAnyOrder: `${same}/${times.length}`, mismatchAt: bad,
      distinctFrames: new Set(Object.values(seq)).size, msPerCapture: Math.round(msPerFrame), estimate: `${frames} frames, about ${Math.round(frames * msPerFrame / 1000)} s per worker without shutter` };
    console.log(JSON.stringify(report, null, 2));
    if (/swiftshader|software|llvmpipe/i.test(gl)) console.log('note: software WebGL. Slow but deterministic; never downgrade the effect for this machine, and say it was not verified at speed on a GPU.');
    return bad.length ? 1 : 0;
  } finally { await chrome.close(); }
}

async function stills(times, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const chrome = await launch({ gl: GL });
  try {
    const { pg } = await openFilm(chrome);
    const files = [];
    for (const t of times) { await pg.seek(t); const f = path.join(outDir, `still-${t.toFixed(3)}.png`); fs.writeFileSync(f, await pg.shot({ format: 'png' })); files.push(f); }
    return files;
  } finally { await chrome.close(); }
}

async function sheet(times, out) {
  needFf();
  const dir = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), '.sheet-'));
  try {
    const files = await stills(times, dir);
    files.forEach((f, i) => fs.renameSync(f, path.join(dir, `s${String(i).padStart(4, '0')}.png`)));
    const cols = +opt('--cols', Math.min(4, times.length)), rows = Math.ceil(times.length / cols);
    const r = spawnSync(ff.path, ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-i', path.join(dir, 's%04d.png'),
      '-vf', `scale=${+opt('--w', 480)}:-2,tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', out], { windowsHide: true });
    if (r.status !== 0) throw new Error(`ffmpeg tile failed: ${r.stderr}`);
    console.log(`sheet ${out} (${times.length} frames, ${cols}x${rows})`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function encoder(file, fps, sub, png, crf) {
  const vf = sub > 1 ? [`tmix=frames=${sub}`, `select='eq(mod(n\\,${sub})\\,${sub - 1})'`, `setpts=N/(${fps}*TB)`].join(',') : null;
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps * sub), '-c:v', png ? 'png' : 'mjpeg', '-i', '-',
    ...(vf ? ['-vf', vf] : []), '-r', String(fps), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file];
  const p = spawn(ff.path, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', d => { err += d; });
  const done = new Promise(res => p.on('close', code => res({ code, err })));
  return { write: b => (p.stdin.write(b) ? null : new Promise(r => p.stdin.once('drain', r))), end: () => { p.stdin.end(); return done; } };
}

async function full() {
  needFf();
  const out = path.resolve(outFile);
  const chunkDir = out + '.chunks'; fs.mkdirSync(chunkDir, { recursive: true });
  const workers = Math.max(1, +opt('--workers', 1)), chunkS = +opt('--chunk', 10), sub = Math.max(1, +opt('--shutter', 0) || 1);
  const angle = +opt('--angle', 180), png = !!opt('--png', false), crf = +opt('--crf', 17), force = !!opt('--force', false);
  const t0 = Date.now();
  const chromes = await Promise.all(Array.from({ length: workers }, () => launch({ gl: GL })));
  let meta, captures = 0, skipped = 0, gl;
  try {
    const films = await Promise.all(chromes.map(openFilm));
    meta = films[0].meta; gl = await films[0].pg.glRenderer();
    const fps = meta.fps, from = +opt('--from', 0), to = Math.min(+opt('--to', meta.dur), meta.dur);
    const f0 = Math.round(from * fps), f1 = Math.round(to * fps), per = Math.max(1, Math.round(chunkS * fps));
    const chunks = []; for (let a = f0; a < f1; a += per) chunks.push([a, Math.min(a + per, f1)]);
    const name = ([a, b]) => path.join(chunkDir, `seg_${String(a).padStart(6, '0')}_${String(b).padStart(6, '0')}.mp4`);
    const queue = chunks.filter(c => force || !fs.existsSync(name(c)) || (skipped++, false));
    await Promise.all(films.map(async ({ pg }) => {
      for (let c; (c = queue.shift());) {
        const part = name(c).replace(/\.mp4$/, '.part.mp4');
        const enc = encoder(part, fps, sub, png, crf);
        for (let i = c[0]; i < c[1]; i++) {
          for (let s = 0; s < sub; s++) {
            const t = sub > 1 ? (i + ((s + 0.5) / sub - 0.5) * angle / 360) / fps : i / fps;
            await pg.seek(Math.max(0, Math.min(meta.dur, t)));
            const w = enc.write(await pg.shot(png ? { format: 'png' } : { format: 'jpeg', quality: 95 })); if (w) await w;
            captures++;
          }
        }
        const r = await enc.end();
        if (r.code !== 0) throw new Error(`ffmpeg failed on ${path.basename(part)}: ${r.err.slice(-300)}`);
        fs.renameSync(part, name(c));                       // only a finished chunk gets its final name
        process.stdout.write(`chunk ${path.basename(name(c))} done\n`);
      }
    }));
    // concat, then mux audio and captions in one step
    const listFile = path.join(chunkDir, 'concat.txt');
    fs.writeFileSync(listFile, chunks.map(c => `file '${path.basename(name(c))}'`).join('\n') + '\n');
    const audio = opt('--audio'), srt = opt('--srt');
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile];
    if (typeof audio === 'string') args.push('-ss', String(+opt('--audio-offset', 0) + from), '-i', audio);
    if (typeof srt === 'string') args.push('-i', srt);
    args.push('-map', '0:v');
    if (typeof audio === 'string') args.push('-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
    if (typeof srt === 'string') args.push('-map', `${typeof audio === 'string' ? 2 : 1}:s`, '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng');
    args.push('-c:v', 'copy', '-movflags', '+faststart', out + '.part.mp4');
    const r = spawnSync(ff.path, args, { windowsHide: true, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`concat or mux failed: ${r.stderr.slice(-400)}`);
    fs.renameSync(out + '.part.mp4', out);
    const secs = (Date.now() - t0) / 1000;
    const report = { page, out, frames: f1 - f0, fps, from, to, shutter: sub, angle: sub > 1 ? angle : null, intermediate: png ? 'png' : 'jpeg q95', crf, workers, chunks: chunks.length, chunksSkipped: skipped,
      captures, seconds: +secs.toFixed(1), capturesPerSecond: +(captures / secs).toFixed(2), glRenderer: gl, chrome: chromes[0].exe, ffmpeg: ff.path, events: meta.events || null };
    fs.writeFileSync(out.replace(/\.mp4$/i, '') + '.render.json', JSON.stringify(report, null, 2) + '\n');
    console.log(`rendered ${out}: ${report.frames} frames in ${report.seconds} s (${report.capturesPerSecond} captures/s, ${skipped} chunk(s) reused)`);
    console.log('Now make a contact sheet from the MP4 (sheet.mjs) and look at it before calling the film done.');
    return 0;
  } finally { await Promise.all(chromes.map(c => c.close())); }
}

let code = 0;
try {
  if (opt('--probe')) code = await probe();
  else if (opt('--stills')) { const files = await stills(list(opt('--stills')), opt('--out', 'stills')); console.log(files.join('\n')); }
  else if (opt('--sheet')) await sheet(list(opt('--sheet')), opt('--out', 'sheet.png'));
  else if (outFile) code = await full();
  else { console.error('give an output .mp4, or --probe, --stills or --sheet'); code = 2; }
} catch (e) { console.error(`render failed: ${e.message}`); code = 1; }
process.exit(code);
