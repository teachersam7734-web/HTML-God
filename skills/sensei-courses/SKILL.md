---
name: sensei-courses
description: Interactive courses and e-learning in HTML, offline in one file or inside an LMS. Course architecture (lessons as JSON, a validator that refuses to build, hash routing with the stage in the address), question engines (multiple choice, True/False/Not Given, multi-select, gap fill, ordering, matching) with keyboard and screen-reader behaviour built in, feedback that never leaks the key, progress that survives blocked or full storage with a portable progress code and versioned migration, spaced review (Leitner, SM-2, FSRS), final assessments and certificates, and SCORM 1.2, SCORM 2004 and cmi5 reporting and packaging. Ultra Bookworm is the worked example. Use when someone says course, e-learning, lesson, module, quiz, test, exam, assessment, question bank, flashcards, spaced repetition, review deck, Leitner, Anki, FSRS, progress tracking, save progress, certificate, IELTS practice, LMS, SCORM, xAPI, cmi5, Moodle, Canvas, Blackboard, or report completion.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-courses

A course is a website plus a promise: the learner's progress, answers and result are remembered, trustworthy and,
when an employer or school is involved, reported. Doctrine first: best quality is the default, no page-weight budget
unless the user asks, never downgrade for this machine, and say plainly what was not verified. Nothing here was
imported into a real LMS: the LMS code was proved against strict mocks only.

## 1. When to use

Any course, lesson set, quiz, practice test, flashcard deck or assessment, from a two-lesson page to a fifty-lesson
offline file, with or without an LMS.

| The job is | Skill |
|---|---|
| Packing the course into one offline file (template, placeholders, inert payloads, boot order) | `sensei-single-file` (its `references/ultra-bookworm.md` is the builder half of the worked example) |
| A quiz inside a slide deck | `sensei-presentations`, reusing `engine.js` |
| The question bank as a game (Save The Damsel) | `sensei-games`; grading stays in the engine, effects in the game |
| Dialogs, tabs, popovers around the course | `sensei-ui-components` |
| Persian or right-to-left lessons, fonts | `sensei-typography` |
| Motion of screens and stages, the calm switch's CSS | `sensei-motion-ui`, `sensei-transitions`, `sensei-scroll` |
| Sound feedback and narration | `sensei-audio` |
| Themes and contrast | `sensei-tokens-theming` |
| Proving it works | `sensei-verify` |

Not for: a certificate that must be trusted by a third party, or cheating resistance. Answers in a client-side page are
in its source; a server or an LMS is the only answer to either. Say so.

## 2. Decision table

| Choice | Pick | What decides it |
|---|---|---|
| Delivery | one offline file | emailed, on USB, opened from disk, archived: the default (Ultra Bookworm) |
| | a hosted folder | many large media files that need streaming |
| | an LMS package | someone named an LMS or wants completion reported |
| Content | lessons as JSON plus a validator | always past a handful of lessons: it is what makes fifty possible |
| Answer control | native radios, changes allowed until Check (`engine.js`) | practice with a Check button |
| | `role="radio"` buttons, arrows move focus only | the first choice is final (Ultra Bookworm, timed tests) |
| Attempts | 1 | assessment items |
| | 2 or more, the key never shown on a retry | practice, gap fills |
| Storage | `makeStore` (namespaced, memory fallback, two failure words) | always; plus the progress code whenever storage can be blocked, which is always on `file://` in Firefox |
| Stored progress | `{schema, lessons}` with a migration table | always: a course that is updated must read old progress |
| Review | none | no facts or words to retain |
| | Leitner | a fixed-length course; predictable, explainable to the learner |
| | SM-2 | adaptive with no dependency |
| | FSRS (`ts-fsrs`, MIT) | review is the product |
| Reporting | none (`lms.js` returns `none`) | no LMS named |
| | SCORM 1.2 | the LMS is old or the client asks for it; one status field, 4,096 characters of resume data |
| | SCORM 2004 | completion and success reported apart; 64,000 characters |
| | cmi5 | a modern LMS with an LRS; content may live on another origin |
| Certificate | canvas PNG with a check code | personal achievement; state that it proves nothing to others |
| | LMS record or server | the certificate must be trusted |

## 3. Core technique

### 3.1 Architecture

```
lessons/*.json ──► validate-lessons.mjs (+ the course's own rules) ──► build (sensei-single-file) ──► course.html
                                                                             │
template.html + styles.css + engine.js + srs.js + lms.js + app.js ──────────┘
```

In the page: data as JSON (`window.COURSE = ...` with `</` escaped, or `<script type="application/json">` for big
sets), the engine, then the app. One progress object per course version; one `onProgress(event)` fan-out sends each
change to storage, the polite live summary and `LMS.progress()`.

Routing puts the place in the address so reload, bookmarks and Back all work: `#lesson/7/3` is lesson 7, stage 3. Push
a history entry on every real move; route `popstate` and `hashchange` through one function behind a `routing` flag;
ignore the hash the router just wrote; correct an unknown address (`replaceState`) instead of showing an empty screen;
gate earned screens (`#cert` without a pass becomes `#exam`) inside the router; move focus to the new screen's heading
(`tabindex=-1`, `preventScroll`); jump, never smooth-scroll, to new content. Detail and the reasons:
[references/ultra-bookworm.md](references/ultra-bookworm.md).

### 3.2 Storage and progress (`scripts/engine.js`)

```js
var store = CourseEngine.makeStore("my-course");            // keys "my-course:*"; never throws
store.onFail = function (cause) { showNote(cause); };          // "full": a later write threw
if (!store.persistent) showNote(store.cause());                // "blocked": access threw at start
var progress = CourseEngine.makeProgress(store, LESSONS, 0.7, {
  schema: 2, migrate: { 0: fromUnversioned, 1: addReviewField } // each returns the next schema's body
});
if (progress.readOnly()) showNote("newer");                     // saved by a newer build: never misread or overwritten
progress.record("l3", 0.85);                                     // {status: passed|attempted, score (best), tries, t}
var code = store.dump(["progress"]);                             // "CE1." + base64 JSON, for the learner to keep
store.load(pasted);                                              // throws on garbage and writes nothing
```

Words matter: "blocked" and "full" are different problems and get different sentences, shown in a note that stays
until dismissed (a two-second toast is missed). The progress code is the answer to both: offer it in a native
`<dialog>` (`showModal()`, so Escape closes it and focus returns to the opener).

### 3.3 Questions (`scripts/engine.js`)

```js
CourseEngine.mount({ type: "tfng", prompt: "The passage compares speeds.", answer: 2, explain: "Not Given: ..." },
                   host, { attempts: 1, onDone: function (r) { scores.push(r.score); } });
```

Six types (`mcq`, `tfng`, `multi`, `gap`, `order`, `match`), each in a `fieldset` with a `legend` or a labelled
control; a `role="status"` region present before any text; an empty submit refused without using an attempt; a retry
that says how many tries are left and never the key; then locked controls, a verdict in words and an icon, and
"(correct answer)" for screen readers. Ordering has buttons and Alt+Arrow with an announced position: drag is never the
only way. Matching is a native `<select>` per row. The type table, the first-choice-final pattern, the feedback rules
and the content gates: [references/questions-and-review.md](references/questions-and-review.md).

### 3.4 The content gate (`scripts/validate-lessons.mjs`)

```
node validate-lessons.mjs lessons/ --count 10 --strict     # exit 1 on any error (and on warnings with --strict)
```

Errors: duplicate ids, missing prompts or explanations, keys out of range, repeated options, broken gap, order, multi
or match data, the wrong question count. Warnings: the key is the longest option far more often than chance (Ultra
Bookworm measured 70 per cent before its repair pass), an answer position never used, True/False/Not Given with no Not
Given. Course-specific rules (quotations exist in the passage, recycling) go in the course's own validator beside it.

### 3.5 Spaced review (`scripts/srs.js`)

```js
var s = SenseiSRS.leitner(card, "good");               // box up one, due by the gap table (0, 1, 2, 4, 8 days)
var q = SenseiSRS.dueQueue(cards, Date.now(), 10);     // most overdue first, then up to 10 new
var deck = SenseiSRS.interleave(shuffle(q), function (c) { return c.lesson; });
```

The words the deck says must match its numbers ("back in two days"). FSRS when review is the product: `ts-fsrs`
bundled to an IIFE (esbuild, 23 KB minified, verified) with its MIT notice. Numbers for all three:
[references/questions-and-review.md](references/questions-and-review.md).

### 3.6 Assessment and certificate

A separate data file with its own validator; marking refused until every item is answered and a name is given; the
pass persisted (`{name, pct, date}`) and the certificate route gated in the router; fonts loaded with
`document.fonts.load()` before drawing the canvas; results never carried by animation frames (a hidden tab gets none).
A check code (Ultra Bookworm: FNV-1a over name, score and date, Crockford base 32) shows the details were issued
together by this file and nothing more.

### 3.7 LMS reporting (`scripts/lms.js`, `scripts/pack_lms.py`)

```js
LMS.connect().then(function (lms) {                  // 'cmi5' | 'scorm2004' | 'scorm12' | 'none'
  onProgress(function (p) { lms.progress({ location: p.id, suspend: p.pointer, scoreRaw: p.pct, completed: p.done, passed: p.done ? p.pct >= 70 : undefined }); });
  addEventListener("pagehide", function () { lms.finish(!course.finished()); });
});
```

```
python pack_lms.py course.html --format scorm2004 --title "Reading" --id reading -o reading-2004.zip
```

Same file standalone and in an LMS. Store pointers in `suspend_data`, not text. Standards table, guarantees, licences
of other wrappers: [references/lms.md](references/lms.md).

### 3.8 Calm and optional parts

One `calm()` = the system's reduced motion OR the learner's own Calm switch, and every effect asks it (Ultra Bookworm).
Optional parts (a thesaurus network, a game) never count towards completion, the review deck or the course's numbers.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Course engine: store, six question types, grading, retry policy, versioned progress | [scripts/engine.js](scripts/engine.js) | verified |
| A two-lesson course with routing, storage words and the progress-code dialog | [examples/course.html](examples/course.html), gate steps [examples/course.steps.json](examples/course.steps.json) | verified |
| Spaced review: Leitner, SM-2, interleave, due queue (script or require) | [scripts/srs.js](scripts/srs.js) | verified |
| Content gate for lesson JSON | [scripts/validate-lessons.mjs](scripts/validate-lessons.mjs), fixtures [fixtures/lessons-good.json](fixtures/lessons-good.json), [fixtures/lessons-bad.json](fixtures/lessons-bad.json) | verified |
| LMS adapter: SCORM 1.2, SCORM 2004, cmi5, standalone | [scripts/lms.js](scripts/lms.js) | verified against strict mocks; no real LMS |
| LMS packager: three manifests at the zip root | [scripts/pack_lms.py](scripts/pack_lms.py) | self-test verified; no real import |
| Self-tests | [scripts/test-course.mjs](scripts/test-course.mjs) (30), [scripts/test-srs.mjs](scripts/test-srs.mjs) (12), [scripts/test-lms.mjs](scripts/test-lms.mjs) (21), [scripts/test-validate.mjs](scripts/test-validate.mjs) (17); discovery in [scripts/pw.mjs](scripts/pw.mjs) | verified |
| The worked example, from its code | [references/ultra-bookworm.md](references/ultra-bookworm.md) | read, measured with the validator |

## 5. Quality bars

- Every question type answerable by keyboard alone; axe-core clean before and after answering.
- Feedback announced politely from a region that existed before its text; the key never shown on a retry; empty submit
  refused with no attempt used; verdicts in words, never colour alone.
- Storage blocked and storage full: the course keeps working, names the right cause, raises no page error; progress
  survives a reload where storage works; the progress code round-trips into a fresh profile and refuses garbage.
- Stored progress carries a schema number; older data migrates; newer data is never overwritten.
- Every route reloads to the same place; Back never leaves the course; an earned screen cannot be deep-linked.
- `validate-lessons.mjs` passes with no errors; the longest-key share within 15 points of chance.
- Targets at least 24 CSS px (44 advised), visible focus, contrast in light and dark, forced colours keep control edges.
- LMS: call order, formats, limits, no downgrade, one Terminate; cmi5 statements in order, once each.
- `sensei-verify`'s gate passes in strict `file://` on the built file, with the course's steps file.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Progress from another local course appears, or vanishes | Chrome shares one localStorage bucket across every `file://` page | namespace every key (`ub:`, `my-course:`) | tested (Ultra Bookworm, field-proven) |
| 2 | Course crashes or forgets everything on `file://` in Firefox or a private window | `localStorage` access throws `SecurityError` | probe once in `try`, fall back to memory, tell the learner, offer the progress code | tested (blocked getter in `test-course.mjs`); Firefox reported |
| 3 | A learner told "storage is blocked" when it is full, or nothing said at all | one failure path for two causes; a write can throw `QuotaExceededError` long after start | two causes, two sentences, `onFail` told once | tested (`test-course.mjs`) |
| 4 | Old answers come back after a failed write | `get()` read the stale stored value while the new one sat in memory | once a key is in memory, memory wins | found and fixed in Ultra Bookworm (QC F-STO-1) |
| 5 | A bad paste wipes progress | `load()` wrote keys before checking the code | parse and check everything, then write | tested |
| 6 | An updated course misreads old progress | unversioned stored data | `{schema, lessons}` plus a migration table; newer data read-only | tested (`engine.js`); Ultra Bookworm lacks it |
| 7 | A test seeds storage, reloads, and the seed is gone | the page saves on `pagehide` and overwrites storage seeded before the reload | seed in a fresh context (`addInitScript` or a new page) | tested (games lane) |
| 8 | Learner shows as not passed in the LMS | SCORM 1.2 has one status field: `completed` written after `passed` erases the pass | a "decided" flag; passed or failed win over completed | tested (a real bug in the first adapter draft) |
| 9 | "No data in the LMS" | SCORM needs the content on the LMS's origin; a cross-origin parent hides the API | host on the LMS; the adapter degrades to standalone silently, so check hosting first | tested (`localhost` against `127.0.0.1`) |
| 10 | Resume state silently cut | `suspend_data` 4,096 characters in 1.2 (64,000 in 2004), truncated by many LMSs | store ids and indexes; the adapter refuses oversize with a warning | tested |
| 11 | Final status lost on close | async work on unload is dropped | `finish()` once, synchronously, on `pagehide`; cmi5 statements with `keepalive: true` | reported (research) |
| 12 | cmi5 401 after a reload | the `fetch` URL is single-use | fetch once; cache the token in `sessionStorage` if reloads must survive (not implemented) | tested (single use); the cache is not |
| 13 | cmi5 conformance failure | statements out of order or repeated | initialized, passed or failed, completed, terminated, each once per session | tested |
| 14 | LMS import fails | the zip has a folder on top, or 1.2 and 2004 namespaces mixed (`scormtype` against `scormType`) | manifest at the root; `pack_lms.py --selftest` | tested (self-test); real import not run |
| 15 | An arrow key answers a one-shot question | native radios select on arrow | `role="radio"` buttons that move focus only, or allow changes until Check | tested (Ultra Bookworm, field log) |
| 16 | Focus drops to the page top after answering | `disabled` on the focused option | `aria-disabled="true"` plus a guard; `:not([aria-disabled="true"])` in hover styles | tested (field log) |
| 17 | Keyboard and screen-reader users cannot order items | drag-only ordering | Up and Down buttons, Alt+Arrow, announced positions | tested |
| 18 | Colour-blind learners cannot tell right from wrong | colour-only verdicts | words, an icon, and a hidden note per option | tested (axe and text checks) |
| 19 | The first verdict is not spoken | the live region was created together with its text | create the `role="status"` region empty at mount | tested |
| 20 | Learners answer by picking the longest option | authors make keys longer | `validate-lessons.mjs`; Ultra Bookworm went from 70 to 14.9 per cent | measured |
| 21 | True/False/Not Given never uses Not Given | authoring habit (32 Ultra Bookworm lessons had none) | the validator's Not Given warning | measured |
| 22 | The certificate opens without the test, or with a placeholder name after reload | the router accepted any screen and only the earn path ran the setup | gate in the router, persist the pass, run the setup on every entry after display | tested (field log) |
| 23 | The score reads 0 per cent forever | the counter and ring ran on `requestAnimationFrame`, paused in a hidden tab | commit the start with a layout read and let CSS transition; timer backstop | tested (Ultra Bookworm) |
| 24 | The certificate draws in a generic serif | canvas drew before the faces were rasterised | `document.fonts.load()` each face first | tested (Ultra Bookworm) |
| 25 | A client-side certificate taken as proof | anyone with the file can compute the code | say so; an LMS or a server when it matters | by design |
| 26 | The flashcard's answer is read before the flip | a back face hidden by `rotateY` is still in the accessibility tree | front `<button aria-expanded>`, back `inert` and `aria-hidden` until turned | tested (field log) |
| 27 | The deck says "again today" and shows the card tomorrow | Ultra Bookworm's `GAPS[box]` gives 1, 2, 4, 8, 16 days while its words say today, 1, 2, 4, 8 | one table drives both the schedule and the words | read in the code while writing this skill; fixed in Ultra Bookworm and verified by grading cards (2026-10-27) |
| 28 | A global arrow or Space shortcut answers, flips or finishes by accident | a window listener ignored focus and modifiers | skip on `defaultPrevented`, modifiers, inputs, tabs, sliders and radio groups; no shortcut completes anything | tested (field log) |
| 29 | A lesson string ends the page's script early | `</script` inside JSON in a classic `<script>` | escape `</` when writing data (Ultra Bookworm's `script_json`; `sensei-single-file`'s `json` kind) | tested (`sensei-single-file`'s `test-build-single.mjs`) |
| 30 | ts-fsrs fails in a classic script | the import is a module | bundle to an IIFE with esbuild (23 KB minified) and keep its notice | tested here |
| 31 | A GPL obligation arrives with an interactive widget | H5P's library is GPL-3.0 | reference only; read each content type's licence | reported |
| 32 | An unlicensed wrapper shipped to a client | pipwerks has no declared licence; the ADL wrapper none and archived | write your own (`lms.js`) | reported |

## 7. Licences

| Piece | Licence | Use |
|---|---|---|
| `engine.js`, `srs.js`, `lms.js`, `validate-lessons.mjs`, `pack_lms.py`, the tests, the example, the fixtures | HTML-Sensei's own code | ship in the plugin and in courses |
| ts-fsrs | MIT | may be bundled into a course with its notice and a ledger row; not vendored in the plugin |
| axe-core | MPL-2.0 | a test tool the user installs; never shipped inside a course without its notice |
| playwright-core | Apache-2.0 | a test tool the user installs |
| H5P library | GPL-3.0 | reference only |
| pipwerks `scorm-api-wrapper`, ADL `SCORM-to-xAPI-Wrapper` | none declared | reference only; ideas, never code |
| xAPI and cmi5 specifications | Apache-2.0 | read for the rules |

Ultra Bookworm's lesson content stays in Ultra Bookworm; only its architecture is described here.

## 8. Verification

Run here (Windows 10, Node 24, playwright-core 1.62.1 with installed Chrome 155, axe-core 4.14.0, ts-fsrs 5.4.2,
Python 3, strict `file://`): `test-course.mjs` 30 of 30, `test-srs.mjs` 12 of 12, `test-lms.mjs` 21 of 21 (with
`pack_lms.py --selftest` inside it), `test-validate.mjs` 17 of 17. `sensei-verify`'s `sensei-gate.mjs` on
`examples/course.html` with `examples/course.steps.json`: verdict pass, 21 checks, 17 scripted steps, axe clean on
mobile, desktop and dark, keyboard walk with a visible ring and the skip link first; the contact sheet was looked at.
`validate-lessons.mjs` read Ultra Bookworm's 50 lessons (500 questions, no errors, no warnings). ts-fsrs bundled to an
IIFE with esbuild ran in a bare script context.

Not verified: import into any real LMS or LRS; Firefox and Safari (the `file://` storage behaviour of Firefox is
reported, not run); screen-reader speech; phones and touch; learning outcomes of any schedule; cmi5 Browse and Review
modes; a reload during a cmi5 session.

## 9. Carried by

- Agent `sensei-course-builder`: turns a syllabus or source material into lesson JSON, runs `validate-lessons.mjs` and
  the course's own rules, builds with `sensei-single-file`, runs the tests and the gate with a steps file, and packages
  with `pack_lms.py` when an LMS is named, reporting which standards were mocked rather than imported.
- Agent `sensei-reviewer`: the accessibility lens on question widgets, routes and storage words; never edits.
- Hooks: `lint-web.mjs` (reduced motion per animation system, toasts without a live region, drag without keys,
  network references when offline); `guard-licence.mjs` (GPL and unlicensed wrappers); `gate-claim.mjs` (no "done"
  without a fresh passing gate report); `keep-eol.mjs`; `probe.mjs` (finds Node, Chrome and Playwright for the tests and the gate).
