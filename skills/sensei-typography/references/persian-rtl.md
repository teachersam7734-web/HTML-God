# Persian, Arabic script and right to left: the measured rules

Everything marked tested was run in headless Chrome (the UI research lane, then again for this skill with
`scripts/test-typography.mjs`) with Vazirmatn. Firefox and Safari were not available: every cross-engine statement is
marked not verified.

## 1. The splitting matrix

Lane measurement: `سلام دنیا، یادگیری زبان انگلیسی`, Vazirmatn, 40 px, against the unsplit string. This skill's test
repeats it on `یادگیری خواندن کارآگاه`, Vazirmatn 700, 40 px.

| Technique | Width change | Joining kept? | Notes |
|---|---|---|---|
| No split | 0 | yes | baseline |
| **Per character, `display: inline-block`** | **+150 px** (lane); **+93.6 px** (this skill's string) | **no: every letter isolated** | what a default per-character splitter (GSAP SplitText `chars`, React Bits text effects) produces |
| Per character, plain inline span | +0.2 px (lane), 0.12 px (here) | yes | Chrome shapes across inline span boundaries |
| Inline span plus colour, opacity, filter, background, `will-change`, `position: relative`, `contain: paint` | +0.2 px | yes | none broke joining in Chrome |
| Inline span plus `transform` | +0.2 px | yes, but **the transform does nothing** (0 px movement, tested twice) | inline boxes cannot be transformed |
| Per word, inline-block | +0.1 px (lane), 0 (here) | yes | the safe default for movement |
| Per character inline-block **with zero width joiners** (U+200D only between letters that connect) | 0 to 0.7 px (lane), 0.12 px (here) | yes (2,284 sub-pixel differing pixels of about 34,000) | movable per-letter boxes; needs the join table |
| `letter-spacing: .08em` | +11 px (spaces only) | yes in Chrome, which does not space inside joined letters | Firefox and Safari not verified: keep 0 on Persian |

Rules:

1. Persian and Arabic default to **word** splitting. `splitkit.js` does it automatically when `by: 'chars'` meets
   Arabic-script text (`cursive: 'words'`, tested: same width as words).
2. Per-letter movement only with `cursive: 'zwj'`: U+200D after a dual-joining letter followed by a letter, and before
   a letter that follows one; never before the first letter of a word; the right-joining letters
   (ا آ أ إ د ذ ر ز ژ و ؤ ة) never get a trailing joiner.
3. Per-letter opacity, colour or blur only: `cursive: 'inline'` (plain inline spans).
4. Spaces stay as text nodes between units: a lone space inside an inline-block collapses and words fuse (the lane's
   first joiner attempt lost every space).
5. Per-character inline-blocks may wrap inside a word (a lone final letter dropped to the next line): the word wrapper
   gets `white-space: nowrap`.
6. GPOS cursive attachment and kerning are not applied across inline-block boundaries. Vazirmatn has no `curs`
   feature, so it matched; another face might not. Compare widths (or a screenshot) against the unsplit text for any
   new face.

## 2. Direction-dependent motion

- **Wipes**: `clip-path: inset()` has no logical keywords. Swap the hidden edge per direction through a custom property
  (`--from: inset(0 100% 0 0)`, and `inset(0 0 0 100%)` under `[dir=rtl]`). Tested at mid-time: LTR hides the right,
  RTL the left. The lane's own first draft had both directions wrong. A mask reveal is the shaping-safe way to animate
  a Persian line: it is shaped once, whole.
- **Marquee**: keep the container `direction: ltr` so `translateX(-50%)` means one copy, and put `dir="rtl"` on each
  list so items and letters order correctly. Tested seamless in both.
- **Text on an SVG path** (lane, six variants; this skill re-tested the recipe):

| Setup | Result |
|---|---|
| path drawn left to right, no `direction`, Persian | works: joined, curved, bidi orders the run |
| same path, `direction="rtl"` | text starts left of the path start: invisible (lane); here the box measured x -12, width 24: effectively gone |
| path drawn right to left | upside down |
| `direction="rtl"` plus `startOffset="100%"` | works |
| left-to-right path, `startOffset="50%" text-anchor="middle"` | works, simplest: **use this** (tested here: x 248, width 304 in an 800 frame) |

  Do not rely on `letter-spacing` inside `textPath` for Persian.
- **Mirror** arrows, chevrons, progress bars, parallax tilt and any "from the start" motion; use logical properties
  (`inline-start`, `margin-inline`, `padding-inline`, `inset-inline`) everywhere else.

## 3. Type rules

1. `letter-spacing: 0` on Persian (`:lang(fa) { letter-spacing: 0 }`).
2. `text-transform: uppercase` does nothing for Persian: no effects that rely on it.
3. Leading: about 1.6 to 1.8 for body and 1.4 to 1.55 for headings; Latin display leading (1.0 to 1.1) clips marks.
4. Italic is not a Persian style (browsers fake it by slanting): avoid `font-style: italic` in Persian (general
   knowledge, not tested).
5. Mixed runs: wrap Latin or numbers inside Persian in `<bdi>` or `unicode-bidi: isolate`; punctuation at the edge of an
   embedded run moves visually.
6. Typewriter effects that append letters re-shape the last letters every step (initial becomes medial): use a mask
   reveal instead.
7. Justification: Chrome does not stretch with kashida; justified Persian can show wide gaps (not tested).
8. **Monospace stacks**: with `monospace` alone, Persian fell into a fixed-pitch face with broken joins (lane). Put the
   Persian face after the mono faces: `ui-monospace, Consolas, "Vazirmatn", monospace` (tested here: Chrome drew the
   Latin with Consolas and the Persian with Vazirmatn).
9. **Drop caps are a Latin convention**: restrict `::first-letter` to `:lang(en)` (the Persian first letter "ا" became
   a huge bar in the lane's first draft). Tested here: the English drop cap grows, the Persian first letter stays body
   size.
10. **Digits**: Vazirmatn's `ss01` turns Latin digits into Persian ones (tested as pixels); `locl` with `lang="fa"`
    picks the Persian forms of ۴ ۶ ۷ (they differ from the Arabic-Indic forms). Put `lang="fa"` on the element, not only
    on `<html>`, when languages mix. Dashboards: `font-variant-numeric: tabular-nums`.
11. **Gradient text on split words**: `background-clip: text` on a parent does not paint through split inline-block
    children (the emphasised words vanished). Put the gradient on each word (tested here).
12. 3D text: troika draws Persian unjoined and rejects woff2; use the browser-shaped canvas label recipe in
    `sensei-3d`.

## 4. Use cases

| Use case | Use | Avoid |
|---|---|---|
| Landing hero | word reveal, per-word gradient emphasis, fluid display heading, marquee of names | per-letter scramble on the main promise |
| Course (Ultra Bookworm) | mask reveal and word stagger for new screens; still lesson text | motion on passages the learner must read; per-letter effects on Persian |
| Presentation | one scrambled reveal word; text on a path for a badge | long marquees |
| Game | seeded scramble and glitch for UI barks, replays match | weight animation on large blocks |
| Film (seek page) | `scrambleAt(t)`, reveals driven by t, no timers (`sensei-motion-graphics`) | an unseeded scramble on `requestAnimationFrame` |
| Dashboard | tabular numerals, count-up | kinetic headings |
