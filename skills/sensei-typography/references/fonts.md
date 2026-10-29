# Fonts: subsetting, embedding, loading, licences

## 1. Sizes (Vazirmatn 33.003, woff2)

| Variant | Lane (bytes) | Re-run 2026-10-24 (bytes) | Base64 in the HTML |
|---|---|---|---|
| Original variable, full | 111,152 | 111,152 | about 148 KB |
| Persian plus Latin, variable (all weights), `fontembed.py` | 48,528 | 48,396 (this skill's `assets/vazirmatn-fa-latin.woff2`) | 64,528 |
| Same, weights 300 to 700 | 44,420 | 44,424 | 59,232 |
| Same, one static weight 400 | 20,084 | 20,124 | 26,832 |
| Latin only, variable | 22,860 | 22,824 | 30,432 |

The small differences between runs are encoder output; the conclusions hold. Limiting the weight range saves little; a
static instance saves most. Choose by design need, not size (no budget): the variable file when you animate weight or
use several weights. Weight is reported, never gated.

## 2. Subsetting failures (measured in the lane, rendered and compared with the full font)

| Mistake | Effect | Caught by |
|---|---|---|
| Unicode list only `U+0621-063A, U+0641-064A` (the "Arabic" range) | **پ چ ژ گ ک ی and the Persian digits fall back to another font**: visibly mismatched glyphs. Persian needs U+067E, 0686, 0698, 06A9, 06AF, 06CC, 06F0 to 06F9 | `font-coverage.py` names each missing letter (tested) |
| No U+200C (ZWNJ) | looks identical, but the line box grew 1 px (a fallback font is consulted for the invisible character). Keep U+200C and U+200D | `font-coverage.py` lists U+200C (tested) |
| Empty layout feature list | **every letter isolated**, string 130 px wider. Keep `init, medi, fina, isol, liga, rlig, calt, ccmp, locl, mark, mkmk, kern` | `font-coverage.py` reports missing joining features (tested) |
| `ss01` or `locl` dropped | Persian digit forms lost | keep them (`fontembed.py` does) |
| Subset after narrowing the weight axis | `KeyError: '.notdef'` (fontTools 4.63) | subset first, then instance (`fontembed.py` does) |

`isol` is optional in a font: the default glyph is the isolated form, and Vazirmatn has no `isol` feature. The
coverage script requires `init`, `medi` and `fina` (it wrongly required `isol` in its first version: found by testing).

## 3. The pipeline

```
pip install fonttools brotli                                     # build time only
python -I ${CLAUDE_PLUGIN_ROOT}/skills/sensei-typography/scripts/fontembed.py Font.ttf "Family" [--weights 300:700 | --weight 400] [--latin-only] \
       [--out family.woff2] [--ttf family.ttf] > face.css
python -I ${CLAUDE_PLUGIN_ROOT}/skills/sensei-typography/scripts/font-coverage.py family.woff2 page.html [--text "text set by script"]
```

`fontembed.py` prints one `@font-face` with a base64 woff2, `font-display: block` and the weight range read from the
font; it keeps name records 0, 1 to 6, 13 and 14 (copyright and licence travel with the file). `--out` writes the
woff2 for a site, `--ttf` a TTF for tools that reject woff2 (troika). Urdu, Pashto and Kurdish letters are not in its
range: add them and run the coverage check.

## 4. Loading

- Embedded data-URI face: `document.fonts.ready` resolved about 16 ms after the first script ran (lane, headless
  Chrome). Use `font-display: block` for embedded faces (no swap flash).
- Gate every measurement on `document.fonts.ready`: line splitting, scramble minimum width, text-on-path fitting,
  fixed boxes. Measuring before it gives fallback-font numbers.
- The `@font-face` needs the weight range (`font-weight: 100 900`) or the browser clamps a variable font to one weight.
- A sibling font file (`url(font.woff2)`) loaded over strict `file://` in Chrome 156 (tested here, same folder, a
  subfolder and `../`). Firefox's file-origin rules were not tested. A single deliverable embeds anyway
  (`sensei-single-file`).
- No `https://` font URL in an offline deliverable (Google Fonts links break the offline promise and the no-CDN rule).

## 5. Variable fonts

Animate `font-weight` (or `font-variation-settings: "wght" N`) in keyframes. Every frame re-lays out text because
advance widths change: `کتابخانه` measured 146.1 px at weight 100 and 155.2 px at 900 (lane and here). Hold the box
still with a grid and a hidden heaviest copy:

```css
.vw-fixed { display: inline-grid; }
.vw-fixed::after { content: attr(data-t); font-weight: 900; block-size: 0; visibility: hidden; overflow: hidden; grid-area: 1 / 1; }
.vw-fixed > span { grid-area: 1 / 1; animation: vw 3s ease-in-out infinite alternate; }
```

Tested: 155.2 px at both ends. Keep weight animation to one or two headings, never body copy, with a reduced-motion
path. Phone frame cost: not verified.

## 6. Licences

| Face | Licence | Evidence | Ship in a project | Ship in the plugin |
|---|---|---|---|---|
| Vazirmatn | SIL OFL 1.1 | licence string read from the font's name table (ID 13); `OFL-Vazirmatn.txt`; no Reserved Font Name is declared in the copyright line (checked 2026-10-24), so a subset may keep the name | yes, with the licence text | yes: `assets/vazirmatn-fa-latin.woff2` with `assets/OFL-Vazirmatn.txt` |
| Noto Naskh or Sans Arabic, Estedad, Sahel, Shabnam, Samim | believed OFL | **not checked**: read each licence file before embedding | after checking | no |
| Any Google Fonts face | per family (OFL or Apache, a few UFL) | read the family's licence | download, subset, embed; never link | no |

OFL in practice: the font may be embedded and redistributed with the work, not sold on its own; keep the copyright and
licence (the name records and the OFL text beside the deliverable or in the ledger); a font with a Reserved Font Name
must be renamed when modified (subsetting counts as modification per the OFL FAQ; general knowledge, the FAQ was not re-read for this skill). Ledger row per face: source URL, licence, version,
`use: asset`, `notice: "name table + OFL text"`.
