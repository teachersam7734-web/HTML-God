# Deck craft: the stage, steps, morphs, presenter view, accessibility, design

Sources: `domain-presentations.md` in the HTML-Sensei build project's research notes (not shipped) sections 3 and 5; this skill's `examples/deck.html` and its
tests; ideas from the owner's earlier GOAT HTML skill (`references/presentations.md` and `assets/starter-deck.html`,
read on 2026-10-25), restated here in our own words and code, with the points where HTML-Sensei differs marked.

## The stage

A deck is a state machine of `(slide, step)` drawn on a fixed 1920 by 1080 CSS px stage, scaled to the screen, never
reflowed: the type scale, spacing and layout stay exactly as designed on the venue laptop, the projector and the 4K
monitor alike.

```css
#stage { width: 1920px; height: 1080px; position: absolute; left: 50%; top: 50%; margin: -540px 0 0 -960px;
         transform: scale(var(--s, 1)); transform-origin: center; touch-action: pan-y pinch-zoom; }
```
```js
function fit() { document.documentElement.style.setProperty('--s', Math.min(innerWidth / 1920, innerHeight / 1080)); }
addEventListener('resize', fit); document.addEventListener('fullscreenchange', fit); fit();
```

Two shapes centre it correctly: the negative margins above, or an explicit `translate(ox, oy) scale(s)` with
`transform-origin: top left` (GOAT HTML's choice; equivalent). Grid or flex centring does not: the 1920 px item widens
its track, lays out at x = 0 and scales about its own centre, 320 px right and 180 px down at 1280 by 720. A one-line
self-check after each fit (`document.elementFromPoint(innerWidth / 2, innerHeight / 2)` must be inside the stage)
fails loudly instead of silently; `deck.html` sets `window.__centred` and warns in the console.

A CSS-only fit exists: `tan(atan2(100vw, 1920px))` is the unitless ratio, so `calc(tan(atan2(100vw, 1920px)) * 1080px)`
is 720 px at 1280 wide (verified in Chromium).

On a phone a 1920 canvas shown at 375 px wide is scaled to about a fifth: 44 px body text becomes about 9 px. A deck is
for a screen in a room; if it must also be read on phones, offer a reading view (the slides as a scrolling page) or a
PDF, rather than shrinking the stage's type.

## Steps, hash and keys

- `show(i, n)` clamps, marks the current slide, makes every other slide `inert`, paints fragments, writes the hash
  (`#/2/1` is slide 2, step 1) with `replaceState`, and posts the state to the presenter window. `hashchange` calls it
  too, so Back and shared links work.
- Fragments carry `data-step`; several can share one. Previous from step 0 lands on the last step of the slide before.
- Fragments are `visibility: hidden`, not `display: none`, so the layout does not jump as they appear.
- Keys: Right, Page Down, Space, Enter next; Left, Page Up, Backspace previous; Home, End; `f` fullscreen; `s`
  presenter. Ignore them with Ctrl, Alt or Meta held, in form fields, and Space or Enter on a focused button. Ignore a
  repeated keydown (`e.repeat`): a held key or a clicker's repeat otherwise skips slides (GOAT HTML's point; tested).
- Swipe with Pointer Events: accept on `pointerup` when the horizontal travel is over 50 px, over 1.5 times the
  vertical, within 800 ms; ignore presses that start on a link or a control. Without `touch-action: pan-y pinch-zoom`
  the browser takes the gesture and sends `pointercancel`, so `pointerup` never arrives. Never `touch-action: none`
  on the page: it removes pinch zoom.

Further controls worth adding when the deck is long (GOAT HTML ideas, not built or tested here): an overview grid on
`g`, a number then Enter to jump, click zones (left third back, the rest forward) with cursor hints.

## Morph between slides (auto-animate without a library)

Elements on neighbouring slides that share `data-id` are matched. Measure both with `offsetLeft/Top/Width/Height`
summed up to the slide (they ignore the stage's scale; `getBoundingClientRect()` returns scaled pixels and breaks FLIP
at any scale but 1), then animate the new element from the old geometry:

```js
t.animate([{ transform: `translate(${a.x - b.x}px,${a.y - b.y}px) scale(${a.w / b.w},${a.h / b.h})`, backgroundColor: a.bg, transformOrigin: '0 0' },
           { transform: 'none', backgroundColor: b.bg, transformOrigin: '0 0' }], { duration: 600, easing: 'cubic-bezier(.2,.7,.2,1)' });
```

Skip it under reduced motion and when jumping more than one slide. Measured: the first keyframe is `translate(-900px,
...)` at a stage scale of two thirds, and the box ends on its exact layout rectangle. View Transitions are the other
route (`sensei-transitions`); FLIP is used here because it needs no snapshot layer over a scaled stage. Never carry
meaning in the morph alone.

## Presenter view

`s` or a real button (popups need a user gesture, and some embedded browsers block a key-opened one) opens
`deck.html?presenter#<hash>`. The two windows talk with `postMessage` and check `event.source` and a `src: 'deck'`
tag. Not `BroadcastChannel`: Firefox treats each `file://` page as its own origin, so a channel never connects. Not
`localStorage` events either (GOAT HTML offers them): storage throws on `file://` in Firefox. The presenter shows the
notes (`<aside class="notes">`, hidden in the audience view), a timer, and Previous and Next that drive the audience
window, which echoes its state back. Thumbnails of the previous, current and next slides are a good addition (clone the
slide, scale it to about 0.15).

Notes are content: write them for every slide even when the presenter view never opens. They force one idea per slide.

## Accessibility

- Each slide: `role="region"`, `aria-roledescription="slide"`, `aria-label="3 of 8: Title"`.
- Only the current slide is not `inert`: Tab never lands on hidden content and a screen reader does not read the deck.
- A visually hidden `aria-live="polite"` region inside the main landmark says "3 of 8: Title" on each change.
- The progress bar and the slide counter are decorative (`aria-hidden`).
- One `h1` in the document; later big statements are `h2` styled large (the gate warns on two).
- Captions on any video; nothing carried only by motion or colour; forced colours keep the stage's edge.
- axe-core with every rule on, three times: zero violations (`test-deck.mjs`, the gate).

## Design

- One idea per slide, stated as a sentence. A talk slide carries about 40 words at most; a leave-behind for reading
  may be denser, and then the PDF matters more than the projector.
- Text at least 28 px on the 1920 canvas (about 19 px at 1280 wide); body copy 44 px in `deck.html`.
- A small closed set of layouts covers almost every deck: title, statement, split, full image, quote, comparison, big
  number, chart, code, grid of cards. Build them once as classes.
- Theme as a token swap on `:root` (`--bg --fg --dim --accent --line --font-display --font-body --radius`); tokens
  and contrast: `sensei-tokens-theming`.
- Strong contrast of scale: small spaced labels against very large statements; a single anchor colour.
- Diagrams as inline SVG with `currentColor`: crisp at any scale and themeable. Charts: `sensei-dataviz`.
- Code slides: a monospace face, three spans of colour are enough for ten lines, at most about 14 lines.
- Fonts embedded and loaded before the first slide is shown (`document.fonts.ready`): a font that swaps mid-talk is
  visible to the room. Embedding: `sensei-typography`.
- Transitions: crossfades or cuts read better on projectors than clever 3D moves; every one has its reduced-motion
  path.

## Where HTML-Sensei differs from GOAT HTML's deck advice (reported to the coordinator)

| GOAT HTML | HTML-Sensei | Why |
|---|---|---|
| starter deck loads its fonts from Google Fonts | fonts embedded; no request at run time | decks are the classic venue-wifi case; the no-CDN rule when offline |
| presenter sync "by postMessage or localStorage events" | `postMessage` only | storage throws on `file://` in Firefox |
| print CSS sizes slides at `100vw` by `100vh` | slides at 1920 by 1080 px under `@page { size: 1920px 1080px }` | explicit pixels gave exactly one 16:9 page per slide here; the viewport-unit version was not tested |
| starter deck has no reduced-motion path, no `inert`, no slide roles, no `touch-action` | all four built in | doctrine 5; the swipe trap |
| presenter mode described with a line "budget" | no budgets | doctrine 1 |
