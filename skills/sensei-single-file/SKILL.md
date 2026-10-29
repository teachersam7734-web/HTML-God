---
name: sensei-single-file
description: Package a web project into ONE offline HTML file that opens by double click on a machine you never saw, and decide when it should be a hosted site instead. Inlining CSS, scripts, images, fonts and media; run-time loads (fetch, Worker, WASM, JSON, audio, models) through an embedded asset table; esbuild to one IIFE; template-and-manifest builds with refusals for leftover placeholders; big payloads in inert blocks after the app script with a boot that does not wait for DOMContentLoaded; image, SVG and font preparation; file versus http, hosting, service workers, phones. Use when someone says single file, one HTML file, offline, self-contained, works without a server, double-click, email it, put it on a USB stick, LMS upload, inline everything, bundle, package, it works on localhost but not when I open the file, Failed to fetch, the page is slow to start, or host it. Ultra Bookworm is the worked example.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-single-file

One file, opened from disk, offline, on someone else's machine. Three things break single files, and size is not one
of them (weight is reported, never a budget): **it must load, it must not stall the first paint or the boot, and it
must not hit a limit.** Ultra Bookworm (83 MB, a 50-lesson course with films and a WebGL game) is the worked example.

## 1. When to use

Packaging any deliverable whose profile says `"deliverable": "single-file"` (or a deck, course, dashboard or game that
must work offline); diagnosing "works on localhost, fails when double-clicked"; a file that is slow to start; choosing
between a file and a site; preparing images, SVG and fonts for embedding.

Another skill owns it instead:

| Request | Skill |
|---|---|
| Proving the packed file works (strict `file://`, offline, widths, axe, reduced motion) | `sensei-verify` (always run it on the packed file) |
| three.js bundling details, GLB, Draco and meshopt decoders, `inline3d.mjs` | `sensei-3d` |
| Font subsetting for Persian and Latin, RTL | `sensei-typography` |
| Video encoding, alpha video, Lottie, Rive | `sensei-lottie-rive-video` |
| Rendering a page to MP4 | `sensei-video-pipeline` |
| Course data model, persistence, LMS packaging | `sensei-courses` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| File or site | one file, a site, both from one source | email, USB, LMS, archive: file. URL, updates, analytics: site. Both: build once, gate both with `--mode both` ([references/sharing.md](references/sharing.md)) |
| Packager | `inline.mjs` (existing multi-file project), `build-single.mjs` (template and manifest), esbuild IIFE then either | an existing folder of files: `inline.mjs`. A built product with data, fonts and big media: `build-single.mjs`. ES modules or npm packages: bundle with esbuild first |
| Where big bytes live | inert text block at the end of `<body>`; `src` data URI; JS string | inert block or `src` data URI; **never a JS string over a few MB** (200 MB: 10.5 s against 1.4 s, heap 415 MB against 10 MB) |
| When the app starts | direct `boot()` at the end of the app script; `DOMContentLoaded` | always the direct call when payloads follow: `DOMContentLoaded` waits for the parser to read every payload |
| Decoding base64 | `Uint8Array.fromBase64`, `atob` loop, `fetch(data:)` | `fromBase64` (feature-detect), `atob` fallback; never `fetch(data:)` for big payloads (15 times slower) |
| Run-time loads by path | asset table plus runtime shim; change the code to read embedded data | the shim when the code is not yours to change; direct reads in your own code |
| Images | WebP 82, AVIF 70+, JPEG 85 mozjpeg, PNG or lossless WebP, SVG | photos WebP; UI and line art lossless; judge by eye and PSNR ([references/assets.md](references/assets.md)) |
| Fonts | woff2 only, subset, grouped by content hash | always; one `@font-face` per distinct file with a weight range |

## 3. Core technique

**Pack an existing project** (relative CSS, scripts, images, fonts, media, plus anything code loads by path):

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-single-file/scripts/inline.mjs src/index.html dist/page.html [--lazy-over 1024] [--manifest report.json]
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/verify.mjs dist/page.html     # strict file://, offline enforced
```

`inline.mjs` turns stylesheets (with `@import` and `url()`) into `<style>`, scripts into inline scripts with `</script`
and `<!--` escaped, images and small media into data URIs, big media into lazy assets, and every file that code names in
a string (`fetch('add.wasm')`, `new Worker('worker.js')`, `'data.json'`) or that `<html data-sensei-assets="a,b">` lists
into base64 text blocks at the end of `<body>`. The injected runtime (`scripts/lib/sensei-assets-runtime.js`) makes
`fetch(path)`, `new Worker(path)` and `SenseiAssets.url(path)` return the embedded bytes, so unchanged code works from
one file. It refuses leftover placeholders and warns when a script waits for `DOMContentLoaded` with megabytes after it.

**Build a product from a template** (the Ultra Bookworm and HTML-Master pattern):

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-single-file/scripts/build-single.mjs build.json [--check]
```

```json
{ "template": "template.html", "out": "dist/course.html",
  "slots": { "CSS": { "path": "style.css", "kind": "css" }, "LESSONS": { "path": "lessons.json", "kind": "json" },
             "APP": { "path": "app.js", "kind": "js" }, "FILM": { "path": "media/film.webm", "kind": "base64", "optional": true },
             "FONTS": { "kind": "fonts", "faces": [{ "family": "Read", "path": "fonts/inter.woff2", "weight": 400 }] } } }
```

Refusals (nothing written): a slot token missing from the template, a missing file (unless optional), a path outside
the project, `inert-js` holding `</script` or `<!--`, any placeholder left. Warnings: a payload over 1 MB before an
executable script or in `<head>`, a boot that waits for `DOMContentLoaded`, charset not in the first 1024 bytes.

**The order** (measured, [references/embedding-forms.md](references/embedding-forms.md)):

```html
<head><meta charset="utf-8"> ... fonts, CSS ... </head>
<body>
  ...every element the app needs...
  <script type="application/json" id="data">...small data, read with JSON.parse(textContent)...</script>
  <script> ...the app...; boot(); </script>
  <script type="application/x-film" id="film">...big base64, decoded only when asked for...</script>
</body>
```

```js
function decode(b64) {                                        // the fast path, with the fallback
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64);
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const url = URL.createObjectURL(new Blob([decode(el.textContent.trim())], { type: 'video/webm' }));  // cache it, one per asset
```

Measured on a 60 MB block (median of three): payload after the app with a direct `boot()`: first paint 72 ms, booted
19 ms, `DOMContentLoaded` 413 ms. Payload at the end but booting on `DOMContentLoaded`: booted 419 ms. Payload in `<head>`
and booting on `DOMContentLoaded`: first paint 440 ms, booted 388 ms. On Ultra Bookworm at 20 Mbit/s with CPU x4 the
direct boot took the start from 36.4 s to 10.7 s; moving payloads alone gained nothing.

**ES modules and npm packages**: bundle to one IIFE, then inline the result with the escape pass:

```
npx esbuild entry.js --bundle --format=iife --minify --target=es2020 \
  --loader:.wasm=base64 --loader:.png=dataurl --loader:.woff2=dataurl --loader:.svg=dataurl \
  --define:import.meta.url='"https://invalid.local/app/"' --outfile=app.js
```

A worker gets its own bundle first, imported as text: `import workerText from './worker.bundle.js' with { type: 'text' }`
(without the attribute it is an object and the worker dies with `Unexpected identifier 'Object'`). `--format=iife`, never
`esm` or `--splitting`. The `import.meta.url` define is required for DRACOLoader and troika.

**HTML-safe embedding**: `</script` to `<\/script`, `<!--` to `<\!--` in inline JS; `</style` to `<\/style` in CSS; JSON
with `<` as `<`; `<meta charset="utf-8">` in the first 1024 bytes; UTF-8 without BOM. Full table in
[references/embedding-forms.md](references/embedding-forms.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Inline a multi-file project, with the run-time asset table | [scripts/inline.mjs](scripts/inline.mjs), [scripts/lib/sensei-assets-runtime.js](scripts/lib/sensei-assets-runtime.js) | verified |
| Its end-to-end test (original fails over strict `file://`, packed passes 20 checks, plus 3 for the command line) | [scripts/test-inline.mjs](scripts/test-inline.mjs), [scripts/make-fixture.mjs](scripts/make-fixture.mjs) | verified |
| Template and manifest builder with refusals, font grouping, order warnings | [scripts/build-single.mjs](scripts/build-single.mjs) | verified |
| The course shape in miniature (Ultra Bookworm's order, direct boot, film from an inert block) | [examples/course-shape/template.html](examples/course-shape/template.html), [examples/course-shape/app.js](examples/course-shape/app.js), [examples/course-shape/build.json](examples/course-shape/build.json) | verified |
| The order lesson measured, refusals proven, packed file through the gate | [scripts/test-build-single.mjs](scripts/test-build-single.mjs) | verified |
| esbuild to one IIFE with wasm, image, CSS, worker as text, the define | [scripts/test-bundle.mjs](scripts/test-bundle.mjs) | verified |
| Embedding forms at 10 to 200 MB, decode methods, memory | [scripts/bigfile-experiment.mjs](scripts/bigfile-experiment.mjs), [references/bigfile-results.json](references/bigfile-results.json) | verified |
| file versus http versus an insecure host | [scripts/test-protocols.mjs](scripts/test-protocols.mjs), [references/protocol-matrix.json](references/protocol-matrix.json) | verified |
| Service worker offline reload and the stale-cache trap (sites) | [scripts/test-sw.mjs](scripts/test-sw.mjs) | verified |
| Image re-encoding with bytes and PSNR; format and SVGO measurements | [scripts/optimise-images.mjs](scripts/optimise-images.mjs), [scripts/test-assets.mjs](scripts/test-assets.mjs) | verified |
| Scratch folder and optional npm tools for the tests | [scripts/work.mjs](scripts/work.mjs) | verified |
| Ultra Bookworm's builder and the HTML-Master helper, read closely | [references/ultra-bookworm.md](references/ultra-bookworm.md) | read, not re-run |

Tests write under `SENSEI_WORK` (default one named folder, `<OS temp>/sensei-single-file`, reused by every run and
overwritten, never multiplied), never into the plugin. esbuild, sharp and svgo come from
the project's `node_modules` or `SENSEI_NPM`; Playwright and the browser are discovered as in `sensei-verify`.

## 5. Quality bars

1. `sensei-verify` passes on the packed file in **strict `file://`**: zero console errors, page errors, failed or
   external requests.
2. First paint does not wait for byte tables (they are after the app script, at the end of `<body>`); the app boots
   before `DOMContentLoaded` when over 1 MB of payload follows it; no payload over 5 MB in a JS string.
3. Every remaining `url(` and `src=` is `data:`, `blob:` or `#`; the `</script` count equals the `<script` count.
4. The packager exits non-zero on a missing file or a leftover placeholder and prints every external URL left.
5. A weight report is printed as information: total, data URI bytes by type, the largest blocks. Never a gate.
6. Every vendored library keeps its notice; every font and asset has a ledger row.
7. The hand-off says what was not verified: other browsers, phones, the real host.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Works in testing, "Failed to fetch" when double-clicked | `--allow-file-access-from-files` lets `fetch`, XHR, module scripts, `new Worker('file')`, `import()` and canvas reads of siblings work over `file://`; users have no such flag | verify in strict mode (the gate's default) | tested |
| 2 | Works in dev, fails as one file | a static inliner cannot see `fetch('x.wasm')`, `new Worker('w.js')`, JSON or glTF loaded by path | the asset table and shim, or read embedded data directly | tested |
| 3 | No first paint until the whole file is parsed | byte tables in `<head>` | after the app script, end of `<body>` | tested (50 to 200 MB; 60 MB here) |
| 4 | The app starts seconds late although payloads are at the end | it boots on `DOMContentLoaded`, which waits for every payload | call `boot()` directly at the end of the app script | tested here (60 MB: 19 ms against 419 ms) and on Ultra Bookworm (36.4 s to 10.7 s throttled) |
| 5 | Load takes 10 s and the heap doubles | 200 MB in a JS string | inert text block | tested |
| 6 | Decoding takes seconds | `fetch('data:...')` used as a base64 decoder | `Uint8Array.fromBase64`, `atob` fallback | tested |
| 7 | A broken image or a dead comment ships, nothing errors | a placeholder nobody replaced | refuse to write (both packagers here) | tested |
| 8 | An early `fetch(path)` fails while later calls work | the script ran before the table at the end of `<body>` was parsed | the shim waits for `DOMContentLoaded`; synchronous `new Worker(path)` cannot wait: create it later or `--assets-at head` | tested |
| 9 | A worker cannot `importScripts('x.js')` | a Blob URL's base is the blob | bundle the worker into one file | reported (Chrome only) |
| 10 | Nothing in a script runs | `import.meta` in a classic inline script is a SyntaxError for the whole script | esbuild `--define:import.meta.url=...` | tested |
| 11 | Memory creeps | a Blob URL per use | cache one per asset (the runtime does) | reported |
| 12 | An animated SVG broke | SVGO stripped ids and rewrote shapes | `cleanupIds: false`; test after | tested |
| 13 | The file got bigger, nothing looks better | every `srcset` candidate embedded | one size | tested |
| 14 | A page shared as a data URL will not open | top-level `data:` navigation is capped (about 2 MB in Chromium) | share the file | reported, not tested |
| 15 | A data URI fails in another browser | per-engine limits (MDN: Chromium and Firefox 512 MB, Safari 2 GB, older Firefox 32 MB) | test there; nothing over 80 MB was tested outside Chrome | reported |
| 16 | A phone kills the tab or refuses the file | phones have far less memory; in-app viewers restrict local HTML | system browser, lazy media, host for phones; say it was not verified; do not shrink silently | reported, not tested |
| 17 | Reload takes as long as the first load | `file://` has no HTTP cache | expected; nothing to fix | tested |
| 18 | A licence breach ships | vendored code or fonts lost their notice | keep notices (`legalComments`, OFL text); ledger in the project | reported |
| 19 | The worker dies with `Unexpected identifier 'Object'` | esbuild bundled the worker file as code, so `new Blob([obj])` held `[object Object]` | import it `with { type: 'text' }` | tested |
| 20 | A lesson string ends the script early | JSON inserted into a script without escaping `</` | `<` as `<` (`build-single.mjs` `json`), or `.replace('</', '<\\/')` in Python | reported (open in Ultra Bookworm's build.py) |
| 21 | `$&` or `$1` in inserted code turns into matched text | JS `String.replace` with a string interprets them | split and join, or a replacement function | reported (HTML-Master notes) |
| 22 | Mojibake in a Persian page | no charset in the first 1024 bytes; a file has no header | `<meta charset="utf-8">` first | reported |
| 23 | A Skip button is painted and dead for 30 s | its listener lives in the late app script | a few-line inline script right after the element | tested (field log) |
| 24 | A JS string literal splits across lines, or a regex loses a backslash, after a scripted edit | shell heredocs and some tools turn escapes into real characters | write code with the file tool, then `node --check`; check for stray control characters | tested (while writing this skill) |
| 25 | `inline.mjs src/index.html dist/page.html` stops with a raw `ENOENT ... writeFileSync` stack | the output folder did not exist yet | the command line now creates the output and manifest folders, and a missing entry is a one-line message with exit 2 | found by the independent QC run, fixed, tested in `test-inline.mjs` |

## 7. Licences

| Piece | Licence | Use |
|---|---|---|
| `inline.mjs`, the runtime, `build-single.mjs`, every test and the course example | HTML-Sensei's own code | ships in the plugin; the runtime is copied into every packed file |
| `fixtures/test-font.woff2` (Vazirmatn) | SIL OFL 1.1, text in `fixtures/test-font-OFL.txt` | test fixture only; the licence travels with it |
| esbuild | MIT | the user installs it |
| sharp (libvips) | Apache-2.0 (LGPL libvips) | the user installs it |
| SVGO | MIT | the user installs it |
| playwright-core | Apache-2.0 | the user installs it |
| SingleFile (`single-file-cli`) | AGPL-3.0 | capturing existing pages only, called as a process, never embedded |
| `vite-plugin-singlefile`, `parcel-resolver-inline`, `inliner`, `monolith` | MIT or similar | allowed in projects; not run here |

Nothing from a never-ship or ideas-only source is in this skill.

## 8. Verification

Run while writing this skill (Windows 10, Node 24, installed Chrome through playwright-core 1.62, strict `file://`):
`test-inline.mjs` 23 of 23 (2026-10-28: the 20 packing checks, plus the command line creating a missing output folder
and exiting 2 with a clear message for a missing entry or a folder given as the entry); `test-build-single.mjs` 22 of 22 (the example builds with fonts grouped, passes the
`sensei-verify` gate, plays its film from the inert block; every refusal fires; the three orders measured as above);
`test-bundle.mjs` (wasm 3, worker 42, PNG 64, define honoured, no errors); `test-protocols.mjs` (the matrix);
`test-sw.mjs` (offline reload, stale cache and its fix); `test-assets.mjs` and `optimise-images.mjs` with sharp and
svgo; `bigfile-experiment.mjs` at 10 MB. The research lane ran the same scripts up to 200 MB and ran the gate on the
real 83 MB Ultra Bookworm file.

Not verified: Firefox and Safari; macOS and Linux; phones and in-app viewers; any real host (nothing was deployed);
JPEG XL decode; `content-visibility`; the off-the-shelf inliners, `cwebp`, `avifenc`; string lengths above 200 MB;
`texImage2D` from a sibling image over `file://` (the canvas taint was measured).

## 9. Carried by

- Agent `sensei-packager`: builds the single file (`inline.mjs` or `build-single.mjs`, esbuild when needed), prepares
  images, SVG and fonts, runs `sensei-verify` in strict file mode, prints the weight report, lists external URLs and
  licence notices, says what was not verified; produces the site folder too when asked, and never publishes without
  approval. `sensei-reviewer` checks the packed file.
- Command `/sensei-pack`: this skill's packaging and the gate.
- Hooks: `lint-web.mjs` (PostToolUse: network references when the profile is offline, vendored code without a notice);
  `lint-3d.mjs` (`import.meta` in a classic script, Draco from a CDN, `</script` inside an inline script);
  `guard-process.mjs` (PreToolUse: an esbuild bundle of three.js loaders without `--define:import.meta.url`);
  `guard-licence.mjs` (never-ship code into plugin paths); `keep-eol.mjs` (line endings preserved); `gate-claim.mjs`
  (Stop: no "done" without a fresh passing gate report on the packed file).
