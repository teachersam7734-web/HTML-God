# Embedding forms, decoding, order and escaping

Sources: `domain-single-file-packaging.md` in the HTML-Sensei build project's research notes (not shipped) section 3 (measured in the research lane; raw numbers in
`bigfile-results.json`), and `scripts/test-build-single.mjs` (measured while writing this skill).

Environment for every number: installed Chrome, headless, Playwright core, Node 24, Windows, 16 GB, software GL, a fresh
browser per run, files on a local SSD, `file://`, no file-access flag.

## Where the bytes live (random, incompressible payloads; size is the base64 text in the file)

| Payload | Form | Load event | First contentful paint | JS heap | Browser memory after load |
|---|---|---|---|---|---|
| 50 MB | `<script type="application/x-sensei-asset">` at the end of `<body>` | 380 ms | 68 ms | 10 MB | 514 MB |
| 50 MB | same, in `<head>` | 356 ms | none before load | 10 MB | 513 MB |
| 50 MB | JS string `window.D="..."` | 1,029 ms | 76 ms | 111 MB | 526 MB |
| 100 MB | text block, end of body | 711 ms | 68 ms | 10 MB | 615 MB |
| 100 MB | text block, head | 699 ms | none before load | 10 MB | 610 MB |
| 100 MB | JS string | 3,600 ms | 68 ms | 202 MB | 619 MB |
| 200 MB | text block, end of body | 1,427 ms | 68 ms | 10 MB | 816 MB |
| 200 MB | text block, head | 1,412 ms | none before load | 10 MB | 811 MB |
| 200 MB | JS string | 10,550 ms | 92 ms | 415 MB | 816 MB |
| 50 MB | `<img src="data:image/png;base64,...">` (3,621 px wide) | 1,433 ms | 68 ms | 10 MB | 521 MB |
| 100 MB | same (5,120 px wide) | 3,030 ms | 72 ms | 10 MB | 631 MB |
| 200 MB | `<audio src="data:audio/wav;base64,...">` | 2,552 ms | 64 ms | 10 MB | 802 MB |

Reading it:

1. **Never hold a large payload in a JS string**: compile and copy cost grows with size (10.5 s against 1.4 s at 200 MB)
   and the heap balloons (415 MB against 10 MB). A text block is not compiled and not copied until read; reading 200 MB
   of `textContent` took 22 ms.
2. **Byte tables at the end of `<body>`, never in `<head>`**: at the end, first paint came at 68 ms whatever the size;
   in the head there was no paint before `load` at all three sizes.
3. **Data URIs in `src` attributes also work at 200 MB** in Chrome and decode lazily (heap stayed at 10 MB). Parse cost
   is about 12 ms per MB of text. This is how Ultra Bookworm carries its opening film and music.
4. **Memory is about the file size plus a baseline** of roughly 400 MB for an idle headless Chrome (all processes): a
   200 MB file cost about 420 MB above baseline.
5. No string-length crash at 200 MB (268 million characters). The V8 limit is about 536 million characters, so one
   base64 string cannot hold more than about 400 MB of binary: from engine documentation, not reached here.

Re-run here at 10 MB (`bigfile-experiment.mjs 10 textplain-end,jsstring`): text block load 137 ms, paint 68 ms, heap
10 MB; JS string load 193 ms, paint 108 ms, heap 26 MB. Same direction, smaller gap at a small size.

## Decoding the text back to bytes (in page)

| Method | 50 MB | 100 MB | 200 MB of base64 text |
|---|---|---|---|
| `Uint8Array.fromBase64(text)` | 50 ms | 77 to 95 ms | 178 to 204 ms |
| `atob` plus a loop | 157 to 174 ms | 298 to 374 ms | 572 to 597 ms |
| `fetch('data:...;base64,' + text)` then `.blob()` | 738 to 822 ms | 1,374 to 1,482 ms | 3,068 to 3,246 ms |

Use `Uint8Array.fromBase64` where it exists (feature-detect), `atob` otherwise; never `fetch(data:)` for big payloads
(about 15 times slower, and it needs `connect-src data:` if a CSP is ever added). The runtime and the course example do
exactly this.

## Order: payloads after the app script, and boot without waiting for DOMContentLoaded

`DOMContentLoaded` fires when the parser reaches the end of the document, so it waits for every inert byte block, even
at the end of `<body>`. Moving payloads to the end helps first paint; it does not help an app that boots on
`DOMContentLoaded`. Measured in `test-build-single.mjs`, the course example with the same 60 MB block, three loads each
after a warm-up, medians:

| Layout | First paint | App booted | DOMContentLoaded |
|---|---|---|---|
| Payload after the app script, app calls `boot()` directly (good) | 72 ms | 19 ms | 413 ms |
| Payload at the end, app boots on `DOMContentLoaded` | 68 ms | 419 ms | 418 ms |
| Payload in `<head>`, app boots on `DOMContentLoaded` (bad) | 440 ms | 388 ms | 387 ms |

The field confirmed it at scale: on Ultra Bookworm, QC measured that moving the payloads to the end alone changed
nothing (38.3 s against 36.7 s at 20 Mbit/s with CPU slowed four times); the direct `boot()` call took it from 36.4 s to
10.7 s. The finished file's trace: first paint 64 to 124 ms, longest task 101 to 289 ms, DOMContentLoaded 3.8 to 4.2 s
(0.8 s with the payloads removed), harmless because nothing waits for it.

The rule, as a template:

```html
<head> charset first; fonts; CSS </head>
<body>
  every element the app needs
  <script type="application/json" id="data">small data the app needs at once</script>
  <script> ...app...; boot(); </script>                         <!-- not addEventListener('DOMContentLoaded', boot) -->
  <script type="application/x-film" id="film">BASE64...</script>  <!-- big, on demand, read when asked for -->
</body>
```

`build-single.mjs` warns on a payload over 1 MB before an executable script, in `<head>`, and on an executable script that
waits for `DOMContentLoaded` or `load` with over 1 MB after it; `inline.mjs` warns on the last case too. A control that
must work before the app arrives (a Skip button on an opening film in a slow file) gets a ten-line inline script right
after its element (field log: with the listener in the late app script, Skip was painted and dead for 30 s).

## HTML-safe embedding

| Where | What breaks it | Escape |
|---|---|---|
| Inline `<script>` JS | `</script` (any case), and `<!--` before `<script` | `<\/script` and `<\!--`. Safe inside JS strings, regex and template literals |
| Inline `<style>` | `</style` | `<\/style` |
| JSON in `<script type="application/json">` | `</script`, `<!--`, U+2028 and U+2029 in old engines | `JSON.stringify(x).replace(/</g, '\\u003c')` (covers `<!--` too) |
| Inert library text (`type="text/x-three"`) | `</script` or `<!--` inside it ends or escapes the block | refuse to build (Ultra Bookworm and `build-single.mjs` `inert-js`) or escape in the bundle |
| Python builders | `json.dumps` leaves `</script` alone | `json.dumps(x, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')` |
| Attribute values holding data URIs | a `"` | base64 never has one; for utf8 SVG use single quotes inside and percent-encode `#`, `<`, `>`, `%` |
| Non-ASCII text | the browser guesses the charset of a file | `<meta charset="utf-8">` within the first 1024 bytes |
| BOM and line endings | a BOM before `<!doctype>` can trigger quirks in some tools | UTF-8 without BOM; keep the file's line endings (the `keep-eol` hook) |
| JS `String.replace` with a string | `$&`, `$1` in the inserted code are interpreted | replace with a function, or split and join (`build-single.mjs`) |
