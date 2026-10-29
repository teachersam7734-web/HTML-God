# Presentations & Decks: single-file slide systems

An HTML deck is a different genre: fixed-canvas design, keyboard-first navigation, fullscreen
delivery, and content that must survive a projector, a board room, and a screen share. The single
best ecosystem survey for this genre is `ToseaAI/awesome-html-slide-skills` (20+ skill packages,
Tier-S: `zarazhangrui/frontend-slides`, `alchaincyf/huashu-design`, `op7418/guizang-ppt-skill`,
`nicobailon/visual-explainer`, `lewislulu/html-ppt-skill`, `1weiho/open-slide`): the patterns
below are distilled from what all of them share.

---

## §1 · The fixed-canvas rule (the one non-negotiable)

Slides are **authored at a fixed logical size and scaled, never reflowed**. Reflow is how decks
break on the presenter's 1366×768 laptop after looking perfect on your 4K monitor.

```css
#deck { width: 1920px; height: 1080px; transform-origin: top left; }
/* JS: scale = min(innerWidth/1920, innerHeight/1080) */
#deck.style.transform = `scale(${scale})`;
/* center when aspect differs: translate the leftover space */
```

- Author everything in px against 1920×1080 (or 1280×720 for lighter decks). The type scale,
  spacing, and layout are *pixel-stable by construction*: this is why decks look designed while
  responsive pages look generated.
- **Never centre the oversized canvas with grid/flex `place-items:center`.** A child larger than
  its container centred unreliably in real Chromium testing and left the entire deck off-screen
  while fixed chrome still rendered. Explicit arithmetic translate is deterministic:

```js
function fit(){
  const s = Math.min(innerWidth/1920, innerHeight/1080);
  const ox = (innerWidth - 1920*s)/2, oy = (innerHeight - 1080*s)/2;
  deck.style.transform = `translate(${ox}px,${oy}px) scale(${s})`;   // origin: top left
}
```

- Add a one-line **self-check** that fails loudly instead of silently: after boot and every fit,
  `document.elementFromPoint(innerWidth/2, innerHeight/2)` must land inside the deck: if not,
  `console.warn` (this gate is built into `assets/starter-deck.html`).
- Re-run the scale on `resize` and after `fullscreenchange`.
- `body { overflow:hidden }` always; print stylesheet (§7) is the only escape from the canvas.

## §2 · Slide anatomy & navigation

- One `<section class="slide">` per slide; `.slide { display:none } .slide.on { display:grid }`.
  Optional: 3D slide-over-slide transitions (`transform: translateX(-100%)` neighbours, perspective
  on the deck): but crossfade or instant cuts read cleaner than clever transitions on projectors.
- State in the hash (`#5`) so refresh and share-links land on the right slide; `hashchange` renders.
- Keyboard is the primary interface:

| Key | Action |
|---|---|
| → / Space / PgDn / click zones | next |
| ← / PgUp | previous |
| Home / End | first / last |
| `P` | presenter mode |
| `F` | fullscreen (`document.documentElement.requestFullscreen()`) |
| `G` | slide grid overview |
| number + Enter | jump to slide N |

`G` (grid overview) and number + Enter are worth adding to a long deck; the starter does not
build them. Ignore keys with Ctrl, Alt or Meta held, in form fields, and Space or Enter on a
focused button; ignore a repeated keydown (`e.repeat`), or a held key skips slides.

- Touch: swipe with Pointer Events, accepted on `pointerup` when the horizontal travel is over
  50 px, over 1.5 times the vertical, within 800 ms. The stage needs `touch-action: pan-y
  pinch-zoom`, or the browser takes the gesture and sends `pointercancel`; never `touch-action:
  none` on the page (it removes pinch zoom). Click zones: left third = back, right two-thirds =
  forward (ignore clicks on links and controls).
- Visible Previous and Next buttons as well: keyboard and touch users get a target, and the
  deck has something to focus.
- Deep-linkable fragments: `#5/pieces` reveals build steps within a slide one keypress at a time.

## §3 · Presenter mode (the signature pro feature)

A second, always-on-top window driven by the same file:

```js
const p = window.open('', 'presenter', 'width=960,height=700');
p.document.body.innerHTML = `
  <div id="prev"></div><div id="cur"></div><div id="next"></div>
  <div id="notes">${slide.dataset.notes}</div>
  <div id="clock"></div><div id="progress">5 / 24</div>`;
```

- Prev/current/next thumbnails (clone slide nodes into thumbnails, scale 0.15), speaker notes from
  a `data-notes` attribute on each slide (150 to 300 words per slide is the shipped norm), an elapsed
  timer, and a progress fraction.
- Sync with `postMessage` only, tagged (`{src:'deck'}`) and checked by `event.source`. Not
  `BroadcastChannel` (Firefox treats each `file://` page as its own origin, so a channel never
  connects) and not `localStorage` events (storage can throw on `file://`). The presenter's
  Previous and Next drive the audience window, which echoes its state back.
- Presenter mode is about 60 lines in `assets/starter-deck.html` and turns "HTML thing" into
  "real presentation tool". Open it from a key press or click (popup blockers).
- Deeper (thumbnails, morphs between slides, steps): `html-sensei:sensei-presentations`.

## §3b · Accessibility and reduced motion (built in, not added)

- Each slide: `role="region"`, `aria-roledescription="slide"`, `aria-label="3 of 8: Title"`.
- Only the current slide is not `inert`: Tab never lands on hidden content and a screen reader
  does not read the whole deck.
- A visually hidden `aria-live="polite"` region says "3 of 8: Title" on each change.
- The progress bar and the page number are decorative (`aria-hidden`).
- Reduced motion: slide entrances and the progress transition become instant; navigation is
  identical.

## §4 · Design system for decks (what the Tier-S skills share)

- **One anchor colour, brutal type contrast.** The guizang/swiss school: a single high-saturation
  anchor + hairline rules + extreme scale jumps (12px labels vs 120px statements). One idea per
  slide, stated as a sentence, not a title plus five bullets.
- **Theme as token swap.** Ship themes as `:root` token sets (16 to 36 is normal in the wild) and let
  the deck's personality be data, not code. Tokens: `--bg --ink --dim --accent --accent2 --line
  --font-d --font-b --radius`.
- **Layouts are a small closed set** reused across slides: title, statement, split, image-full,
  quote, comparison, data, code, grid-of-cards, big-number. 10 to 12 layouts cover 95% of decks.
- **Show, don't tell (frontend-slides' philosophy):** for style-sensitive briefs, generate 2 to 3
  *visual* direction previews and let the user pick, rather than interrogating them with questions.
- **Density discipline:** ≤ 40 words per slide for talks; decks for reading (leave-behinds) may run
  denser but then need the print stylesheet (§7) more than the projector.

## §5 · Content patterns that elevate decks

- **The big-number slide:** one stat at about 380px on the 1920 canvas, label beneath, source in
  the footer. Earned restraint. (Size type in canvas px, never `vw`: the canvas is scaled, so
  viewport units break the fixed-canvas rule.)
- **The statement slide:** 6 to 12 words at 150 to 190px. Used 3 to 5 times per deck as chapter beats.
- **Inline SVG diagrams over screenshots:** crisp at any scale, themeable via `currentColor`, and
  they keep the file dependency-free. (visual-explainer's specialty.)
- **Code slides:** JetBrains Mono, syntax colour via 3 spans (base/keyword/string): no highlighting
  library needed for 10-line snippets; max ~14 lines per slide.
- **Speaker notes are content:** write them per slide even if presenter mode never opens; they
  force the "one idea per slide" discipline.

## §6 · Deck-specific pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Perfect locally, cropped on the projector | reflow instead of fixed canvas | §1 scale transform |
| Deck blank/invisible but chrome visible | grid-centring an oversized canvas | §1 arithmetic translate + elementFromPoint self-check |
| Fonts flash mid-presentation | late font load | preload critical weights; `document.fonts.ready` before first paint of slide 1 |
| Double-keypress skips slides | keydown repeats | guard `e.repeat`, or throttle 250ms |
| Fullscreen shows scrollbars | body margins / overflow | §2 `overflow:hidden` + `margin:0` |
| Presenter window blocked | popup blocker | open on the first keypress (user gesture), not on load |
| Slides drift out of order after refresh | state in memory only | hash-based slide index |
| Deck dies offline | Google Fonts + remote images | embed fonts and images; no request at run time (`media-embedding.md` §4): decks are the classic "must work on the venue wifi" case |
| Swipe does nothing on a phone | browser took the gesture (`pointercancel`) | `touch-action: pan-y pinch-zoom` on the stage (§2) |
| Presenter window never updates in Firefox from a file | `BroadcastChannel` or `localStorage` sync | `postMessage` only (§3) |

## §7 · Print & PDF export

Decks double as leave-behinds with one stylesheet:

```css
@page { size: 1920px 1080px; margin: 0; }
@media print {
  html, body { height: auto; overflow: visible; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  #deck { position: static; transform: none !important; width: 1920px; height: auto; }
  .slide { display: flex !important; position: relative; width: 1920px; height: 1080px;
           animation: none !important; break-after: page; }
  .slide:last-child { break-after: auto; }   /* no blank page at the end */
}
```

Size slides in canvas pixels, not `100vw` by `100vh`: viewport units in print follow the printer
page, not the canvas. Verified 2026-10-27 with `assets/starter-deck.html` in Chrome (print to PDF):
3 slides gave exactly 3 pages of 1440 by 810 pt (1920 by 1080 px); without the `:last-child` rule
a blank fourth page appeared. Firefox and Safari not verified. Still check Print Preview before
shipping.
