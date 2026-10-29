# Performance, accessibility and verification for 3D pages

Sources: `domain-3d-performance-accessibility.md` in the HTML-Sensei build project's research notes (not shipped), SENSEI-LOG, and the runs for this skill.

Owner's standing rule: never downgrade or drop an effect because the development machine struggles. This file gives
knobs and tiers for the **target** device. Where speed cannot be measured here (always, with SwiftShader), say
"cannot verify at speed here" and ship the tier switch. A tier switch that silently ships the low tier everywhere,
because nobody tested high, is a downgrade too: record which tiers were verified.

## Starting budgets (measure on the target)

Third-party figures (a 2026 three.js best-practice article fetched by the lane, plausible, not measured here):

| Item | Starting point |
|---|---|
| Draw calls per frame | about 100 on mobile; several hundred to low thousands on desktop |
| Vertices | under 100,000 on mobile "if you can"; draw calls matter more than triangles |
| Instancing | `InstancedMesh` draws 1,000 copies in one call; 60,000 `Points` drew in one call here |
| Pixel ratio | `Math.min(devicePixelRatio, 2)`; lower for fill-rate-bound shaders |
| Textures | 2048 px unless a hero asset (4096 RGBA is about 64 MiB, 85 MiB with mips) |
| Dynamic lights | 3 or fewer to start; a point-light shadow costs 6 renders |
| Shadow maps | mobile 512 to 1024; desktop 1024 to 2048 |
| CPU-updated particles | tens to low hundreds of thousands; GPU compute far more |
| Compile hitch | `renderer.compileAsync(scene, camera)` during load (used in the starter; it logged "KHR_parallel_shader_compile extension not supported" under SwiftShader, a warning from this machine's GL, not an error) |
| Frame time | 16.7 ms (60 fps) on the target; 33 ms floor on the low tier |

Report `renderer.info.render.calls` and `triangles` and the page weight. Weight is reported, never a gate, unless the
user set a budget.

## Knobs, in order

1. **Render scale** for fill-rate-bound work (full-screen shaders, raymarching, heavy post): the governor in
   `sensei-shaders-vfx` (`makeGovernor`, tested: drops quickly, recovers slowly, ignores stalls over 250 ms). It
   lowers resolution, never features.
2. **Count** for particles and instances (tier table below).
3. **LOD or instancing** for vertex-heavy meshes.
4. Pixel-ratio changes reallocate buffers: change by steps, at most every half second, never every frame.

## Device tier (a starting point; a first-second frame probe is more reliable)

```js
function pickTier() {
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
  if (coarse && (mem <= 2 || cores <= 4)) return 'low';
  if (coarse || mem <= 4) return 'mid';
  return 'high';
}
const TIERS = { still: { count: 0, scale: 1, post: false, loop: false }, low: { count: 8000, scale: .6, post: false, loop: true },
                mid: { count: 25000, scale: .85, post: true, loop: true }, high: { count: 60000, scale: 1, post: true, loop: true } };
```

`navigator.deviceMemory` exists in Chromium only. Not measured on devices.

## Reduced motion, pausing, flashing (built in, never added)

1. Reduced motion at load: no `requestAnimationFrame` loop; one still frame at a chosen `t`; redraw only on input or
   resize. Interaction-driven motion (pointer parallax, tilt) is off too.
2. Listen for changes: `matchMedia(q).addEventListener('change', sync)`.
3. A visible pause control for auto-moving content that runs longer than five seconds beside other content (WCAG
   2.2.2, Level A). Store the choice (`localStorage` in try/catch). The starter does this and was exercised.
4. Pause when hidden (`visibilitychange`) and offscreen (`IntersectionObserver`); resume from the elapsed time so the
   scene never jumps.
5. Flashing (WCAG 2.3.1, Level A): no more than three flashes in any second above the thresholds. Hologram flicker
   stays a small slow modulation (the reference is 10 per cent); no full-area strobe; glitch bands thin.
6. Never convey information only through the animation.
7. Canvas: `role="img"` plus `aria-label`, or `aria-hidden="true"` if decorative. Focus enters only if it is
   interactive, then with keyboard controls and visible focus. Controls are real `<button>`s, 36 px or more.
8. A loop that is not visible still costs its full draw: a canvas under `display:none` or `opacity:0` draws every
   frame. One `shouldRun()` gate per loop, restarted from route, theme and visibility changes (SENSEI-LOG). Count
   `drawArrays` per canvas (wrap the prototype in an init script) to prove a loop is idle.
9. A canvas measured while `display:none` is 0 by 0: `ResizeObserver` on the canvas re-fits it when it is laid out.

## Robustness

- `new WebGLRenderer()` throws when WebGL is unavailable, and raw `getContext` returns null: keep a CSS or still
  fallback (starter: poster stays, message shown).
- Context loss: `preventDefault` on `webglcontextlost`, redraw on `webglcontextrestored`. three re-creates programs
  and buffers, but **renderer state such as the clear colour did not survive** (three 0.186.1, tested here: black
  background after restore until `setClearColor` was called again). Re-apply renderer state in the restore handler,
  or set it each frame. Raw WebGL pages re-create programs, buffers and textures themselves.
- `WebGPURenderer` on its WebGL2 fallback did not redraw after a restore, and rebuilding it on the same canvas lost
  the context again; swapping in a fresh canvas with a new renderer recovered (tested, `examples/gpu-tier.html`).
- Shader compile errors throw with the info log: show the still, never swallow it.
- `setSize(w, h, false)` so CSS owns the canvas size; `ResizeObserver`, not `window.resize`.
- Teardown for a mounted widget: dispose geometries, materials, textures and render targets, `renderer.dispose()`,
  `renderer.forceContextLoss()`, cancel the loop, pause any video; watch `renderer.info.memory` stay flat. Material
  clones need their own `dispose()`.

## Headless verification (no GPU needed)

`scripts/gate3d.mjs` runs the automatable gates and writes `.sensei/gate/<name>.json` for the Stop hook:

| Check | Pass when |
|---|---|
| lint | `lib/lint/three.mjs` finds no fail-level rule |
| frames | `?t=A` and `?t=B` are both non-blank (luminance spread above 1.5) and differ |
| motion | without `?t`, two frames 0.9 s apart differ |
| reduced | with `reducedMotion: 'reduce'`, two frames 0.9 s apart are identical |
| ctxloss | after a `WEBGL_lose_context` round trip the frame is back within 2 per cent of the pixels |
| load | no page errors, no console errors (warnings listed) |
| network | nothing but `file:`, `data:` and `blob:` was requested |

Field notes: the desktop browser pane and extension tabs report `visibilityState: hidden`, so rAF runs at 0 fps there:
test headless. SwiftShader takes seconds per heavy frame: assert on state and fixed-`t` frames, not wall-clock timing.
Fixed viewport for comparisons. A page with a fade-in must skip the fade in seek mode, or a capture lands half way
(found here). The VMware SVGA virtual GPU blanks WebGL canvases under load: diagnose with a one-canvas page and
render with software GL (`--no-browser-gpu` in HyperFrames).

## Per use case

| Use case | Default | Rules |
|---|---|---|
| Landing hero | one shader background or one hologram, tiered, CSS poster first | start WebGL after load; pause offscreen |
| Presentation | 3D on one or two slides | lazy bundle per slide; reduced-motion still per slide |
| Course (Ultra Bookworm) | small framed stage for a concept or a reward | reading surfaces stay still; 3D optional and pausable; inert-script compile |
| Game (Save The Damsel) | shader backdrop, hologram reward | `visibilitychange` also pauses game timers; backstop timers on animation-gated logic |
| Dashboard | rarely 3D; SVG and canvas 2D; WebGL for big scatter plots | motion off by default |
| Film | pure function of `t` rendered by `sensei-video-pipeline` | software GL, determinism hash |
