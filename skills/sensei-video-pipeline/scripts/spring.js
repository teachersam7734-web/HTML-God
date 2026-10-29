/* spring.js: closed-form damped springs as pure functions of time, and "sum of springs" retargeting, so a value that
 * changes target many times is still a pure function of t (position AND velocity stay continuous at each retarget).
 *
 *   step(t, k, c)            unit step response of a unit-mass spring (stiffness k, damping c), 0 before t = 0
 *   track(t, x0, changes, k, c)   changes = [[tChange, from, to], ...]: one spring per change, summed
 *
 * verified: `node test-spring.mjs` (step(0)=0, step(1 s)=1.0000 for k 220 c 22, overshoot 3.1% at zeta 0.74, exact
 *           critically damped and overdamped forms, track continuous at retargets and exact at rest) on Node 24;
 *           used by examples/seek-page.html in headless Chrome.
 * not verified: nothing engine-specific is used (plain Math).
 * Original HTML-Sensei code; the sum-of-springs idea is described in the awesome-ai-motion prompt corpus.
 */
(function (root, factory) {
  const s = factory();
  if (typeof module === 'object' && module.exports) module.exports = s; else root.SenseiSpring = s;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function step(t, k = 220, c = 22) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k), z = c / (2 * w0);
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); }
    if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const r = w0 * Math.sqrt(z * z - 1), s1 = -z * w0 + r, s2 = -z * w0 - r;   // two real roots
    return 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2);
  }
  const track = (t, x0, changes, k, c) => changes.reduce((v, [ti, from, to]) => v + (to - from) * step(t - ti, k, c), x0);
  const zeta = (k, c) => c / (2 * Math.sqrt(k));
  return { step, track, zeta };
});
