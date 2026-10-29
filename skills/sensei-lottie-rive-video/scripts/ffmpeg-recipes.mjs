// ffmpeg-recipes.mjs: the video recipe book, run for real, with sizes and ffprobe facts. Each recipe is one function
// call below; copy the argument list into your own build.
//
//   FFMPEG=<ffmpeg> node ffmpeg-recipes.mjs <clips from make-clips.mjs> <outDir>     (FFPROBE optional: else beside ffmpeg)
//
// Recipes: poster (JPEG, WebP) from the first frame; hero H.264 (high, CRF 20, faststart, no audio, even size);
// hero VP9; hero AV1 (libaom); seamless loop by cross-fading the tail into the head; scrub encodes (all-intra, GOP 8
// without B-frames); VP9 alpha re-encode; alpha-packed H.264 (colour above, alpha matte below); a loudness-normalised
// Opus track. Prints a JSON summary on the last line (sizes, loop duration, faststart, ffprobe pixel formats).
// verified: Windows 10, ffmpeg 7.1 essentials build through FFMPEG: every recipe runs (sizes in references/video.md).
// not verified: real footage (all clips synthetic: sizes are indicative only); SVT-AV1; HEVC with alpha (needs
//               Apple's encoder).
// Ported from code-media/video/ffmpeg-recipes.cjs in the HTML-Sensei build project's research notes (not shipped) (original to this project) to an ES module.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ffmpeg, ffprobe } from './pw.mjs';

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) { console.error('usage: node ffmpeg-recipes.mjs <clips> <outDir>'); process.exit(2); }
const ff = await ffmpeg(), fp = await ffprobe();
if (!ff) { console.error('ffmpeg not found: set FFMPEG or FFMPEG_PATH'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const I = f => path.join(inDir, f), O = f => path.join(outDir, f);
const sizes = {};
const run = (label, args, out) => {
  const t = Date.now();
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  sizes[out] = Math.round(fs.statSync(O(out)).size / 102.4) / 10;
  console.log(label.padEnd(44), String(sizes[out]).padStart(8), 'KB', ((Date.now() - t) / 1000).toFixed(1) + ' s');
};
const SRC = I('h264-default-gop.mp4');
run('poster JPEG, first frame, q 3', ['-i', SRC, '-frames:v', '1', '-q:v', '3', O('poster.jpg')], 'poster.jpg');
run('poster WebP, first frame, quality 80', ['-i', SRC, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', O('poster.webp')], 'poster.webp');
run('hero H.264 high, CRF 20, faststart, no audio', ['-i', SRC, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-movflags', '+faststart', '-an', O('hero.mp4')], 'hero.mp4');
run('hero VP9, CRF 30', ['-i', SRC, '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1', '-an', O('hero.webm')], 'hero.webm');
run('hero AV1 (libaom), CRF 32, cpu-used 4', ['-i', SRC, '-c:v', 'libaom-av1', '-crf', '32', '-b:v', '0', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', O('hero-av1.mp4')], 'hero-av1.mp4');
run('seamless loop, 0.5 s cross-fade of tail into head', ['-i', SRC, '-i', SRC, '-filter_complex', '[0:v][1:v]xfade=transition=fade:duration=0.5:offset=3.5,trim=0:3.5,setpts=PTS-STARTPTS[v]', '-map', '[v]', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', O('loop.mp4')], 'loop.mp4');
run('scrub, all-intra (g 1)', ['-i', SRC, '-c:v', 'libx264', '-crf', '20', '-g', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', O('scrub-intra.mp4')], 'scrub-intra.mp4');
run('scrub, GOP 8, no B-frames', ['-i', SRC, '-c:v', 'libx264', '-crf', '20', '-g', '8', '-keyint_min', '8', '-sc_threshold', '0', '-bf', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', O('scrub-g8.mp4')], 'scrub-g8.mp4');
run('alpha WebM re-encode, CRF 36', ['-c:v', 'libvpx-vp9', '-i', I('alpha-vp9.webm'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '36', '-b:v', '0', '-auto-alt-ref', '0', '-an', O('alpha36.webm')], 'alpha36.webm');
run('alpha-packed H.264 (colour over matte)', ['-c:v', 'libvpx-vp9', '-i', I('alpha-vp9.webm'), '-filter_complex', '[0:v]format=yuva420p,split[a][b];[b]alphaextract,format=yuv420p[m];[a]format=yuv420p[c];[c][m]vstack', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', O('alpha-packed.mp4')], 'alpha-packed.mp4');
run('tone to -16 LUFS, Opus', ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libopus', '-b:a', '64k', O('tone.webm')], 'tone.webm');
const probe = f => JSON.parse(execFileSync(fp, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', O(f)]).toString());
const facts = {};
for (const f of ['hero.mp4', 'loop.mp4', 'scrub-g8.mp4', 'alpha36.webm', 'alpha-packed.mp4']) {
  const j = probe(f), v = j.streams.find(s => s.codec_type === 'video');
  facts[f] = { codec: v.codec_name, pix_fmt: v.pix_fmt, size: `${v.width}x${v.height}`, seconds: +(+j.format.duration).toFixed(2), audio: j.streams.filter(s => s.codec_type === 'audio').length };
}
const buf = fs.readFileSync(O('hero.mp4'));
console.log(JSON.stringify({ sizes, facts, faststart: buf.indexOf('moov') < buf.indexOf('mdat') }));
