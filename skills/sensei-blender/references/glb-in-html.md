# The animated GLB in one offline HTML file

Bundling three.js into a single file, the general loader rules, troika text, WebGPU and the 3D page contract belong to
`sensei-3d` (`../../sensei-3d/SKILL.md`, and its `references/single-file-three.md` and `references/assets-gltf.md`).
This file covers only what the Blender hand-off adds: a player for an exported, animated GLB with every clip, built
and verified by the scripts in `scripts/web/`.

## 1. Build and verify

```bash
mkdir work && cp ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/package.json work/ && cd work && npm install     # pinned versions
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/glb_audit.mjs model.glb --expect meshopt
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/build_html.mjs model.glb meshopt model.html "Lamp" "Animated desk lamp nodding"
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/verify_page.mjs model.html --shot shot.png
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/verify_page.mjs model.html --reduced
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/capture_frames.mjs model.html frames 8 4 && python ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/contact_sheet.py frames sheet.png
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/gate3d.mjs "model.html" --t=0.7,2.3            # writes the gate report
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/test-web.mjs                                            # the whole chain on the demo model
```

The scripts run in place and take their packages from the current folder (`node_modules` of the work folder). The
browser is `CHROME`, else the plugin's `lib/discover.mjs` (found through `CLAUDE_PLUGIN_ROOT` or the plugin tree).

## 2. What the page does

* three.js bundled by esbuild into one IIFE (global `GLBDEMO`): `GLTFLoader`, `OrbitControls`, `RoomEnvironment`,
  `MeshoptDecoder`, an `InlineDRACOLoader` subclass; 673 KB minified with three 0.186.1 (measured here).
* The GLB as base64 in `<script type="text/plain">` (inert, never executed), parsed with `GLTFLoader.parse`.
* Draco: the decoder-only `libs/draco/gltf/` wrapper (58 KB) and wasm (192 KB) inlined the same way; the subclass's
  `_loadLibrary` returns them from memory, so nothing is fetched. sensei-3d's alternative, `setDecoderPath({ js, wasm })`
  with blob URLs, does the same through a public path; either needs `import.meta.url` defined at bundle time.
* Meshopt: `loader.setMeshoptDecoder(MeshoptDecoder)`, nothing else.
* One `AnimationMixer`, one action per clip with `LoopRepeat`, a checkbox per clip, a speed slider, Pause and Play
  (`aria-pressed`). The model is posed (`mixer.update(0)`, `updateMatrixWorld`, `skeleton.update()`) before it is
  measured, and the camera framed from the world box with an `isFinite` guard.
* The sensei-3d page contract: `window.__done` after the first frame, `?t=` poses that moment with no loop,
  `window.__seek(t)`; reduced motion starts paused with no loop until the viewer presses Play; the loop stops when the
  tab is hidden or the stage is off screen (`IntersectionObserver`); on a context restore the renderer state and the
  PMREM environment are rebuilt (render targets are lost with the context) and the same frame is drawn.
* QA hooks: `document.body.dataset.ready = "1"` and `window.__demo` (`clips`, `codec`, `getTime`, `stats`,
  `setPlaying`, `seek`, `frame`).
* Accessibility: the stage has `role="img"` and an `aria-label` (pass a real description as the fifth argument of
  `build_html.mjs`), real buttons and inputs with focus rings and 36 px targets, forced-colours borders, a readable
  message when WebGL is missing or the model cannot be decoded.

Measured (test-web.mjs): Draco page 1053 KB, Meshopt page 715 KB, 6 draw calls and 2,468 triangles for the demo.

## 3. Options the template leaves to you

* Clips that must run together versus one at a time: the checkboxes allow any combination; for a game, crossfade
  with `action.crossFadeTo(next, 0.3)` instead.
* `<model-viewer>` (Apache-2.0) instead of this player when AR or a poster flow is wanted on a hosted page. It plays
  one clip at a time (`animation-name`) and loads Draco and KTX2 decoders from a Google CDN by default (Meshopt off):
  offline only after setting `dracoDecoderLocation`, `ktx2TranscoderLocation` and `meshoptDecoderLocation`. Not run
  here.
* Above about 5 MB of GLB, ship the file beside the page (base64 parse freezes the main thread) and say the
  deliverable is no longer one file.
* A strict Content Security Policy must allow `worker-src blob:` (DRACOLoader builds its worker from a blob).

## 4. Hand-off rules between Blender and the page

Agree before writing interaction code: what stays editable in the `.blend`, part names (the page looks them up),
units (metres), axes (the exporter converts Z-up to Y-up when `export_yup` is on), pivots, hierarchy, and who owns
each transform at run time. The `AnimationMixer`, interaction code and physics must never write the same transform:
give each part one owner per mode, with explicit transitions. Compare Blender and browser renders under the same
camera, light and exposure; different tone-mapping chains are not expected to match pixel for pixel (method from
3dviz-pro-max, MIT, ideas restated here).
