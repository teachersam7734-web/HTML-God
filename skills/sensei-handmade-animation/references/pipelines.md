# Routes for hand-made animation

| Route | How it renders | Strengths | Costs and traps | Status here |
|---|---|---|---|---|
| **Canvas seek page in Chrome** (default: `handmade-kit.js`, `examples/hop.html`) | `sensei-video-pipeline/scripts/render.mjs` over CDP | no npm packages; exact in any order; the same file scrubs in a lesson; SVG and DOM can sit on top for real text | Chrome needed; canvas anti-aliasing differs between engines | tested: about 385 ms per 1280x720 PNG capture in a probe, deterministic |
| **Node + `@napi-rs/canvas` + ffmpeg** (claude-animation-skill, MIT) | `frame(ctx, t, i, S)` in Node, frames piped to ffmpeg | no browser, no GPU; its template rendered 120 frames of 1080 square in 8 s; `sheet`, `strip`, `verify`, `render` modes; staged publish | a native dependency in the user's project (not in the plugin); Windows: wrap `import(path)` in `pathToFileURL(...).href`; ffmpeg and ffprobe on PATH and a POSIX `sh` for its sound script; Git Bash PATH entries must be POSIX form; fonts must be registered with `GlobalFonts`; a long 1080p film crashed natively between 20 and 25 s of film time (twice, not diagnosed: render in chunks or by scene) | reported (run in research, not in this skill) |
| **p5 + p5.brush** (ClaudeAnimationBase, MIT; p5 is LGPL-2.1) | headless Chrome over WebGL | the richest watercolour and ink look; a full rulebook and a three-zoom renderer | black frames with `CONTEXT_LOST_WEBGL` on a virtual GPU; 2.8 to 34 s per frame under SwiftShader; author budgets about 1.5 s per frame on a GPU; strokes far from the origin collapse under zoom 2 and above (paint each shape around its own centre); outline weight grows with camera zoom; a NaN point throws an unhelpful error; pigment mixing; a Google Fonts link must be replaced by an embedded font; inlining p5 means shipping its LGPL notice and keeping it replaceable | reported |
| **Stateful paper-cut engine** (papermotion, MIT) | Chromium pages simulate through each other's blocks, frames written in order | springs, bones, Verlet physics, beats, sound from the simulation | frames in increasing order only; `draw` must not change state; pnpm, TypeScript and Vite; do not edit files while it renders; pre-roll removes things built at t = 0; written by agents ("expect rough edges") | read, not run |

Choose the canvas seek page unless the look needs p5.brush's pigment (and a GPU is available to render it) or the
story needs real physics. For a physical moment inside a seek page, precompute a fixed-step simulation in `__ready` and
read the stored states by frame.

## The Node canvas route, when chosen (from the research run)

```bash
npm install                                  # in the user's project: @napi-rs/canvas (prebuilt on Windows)
node film.mjs sheet 0,1,2,3,4                # contact sheet
node film.mjs strip 1.9 12                   # 12 consecutive frames around a fast action
node film.mjs verify                         # frames identical in and out of order: sample frames that STRADDLE every hand-off
node film.mjs render                         # staged: encode to a staging file, publish on success
```

Its `verify` once passed only because the samples missed the moment where state was carried between frames: choose the
samples at the hand-offs. Its sound script takes cues as `{"sfx": "pop", "t": 0.5}` (the key is `sfx`; a wrong key
crashes with `undefined`) and measured -16.4 LUFS integrated, -3.1 dBTP in the research run. Its mascot "critter" and
ClaudeAnimationBase's Clawd are not ours to ship: design original characters.

## Sound for hand-made pieces

Cue sounds from the same plan the picture uses (`window.__events` in `hop.html`); contacts make sound, draw-ons stay
silent; keep SFX at 0.3 to 0.6 of full scale and soft-clip and loudness-normalise the mix (claude-animation-skill);
mixing, synthesis and loudness live in `sensei-audio` and `sensei-video-pipeline`.
