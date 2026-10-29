# Audit, compress and validate GLBs (glTF-Transform)

glTF-Transform (MIT, Don McCurdy) reads, edits and writes glTF in Node with no Blender and no browser. It is the second
half of the pipeline: Blender exports, glTF-Transform audits and compresses. Versions verified here are pinned in
`scripts/web/package.json` (core, extensions, functions and cli 4.5.1, `draco3dgltf` 1.5.9, `meshoptimizer` 1.3.0).

## 1. Commands

```bash
npx gltf-transform validate asset.glb          # Khronos glTF-Validator: errors, warnings, infos
npx gltf-transform inspect asset.glb           # scenes, meshes, materials, textures, animations, sizes
npx gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024 \
    --simplify false --flatten false --join false --instance false --palette false
npx gltf-transform meshopt in.glb out.glb      # or: draco, resample, webp, resize --width 1024 --height 1024
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/glb_audit.mjs out.glb --expect meshopt    # what validate does not check
```

`glb_audit.mjs` fails on: a primitive left uncompressed when compression was expected (per primitive, read from the
file's own JSON), non-finite POSITION bounds or scene bounds, skinned vertices whose weights sum to zero. It warns on
more than 4 influences, more joints than the budget (60 by default), unnamed clips; it reports size, triangles,
extensions, skins and clip durations.

## 2. In code (decoders and encoders are explicit dependencies)

```js
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, meshopt, prune, dedup, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('in.glb');
await doc.transform(prune(), dedup(), weld(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
// or Draco: draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 })
await io.write('out.glb', doc);
```

Without the registered dependency, reading a compressed file throws "Please install extension dependency". A Document
that already carries Draco cannot also carry Meshopt: re-read the raw file for the other codec. `Document.clone()` is
gone: `cloneDocument(doc)` from `@gltf-transform/functions` (tested here, 4.5.1). The Node decoder (`draco3dgltf`) is a
different package from the decoder three.js loads in the browser; matching builds, not the same files.
`scripts/web/make_demo_glb.mjs` builds a whole animated model with the Document API (accessors, a morph target, a skin
with inverse bind matrices, two clips) and is the worked example.

## 3. Choosing compression

| Asset | Choice |
|---|---|
| Rigged or animated, or any single offline page | Meshopt: compresses geometry **and** animation, decoder about 29 KB inline |
| Big smooth static mesh, page already ships a Draco decoder | Draco: smaller geometry (95 KB against 257 KB on sensei-3d's test mesh), decoder 58 KB wrapper plus 192 KB wasm |
| Small hand-tuned asset addressed by node name | compress only (`meshopt` or `draco` commands), never the `optimize` defaults |
| Textures | WebP through `sharp` (a native dependency of the CLI); KTX2 needs the `toktx` binary from KTX-Software (not verified here) |

Demo sizes (this skill's test, the same as the lane): raw 67 KB, Draco 34 KB, Meshopt 25 KB.

## 4. Quality bars

* `validate`: no errors; every warning read and fixed or explained. It does not validate inside
  `KHR_draco_mesh_compression` (it reports `UNSUPPORTED_EXTENSION` as an info, seen here), so a Draco file that
  validates is not yet proven to decode: `glb_audit.mjs` decodes it, and the browser check plays it.
* `glb_audit.mjs --expect <codec>` passes: every primitive compressed, finite bounds, no zero-weight skin vertices.
* Size and triangles reported against the target device's budget (hero GLB about 1 MB, hard look at anything over
  5 MB; hero about 20k triangles, prop about 2k). Weight is reported, never a gate, unless the user set a budget.
* The page's loader has the matching decoder registered, proved by loading the final file headless (`verify_page.mjs`).

## 5. Traps

1. **`optimize` defaults rewrite the asset.** It runs instance, palette, simplify, flatten, join, prune, sparse,
   resample, texture recompression (auto, max 2048) and meshopt. On the demo it merged three identical cubes into one
   GPU-instanced node (names `Orbiter2` and `Orbiter3` gone), removed the named root `TentacleRoot`, added an unnamed
   node, and visibly decimated a 128-vertex tube. Code that calls `getObjectByName` breaks. Fix: the five `false`
   flags above, or the single-purpose commands. Found: tested (lane).
2. **Draco skipping a skinned primitive.** The lane saw the encoder return zero bytes for a primitive carrying
   `JOINTS_0` and `WEIGHTS_0` at the default generic quantisation, log "Skipping primitive compression" and write a
   valid file anyway; `quantizeGeneric: 0` fixed it. Re-tested for this skill on the validated demo with the pinned
   versions: default, 8 and 12 bits all compressed the skinned primitive (and 0 made the file 1 KB larger), so it did
   not reproduce; the lane's file at that time also had defects the validator later caught. The failure mode (skip,
   log, write a valid file) is real in both glTF-Transform and the Blender exporter source, so: run
   `glb_audit.mjs --expect draco` after every Draco step, and use `quantizeGeneric: 0` if it reports a skinned
   primitive uncompressed. Found: reported (lane), not reproduced here.
3. **Morph targets or sparse attributes force sequential Draco encoding**, which compresses less than edgebreaker.
   Found: reported.
4. **Meshopt adds `KHR_mesh_quantization` and an extra root node** that carries the dequantisation scale; lookups by
   node and framing from `geometry.boundingBox` must tolerate it (frame from the world box). Found: tested (lane).
5. **Validator warnings that were real defects in the lane's first demo:** `NODE_SKINNED_MESH_NON_ROOT` and
   `NODE_SKINNED_MESH_LOCAL_TRANSFORMS` (a skinned mesh node must be a scene root with no transform; offset through
   the joints), `ACCESSOR_ANIMATION_SAMPLER_OUTPUT_NON_NORMALIZED_QUATERNION` (hand-built quaternions must be unit
   length), `ACCESSOR_JOINTS_USED_ZERO_WEIGHT` (a zero-weight slot points at joint 0). Found: tested (lane).
6. **The CLI's `package.json` is not in its exports map**, so `require.resolve('@gltf-transform/cli/package.json')`
   throws `ERR_PACKAGE_PATH_NOT_EXPORTED`; find the package folder by walking `node_modules` (as `test-web.mjs` does).
   Found: tested here.
7. **`validate --format json` does not exist** in the 4.5.1 CLI (formats: pretty, csv, md); parse the pretty output
   with the colour codes stripped. Found: tested here.
8. **Do not `optimize` a file other tooling addresses by node name** (game logic, retargeting). Found: tested (lane).
