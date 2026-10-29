---
name: sensei-typography
description: Kinetic typography and fonts for HTML-Sensei projects, with Persian and right-to-left as first-class. Splitting text for reveals without breaking Persian or Arabic joining (words, zero width joiners, inline spans), seeded scramble and decode, seamless marquees with a pause control, wipes that run from the right edge in RTL, Persian text on an SVG path, variable-weight animation in a fixed box, fluid type that survives zoom; font subsetting and base64 embedding for one offline file with a coverage check that catches missing Persian letters and lost joining features; digits, bidi, monospace stacks, drop caps and leading for Persian. Use when someone says kinetic type, text animation, split text, SplitText, letter by letter, scramble, decode, typewriter, marquee, ticker, text on a path, variable font, font weight animation, fluid type, clamp, font, embed a font, subset, woff2, Persian, Farsi, Arabic, RTL, right to left, Vazirmatn, Persian digits, or "the Persian letters are broken".
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-typography

Type that moves must still read. For Persian and Arabic the rule under every recipe is: shape the text whole, move it
by word, mask it, or give each letter a joiner; never wrap letters in inline-blocks. Fonts travel inside the file,
subset so that every letter of the real text is covered, with their licence.

## 1. When to use

Any text effect in a page; choosing, subsetting and embedding fonts; any Persian, Arabic or mixed-direction text.

Another skill owns it instead:

| Request | Skill |
|---|---|
| Eases, durations, kinetic type inside a film, reading-time gate | `sensei-motion-graphics` |
| UI motion timing, springs, GSAP and Motion set-up, the reduced-motion gate | `sensei-motion-ui` |
| Scroll-driven reveals and pinning | `sensei-scroll` |
| 3D text (troika, browser-shaped labels for Persian) | `sensei-3d` |
| Type scale and font tokens within a theme | `sensei-tokens-theming` |
| Choosing the typeface for a direction | `sensei-direction` |
| Packing the font and scripts into one file | `sensei-single-file` |
| Text components from React Bits | `sensei-ui-components` (and the splitting rules here) |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Split unit, Latin | words, characters, lines | words for reading text; characters for one short display line; lines for paragraph reveals |
| Split unit, Persian and Arabic | words (default); letters with joiners (`cursive: 'zwj'`); letters as inline spans (`cursive: 'inline'`); a mask, no split | movement: words; per-letter movement is a hard requirement: joiners; per-letter fade, colour or blur only: inline spans; a whole line: mask |
| Splitter | `splitkit.js`; GSAP SplitText; none | `splitkit.js` for anything that may meet Arabic script; SplitText by words on Persian only |
| Reveal | stagger by `--i` in CSS; a mask (`clip-path`) wipe | stagger for words; wipe for whole lines and Persian |
| Scramble | `scrambleAt(t)` from a seek; `runScramble` live; none | films and replays: `scrambleAt` with a seed; one live reveal word: `runScramble`; never on the main promise |
| Marquee | pure CSS track; none | decoration or a list of names; add the pause button when it runs over five seconds |
| Weight motion | `font-weight` keyframes in a fixed box; none | one or two headings; never body text |
| Size | `rem`; `clamp()` rem plus vw | body in rem; display headings fluid with a flat slope |
| Font file | variable subset; static subset; Latin only | variable when weight animates or several weights are used; static for one weight; no budget either way |
| Font delivery | base64 `@font-face`; sibling woff2 for a site; never a font CDN | single file: base64; site: a file; offline: no `https://` |

## 3. Core technique

### 3.1 Split without breaking joining

```html
<p class="rv" lang="fa" dir="rtl" id="t">یادگیری خواندن مانند یک کارآگاه</p>
<script src="splitkit.js"></script>
<script>splitText(document.getElementById('t'), { by: 'words' });   // by:'chars' on Persian falls back to words</script>
<style>
.sk-sr { position: absolute !important; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.rv .sk-w, .rv .sk-c { display: inline-block; white-space: nowrap; opacity: 0; transform: translateY(.55em);
  animation: in .8s cubic-bezier(.22,1,.36,1) both; animation-delay: calc(var(--i) * 55ms); }
.rv .sk-w.sk-wkeep { display: inline; opacity: 1; transform: none; animation: none; }   /* word wrapper when letters move */
.rv .sk-c.sk-inl { display: inline; transform: none; animation-name: fade; }            /* inline spans cannot move */
@keyframes in { to { opacity: 1; transform: none; } }  @keyframes fade { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .rv .sk-w, .rv .sk-c { animation: none; opacity: 1; transform: none; } }
</style>
```

The splitter keeps one real copy (`.sk-sr`) for assistive technology and marks the moving copy `aria-hidden`; spaces
stay as text between units; every unit gets `--i`; `revert()` restores the text. Measured here: words 0 px, letters with
joiners 0.12 px, inline letters 0.12 px against the unsplit width; naive per-letter inline-blocks +93.6 px with every
letter isolated. Full matrix and rules: [references/persian-rtl.md](references/persian-rtl.md).

### 3.2 Direction-aware motion

```css
.wipe { --from: inset(0 100% 0 0); clip-path: var(--from); animation: wipe 1s var(--ease) forwards; }
[dir="rtl"] .wipe { --from: inset(0 0 0 100%); }        /* clip-path inset() has no logical keywords */
@keyframes wipe { from { clip-path: var(--from); } to { clip-path: inset(0); } }
.mq { overflow: hidden; direction: ltr; }  .mq[data-rtl] ul { direction: rtl; }   /* marquee mechanics stay LTR */
```

SVG text on a path: draw every path left to right and centre with `startOffset="50%" text-anchor="middle"`;
`direction="rtl"` on a left-to-right path makes the text vanish. Mirror arrows, progress and tilt; logical properties
everywhere else.

### 3.3 Fonts that travel

```
python -I ${CLAUDE_PLUGIN_ROOT}/skills/sensei-typography/scripts/fontembed.py Font.ttf "Family" [--weight 400] [--out f.woff2] [--ttf f.ttf] > face.css
python -I ${CLAUDE_PLUGIN_ROOT}/skills/sensei-typography/scripts/font-coverage.py f.woff2 page.html     # every character covered? joining features kept? licence records kept?
```

`fontembed.py` keeps the Persian letters and digits, ZWNJ and ZWJ, the joining and digit features, and the copyright
and licence name records; it subsets before narrowing the weight axis. `font-display: block` for embedded faces; the
weight range in `@font-face`; measure only after `document.fonts.ready`. Sizes, failures and licences:
[references/fonts.md](references/fonts.md). The plugin ships one face, Vazirmatn (OFL), as a Persian plus Latin
variable subset: `assets/vazirmatn-fa-latin.woff2` with `assets/OFL-Vazirmatn.txt` (also in the plugin's `LICENSES/`,
indexed in `LICENSES/README.md`). `sensei-landing-hero`'s example embeds it for its Persian text.

### 3.4 Persian type rules in one block

```css
:lang(fa) { letter-spacing: 0; line-height: 1.75; }                 /* headings about 1.4 to 1.55 */
.mono { font-family: ui-monospace, Consolas, "Vazirmatn", monospace; }   /* Persian face after the mono faces */
.essay p:lang(en)::first-letter { float: inline-start; font-size: 3.2em; }  /* drop caps: Latin only */
.fa-digits { font-feature-settings: "ss01"; }                       /* Vazirmatn: Latin digits drawn Persian */
```

`<bdi>` around Latin and numbers inside Persian; `lang="fa"` on the element when languages mix; no uppercase effects,
no italics, no typewriter (it re-shapes letters each step), no `background-clip: text` on a parent of split words (put
it on each word).

### 3.5 Scramble, marquee, weight, fluid

`kineticKit.scrambleAt(final, t, { seed, charset: kineticKit.SETS.persian })` is a pure function of time (films);
`runScramble(el)` reserves the final width and is static under reduced motion. Marquee: two copies, the second
`aria-hidden`, padding not gap between them, `translateX(-50%)`, a visible pause button. Weight: a grid with a hidden
weight-900 copy holds the box still. Fluid: `kineticKit.fluid(18, 40, 360, 1440)` for display headings only. Depth:
[references/kinetic-recipes.md](references/kinetic-recipes.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Every recipe on one page, English and Persian: split modes, per-word gradient, scramble, marquee with pause, wipes both ways, fixed-box weight, Persian on a path, digits, monospace, drop caps | [examples/kinetic.html](examples/kinetic.html) | verified, Chrome headless |
| Persian-safe splitter | [scripts/splitkit.js](scripts/splitkit.js) | verified |
| Seeded scramble, live scramble, fluid generator | [scripts/kinetickit.js](scripts/kinetickit.js) | verified |
| Subset and embed (Persian plus Latin), woff2 and TTF outputs | [scripts/fontembed.py](scripts/fontembed.py) | verified, fontTools 4.63 |
| Coverage check: missing characters, joining features, licence records | [scripts/font-coverage.py](scripts/font-coverage.py) | verified on a good and two bad subsets |
| The test of all of the above (46 assertions) | [scripts/test-typography.mjs](scripts/test-typography.mjs) with [scripts/pw.mjs](scripts/pw.mjs) | verified |
| Shipped face and its licence | [assets/vazirmatn-fa-latin.woff2](assets/vazirmatn-fa-latin.woff2), [assets/OFL-Vazirmatn.txt](assets/OFL-Vazirmatn.txt) | OFL, licence read |

## 5. Quality bars

- Persian split width within 1 px of the unsplit text, and a look at the rendered line for any new face or split mode.
- One real copy of every split text in the accessibility tree; the moving copy hidden.
- Reduced motion: all text visible at time zero, marquees static and wrapped, no running animation (tested here: 0).
- A marquee over five seconds has a visible pause control.
- `font-coverage.py` passes on every embedded face against the real text; no `https://` font URL; licence text and
  ledger row for each face.
- Measurements after `document.fonts.ready` only.
- Body text in rem; fluid sizes only for display text; zoom tested.
- RTL: wipes, marquee order, path text, arrows checked in both directions; Persian letter-spacing 0, leading 1.6 or more.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Persian letters fall apart, line grows (+150 px lane, +93.6 px here) | per-letter `inline-block` (SplitText `chars`, React Bits text effects, naive splitters) | split by word; `cursive: 'zwj'` for per-letter boxes; inline spans for fades | tested |
| 2 | Per-letter animation on Persian does nothing | inline spans cannot be transformed | animate opacity, colour or blur only on inline spans; joiners for movement | tested |
| 3 | Words fuse together after splitting | a lone space inside an inline-block collapses | spaces as text nodes between units | tested (lane) |
| 4 | A final letter wraps alone to the next line | per-letter inline-blocks allow breaks inside a word | `white-space: nowrap` on the word wrapper | tested (lane) |
| 5 | A joiner forces the wrong letter form | U+200D before the first letter of a word, or after a right-joining letter | the join table in `splitkit.js` | tested (lane) |
| 6 | A different face shows tiny gaps between split letters | GPOS cursive attachment and kerning are not applied across boxes | compare against the unsplit text for every new face | reported (Vazirmatn has no `curs`) |
| 7 | Gradient emphasis vanishes after splitting | `background-clip: text` on the parent does not paint through split children | gradient on each word | tested |
| 8 | An RTL wipe reveals from the wrong side | `clip-path: inset()` has no logical keywords | swap the edge per direction with a custom property | tested both directions |
| 9 | Persian text on a curve is invisible | `direction="rtl"` on a left-to-right path | left-to-right path, `startOffset="50%" text-anchor="middle"` | tested |
| 10 | Text on a curve is upside down | the path was drawn right to left | draw paths left to right | tested (lane) |
| 11 | The marquee jumps once per loop | a flex `gap` between the two copies | padding on each copy | tested |
| 12 | Marquee order wrong in Persian | container direction RTL changes what -50% means | container `direction: ltr`, each list `dir="rtl"` | tested |
| 13 | Keyboard and touch users cannot stop the marquee | hover and focus pause only | a visible pause button (WCAG 2.2.2) | tested |
| 14 | Text around a weight animation jitters | advance widths change with weight (146.1 to 155.2 px) | fixed box with a hidden weight-900 copy | tested |
| 15 | A variable font shows one weight only | `@font-face` without a weight range | `font-weight: 100 900` | tested (lane) |
| 16 | Persian letters in another font, mismatched | subset from the "Arabic" range only drops پ چ ژ گ ک ی and the digits | `fontembed.py` ranges; `font-coverage.py` names what is missing | tested |
| 17 | Every letter isolated after subsetting | an empty layout feature list | keep the joining features (`fontembed.py`); the coverage check flags it | tested |
| 18 | Line box 1 px taller, nothing visible | ZWNJ missing from the subset, a fallback face consulted | keep U+200C and U+200D | tested (lane) |
| 19 | `KeyError: '.notdef'` while subsetting | weight axis narrowed before subsetting (fontTools 4.63) | subset first, then instance | tested (lane) |
| 20 | The coverage check failed a good font | it required an `isol` feature; the isolated form is the default glyph and Vazirmatn has no `isol` | require `init`, `medi`, `fina` only | found while testing this skill |
| 21 | `UnicodeEncodeError` printing Persian on Windows | the console's legacy code page | the scripts force UTF-8 on stdout | found while testing this skill |
| 22 | Split lines or scramble width wrong on first load | measured before the font loaded | measure after `document.fonts.ready` | tested (lane) |
| 23 | Persian breaks in a code or terminal style | `monospace` alone falls into a fixed-pitch face with broken joins | Persian face after the mono faces | tested (lane; this skill confirmed the fixed stack) |
| 24 | A huge bar opens a Persian paragraph | a drop cap on "ا" | `::first-letter` only under `:lang(en)` | tested |
| 25 | Digits in the wrong script | no `ss01` or `locl`, or `lang` only on `<html>` | `ss01` for Latin input; `lang="fa"` on the element | tested |
| 26 | Letters re-shape at every typed step | a typewriter appends letters (initial becomes medial) | a mask reveal | reported (lane) |
| 27 | Text vanishes in print and full-page captures | delayed reveals and scroll-driven animations leave opacity 0 | print reset; `@supports` around scroll-driven reveals | tested (lane) |
| 28 | Text does not grow enough at 200% zoom | vw-driven sizes shrink with the CSS viewport | body in rem; fluid only for display, flat slope | measured (lane) |
| 29 | Marks clipped in Persian headings | Latin display leading 1.0 to 1.1 | 1.4 or more for headings, about 1.7 for body | reported (lane) |
| 30 | Persian 3D text unjoined, woff2 rejected | troika | `sensei-3d` canvas labels; `fontembed.py --ttf` for troika | tested (`sensei-3d`) |
| 31 | An offline file reaches the network for fonts | a Google Fonts link | download, subset, embed | reported (lane) |

## 7. Licences

- **Ships in the plugin**: `splitkit.js`, `kinetickit.js`, `fontembed.py`, `font-coverage.py`, the tests and the example
  (HTML-Sensei's own code); Vazirmatn subset with its OFL text (OFL allows redistribution with software; no Reserved
  Font Name is declared; the subset keeps the copyright and licence records).
- **In projects**: other faces after reading their licence files (Noto Arabic, Estedad, Sahel, Shabnam, Samim are
  believed OFL but were not checked); GSAP SplitText under GSAP's licence with its header (`sensei-motion-ui`); React
  Bits text effects fetched with their notice (`sensei-ui-components`).
- **Build tools the user installs**: fontTools (MIT) and brotli.
- Every face gets a ledger row: source, licence, version, `use: asset`, notice.

## 8. Verification

Run here (Windows 10, Node 24, installed Chrome with user agent 156 through playwright-core 1.64, strict `file://`;
Python 3.13 with fontTools 4.63):

- `test-typography.mjs`: 46 of 46 (splitting matrix, accessibility copy, revert, scramble determinism and Persian frames,
  live scramble, fluid sizes 18, 29, 40 px, fixed-box weight 155.2 px at both ends, marquee seam 0.00 px and pause
  button, wipe edges at mid-time in both directions, Persian on a path, ss01 digits, monospace stack, drop caps,
  reduced motion; then the coverage check on the shipped subset and on two bad subsets, `fontembed.py` CSS, woff2 and
  TTF outputs, the TTF loaded as a web font).
- `sensei-gate.mjs examples/kinetic.html`: PASS, 21 pass, 0 warn, 0 fail, axe 0 violations on three runs; the contact
  sheet was looked at: Persian joined at every width, forced colours readable.

Not verified: Firefox and Safari (shaping across spans, Persian letter-spacing, textPath with bidi, file-origin font
loading); screen-reader speech of the hidden copy; `by: 'lines'` re-split on resize; kashida justification; italics;
weight-animation frame cost on phones; faces other than Vazirmatn; Urdu, Pashto and Kurdish letters.

## 9. Carried by

- Agents: `sensei-art-director` (typeface choice, type scale within the direction), `sensei-interaction-engineer`
  (text motion in pages), `sensei-motion-director` (kinetic type in films, with `sensei-motion-graphics`),
  `sensei-course-builder` and `sensei-deck-builder` (Persian lessons and slides), `sensei-packager` (embedding faces),
  `sensei-reviewer` (accessibility lens: hidden copy, pause control, contrast of gradient text).
- Hooks: `lint-web.mjs` (PostToolUse: reduced motion per animation system, network references such as font CDNs when
  offline); `guard-licence.mjs` (blocks never-ship text-effect code written into plugin paths); `gate-claim.mjs` (Stop:
  fresh gate before a done claim). The research proposed hooks for Persian-unsafe splitting, Persian letter-spacing,
  subset commands, drop caps and monospace stacks in Persian files; they are not in the plugin's hooks yet, so this
  skill's coverage script and test carry those checks.
