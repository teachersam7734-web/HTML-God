// preflight.mjs: before a render, one JSON report of what this machine has: Chrome, ffmpeg and ffprobe (with the
// filters the pipeline uses), free disk where the output goes, Node's WebSocket, and which WebGL renderer headless
// Chrome reaches. Installs nothing. Exit 0 when a render can run, 1 when something required is missing.
//
//   node preflight.mjs [outDir] [--no-gl]
//
// verified: Windows 10, Node 24, Chrome 155, ffmpeg 7.1 gyan.dev essentials (reports SwiftShader as the WebGL
//           renderer on this machine's virtual GPU).
// not verified: macOS and Linux (fs.statfs and the discovery are cross-platform by design).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { findChrome, findFfmpeg } = await import(pathToFileURL(path.resolve(HERE, '../../../lib/discover.mjs')).href);
const outDir = path.resolve(process.argv.slice(2).find(x => !x.startsWith('--')) || '.');
const chrome = findChrome(), ff = findFfmpeg();
const report = { node: process.versions.node, websocket: typeof WebSocket !== 'undefined', chrome: chrome.found ? chrome.path : null,
  ffmpeg: ff.found ? ff.path : null, ffprobe: ff.ffprobe || null, filters: {}, freeDiskGB: null, glRenderer: null, problems: [] };
if (ff.found) {
  const list = spawnSync(ff.path, ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout || '';
  for (const f of ['tmix', 'tile', 'loudnorm', 'ebur128', 'signalstats', 'scdet', 'blackdetect']) report.filters[f] = new RegExp(`\\s${f}\\s`).test(list);
  const enc = spawnSync(ff.path, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout || '';
  report.libx264 = /libx264/.test(enc);
  if (!report.libx264) report.problems.push('ffmpeg has no libx264 encoder');
}
try { const s = fs.statfsSync(fs.existsSync(outDir) ? outDir : path.dirname(outDir)); report.freeDiskGB = +((s.bavail * s.bsize) / 1e9).toFixed(2); } catch { /* unknown */ }
if (!report.websocket) report.problems.push('Node has no global WebSocket: use Node 22 or newer');
if (!report.chrome) report.problems.push('no Chrome or Chromium: set CHROME');
if (!report.ffmpeg) report.problems.push('no ffmpeg: set FFMPEG_PATH');
if (report.freeDiskGB !== null && report.freeDiskGB < 2) report.problems.push(`only ${report.freeDiskGB} GB free: a 1080p master and its chunks need several GB; free space first`);
if (report.chrome && report.websocket && !process.argv.includes('--no-gl')) {
  const { launch } = await import('./cdp.mjs');
  const c = await launch({ gl: 'swiftshader' });
  try { const p = await c.open('about:blank', { width: 64, height: 64 }); report.glRenderer = await p.glRenderer(); } finally { await c.close(); }
  if (/swiftshader|llvmpipe|software/i.test(report.glRenderer)) report.note = 'WebGL is software here: renders are slow but deterministic. Do not downgrade effects for this machine; say what was not verified at speed on a GPU.';
}
console.log(JSON.stringify(report, null, 2));
process.exit(report.problems.length ? 1 : 0);
