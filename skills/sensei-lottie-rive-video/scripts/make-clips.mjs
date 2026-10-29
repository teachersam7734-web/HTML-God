// make-clips.mjs: synthetic test clips with ffmpeg (no third-party footage), the fixtures for test-video.mjs.
//
//   FFMPEG=<path to ffmpeg> node make-clips.mjs <outDir>      (or FFMPEG_PATH; else the plugin's discovery)
//
// Writes: h264-default-gop.mp4 (GOP 250), h264-gop12.mp4, h264-allintra.mp4, vp9.webm, av1.mp4, hevc.mp4 (hvc1),
// alpha-vp9.webm (a moving opaque circle on transparency), framecode-{gop250,gop12,allintra}.mp4 (red channel =
// 2 x frame number, so a decoded pixel says which frame the browser showed), framecode-gop12.h264 (raw Annex B with
// access unit delimiters, for WebCodecs without a demuxer), captions.vtt. All 4 s (frame-coded: 100 frames) at 30 fps.
// verified: Windows 10, ffmpeg 7.1 (gyan.dev essentials build, passed through FFMPEG): every clip written.
// not verified: other ffmpeg builds (libaom, libx265 and libvpx must be present; the essentials build has them).
// Ported from code-media/video/make-clips.cjs in the HTML-Sensei build project's research notes (not shipped) (original to this project) to an ES module.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ffmpeg } from './pw.mjs';

const out = process.argv[2];
if (!out) { console.error('usage: node make-clips.mjs <outDir>'); process.exit(2); }
const ff = await ffmpeg();
if (!ff) { console.error('ffmpeg not found: set FFMPEG or FFMPEG_PATH to the ffmpeg executable'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const P = f => path.join(out, f);
const run = (args, file) => {
  const t = Date.now();
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
  console.log(file.padEnd(26), (fs.statSync(P(file)).size / 1024).toFixed(1).padStart(8), 'KB', ((Date.now() - t) / 1000).toFixed(1) + ' s');
};
const SRC = ['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=4'];
const H264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
run([...SRC, ...H264, P('h264-default-gop.mp4')], 'h264-default-gop.mp4');
run([...SRC, ...H264, '-g', '12', '-keyint_min', '12', '-sc_threshold', '0', P('h264-gop12.mp4')], 'h264-gop12.mp4');
run([...SRC, ...H264, '-g', '1', P('h264-allintra.mp4')], 'h264-allintra.mp4');
run([...SRC, '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', P('vp9.webm')], 'vp9.webm');
run([...SRC, '-c:v', 'libaom-av1', '-crf', '34', '-b:v', '0', '-cpu-used', '8', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', P('av1.mp4')], 'av1.mp4');
run([...SRC, '-c:v', 'libx265', '-crf', '26', '-preset', 'medium', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-x265-params', 'log-level=error', P('hevc.mp4')], 'hevc.mp4');
run([...SRC, '-f', 'lavfi', '-i', "nullsrc=s=640x360:r=30:d=4,geq=lum='if(lt(hypot(X-320+120*sin(T*3)\,Y-180)\,90)\,255\,0)':cb=128:cr=128",
  '-filter_complex', '[0:v][1:v]alphamerge,format=yuva420p', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '30', '-b:v', '0', '-auto-alt-ref', '0', '-an', P('alpha-vp9.webm')], 'alpha-vp9.webm');
const FC = ['-f', 'lavfi', '-i', "color=c=black:s=160x90:r=30:d=3.3333,geq=r='2*N':g=128:b=128"];
for (const [name, g] of [['framecode-gop250', 250], ['framecode-gop12', 12], ['framecode-allintra', 1]]) {
  run([...FC, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-g', String(g), '-keyint_min', String(g), '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', P(name + '.mp4')], name + '.mp4');
}
run([...FC, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-g', '12', '-keyint_min', '12', '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-x264-params', 'aud=1', '-bsf:v', 'h264_mp4toannexb', '-f', 'h264', P('framecode-gop12.h264')], 'framecode-gop12.h264');
fs.writeFileSync(P('captions.vtt'), 'WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nFirst caption\n\n00:00:01.500 --> 00:00:03.000\nSecond caption\n');
console.log('done ->', out);
