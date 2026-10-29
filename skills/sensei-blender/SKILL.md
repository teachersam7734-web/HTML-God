---
name: sensei-blender
description: Build 3D models and animation with Blender from code and bring them into HTML. Finding Blender (or guiding its install on the user's machine), headless runs with a timeout and an artefact check, bpy scripts that survive the Blender 5 API breaks, shape keys, armatures, Rigify, drivers, Geometry Nodes, baking procedural materials, Cycles renders and turntables, glTF and GLB export with the exporter traps, Draco or Meshopt compression and validation with glTF-Transform, an animated GLB in one offline HTML player, contact sheets, and which Blender MCP server to use when. Use when the user says Blender, bpy, .blend, make the model in Blender, rig it, shape keys, Rigify, Geometry Nodes, bake the textures, render a turntable, export to glTF or GLB, the GLB is too big, compress the model, Draco, Meshopt, gltf-transform, my animation does not play in three.js, Blender MCP, or blender-mcp.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-blender

Doctrine first: best quality is the default, no page-weight budget unless the user asks, never downgrade because this
machine is slow, and say plainly what was not verified. **Blender was not installed where this skill was written.**
Every Blender Python script here is type-checked against the API stubs and **not run**, and says so in its header.
The web half (GLB checks, compression, the single-file player, the frame and contact-sheet QA) was run and passes.

## 1. When to use

Use this skill when Blender is (or should be) the authoring tool: rigs, bakes, sculpted or node-built shapes, dense
procedural geometry, renders for a film, and every step from the `.blend` to a verified GLB in a page.

| The job is | Skill |
|---|---|
| three.js in a page: bundling, loaders in general, 3D text, WebGPU, the 3D gate | `sensei-3d` (this skill links to it, never repeats it) |
| A hologram look on the model | `sensei-holograms` |
| Hand-written shaders and post effects | `sensei-shaders-vfx` |
| Encoding Blender frames into a film, loudness, captions | `sensei-video-pipeline` |
| Alpha video, hero video, scroll-scrubbed video in a page | `sensei-lottie-rive-video` |
| Packing the whole deliverable into one file | `sensei-single-file` |
| A sphere, torus or a few cubes | no Blender: build it in three.js (`sensei-3d`) |


For image-derived assets or recovered human motion, use [community 3D workflows](../sensei-3d/references/community-3d-workflows.md) before asset preparation. It covers texture/camera alignment, topology changes at export, reusable skeletons, foot-contact and self-intersection review, plus model and character rights.

## 2. Decision table

| Choice | Pick | What decides it |
|---|---|---|
| Blender at all | Blender | rigs, bakes, sculpts, node-built materials, dense procedural geometry, render sources |
| | three.js only | the page can generate it in a few lines; a real-time procedural puppet |
| How Blender runs | `blender_run.py` on a script file | always for builds: reproducible, timeout, artefact check |
| | `blender-live` MCP | a person is working in an open scene, or assets must be imported |
| | `blender-lab` MCP | API look-ups for the installed Blender; headless audits of a `.blend` |
| Blender absent | say so, offer the install route, carry on with the web half | never install without the user's yes ([install-and-run](references/install-and-run.md)) |
| Animation into glTF | NLA tracks named after clips, `export_animation_mode="NLA_TRACKS"` | clips by name in `AnimationMixer` |
| Faces | shape keys (visemes) | a bone face is heavy and exports badly |
| Rig | armature from code | two or three joints |
| | Rigify, export deform bones | humanoid or quadruped |
| Procedural | `bmesh` | one object |
| | Geometry Nodes through plain `bpy`, then apply | scatter, arrays; node graphs never export |
| Materials | Principled BSDF | exports as is |
| | bake (`bake_for_web.py`) | anything procedural |
| Compression | Meshopt | animated, rigged, or a single offline page (decoder about 29 KB) |
| | Draco | big smooth static meshes when the 250 KB decoder pays for itself |
| Delivery | GLB inlined in the player | up to about 5 MB of model |
| | GLB beside the page | above that (no longer one file: say so) |
| | rendered video | the viewer should not orbit (no decoder, identical everywhere) |
| Render engine | Cycles CPU | runs everywhere headless; the scripts' default |
| | Cycles GPU or Eevee | the user's machine has a supported GPU (probe it); Eevee needs a graphics context |

## 3. Core technique

### 3.1 Probe, then run headless

```bash
python scripts/blender_locate.py --min 4.2        # JSON; exit 0 either way: absence is data
python scripts/blender_run.py --script scripts/blender/build_scene.py --expect demo.glb --timeout 180 \
    --report run.json -- --out demo.glb
```

The runner always passes `-b --factory-startup --python-exit-code 1`, puts a `.blend` before `--python`, closes
stdin, kills the whole process tree on timeout, and calls a run good only when every expected file exists and is
non-empty, stderr has no `Traceback` or `Error:` line, and the sentinel (`EXPORTED` by default) was printed. Windows
can exit non-zero after a good run: that is reported as `ok_with_nonzero_exit`. When Blender is missing it returns
`blender_missing`; use the message in [references/install-and-run.md](references/install-and-run.md) section 2.

### 3.2 bpy that survives Blender 4.2 to 5.x

Data API first (`bpy.data`, `bmesh`), operators only where needed, with mode, active object and selection set
explicitly. Keyframes through `keyframe_insert` (5.0 removed `action.fcurves`); interpolation through the preference;
version guards marked `VERSION`. Full briefing and the per-release break table:
[references/bpy-rules-and-api-breaks.md](references/bpy-rules-and-api-breaks.md).

```python
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.unit_settings.system, sc.unit_settings.scale_length = "METRIC", 1.0
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.9)
me = bpy.data.meshes.new("Core"); bm.to_mesh(me); bm.free()
core = bpy.data.objects.new("Core", me); sc.collection.objects.link(core)       # keep the reference; names collide
if bpy.app.version < (5, 0, 0): mat.use_nodes = True                             # VERSION: a no-op in 5.0
```

### 3.3 Clips: one NLA track per clip name

```python
def keyed(id_block, clip, insert):
    ad = id_block.animation_data_create(); insert()
    action = ad.action; action.name = f"{clip}_{id_block.name}"
    track = ad.nla_tracks.new(); track.name = clip
    track.strips.new(action.name, int(action.frame_range[0]), action)
    ad.action = None                                    # on the NLA only, or it exports twice
```

Tracks with the same name on the object, the armature and the shape-key datablock merge into one glTF animation.
Loops: last frame equals first, linear keys, then the contact sheet proves it. Rigs, drivers, Rigify, Geometry
Nodes, seeds: [references/animation-rigging-procedural.md](references/animation-rigging-procedural.md).

### 3.4 Export through the RNA filter

```python
props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
want = dict(filepath=out, export_format="GLB", export_apply=False, export_animation_mode="NLA_TRACKS",
            export_force_sampling=True, export_morph=True, export_skins=True, export_cameras=False,
            export_lights=False, export_meshopt_compression_enable=True)
kw = {k: v for k, v in want.items() if k in props}
print("dropped:", sorted(set(want) - set(kw))); bpy.ops.export_scene.gltf(**kw)
```

`export_apply=True` drops shape keys. Procedural materials do not export: bake them. Generate the option table of
the installed Blender with `export_options_dump.py`. Presets and the bake route:
[references/export-gltf.md](references/export-gltf.md).

### 3.5 Audit, compress, validate, then play it

```bash
npx gltf-transform validate model.glb                          # no errors; read every warning
node scripts/web/glb_audit.mjs model.glb --expect meshopt     # per primitive compression, finite bounds, weights
node scripts/web/build_html.mjs model.glb meshopt model.html "Title" "What the model shows"
node scripts/web/verify_page.mjs model.html && node scripts/web/verify_page.mjs model.html --reduced
node scripts/web/capture_frames.mjs model.html frames 8 4 && python scripts/contact_sheet.py frames sheet.png
```

Details: [references/optimise-validate.md](references/optimise-validate.md) and
[references/glb-in-html.md](references/glb-in-html.md). The player follows sensei-3d's page contract, so
`../sensei-3d/scripts/gate3d.mjs` gates it too and writes the gate report the Stop hook reads.

### 3.6 Renders and the contact-sheet gate

Turntable, three-point lights, Cycles CPU, alpha frames, command order, batches and farms:
[references/render-and-video.md](references/render-and-video.md). **No animation is done without a contact sheet**,
for Blender renders and browser captures alike: loop seam under 2, no static steps, no spikes.

### 3.7 MCP servers

The plugin wires two Blender MCP servers, both off until the user turns them on. The rule: builds never need one;
`blender-lab` for API facts and headless `.blend` audits; `blender-live` only when a person works in an open scene
or assets must be imported; one back end per task. Wiring, safety and the full rule:
[references/mcp-servers.md](references/mcp-servers.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Find Blender, never install | [scripts/blender_locate.py](scripts/blender_locate.py) | run (absent; stand-in present) |
| Headless runner, timeout, tree kill, artefact and sentinel | [scripts/blender_run.py](scripts/blender_run.py) | run with a stand-in |
| Type-check bpy offline, with a control | [scripts/check_bpy.py](scripts/check_bpy.py) | run |
| Contact sheet, seam, static, spikes | [scripts/contact_sheet.py](scripts/contact_sheet.py) | run |
| Tests for the four tools above | [scripts/tests/test_python_tools.py](scripts/tests/test_python_tools.py) | run, all pass |
| Demo scene: shape key, torus, orbiters, skinned tube, two NLA clips, Draco or Meshopt GLB | [scripts/blender/build_scene.py](scripts/blender/build_scene.py) | type-checked, not run |
| Geometry Nodes scatter in plain bpy, applied and exported | [scripts/blender/geonodes_scatter.py](scripts/blender/geonodes_scatter.py) | type-checked, not run |
| Two-bone IK arm, bone-driven shape key, Rigify sketch | [scripts/blender/rig_and_drivers.py](scripts/blender/rig_and_drivers.py) | type-checked, not run |
| Turntable camera, three-point lights, Cycles CPU frames, alpha | [scripts/blender/camera_light_rig_and_render.py](scripts/blender/camera_light_rig_and_render.py) | type-checked, not run |
| Bake colour, roughness, normal, AO; pack; rebuild; export | [scripts/blender/bake_for_web.py](scripts/blender/bake_for_web.py) | type-checked, not run |
| Scene checks before export (units, bounds, inside-out, weights) | [scripts/blender/verify_scene.py](scripts/blender/verify_scene.py) | type-checked, not run |
| The installed exporter's option table | [scripts/blender/export_options_dump.py](scripts/blender/export_options_dump.py) | type-checked, not run |
| Demo GLB without Blender (raw, Draco, Meshopt) | [scripts/web/make_demo_glb.mjs](scripts/web/make_demo_glb.mjs) | run |
| GLB audit beyond the validator | [scripts/web/glb_audit.mjs](scripts/web/glb_audit.mjs) | run, controls fail as they must |
| Single-file animated GLB player | [scripts/web/build_html.mjs](scripts/web/build_html.mjs), [template.html](scripts/web/template.html), [entry.js](scripts/web/entry.js) | run |
| Headless page check (ready, clock, blank, network, reduced) | [scripts/web/verify_page.mjs](scripts/web/verify_page.mjs), [cdp.mjs](scripts/web/cdp.mjs) | run |
| Deterministic frame capture | [scripts/web/capture_frames.mjs](scripts/web/capture_frames.mjs) | run |
| The whole web chain as one test | [scripts/web/test-web.mjs](scripts/web/test-web.mjs), [package.json](scripts/web/package.json) | run, all pass |

## 5. Quality bars

1. **Provenance:** every script says which Blender version it ran on, or "not run". Reports say the same.
2. **Run:** headless, under its timeout (previews under a minute), judged by artefact plus sentinel.
3. **Units:** `scale_length == 1.0`; scale applied; world bounds finite; closed meshes have positive volume.
4. **Validity:** `gltf-transform validate` no errors, warnings explained; `glb_audit.mjs --expect <codec>` passes.
5. **Skins:** every skinned vertex has weight, at most 4 influences, joint count stated (under 60 deform bones for a
   web character).
6. **Size, reported against the target device:** hero GLB about 1 MB, hard look above 5 MB; hero about 20k triangles,
   prop about 2k; textures 2048 px or less unless hero. Single-file page measured: 0.72 MB Meshopt, 1.05 MB Draco for
   the demo. Weight is never a gate without a user budget.
7. **Animation:** clips named after intent; contact sheet saved; loop seam under 2, no static steps, no spikes.
8. **Page:** ready and `__done`, clock advancing, frame not blank (pixel check), reduced motion still, no request
   outside `file:`, `data:`, `blob:`, no console errors, labelled stage, keyboard-reachable controls; gate3d passes.

## 6. TRAPS

Each: symptom, cause, fix, how it was found.

**Environment and process**
1. **Told Blender is installed; it is not.** The owner's note and the machine disagreed. Probe first, report absence
   plainly, offer the install. Found: tested (lane: exhaustive search; here: `blender_locate.py`).
2. **The SessionStart probe says "not found" while Blender is there.** `lib/discover.mjs` checks fewer folders than
   `blender_locate.py` (no Downloads portable zips, winget package folder or Chocolatey) and reads `BLENDER_PATH`,
   `BLENDER_BIN`, `BLENDER` but not the lane's `BLENDER_EXE`. Run `blender_locate.py --deep`; it reads all four
   variables. Found: tested here by reading both.
3. **An install or download started without asking.** Blender (350 to 400 MB), BlenderProc (downloads its own
   Blender), ML riggers, `curl | sh` and `irm | iex` installers. Ask first, every time. Found: reported (lane).
4. **A type-checked script reported as working.** It is "type-checked, not run". Found: reported (lane, owner's rule).
5. **The type check passed because it checked nothing.** mypy skips unannotated function bodies without
   `--check-untyped-defs`. `check_bpy.py` always passes it; `--selftest` must fail on its control. Found: tested (lane;
   reconfirmed here).
6. **Exit code 1 after a good export on Windows.** A shutdown allocator warning. Judge by artefact plus sentinel.
   Found: reported (sandraschi executor, glTF-Blender-IO notes).
7. **The script ran on an empty scene.** The `.blend` came after `--python`; arguments run in order (also `-o`
   before `-f` or `-a`). Found: reported (Blender docs, lane).
8. **A timed-out job leaves Blender running.** Killing the first process leaves its children. The runner kills the
   tree (`taskkill /T` or the process group). Found: tested here with a stand-in that starts a child.
9. **`import_scene.obj` missing.** Legacy importers are absent under `--factory-startup`; use `wm.obj_import`.
   Found: reported (sandraschi).
10. **Driver does nothing headless.** Python driver expressions need auto-run scripts; a plugin must not enable it.
    Simple `TRANSFORMS` variables or bake to keys. Found: reported (lane).

**Blender API drift**
11. **`AttributeError: action.fcurves`.** Removed in 5.0 (slotted actions since 4.4). `keyframe_insert` or the
    channelbag walker. Found: reported (release notes, cc-blender-skill).
12. **`scene.node_tree` missing, `use_nodes` ignored, Eevee id rejected.** 5.0: `compositing_node_group`; node trees
    always exist; Eevee is `BLENDER_EEVEE` again (`BLENDER_EEVEE_NEXT` in 4.2 to 4.5). Probe the enum. Found: reported.
13. **Geometry Nodes inputs ignored in 5.2.** `mod["Socket_1"]` no longer works: `mod.properties.inputs.<id>.value`.
    Compare and Random Value identifiers changed: pick sockets by name and type. Found: reported (5.2 notes).
14. **`tree.inputs.new` missing.** Gone since 4.0: `tree.interface.new_socket`. Found: reported.
15. **`TypeError` from the exporter.** An option this Blender does not have (copied from a blog or a stale skill:
    `export_colors`, `export_custom_props`). Filter by `get_rna_type()`. Found: reported (exporter source, local zip).
16. **Rotation keys have no effect.** Only the property matching `rotation_mode` is read; a single 0 to 360 key pair
    does not spin. Found: reported (dcc-mcp-blender, cc-blender-skill).
17. **Half-size or mis-placed parts that pass self-checks.** Cube `size` is full, sphere `radius` half; primitives
    spawn at the 3D cursor; `dimensions` ignores rotation; flush parts are not joined. Found: reported (measured by
    dcc-mcp-blender on the 4.5 LTS series).
18. **Model 100 times too small.** `scale_length` 0.01 is applied on export. `verify_scene.py` fails it. Found:
    reported (measured by dcc-mcp-blender).
19. **Objects "missing" from the scene.** Three independent visibility switches. Found: reported (official MCP brief).

**Export and compression**
20. **Morph targets gone.** `export_apply=True` drops shape keys (presets in old skills set it). Found: reported
    (exporter's own option text).
21. **Black or flat textures.** Procedural shaders do not export; an unsaved bake exports black. Bake, save, pack.
    Found: reported (exporter source; 3dviz-pro-max field test).
22. **Draco left a primitive uncompressed and the file still validates.** Both encoders log and skip. The lane saw it
    for a skinned primitive at the default generic quantisation (`quantizeGeneric: 0` fixed it); not reproduced here
    with the pinned toolchain on the validated demo. Run `glb_audit.mjs --expect draco` every time. Found: reported
    (lane), retested here.
23. **Draco does not shrink the animation.** It compresses geometry only; Meshopt also compresses animation. Found:
    reported (exporter docs), sizes measured (demo 34 KB Draco, 25 KB Meshopt).
24. **`optimize` renamed, merged, instanced and decimated the model.** Its defaults. Pass the five `false` flags or
    use single-purpose commands. Found: tested (lane).
25. **Skinned mesh in the wrong place.** A skinned mesh node must be a scene root with no transform; offset through
    the joints. Zero-weight slots point at joint 0, including a vertex that sits exactly on a joint (weight 0 on the
    next joint): the lane's fixed demo still carried that `ACCESSOR_JOINTS_USED_ZERO_WEIGHT` warning, fixed here in
    `make_demo_glb.mjs`. Quaternions unit length. Found: tested (validator, lane and here).
26. **Wrong look in viewers.** More than 4 influences; emissive above 1.0 (`KHR_materials_emissive_strength`); blend
    alpha sorting; WebP-only textures without a fallback; custom OCIO configs. Found: reported (exporter manual).
27. **IK, constraints, drivers, physics missing in the GLB.** glTF carries TRS, pose bones, shape-key values; the rest
    is sampled or ignored. Bake. Found: reported (exporter source).
28. **Rigify GLB huge.** Hundreds of control and mechanism bones: `export_def_bones=True`. Found: reported (manual).
29. **A valid Draco file that does not decode.** The validator cannot look inside `KHR_draco_mesh_compression`
    (`UNSUPPORTED_EXTENSION` info). Decode it: `glb_audit.mjs` and the browser check. Found: tested here.

**Browser**
30. **The bundle throws "Failed to construct 'URL'"; the global is undefined.** `DRACOLoader` reads `import.meta.url`
    at load. Define it at bundle time (`build_html.mjs` does). Found: tested (lane, SENSEI-LOG).
31. **Blank canvas with `ready` true and normal counters.** Zero skin weights gave NaN bounds and a camera at NaN.
    `isFinite` guard; prove with pixels. `glb_audit.mjs` fails the file. Found: tested (lane; the control here).
32. **Draco fetches its decoder in an "offline" page.** Inline the decoder and override `_loadLibrary` (a private
    method: pin three and rerun `test-web.mjs` on upgrade). Found: tested.
33. **Environment goes dark after a context restore.** The PMREM render target is lost with the context; rebuild it
    in `webglcontextrestored`. The player does; gate3d's ctxloss check passes. Found: tested here.
34. **`<model-viewer>` not offline.** Google CDN decoders by default, Meshopt off, one clip at a time. Found:
    reported (docs).
35. **Page freezes on a big inlined model.** Base64 above about 5 MB. Ship it beside the page. Found: reported.
36. **`THREE.Clock` warning.** Deprecated: `Timer`. Found: tested (lane).
37. **The harness hangs for ever.** Awaiting `onopen` on a socket that already opened. `cdp.mjs` checks
    `readyState`. Found: tested (lane).
38. **The user's browser closed by a test.** Never kill browsers by image name; own `--user-data-dir`, close the
    process you started (`guard-process.mjs` blocks the other). Found: tested (lane).

**Tooling found while building this skill**
39. **`require.resolve('@gltf-transform/cli/package.json')` throws.** Not in the exports map. Walk `node_modules`.
    Found: tested here.
40. **`gltf-transform validate --format json` rejected.** 4.5.1 offers pretty, csv, md. Found: tested here.
41. **`Document.clone()` throws.** Use `cloneDocument()`. Found: tested here.
42. **mypy writes `.mypy_cache` into the scripts folder** even with `--no-incremental`. `check_bpy.py` points
    `--cache-dir` at the temp folder. Found: tested here.
43. **The newest stub wheel does include the glTF exporter's signature** (the lane said add-on operators were
    absent); Rigify operators and `scene.cycles` are still absent. Found: tested here (stub wheel of 2026-10-24).

**Licences**
44. **GPL code copied into the plugin.** Official MCP, geometry-script, NodeToPython, BlenderProc, Flamenco and
    Rigify are GPL: run them, never embed them. Found: reported (each repository's licence).

## 7. Licences

| May be used in projects | Never shipped in the plugin | Ideas only |
|---|---|---|
| Blender and its bundled exporter and Rigify (run them); three.js and loaders (MIT, keep the bundle's licence block); glTF-Transform, meshoptimizer, draco3dgltf (build tools); `<model-viewer>` (Apache-2.0); Poly Haven assets (CC0), other assets per their licence with a ledger row | any GPL tool's code (official MCP, geometry-script, NodeToPython, BlenderProc, Flamenco, Rigify); third-party models; the local `blender-web-pipeline` zip (no licence, wrong facts) | the official MCP's briefing (restated), dcc-mcp-blender's pitfalls and verifier, 3dviz-pro-max's bake method and hand-off rules, cc-blender-skill's layout, sandraschi's executor (all restated in this project's words) |

All code in `scripts/` is original to this project. Full table: [references/sources-and-licences.md](references/sources-and-licences.md).

## 8. Verification

```bash
python scripts/tests/test_python_tools.py                                  # locate, run, contact sheet
python scripts/check_bpy.py --wheel <fake_bpy_module wheel> --mypy-lib <dir> --selftest
python scripts/check_bpy.py --wheel <...> --mypy-lib <dir> scripts/blender/*.py
mkdir work && cp scripts/web/package.json work && cd work && npm install && node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/test-web.mjs
```

Verified (Windows 10, Node 24, Python 3.13 with Pillow 12.2, Chrome 155 headless with SwiftShader, Playwright 1.63,
three 0.186.1, esbuild 0.28.2, glTF-Transform 4.5.1):

- `test_python_tools.py`: all 18 cases pass (locate with a stand-in Blender and `--min`; runner ok,
  ok_with_nonzero_exit, traceback, missing artefact, missing sentinel, timeout with the child process killed, argument
  order, Blender missing; contact sheet seam, static and spike cases).
- `check_bpy.py --selftest` fails its control as it must; the seven Blender scripts give no `likely_real` errors
  (the remaining 4 to 38 per file are stub limits, listed by the tool; a heuristic triage, not a proof).
- `test-web.mjs`: every step passes. Three demo GLBs validate with no errors and no warnings; the audit passes them and fails both
  controls; the Draco (1053 KB) and Meshopt (715 KB) pages load from `file://` with http and https blocked, the clock
  advances, the frame is not blank (coverage 0.22), 6 draw calls and 2,468 triangles; reduced motion holds still;
  nine captured frames give loop seam 0.0; sensei-3d's `gate3d.mjs` passes all seven checks (lint, frames, motion,
  reduced, ctxloss, load, network) on the Draco page.

Not verified: **any Blender run** (all seven Blender scripts, the runner and locator against a real Blender, Eevee,
Cycles timings, Rigify, the bake); either MCP server switched on; frame rate on a target device; Safari and Firefox;
macOS and Linux; KTX2 textures; ffmpeg encodes of Blender frames.

## 9. Carried by

- **Agent:** `sensei-blender-artist` (plans with a connection map, writes script files, type-checks, runs headless,
  exports, audits, builds the player, captures the contact sheet); `sensei-3d-engineer` takes the GLB into a larger
  three.js scene; `sensei-film-renderer` takes rendered frames; `sensei-reviewer` runs the gates read-only.
- **Hooks** (in `plugin/hooks/`):
  - `probe.mjs` (SessionStart): finds Blender, uv and uvx, Chrome, Playwright, ffmpeg; writes `.sensei/env.json`.
  - `guard-process.mjs` (PreToolUse, Bash): blocks an esbuild bundle of three loaders without the
    `import.meta.url` define, killing browsers by image name, paid generation without an approved plan.
  - `guard-licence.mjs` (PreToolUse, Write and Edit): never-ship and ideas-only code.
  - `lint-3d.mjs` and `lint-web.mjs` (PostToolUse): `draco-cdn`, context loss, reduced motion, `no-cdn` offline.
  - `gate-claim.mjs` (Stop): a "done" claim without a fresh gate report (`gate3d.mjs` writes one for the player).
  - `keep-eol.mjs`: line endings.
  - No hook yet checks Blender runs, written `bpy` scripts, written GLBs, or a missing contact sheet; this skill's
    tools do those checks when the agent runs them (reported to the hook owner).
