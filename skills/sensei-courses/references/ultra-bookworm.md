# The worked example: Ultra Bookworm as a course

Read from the code on 2026-10-25: `app/app.js` in the owner's Ultra Bookworm project (not shipped) (about 5,000 lines, one classic script), `app/template.html` in the owner's Ultra Bookworm project (not shipped),
`app/styles.css` in the owner's Ultra Bookworm project (not shipped), `build.py` in the owner's Ultra Bookworm project (not shipped), `regroup_questions.py` in the owner's Ultra Bookworm project (not shipped), the lesson JSON in `lessons/` in the owner's Ultra Bookworm project (not shipped) and the
architecture notes in `RESUME.md` in the owner's Ultra Bookworm project (not shipped). How the single file is built and ordered is in `sensei-single-file`
(`references/ultra-bookworm.md` there); this page is the course half. None of its lesson content is in the plugin.

## The shape

One offline HTML file (83.26 MB built) with ten screens, each a `<section class="screen" data-screen="...">` in the
template: `home`, `library`, `lesson`, `index` (the vocabulary index), `deck` (the review deck), `exam` (the Final
Assessment), `cert`, and the three Save The Damsel screens (`damsel`, `spear`, `arrow`). One screen carries the class
`on`; `go(name)` switches it.

| Layer | Where | What it does |
|---|---|---|
| Content | `lessons/lesson-NN.json` in the owner's Ultra Bookworm project (not shipped), `assessment.json` in the owner's Ultra Bookworm project (not shipped) | 50 lessons and the assessment as data |
| Validation | `build.py` `validate()` and `validate_assessment()`, plus `checkone.py`, `auditlesson.py`, `quotecheck.py` | errors abort the build; `--check` validates without writing |
| Build | `build.py` | inlines CSS, JS, fonts, images, audio, video and the JSON into `template.html`; refuses leftover placeholders |
| Data in the page | `window.UB_LESSONS`, `window.UB_ASSESS` | written by the build as JSON inside a `<script>`, with every `</` escaped as `<\/` |
| App | `app.js`, one IIFE | storage shim, state, router, renderers, deck, exam, certificate, effects, the game |

## Content model

A lesson: `id, domain, cluster, tier, title, lede, techniques, preview, passage, questions, vocab, toolkit, network`.
A comprehension question: `{type, prompt, opts, a, explain, via}` where `type` is the IELTS label shown to the learner
(for example "True / False / Not Given", "Matching Headings"), `a` the index of the key in `opts`, `via` the reading
technique that cracks it. A preview question is `{prompt, opts, a, explain}`. A vocabulary item carries `term, type,
pos, mode, forms, def, egs, syn, alt, col, family, pattern, reg, det`.

What `build.py` refuses (errors): a comprehension count other than exactly 10; duplicate terms or techniques across
lessons; a term with no definition or that never appears in the passage; a lesson teaching a word beside its own listed
synonym; a toolkit without a move and exactly four phrases; a network without three hubs of five nodes; an em dash in
the toolkit or network; an assessment that is not 8 reading plus 12 vocabulary items of four unique options with an
in-range key, or that claims a word was taught in a lesson that does not teach it. Warnings: counts, passage length
(1,200 to 1,600 words), target density, missing examples, an answer position the assessment never uses.

**Question blocks.** IELTS presents each question type as its own block. `regroup_questions.py` sorts every lesson's
questions by a fixed block order (True/False/Not Given, Yes/No/Not Given, Matching Headings, Matching Information,
Sentence Completion, Multiple Choice) with a stable sort, so statements stay in passage order inside a block and the
lesson's overall-verdict Multiple Choice closes the set. The page renders each question with its type label beside
the number; the grouping lives in the data, not in the renderer.

**Measured with this skill's validator** (`scripts/validate-lessons.mjs build/lessons --count 10`, 2026-10-25): 50
lessons, 500 questions, no errors, no warnings; the key is the longest option in 44 of 295 choice items (14.9 per cent,
chance 25), every position used (76, 77, 82, 60), 50 of 205 True/False/Not Given items answered Not Given. Before its
repair pass the course measured 70 per cent longest-key (`RESUME.md`).

## Routing: the stage is in the address

- `#home`, `#library`, `#index`, `#deck`, `#exam`, `#cert`, and `#lesson/7` (stage one) or `#lesson/7/3` (stage
  three of five: Techniques, Preview, Passage, Questions, Vocab Stop).
- Every real move pushes a history entry, so Back returns to the previous screen or stage instead of leaving the
  course. `popstate` and `hashchange` both route through `routeFromHash()` behind a `routing` flag, and the hash
  listener ignores the hash the router just wrote (`lastRouted`), so one Back does not route twice.
- `#lesson/999` (no such lesson) opens the library under a corrected address (`replaceState('#library')`).
- `#cert` without a pass in this session or in storage becomes `#exam`: the gate is in `go()`, so a deep link, a
  bookmark and Back all meet it.
- `history.scrollRestoration = "manual"`; the screen being left keeps its scroll in its own entry's state (`{y}`), so
  Back lands on the same row of the library.
- The new screen's heading takes focus (`tabindex=-1`, `preventScroll`), except on the first route.
- Real navigation jumps (`scrollTo(0,0)`), never smooth-scrolls: the new screen runs its own entrance.

## Progress and storage

`Store` (top of `app.js`): keys namespaced `ub:` because Chrome gives every `file://` page one shared bucket; a probe
write at start; two failure words, "blocked" (access throws: private modes, blocked site data, Firefox on `file://`)
and "full" (a later write throws); memory fallback, and once a key is in memory, memory wins. `onFail` fires once with
the cause and the library shows a dismissable note that names it; the first screen also speaks it through the live
region.

State read at boot: `done{lessonId}`, `mastery{term: known|shaky}`, `srs{term: {box, due}}`, `perfLite` (Calm),
`theme`, `reach{lessonId: furthest stage}`, `resume{id, stage, at, n, t}`, plus `examBest` and `examPass{name, pct,
date}`. `resume.at` is the index of the block at the top of the screen (a paragraph, a question, a Vocab Stop panel),
noted 350 ms after scrolling stops, so Continue lands on the same paragraph at any width. A finished lesson hands
Continue on to the next unfinished one.

**Save my progress** (a native `<dialog>`): `Store.dump()` gives `UB1.` plus base64 JSON of every `ub:` key; copy,
download as a text file, or paste one back. `Store.load()` checks that the code is an object whose every value is a
string of valid JSON before it writes anything, so a bad paste changes nothing.

Not there: a schema number on stored progress (a changed lesson schema could misread old progress), a `pagehide`
flush (it writes on every change instead), any LMS reporting.

## Questions

Options are buttons with `role="radio"` and `aria-checked` inside `role="radiogroup"` named by the prompt. In a lesson
the first choice is final, so the arrow keys move focus only (a native radio would select on arrow and answer for the
learner). After an answer: the explanation opens with a visible verdict in words and an icon ("Correct", or "Not
quite. The answer is B"), each option gets a visually hidden "(your answer, correct)", "(your answer)" or "(correct
answer)", and one polite live region (cleared, then written 80 ms later so a repeat is spoken again) carries the
verdict. Gaps in prompts are drawn lines with `role="img" aria-label="blank"`, not underscores read aloud.

## Review deck (Leitner)

Five boxes; Again sends a card to box 1, Hard down one box, Good up one, at box 4 the term counts as known. The deck
is every card due now, then shaky words with no card, else known words, else the first 40; shuffled; swipe or buttons,
keys 1 to 4 on a turned card; the front is a button with `aria-expanded` and the back is `inert` until turned.

**A defect found while writing this page, since fixed:** `commit()` set `due = now + GAPS[box] * 1 day` with
`GAPS = [0, 1, 2, 4, 8, 16]`, so box 1 was due tomorrow and box 5 in sixteen days, while the deck's spoken summary
(`BOX_WHEN`) told the learner box 1 was "again today" and box 5 "in eight days"; and `grade("easy")` (key 4) was
treated as Good. The coordinator fixed both (2026-10-27): `GAPS = [0, 0, 1, 2, 4, 8]`, and Easy moves a card up two
boxes. Verified in the rebuilt course by grading new cards and reading storage back: Again, box 1 due now; Good,
box 2 due in 1 day; Easy, box 3 due in 2 days. The lesson stands: one table must drive both the schedule and the
words. This skill's `srs.js` uses the gaps the learner is told (0, 1, 2, 4, 8) and lets a course pass its own table.

## Final Assessment and certificate

Twenty items (8 on an unseen passage with its own narration, 12 vocabulary), a name field, a counter ("12 of 20
answered, name still needed"), marking refused until every item is answered and a name of two or more characters is
given (focus goes to the first gap). Pass mark 70 per cent. The score ring commits its start value with a layout read
and lets a CSS transition run, and the count-up has a timer backstop, because a hidden tab gets no animation frames
(the score once froze at 0 per cent).

The certificate is drawn on a canvas after `document.fonts.load()` of each face (or the first draw falls back to a
generic serif), downloaded as a PNG made on the machine, and carries a code: two FNV-1a passes over name, score, date
and a course salt give 40 bits in Crockford base 32 (`UB-XXXX-XXXX`). A check form on the page recomputes it. This
proves the details were issued together by this file; it proves nothing to a third party, because anyone with the
file can compute a code. Say so.

## Extracurricular parts

The Semantic Network (three hub words per lesson, five nodes each, in the Vocab Stop) and Save The Damsel (the game)
are labelled extracurricular: they never count towards the Final Assessment, the review deck, the index or the cover
counts, and the game reads nothing from the lessons and writes nothing to progress. Keep anything optional out of the
numbers that define completion.

## Calm mode

`calm()` is true when the system asks for reduced motion or the learner turned Calm on (stored as `perfLite`). One
switch gates every effect: the WebGL backgrounds, the keyed video, drifting words, the deck's fly-out, the theme
switch's circle reveal (a plain fade instead). `setCalm()` tells every loop, including those built only when motion
was allowed at boot, and the system setting is watched with a `change` listener.

## What to copy, what to change

Copy: content as data with a validator that refuses to build; the stage in the address with real history entries;
the gated reward route; the namespaced store with two failure words and a validated progress code; arrow keys that
only move focus when a choice is final; verdicts in words; one calm switch; optional parts kept out of completion.

Change for a new course: add a schema number to stored progress and migrate on read (`engine.js` `makeProgress`);
flush on `pagehide` if anything is batched; add `lms.js` when an LMS is named; make the deck's gaps and its words
agree; say plainly that a client-side certificate proves nothing.
