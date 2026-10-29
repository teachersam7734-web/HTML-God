# Media Embedding: base64, resizers, fonts, and inlining libraries

Single-file means the file *is* the media library. Best quality is the default: embed what the
best result needs, report the weight, and tell the user about any known limit of their delivery
channel. There is no budget unless the user asks for one. Deeper: `html-sensei:sensei-single-file`.

---

## §1 · Weight: reported, never a gate

Weight is information for the hand-off, not a design input. The three shipped files weighed 136 KB,
4.5 MB and 14.6 MB (`case-studies.md`); each was right for its job. What to do instead of a budget:

| Situation | Do |
|---|---|
| Any build | report total weight and the biggest embeds at every gate (`verify_html.py` prints them) |
| A delivery channel with a known limit (some mail services cap attachments at about 20 to 25 MB; some chat and LMS uploads cap lower) | tell the user before shipping; offer a hosted copy or a file plus folder, never a silent quality cut |
| The user asked for a budget | then it is a budget: write it in the design read and gate on it |

Free wins that cost no visible quality, worth taking anyway: resize images to 2 to 3 times their
display size (§2), webp for photographs, crop silence from audio, embed only the font weights you
use. Lowering audio bitrate or image quality below transparent is a quality decision: ask first.

## §2 · Images: the resize pipeline

Proven pipeline (Idiom-Ville logo: 843×1240, ~1 MB source → 27 KB embedded, displayed at 52px):

```bash
pip install pillow   # or: npm i sharp --no-save
```

```bash
python scripts/inline_media.py sam-logo.png idiom-ville.html --max-h 144 --fmt png
# resizes to fit (never crop), max compression, base64-encodes, injects/updates ONE data URI
```

Rules:
- Resize to **2 to 3× display size** (144px for a 52px slot). Any bigger adds bytes the screen
  cannot show; any smaller is blurry on retina.
- `fit:'inside'` / `Image.thumbnail`: **never crop identity art** (iron rule #3).
- webp for photos/covers (−50 to 70% vs png), png for logos/sharp edges, jpeg q80 for photographs
  when webp support is a concern (it isn't, in 2026).
- Verify after swap: exactly **one** `data:image/…;base64` per asset; `img.complete &&
  naturalWidth` matches expectation in the served page.

**Never edit inside a base64 blob.** Swap the whole URI via one unique anchor (the `<img id>` or a
sentinel comment), then count occurrences.

## §3 · Audio: embedding and encoding

- Full songs: mp3 128 kbps mono/stereo via `ffmpeg -i in.wav -b:a 128k out.mp3`. A 3-minute song ≈
  3 MB → ~4 MB as base64 (×1.37 overhead). Arabian Nights shipped a 10 MB single line.
- SFX/UI sounds: **synthesise, don't embed** (`interaction.md` §4): zero bytes, mutable, no licensing.
- Voice clips (TTS-grade narration): mp3 96 kbps, mono: still legible, half the size.
- One `<audio preload="auto" src="data:audio/mpeg;base64,…">` per track; keep the element *in the
  HTML* (not JS-created) so the browser can decode early.
- Autoplay policy: resume/create `AudioContext` on first user gesture; never rely on autoplay.

## §4 · Fonts: three strategies

| Strategy | Cost | When |
|---|---|---|
| Subset + base64 woff2 `@font-face` | +30 to 80 KB/family-weight | the default for a single file: it must work offline (emailed, USB, LMS, venue wifi) |
| Google Fonts `<link>` | 0 bytes, needs network | only a hosted page that may make requests (and the user accepts a third-party request) |
| System font stack | 0 bytes, less character | trust-first/dense dashboards, or a fallback behind an embedded face |

The starters in `assets/` make no network request: their stacks name the families first and fall
back to system faces, so embed the families you choose.

Subsetting: `pyftsubset font.ttf --unicodes="U+0020-007E,U+2022" --flavor=woff2` (fonttools), then
`@font-face` with the base64 URI. Only embed weights actually used. Remember: `document.fonts.ready`
before measuring text in canvas, and `document.fonts.check('12px "Unbounded"')` in the media gate.

## §5 · Cover art / multi-image sets

- Build a `COVERS = []` array behind a `/*__COVERS__*/` sentinel; a script swaps entries wholesale.
- Downscale to actual display size (carousels show ~240px wide → embed ≤ 480px, webp, q75 to 80).
- One `.shine` sweep + one reflection copy sells "premium cover" better than any shadow.

## §6 · Favicons & meta that cost nothing

```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧞</text></svg>">
<meta name="theme-color" content="#0a0618">
<meta property="og:title" content="…"><meta property="og:description" content="…">
```

(og tags only matter once hosted; harmless inline until then. The emoji favicon is a GOAT-HTML
signature: zero bytes, real polish.)

## §7 · Alternative: the bundle pipeline (from web-artifacts-builder)

When the app genuinely needs React/Vue/shadcn-scale machinery (including the react-three-fiber
case in `library-ecosystem.md` §1: React state really driving the scene, Door B chosen
deliberately, weight reported), don't hand-inline; use esbuild:

```bash
npx esbuild src/app.jsx --bundle --minify --format=iife \
  --define:process.env.NODE_ENV='"production"' --outfile=bundle.js
# then inline bundle.js + styles.css into template.html at sentinels
```

This ships the *same* single file; the difference is the source of truth lives in real modules.
Bundling three.js addons that load files needs `--define:import.meta.url=...` handled, and
`</script` inside the bundle must be escaped before inlining (`html-sensei:sensei-single-file`
covers both).
Use for dashboard-grade complexity; skip for cinematic one-offs (vanilla wins on control and needs no build step).

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| File doubled in size after one logo | raw source inlined | §2: resize to 2 to 3× display |
| Image blurry on retina | scaled to exactly display size | §2: 2 to 3× rule |
| Base64 edit corrupted the HTML | edited inside the blob | §2: swap whole URI at one anchor |
| Audio won't autoplay | browser policy | §3: resume ctx on first gesture |
| Font flashes (FOUT) | late font load | `font-display:swap` + preload; or embed |
| Single URI verification fails | duplicate URIs from partial swap | §2: count before/after, must be 1 |
