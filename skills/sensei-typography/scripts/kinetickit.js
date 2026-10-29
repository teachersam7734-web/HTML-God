/* kinetickit.js: scramble/decode text as a pure function of time, a fluid-type generator, and a reduced-motion helper.
   HTML-Sensei's own code (UI research lane), vanilla, no dependencies; defines window.kineticKit.

   verified: Chrome 156 headless and Node 24 through ../scripts/test-typography.mjs: scrambleAt is deterministic for
             equal seed and time, resolves to the final text, never scrambles spaces or ZWNJ; fluid(18, 40, 360, 1440)
             gives clamp(1.125rem, 0.6667rem + 2.037vw, 2.5rem) and samples 18 px at 360 and 40 px at 1440.
   not verified: runScramble on Firefox and Safari; frame cost on phones. */
(function (root) {
  // seeded PRNG so a frame is reproducible: same (seed, t) gives the same characters (needed for video renders)
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  var SETS = {
    latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+<>?',
    code: '01{}[]()<>/\\=+-*#$%',
    // Persian letters only (no ZWNJ, no marks): every random pick is a real letter so shaping stays valid
    persian: 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی',
    persianDigits: '۰۱۲۳۴۵۶۷۸۹'
  };

  /* scrambleAt(final, t, opts): the string to show at time t (ms).
     opts: charset, duration (ms to fully resolve), stagger (ms between letters), tick (ms per random change), seed, from ('start'|'end'|'random')
     Letters resolve left to right in logical order (for Persian the first letter is the rightmost on screen, which is right).
     Spaces and ZWNJ are never scrambled so word shapes stay put. */
  function scrambleAt(final, t, o) {
    o = o || {};
    var set = o.charset || SETS.latin, dur = o.duration || 900, tick = o.tick || 50, seed = o.seed || 1;
    var chars = Array.from(final), pool = Array.from(set), n = chars.length, out = '';
    var stagger = o.stagger != null ? o.stagger : Math.max(8, (dur * 0.6) / Math.max(1, n));
    var frame = Math.floor(t / tick);
    for (var i = 0; i < n; i++) {
      var c = chars[i], doneAt = (o.from === 'end' ? (n - 1 - i) : i) * stagger + dur * 0.4;
      if (/[\s‌‍]/.test(c) || t >= doneAt) { out += c; continue; }
      var r = mulberry32(seed * 7919 + i * 104729 + frame * 15485863)();
      out += pool[Math.floor(r * pool.length)];
    }
    return out;
  }

  /* runScramble(el, opts): drives scrambleAt from requestAnimationFrame. Keeps the real text for assistive tech
     (aria-label on a heading, or put a .sr-only copy beside it) and sets min-width so the box does not jump. */
  function runScramble(el, opts) {
    opts = opts || {};
    var final = el.getAttribute('data-final') || el.textContent;
    el.setAttribute('data-final', final);
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.textContent = final; // measure the real width first
    el.style.minInlineSize = el.getBoundingClientRect().width + 'px';
    if (reduce || opts.static) return { cancel: function () {} };
    var t0 = performance.now(), raf = 0, dur = (opts.duration || 900) + (final.length * 12);
    (function step(now) {
      var t = now - t0; el.textContent = scrambleAt(final, t, opts);
      if (t < dur) raf = requestAnimationFrame(step); else el.textContent = final;
    })(t0);
    return { cancel: function () { cancelAnimationFrame(raf); el.textContent = final; } };
  }

  /* fluid(minPx, maxPx, minVw, maxVw, rootPx): clamp() with a rem term so browser zoom still enlarges text (WCAG 1.4.4).
     A pure vw preferred value shrinks when the user zooms (the CSS viewport narrows) and can defeat zoom. */
  function fluid(minPx, maxPx, minVw, maxVw, rootPx) {
    rootPx = rootPx || 16; minVw = minVw || 360; maxVw = maxVw || 1440;
    var slope = (maxPx - minPx) / (maxVw - minVw);            // px per px of viewport
    var interceptPx = minPx - slope * minVw;
    var r = function (n) { return +n.toFixed(4); };
    return 'clamp(' + r(minPx / rootPx) + 'rem, ' + r(interceptPx / rootPx) + 'rem + ' + r(slope * 100) + 'vw, ' + r(maxPx / rootPx) + 'rem)';
  }

  root.kineticKit = { scrambleAt: scrambleAt, runScramble: runScramble, fluid: fluid, SETS: SETS, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : this);
