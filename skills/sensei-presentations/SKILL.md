---
name: sensei-presentations
description: Presentations and slide decks in HTML that survive any screen, offline in one file. A fixed 1920 by 1080 stage scaled to fit, slide and step state in the address, keyboard, clicker and swipe, step builds (fragments), morphs between slides, a presenter window with speaker notes and a timer, print and PDF handouts with one page per slide, accessibility built in; the own-core deck, reveal.js built into one file, Marp from Markdown, and when impress.js, Slidev or Spectacle fit. Use when someone says presentation, slides, slide deck, deck, keynote, pitch deck, talk, lecture slides, reveal.js, Marp, Slidev, impress.js, speaker notes, presenter view, handout, export to PDF, PowerPoint in HTML, fragments, step builds, auto-animate, or morph transition.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-presentations

A deck is a state machine of `(slide, step)` drawn on a fixed 16:9 stage that is scaled to the screen, never
reflowed. Everything else is a layer on that: keys and swipes, the hash, step builds, morphs, notes in a second
window, a print layout that becomes the handout, and an accessibility structure. Doctrine first: best quality is the
default, no page-weight budget unless the user asks, never downgrade for this machine, and say what was not verified.
Nothing here was run on a projector, a clicker or a real touch screen.

## 1. When to use

Any talk, pitch, lecture or briefing delivered slide by slide, and its PDF handout.

| The job is | Skill |
|---|---|
| A page that scrolls (a story, a launch page) rather than steps | `sensei-scroll`, `sensei-landing-hero` |
| A lesson with questions and progress | `sensei-courses` (its `engine.js` can sit inside a slide) |
| Charts on slides | `sensei-dataviz` |
| View Transitions as the morph | `sensei-transitions` |
| Packing fonts, images and video into the one file | `sensei-single-file`, `sensei-typography` |
| Motion craft beyond builds (timing, continuity) | `sensei-motion-ui`, `sensei-motion-graphics` |
| The deck recorded as a film | `sensei-video-pipeline` |
| Theme tokens and contrast | `sensei-tokens-theming` |
| Proving it | `sensei-verify` |

## 2. Decision table

| Choice | Pick | What decides it |
|---|---|---|
| Engine | own core (`examples/deck.html`) | the deck is a designed experience, branded and animated by hand; no library behaviour may surprise |
| | reveal.js (`build-reveal.mjs`) | a rich deck fast: vertical stacks, Markdown, overview, plugins; the common default |
| | Marp | the source is Markdown and PDF or PPTX is the main output |
| | Slidev | a developer talk with live code, a build pipeline and Vue accepted (output is a folder, not one file) |
| | Spectacle | the project is already React |
| | impress.js | one spatial showpiece inside another deck; never the base |
| Stage size | 1920 by 1080 | the default; author in px against it |
| | 1280 by 720 | a lighter deck; same rules |
| Centring | negative margins or an explicit translate | always; never grid or flex centring of the stage |
| Morph | FLIP on `data-id` twins | the default, measured in unscaled pixels |
| | View Transitions | when the deck already uses them (`sensei-transitions`) |
| Presenter sync | `postMessage` between opener and popup | always; not `BroadcastChannel`, not storage events |
| Handout | own core print CSS | one page per slide by construction |
| | reveal.js `?print-pdf` | add `--handout` for one page per slide; the default prints every fragment step |
| Phones | a reading view or the PDF | when the deck must also be read on phones: the stage's type shrinks to about a fifth |

## 3. Core technique

### 3.1 The stage

```css
#stage { width: 1920px; height: 1080px; position: absolute; left: 50%; top: 50%; margin: -540px 0 0 -960px;
         transform: scale(var(--s, 1)); transform-origin: center; touch-action: pan-y pinch-zoom; }
```
```js
function fit() { document.documentElement.style.setProperty('--s', Math.min(innerWidth / 1920, innerHeight / 1080)); }
addEventListener('resize', fit); document.addEventListener('fullscreenchange', fit); fit();
```

After each fit, check that `document.elementFromPoint(innerWidth / 2, innerHeight / 2)` is inside the stage and warn
if not: a stage centred the wrong way fails silently. Assert the stage's position in tests, not only its size.

### 3.2 State, steps, keys, swipe

```js
function show(i, n) {            // (slide, step) is the whole state
  // clamp; data-state="current" on slide i, inert on every other; fragments with data-step <= n get .in;
  // live region "3 of 8: Title"; history.replaceState(null, '', '#/' + (i + 1) + (n ? '/' + n : '')); post to presenter
}
addEventListener('hashchange', () => show(...fromHash()));
addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.repeat) return e.preventDefault();          // a held key or a clicker's repeat must not skip slides
  // Right, PageDown, Space, Enter: next; Left, PageUp, Backspace: previous; Home, End; f fullscreen; s presenter
});
```

Swipe with Pointer Events on the stage: horizontal travel over 50 px, over 1.5 times the vertical, within 800 ms.
Fragments are `visibility: hidden` (no layout jump); slides off screen are `inert` as well as hidden. Full code:
[examples/deck.html](examples/deck.html); the reasons: [references/deck-craft.md](references/deck-craft.md).

### 3.3 Morph

Match `data-id` twins on neighbouring slides, measure with `offsetLeft/Top/Width/Height` summed to the slide (the
stage scale does not touch them), animate the new element from the old geometry with `transform-origin: 0 0`; skip
under reduced motion and on jumps of more than one slide.

### 3.4 Presenter view

`s` and a visible, focusable button open `deck.html?presenter#<hash>`. The windows exchange `{src: 'deck', t, i, n}`
with `postMessage`, each checking `event.source`; the presenter shows notes from `<aside class="notes">`, a timer,
Previous and Next that drive the audience window. Works on `file://` in every browser, which `BroadcastChannel` does
not (Firefox) and storage events do not (storage throws on `file://` in Firefox).

### 3.5 Print and the handout

```css
@page { size: 1920px 1080px; margin: 0 }
@media print { #stage { transform: none !important; position: static; margin: 0 }
  .slide { position: relative; width: 1920px; height: 1080px; visibility: visible !important; break-after: page;
           print-color-adjust: exact } .frag { visibility: visible !important } }
```

Prove it: `node scripts/deck-pdf.mjs deck.html -o deck.pdf` checks the page count against the slides and one page
shape (here 5 pages, 1440 by 810 pt). Then look at the PDF: filters and blend modes can change in print.

### 3.6 reveal.js and Marp in one file

```
node scripts/build-reveal.mjs slides.html -o deck.html --title "Talk" [--handout]   # reveal.js from the project's node_modules
npx marp --no-stdin deck.md --html -o deck.html                                     # always --no-stdin
```

`build-reveal.mjs` inlines everything with the notices, escapes `</script`, and adds the reduced-motion path reveal.js
lacks. Details, measured numbers and licences: [references/engines-and-export.md](references/engines-and-export.md).

### 3.7 Accessibility and design

Slides as `role="region"` with `aria-roledescription="slide"` and a numbered label; one polite live region; one `h1`;
decorative progress hidden; reduced motion turns builds and morphs into cuts. One idea per slide, about 40 words at
most on a talk slide, text 28 px or more on the canvas, a closed set of layouts, theme as tokens, fonts embedded and
ready before the first slide. More, and where HTML-Sensei differs from GOAT HTML:
[references/deck-craft.md](references/deck-craft.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Own-core deck: stage, steps, keys, swipe, morph, presenter, print, accessibility | [examples/deck.html](examples/deck.html), gate steps [examples/deck.steps.json](examples/deck.steps.json) | verified |
| reveal.js built into one offline file | [scripts/build-reveal.mjs](scripts/build-reveal.mjs), slides [examples/reveal-slides.html](examples/reveal-slides.html) | verified |
| Marp source | [examples/marp-deck.md](examples/marp-deck.md) | verified (HTML bundle) |
| PDF handout with a page-count check | [scripts/deck-pdf.mjs](scripts/deck-pdf.mjs) | verified |
| Self-tests | [scripts/test-deck.mjs](scripts/test-deck.mjs) (33), [scripts/test-reveal.mjs](scripts/test-reveal.mjs) (16), [scripts/test-marp.mjs](scripts/test-marp.mjs) (7), [scripts/test-deck-pdf.mjs](scripts/test-deck-pdf.mjs) (3); discovery [scripts/pw.mjs](scripts/pw.mjs) | verified |

## 5. Quality bars

- The stage rect equals the viewport at 16:9 and is letterboxed and centred at a square viewport (1000 by 1000: y
  218.75, height 562.5); the centre self-check passes.
- Every slide and step reachable by keyboard; Back, reload and a shared link land on the same `(slide, step)`; a held
  key does not skip.
- Swipe left and right move the deck on touch; pinch zoom still works.
- Exactly one slide not `inert`; the live region names each slide; axe-core with every rule: no violations.
- Reduced motion: no morph, no build transitions, reveal.js transitions off.
- The presenter window shows the right notes and drives the audience window, from `file://`.
- PDF: one page per slide (or per step, on purpose), one page shape, every fragment visible; the PDF looked at.
- No request at run time; fonts embedded; `sensei-verify`'s gate passes in strict `file://` with a steps file.
- Human bars no test proves: one idea per slide, legible from the back of the room, notes that are actually spoken.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | The deck sits 320 px right and 180 px down at 1280 by 720 (or off screen) | grid or flex centring of a 1920 px stage: the track grows to 1920, the item lays out at x = 0, then scales about its centre | negative margins or an explicit translate; assert the position and run the centre self-check | tested (research; a size-only assertion passed the bug) |
| 2 | Swipes do nothing on touch | default `touch-action`: the browser takes the gesture, sends `pointercancel`, never `pointerup` | `touch-action: pan-y pinch-zoom` on the stage; never `none` (it removes pinch zoom) | tested (events were pointerdown, pointercancel) |
| 3 | The morph flies to the wrong place at any scale but 1 | `getBoundingClientRect()` inside a scaled stage is scaled | `offset*` geometry, or divide by the scale | tested |
| 4 | Tab lands on links in hidden slides; a screen reader reads the whole deck | hidden by opacity or visibility only | `inert` on every slide but the current | tested |
| 5 | Layout jumps as steps appear | fragments with `display: none` | `visibility: hidden` | tested |
| 6 | The presenter window never syncs on `file://` in Firefox | `BroadcastChannel` (each local file is its own origin), or storage events (storage throws) | `postMessage` between opener and popup, `event.source` checked | reported (Firefox not run) |
| 7 | The presenter window does not open | popups need a user gesture; some embedded browsers block key-opened ones | a visible button as well as `s` | tested (button opens it) |
| 8 | A clicker or a held key skips two slides | repeated keydown events | ignore `e.repeat` | tested |
| 9 | The reveal.js handout has 10 pages for 7 slides | `?print-pdf` makes a page per fragment step (`pdfSeparateFragments` defaults to true) | `--handout` (sets it false): 7 pages | tested |
| 10 | `Reveal.getScale is not a function` | the global `Reveal` is the constructor; the API is on the instance | `const deck = new Reveal(config)`; `deck.getScale()` | tested |
| 11 | A link copied right after a key press is the old slide | reveal.js writes the hash after a debounce of about a second | wait for the hash, or read `deck.getIndices()` | tested |
| 12 | reveal.js slides still glide for reduced-motion users | reveal.js ignores `prefers-reduced-motion` | set `transition: 'none'`, `backgroundTransition: 'none'`, `autoAnimate: false` before `initialize()` (`build-reveal.mjs` does) | tested |
| 13 | A script or agent hangs on Marp with no output | without `--no-stdin`, a non-terminal stdin is read and waited on | always `--no-stdin` | tested (still waiting after 15 s) |
| 14 | A Marp deck has an extra first slide | a comment above the front matter makes the front matter a slide | comments inside the YAML front matter | found and tested while writing the example |
| 15 | An inlined library ends the page's script early | a literal `</script`, or `<!--` changing the parser state | escape both when inlining (`build-reveal.mjs`) | tested (closing tags equal parsed scripts) |
| 16 | The handout loses effects or fonts | `filter`, `backdrop-filter`, `mix-blend-mode` rasterise or vanish in print; late fonts | test the PDF, wait for `document.fonts.ready` | reported |
| 17 | A camera flight makes someone ill | impress.js moves the whole canvas | honour reduced motion by jumping | reported |
| 18 | impress.js styling broken if the script fails | it leaves `body.impress-not-supported` | test the no-script view | reported |
| 19 | The gate warns of two `h1` elements | a closing "Thank you" set as `h1` | one `h1`; later statements as large `h2` | found while gating the example |
| 20 | A test reads the scale or the self-check too early | resize and `requestAnimationFrame` work lands after a fixed wait on a software renderer | wait for the state (`waitForFunction`), not a timer | found while porting the tests |
| 21 | Text is unreadable on a phone | the 1920 stage scaled to 375 px wide is about a fifth: 44 px becomes about 9 px | a reading view or the PDF for phones | measured (arithmetic on the tested scale) |
| 22 | The deck dies on the venue wifi | fonts or images from a CDN (GOAT HTML's starter deck loads Google Fonts) | embed everything; the no-CDN lint when offline | reported (read in GOAT HTML) |

## 7. Licences

| Piece | Licence | Use |
|---|---|---|
| `deck.html`, `build-reveal.mjs`, `deck-pdf.mjs`, the tests and examples | HTML-Sensei's own code | ship in the plugin and in decks |
| reveal.js, its notes plugin (bundles marked) | MIT | inlined into a project's deck by the build with its notice; never vendored in the plugin |
| reveal.js theme fonts (Source Sans Pro, League Gothic and others) | SIL Open Font Licence | keep the notice when the deck is shared |
| Marp CLI, impress.js, bespoke, Slidev, Spectacle | MIT | in projects |
| Slides.com, Gamma, Canva, Figma Slides exports | proprietary | not ours to redistribute as templates |
| GOAT HTML (the owner's skill, MIT) | MIT | ideas read and restated in our own words; no code copied |

## 8. Verification

Run here (Windows 10, Node 24, playwright-core 1.62.1 with installed Chrome 155, axe-core 4.14.0, reveal.js 6.0.2,
@marp-team/marp-cli 4.5.1, strict `file://`): `test-deck.mjs` 33 of 33, `test-reveal.mjs` 16 of 16, `test-marp.mjs`
7 of 7, `test-deck-pdf.mjs` 3 of 3. `sensei-verify`'s gate on `examples/deck.html` with `examples/deck.steps.json`:
verdict pass, 21 checks, 11 scripted steps, axe clean three times; the contact sheet was looked at.

Not verified: Firefox and Safari (the `file://` and `BroadcastChannel` statements come from documentation and the
research); real touch hardware (swipes are synthesised through CDP); projectors, clickers and fullscreen
(`requestFullscreen` needs a gesture and was not asserted); the smoothness of morphs on real hardware; screen-reader
speech; Marp `--pdf` and `--pptx`; Slidev, Spectacle, PptxGenJS; reveal.js plugins other than notes.

## 9. Carried by

- Agent `sensei-deck-builder`: turns an outline or Markdown into a deck in the chosen engine with notes on every slide;
  runs `test-deck.mjs`-style checks (stage rect, keyboard walk), `deck-pdf.mjs` and the gate before reporting, and
  says what was not verified.
- Agent `sensei-reviewer`: the design lens (one idea per slide, legibility) and the accessibility lens; never edits.
- Hooks: `lint-web.mjs` (reduced motion per animation system, network references when offline, vendored code without
  a notice, drag without keys); `guard-process.mjs`; `gate-claim.mjs` (no "done" without a fresh passing gate report);
  `keep-eol.mjs`; `probe.mjs` (finds Chrome and Playwright).
