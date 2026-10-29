// capture_frames.mjs: deterministic frames of an animated player page for contact_sheet.py.
//
//   node capture_frames.mjs <page.html> <outDir> [count=8] [duration=4]
//
// Pauses playback, seeks every clip to evenly spaced times 0..duration (the last capture is at t = duration, which
// must equal t = 0 for a seamless loop), saves f_000.png .. f_<count>.png. Uses window.__demo.seek, or window.__seek
// on pages that only follow the sensei-3d contract.
// verified: Windows 10, Node 24, Chrome 155 headless + SwiftShader, on the Draco demo page: 9 frames, contact sheet
//           loop seam 0.0 (test-web.mjs).
// not verified: macOS and Linux; clips whose duration differs from the value passed (pass the real clip length).
// Adapted from blender-demo/web/capture_frames.mjs in the HTML-Sensei build project's research notes (not shipped) (run there). Original code of this project.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { open, fileUrl, screenshot } from './cdp.mjs';

const [target, outDir, count = '8', duration = '4'] = process.argv.slice(2);
if (!target || !outDir) { console.error('usage: node capture_frames.mjs <page.html> <outDir> [count=8] [duration=4]'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const cdp = await open({ width: 900, height: 600 });
try {
  await cdp.send('Page.navigate', { url: fileUrl(target) });
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) { await cdp.sleep(300); ready = await cdp.evaluate('window.__done === true'); }
  if (!ready) throw new Error('page never set window.__done');
  await cdp.evaluate('window.__demo && window.__demo.setPlaying(false)');
  const n = +count, d = +duration;
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * d;
    await cdp.evaluate(`(window.__demo ? window.__demo.seek(${t}) : window.__seek(${t}), true)`);
    await cdp.sleep(250);
    writeFileSync(join(outDir, `f_${String(k).padStart(3, '0')}.png`), await screenshot(cdp));
  }
  console.log(`captured ${n + 1} frames to ${outDir}`);
} finally { await cdp.close(); }
