---
name: sensei-3d
description: Real-time 3D in HTML with three.js, shipped as one offline file. Bundling a three.js subset with no CDN, glTF and GLB models (meshopt or Draco, decoded offline), animation clips, 3D text (troika, and browser-shaped labels for Persian and Arabic), the optional WebGPU and TSL tier, React Three Fiber only inside React projects, and the performance, reduced-motion, context-loss and headless-verification rules every 3D page needs. Use when the user says 3D, three.js, WebGL, WebGPU, model viewer, product viewer, GLB or glTF, 3D model in a page, 3D scene, 3D hero, 3D text, R3F, react-three-fiber, Spline, model-viewer, Draco, meshopt, or "make it 3D".
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-3d

Doctrine first: best quality is the default, no page-weight budget unless the user asks, never downgrade because this
machine is slow, and say plainly what was not verified. Everything here was verified for correctness in headless
Chrome with SwiftShader (a CPU GL), which gives no speed numbers.

## 1. When to use

Use this skill for any three.js or WebGL scene in a page: a model or product viewer, a 3D hero object, a framed 3D
stage in a lesson or deck, 3D titles, and for getting three.js into a single offline file at all.

Another skill owns it instead when:

| The job is | Skill |
|---|---|
| A hologram look (fresnel and scanline skin, depth-image figure, video hologram, particle hologram, sweep swap) | `sensei-holograms` |
| A hand-written shader: full-screen background, raymarching, parallax, curl particles, post stack, render-scale governor | `sensei-shaders-vfx` |
| Making or exporting the model in Blender, exporter traps, the animated-GLB player template | `sensei-blender` |
| Rendering a 3D page to video | `sensei-video-pipeline` |
| Packing the whole deliverable (not just three) into one file | `sensei-single-file` |
| Running the full gate harness across a site | `sensei-verify` |

Do not use 3D when a CSS gradient, an SVG filter or a pre-rendered video gives the same impression. Reading surfaces
in a course stay still; 3D goes in a framed, optional, pausable stage.


For image-to-3D assets, video-to-character retargeting or illustrated mesh avatars, first read [community 3D workflows](references/community-3d-workflows.md). It separates offline model authoring from browser playback, adds material/alignment and motion-contact review, and records the upstream model/artwork restrictions.

## 2. Decision table

| Choice | Pick | What decides it |
|---|---|---|
| Engine | vanilla three.js, IIFE subset bundle | the default for single files: about 536 KB minified, no build beyond esbuild |
| | React Three Fiber plus drei | only when the host project is already React (`react: true` in the profile); minimal app 1,154 KB and a bundler |
| | raw WebGL2, no library | a full-screen shader with no mesh: `sensei-shaders-vfx` (page about 4 KB) |
| Renderer | `WebGLRenderer` | default; every GLSL material works |
| | `WebGPURenderer` plus TSL | opt-in premium tier for compute or node-material showpieces; every `ShaderMaterial` must be rewritten |
| Geometry compression | meshopt | default for single files: 29 KB decoder, also compresses animation |
| | Draco | big smooth static meshes where the 250 KB decoder pays for itself (95 KB against 257 KB on the test mesh) |
| Model delivery | base64 inside the page | up to about 5 MB per model |
| | file beside the page | above that; then the deliverable is no longer one file, say so |
| Load timing | bundle in a normal script | 3D on the first screen |
| | inert `<script type="text/x-three">`, compiled on first use | 3D later (lesson widget, win screen) |
| 3D text | HTML over the canvas | anything that must be read, selected or translated |
| | canvas-texture label | titles and labels, and **every Persian or Arabic label** (browser shaping) |
| | troika SDF text | crisp Latin titles moving in depth (TTF or WOFF only) |
| | `TextGeometry` | chunky extruded Latin titles only |
| Viewer | GLTFLoader plus `AnimationMixer` | offline, any clip combination |
| | `<model-viewer>` | AR or poster flow on a hosted page (CDN decoders by default) |
| No-code scene | rebuild in code, or export glTF | Spline cannot run from `file://` and its runtime declares no licence |

## 3. Core technique

### 3.1 The page contract

Every 3D page this plugin writes follows one contract, so one harness can verify it:

- `window.__done = true` after the first frame is drawn;
- `?t=<seconds>` draws that frame and starts no loop; `window.__seek(t)` draws any frame (a pure function of `t`);
- `prefers-reduced-motion: reduce` draws one chosen still frame and starts no loop;
- the loop pauses when hidden or offscreen and resumes from the elapsed time.

### 3.2 three.js into one offline file

Recent three.js ships ES modules only. Export only the names you use, bundle as a classic-script IIFE with a global,
and inline it ([references/single-file-three.md](references/single-file-three.md)):

```js
// examples/entry-starter.js
export { WebGLRenderer, Scene, PerspectiveCamera, Mesh, TorusKnotGeometry, MeshStandardMaterial,
  DirectionalLight, AmbientLight, HemisphereLight, Color, SRGBColorSpace, ACESFilmicToneMapping } from 'three';
```

```bash
npm i three@0.186.1 esbuild@0.28.2            # in a work folder, exact versions
node scripts/build-vendor.mjs vendor examples/entry-starter.js      # -> vendor/t-starter.js, global T
node scripts/inline3d.mjs examples/starter.html starter-single.html  # refuses "</script" and "<!--"
```

`build-vendor.mjs` always defines `import.meta.url`: recent `DRACOLoader` and troika read it at module load and an
IIFE has none, so without the define the bundle throws `Failed to construct 'URL'` and `T` is never created. With
the esbuild CLI, pass `--define:import.meta.url='"https://invalid.local/x/"'` yourself (the `guard-process` hook
blocks a loader bundle without it). Keep the trailing "Bundled license information" block (three is MIT).

### 3.3 The skeleton (from `examples/starter.html`)

```js
let renderer;
try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
catch { showFallback(); window.__done = true; return; }             // no WebGL: the CSS poster stays
function applyRendererState() {                                      // re-applied after a context restore
  renderer.setClearColor(0x070b12, 1); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
}
applyRendererState();

function size() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix(); if (!running()) frame(lastT);
}
function frame(t) { lastT = t; mesh.rotation.y = t * 0.35; renderer.render(scene, camera); }   // pure function of t
window.__seek = frame;

const allowed = () => FIXED_T === null && !mqReduce.matches && !userPaused && !document.hidden && onScreen;
function loop(now) { raf = requestAnimationFrame(loop); elapsed = (now - t0) / 1000; frame(elapsed); }
function sync() {                                   // one gate for every reason to run or stop
  const want = allowed();
  if (!want && running()) { cancelAnimationFrame(raf); raf = 0; }
  if (!running()) frame(mqReduce.matches && FIXED_T === null ? 1.0 : (FIXED_T ?? elapsed));
  if (want && !running()) { t0 = performance.now() - elapsed * 1000; raf = requestAnimationFrame(loop); }
}
mqReduce.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
new IntersectionObserver(es => { onScreen = es[0].isIntersecting; sync(); }).observe(canvas);
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
canvas.addEventListener('webglcontextrestored', () => { applyRendererState(); sync(); });
new ResizeObserver(size).observe(canvas); size();   // after everything size() touches is declared
await renderer.compileAsync(scene, camera);          // compile during load, not on the first visible frame
sync(); window.__done = true;
```

The full page adds the CSS poster as first paint (canvas fades in on its first frame, no fade in seek mode), the
device tier, a visible Pause motion button with `aria-pressed` and a stored choice (WCAG 2.2.2), `role="img"` with a
label, forced-colours styles, and `window.__teardown` that disposes geometries, materials and the renderer and calls
`forceContextLoss()`.

### 3.4 Models with no network

```js
const loader = new T.GLTFLoader();
loader.setMeshoptDecoder(T.MeshoptDecoder);                              // meshopt: nothing else
// Draco: the object form of setDecoderPath, with blob URLs of the decoder-only files from libs/draco/gltf/
draco.setDecoderPath({ js: blob(GLB.dracoWrap, 'text/javascript'), wasm: blob(GLB.dracoWasm, 'application/wasm') });
const gltf = await loader.parseAsync(b64(GLB.meshopt).buffer, '');
gltf.scene.updateMatrixWorld(true);
const box = new T.Box3().setFromObject(gltf.scene);                       // WORLD box: quantised meshes carry scale on the node
if (![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) useDefaultFrame();
```

Compress at build time with glTF-Transform (`scripts/mkglb.mjs`), carry the bytes with `scripts/pack-data.mjs`.
Clips: one `AnimationMixer` per model, `mixer.setTime(t)` in a seekable page. Depth:
[references/assets-gltf.md](references/assets-gltf.md).

### 3.5 Text

troika for crisp Latin: `configureTextBuilder({ useWorker: true, unicodeFontsURL: 'about:blank#' })`, always pass an
embedded TTF or WOFF as a blob URL. Persian and Arabic: draw with canvas 2D `fillText` (the browser shapes it) into a
`CanvasTexture` on a plane (`examples/label-canvas.html`). See [references/text-in-3d.md](references/text-in-3d.md).

### 3.6 The WebGPU tier

`await renderer.init()`, then `render()`; read `renderer.backend.isWebGPUBackend`; write materials in TSL with your
own `uniform` for time; keep a fallback (still or WebGL tier). See
[references/webgpu-r3f.md](references/webgpu-r3f.md) and `examples/gpu-tier.html`.

### 3.7 Performance and accessibility

Pixel ratio capped at 2; render scale and count are the knobs, never features; tiers are a starting point the
target must confirm; reduced motion is a still frame, not a slower loop. Budgets, tiers, flashing limits, teardown,
the gate table and per-use-case rules: [references/perf-a11y.md](references/perf-a11y.md).

## 4. Recipes

Build the vendor bundles first (section 8), then open the page from `file://`.

| Recipe | File | Needs |
|---|---|---|
| Single-file skeleton with every quality rule | [examples/starter.html](examples/starter.html) | `vendor/t-starter.js` from [examples/entry-starter.js](examples/entry-starter.js) |
| GLB inside the page, meshopt or Draco (`?m=draco`), offline | [examples/glb.html](examples/glb.html) | `vendor/t-glb.js` from [examples/entry-glb.js](examples/entry-glb.js), `vendor/glbdata.js` |
| troika SDF text, offline font, worker on or off | [examples/text3d.html](examples/text3d.html) | `vendor/t-troika.js` from [examples/entry-troika.js](examples/entry-troika.js), `vendor/fontdata.js` |
| Browser-shaped label (Persian and Arabic) | [examples/label-canvas.html](examples/label-canvas.html) | `vendor/t-label.js` from [examples/entry-label.js](examples/entry-label.js), `vendor/fontdata.js` |
| WebGPU tier with TSL, fallback and context-loss recovery | [examples/gpu-tier.html](examples/gpu-tier.html) | `vendor/t-gpu.js` from [examples/entry-gpu.js](examples/entry-gpu.js) |
| Bundle a three subset as an IIFE | [scripts/build-vendor.mjs](scripts/build-vendor.mjs) | three and esbuild in the work folder |
| Inline local scripts into one file | [scripts/inline3d.mjs](scripts/inline3d.mjs) | |
| Carry binaries as base64 | [scripts/pack-data.mjs](scripts/pack-data.mjs) | |
| Build meshopt and Draco test GLBs | [scripts/mkglb.mjs](scripts/mkglb.mjs) | glTF-Transform packages |
| One headless screenshot | [scripts/shot.mjs](scripts/shot.mjs) | Playwright, Chrome (discovered) |
| The 3D gate, written as a gate report | [scripts/gate3d.mjs](scripts/gate3d.mjs) | same |
| Browser and Playwright discovery | [scripts/browser.mjs](scripts/browser.mjs) | |

## 5. Quality bars

1. One HTML file, zero requests beyond `file:`, `data:`, `blob:` (gate `network`).
2. Zero page errors and console errors; warnings each explained (gate `load`).
3. Frames at two times both non-blank and different; reduced motion still (gates `frames`, `motion`, `reduced`).
4. Context loss round trip returns the same frame within 2 per cent of the pixels (gate `ctxloss`).
5. Pixel ratio at most `min(devicePixelRatio, 2)`; render resolution follows the canvas box (`ResizeObserver`).
6. A visible pause control for any auto-moving 3D longer than five seconds; pause when hidden or offscreen.
7. No flashing above three per second over a large area; flicker amplitude 10 per cent or less.
8. Canvas labelled (`role="img"` and `aria-label`) or `aria-hidden`; information never only in the canvas.
9. WebGL failure leaves a readable page (poster or message), never a blank.
10. Models: compressed, framed from the world box with a finite guard, textures 2048 px or less unless hero, a
    ledger row each. Report draw calls, triangles and weight; weight is never a gate without a user budget.
11. Target frame time 16.7 ms on the target device with the tier that device gets: "cannot verify at speed here"
    in every report until it runs there.

## 6. TRAPS

Each: symptom, cause, fix, how it was found.

1. **The bundle throws "Failed to construct 'URL'" and `T is undefined`.** Cause: recent `DRACOLoader` (and troika)
   compute file URLs from `import.meta.url` at module load; an IIFE has no `import.meta`. Fix: define it at build time
   (`build-vendor.mjs` always does). Found: tested (3D lane, SENSEI-LOG).
2. **Draco works online, fails offline.** Cause: `setDecoderPath('https://www.gstatic.com/draco/...')` or the
   default URL. Fix: object form `setDecoderPath({ js, wasm })` with blob URLs of the `libs/draco/gltf/` files.
   Found: tested from `file://` with the network blocked.
3. **Black background after a context restore.** Cause: three 0.186.1 re-creates programs and buffers but the clear
   colour set once at start was gone. Fix: re-apply renderer state in `webglcontextrestored` (or set it per frame).
   Found: tested here; `gate3d.mjs` failed `starter.html` and `text3d.html` until fixed.
4. **WebGPURenderer stays blank after a context restore.** Cause: its WebGL2 fallback did not redraw; disposing and
   rebuilding on the same canvas lost the context again. Fix: on loss, swap in a fresh canvas and build a new
   renderer. Found: tested here (`gpu-tier.html`).
5. **Black frame and `Material "ShaderMaterial" is not compatible` under WebGPURenderer.** Cause: it compiles node
   materials only, even with `forceWebGL`. Fix: rewrite in TSL or keep `WebGLRenderer`. Found: tested (lane,
   reconfirmed here).
6. **Persian or Arabic letters drawn apart in 3D text.** Cause: troika-three-text 0.52.5 drew isolated forms with a
   font whose GSUB has `init`, `medi`, `fina`, and logged unsupported GPOS lookups. Fix: canvas-texture label or HTML.
   Found: tested here; this contradicts the research file's "joined correctly".
7. **troika text never appears with a WOFF2 font.** Cause: "woff2 fonts not supported". Fix: convert to TTF or WOFF.
   Found: tested.
8. **troika or drei reach the network in an offline page.** Cause: troika's unicode fallback resolver and drei's
   `Environment preset` and Draco defaults are CDNs. Fix: `unicodeFontsURL: 'about:blank#'` and always a font; own
   files for drei. Found: tested (troika), reported (drei).
9. **Blank canvas while the loader says ready and counters look normal.** Cause: a NaN bounding box (all-zero skin
   weights) put the camera at NaN. Fix: `isFinite` guard on framing; test with a screenshot, not a ready flag.
   Found: tested (Blender lane).
10. **Model sits off-centre or a sweep ends early after compression.** Cause: quantisation stores normalised integers
    and puts the scale on the node, so `geometry.boundingBox` is in the wrong units. Fix: world box from
    `Box3().setFromObject`. Found: tested.
11. **Skinned mesh ignores its offset.** Cause: glTF skinned nodes ignore their own and parents' transforms. Fix:
    offset the joints or armature root. Found: reported (Blender lane).
12. **Page freezes while decoding a big inlined model.** Cause: `atob` plus a byte loop on tens of MB. Fix: above
    about 5 MB, ship the GLB beside the page. Found: reported.
13. **`THREE.Clock` deprecation warning; the scene cannot be seeked.** Fix: own the time (`Timer`, or `t` from
    `__seek`). Found: tested.
14. **First interaction stutters.** Cause: shaders compile on first use. Fix: `renderer.compileAsync` during load.
    Found: reported, not measured. Under SwiftShader it logs a `KHR_parallel_shader_compile` warning (tested).
15. **`ReferenceError: Cannot access 'running' before initialization`, page never ready.** Cause: calling `size()`
    from a `ResizeObserver` set-up before the `let` it reads. Fix: observe after every declaration. Found: tested
    here (gate caught it).
16. **Capture lands half way through a fade.** Cause: the canvas fades in over 0.6 s and the screenshot came at
    0.3 s. Fix: no fade in seek mode. Found: tested here.
17. **Inline script ends early or the rest of the page vanishes.** Cause: vendored text containing `</script` or
    `<!--`. Fix: `build-vendor.mjs` and `inline3d.mjs` refuse it. Found: tested (SENSEI-LOG).
18. **Moving the payloads to the end of the page did not speed it up.** Cause: `DOMContentLoaded` waits for the whole
    document. Fix: call `boot()` directly. Found: tested (SENSEI-LOG, 36.4 s to 10.7 s).
19. **Canvas shows nothing after a theme or route switch.** Cause: measured as 0 by 0 while `display:none`. Fix:
    `ResizeObserver` on the canvas plus an explicit re-fit. Found: tested (SENSEI-LOG).
20. **A hidden canvas still costs its full draw.** Cause: `display:none` or `opacity:0` does not stop the loop. Fix:
    one `shouldRun()` gate per loop. Found: tested (SENSEI-LOG, `drawArrays` counted).
21. **Animations stall when tested in the desktop browser pane.** Cause: it reports `visibilityState: hidden`, rAF at
    0 fps. Fix: test headless. Found: tested (SENSEI-LOG).
22. **WebGL canvas blank or white only in the full page.** Cause: the VMware SVGA virtual GPU under load. Fix:
    one-canvas test, then software GL. Found: tested (SENSEI-LOG).
23. **R3F page recompiles a shader on every slider move.** Cause: `useMemo` material rebuilt on each prop change.
    Fix: uniforms and refs. Found: reported (owner's R3F repo, read).
24. **Spline scene will not open from a file.** Cause: the scene is fetched at run time and needs a server. Fix:
    rebuild or export glTF. Found: reported (Spline docs).
25. **Silent low tier everywhere.** Cause: only the low tier was ever seen on the development machine. Fix: record
    which tiers were verified; the high tier must exist. Found: reported (owner's rule).
26. **Version drift breaks loaders.** Cause: private methods and paths move between three releases. Fix: pin the
    exact version, rerun the gates after any upgrade. Found: tested (Clock and renderAsync deprecations seen).

## 7. Licences

| Source | Licence | In projects | In the plugin |
|---|---|---|---|
| three.js (and its addons, meshopt decoder) | MIT | yes, keep the bundled licence block | the entries and scripts here; no vendored bundle is shipped |
| Draco decoder files | Apache-2.0 (research file) | yes, keep the notice, ledger row | not shipped |
| troika-three-text | MIT | yes | not shipped |
| glTF-Transform, meshoptimizer | MIT | build tools | not shipped |
| `<model-viewer>` | Apache-2.0 | yes, with decoder overrides for offline | not shipped |
| React Three Fiber, drei | MIT | inside React projects | not shipped |
| Spline runtime | no licence declared | only on its own terms, hosted | never |
| Fonts | SIL OFL ones may be embedded; Arial and other system fonts may not | per font | never |
| Models from the owner's hologram repos (Star Wars subjects, CC-BY or no terms) | trademarked or unknown | never | never |

All code in this skill's `examples/` and `scripts/` is original to this project. Nothing here comes from a never-ship
or ideas-only source.

## 8. Verification

Build and run (a work folder with `three@0.186.1`, `esbuild@0.28.2`, `troika-three-text@0.52.5` and the glTF-Transform
packages; copy `examples/` into it):

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/build-vendor.mjs vendor entry-starter.js entry-glb.js entry-troika.js entry-label.js entry-gpu.js
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/mkglb.mjs
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/pack-data.mjs vendor/glbdata.js GLB meshopt=meshopt.glb draco=draco.glb \
  dracoWasm=node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm \
  dracoWrap=node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/pack-data.mjs vendor/fontdata.js FONT ttf=Font.ttf woff=Font.woff
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs starter.html                 # animated pages
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs "glb.html?m=draco" --static  # still pages
```

Browser and Playwright come from `CHROME` and `PW`, or the plugin's discovery (`probe.mjs` writes `.sensei/env.json`).

Verified (Windows 10, Node 24, Chrome 155 with SwiftShader, Playwright 1.63, three 0.186.1):

- `starter.html`: all seven gates pass (one console warning from `compileAsync` under SwiftShader); the single-file
  build from `inline3d.mjs` passes too; pause button, stored choice and teardown exercised by script.
- `glb.html`: meshopt and Draco both pass `--static` with the network blocked.
- `text3d.html`: TTF, WOFF, and TTF without the worker pass `--static`; WOFF2 fails as documented; Persian unjoined.
- `label-canvas.html`: passes, Latin and Persian (Persian joined, inspected).
- `gpu-tier.html`: passes on the WebGL2 fallback; context loss recovers by canvas swap.
- `gate3d.mjs` itself: failed a page with no reduced-motion branch, and pages with no state re-apply after restore.
- `build-vendor.mjs`, `pack-data.mjs`, `mkglb.mjs` (same sizes as the lane), `inline3d.mjs` (and its refusal).

Not verified: frame rate on any target device; the WebGPU backend; KTX2; animated or skinned GLBs in this skill's
pages (the Blender lane tested them); `<model-viewer>`; the glTF-Transform CLI; Safari and Firefox; macOS and Linux.

## 9. Carried by

- **Agent:** `sensei-3d-engineer` (three, assets, compression, single-file 3D); `sensei-reviewer` runs the gate
  read-only. Holograms and shaders route to `sensei-hologram-builder` and `sensei-shader-artist`.
- **Hooks** (in `plugin/hooks/`, rules in `plugin/lib/lint/three.mjs`):
  - `lint-3d.mjs` (PostToolUse on web files that use WebGL or WebGPU, warns): `reduced-motion`, `context-loss`,
    `pause-hidden`, `dpr-cap`, `no-context-null-check`, `transpose-matrix-multiply`, `reversed-smoothstep`,
    `same-random-two-axes`, `clock-deprecated`, `import-meta-in-classic-script`, `empty-media-src`, `draco-cdn`,
    `inline-script-terminator`, `draw-before-ready` (VideoTexture without playsinline).
  - `lint-web.mjs` (PostToolUse, warns): `no-cdn` when the profile is offline, `vendored-without-notice`.
  - `lint-determinism.mjs` (PostToolUse on seek pages, warns): unseeded random, wall-clock time, timers.
  - `guard-process.mjs` (PreToolUse on Bash, blocks): an esbuild bundle of three loaders or troika without
    `--define:import.meta.url`.
  - `guard-licence.mjs` (PreToolUse on Write and Edit, blocks): code from ideas-only sources (the three no-licence
    hologram repos, lygia, Shadertoy) anywhere.
  - `gate-claim.mjs` (Stop): a "done" claim with no fresh passing gate report; `gate3d.mjs` writes that report.
  - `probe.mjs` (SessionStart): finds Chrome and Playwright for the scripts here.
  - `keep-eol.mjs`: line endings unchanged.
