/* splitkit.js: vanilla SplitText-style splitting that is safe for Persian and Arabic.
   HTML-Sensei's own code (written in the UI research lane), no dependencies, no build step. Classic script: inline it
   or load it with <script src>; it defines window.splitText and window.splitKit.

   verified: Chrome 156 headless (Windows 10) through ../scripts/test-typography.mjs on ../examples/kinetic.html:
             Persian words, ZWJ letters and inline letters within 1 px of the unsplit width, the hidden real-text copy,
             revert(), reduced motion; the lane's matrix measured +150 px for naive per-letter inline-blocks.
   not verified: Firefox and Safari shaping across span boundaries; screen-reader speech of the .sk-sr copy; the
             by:'lines' re-split on resize beyond construction; faces other than Vazirmatn (GPOS cursive attachment
             across boxes: Vazirmatn has no curs feature, a face that has one may break).

   splitText(el, { by: 'words'|'chars'|'lines', cursive: 'words'|'zwj'|'inline' })
     returns { words, chars, lines, revert(), resplit() }

   Rules it enforces:
   - the visible split copy is aria-hidden; one visually hidden copy of the real text stays in the tree
   - Arabic-script text is never split into inline-block characters naively (that breaks joining):
       cursive:'words'  (default) split by word only
       cursive:'zwj'    per-character inline-block with zero width joiners so shaping survives
       cursive:'inline' per-character plain inline spans (shaping survives; transform does NOT apply to inline boxes,
                        so animate only opacity, colour, filter, background)
   - spaces stay as text nodes between the spans, never inside an inline-block (a lone space inside one collapses)
   - every unit gets --i (running index) so CSS can stagger: animation-delay: calc(var(--i) * 40ms)
*/
(function (root) {
  var CURSIVE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
  var RIGHT_ONLY = 'اآأإدذرزژوؤة'; // join to the previous letter only
  var NONJOIN = /[ءٔ،؛؟٪-٭۔٠-٩۰-۹\s]/;
  var seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

  function graphemes(t) { return seg ? Array.from(seg.segment(t), function (s) { return s.segment; }) : Array.from(t); }
  function isLetter(c) { return CURSIVE.test(c) && !NONJOIN.test(c); }
  function joinsForward(c) { return isLetter(c) && RIGHT_ONLY.indexOf(c) < 0; }
  // add U+200D only where the neighbouring letters really connect (never at the start of a word)
  function withZwj(chars) {
    return chars.map(function (c, i) {
      var p = chars[i - 1], n = chars[i + 1];
      return ((p && joinsForward(p) && isLetter(c)) ? '‍' : '') + c +
             ((n && joinsForward(c) && isLetter(n)) ? '‍' : '');
    });
  }
  function span(cls, html, i) {
    var s = document.createElement('span'); s.className = cls; s.style.setProperty('--i', i);
    if (cls.indexOf('sk-c') > -1 || cls.indexOf('sk-w') > -1) s.textContent = html; return s;
  }

  function splitText(el, opts) {
    opts = opts || {};
    var by = opts.by || 'words', cursiveMode = opts.cursive || 'words';
    var text = el.getAttribute('data-sk-text') || el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('data-sk-text', text);
    var isCursive = CURSIVE.test(text);
    var state = { words: [], chars: [], lines: [] };

    function build() {
      var sr = document.createElement('span'); sr.className = 'sk-sr'; sr.textContent = text;
      var vis = document.createElement('span'); vis.className = 'sk-vis'; vis.setAttribute('aria-hidden', 'true');
      var wi = 0, ci = 0; state.words = []; state.chars = []; state.lines = [];
      var mode = by;
      if (isCursive && by === 'chars' && cursiveMode === 'words') mode = 'words';
      text.split(' ').forEach(function (w, k, all) {
        var ws = span('sk-w', mode === 'chars' ? '' : w, wi++);
        if (mode === 'chars') {
          var cs = graphemes(w);
          var shown = (isCursive && cursiveMode === 'zwj') ? withZwj(cs) : cs;
          shown.forEach(function (c) {
            var cc = span('sk-c' + ((isCursive && cursiveMode === 'zwj') ? ' sk-ib' : (isCursive ? ' sk-inl' : ' sk-ib')), c, ci++);
            ws.appendChild(cc); state.chars.push(cc);
          });
          ws.classList.add('sk-wkeep');
        }
        vis.appendChild(ws); state.words.push(ws);
        if (k < all.length - 1) vis.appendChild(document.createTextNode(' '));
      });
      el.textContent = ''; el.appendChild(sr); el.appendChild(vis);
      if (by === 'lines' || opts.lines) {
        var top = null, line = null;
        state.words.forEach(function (w) {
          var t = w.offsetTop;
          if (top === null || Math.abs(t - top) > 2) { top = t; line = []; state.lines.push(line); }
          line.push(w);
        });
        state.lines.forEach(function (ln, i) { ln.forEach(function (w) { w.style.setProperty('--l', i); }); });
      }
    }
    build();
    var lastW = el.clientWidth, ro = null;
    if (opts.resplit !== false && root.ResizeObserver && (by === 'lines' || opts.lines)) {
      ro = new ResizeObserver(function () { if (el.clientWidth !== lastW) { lastW = el.clientWidth; build(); } });
      ro.observe(el);
    }
    if (document.fonts && document.fonts.ready && (by === 'lines' || opts.lines)) document.fonts.ready.then(build);
    return Object.assign(state, {
      revert: function () { if (ro) ro.disconnect(); el.textContent = text; el.removeAttribute('data-sk-text'); },
      resplit: build, isCursive: isCursive
    });
  }
  root.splitText = splitText; root.splitKit = { graphemes: graphemes, withZwj: withZwj, isCursive: function (t) { return CURSIVE.test(t); } };
})(typeof window !== 'undefined' ? window : this);
