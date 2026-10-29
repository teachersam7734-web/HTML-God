# The seek-page contract

One page, one pure function of time, several front ends: the headless renderer, the interactive player in a lesson
or deck, and the stills used for review. Everything here was either run on this machine (marked tested) or read in
the research files (marked reported).

## What the page exposes

| Name | Required | Meaning |
|---|---|---|
| `window.__seek(t)` (or `seek`, or `renderFrame`) | yes | sets every visible property for time t in seconds; may return a promise (await media decodes inside it) |
| `window.__meta = { dur, fps, w, h }` | yes (dur at least) | duration, frame rate, stage size; `render.mjs` sizes the viewport from w and h. Also read: `DURATION`, `DUR`, `__duration`, `film.total` |
| `window.__ready` (promise) or `window.READY = true` | yes | resolves after fonts, images and precomputation; the renderer waits up to 300 s by default |
| `window.__events = [{ t, type }]` | no | sound cues derived from the same numbers as the picture; written into `render.json` |
| `?render` in the URL | no | `render.mjs` always adds it; a player script mounts nothing when it is present |

Other projects use the same idea under other names (all reported): motionmaxxing `__seek`, `__duration`,
`__timelines.main`; onetake `__seek`, `__meta`, `__ready`, `?play`, `?t=`; lemo-opuscar `render(t)`, `READY`,
`DUR`, `EV`, `TEXTS(t)`; Austerlitz `renderFrame(T)`, `READY`, `film.total`, `?render`; PDoomVideo `renderAt(t)`,
`ready`; HyperFrames registers paused GSAP timelines on `window.__timelines` (see `hyperframes-handoff.md`).
`cdp.mjs` reads `__seek`, `seek` and `renderFrame`; wrap any other name in a one-line `window.__seek`.

## Rules inside seek

1. **Derive everything from t.** No `Date`, no `performance.now`, no `Math.random` (a seeded generator or a hash of
   the element index), no timers, no `requestAnimationFrame` loops, no CSS animations or transitions on film elements,
   no media playing by itself.
2. **No state carried between frames.** No `x += v`; integrate in closed form (ballistic `x0 + v t + a t^2 / 2`,
   springs from `spring.js`). If a simulation is unavoidable, precompute it at a fixed step in `__ready` and read
   the stored states by frame, or adopt papermotion's rule (frames in increasing order only, update separate from a
   side-effect-free draw), which forbids random access.
3. **Measure once.** Text sizes, paths and layout boxes are measured after `document.fonts.ready` and cached; seek
   never measures.
4. **Fonts embedded** as data-URI `@font-face` (or local files) and awaited. Remote fonts make offline renders lay
   out differently (reported, PDoomVideo, gbro, the Opus prompt corpus).
5. **Media**: a `<video>` inside a film is paused; seek sets `currentTime` and awaits `seeked` (and, for exactness,
   one `requestVideoFrameCallback`). The Opus corpus's reliable alternative: extract clips to a JPEG sequence with
   ffmpeg and swap image sources per frame, awaiting each decode (reported).
6. **WebGL**: draw synchronously inside seek; `preserveDrawingBuffer: true`; an opaque canvas; a context-loss handler
   that redraws the last t (tested in `examples/webgl-seek.html`).
7. **Canvas sizes in device pixels**: shadow blur and filter radii scale with the device pixel ratio and the camera
   zoom (reported, onetake).
8. **SVG filters are cached**: a turbulence and displacement filter revisited after a jump differed in a few edge
   pixels from its first rendering (tested); fresh in-order renders match. Hash-exact films jitter geometry in JS.
9. **One-world function**: anything that follows a subject on screen uses the same world-to-screen mapping as the
   subject (reported, lemo-opuscar).

`lint-determinism` (a plugin hook) warns on breaches 1 and on GSAP tweens that play by themselves. It also fires on
Node tooling that names `window.__seek` in a string and uses timers (our `cdp.mjs`): those warnings are expected on
renderer code, not on films.

## Proving the contract

`render.mjs page.html --probe` seeks four times in order, then each time again after a detour to another time, and
compares PNG hashes; it also reports milliseconds per capture, the WebGL renderer and a time estimate. Probe at
least five frames straddling every hand-off before a long render; motionmaxxing's `selfTest` idea (compare DOM state
after sequential play and after random jumps) catches differences that pixels hide, such as an invisible element
left with the wrong state.

Tested here (Chrome 155 headless, SwiftShader): all three examples and the motion-graphics sting give identical
hashes in any order. A screenshot taken straight after a synchronous seek was already correct, with no
`requestAnimationFrame` wait in the page: `Page.captureScreenshot` produces a fresh frame.

## The player half

`scripts/player.js` adds controls to the interactive version: audio as the clock while it plays (the picture cannot
drift from the sound), a range input to scrub, captions, pause when hidden, and under reduced motion no autoplay
and a poster frame (the last frame by default). The film page itself never owns a clock, so the same file renders
and plays. The audio-as-clock and `?render` split follow Austerlitz's architecture (idea only).
