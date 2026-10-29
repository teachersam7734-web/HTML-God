---
name: sensei-lottie-rive-video
description: Designer-made animation and video inside HTML pages, shipped as one offline file. Lottie with lottie-web (five builds) and dotLottie (WASM, setWasmUrl), the .lottie container, theming and scroll scrub; Rive runtimes (canvas, canvas-lite, canvas-single, webgl2) with the WASM inlined, state machine inputs, a safe mount wrapper; hero and background video with posters, codecs and the ffmpeg recipe book, transparent video (VP9 alpha, HEVC alpha, alpha-packed), scroll-scrubbed video, WebCodecs, captions, requestVideoFrameCallback, reduced motion and pause controls, and the licences of LottieFiles, Rive Marketplace and stock footage. Use when the user says Lottie, lottie-web, bodymovin, dotLottie, .lottie, LottieFiles, Rive, .riv, state machine animation, hero video, background video, video loop, autoplay video, poster frame, transparent video, alpha video, WebM, HEVC, AV1, scroll-scrubbed video, scrub video on scroll, WebCodecs, captions on a video, or "the animation needs the internet".
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-lottie-rive-video

Doctrine first: best quality is the default, no page-weight budget unless the user asks, never downgrade because this
machine is slow, and say plainly what was not verified. Everything here was run in headless Chrome over **strict
`file://`** (no `--allow-file-access-from-files`, the way a double-clicked file opens). Nothing was run in Safari,
Firefox or on a phone, and no clip here is real footage.

## 1. When to use

A Lottie or dotLottie animation, a Rive file, or a video element in a page, deck, course, game or landing page,
including getting any of them into one offline file.

| The job is | Skill |
|---|---|
| Turning a page into an MP4 (seek contract, renderer, mux, loudness, film captions) | `sensei-video-pipeline` |
| Hand-written CSS, WAAPI, GSAP or Motion animation | `sensei-motion-ui` |
| A video as a WebGL texture, a video hologram, recombining alpha-packed video in a shader | `sensei-holograms` |
| Sound effects, Web Audio, sound in step with a picture | `sensei-audio` |
| Blender renders to frames or video | `sensei-blender` |
| Packing the whole deliverable into one file | `sensei-single-file` |
| The gate harness across a site | `sensei-verify` |

Do not use any of these when CSS, SVG or a few lines of GSAP do the same in kilobytes and stay crisp at any size.

## 2. Decision table

| Choice | Pick | What decides it |
|---|---|---|
| Kind of asset | Lottie | a designer-made loop or state (tick, loader, mascot) from After Effects or Lottie Creator |
| | Rive | it must react: state machine, pointer, toggles, ratings, game HUD; someone uses the Rive editor |
| | video | photographic or rendered footage, long or cinematic motion |
| | code | you author it yourself: smaller and controllable |
| Lottie player | lottie-web SVG (`lottie_svg`, 237 KB) | default: crisp, a few on a page |
| | lottie-web canvas | many instances or heavy shapes |
| | full `lottie.min.js` (299 KB) | the file uses After Effects expressions (light builds drop them) |
| | dotLottie (1.2 MB WASM) | complex files, `.lottie` containers, themes; only with `setWasmUrl` |
| Rive runtime | `canvas-single` (3.0 MB JS) | the simplest one file: no WASM request, no setup |
| | `canvas` or `webgl2` + `setWasmBinary` | the same features with the WASM as its own payload; webgl2 for one hero piece |
| | `canvas-lite` + `setWasmBinary` (1.2 MB page) | no Rive Text and no audio in the file |
| Video codecs | VP9 WebM or AV1 MP4 first, H.264 MP4 last | H.264 plays everywhere; never HEVC alone |
| Transparent video | VP9 alpha WebM plus HEVC-alpha MP4 for Safari | the standard pair |
| | alpha-packed H.264 + shader | must play wherever video plays |
| Scrub encode | GOP 4 to 12, no B-frames | default (588 KB for GOP 8 here) |
| | all-intra | the most exact seeks, about 2.7 times the size |
| Video in one file | `blob:` URL from inlined bytes | anything over a few MB |
| | `data:` URI | small clips |
| Captions | `data:text/vtt` track or `addTextTrack` | always in a single file: a relative `.vtt` fails over strict `file://` |

## 3. Core technique

### 3.1 Lottie

```html
<div id="a" role="img" aria-label="Order confirmed" style="width:200px;height:200px"></div>
<script>/* lottie_svg.min.js, every "</script" written "<\/script" */</script>
<script>/* scripts/lottie-helpers.js */</script>
<script type="application/json" id="d">{ ...animation JSON... }</script>
<script>
  const anim = LottieHelpers.mount(lottie, document.getElementById('a'),
    JSON.parse(document.getElementById('d').textContent), { renderer: 'svg', posterFrame: 30 });
</script>
```

`mount()` clones the data (lottie-web mutates it), holds the poster frame under reduced motion, pauses off screen and
in a hidden tab, and `anim.__teardown()` cleans up. dotLottie: bundle `@lottiefiles/dotlottie-web` to an IIFE and call
`DotLottie.setWasmUrl('data:application/wasm;base64,...')` **before** the first `new DotLottie(...)`.
Depth: [references/lottie.md](references/lottie.md).

### 3.2 Rive

```js
rive.RuntimeLoader.setWasmBinary(wasmBytes.buffer); rive.RuntimeLoader.setWasmFallbackUrl(null);  // skip for canvas-single
const m = SenseiRive.mount(rive, canvas, { buffer, stateMachine: 'Main', onReady: m => m.set('Level', 3) });
keyButton.addEventListener('click', () => m.fire('Pop'));          // a keyboard path for every pointer-driven input
// on leaving the screen: m.teardown()   (cleanup() frees the WASM memory)
```

`scripts/rive-mount.js` names the state machine at construction (otherwise `stateMachineInputs()` is empty), turns
off `enableRiveAssetCDN`, honours reduced motion, pauses off screen and in a hidden tab, resizes the drawing surface,
and never reads `isPlaying` before load (it throws). Depth: [references/rive.md](references/rive.md).

### 3.3 Hero and background video

```html
<video autoplay muted loop playsinline preload="metadata" poster="poster.webp" aria-hidden="true">
  <source src="hero.webm" type='video/webm; codecs="vp9"'><source src="hero.mp4" type="video/mp4">
</video>
<button id="pause" type="button" aria-pressed="false">Pause background video</button>
```

Under reduced motion remove `autoplay` before it starts and keep the poster; pause off screen and when hidden; a
visible pause button (WCAG 2.2.2), remembered; `play().catch()` leaves the poster. Full page:
[examples/hero-video.html](examples/hero-video.html). Encodes: `scripts/ffmpeg-recipes.mjs`.

### 3.4 Scrub, frames, alpha, one file

Scroll scrub with one seek in flight and a dead-band ([examples/scrub-video.html](examples/scrub-video.html)); draw a
sought frame only after `requestVideoFrameCallback`; read alpha from pixels, never from ffprobe; inline video as a
`blob:` URL and captions as a `data:` track. Depth: [references/video.md](references/video.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Original test animation (Lottie JSON) | [scripts/make-lottie.mjs](scripts/make-lottie.mjs) | run |
| Pack a dotLottie 2.0 container | [scripts/make-dotlottie.py](scripts/make-dotlottie.py) | run |
| Lottie mount, recolour, scroll scrub | [scripts/lottie-helpers.js](scripts/lottie-helpers.js) | run (scrub not asserted) |
| lottie-web five builds and dotLottie as one file each, checked | [scripts/test-lottie.mjs](scripts/test-lottie.mjs) | run, all pass |
| Rive mount wrapper | [scripts/rive-mount.js](scripts/rive-mount.js) | run |
| Rive five ways as one file, inputs, the CDN trap, the wrapper | [scripts/test-rive.mjs](scripts/test-rive.mjs) (needs `RIV`) | run on three files, all pass |
| Hero video with poster, pause, reduced motion | [examples/hero-video.html](examples/hero-video.html) | run |
| Scroll-scrubbed video | [examples/scrub-video.html](examples/scrub-video.html) | run |
| Synthetic test clips | [scripts/make-clips.mjs](scripts/make-clips.mjs) | run |
| The ffmpeg recipe book | [scripts/ffmpeg-recipes.mjs](scripts/ffmpeg-recipes.mjs) | run |
| Every video check (codecs, alpha, seek, captions, WebCodecs, rVFC, hero, scrub) | [scripts/test-video.mjs](scripts/test-video.mjs) | run, all pass |
| Browser, Playwright, ffmpeg discovery; inline-script escape | [scripts/pw.mjs](scripts/pw.mjs) | run |
| Pinned work-folder packages | [scripts/package.json](scripts/package.json) | |

## 5. Quality bars

1. **Offline:** zero requests outside `file:`, `data:`, `blob:` (check the network log: dotLottie and Rive fetch a CDN
   with no URL in the page).
2. **Reduced motion:** no autoplay; a chosen poster frame or poster image; an explicit Play.
3. **Pause control** for anything that moves on its own for more than 5 s; paused off screen and in a hidden tab;
   teardown (`__teardown`, `teardown`, `cleanup`, revoke blob URLs).
4. **Text alternative:** `role="img"` and `aria-label` on meaningful animation, `aria-hidden` on decoration; captions
   for speech; a keyboard path for every pointer-driven Rive input.
5. **Crisp:** sized for the largest display size and device pixel ratio (capped at 2).
6. **Video:** poster equals the first frame; H.264 fallback present; `+faststart`; scrub within one frame at five or
   more positions; alpha proven by a pixel read.
7. **Weight reported, never gated** without a user budget (test pages: Lottie SVG 243 KB, dotLottie 1,674 KB, Rive
   1.20 to 3.13 MB).
8. **Licences:** a ledger row per animation, `.riv` and clip; required credits visible.

## 6. TRAPS

Each: symptom, cause, fix, how it was found.

1. **An "offline" dotLottie page needs the internet.** By default it fetches `dotlottie-player.wasm` from jsdelivr,
   then unpkg; nothing in the page shows a URL, so a no-CDN lint misses it. Fix: `DotLottie.setWasmUrl(dataUrl)`
   before the first player; a wrong explicit URL fails with `loadError` (no CDN fallback). Found: tested (requests
   recorded and blocked).
2. **An "offline" Rive page needs the internet.** The default canvas runtime fetched `rive.wasm` from unpkg, then
   `rive_fallback.wasm` from jsdelivr, then failed. Fix: `canvas-single`, or `setWasmBinary` plus
   `setWasmFallbackUrl(null)`. Found: tested.
3. **Rive fonts or images load from the network.** `enableRiveAssetCDN` defaults to true. Fix: false. Found: reported
   (type definitions).
4. **`stateMachineInputs()` returns nothing.** The machine was not named at construction. Fix: `stateMachines: name`
   in the options. Found: tested on three files and four runtimes.
5. **`Cannot read properties of undefined (reading 'isPlaying')`.** Reading `r.isPlaying` before the file loaded
   (an observer fired first). Fix: only after `onLoad` (`rive-mount.js`). Found: tested here.
6. **State machine inputs will go away.** The 2.45 types mark inputs, runtime events and `stateMachines` (plural)
   deprecated in favour of data binding and `stateMachine`. Fix: inputs still work; plan data binding for new files.
   Found: read here (rive.d.ts).
7. **canvas-lite draws a file wrong without an error.** It has no Rive Text and no audio. Fix: canvas or canvas-single
   for such files. Found: reported (its README), not seen visually.
8. **canvas-single costs 3 MB of JavaScript.** Parse time on low-end phones. Fix: quality first is fine; report it,
   or use canvas-lite when the file allows. Found: measured.
9. **Many Rive or Lottie instances drain the battery.** Each keeps a render loop; `loop` plus `autoplay` keeps lottie's
   rAF alive off screen. Fix: the mount helpers pause off screen and when hidden. Found: reported; pause tested.
10. **lottie-web changes your data.** It mutates the `animationData` object. Fix: clone per instance (`mount` does).
    Found: reported (lane).
11. **Effects vanish in one build.** Light builds drop expressions; canvas drops some effects and blend modes. Fix:
    view the exact build and renderer you ship. Found: reported.
12. **Inlined library or JSON ends the page.** A `</script` inside it. Fix: write `<\/script`; in a JavaScript string
    that is `'<\\/script'` (the lane's `'<\/script'` is the same two characters as `'</script'` and escapes
    nothing). Found: tested here (`pw.mjs` `safe()` was wrong until fixed).
13. **Image-based Lottie weighs megabytes.** Embedded PNGs. Fix: vector-only files. Found: reported.
14. **Recolour misses colours.** Regex on JSON finds only static values. Fix: walk the arrays (`recolor`). Found:
    tested.
15. **Lottie Simple License surprises.** Same-terms on redistribution, no obfuscation, no compiled collections; not
    CC0. Found: reported (licence read by the lane).
16. **Rive Marketplace credit missing.** CC BY: attribution is required and visible. Found: reported.
17. **Shipping the sample `.riv` files.** Authorship unknown. Fix: tests take `RIV`; nothing ships. Found: reported.
18. **HEVC video does not play in Chrome.** `canPlayType` "no", MediaError 4 here. Fix: VP9, AV1 or H.264 beside it,
    never HEVC alone. Found: tested.
19. **ffprobe says the WebM has no alpha.** It reports `yuv420p`. Fix: read pixels in a browser; force the libvpx
    decoder when re-encoding. Found: tested (alpha present before and after re-encode).
20. **Autoplay works in the test and not on the phone.** Automation carries user activation; muted autoplay needs
    `muted` in the markup and `playsinline` on iOS; low-power mode rejects `play()`. Fix: markup plus `catch()` to the
    poster; check on a device. Found: tested (markup), reported (policy).
21. **Captions missing in the delivered file.** A relative `.vtt` beside a strict `file://` page failed (`readyState`
    3); the lane's pass used a developer flag. Fix: `data:text/vtt` or `addTextTrack`. Found: tested here.
22. **A scrub or capture shows the wrong frame.** Drawing straight after `seeked` once returned a frame 79 frames off;
    mid-frame targets land one frame off. Fix: draw after `requestVideoFrameCallback`; snap to `k / fps` plus
    epsilon; one seek in flight. Found: tested here (one stale draw in the first run, none in three runs since), off-by-one tested.
23. **Scrubbing stutters on real footage.** Long GOPs decode from the last keyframe. Fix: GOP 4 to 12, `-bf 0`,
    `preload="auto"`. Found: measured on synthetic clips (times too small to rank), reported for 1080p.
24. **AV1 encodes take ages.** libaom at `cpu-used 4`: 16.4 s for 4 s of 640x360. Fix: encode once, keep the H.264
    fallback; SVT-AV1 untested. Found: measured.
25. **No early playback.** `moov` after `mdat`. Fix: `-movflags +faststart` (checked by byte search). Found: tested.
26. **WebCodecs stalls.** `VideoFrame`s not closed, or decoding from a non-keyframe. Fix: start at the previous
    keyframe, `flush()`, `close()` every frame. Found: tested.
27. **Video colours shift in WebCodecs.** A raw stream carries no colour metadata. Fix: tag bt709 at encode. Found:
    reported (lane).
28. **A big base64 video freezes the page.** Parse and memory. Fix: decode once to a Blob, revoke on teardown.
    Found: reported; both routes seek correctly (tested).
29. **A pause control that one source skipping kills.** A `<source media>` that does not match fires `error`. Fix:
    listen on the last source only. Found: tested (SENSEI-LOG).
30. **Sound after leaving the screen.** A `<video>` removed from the DOM keeps playing. Fix: pause on route change.
    Found: tested (SENSEI-LOG).
31. **A canvas of video frames throws a SecurityError.** Frames of a `file://` video can taint a canvas under strict
    `file://`. Fix: read pixels from `blob:` or `data:` sources (the tests do). Found: reported; avoided by design here.
32. **WebGL2 Rive goes blank after a tab switch on mobile.** Context loss. Fix: handle `webglcontextlost` or use
    canvas. Found: reported.

## 7. Licences

| May be used in projects | Never shipped in the plugin | Ideas only |
|---|---|---|
| lottie-web, dotlottie-web, @rive-app runtimes (MIT, with notices and ledger rows); LottieFiles files under the Lottie Simple License; Rive Marketplace files with the CC BY credit; stock footage after reading its licence; `lottie-helpers.js` and `rive-mount.js` (CC0) | any third-party `.riv`, Lottie or footage file; the rive-wasm sample files (authorship unknown); vendored player builds (installed in the work folder) | none |

Full table: [references/sources-and-licences.md](references/sources-and-licences.md). Every script and example here is
original to this project.

## 8. Verification

```bash
mkdir work && cp scripts/package.json work && cd work && npm install       # the pinned players and esbuild
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-lottie-rive-video/scripts/test-lottie.mjs
RIV=<your .riv> node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-lottie-rive-video/scripts/test-rive.mjs                         # no .riv ships with the skill
FFMPEG=<path to ffmpeg> node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-lottie-rive-video/scripts/test-video.mjs                # FFMPEG_PATH also works
```

Verified (Windows 10, Node 24, Playwright 1.63 found by the plugin's discovery, Chrome 155 headless over strict
`file://`, ffmpeg 7.1 essentials build through `FFMPEG`, Python 3.13):

- `test-lottie.mjs`: 11 checks pass: all five lottie-web builds (60 frames, 2 s, markers, frame 30 after the marker
  seek, ring pixel `[107,99,255,255]`, recolour red, 8x speed in 252 to 264 ms, clean teardown, no request); mount
  holds frame 30 under reduced motion, plays otherwise, pauses when hidden; dotLottie with `setWasmUrl` loads with no
  request and the same pixel; without it, it asks jsdelivr and unpkg.
- `test-rive.mjs` with `statemachine.riv`, `rating_animation.riv` and `truck.riv` from the rive-wasm samples (not
  shipped): 9 checks pass for each: four offline variants load with no request, play, pause, inputs empty before and
  present after naming the machine; the default runtime asks unpkg and jsdelivr; the wrapper plays, holds still under
  reduced motion, pauses when hidden, tears down.
- `test-video.mjs`: 26 checks pass on three consecutive runs (an earlier run failed the GOP 12 seek check with one
  frame 79 off, which led to drawing after `requestVideoFrameCallback`), plus two informational results: HEVC fails to decode
  here (MediaError 4) and a relative `.vtt` fails over strict `file://`.

Not verified: Safari, Firefox, iOS and Android; real autoplay policy; frame rate of Lottie or Rive on real GPUs;
dotLottie worker mode, themes and state machines; Rive Text, audio, data binding and webgl2 pixels; HEVC alpha;
alpha-packed recombination in this skill; an MP4 demuxer for WebCodecs; real footage sizes; `scrub()` in
`lottie-helpers.js` by a test.

## 9. Carried by

- **Agents** (architecture §4 has no dedicated media agent): `sensei-interaction-engineer` for Lottie and Rive
  interface pieces, `sensei-motion-director` when they are part of a film's craft, `sensei-packager` for the single
  file, `sensei-reviewer` (read-only gates).
- **Hooks** (in `plugin/hooks/`, rules in `plugin/lib/lint/`):
  - `lint-web.mjs` (PostToolUse): `autoplay-video` and `lottie` reduced-motion paths, `no-cdn` for URLs written in an
    offline page, `vendored-without-notice`.
  - `lint-3d.mjs`: `empty-media-src`, `draw-before-ready` (a video texture without `playsinline`).
  - `guard-licence.mjs` (PreToolUse, Write and Edit): never-ship and ideas-only sources.
  - `gate-claim.mjs` (Stop): a "done" claim with no fresh gate report.
  - `keep-eol.mjs`: line endings.
  - Not covered by any hook yet (reported to the hook owner): `new DotLottie` without `setWasmUrl`; `new rive.Rive`
    without `setWasmBinary` outside canvas-single, or without `enableRiveAssetCDN: false`; HEVC as the only source; a
    relative `<track src>` in an offline deliverable; a looping video without a pause control. Run the tests above.
