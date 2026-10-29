/* handmade-kit.js: helpers for hand-drawn and painted 2D animation on a canvas, every one a pure function of t.
 * Classic <script> (sets window.Handmade) or require() in Node for tests.
 *
 *   boil and exposure: hash, rng, jit, boilFrame, onTwos, exposure
 *   timing: seg, kf, ease (out, in, inOut, back, elastic), pulse (beat), ring (decaying settle)
 *   acting: squash (volume kept), arc, mood (expression changes with anticipation, take and overshoot)
 *   drawing: paper (texture drawn once), inkLine (tapered, boiling stroke), wash (soft-edged fill), blob (closed
 *            boiling shape), iris, brushWipe
 *
 * verified: `node test-handmade.mjs` (kit unit checks in Node 24) and examples/hop.html in headless Chrome 155 on
 *           Windows 10: identical frames in and out of order, held drawings identical within a boil step.
 * not verified: Safari and Firefox canvas output (anti-aliasing differs between engines, so pixels will not match
 *           across browsers; within one browser they do).
 * Original HTML-Sensei code. The ideas (boil reseeded 12 times a second, stable named seeds, drawings on twos with the
 * camera on ones, mood changes through a take) come from ClaudeAnimationBase and claude-animation-skill (both MIT)
 * and PDoomVideo (no licence, idea only); no code was copied.
 */
(function (root, factory) {
  const k = factory();
  if (typeof module === 'object' && module.exports) module.exports = k; else root.Handmade = k;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---- seeded randomness ---- */
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = seed => { let a = (typeof seed === 'string' ? hash(seed) : seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
  const unit = (key, i) => rng(hash(key) ^ Math.imul((i | 0) + 1, 0x9E3779B1))();          // one stable number in 0..1

  /* ---- boil and exposure ---- */
  // the boil step: linework is redrawn with new jitter `rate` times a second (12 reads as hand-drawn at 24 fps)
  const boilFrame = (t, rate = 12) => Math.floor(t * rate + 1e-9);
  // a stable jitter in -1..1 for (element key, point index), changing only at boil steps; rate 0 freezes it
  const jit = (key, i, t, rate = 12) => 2 * unit(key + '|' + (rate ? boilFrame(t, rate) : 0), i) - 1;
  // drawings on twos: hold each pose for `on` frames at `fps` (the camera stays on ones)
  const onTwos = (t, fps = 24, on = 2) => Math.floor(t * fps / on + 1e-9) * on / fps;
  // exposure sheet: [{ at, on }] switch the hold length over time, e.g. ones for a fast action, twos elsewhere
  const exposure = (t, sheet, fps = 24) => { let on = 1; for (const s of sheet) if (t >= s.at) on = s.on; return onTwos(t, fps, on); };

  /* ---- timing ---- */
  const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
  const ease = {
    out: k => 1 - Math.pow(1 - k, 3), in: k => k * k * k,
    inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    back: (k, s = 1.9) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),       // overshoot, s about 1.8 to 2.2
    elastic: k => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * TAU / 3) + 1),
  };
  const kf = (t, keys, e = ease.inOut) => {                  // keys: [[t, value], ...]
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], (keys[i][2] || e)(seg(t, keys[i - 1][0], keys[i][0])));
    return keys[keys.length - 1][1];
  };
  // 1 on each beat, decaying after it (bpm, first beat at t0)
  const pulse = (t, bpm = 96, t0 = 0, decay = 6) => { if (t < t0) return 0; const p = 60 / bpm, d = (t - t0) % p; return Math.exp(-decay * d); };
  // a settle that rings down after tHit: amplitude amp, frequency hz, decay per second
  const ring = (t, tHit, amp = 1, hz = 3, decay = 6) => (t < tHit ? 0 : amp * Math.exp(-decay * (t - tHit)) * Math.cos(TAU * hz * (t - tHit)));

  /* ---- acting ---- */
  // squash and stretch keeping area: s > 1 stretches vertically and thins
  const squash = s => ({ x: 1 / Math.sqrt(s), y: Math.sqrt(s) });
  const arc = (k, x0, y0, x1, y1, h) => ({ x: lerp(x0, x1, k), y: lerp(y0, y1, k) - 4 * h * k * (1 - k) });
  // expression changes never snap: eyes squint shut, the body does a take (squash then overshoot), new face opens
  // keys: [[t, 'face'], ...]; returns { face, prev, squint 0..1, take (body scale), k (progress of the change) }
  function mood(t, keys, dur = 0.35) {
    let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
    const [t0, face] = keys[i], prev = i ? keys[i - 1][1] : face, k = i ? seg(t, t0, t0 + dur) : 1;
    const squint = k < 1 ? Math.sin(Math.PI * Math.min(1, k * 1.6)) : 0;                 // closes, then opens
    const take = k < 1 ? 1 - 0.12 * Math.sin(Math.PI * Math.min(1, k * 2)) + 0.06 * Math.sin(Math.PI * clamp(k * 2 - 1)) : 1;
    return { face: k < 0.45 ? prev : face, prev, squint, take, k };
  }

  /* ---- drawing ---- */
  // paper: blotches and fibres drawn once into an offscreen canvas from a seed, then multiplied over the frame
  function paper(doc, w, h, { seed = 'paper', base = '#f3ebdc', blotches = 70, fibres = 1400 } = {}) {
    const c = doc.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < blotches; i++) {
      const x = r() * w, y = r() * h, rad = 40 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(120,95,60,${0.03 + r() * 0.04})`); gr.addColorStop(1, 'rgba(120,95,60,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < fibres; i++) {
      const x = r() * w, y = r() * h, a = r() * TAU, l = 4 + r() * 14;
      g.strokeStyle = `rgba(90,70,40,${0.04 + r() * 0.06})`; g.lineWidth = 0.4 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.4) * l / 2, y + Math.sin(a + 0.4) * l / 2, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(60,40,20,0)'); v.addColorStop(1, 'rgba(60,40,20,0.16)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    return c;
  }
  // points boiled around their rest position; `key` names the element so moving one never re-randomises the others
  const boilPts = (pts, key, t, amp = 1.6, rate = 12) => pts.map(([x, y], i) => [x + amp * jit(key, 2 * i, t, rate), y + amp * jit(key, 2 * i + 1, t, rate)]);
  // a tapered ink stroke through points: filled polygon whose width swells in the middle and thins at the ends
  function inkLine(g, pts, { key = 'ink', t = 0, w = 4, color = '#2b2233', boil = 1.4, rate = 12 } = {}) {
    const p = boilPts(pts, key, t, boil, rate), n = p.length; if (n < 2) return;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const k = i / (n - 1), width = w * (0.35 + 0.65 * Math.sin(Math.PI * k)) * (0.85 + 0.3 * unit(key + 'w', i));
      L.push([p[i][0] - dy / d * width / 2, p[i][1] + dx / d * width / 2]); R.push([p[i][0] + dy / d * width / 2, p[i][1] - dx / d * width / 2]);
    }
    g.fillStyle = color; g.beginPath(); g.moveTo(L[0][0], L[0][1]);
    for (const q of L.slice(1)) g.lineTo(q[0], q[1]);
    for (const q of R.reverse()) g.lineTo(q[0], q[1]);
    g.closePath(); g.fill();
  }
  // points around an ellipse, for blobs and bodies
  const ellipse = (cx, cy, rx, ry, n = 28, rot = 0) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });
  // a soft wash: three jittered translucent passes, like pigment pooling at the edge
  function wash(g, pts, { key = 'wash', t = 0, color = '#d97757', alpha = 0.32, boil = 2.2, rate = 12 } = {}) {
    g.save(); g.fillStyle = color; g.globalAlpha = alpha;
    for (let pass = 0; pass < 3; pass++) {
      const p = boilPts(pts, `${key}#${pass}`, t, boil * (1 + pass * 0.5), rate);
      g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (const q of p.slice(1)) g.lineTo(q[0], q[1]); g.closePath(); g.fill();
    }
    g.restore();
  }
  // a closed outline in ink (the ring of the shape, boiled)
  const blob = (g, pts, o = {}) => inkLine(g, [...pts, pts[0]], o);
  // iris: everything outside a circle is covered with `color`; r grows to open
  function iris(g, w, h, x, y, r, color = '#2b2233') {
    g.save(); g.fillStyle = color; g.beginPath(); g.rect(0, 0, w, h); g.arc(x, y, Math.max(0, r), 0, TAU, true); g.fill('evenodd'); g.restore();
  }
  // brush wipe: k 0..1 covers the frame with a ragged painted edge travelling left to right
  function brushWipe(g, w, h, k, { color = '#2b2233', key = 'wipe', bands = 9 } = {}) {
    if (k <= 0) return; g.save(); g.fillStyle = color;
    for (let b = 0; b < bands; b++) {
      const y0 = b * h / bands, y1 = (b + 1) * h / bands + 2, lag = 0.25 * unit(key, b), kk = clamp((k - lag) / (1 - lag));   // every band finishes exactly at k = 1: no early flat frames
      const x = kk * (w + 160) - 80 + 30 * (unit(key + 'e', b) - 0.5);
      g.beginPath(); g.moveTo(-10, y0); g.lineTo(x, y0); g.quadraticCurveTo(x + 40, (y0 + y1) / 2, x, y1); g.lineTo(-10, y1); g.closePath(); g.fill();
    }
    g.restore();
  }
  return { TAU, clamp, lerp, hash, rng, unit, boilFrame, jit, onTwos, exposure, seg, ease, kf, pulse, ring, squash, arc, mood, paper, boilPts, inkLine, ellipse, wash, blob, iris, brushWipe };
});
