---
name: sensei-video-pipeline
description: "Turn an HTML, SVG, canvas or WebGL page into a deterministic MP4 and keep the same page playable in a lesson or deck: the seek-page contract (every frame a pure function of t), a dependency-free Chrome DevTools renderer with a determinism probe, resumable chunked renders, parallel workers, shutter motion blur, narration-first timelines, loudness normalisation, captions, contact sheets, and the hand-off to HyperFrames. Use when someone says render the video, export to MP4, make a film from this page, motion blur, frame by frame, deterministic render, the render is different each time, narrated explainer, captions, loudness, HyperFrames or Remotion. Film craft belongs to sensei-motion-graphics; hand-drawn animation to sensei-handmade-animation."
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-video-pipeline

One page, one pure function of time, three front ends: the headless renderer, the interactive player, and stills for
review. No npm packages: Chrome is driven over the DevTools protocol with Node's built-in WebSocket, ffmpeg does the
encoding, and both are discovered (`lib/discover.mjs`), never hard-coded.

## 1. When to use

Rendering any seek page to video; checking that a page renders the same frame every time; building a narrated film
from measured voice lines; mixing, normalising and muxing the soundtrack and captions; making contact sheets of a
master; deciding whether to hand off to HyperFrames.

Another skill owns it instead:

| Request | Skill |
|---|---|
| How the film should move, its transitions, storyboard, reading time, gates G0 to G5 | `sensei-motion-graphics` |
| Hand-drawn, painted, boiling-line character animation and its sheet/strip/crop loop | `sensei-handmade-animation` |
| Synthesising SFX and score, Web Audio, sound in a room | `sensei-audio` |
| A video file used as a hero, background, alpha or scroll-scrubbed element of a page | `sensei-lottie-rive-video` |
| Packaging a page with its film into one offline file | `sensei-single-file` |
| The general gate harness for pages (axe, widths, reduced motion) | `sensei-verify` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Renderer | `render.mjs` (this skill), HyperFrames, Remotion, Node canvas | `references/pipelines-compared.md`; hand off to HyperFrames when a HyperFrames project exists or Studio editing is wanted (`references/hyperframes-handoff.md`) |
| GL mode | `swiftshader` (default), `gpu`, `none` | SwiftShader is deterministic everywhere and was the only reliable path on virtual GPUs; use `gpu` on a real GPU; never mix the two in one film |
| Intermediates | JPEG q95 (drafts), PNG (masters) | masters are encoded once from lossless frames |
| Motion blur | none, page smear, shutter `--shutter N` | one grammar per film; N so each ghost step is a few pixels on the fastest move |
| Chunk size and workers | `--chunk 10 --workers 1` default | long films: chunks so a crash costs little; workers 2 on a small machine |
| Clock in the interactive version | `player.js` with audio as clock, or without audio | narration present: the audio element is the clock |
| Loudness | -14 LUFS (web), -16 LUFS | the delivery platform; true peak at or below -1.5 dBTP either way |
| Captions | `mov_text` track plus `.srt`, plus transcript on the page | any spoken words |

## 3. Core technique

### 3.1 The contract

```js
window.__meta = { dur: 8, fps: 30, w: 1920, h: 1080 };
window.__seek = window.seek = t => { /* set every style, uniform and canvas from t only */ return true; };
window.__ready = document.fonts.ready.then(() => { measure(); window.__seek(0); window.READY = true; return true; });
window.__events = [{ t: 1.4, type: 'hit' }];        // optional: sound cues from the same numbers as the picture
```

Inside seek: no `Date`, `performance.now`, `Math.random`, timers, rAF loops, CSS animations or transitions, playing
media, or state carried from the last frame; integrate motion in closed form (`scripts/spring.js` gives springs that
retarget without breaking position or velocity); measure once after fonts load; WebGL draws synchronously with
`preserveDrawingBuffer: true`. Full rules: `references/contract.md`. A screenshot taken straight after a synchronous
seek is already correct; no rAF wait is needed in the page.

### 3.2 Probe, then render

```bash
node scripts/preflight.mjs out/                          # Chrome, ffmpeg filters, disk, WebGL renderer
node scripts/render.mjs film.html --probe                # same frame in and out of order? ms per frame, estimate
node scripts/render.mjs film.html --sheet 0.5,2,4,6 --out sheet.png      # look before rendering everything
node scripts/render.mjs film.html draft.mp4 --scale 0.5 --chunk 5 --workers 2
node scripts/render.mjs film.html master.mp4 --png --shutter 8 --audio mix.wav --srt captions.srt
node scripts/sheet.mjs master.mp4 && node scripts/sheet.mjs master.mp4 --strip 4.2
```

The renderer adds `?render=1` to the URL, waits for `__ready` (300 s by default), sizes the viewport from
`__meta`, renders resumable chunks (`.part.mp4` renamed only on success), concatenates, muxes audio and captions in
one step and writes `<out>.render.json` (frames, seconds, captures per second, GL renderer, reused chunks).

### 3.3 Narration first, then sound, then mux

```bash
node scripts/timeline.mjs script.json --vo vo/ --srt captions.srt --js timeline.js     # measured lines to beats
node scripts/audio.mjs normalize mix.wav mix-14.wav --lufs -14 --tp -1.5               # two-pass loudnorm
node scripts/audio.mjs mux master.mp4 mix-14.wav final.mp4 --srt captions.srt
```

Generate every voice line in one sitting before building; pin reveals to spoken words; tighten pauses instead of
regenerating; duck music under the voice from a smoothed voice mask; test sync by cross-correlation over a window.
Details and provider traps: `references/audio-captions-sync.md`.

### 3.4 The player half

`scripts/player.js` turns the same film into an interactive player for a lesson or deck (`SenseiPlayer.mount({
stage, audio, captions, poster })`): audio as the clock, scrub, captions, pause when hidden, and under reduced motion
no autoplay and a poster frame. It mounts nothing under `?render`, so one file renders and plays.

### 3.5 Hand-off

HyperFrames' own skills are the authority on HyperFrames; this skill supplies the storyboard, the measured timeline,
and the evidence afterwards (sheets, loudness, gates). `references/hyperframes-handoff.md` lists when to hand off and
the field notes from the Damsel films.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| CDP client: launch own headless Chrome, open, ready, meta, seek, screenshot (with clip), WebGL renderer string, close own process | `scripts/cdp.mjs` | verified |
| Renderer: probe, stills, sheet, chunked resumable render, workers, shutter blur, PNG masters, audio and SRT mux, report | `scripts/render.mjs` | verified |
| Preflight report | `scripts/preflight.mjs` | verified |
| Contact sheet and frame strip from the master | `scripts/sheet.mjs` | verified |
| Narration-driven timeline, SRT, `window.TIMELINE` module | `scripts/timeline.mjs` | verified with synthesised lines |
| Loudness measure, two-pass normalise, safe mux with captions | `scripts/audio.mjs` | verified with a synthesised mix |
| Closed-form springs and sum-of-springs retargeting | `scripts/spring.js`, `scripts/test-spring.mjs` | verified |
| Player half (audio clock, scrub, captions, reduced motion, `?render` off) | `scripts/player.js` | verified headless |
| Skeleton DOM, SVG and canvas seek page (springs, ballistic sparks, stepped counter, fast whip) | `examples/seek-page.html` | verified |
| Raw WebGL2 seek page (opaque, preserved buffer, context-loss redraw) | `examples/webgl-seek.html` | verified under SwiftShader |
| A film that is also a player page | `examples/player.html` | verified |
| End-to-end test of all of the above | `scripts/test-pipeline.mjs [outDir]` | verified, 21 checks |

## 5. Quality bars

- `--probe` deterministic, plus at least five frames straddling every hand-off identical in and out of order.
- Probe render of the hardest 2 to 4 seconds and a sheet of chosen times before the full render.
- A contact sheet and strips of the encoded master looked at, one sentence per frame; "a render that exits 0 proves
  nothing".
- Shutter: each ghost step at most a few pixels on the fastest move (6 sub-frames at 30 fps is the floor, not a
  guarantee).
- Loudness within 1 LU of the target, true peak at or below -1.5 dBTP; a person has listened.
- Captions as a track and as `.srt`; the story works muted; important picture above the caption band.
- Renders resume after a kill without redoing finished chunks; no `.part` files left.
- The report says the GL renderer used and what was not verified on the target device.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Animations never finish in a headless dump | `--virtual-time-budget` does not advance rAF or Web Animations | a real CDP session with real waiting | reported, domain research |
| 2 | Timers and frames freeze in headless or hidden pages | background throttling | `--disable-renderer-backgrounding --disable-background-timer-throttling` (set by `cdp.mjs`) | reported, PDoomVideo, Austerlitz |
| 3 | WebGL canvas empty, white or black in renders | a virtual GPU blanking under load; `CONTEXT_LOST_WEBGL` | SwiftShader (`--gl swiftshader`, HyperFrames `--no-browser-gpu`); diagnose with a one-canvas page first | reported, SENSEI-LOG and ClaudeAnimationBase |
| 4 | Frames from two machines do not match | GPU versus SwiftShader output differs (about 38 dB PSNR) | one renderer for the whole film | reported, motionmaxxing |
| 5 | Shutter blur shows stepped ghosts | too few sub-frames for the speed | more sub-frames, or a smaller angle, or page smear | tested: 6 sub-frames on a 170 px per frame move left 14 px steps |
| 6 | The same frame differs between renders | wall clock, unseeded random, state carried between frames, remote fonts | the contract; `--probe`; embed fonts | reported across all repos; tested probe |
| 7 | Layout shifts offline | Google Fonts or other remote fonts fall back | embed fonts and await `document.fonts.ready` | reported, PDoomVideo, prompt corpora |
| 8 | 13 minutes of rendering lost | a mux called ffmpeg by a relative path (WinError 2) and the next line deleted the source | absolute tool paths; delete only after checking the output; `audio.mjs` never deletes | reported, SENSEI-LOG |
| 9 | A long render refuses to start | multi-worker capture writes every frame to disk first (7.3 GB for 3:55) | stream frames into the encoder (`render.mjs` does; HyperFrames `HF_CAPTURE_PARALLEL_STREAM=true`); check disk with preflight | reported, SENSEI-LOG |
| 10 | A render shows 3 h 30 min instead of 13 min | a contended machine | budget for contention; chunks make it resumable | reported, SENSEI-LOG |
| 11 | Quality loss in masters | JPEG intermediates | `--png` for masters, encode once | reported, Austerlitz, PDoomVideo |
| 12 | Grain makes files huge or frames incompressible | per-frame grain drawn in the page | animated grain in ffmpeg; static noise in the page only | reported, lemo-opuscar |
| 13 | HyperFrames lint `missing_timeline_registry` | `window.__timelines` set in an external file | one inline registration line | reported, SENSEI-LOG |
| 14 | `hyperframes check` cannot screenshot | the machine's GPU path | `snapshot --no-browser-gpu` for review | reported, SENSEI-LOG |
| 15 | Half the narration in another voice | quota ran out mid-batch (ElevenLabs 401 `quota_exceeded`) | generate all lines first; read error bodies | reported, SENSEI-LOG |
| 16 | edge-tts 403 | a slow local clock made the token stale; then the free endpoint refused | correct clock skew; one sitting; keep files | reported, SENSEI-LOG |
| 17 | A sync test reports +533 ms on a synced hit | "maximum change versus loudest onset" in a short window picks the wrong event | cross-correlate motion energy and onset strength over a window | reported, SENSEI-LOG |
| 18 | The music bed is inaudible | it sat 26 dB under the voice | measure stems; about 21 dB under while speaking, 8 dB up in gaps | reported, SENSEI-LOG |
| 19 | A WebGL film times out before frame 0 | slow software GL precomputation | wait up to 300 s for ready (`--timeout`) | reported, Austerlitz |
| 20 | One render in about ten died before its first chunk | a cold Chrome start failed to open its socket | `cdp.mjs` retries a launch once and kills its own failed process | tested |
| 21 | Shutter output has the wrong frame count or blends neighbours | `select='not(mod(n,N))'` picks frames whose tmix window spans two groups | `select='eq(mod(n,N),N-1)'` | reasoned from tmix's sliding window while writing `render.mjs` (the research recipe used `not(mod(n,3))`); the corrected form tested: 12 frames for 0.4 s, blur looked at |
| 22 | `lint-determinism` warns on `cdp.mjs` | it names `window.__seek` in a string and uses timers | expected on renderer code; the warning matters only on film pages | read from the hook source |
| 23 | ESM import of a `C:\` path fails on Windows | `import()` needs a file URL | `pathToFileURL(p).href` (all scripts here do) | reported, claude-animation-skill |
| 24 | Media in a film plays on its own clock | autoplaying `<video>` or `<audio>` | pause it, set `currentTime` from t, await `seeked`; or swap a JPEG sequence | reported, prompt corpus |
| 25 | `src=""` on a film slot loads the page as media | empty `src` resolves to the page URL | keep the data URI in a `data-*` attribute until play; pause films removed from the DOM | reported, SENSEI-LOG |
| 26 | `--probe` fails on an SVG page by a few edge pixels | Chrome caches an SVG filter result (feTurbulence plus displacement); a revisited seed rasterises slightly differently (mean 0.004 levels) | fresh in-order renders are still identical; for a hash-exact film jitter path points in JS instead of a turbulence filter | tested, `sensei-handmade-animation` svg-boil |
| 27 | A render that wrote its MP4 "fails" with exit 13 and "unsettled top-level await" | a protocol call (`Browser.close`) waited for a reply that never came after Chrome dropped the socket; with nothing else pending Node gave up | `cdp.mjs` rejects every pending call when the socket closes or errors or Chrome exits, limits `Browser.close` to 3 s, and closes in a fixed, bounded order | found by the independent QC run (1 in 20), fixed, 11 clean runs |

## 7. Licences

- **Ship and use**: every script and example here (original HTML-Sensei code). ffmpeg and Chrome are called as
  separate programs, never bundled.
- **Ideas only**: Battle-of-Austerlitz-Film and PDoomVideo (no licence: the renderFrame contract, audio as clock,
  chunked resume and the chapter-per-agent method are described, nothing copied); onetake (PolyForm Noncommercial).
- **MIT, notice kept if code is copied into a project**: claude-animation-skill, ClaudeAnimationBase, papermotion,
  lemo-opuscar.
- Voices, music and SFX: record provider, model or library and licence for each file in `.sensei/licences.json`;
  generated audio goes through the paid-generation approval. p5.js inlined in a film is LGPL-2.1: keep its notice
  and keep it replaceable.
- Remotion has company licence terms: check them before commercial use (not verified here).

## 8. Verification

How to prove a film: `preflight.mjs`; `render.mjs --probe`; a sheet before the full render; the full render's
`render.json`; `sheet.mjs` on the master and strips around fast moves, looked at; `audio.mjs measure` on the final
mix; `ffprobe` showing video, audio and subtitle streams; `film-gates.mjs` from `sensei-motion-graphics`.

Verified here by `scripts/test-pipeline.mjs` (24 checks; Windows 10, Node 24.16, Chrome 156 headless with SwiftShader,
ffmpeg 7.1, playwright-core 1.64.1 for the player test; 2026-10-28: six runs in a row of the 21 render checks after the
shutdown fix, then five in a row of all 24, every run passing with no "unsettled top-level await"; the independent QC
batch run before the fix had failed the WebGL render once in 20 with exit 13): determinism of all three examples and the sting;
chunked render on two workers and resume after deleting a chunk; 6 sub-frame shutter with PNG intermediates; WebGL2
under SwiftShader; `cdp.mjs` shutdown (a call pending at close rejects, `close()` is bounded and idempotent, a call
after it rejects at once); narration timeline and SRT from measured WAV lines; loudness normalisation to -14.05 LUFS; mux with
a `mov_text` track; contact sheet and strip; the player (play, scrub, captions, reduced motion, `?render`). The
blurred frame and the strips were looked at.

Not verified: a real GPU (`--gl gpu`); macOS and Linux; 4K; renders longer than a minute; real audio output and
audio-as-clock drift on a device (automation grants autoplay); Safari and Firefox for the player; HyperFrames and
Remotion themselves (not run in this skill); linear-light shutter averaging.

## 9. Carried by

- Agent: `sensei-film-renderer` (preflight, probe, determinism hash, chunked render, contact sheet, honest frame
  rates); `sensei-motion-director` hands it the film and storyboard; `sensei-sound-designer` supplies the mix;
  `sensei-reviewer` reads the sheets.
- Hooks: `lint-determinism.mjs` (PostToolUse on web files with `window.seek`, `__seek` or `renderFrame`: warns on
  wall clock, unseeded random, timers, CSS animation and transitions, free-running GSAP, playing media);
  `gate-claim.mjs` (Stop: when the profile says `film`, a "done" claim needs an MP4, not a `.part.mp4`, and a contact
  sheet newer than the last edit; `sheet.mjs` names its contact sheets `<film>-sheet-<id>.jpg`, which that check recognises);
  `guard-process.mjs` (PreToolUse: refuses paid TTS, music or video generation without an approved plan hash, and
  refuses killing browsers by image name; `cdp.mjs` closes only its own process); `guard-secrets.mjs` (keys never in
  files or command lines); `probe.mjs` (SessionStart: records Chrome and ffmpeg in `.sensei/env.json`).
