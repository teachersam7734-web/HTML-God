/* motion-kit.js: the motion-graphics clock toolkit for seek-safe films (every value a pure function of t).
 *
 * verified: `node test-motion-kit.mjs` (every ease f(0)=0 and f(1)=1, overshoot peaks 1.18 / 1.08 / 1.48 at the
 *           reported times, kf hard steps, seeded rng repeatable, shake zero before the hit, cv and reading time),
 *           and loaded as a classic script by examples/sting.html in headless Chrome (Windows, system Chrome).
 * not verified: Safari and Firefox (plain ES2017 maths, nothing engine-specific is used).
 *
 * Works three ways: a classic <script> (sets window.SenseiMotion), require() in Node, or inlined in a single file.
 *
 * The twelve EASE curves and EASE_FRAMES are copied from motionmaxxing, runtime/motion.js
 * (https://github.com/Tejashmakwana/motionmaxxing), Copyright Tejas Makwana, licensed under the Apache License,
 * Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). The curves were fitted by that project to about 4,300
 * moves in 53 professional films. Modified for HTML-Sensei: wrapped in a UMD module, renamed helpers, and the
 * other functions in this file added (they are original HTML-Sensei code).
 */
(function (root, factory) {
  const kit = factory();
  if (typeof module === 'object' && module.exports) module.exports = kit;
  else root.SenseiMotion = kit;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---- measured eases (Apache-2.0, motionmaxxing): every f(0)=0 and f(1)=1 ---- */
  const powerOut = p => t => 1 - Math.pow(1 - t, p);
  const powerIn = p => t => Math.pow(t, p);
  const expoOut = k => { const d = 1 - Math.exp(-k); return t => (1 - Math.exp(-k * t)) / d; };
  const snapRamp = (w, tau) => { const n = w * (1 - Math.exp(-1 / tau)) + (1 - w); return t => (w * (1 - Math.exp(-t / tau)) + (1 - w) * t) / n; };
  const snapOver = (A, ta, td) => { const f = t => (1 + A * Math.exp(-t / td)) * (1 - Math.exp(-t / ta)); const n = f(1); return t => f(t) / n; };
  const springE = (c, om) => { const f = t => 1 - Math.exp(-c * t) * (Math.cos(om * t) + (c / om) * Math.sin(om * t)); const n = f(1); return t => f(t) / n; };
  const smoothP = p => t => { const a = Math.pow(t, p), b = Math.pow(1 - t, p); return a / (a + b); };
  const guard = f => t => (t <= 0 ? 0 : t >= 1 ? 1 : f(t));
  const EASE = {
    crashIn: guard(snapOver(2.0, 0.19, 0.218)),   // slam: passes the mark at once, peak 1.18 near t 0.27
    popOver: guard(springE(2.67, 4.36)),          // late small lean past the mark, peak 1.08 near t 0.72
    bounceHard: guard(springE(1.34, 5.07)),       // the big overshoot, peak 1.48; once per film at most
    snapSettle: guard(snapRamp(0.942, 0.118)),    // hero entry: about half the travel in the first tenth
    softLand: guard(expoOut(3.41)),               // the workhorse landing for words and panels
    whip: guard(powerOut(2.52)),                  // big fast decelerating move
    glide: guard(powerOut(1.7)),                  // gentle medium landing, camera pushes
    cruise: guard(t => t),                        // linear: fades, drifts, counters
    softInOut: guard(smoothP(1.42)),              // symmetric S for opacity, blur, colour ramps
    gentleIn: guard(powerIn(2.07)),               // mild acceleration: fade-out and blur-out starts
    accelExit: guard(powerIn(2.6)),               // the leaving curve, peak speed at the end
    crashOut: guard(powerIn(3.97)),               // hard acceleration into a cut
  };
  // median duration in frames at 30 fps for each curve (double them at 60 fps)
  const EASE_FRAMES = { crashIn: 10, popOver: 15, bounceHard: 22, snapSettle: 11, softLand: 12, whip: 7, glide: 10, cruise: 9, softInOut: 9, gentleIn: 9, accelExit: 13, crashOut: 17 };

  /* ---- original HTML-Sensei helpers ---- */
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, t0, t1) => (t1 <= t0 ? (t >= t1 ? 1 : 0) : clamp((t - t0) / (t1 - t0)));   // 0..1 progress through [t0,t1]
  const ease = e => (typeof e === 'function' ? e : EASE[e] || EASE.cruise);

  // Keyframes: keys = [[time, value, easeOfTheSegmentEndingHere], ...] sorted by time. A repeated time is a hard step
  // (the later value wins from that instant). Before the first key: the first value; after the last: the last value.
  function kf(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i], [t0, v0] = keys[i - 1];
      if (t < t1) return t1 === t0 ? v1 : lerp(v0, v1, ease(e)(seg(t, t0, t1)));
    }
    return keys[keys.length - 1][1];
  }

  // Seeded randomness. hash: FNV-1a of a string or number; rng: mulberry32 (a public-domain generator).
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = seed => { let a = (typeof seed === 'string' ? hash(seed) : seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
  const rand = (key, i = 0) => rng(hash(key) ^ Math.imul(i + 1, 0x9E3779B1))();   // one stable number per (key, index)

  // Camera zoom keyed in log space, so a push from 1x to 20x reads as constant speed.
  const zoomAt = (z0, z1, k) => Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * k);
  // A decaying deterministic shake: zero before tHit, rings down after it. Returns [dx, dy].
  function shake(t, tHit, { amp = 12, decay = 9, freq = 31, seed = 'shake' } = {}) {
    if (t < tHit) return [0, 0];
    const d = t - tHit, e = amp * Math.exp(-decay * d), p = rand(seed) * 6.283;
    return [e * Math.sin(freq * d + p), e * Math.sin(freq * 1.31 * d + p * 1.7)];
  }
  // The "hand": a slow two-sine float, multiplied by an envelope you key to zero in holds.
  const hand = (t, amp = 3, env = 1) => [env * amp * (Math.sin(t * 0.9) + 0.5 * Math.sin(t * 2.3 + 1)), env * amp * (Math.sin(t * 0.7 + 2) + 0.5 * Math.sin(t * 1.9))];
  // Directional smear on a fast move: peak on the move's first frame, halving each frame after it.
  const smear = (framesSinceStart, peakPx) => (framesSinceStart < 0 ? 0 : peakPx * Math.pow(0.5, framesSinceStart));

  // Rhythm and reading checks (thresholds from the research; starting points, not laws).
  const cv = a => { const m = a.reduce((s, x) => s + x, 0) / a.length; return m ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) / m : 0; };
  // seconds a text must stay fully on screen: characters / 15 + 1.5 s (Latin script); characters / 4.5 + 1.5 s for Chinese
  const readTime = (text, { cjk = /[㐀-鿿]/.test(text) } = {}) => [...String(text)].length / (cjk ? 4.5 : 15) + 1.5;

  return { EASE, EASE_FRAMES, clamp, lerp, seg, ease, kf, hash, rng, rand, zoomAt, shake, hand, smear, cv, readTime };
});
