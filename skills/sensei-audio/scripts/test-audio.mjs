// test-audio.mjs: the self-test of sensei-audio. Headless Chromium through Playwright (pw.mjs discovers it).
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-audio/scripts/test-audio.mjs
//
// 1. engine, offline: every sound starts and ends at zero, no sample jump above 0.2, reported end covers the tail;
//    mute silent; volume 0.25 gives a quarter of the RMS; pan -1 left only; same seed same samples; reduced motion
//    drops the whoosh and keeps the chime; HRTF left and right balance
// 2. room, offline: impulse -60 dB (within 3) at T60; same seed same impulse; materials start and end at zero, peak at
//    or under -8 dBFS (with 0.5 dB allowance), more tail energy far than near; airFromCurve louder in the middle
// 3. engine, live: scheduler exact with no late step; atHeard fires after its target; caption and flash
// 4. examples/sfx-ui.html: muted first visit, keyboard toggle persists over reload, captions, volume, reduced motion,
//    no network, no console errors
// 5. examples/heartbeat.html: one animation per beat, start times on the mapped audio clock, tempo change, reduced
//    motion uses no scale animation, stop
// Note: automated Chromium carries user activation from navigation, so the autoplay-suspended state cannot be
// reproduced here; the unlock path is exercised only in the sense that it does not break a running context.
// verified: Windows 10, Node 24, Playwright 1.63, Chrome 155: every check passes (numbers in SKILL.md).
// not verified: anything audible; Safari, Firefox, phones.
// Original code of this project.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.resolve(HERE, '../examples');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const j = o => JSON.stringify(o);

const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(fileUrl(path.join(HERE, 'tests', 'engine.html')));

  // 1
  const off = await p.evaluate(() => runOffline());
  const snd = Object.entries(off.sounds);
  check('engine: every sound starts and ends at zero', snd.every(([, s]) => s.first === 0 && s.tail === 0), snd.filter(([, s]) => s.first || s.tail).map(([n]) => n).join(','));
  console.log(`INFO  largest sample-to-sample step: ${Math.max(...snd.map(([, s]) => s.maxJump))} (the square-wave click jumps by design; clicks at the edges are what the zero-start and zero-end check catches)`);
  check('engine: reported end covers the audible tail', snd.every(([, s]) => s.reportedEnd + 0.05 >= s.lastAudibleS), snd.filter(([, s]) => s.reportedEnd + 0.05 < s.lastAudibleS).map(([n, s]) => `${n} ${s.reportedEnd}<${s.lastAudibleS}`).join(','));
  check('engine: peaks under 1 (no clipping)', snd.every(([, s]) => s.peak < 1), 'max peak ' + Math.max(...snd.map(([, s]) => s.peak)));
  check('engine: mute is silent', off.mutedPeak === 0);
  check('engine: volume 0.25 gives a quarter of the RMS', Math.abs(off.rms025 / off.rms1 - 0.25) < 0.01, `${off.rms025} / ${off.rms1}`);
  check('engine: pan -1 is left only', off.panLeft.L > 0 && off.panLeft.R === 0, j(off.panLeft));
  check('engine: same seed renders the same samples, another seed differs', off.seedSame && off.seedDiffers);
  check('engine: reduced motion drops the whoosh, keeps the chime', off.calmWhoosh === 0 && off.calmChime && off.calmPeak > 0);
  check('engine: HRTF left/right balance', off.hrtf.left[0] > off.hrtf.left[1] * 2 && off.hrtf.right[1] > off.hrtf.right[0] * 2, j(off.hrtf));

  // 2
  const room = await p.evaluate(() => runRoom());
  check('room: impulse falls 60 dB (within 3) at T60', Math.abs(room.decayDb + 60) <= 3, `${room.decayDb} dB`);
  check('room: same seed, same impulse', room.irSameSeed);
  const mats = Object.entries(room.materials);
  const ceil = room.ceiling * Math.pow(10, 0.5 / 20);
  check('room: materials start and end at zero', mats.every(([, m]) => m.near.first === 0 && m.far.first === 0 && m.near.lastAudibleS < 2.4 && m.far.lastAudibleS < 2.4), mats.map(([n, m]) => `${n} ${m.near.lastAudibleS}/${m.far.lastAudibleS}`).join(' '));
  check('room: every peak at or under -8 dBFS (+0.5 dB)', mats.every(([, m]) => m.near.peak <= ceil && m.far.peak <= ceil), mats.map(([n, m]) => `${n} ${m.near.peak}/${m.far.peak}`).join(' '));
  check('room: a larger share of room tail far than near', mats.every(([, m]) => m.far.tailShare > m.near.tailShare), mats.map(([n, m]) => `${n} ${m.near.tailShare}<${m.far.tailShare}`).join(' '));
  check('room: airFromCurve follows its curve', room.curve.middle > room.curve.edge * 20 && room.curve.first === 0, j(room.curve));

  // 3
  const live = await p.evaluate(() => runLive());
  if (live.state !== 'running') check('live: context running', false, live.state);
  else {
    check('live: scheduler exact, no late step', Math.abs(live.sched.minDiff - live.sched.expected) < 1e-9 && Math.abs(live.sched.maxDiff - live.sched.expected) < 1e-9 && live.sched.late === 0, j(live.sched));
    check('live: atHeard fires after its 300 ms target', live.atHeardMs >= 290 && live.atHeardMs < 600, live.atHeardMs + ' ms (outputLatency ' + live.outputLatency + ')');
    check('live: caption and flash fire with the sound', live.flashed && live.caption === 'Correct answer');
  }
  check('engine page: no page errors', !errors.length, errors.join(' | '));
  await ctx.close();

  // 4
  {
    const c = await browser.newContext(); const q = await c.newPage(); const net = [], errs = [];
    q.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
    q.on('pageerror', e => errs.push(e.message)); q.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const u = fileUrl(path.join(EX, 'sfx-ui.html'));
    await q.goto(u);
    const first = await q.evaluate(() => [document.getElementById('sound').textContent, window.__sfx.state.muted]);
    check('sfx-ui: muted on first visit', first[0] === 'Sound off' && first[1] === true, j(first));
    await q.focus('#sound'); await q.keyboard.press('Enter');
    const on = await q.evaluate(() => [document.getElementById('sound').getAttribute('aria-pressed'), window.__sfx.state.muted]);
    await q.reload();
    const after = await q.evaluate(() => [document.getElementById('sound').textContent, window.__sfx.state.muted]);
    check('sfx-ui: keyboard toggle, remembered over reload', on[0] === 'true' && on[1] === false && after[0] === 'Sound on' && after[1] === false, j({ on, after }));
    await q.click('[data-sfx="success"]'); await q.waitForTimeout(150);
    const cap = await q.evaluate(() => [document.getElementById('status').textContent, window.__lastPlay.result > 0]);
    check('sfx-ui: caption in the live region, sound played', cap[0] === 'Correct answer' && cap[1], j(cap));
    await q.fill('#vol', '0.3'); await q.dispatchEvent('#vol', 'input');
    check('sfx-ui: volume slider sets the engine', Math.abs((await q.evaluate(() => window.__sfx.state.volume)) - 0.3) < 1e-9);
    await q.click('[data-sfx="room-glass"]'); await q.waitForTimeout(100);
    check('sfx-ui: room chime plays through the engine', await q.evaluate(() => window.__lastPlay.result > 0));
    await c.close();
    const r = await browser.newContext({ reducedMotion: 'reduce' }); const rq = await r.newPage();
    await rq.goto(u); await rq.click('#sound');
    await rq.click('[data-sfx="whoosh"]'); const w = await rq.evaluate(() => window.__lastPlay.result);
    await rq.click('[data-sfx="success"]'); const s = await rq.evaluate(() => window.__lastPlay.result); await rq.waitForTimeout(120);
    const capR = await rq.evaluate(() => document.getElementById('status').textContent);
    check('sfx-ui: reduced motion drops the whoosh, keeps the chime and captions', w === 0 && s > 0 && capR.length > 0, j({ w, s, capR }));
    await r.close();
    check('sfx-ui: no network, no console errors', !net.length && !errs.length, [...net, ...errs].join(' | '));
  }

  // 5
  {
    const c = await browser.newContext(); const q = await c.newPage(); const errs = [];
    q.on('pageerror', e => errs.push(e.message));
    await q.goto(fileUrl(path.join(EX, 'heartbeat.html')) + '?qa');
    await q.click('#go'); await q.waitForTimeout(3500);
    const r = await q.evaluate(() => {
      const hb = window.__heartbeat, beats = window.__beats.slice();
      const heard = beats.filter(b => b.heardAt != null), err = heard.map(b => b.startTime - b.heardAt);
      const gaps = beats.slice(1).map((b, i) => b.audioT - beats[i].audioT);
      return { audio: hb.audio, n: beats.length, measured: heard.length, errMs: err.map(e => +e.toFixed(1)), maxAbsErrMs: +Math.max(...err.map(Math.abs)).toFixed(1), gapMin: Math.min(...gaps), gapMax: Math.max(...gaps), kinds: [...new Set(beats.map(b => b.kind))],
        anims: document.getElementById('heart').getAnimations().length + beats.filter(b => b.startTime < performance.now() - 600).length };
    });
    check('heartbeat: beats scheduled on the audio clock', r.audio && r.n >= 3 && Math.abs(r.gapMin - 60 / 72) < 1e-9 && Math.abs(r.gapMax - 60 / 72) < 1e-9, j(r));
    check('heartbeat: pulse starts within one frame (20 ms) of the beat being heard', r.measured >= 3 && r.maxAbsErrMs <= 20, j(r.errMs));
    await q.fill('#bpm', '120'); await q.dispatchEvent('#bpm', 'input'); await q.waitForTimeout(2200);
    const t = await q.evaluate(() => { const b = window.__beats.slice(-3); return b.slice(1).map((x, i) => +(x.audioT - b[i].audioT).toFixed(9)); });
    check('heartbeat: tempo change keeps exact spacing at the new tempo', t.every(g => Math.abs(g - 0.5) < 1e-6), j(t));
    await q.click('#go'); const n0 = await q.evaluate(() => window.__beats.length); await q.waitForTimeout(800);
    const n1 = await q.evaluate(() => [window.__beats.length, window.__heartbeat.running]);
    check('heartbeat: Stop stops the scheduler', n1[0] === n0 && n1[1] === false, j({ n0, n1 }));
    await c.close();
    const rc = await browser.newContext({ reducedMotion: 'reduce' }); const rq = await rc.newPage();
    await rq.goto(fileUrl(path.join(EX, 'heartbeat.html'))); await rq.click('#go'); await rq.waitForTimeout(1500);
    const rk = await rq.evaluate(() => [...new Set(window.__beats.map(b => b.kind))]);
    check('heartbeat: reduced motion uses no scale pulse', rk.length === 1 && rk[0] === 'dot', j(rk));
    await rc.close();
    check('heartbeat: no page errors', !errs.length, errs.join(' | '));
  }
} finally { await browser.close(); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
