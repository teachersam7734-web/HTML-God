# Kinetic type recipes in depth

All recipes run in [../examples/kinetic.html](../examples/kinetic.html) and are asserted by
[../scripts/test-typography.mjs](../scripts/test-typography.mjs). Eases and durations for any of them come from
`sensei-motion-graphics` (`references/eases-and-durations.md`); UI timing and springs from `sensei-motion-ui`.

## 1. Split and stagger (`splitkit.js`)

```js
splitText(el, { by: 'words' | 'chars' | 'lines', cursive: 'words' | 'zwj' | 'inline', lines: false, resplit: true })
// returns { words, chars, lines, revert(), resplit(), isCursive }
```

- Output: `.sk-sr` (the real text, visually hidden, read once) and `.sk-vis` (`aria-hidden`), with `.sk-w` words and
  `.sk-c` characters, each carrying `--i` (running index), and `--l` (line) with `by: 'lines'`.
- The stagger is pure CSS: `animation-delay: calc(var(--i) * 55ms)`. No script loop at all.
- The visually hidden copy was chosen over `aria-label` on a generic container, which is not reliably announced (ARIA
  guidance, not tested with a screen reader). The ARIA tree reads the sentence once (tested with Playwright's ARIA
  snapshot; that is the tree, not speech).
- `by: 'lines'` measures `offsetTop` of word spans, writes `--l`, and re-splits on width change (ResizeObserver) and
  after `document.fonts.ready`; the re-split on resize was not exercised visually.
- Under reduced motion every unit is visible at time zero (tested). Add a print reset too: the example's `@media
  print` shows everything (scroll-driven and delayed reveals leave text at opacity 0 in print and full-page captures).

## 2. Scramble (`kinetickit.js`)

`scrambleAt(final, t, { charset, duration, stagger, tick, seed, from })` returns the string at time `t` (ms). Seeded
(mulberry32), so frame N is identical on every run: required for a seek page or film. Spaces, ZWNJ and ZWJ are never
scrambled. `SETS.persian` holds real letters only (پ چ ژ گ ک ی included, no ZWNJ, no marks), so every intermediate
frame is valid shaped text (tested over 41 frames). Letters resolve in logical order, so in Persian the rightmost
resolves first.

`runScramble(el, opts)` drives it from `requestAnimationFrame`, measures the final text first and sets
`min-inline-size` so the box does not jump, and does nothing under reduced motion. In a film, call `scrambleAt` from
`seek(t)` instead.

## 3. Marquee (pure CSS)

```html
<div class="mq"><div class="mq-track">
  <ul><li>Skim</li><li>Scan</li></ul><ul aria-hidden="true"><li>Skim</li><li>Scan</li></ul></div></div>
```

```css
.mq { overflow: hidden; direction: ltr; }
.mq-track { display: flex; inline-size: max-content; animation: mq 24s linear infinite; }
.mq ul { display: flex; gap: 2.5rem; padding: 0 2.5rem 0 0; list-style: none; margin: 0; flex: none; }  /* padding, not a track gap */
@keyframes mq { to { transform: translateX(-50%); } }
.mq:hover .mq-track, .mq:focus-within .mq-track, .mq.paused .mq-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .mq-track { animation: none; flex-wrap: wrap; inline-size: auto; } .mq ul[aria-hidden] { display: none; } }
```

Lane: track 927.25 px, first list 463.625 px, so -50% is exactly one list. A flex `gap` between the two lists makes the
half-width wrong by half a gap and the loop jumps. Moving content that runs over five seconds needs a pause control
(WCAG 2.2.2); hover and focus pause is not enough for keyboard-only and touch users: the example has a visible button
with `aria-pressed` (tested).

## 4. Fluid type with `clamp()`

`kineticKit.fluid(18, 40, 360, 1440)` gives `clamp(1.125rem, 0.6667rem + 2.037vw, 2.5rem)`: 18 px at 360, about 29 px
at 900, 40 px at 1440 and above (tested). The rem term starts the slope from the user's base size.

Zoom shrinks the CSS viewport, so a vw-driven size falls as the user zooms. Lane measurement, physical size after zoom
over before (ideal equals the zoom factor):

| Rule | Base 1280 px: zoom 1.5, 2, 3 | Base 1920 px: zoom 1.5, 2, 3 |
|---|---|---|
| `clamp(18px, 3vw, 40px)` | 1.00, 1.00, 1.41 | 1.44, 1.44, 1.44 |
| generated rem plus vw (18 to 40) | 1.15, 1.29, 1.58 | 1.38, 1.51, 1.78 |
| flatter `0.875rem + 1.25vw` (18 to 40) | 1.23, 1.47, 1.93 | 1.18, 1.37, 1.74 |

No fluid rule truly doubles at 200% zoom (WCAG 1.4.4). Policy: body copy in plain `rem`; fluid sizes for display
headings only (large text); a flat slope; test by zooming. The "maximum at most 2.5 times the minimum" rule of thumb is
third-party and was not verified.

## 5. Wipe, text on a path, variable weight

See [persian-rtl.md](persian-rtl.md) (wipe and path, both directions) and [fonts.md](fonts.md) (fixed-box weight).

## 6. GSAP SplitText and other splitters

GSAP SplitText (free under GSAP's licence; `sensei-motion-ui` has the licence notes) splits by chars, words and lines
with masks and automatic re-split. Its `chars` mode wraps each character in an inline-block: on Persian that is the
+150 px, every-letter-isolated row of the matrix. On Arabic-script text split by words, or use `splitkit.js`. The same
applies to `split-type` and to React Bits text effects.
