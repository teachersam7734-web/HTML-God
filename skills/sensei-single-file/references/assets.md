# Assets for one file: images, SVG, fonts, and the hand-offs

Source: `domain-asset-pipelines.md` in the HTML-Sensei build project's research notes (not shipped) (sharp, SVGO and fontTools runs in the research lane). Best
quality is the default; sizes are reported, never budgeted (owner rule).

## Tools

| Tool | For | Licence | Install |
|---|---|---|---|
| `scripts/optimise-images.mjs` | re-encode to webp, avif, jpeg; prints bytes, base64 cost (x1.333) and PSNR against the source | HTML-Sensei's own | needs sharp (`SENSEI_NPM` or the project's `node_modules`) |
| sharp (libvips) | image processing; this build has AVIF, WebP, HEIF, no JPEG XL encoder | Apache-2.0 (libvips LGPL, prebuilt) | `npm i -D sharp` |
| SVGO | SVG optimiser | MIT | `npm i -D svgo` |
| fontTools `pyftsubset` plus brotli | subsetting and woff2 | MIT | `pip install fonttools brotli`; `sensei-typography` owns the Persian and Latin wrapper |
| ffmpeg | audio and video | LGPL or GPL by build | `sensei-lottie-rive-video` and `sensei-video-pipeline` own the recipes |
| gltf-transform, meshopt, Draco | 3D compression | MIT, Apache-2.0 | `sensei-3d` owns it |

## Image formats (a 1600 x 1000 synthetic photo with film grain)

| Format | Bytes | As base64 in a file | Note |
|---|---|---|---|
| PNG (level 9) | 3,305,607 | 4,407,476 | lossless; flat graphics and screenshots only |
| JPEG 80 (mozjpeg) | 72,511 | 96,681 | universal; blocky on gradients at low quality |
| WebP 80 | 98,810 | 131,747 | universal in current browsers |
| AVIF 50 | 11,551 | 15,401 | **smoothed the grain away**: smaller because the texture was discarded |
| AVIF 70 | 165,535 | 220,713 | keeps more grain, larger than JPEG here |
| WebP lossless | 1,306,724 | 1,742,299 | |

A second image (1200 x 800, gradient and grain, the script's defaults): WebP 219 KB at 36.8 dB, JPEG 152 KB at 32.4 dB,
AVIF 221 KB at 37.5 dB, source PNG 2.5 MB. At equal fidelity the formats are within a factor of two on grainy content;
AVIF wins big only when allowed to discard texture. "Quality 50" means different things to different codecs: judge by
eye and PSNR, never by the number. All six decoded from `data:` URIs in Chromium.

Defaults (quality first): photographs WebP 82; AVIF 70 or higher only when checked by eye and grain does not matter;
JPEG 85 mozjpeg for the widest compatibility; PNG or lossless WebP for UI and line art; SVG for icons and logos. Keep the
original in the project, ship the encode. JPEG XL: not as the only format (no encoder here, decode untested).

Run here on a 64 px fixture: WebP 304 bytes at 41.1 dB, AVIF 391 bytes at 49.2 dB, JPEG 621 bytes at 47.5 dB.

## Responsive images inside one file

`srcset` saves download bytes on a site; in a file every candidate is already there. Measured: 800 w plus 1600 w
embedded is 103,218 bytes against 98,810 for the 1600 w alone, and the small one is never used on a large screen.
Embed one size, for the largest layout (times 2 for high-DPI heroes); lay out with `object-fit`, `aspect-ratio`, and
explicit `width` and `height`; use `<picture>` only for art direction. `decoding="async"` everywhere: a 5,120 px PNG
data URI without it took 1.9 s to DOMContentLoaded.

## SVG with SVGO

```js
optimize(svg, { multipass: true, plugins: [{ name: 'preset-default', params: { overrides: { cleanupIds: false } } }] })
```

A 1,117 byte editor export became 528 bytes. Traps: the current SVGO moved `removeViewBox` out of the default preset (an
override for it prints an error and is ignored); keep the `viewBox` so the SVG scales. The default preset converts
shapes to paths and strips ids (`<rect id="box">` became a `<path>`), which breaks anything CSS or JS targets: keep
`cleanupIds: false` and test animated SVG after optimising. Inline `<svg>` when CSS or JS controls it; a utf8 data URI
(smaller than base64, readable) for decoration.

## Fonts

woff2 only (listing ttf and woff as fallbacks embeds every one of them). Subset to the languages used; Persian subsets
need پ چ ژ گ ک ی, the Persian digits and U+200C (`sensei-typography`). One `@font-face` per **content hash** with a
weight range: Ultra Bookworm's variable fonts appeared under several file names and were embedded once per weight until
grouping by content saved about 300 KB (`build-single.mjs` `fonts` kind does the grouping). `unicode-range` split for
latin and latin-ext so only the needed range is rasterised. A data-URI font arrives almost at once but not
synchronously: wait on `document.fonts.ready` before measuring. OFL fonts carry their licence text in the project and a
ledger row; some "free" display faces forbid embedding.

## Hand-offs

| Asset | Form in one file | Owner |
|---|---|---|
| Sound effects, music | mp3 or ogg (wav for tiny effects) in the asset table; `decodeAudioData` after the first gesture. Verified: a 0.3 s WAV through the shim decoded to 0.3 s; a 200 MB WAV in a `src` data URI loaded | `sensei-audio` |
| Video | H.264 and AAC MP4 for compatibility, WebM VP9 or AV1 for size; big video lazy (`data-sensei-asset` or an inert block decoded on demand). Playwright's managed Chromium cannot play H.264: check with installed Chrome | `sensei-lottie-rive-video` |
| 3D | GLB with meshopt (decoder 29 KB) or Draco (about 250 KB); KTX2 textures; blob URLs and `setDecoderPath({ js, wasm })`; three.js as an esbuild IIFE with the `import.meta.url` define | `sensei-3d` |
| Lottie, Rive | JSON or dotLottie and `.riv` through the asset table | `sensei-lottie-rive-video` |
| Film grain | a 292-byte SVG with `feTurbulence` instead of a bitmap tile (Ultra Bookworm) | `sensei-direction` |

## Traps

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | A photo looks plastic | AVIF at "quality 50" erased the grain | compare by eye and PSNR | tested |
| 2 | "AVIF supported" concluded from the canvas | `toDataURL('image/avif')` silently returns PNG; decode works | never use the canvas encoder as a decode test | tested |
| 3 | File grew for nothing | srcset candidates all embedded | one size | tested |
| 4 | Animated SVG broke after optimising | SVGO stripped ids and rewrote shapes | `cleanupIds: false`; test after | tested |
| 5 | Rotated photo | sharp ignores EXIF rotation unless `.rotate()` | the script calls it | reported |
| 6 | Colours flat on sRGB screens | P3 source encoded without conversion | `.toColourspace('srgb')` | reported |
| 7 | Persian text breaks silently | a subset dropped joining features or U+200C | `sensei-typography`'s measured subset | tested in the UI lane |
| 8 | Same font embedded three times | grouping by file name, not content | group by content hash | tested (Ultra Bookworm) |
| 9 | Main thread stalls on a big image | PNG data URI decoded synchronously | `decoding="async"` | tested |
| 10 | A licence breach in a deliverable | stock image, font or sound terms | a ledger row per asset: source, licence, redistribution allowed | reported |
