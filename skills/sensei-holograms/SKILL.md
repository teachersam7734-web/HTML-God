---
name: sensei-holograms
description: Holograms in HTML with three.js, shipped offline in one file. The hologram material (world-space fresnel rim, scanlines that ride the object, flicker within flash limits, glitch slab, sweep), the sweep swap between two holograms, a figure from one image plus a depth map, a video hologram from an alpha-packed MP4, and a particle hologram sampled from a mesh surface, each seekable, reduced-motion safe and verified headless. Carries the fix for the transposed matrix multiply in the popular hologram materials. Use when the user says hologram, holographic, holo, sci-fi projection, Star Wars style projection, glowing wireframe figure, scanlines, fresnel glow, hologram of a person, hologram from a photo, video hologram, particle hologram, point-cloud figure, materialise, or "make it look like a hologram".
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-holograms

Doctrine first: best quality is the default, never downgrade because this machine is slow, say plainly what was not
verified. Every recipe here was verified for correctness in headless Chrome with SwiftShader; speed was not.

## 1. When to use

Use this skill for any hologram look: a holographic skin on a model, a character or presenter projected as light, a
point-cloud figure, a scan-swap between two objects, a reward or reveal moment in a game or course.

Another skill owns it instead when:

| The job is | Skill |
|---|---|
| Getting three.js into one file, loading the GLB, 3D text, the WebGPU tier, the gate harness | `sensei-3d` (this skill uses its scripts) |
| A full-screen shader background, raymarching, post stack (bloom, chromatic aberration, grain), the render-scale governor | `sensei-shaders-vfx` |
| Making the model or rendering a matte in Blender | `sensei-blender` |
| A hologram inside a film | `sensei-video-pipeline` (pages here are already pure functions of t) |
| A flat "holographic" foil or glass card in CSS | `sensei-ui-components` and `sensei-tokens-theming` (no WebGL) |

Do not reach for WebGL when a CSS gradient, `mix-blend-mode` and a masked video give the impression.

## 2. Decision table

| The subject is | Recipe | Why | Cost |
|---|---|---|---|
| An existing 3D model (product, prop, mascot) | Material hologram (`holo.html`) | fresnel, scanlines, flicker, glitch in about 40 lines of GLSL | three subset about 530 KB |
| A person or character from one picture | Depth-image hologram (`depthholo.html`) | two small WebP files, no 3D capture | about 100 KB of assets (SENSEI-LOG) |
| A person in motion | Video hologram (`vid.html`) | the only route to real motion without capture | a few MB per loop |
| A figure that should feel like a cloud of light, or react to the pointer | Particle hologram (`points-holo.html`) | one draw call, form from wrapped diffuse | count by tier, 60,000 tested |
| A change of state between two objects | Sweep swap (`sweep.html`) | one progress value, seekable | two materials |
| Compute physics on tens of thousands of instances (premium audience) | TSL and WebGPU, as an opt-in tier | compute shaders | 904 KB bundle, every GLSL material rewritten; see `sensei-3d` |

| Sub-choice | Pick | What decides it |
|---|---|---|
| Blending | additive, `depthWrite: false`, `DoubleSide` | the see-through look (default) |
| | `FrontSide` plus a depth pre-pass | an opaque, solid-looking hologram |
| Canvas | opaque, clear colour = page background | default |
| | transparent with premultiplied alpha | when the page shows through; for heavy additive clouds in film, opaque black plus CSS `mix-blend-mode: screen` |
| Video alpha | alpha-packed H.264 | portable (default) |
| | WebM VP9 alpha or HEVC alpha | single-browser targets only |
| | chroma key | only when packing is impossible; despill and erode |
| Depth map | ML monocular depth, run offline | a photo |
| | EDT plus relief plus head dome | a painting, no ML (SENSEI-LOG) |

## 3. Core technique

All pages follow the `sensei-3d` page contract: `window.__done`, `?t=`, `window.__seek(t)`, reduced motion as one
still with glitch and flicker off, pause when hidden or offscreen, resume from elapsed time, context restore that
redraws with the clear colour re-applied.

### 3.1 The material (from `examples/holo.html`)

```glsl
// vertex: world space by matrix * vector. vec4(position, 1.0) * modelMatrix is the transpose: never.
vec4 w = modelMatrix * vec4(position, 1.0);
float slot = floor(uTime * 6.0);                                   // glitch slab at hashed intervals
float inBand = 1.0 - smoothstep(0.0, 0.18, abs(w.y - (hash(slot) * 4.0 - 2.0)));
w.x += (hash(slot + 3.0) - 0.5) * 0.6 * inBand * step(0.82, hash(slot + 9.0)) * uGlitch;
vWorldPos = w.xyz;
vWorldNormal = normalize(mat3(modelMatrix) * normal);              // uniform scale; else the inverse transpose
gl_Position = projectionMatrix * viewMatrix * w;
```

```glsl
// fragment: authored in display space (no colorspace_fragment), on purpose
vec3 V = normalize(cameraPosition - vWorldPos);
float fres  = pow(1.0 - abs(dot(V, normalize(vWorldNormal))), 2.6);
float scan  = mix(0.35, 1.0, pow(0.5 + 0.5 * sin(vWorldPos.y * 90.0 - uTime * 6.0), 3.0));   // rides the object
float sweep = 1.0 - smoothstep(0.0, 0.35, abs(fract(uTime * 0.25) * 6.0 - 3.0 - vWorldPos.y));
float flick = 0.9 + 0.1 * sin(uTime * 53.0) * sin(uTime * 17.0);   // 10 per cent: under the flash limits
vec3 rgb = uColor * (0.22 + fres * 1.7 + sweep * 0.8) * scan * flick;
gl_FragColor = vec4(rgb, max(rgb.r, max(rgb.g, rgb.b)));          // premultiplied-style alpha for additive
```

Material settings: `transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide`. Time is a
uniform you set from `t`, never a wall clock. Put it on any glTF mesh loaded the `sensei-3d` way.

### 3.2 Sweep swap (from `examples/sweep.html`)

Both meshes carry the same shader; one progress value decides what is discarded. Bounds come from the world-space
**bounding sphere**, which rotation cannot change:

```glsl
float ny = (vW.y - uMinY) / (uMaxY - uMinY);
if (uOutgoing > 0.5 && ny < uProgress) discard;        // old: eaten from the bottom up
if (uOutgoing < 0.5 && ny > uProgress) discard;        // new: built from the bottom up
float seam = 1.0 - smoothstep(0.0, 0.03, abs(ny - uProgress));
```

```js
const s = mesh.geometry.boundingSphere, c = s.center.clone().applyMatrix4(mesh.matrixWorld);
const r = s.radius * mesh.matrixWorld.getMaxScaleOnAxis(); u.uMinY.value = c.y - r; u.uMaxY.value = c.y + r;
```

Test: render at progress 0 and 1 and count each mesh's pixels (`window.__sweepTest()`): 0 must show only the old,
1 only the new.

### 3.3 Figure from one image plus depth (from `examples/depthholo.html`)

A 200 by 250 segment plane displaced along z by `(depth - 0.5) * amp`; `discard` where the cut-out alpha is under
0.5; tint from `pow(lum, 1.3)` so a face reads; scanlines in v; reveal from the feet. Fade the slab walls by the
relief's steepness, not by the view angle, and clamp the sway:

```glsl
float dx = (texture2D(uDepth, uv + vec2(uTexel.x, 0.)).r - texture2D(uDepth, uv - vec2(uTexel.x, 0.)).r) * uAmp / (2. * uTexel.x * planeW);
float dy = (texture2D(uDepth, uv + vec2(0., uTexel.y)).r - texture2D(uDepth, uv - vec2(0., uTexel.y)).r) * uAmp / (2. * uTexel.y * planeH);
vSteep = normalize(vec3(-dx, -dy, 1.)).z;              // fragment: col *= smoothstep(.25, .6, vSteep)
float reveal = 1. - smoothstep(0., .06, vUv.y - uReveal);   // uv.y is 0 at the feet
```

Yaw at most about 0.38 rad (22 degrees). Add dots: one point per kept pixel (every second pixel), coloured from the
image, baked as base64 in production. Making the two images: [references/hologram-recipes.md](references/hologram-recipes.md).

### 3.4 Video hologram (from `examples/vid.html`)

```glsl
vec2 uc = vec2(clamp(vUv.x * .5, uHalf.x, .5 - uHalf.x), vUv.y);            // colour half
vec2 ua = vec2(clamp(.5 + vUv.x * .5, .5 + uHalf.x, 1. - uHalf.x), vUv.y);   // matte half
vec3 c = texture2D(uMap, uc).rgb; float a = texture2D(uMap, ua).r;
gl_FragColor = vec4(c * a, a);              // with CustomBlending OneFactor, OneMinusSrcAlphaFactor
```

`uHalf` is half a texel of the real video size (`.5 / videoWidth`, `.5 / videoHeight`). `VideoTexture` with
`colorSpace = SRGBColorSpace`, no mipmaps, linear filters; video `muted`, `playsInline`, `loop`; bytes to a Blob URL;
capture by `pause()`, `currentTime = t`, wait for `seeked`, settle, draw; teardown pauses it.

### 3.5 Particle hologram (from `examples/points-holo.html`)

Sample points by area from the mesh surface (`MeshSurfaceSampler` with `setRandomGenerator` seeded), keep each
point's normal, draw one `Points`. Light each dot from the figure's normal with a wrapped two-light diffuse plus a
rim, so the cloud reads as a form; reveal from the bottom; push dots from the pointer analytically in the vertex
shader (off under reduced motion); fake bloom with a second pass of the same geometry as big faint sprites. Gain per
point falls with count (`0.6 * sqrt(60000 / N)` here). Bake positions in production.

### 3.6 Safety and accessibility

Flicker is a small slow modulation (10 per cent); glitch bands are thin and hashed a few times a second, never a
full-area strobe (WCAG 2.3.1). Under reduced motion: glitch, flicker and pointer push off, reveal complete, one
still. A visible Pause motion control for anything that runs over five seconds (WCAG 2.2.2). The canvas is
`role="img"` with a label; the meaning lives in HTML.

## 4. Recipes

Build vendor bundles with `sensei-3d`'s `scripts/build-vendor.mjs` into `examples/vendor/` (section 8).

| Recipe | File | Bundle entry |
|---|---|---|
| Hologram material, pause control, full contract | [examples/holo.html](examples/holo.html) | [examples/entry-min.js](examples/entry-min.js) |
| Transpose-multiply test (fixed versus `?bug=1`, numeric) | [examples/transpose-test.html](examples/transpose-test.html) | entry-min.js |
| Sweep swap between two holograms, pixel test | [examples/sweep.html](examples/sweep.html) | entry-min.js |
| Figure from image plus depth, skin and dots, steepness fade | [examples/depthholo.html](examples/depthholo.html) | entry-min.js |
| Video hologram from an alpha-packed MP4 | [examples/vid.html](examples/vid.html) | [examples/entry-vid.js](examples/entry-vid.js) plus `vendor/vdata.js` |
| Particle hologram from a mesh surface, pointer push, fake bloom | [examples/points-holo.html](examples/points-holo.html) | [examples/entry-points.js](examples/entry-points.js) |
| The five owner repos: verdicts, ideas, traps | [references/source-repos.md](references/source-repos.md) | |
| Inputs, tuning, Save The Damsel's build, ffmpeg packing | [references/hologram-recipes.md](references/hologram-recipes.md) | |

## 5. Quality bars

1. Fresnel rim symmetric on a moved and turned mesh: `transpose-test.html` measure at most about 1.15 on the offset
   sphere (fixed shader 1.13, bug 1.68 here).
2. Scanlines stay glued to the model when it rotates (world or object y, not screen y), unless a screen overlay is
   wanted, in which case it is a post pass.
3. A pure function of t: two launches give identical frames at the same t (verified for `points-holo.html`).
4. Sweep ends clean: at progress 0 only the old mesh has pixels, at 1 only the new.
5. Video: no visible key fringe at 100 per cent zoom; matte stable between frames; shadow under the feet.
6. Reduced motion: still, glitch and flicker off, reveal complete. Flash safety as section 3.6.
7. One file, no network, no console errors, context loss round trip (all of `sensei-3d`'s `gate3d.mjs`).
8. Particle count tiers chosen and recorded; the high tier exists and is marked "cannot verify at speed here" until it
   runs on the target.
9. No trademarked characters, no real person without consent, a ledger row for every model, image and clip.

## 6. TRAPS

Each: symptom, cause, fix, how it was found.

1. **Rim lopsided on any moved or turned mesh; fine at the origin.** Cause: `vec4(position, 1.0) * modelMatrix` (the
   transpose multiply) in the ektogamat material and its R3F twin. Fix: `modelMatrix * vec4(position, 1.0)` and
   `mat3(modelMatrix) * normal`. Found: tested (lane two-sphere render; measured here 1.68 against 1.13). `lint-3d`
   rule `transpose-matrix-multiply`.
2. **Scanlines slide over a moving model.** Cause: screen-space y. Fix: world or object y. Found: read and run.
3. **Shading undefined on some GPUs.** Cause: `smoothstep` with edge0 above edge1 (two of the five repos, and
   SENSEI-LOG). Fix: `1.0 - smoothstep(b, a, x)`. Found: read; lint rule `reversed-smoothstep`.
4. **Glitch only moves along a diagonal.** Cause: one hash value displaces two axes. Fix: decorrelated hashes. Found:
   read (HOLO.SYS); lint rule `same-random-two-axes`.
5. **Sweep line ends early or late and the whole shape flashes.** Cause: bounds from the un-rotated box compared with
   world y of a rotating mesh. Fix: world bounding sphere (rotation-invariant). Found: read; fix tested here.
6. **Canvas goes black or white where the hologram draws.** Cause: three's `AdditiveBlending` with straight alpha
   piles coverage to 1 on a transparent canvas. Fix: premultiplied-style alpha (`max(rgb)`) or an opaque canvas.
   Found: tested (SENSEI-LOG).
7. **Additive cloud saturates to a white blob in a film.** Cause: premultiplied compositing of a dense additive
   cloud. Fix: opaque black canvas plus CSS `mix-blend-mode: screen`. Found: tested (SENSEI-LOG, video agent).
8. **White-out with many particles.** Cause: per-point gain not scaled with count; strong bloom. Fix: gain about
   1 over the square root of N, then tune; not fewer points. Found: tested (lane, 60,000 points).
9. **A glowing rock instead of a face.** Cause: fresnel on normals from a noisy depth map. Fix: fresnel as accent
   (`pow` 3.2), tint from `pow(lum, 1.3)`. Found: tested (SENSEI-LOG).
10. **The figure reads as a slab when it turns.** Cause: fading by `|dot(N, V)|` fades the walls turned away; the
    stretched walls face the camera. Fix: fade by relief steepness, clamp yaw to about 22 degrees. Found: tested
    (SENSEI-LOG); implemented here.
11. **Reveal shows only a sliver.** Cause: `1.0 - uReveal` while uv.y runs up from the feet. Fix: compare with
    `vUv.y - uReveal`. Found: tested (lane).
12. **Rubber-sheet stretching at the silhouette.** Cause: sharp depth edges. Fix: blur depth slightly, discard a
    border, clamp near the matte. Found: reported (lane).
13. **Green halo round hair in a keyed video.** Cause: RGB-distance key with no despill, and H.264 4:2:0 chroma.
    Fix: alpha-packed video; or despill and erode. Found: read (Three.js-Extras).
14. **Seam line or colour bleed at the middle of a packed video.** Cause: bilinear filtering across the half
    boundary. Fix: clamp each half's uv by half a texel of the real video size. Found: tested.
15. **Video hologram washed or crushed.** Cause: no colour management. Fix: `colorSpace = SRGBColorSpace`. Found: read.
16. **Video will not start on iOS; or seeking is unreliable; or the page loads itself as media.** Cause: no
    `playsInline`; data URI seeking; `src=""`. Fix: `muted playsInline`, Blob URL, never an empty `src`. Found:
    tested (SENSEI-LOG), Safari not tested.
17. **Sound keeps playing after the hologram is gone.** Cause: a `<video>` removed from the DOM still plays. Fix:
    pause on teardown and route change. Found: tested (SENSEI-LOG).
18. **Black frame after a context restore.** Cause: the clear colour does not survive the restore (three 0.186.1).
    Fix: set it each frame or in the restore handler. Found: tested (`sensei-3d`).
19. **Old helper code throws on current three.** Cause: class constructors called without `new`, removed
    `THREE.Math`, `PlaneBufferGeometry`, `type: 't'` uniforms. Fix: port as ES classes. Found: read.
20. **Console full of warnings from the ektogamat class.** Cause: `Clock` deprecated; options passed to
    `setValues`. Fix: own the time uniform; filter options. Found: run.
21. **Shader recompiles on every slider move.** Cause: R3F `useMemo` rebuilds the material per prop. Fix: uniforms
    and refs. Found: read.
22. **A transparent hologram hides its own back.** Cause: depth write left on. Fix: `depthWrite: false`, or a
    deliberate pre-pass. Found: read.
23. **WebGPU particle hologram silently runs on WebGL2, physics differ.** Cause: no adapter, no detection. Fix:
    check `renderer.backend.isWebGPUBackend` after `init()`, keep the WebGL route as default. Found: tested
    (fallback), compute not verified.
24. **Load differs every time; frames not reproducible.** Cause: `Math.random` scatter. Fix: seed the sampler and the
    scatter. Found: read (hologram-particles); fixed and tested here.
25. **Flashing hazard.** Cause: "random flicker per frame" over the full range. Fix: 10 per cent sine flicker, thin
    glitch bands. Found: reported (WCAG 2.3.1).
26. **Debug panels in the delivered page.** Cause: lil-gui, Stats, leva left in. Fix: strip them. Found: read.
27. **A hologram of a known character or a real person.** Cause: reusing repo assets (Star Wars models, a dance
    clip). Fix: own or licensed assets, consent, ledger rows. Found: read.

## 7. Licences

| Source | Licence | Use |
|---|---|---|
| ektogamat vanilla and R3F materials | MIT | may be copied with the notice, but do not: the shader carries the transpose bug; this skill's material is original |
| HOLO.SYS visualiser, Three.js-Extras, hologram-particles | no licence file | ideas only; the `guard-licence` hook blocks their code |
| Their assets (Star Wars GLBs, BB-8, dance clip, skyboxes) | CC-BY of trademarked subjects, or unknown | never, anywhere |
| three.js, `MeshSurfaceSampler` | MIT | yes, keep the bundled notice |
| igloo.inc particle design | the original design the particle repo replicates | do not present a replica as new work |
| Footage of a real person | likeness and personal data | consent and a licence, ledger row |

Everything in this skill's `examples/` is original to this project.

## 8. Verification

Build (a work folder with `three@0.186.1` and `esbuild@0.28.2`; copy `examples/` in):

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/build-vendor.mjs vendor entry-min.js entry-vid.js entry-points.js
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/pack-data.mjs vendor/vdata.js VIDEO packed=packed.mp4
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs holo.html            # and each page below
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/shot.mjs "transpose-test.html?bug=1" bug.png   # prints window.__asym
```

Verified (Windows 10, Chrome 155 with SwiftShader, Playwright 1.63, three 0.186.1):

- `holo.html`, `sweep.html`, `depthholo.html`, `vid.html` (lane's 25 KB test clip, `--t=0.4,1.3`),
  `points-holo.html`: all seven `gate3d.mjs` checks pass, with no console warnings.
- `transpose-test.html`: fixed shader `{ origin: 1, offset: 1.13 }`, bug `{ origin: 1, offset: 1.68 }`; screenshots
  inspected (the bug's offset sphere lit as a vertical band, the fixed one an even rim); `gate3d.mjs --static`
  passes, with Chrome's "GPU stall due to ReadPixels" warning caused by the page's own measurement.
- `sweep.html`: `__sweepTest()` gave `p0: { cyan 19395, amber 0 }`, `p1: { cyan 0, amber 17276 }`; mid-sweep frame
  inspected.
- `depthholo.html`: reveal at t = 0.8 (shoulders only) and t = 2.6 (whole figure) inspected.
- `vid.html`: clean transparent edge inspected at t = 1.3.
- `points-holo.html`: identical md5 for the same t in two launches; pointer push changes the frame (set by script).

Not verified: frame rate of any page on a target device; real cut-outs, depth maps or footage in these pages (Save The
Damsel used real ones, SENSEI-LOG); Safari video; touch input; WebGPU compute; non-uniform scale.

## 9. Carried by

- **Agent:** `sensei-hologram-builder` (given the subject kind, assets, palette tokens, target device class and
  purpose; returns one self-contained page with `__seek`, stills at two times, the lint and gate reports, the weight).
  `sensei-reviewer` checks it read-only.
- **Hooks** (in `plugin/hooks/`, rules in `plugin/lib/lint/three.mjs`):
  - `lint-3d.mjs` (PostToolUse, warns): `transpose-matrix-multiply`, `reversed-smoothstep`, `same-random-two-axes`,
    `reduced-motion`, `context-loss`, `pause-hidden`, `dpr-cap`, `clock-deprecated`, `draw-before-ready`
    (VideoTexture without playsinline), `empty-media-src`, `inline-script-terminator`.
  - `lint-web.mjs` (PostToolUse, warns): `no-cdn` in an offline profile.
  - `lint-determinism.mjs` (PostToolUse on seek pages, warns): unseeded random, timers, playing media.
  - `guard-licence.mjs` (PreToolUse, blocks): code from the three no-licence hologram repos.
  - `guard-process.mjs` (PreToolUse on Bash, blocks): a loader bundle without the `import.meta.url` define.
  - `gate-claim.mjs` (Stop): a "done" claim without a fresh gate report (`gate3d.mjs` writes it).
