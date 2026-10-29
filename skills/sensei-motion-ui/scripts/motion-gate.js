/* motion-gate.js: one reduced-motion switch for every animation system on a page (CSS classes, WAAPI, vanilla Motion,
 * GSAP), live when the user changes the setting. Classic script; defines window.SenseiMotionGate.
 * HTML-Sensei's own code.
 *
 *   const G = SenseiMotionGate;
 *   G.reduce                         true when the user asked for reduced motion (kept current)
 *   G.on(fn)                         fn(reduce) now and on every change; returns an unsubscribe function
 *   G.animate(el, keyframes, opts)   WAAPI that, under reduce, jumps to the last keyframe (or plays a short fade when
 *                                    opts.reducedFade is set) instead of moving
 *   G.motion(animateFn)              wraps vanilla Motion's animate(): under reduce, duration 0 and no spring
 *                                    (Motion's vanilla API ignores the setting on its own: tested)
 *   G.gsap(gsap, full, reduced)      gsap.matchMedia() with the two branches; returns the MatchMedia object
 *
 * The CSS side stays CSS: @media (prefers-reduced-motion: reduce) { ... } in the stylesheet. This file also sets
 * <html data-motion="reduce|full"> so CSS can key off one attribute when a page offers its own motion switch.
 *
 * verified: Chrome 156 headless (test-motion-ui.mjs): reduce emulated per context; G.animate lands on the final
 *           frame at once under reduce; G.motion makes a 1 s Motion 14.6.0 animation finish in about one frame while
 *           the unwrapped call still took about a second; the GSAP branch sets end states; a live change of the
 *           emulated setting reaches on() subscribers.
 * not verified: Firefox and Safari; GSAP versions other than 3.15.0; Motion versions other than 14.6.0.
 */
(function (root) {
  'use strict';
  const mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
  const subs = new Set();
  const G = {
    reduce: mq.matches,
    on(fn) { subs.add(fn); fn(G.reduce); return () => subs.delete(fn); },
    animate(el, keyframes, opts) {
      opts = Object.assign({}, typeof opts === 'number' ? { duration: opts } : opts);
      if (!G.reduce) return el.animate(keyframes, opts);
      const list = Array.isArray(keyframes) ? keyframes : null;
      const last = list ? Object.assign({}, list[list.length - 1]) : Object.fromEntries(Object.entries(keyframes).map(([k, v]) => [k, Array.isArray(v) ? v[v.length - 1] : v]));
      delete last.offset; delete last.easing;
      if (opts.reducedFade && !('opacity' in last)) {
        return el.animate([{ opacity: 0 }, Object.assign({ opacity: 1 }, last)], { duration: 150, fill: opts.fill || 'both', easing: 'linear' });
      }
      return el.animate([last, last], { duration: 1, fill: opts.fill || 'both' });
    },
    motion(animateFn) {
      return function (target, keyframes, opts) {
        if (!G.reduce) return animateFn(target, keyframes, opts);
        const o = Object.assign({}, opts, { duration: 0, delay: 0, type: 'tween', repeat: 0 });
        delete o.stiffness; delete o.damping; delete o.bounce; delete o.visualDuration;
        return animateFn(target, keyframes, o);
      };
    },
    gsap(gsap, full, reduced) {
      const mm = gsap.matchMedia();
      mm.add({ full: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, ctx => {
        return ctx.conditions.reduce ? (reduced && reduced(ctx)) : (full && full(ctx));
      });
      return mm;
    },
  };
  const mark = () => { if (root.document) root.document.documentElement.dataset.motion = G.reduce ? 'reduce' : 'full'; };
  mark();
  mq.addEventListener('change', e => { G.reduce = e.matches; mark(); subs.forEach(fn => { try { fn(G.reduce); } catch (err) { console.error(err); } }); });
  root.SenseiMotionGate = G;
})(typeof window !== 'undefined' ? window : globalThis);
