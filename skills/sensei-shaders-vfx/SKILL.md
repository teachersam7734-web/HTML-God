---
name: sensei-shaders-vfx
description: Hand-written shaders and visual effects in HTML, shipped offline in one file. Raw WebGL2 full-screen shaders with no library, fbm and domain-warped backgrounds that react to pointer and scroll, SDF raymarching, depth parallax from one image, curl-noise particles in one draw call, a post stack (bloom, chromatic aberration, grain, vignette), measured noise dissolves, the render-scale governor that lowers pixels never features, and the licence rules for shader code (lygia, Shadertoy, Inigo Quilez). Use when the user says shader, GLSL, fragment shader, WebGL background, animated gradient background, noise, fbm, raymarching, SDF, metaballs, parallax from a depth map, particles, bloom, glow, chromatic aberration, film grain, dissolve, burn effect, VFX, Shadertoy, or "make the background alive".
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-shaders-vfx

Doctrine first: best quality is the default, never downgrade because this machine is slow (the governor lowers
resolution on the target only when frames are slow there), say plainly what was not verified. Every page here was
verified for correctness in headless Chrome with SwiftShader, which gives no speed numbers.

## 1. When to use

Use this skill for per-pixel effects: living backgrounds behind a hero, a deck or a game; raymarched forms; depth
parallax from a still; particle fields; bloom and grain; dissolves and burns; anything that starts as GLSL.

Another skill owns it instead when:

| The job is | Skill |
|---|---|
| A 3D scene with models, lights, glTF, 3D text, the WebGPU tier, the gate harness and bundling | `sensei-3d` (this skill uses its scripts) |
| A hologram look on a model, a figure, a video or a point cloud | `sensei-holograms` |
| A CSS or SVG effect (blend modes, `backdrop-filter`, `feTurbulence`, masks) | `sensei-motion-ui`, `sensei-landing-hero` |
| A shader effect inside a film | `sensei-video-pipeline` (pages here are already pure functions of t) |
| Brand colours and contrast tokens for text over the effect | `sensei-tokens-theming` |

Use CSS or SVG first for UI-level VFX on reading surfaces; reach for WebGL when the effect needs per-pixel maths or 3D.

## 2. Decision table

| Need | Pick | What decides it |
|---|---|---|
| A background with no model | raw WebGL2, one triangle, one fragment shader | about 4 to 8 KB, no library, trivial to make seekable |
| Shaders on meshes or particles, or a post stack | three.js `ShaderMaterial`, `Points`, `EffectComposer` | about 540 KB bundle, worth it when a scene exists |
| Organic flow behind text | domain-warped fbm (`reactive-bg.html`) | soft field: render at half resolution |
| A form that melts and merges | SDF raymarch with smooth minimum (`raymarch.html`) | fill-rate bound: governor on |
| Depth from a still picture | parallax occlusion (`parallax.html`) | two textures, no mesh |
| | CSS layers with `translate3d` | light cases, no WebGL |
| Thousands of drifting particles | curl noise in the vertex shader (`particles.html`) | no state, one draw call, seekable |
| | GPU ping-pong or WebGPU compute | true trajectories (not tested here) |
| Glow | `UnrealBloomPass` | real bloom on a three scene |
| | second sprite pass, or CSS blur on a duplicate layer | nothing in the render loop |
| Dissolve, burn, reveal by noise | threshold from the measured noise quantiles (`dissolve.html`) | fbm is concentrated round 0.5 |
| Resolution under load | render-scale governor | fill-rate bound pages |
| | count tiers, LOD, instancing | vertex or count bound pages |
| Code from elsewhere | your own, from the maths; iquilezles algorithm code with notice | lygia and Shadertoy defaults are ideas only |

## 3. Core technique

Every page follows the `sensei-3d` page contract (`window.__done`, `?t=`, `window.__seek(t)`, reduced motion as one
still, pause when hidden, a visible Pause motion control for anything over five seconds, context restore).

### 3.1 The raw WebGL2 page

One oversized triangle, one fragment shader, an `init()` that creates every GPU object and runs again after a context
restore (raw WebGL keeps nothing), a static fallback when `getContext` returns null, a render scale in `size()`:

```js
const gl = c.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
if (!gl) { document.body.style.background = 'linear-gradient(#031018,#0a2a3a)'; window.__done = true; return; }
init();                                                                  // program, buffer, textures, uniform locations
c.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; sync(); });
c.addEventListener('webglcontextrestored', () => { lost = false; init(); size(); sync(); });
function size() { const d = Math.min(devicePixelRatio || 1, 2) * scale;
  c.width = Math.max(2, c.clientWidth * d | 0); c.height = Math.max(2, c.clientHeight * d | 0); gl.viewport(0, 0, c.width, c.height); }
```

`#version 300 es` on the very first line, `precision highp float`, constant loop bounds, gamma once on the final
colour with dark values authored in linear terms. Full list: [references/glsl-building-blocks.md](references/glsl-building-blocks.md).

### 3.2 The render-scale governor (from `examples/raymarch.html`)

```js
function makeGovernor({ min = .35, max = 1, fps = 55, onScale }) {   // drop quickly, recover slowly, ignore stalls
  const target = 1000 / fps; let s = max, avg = target, last = 0, cool = 20;
  return { get scale() { return s; }, reset() { last = 0; },
    tick(now) { if (!last) { last = now; return; } const dt = now - last; last = now; if (dt > 250) return;   // stall guard
      avg = avg * .9 + dt * .1; if (--cool > 0) return;
      if (avg > target * 1.25 && s > min) { s = Math.max(min, s * .85); cool = 30; onScale(s); }
      else if (avg < target * .8 && s < max) { s = Math.min(max, s * 1.06); cool = 90; onScale(s); } } };
}
// in the loop: gov.tick(now); draw(t).   onScale: v => { scale = v; size(); }.   reset() when the loop restarts.
```

It lowers pixels, never features. Change scale in steps, not every frame (buffers reallocate). A 30 Hz power-saving
mode looks "slow" to it: compare with a measured refresh if that matters.

**Pin it for review captures.** Under software GL the governor drops to its 0.35 floor, so a gate screenshot taken
here shows the floor tier, not what the target device shows. Every governed page honours `?scale=1` (pin full
resolution, governor off; `?scale=0.5` pins half) and exposes `window.__pinnedScale`:

```js
const pin = q.has('scale') && +q.get('scale') > 0 ? Math.min(2, +q.get('scale')) : null;
let scale = pin ?? +(q.get('s') || 1);
const gov = q.get('gov') === '0' || pin !== null ? null : makeGovernor({ /* ... */ });
```

Gate and review with `page.html?scale=1` for the pictures; run the page once without it to read the governor's
steps (`window.__scales`) and the frame rate, and report the two separately: pictures at full resolution, frame rate
labelled software GL.

### 3.3 Inputs: ease and integrate in JS (from `examples/reactive-bg.html`)

```js
const ease = k => 1 - Math.pow(k, dt);                   // same feel at any frame rate
S.px += (S.tpx - S.px) * ease(.02);
S.drift += (0.05 + S.wind) * dt * .2;                    // integrate: the shader sees only the sum
S.wind *= Math.pow(.25, dt);                             // the wind decays, the drift it caused stays
```

A shader that computes `wind * t` jumps the whole picture whenever `wind` changes. Pointer parallax and scroll wind
are motion: off under reduced motion.

### 3.4 Particles in one draw call (from `examples/particles.html`)

Displacement by the curl of a three-channel gradient-noise potential, computed from `(rest position, seed, t)` in the
vertex shader: divergence-free (no clumping), stateless, seekable. Seeds from an LCG over the index. Gain per point
falls with count; additive, no depth write; `gl_PointSize` times the pixel ratio.

### 3.5 Post stack

`RenderPass`, `UnrealBloomPass`, one custom `ShaderPass` holding chromatic aberration, grain and vignette together,
and `OutputPass` last (tone mapping and sRGB). Grain seeded by `fract(uTime)`. Code, values and cheaper fakes:
[references/post-and-sources.md](references/post-and-sources.md).

### 3.6 A dissolve whose pace is measured (from `examples/dissolve.html`)

Render the noise alone into a small RGBA target, read it back, sort it, keep a 101-entry quantile table, and map
progress to the threshold at that quantile, held just above zero so nothing burns early:

```js
function thr(p) { if (p <= 0) return 0; const x = p * 100, i = Math.floor(x), f = x - i;
  return table[i] + (table[Math.min(100, i + 1)] - table[i]) * f + 1e-3; }
```

Measure coverage the same way (render into an RGBA target and count alpha; a context made with `alpha: false` has
none to count).

### 3.7 Safety

Flicker small and slow, no full-area strobe (WCAG 2.3.1); text above an effect keeps 4.5:1 against the brightest
plausible frame, not the average (give it a backing panel or a scrim); reduced motion is a still, not slower motion.

## 4. Recipes

| Recipe | File | Needs |
|---|---|---|
| Raymarched SDF background, governor, pointer, pause, full restore | [examples/raymarch.html](examples/raymarch.html) | nothing (raw WebGL2) |
| Reactive domain-warped background behind text, eased and integrated inputs | [examples/reactive-bg.html](examples/reactive-bg.html) | nothing |
| Depth parallax with cover-fit, idle when settled | [examples/parallax.html](examples/parallax.html) | nothing |
| Measured noise dissolve with coverage probe | [examples/dissolve.html](examples/dissolve.html) | nothing |
| 60,000 curl-noise particles with bloom, aberration, grain, vignette | [examples/particles.html](examples/particles.html) | `vendor/t-post.js` from [examples/entry-post.js](examples/entry-post.js) |
| Building blocks, conventions, raymarching, parallax, curl, input rules | [references/glsl-building-blocks.md](references/glsl-building-blocks.md) | |
| Post stack, fakes, CSS and SVG routes, licences of shader sources | [references/post-and-sources.md](references/post-and-sources.md) | |

Gate and screenshots: `sensei-3d`'s `scripts/gate3d.mjs` and `scripts/shot.mjs`; bundle: its `scripts/build-vendor.mjs`.

## 5. Quality bars

1. A pure function of t (and of the input state): `__seek(t)` reproduces a frame; grain seeded; no `Math.random`.
2. Reduced motion: one still, pointer and scroll effects off; a Pause motion control otherwise.
3. Fill-rate-bound pages carry the governor or a fixed render scale, and the report says which tiers ran where.
4. Target 16.7 ms per frame on the target device, 33 ms floor on the low tier; "cannot verify at speed here" until
   it runs there. The knob that holds it is named in the report (render scale, octaves, steps, count).
5. A stated colour-space decision at the top of every fragment shader; no washed blacks.
6. Context restore rebuilds everything (raw) or redraws (three); `getContext` null gives a still fallback.
7. No input-driven jumps: changing any rate leaves the current frame unchanged.
8. Text over the effect at 4.5:1 or better against its brightest frame.
9. Every shader snippet is original or carries its permissive notice; nothing from lygia or Shadertoy defaults.
10. All `gate3d.mjs` checks pass: lint, frames, motion, reduced, ctxloss, load, network.

## 6. TRAPS

Each: symptom, cause, fix, how it was found.

1. **Shading fine here, broken elsewhere.** Cause: `smoothstep` with edge0 at or above edge1 (undefined, works on
   ANGLE). Fix: `1.0 - smoothstep(b, a, x)`. Found: tested (SENSEI-LOG); `lint-3d` `reversed-smoothstep`.
2. **Picture jumps when the wind or speed changes.** Cause: `rate * t` in the shader. Fix: integrate in JS, pass the
   sum. Found: tested (SENSEI-LOG); measured here 90.83 per cent of pixels jumped against 0.
3. **Whole page restyles every frame.** Cause: a custom property written on `:root` per frame. Fix: write on the
   effect element, only when the rounded value changes. Found: tested (SENSEI-LOG).
4. **A dissolve does nothing, then everything.** Cause: fbm clusters round 0.5 (here p1 0.23, p50 0.52, p99 0.78), so
   a linear threshold left 98 per cent at a quarter and 3 per cent at three quarters. Fix: threshold from measured
   quantiles. Found: tested (SENSEI-LOG; measured here).
5. **Washed grey blacks.** Cause: gamma applied to dark values authored in display terms. Fix: gamma once on the final
   colour; author darks in linear terms. Found: tested (lane raymarch; again here in the dissolve).
6. **Shader fails to compile only in some builds.** Cause: a newline before `#version 300 es` in a template literal.
   Fix: backtick directly before `#version`. Found: reported (lane).
7. **Noise breaks into blocks on phones.** Cause: `mediump` precision over a large fbm domain. Fix: `precision highp
   float`. Found: reported.
8. **`sin`-hash patterns differ between GPUs or crawl at large inputs.** Cause: precision of `fract(sin(x) * 43758.5)`.
   Fix: polynomial hashes, small arguments. Found: reported.
9. **Glitch moves only along a diagonal.** Cause: one hash value for two axes. Fix: decorrelated hashes. Found: read;
   lint `same-random-two-axes`.
10. **Black or transposed geometry in a custom vertex shader.** Cause: `vec4 * mat4`. Fix: `matrix * vector`. Found:
    tested (lane); lint `transpose-matrix-multiply`.
11. **White blob instead of particles.** Cause: additive points at high gain with strong bloom (60,000 at 0.35). Fix:
    gain about 1 over the square root of N, bloom threshold; not fewer points. Found: tested (lane).
12. **Grain dominates the picture.** Cause: grain 0.06. Fix: 0.025. Found: tested (lane).
13. **Dark, washed output from the post stack.** Cause: no `OutputPass` (tone mapping and sRGB) on current three.
    Fix: `OutputPass` last. Found: tested (lane).
14. **Particles shrink on high-density phones; huge sprites clipped.** Cause: `gl_PointSize` is in device pixels and
    capped by many GPUs (often 64 or 256). Fix: multiply by the pixel ratio, keep sprites modest. Found: reported.
15. **Frame freezes on first use of an effect.** Cause: synchronous compile. Fix: compile during load
    (`compileAsync` in three). Found: reported, not measured.
16. **Raw WebGL page stays blank after a context restore.** Cause: programs, buffers and textures are gone. Fix: one
    `init()` called again on restore. Found: tested here (gate `ctxloss` on every raw page).
17. **Governor drops to the floor in a background tab, or never recovers.** Cause: huge frame gaps from a hidden tab
    or a breakpoint. Fix: the 250 ms stall guard and `reset()` on restart. Found: tested (lane and here: steps 0.85,
    0.72, 0.61, 0.52, 0.44, 0.38, 0.35 under CPU GL).
18. **Pixel-ratio changes flash.** Cause: buffer reallocation on some drivers. Fix: change by steps, at most every
    half second. Found: reported.
19. **Parallax ghosts and smears at depth edges.** Cause: a coarse layer count at discontinuities. Fix: more layers,
    a dilated depth map, less travel. Found: tested (seen in screenshots, lane and here).
20. **Stretched parallax image.** Cause: no cover-fit. Fix: crop with a fit factor from the two aspects. Found: tested
    (lane); fixed here.
21. **An idle parallax still draws every frame.** Cause: a loop that never stops. Fix: stop when the eased offset
    settles. Found: implemented here; the idle loop cost is from SENSEI-LOG (`drawArrays` counting).
22. **Counting alpha returns everything.** Cause: a context created with `alpha: false` has no alpha channel to read.
    Fix: measure in an RGBA render target. Found: tested here.
23. **Shader effect frozen in the desktop browser pane.** Cause: it reports `visibilityState: hidden` (rAF 0 fps).
    Fix: test headless. Found: tested (SENSEI-LOG).
24. **Licence trouble from a pasted snippet.** Cause: lygia (Prosperity or Patron), Shadertoy (CC BY-NC-SA by
    default), the Book of Shaders. Fix: write it from the maths; iquilezles algorithm code with its notice. Found:
    read (lane: lygia README; Shadertoy from secondary sources).
25. **Text unreadable at the effect's peak.** Cause: contrast checked against the average frame. Fix: scrim or panel,
    check the brightest frame. Found: reported.

## 7. Licences

| Source | Licence | Use |
|---|---|---|
| Code in this skill | original to this project | yes |
| three.js and its postprocessing passes | MIT | yes, keep the bundled notice |
| `postprocessing` (pmndrs) | Zlib | yes after bundling, with notice |
| OGL, twgl.js, glslify, `three-custom-shader-material` | Unlicense, MIT, MIT, MIT | yes, with notice |
| iquilezles.org algorithm code | MIT per his homepage (artwork code excluded) | yes, notice kept, check each page |
| lygia | Prosperity (non-commercial) or paid Patron | ideas only, never copied; `guard-licence` blocks it |
| Shadertoy shaders | CC BY-NC-SA 3.0 unless stated | ideas only unless the author states a permissive licence; never pasted |
| The Book of Shaders | believed CC BY-NC-SA | reference only |
| Ashima webgl-noise, Gustavson simplex | believed MIT, unchecked | check the licence file before copying |

## 8. Verification

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/build-vendor.mjs vendor entry-post.js     # only particles.html needs a bundle
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs "raymarch.html?scale=1"        # captures at full resolution
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs raymarch.html                  # governed run: steps and frame rate
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs reactive-bg.html               # and each page
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs parallax.html --static
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs dissolve.html --t=1.6,2.4
```

Verified (Windows 10, Chrome 155 with SwiftShader, Playwright 1.63, three 0.186.1 for the particles page):

- `raymarch.html`, `reactive-bg.html`, `particles.html`, `dissolve.html` (`--t=1.6,2.4`): all seven gate checks pass;
  `parallax.html` passes with `--static`. Load warnings: none, except the dissolve's own "GPU stall due to
  ReadPixels" from its measurement.
- Governor, 25 s at 1280 by 720: `[0.85, 0.72, 0.61, 0.52, 0.44, 0.38, 0.35]`, then held at the floor (same steps as
  the lane's run).
- Scale pin (2026-10-28, Chrome 156, playwright-core 1.64.1): `raymarch.html?scale=1` at 1280 by 720 kept the canvas
  at 1280 px wide for 12 s with no governor step (`window.__pinnedScale` 1, `__scales` empty); the same page without
  the pin had stepped to 0.52 (668 px) in that time. `gate3d.mjs "raymarch.html?scale=1"` and the governed run both
  pass all seven checks.
- Reactive background: a sudden wind change left the frame unchanged (0 per cent); recomputing drift as `wind * t`
  changed 90.83 per cent of pixels.
- Dissolve coverage at p = 0.1, 0.25, 0.5, 0.75, 0.9: shaped 0.928, 0.803, 0.528, 0.187, 0.064; linear 1, 0.983,
  0.601, 0.027, 0. Noise quantiles p1 0.231, p50 0.522, p99 0.78. The shaped curve is close to linear, not exact,
  because the table is measured over the whole noise field and the card covers part of it.
- Parallax: `?x=-1` against `?x=1` moves the near spire against the far sun; the ghost artefact is visible.

Not verified: frame rate on any target device (the governor exists for that); touch and tilt input; 30 Hz displays;
half-resolution bloom's speed-up; GPU ping-pong particles; the CSS and SVG routes; contrast of the reactive page's
text panel over its brightest frame.

## 9. Carried by

- **Agent:** `sensei-shader-artist` (given a mood or one-line brief and the page palette, returns a self-contained
  page with tier switches, runs the lint and a two-time headless render). `sensei-reviewer` checks it read-only.
- **Hooks** (in `plugin/hooks/`, rules in `plugin/lib/lint/three.mjs`, which applies to raw WebGL pages too):
  - `lint-3d.mjs` (PostToolUse, warns): `reversed-smoothstep`, `transpose-matrix-multiply`, `same-random-two-axes`,
    `reduced-motion`, `context-loss`, `pause-hidden`, `dpr-cap`, `no-context-null-check`, `inline-script-terminator`.
  - `lint-determinism.mjs` (PostToolUse on seek pages, warns): unseeded random, wall-clock time, timers.
  - `lint-web.mjs` (PostToolUse, warns): `no-cdn` in an offline profile, `vendored-without-notice`.
  - `guard-licence.mjs` (PreToolUse, blocks): lygia includes and code, Shadertoy-linked code, non-commercial licence
    text in a commercial profile.
  - `guard-process.mjs` (PreToolUse on Bash, blocks): a three loader bundle without the `import.meta.url` define.
  - `gate-claim.mjs` (Stop): a "done" claim without a fresh gate report (`gate3d.mjs` writes it).
