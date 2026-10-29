/* srs.js: spaced-review schedulers as small pure functions. Works as a classic script (window.SenseiSRS) and as
   CommonJS (require). Leitner, SM-2, an interleaver and a due queue; for FSRS use the ts-fsrs package (MIT), see
   references/spaced-review.md.

   verified: Windows 10, Node 24 (test-srs.mjs): Leitner box moves and gaps, SM-2 intervals 1, 6, 16 days at quality 5
             with the ease floor of 1.3 and a lapse back to 1 day, interleave with no neighbours from one group when
             that is possible, due queue most overdue first with new cards capped; and ts-fsrs 5.4.2 run for real beside it.
   not verified: learning outcomes of any of these schedules (that is research, not a test).
   Origin: code-apps/course/srs.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), wrapped for both script and
   require. Ultra Bookworm's own deck uses different gaps: see references/ultra-bookworm.md. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SenseiSRS = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DAY = 86400000;

  /* Leitner, five boxes. grade: 'again' | 'hard' | 'good' ('easy' counts as good). gaps are days by box (index 0
     unused): box 1 is due again today, then 1, 2, 4 and 8 days, which is what Ultra Bookworm's deck tells the learner. */
  var LEITNER_GAPS = [0, 0, 1, 2, 4, 8];
  function leitner(card, grade, now, gaps) {
    now = now == null ? Date.now() : now; gaps = gaps || LEITNER_GAPS;
    var s = { box: 1 }; for (var k in card) s[k] = card[k];
    if (grade === "again") s.box = 1;
    else if (grade === "hard") s.box = Math.max(1, s.box - 1);
    else s.box = Math.min(5, s.box + 1);
    s.due = now + gaps[s.box] * DAY;
    return s;
  }

  /* SM-2. q is the quality of recall, 0 to 5. */
  function sm2(card, q, now) {
    now = now == null ? Date.now() : now; card = card || {};
    var rep = card.rep || 0, ef = card.ef || 2.5, interval = card.interval || 0;
    if (q < 3) { rep = 0; interval = 1; }
    else {
      rep++; interval = rep === 1 ? 1 : rep === 2 ? 6 : Math.round(interval * ef);
      ef = Math.max(1.3, ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    }
    return { rep: rep, ef: ef, interval: interval, due: now + interval * DAY };
  }

  /* Interleaving: never two items from the same group back to back when it can be avoided (greedy, deterministic for
     a given input order; shuffle the input first if the order should vary). */
  function interleave(items, key) {
    var left = items.slice(), out = [];
    while (left.length) {
      var lastK = out.length ? key(out[out.length - 1]) : null, i = -1;
      for (var j = 0; j < left.length; j++) { if (key(left[j]) !== lastK) { i = j; break; } }
      if (i < 0) i = 0;
      out.push(left.splice(i, 1)[0]);
    }
    return out;
  }

  /* Due queue: overdue first (most overdue first), then new cards (no due date) capped per day. */
  function dueQueue(cards, now, newPerDay) {
    now = now == null ? Date.now() : now; newPerDay = newPerDay == null ? 10 : newPerDay;
    var due = cards.filter(function (c) { return c.due != null && c.due <= now; }).sort(function (a, b) { return a.due - b.due; });
    var fresh = cards.filter(function (c) { return c.due == null; }).slice(0, newPerDay);
    return due.concat(fresh);
  }
  return { leitner: leitner, sm2: sm2, interleave: interleave, dueQueue: dueQueue, LEITNER_GAPS: LEITNER_GAPS, DAY: DAY };
});
