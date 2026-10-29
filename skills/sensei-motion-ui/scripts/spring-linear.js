/* spring-linear.js: turn a damped spring into a CSS linear() easing, so CSS transitions, @keyframes and WAAPI get a
 * real spring (overshoot and settle) with no animation library and no script running per frame.
 * HTML-Sensei's own code (the generator idea and the first version came from the interaction research lane's
 * micro.html; rewritten for the plugin with exact over-damped maths and shape-preserving point reduction).
 *
 *   springLinear({ stiffness = 170, damping = 14, mass = 1, tolerance = 0.002, settle = 0.002 })
 *     -> { css: 'linear(0, 0.21 4.3%, ...)', duration: ms to settle, peak: highest value, stops: n, zeta }
 *   springLinear.apply(el, prop, opts)  sets el.style[--prop] to the css and --prop-ms to the duration (in a page)
 *
 * Use the returned duration as the transition or animation duration: a shorter one cuts the tail off.
 * Always write a plain easing first in CSS, then the linear() one: an engine without linear() drops the invalid
 * declaration and keeps the plain one.
 *
 * verified: Node 24 (test-motion-ui.mjs: step response matches the closed form within the tolerance, stiffness 260,
 *           damping 16 (zeta 0.50) peaks at 1.166 and settles in 812 ms with 36 stops, max error 0.0022; critically and over-damped settle
 *           with no overshoot); Chrome 156 headless (CSS.supports accepts the output; a transition driven by it
 *           overshoots and settles at its target, sampled per frame).
 * not verified: Firefox and Safari acceptance of long linear() strings (they ship linear(); not run here).
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.springLinear = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Unit step response of a damped spring with mass m: x(0) = 0, x(inf) = 1.
  function step(t, k, c, m) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); }
    if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const r = w0 * Math.sqrt(z * z - 1), s1 = -z * w0 + r, s2 = -z * w0 - r;
    return 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2);
  }

  // Keep only the points needed to stay within tol of the sampled curve (Ramer-Douglas-Peucker on (t, x)).
  function reduce(pts, tol) {
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let worst = -1, wi = -1;
      for (let i = a + 1; i < b; i++) {
        const f = (pts[i][0] - pts[a][0]) / (pts[b][0] - pts[a][0]);
        const d = Math.abs(pts[i][1] - (pts[a][1] + f * (pts[b][1] - pts[a][1])));
        if (d > worst) { worst = d; wi = i; }
      }
      if (worst > tol) { keep[wi] = 1; stack.push([a, wi], [wi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  function springLinear(o) {
    o = o || {};
    const k = o.stiffness ?? 170, c = o.damping ?? 14, m = o.mass ?? 1, tol = o.tolerance ?? 0.002, eps = o.settle ?? 0.002;
    const dt = 1 / 240, pts = [];
    let t = 0, calm = 0, peak = 0;
    // Settled when |x - 1| stays under eps for 50 ms of samples.
    for (; t < 10; t += dt) {
      const x = step(t, k, c, m); pts.push([t, x]); if (x > peak) peak = x;
      if (Math.abs(x - 1) < eps) { if (++calm > 12) break; } else calm = 0;
    }
    const T = pts[pts.length - 1][0];
    pts[pts.length - 1][1] = 1;
    const kept = reduce(pts, tol);
    const r = n => +n.toFixed(4);
    const stops = kept.map(([ti, x], i) => (i === 0 ? '0' : i === kept.length - 1 ? '1' : `${r(x)} ${r((ti / T) * 100)}%`));
    return { css: `linear(${stops.join(', ')})`, duration: Math.round(T * 1000), peak: r(peak), stops: kept.length, zeta: r(c / (2 * Math.sqrt(k * m))) };
  }
  springLinear.step = step;
  springLinear.apply = function (el, prop, opts) {
    const s = springLinear(opts); el.style.setProperty('--' + prop, s.css); el.style.setProperty('--' + prop + '-ms', s.duration + 'ms'); return s;
  };
  return springLinear;
});
