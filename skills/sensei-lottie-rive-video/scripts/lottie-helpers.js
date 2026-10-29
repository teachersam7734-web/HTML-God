/* lottie-helpers.js: small, dependency-free helpers around lottie-web. CC0 (original code of this project).
 *
 *   LottieHelpers.mount(lottie, el, data, { renderer, loop, autoplay, posterFrame })  -> animation
 *       clones the data (lottie-web mutates what it is given); under prefers-reduced-motion: reduce it does not
 *       autoplay and holds posterFrame; pauses when off screen or when the tab is hidden; anim.__teardown() destroys
 *       it and removes the observers.
 *   LottieHelpers.recolor(json, [r,g,b], [r,g,b], tol)   static and keyframed RGBA colours within tol (0..1 floats)
 *   LottieHelpers.scrub(anim, el, fromFrame, toFrame)     scroll progress of el through the viewport -> frame; returns
 *                                                         a function that removes the listener
 *
 * verified: Windows 10, Chrome 155 headless, lottie-web 5.13.0 (all five builds): mount, recolor, poster frame under
 *           reduced motion, pause when hidden (test-lottie.mjs).
 * not verified: scrub() by a test (the code path is used in examples only); Safari and Firefox.
 * Adapted from code-media/lottie/lottie-helpers.js in the HTML-Sensei build project's research notes (not shipped) (original, CC0); the hidden-tab pause and
 * __teardown are new here.
 */
(function (root) {
  function recolor(json, from, to, tol) {
    tol = tol == null ? 0.02 : tol;
    (function walk(o) {
      if (Array.isArray(o)) {
        if (o.length === 4 && o.every(function (n) { return typeof n === 'number'; }) &&
            Math.abs(o[0] - from[0]) < tol && Math.abs(o[1] - from[1]) < tol && Math.abs(o[2] - from[2]) < tol) {
          o[0] = to[0]; o[1] = to[1]; o[2] = to[2]; return;
        }
        o.forEach(walk);
      } else if (o && typeof o === 'object') {
        Object.keys(o).forEach(function (k) { walk(o[k]); });
      }
    })(json);
    return json;
  }

  function mount(lottie, el, data, o) {
    o = o || {};
    var rm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)');
    var still = !!(rm && rm.matches);
    var wantsPlay = !still && o.autoplay !== false;
    var a = lottie.loadAnimation({
      container: el,
      renderer: o.renderer || 'svg',
      loop: !still && o.loop !== false,
      autoplay: wantsPlay,
      animationData: JSON.parse(JSON.stringify(data)),
      rendererSettings: o.rendererSettings || { preserveAspectRatio: 'xMidYMid meet' }
    });
    if (still) a.addEventListener('DOMLoaded', function () { a.goToAndStop(o.posterFrame || 0, true); });
    var onScreen = true, io = null;
    function sync() { if (!wantsPlay) return; if (onScreen && !document.hidden) a.play(); else a.pause(); }
    if (wantsPlay && 'IntersectionObserver' in root) {
      io = new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; sync(); });
      io.observe(el);
    }
    document.addEventListener('visibilitychange', sync);
    a.__still = still;
    a.__teardown = function () { if (io) io.disconnect(); document.removeEventListener('visibilitychange', sync); a.destroy(); };
    return a;
  }

  function scrub(anim, el, from, to) {
    function f() {
      var r = el.getBoundingClientRect(), vh = root.innerHeight;
      var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      anim.goToAndStop(from + (to - from) * p, true);     // true: the value is a frame number
    }
    root.addEventListener('scroll', f, { passive: true });
    f();
    return function () { root.removeEventListener('scroll', f); };
  }

  root.LottieHelpers = { recolor: recolor, mount: mount, scrub: scrub };
})(window);
