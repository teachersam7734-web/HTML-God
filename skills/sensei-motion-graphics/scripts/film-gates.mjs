// film-gates.mjs: the scripted motion-graphics gates (G0, G2, G3 on the rendered MP4; G5 on the film page).
// G1 (proof readable) and G4 (one hero per frame) have no script: judge them on the contact sheet and say so.
//
//   node film-gates.mjs --video draft.mp4 [--expect 5] [--audio] [--hold-max 1.4] [--json out.json]
//   node film-gates.mjs --page film.html [--samples 24] [--lenient-file]   (needs Playwright, found by discovery)
//
// Exit 0 = every scripted gate passed, 1 = a gate failed, 2 = could not check (tool missing, file unreadable).
// Findings are leads, not verdicts: a gate that passes says nothing about taste.
//
// verified: Windows 10, ffmpeg 7.1 (gyan.dev essentials build), system Chrome 155 driven by Playwright 1.63, on a
//           draft of examples/sting.html and on deliberately bad fixtures (a blank stretch, a 3 s frozen end, a page
//           with a corner label and a progress bar), see test-examples.mjs.
// not verified: macOS and Linux ffmpeg builds (the filters used, signalstats, scdet and metadata, are standard);
//           G5 on canvas or WebGL text (the lint reads the DOM only, it cannot see pixels).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, '../../../lib/discover.mjs');
const { findFfmpeg, findPlaywright, findChrome } = await import(pathToFileURL(LIB).href);

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : (i > 0 ? true : d); };
const out = { gates: {}, notes: [] };
const gate = (id, pass, detail) => { out.gates[id] = { pass, ...detail }; };

function videoGates(file) {
  const ff = findFfmpeg();
  if (!ff.found || !ff.ffprobe) { console.error('ffmpeg/ffprobe not found (set FFMPEG_PATH)'); process.exit(2); }
  const probe = spawnSync(ff.ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,nb_read_frames,r_frame_rate,width,height',
    '-count_frames', '-of', 'json', file], { encoding: 'utf8' });
  if (probe.status !== 0) { gate('G0', false, { reason: `ffprobe could not read it: ${probe.stderr.trim().slice(0, 200)}` }); return; }
  const info = JSON.parse(probe.stdout);
  const v = info.streams.find(s => s.codec_type === 'video'), a = info.streams.find(s => s.codec_type === 'audio');
  const dur = +info.format.duration, [num, den] = (v ? v.r_frame_rate : '0/1').split('/').map(Number), fps = num / den;

  // one pass: per-frame luma spread (flat frames), luma change from the previous frame (motion), scene cuts
  const st = spawnSync(ff.path, ['-hide_banner', '-nostats', '-i', file, '-vf', 'signalstats,scdet=threshold=12,metadata=print:file=-', '-an', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 28 });
  const frames = []; let cur = null;
  for (const line of st.stdout.split(/\r?\n/)) {
    const fm = line.match(/^frame:(\d+)\s+pts:\S+\s+pts_time:([\d.]+)/);
    if (fm) { cur = { t: +fm[2] }; frames.push(cur); continue; }
    const m = line.match(/^lavfi\.(signalstats\.(YMIN|YMAX|YDIF)|scd\.(score|time))=([\d.\-]+)/);
    if (m && cur) cur[m[2] || m[3]] = +m[4];
  }
  const moving = frames.some(f => (f.YDIF || 0) > 0.5);
  const expect = +arg('--expect', 0);
  const g0 = v && frames.length > 0 && moving && (!expect || Math.abs(dur - expect) <= 1 / fps + 0.05) && (!arg('--audio') || !!a);
  gate('G0', g0, { duration: +dur.toFixed(3), fps: +fps.toFixed(3), frames: frames.length, size: v ? `${v.width}x${v.height}` : null, audio: !!a, moving,
    reason: g0 ? undefined : !v ? 'no video stream' : !moving ? 'the picture never changes' : expect && Math.abs(dur - expect) > 1 / fps + 0.05 ? `duration ${dur.toFixed(2)} s, plan says ${expect} s` : 'audio missing' });

  // G2: no run of more than 3 consecutive flat frames (whole-frame luma range under 16 levels: a plain field, film grain
  // allowed; a percentile spread would wrongly call a headline on a plain ground flat)
  let run = 0, worst = 0, at = null;
  for (const f of frames) { if ((f.YMAX - f.YMIN) < 16) { run++; if (run > worst) { worst = run; at = f.t; } } else run = 0; }
  gate('G2', worst <= 3, { longestFlatRun: worst, endsAt: at, reason: worst > 3 ? `${worst} flat frames ending at ${at} s` : undefined });

  // G3: the end hold (picture unchanged at the end) at most hold-max seconds; final shot at most 25% of the film
  const holdMax = +arg('--hold-max', 1.4);
  let k = frames.length - 1; while (k > 0 && (frames[k].YDIF || 0) < 0.2) k--;   // under 0.2: encoder refinement of a still picture, not motion
  const hold = (frames.length - 1 - k) / fps;
  const cuts = frames.filter(f => f.time !== undefined).map(f => f.t);
  const lastShot = cuts.length ? dur - cuts[cuts.length - 1] : dur;
  gate('G3', hold <= holdMax && (cuts.length === 0 || lastShot <= 0.25 * dur), { endHold: +hold.toFixed(3), cutsDetected: cuts.map(c => +c.toFixed(3)), lastShot: +lastShot.toFixed(3),
    reason: hold > holdMax ? `end hold ${hold.toFixed(2)} s is over ${holdMax} s` : cuts.length && lastShot > 0.25 * dur ? `final shot ${lastShot.toFixed(2)} s is over a quarter of the film` : undefined });
  if (!cuts.length) out.notes.push('No hard cuts detected (scdet threshold 12): a carried, one-take film is fine; the final-shot rule was not applied.');
  out.notes.push('G1 (proof readable) and G4 (one hero per frame) have no script: judge them on the contact sheet and say so in NOTE.md.');
}

async function pageGates(file) {
  const pw = findPlaywright(path.dirname(path.resolve(file)));
  if (!pw.found) { console.error('Playwright not found (npm i -D playwright, or set PLAYWRIGHT_PATH)'); process.exit(2); }
  const pwm = await import(pw.importUrl); const chromium = pwm.chromium || pwm.default.chromium;
  const chrome = findChrome();
  // Strict file:// unless --lenient-file: the flag makes file:// behave like http and hides single-file failures.
  const lenient = arg('--lenient-file') === true ? ['--allow-file-access-from-files'] : [];
  const browser = await chromium.launch({ executablePath: chrome.found ? chrome.path : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...lenient] });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(file)).href);
    await page.waitForFunction(() => window.__ready !== undefined || window.READY === true, null, { timeout: 60000 });
    await page.evaluate(() => window.__ready);
    const meta = await page.evaluate(() => window.__meta || { dur: window.DURATION || window.__duration, w: innerWidth, h: innerHeight });
    await page.setViewportSize({ width: meta.w || 1920, height: meta.h || 1080 });
    const n = +arg('--samples', 24);
    const found = await page.evaluate(({ n, dur }) => {
      const seek = window.__seek || window.seek || window.renderFrame, W = innerWidth, H = innerHeight, hits = {};
      const add = (rule, t, el, why) => { (hits[rule] = hits[rule] || []).length < 5 && hits[rule].push({ t: +t.toFixed(2), text: (el.textContent || '').trim().slice(0, 40), why }); };
      for (let i = 0; i < n; i++) {
        const t = (dur * (i + 0.5)) / n; seek(t);
        for (const el of document.querySelectorAll('body *')) {
          if (/^(SCRIPT|STYLE|svg|defs|filter|feGaussianBlur)$/i.test(el.tagName)) continue;
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
          const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
          const own = [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.data).join('').trim();
          const fs = parseFloat(cs.fontSize), small = fs < 0.05 * H;
          if (own) {
            const nearX = r.left < 0.08 * W || r.right > 0.92 * W, nearY = r.top < 0.08 * H || r.bottom > 0.92 * H;
            if (nearX && nearY && small) add('C1 corner or edge label', t, el, 'small text in a corner');
            const caps = cs.textTransform === 'uppercase' || (own === own.toUpperCase() && /[A-Z]{3}/.test(own));
            if (caps && parseFloat(cs.letterSpacing) >= 0.06 * fs && small) add('C2 tracked caps label', t, el, 'small tracked capitals');
            if (/^\s*(\d{1,2}[:.]\d{2}([:.]\d{2})?|\d+\s*\/\s*\d+|\d{1,3}\s*%)\s*$/.test(own) && small) add('C3 counter or timecode', t, el, 'a small number that reads as interface chrome');
          } else if (r.width > 0.3 * W && r.height < 0.012 * H && (r.top < 0.12 * H || r.bottom > 0.88 * H) && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') add('P1 progress bar', t, el, 'a thin full-width bar at an edge');
        }
      }
      return hits;
    }, { n, dur: meta.dur });
    const rules = Object.keys(found);
    gate('G5', rules.length === 0, { samples: n, findings: found, reason: rules.length ? `page chrome: ${rules.join('; ')}` : undefined });
    out.notes.push('G5 reads the DOM only: text drawn on a canvas, in WebGL, in images or video is invisible to it.');
  } finally { await browser.close(); }
}

const video = arg('--video'), page = arg('--page');
if (!video && !page) { console.error('usage: node film-gates.mjs --video file.mp4 [--expect S] [--audio] | --page film.html [--samples N]'); process.exit(2); }
if (video) videoGates(video);
if (page) await pageGates(page);
const failed = Object.entries(out.gates).filter(([, g]) => !g.pass);
for (const [id, g] of Object.entries(out.gates)) console.log(`GATE ${id}: ${g.pass ? 'PASS' : 'FAIL'}${g.reason ? ` (${g.reason})` : ''}`);
for (const n of out.notes) console.log(`note: ${n}`);
if (typeof arg('--json') === 'string') fs.writeFileSync(arg('--json'), JSON.stringify(out, null, 2) + '\n');
process.exit(failed.length ? 1 : 0);
