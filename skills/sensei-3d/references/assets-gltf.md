# 3D assets: glTF, compression, textures, animation, no-code exports, the ledger

Sources: `domain-3d-assets-pipeline.md` in the HTML-Sensei build project's research notes (not shipped), `repo-three-gltf-loading-and-model-viewer.md`,
`repo-glTF-Transform.md`, SENSEI-LOG, and the runs for this skill.

## Format

glTF 2.0, as one binary `.glb`, is the delivery format for meshes, materials, skins and animation clips. In a single
file the GLB travels as base64 text and is parsed with `GLTFLoader.parse` or `parseAsync` from bytes the page already
holds (`examples/glb.html`). Blender output: `sensei-blender` owns the export, the exporter traps and the animated
player template; this file covers what happens in the page.

## Compression: choose by content

`scripts/mkglb.mjs` builds a 29,161-vertex smooth mesh (positions, normals, UVs) and writes both variants with
glTF-Transform. Sizes, measured by the lane and again for this skill (identical):

| Variant | Bytes | Extension | Decoder carried in the page |
|---|---|---|---|
| Raw | 1,625,260 | none | none |
| meshopt (weld, quantise, `meshopt({ level: 'high' })`) | 256,596 | `EXT_meshopt_compression` | `meshopt_decoder.module.js`, 29 KB, wasm inside |
| Draco (`draco()`) | 94,604 | `KHR_draco_mesh_compression` | wrapper 58,456 bytes plus wasm 192,420 bytes (about 330 KB as base64) |

- Draco gave the smallest geometry on this smooth static mesh (about 17 times smaller than raw, 2.7 times smaller
  than meshopt). Its decoder is about 250 KB.
- meshopt decodes faster (25 ms against 65 ms here, CPU only, indicative), its decoder is 29 KB, and it also
  compresses animation and morph targets.
- **Default for single files: meshopt.** The Draco decoder costs more than the Draco saving until the model is large
  and static. Neither compresses textures.

```bash
npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer draco3dgltf
node scripts/mkglb.mjs
# CLI equivalent, from the tool's documented shape (NOT run here):
# npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp
```

## Loading with no network

```js
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const loader = new T.GLTFLoader();
loader.setMeshoptDecoder(T.MeshoptDecoder);                        // meshopt: nothing else
const gltf = await loader.parseAsync(b64(GLB.meshopt).buffer, '');
```

Draco: the object form of `setDecoderPath` takes blob URLs of the two decoder files from
`three/examples/jsm/libs/draco/gltf/` (decoder-only variant; never the general `libs/draco/` with its 700 KB asm.js
fallback):

```js
const blob = (s, type) => URL.createObjectURL(new Blob([b64(s)], { type }));
const draco = new T.DRACOLoader();
draco.setDecoderPath({ js: blob(GLB.dracoWrap, 'text/javascript'), wasm: blob(GLB.dracoWasm, 'application/wasm') });
loader.setDRACOLoader(draco);
```

An older route overrides the private `_loadLibrary` method to return the texts from memory (tested by the Blender
lane); it breaks when the private method moves, so prefer the object form. `setDecoderPath('https://www.gstatic.com/
draco/...')`, which two of the owner's repos use, is a CDN and breaks offline (`lint-3d` rule `draco-cdn`).

## Framing, bounds and quantisation

- After `quantize` or meshopt, positions are normalised integers and the node carries the scale. The lane read a
  geometry box of `[1, 0.94, 0.32]` from the meshopt mesh against `[1.55, 1.27, 0.5]` from the Draco one. Anything
  that uses raw positions or `geometry.boundingBox` (depth sweeps, particle sampling, framing) must use the world
  box: `new Box3().setFromObject(gltf.scene)` after `updateMatrixWorld(true)`.
- Pose first, then measure: `mixer.update(0)`, `updateMatrixWorld(true)`, `skeleton.update()`. The posed box differed
  from the bind-pose box by about 0.3 units at the top in the Blender lane's demo.
- Guard the framing with `Number.isFinite` (the Blender lane's all-zero `WEIGHTS_0` made the box NaN, the camera NaN,
  and the page blank while every counter looked normal).

## Animation clips

```js
const mixer = new T.AnimationMixer(gltf.scene);
for (const clip of gltf.animations) mixer.clipAction(clip).setLoop(T.LoopRepeat, Infinity).play();
// per frame: mixer.update(Math.min(dt, 0.1));   toggle with action.enabled; speed with mixer.timeScale
// blend: actionA.crossFadeTo(actionB, 0.3)
```

Use `THREE.Timer` (with `timer.connect(document)` for visibility awareness) or a time you own; `THREE.Clock` is
deprecated and warns. For a seekable page, set `mixer.setTime(t)` from the seek time rather than accumulating `dt`.
Reduced motion: start paused on the first pose with a play button. Skinned meshes ignore their own node transform
and their parents' (glTF rule): put offsets on the joints or the armature root.

## Textures

GPU memory is set by pixels, not file size: a 4096 by 4096 RGBA texture is about 64 MiB, 85 MiB with mipmaps
(arithmetic checked; figures from a 2026 three.js article). Resize to 2048 at most unless it is the hero asset, use
WebP inside the GLB (`EXT_texture_webp`), and `close()` `ImageBitmap` textures on dispose. KTX2 and Basis
(transcoder wasm 527 KB) need the same blob-URL treatment as Draco; not tested here.

## Base64 limits

Base64 adds a third. The page holds the string and the decoded buffer at once. Above about 5 MB per model, `atob`
plus a byte loop freezes the main thread: ship the GLB beside the page and say the deliverable is no longer one file,
or compress harder. Several models: keep each in an inert `<script type="text/plain" id=...>` block and decode the
one that is needed.

## `<model-viewer>` and no-code tools

| Tool | Licence | Offline from one file | Verdict |
|---|---|---|---|
| `<model-viewer>` (Google) | Apache-2.0 | Not tested. Draco and KTX2 decoders load from a Google CDN by default and meshopt is off; override `ModelViewerElement.dracoDecoderLocation`, `ktx2TranscoderLocation`, `meshoptDecoderLocation` with inlined URLs. Plays one animation at a time (`animation-name`). | when AR or a poster flow is wanted and the page is hosted |
| Spline (`@splinetool/runtime`) | no licence field on npm; product terms | No: the scene is a separate binary fetched at run time and needs a server; WebGPU by default | rebuild the look in code, or export glTF if its terms allow |
| Unicorn Studio | wrapper MIT, runtime and scenes hosted | assume network until proven otherwise | not tested |
| Sketchfab embeds | per model | iframe, network | never in an offline deliverable |

Spline pricing (fetched by the lane 2026-10-18): Free watermarks web exports; Pro adds code export; only Enterprise
lists self-hosted export. The page says nothing about commercial rights.

## The ledger: models, fonts, textures, video

Every asset gets a row in `.sensei/licences.json`: file, source URL, author, licence, attribution text, date checked.

- CC0 is safest. CC-BY needs the attribution string visible in the page or its credits (a licence condition).
- "Free for personal use" is not usable in a commercial profile.
- No trademarked characters (the owner's hologram repos ship Star Wars models with CC-BY or no terms: never reuse).
- A real person's likeness needs consent and a licence.
- Fonts: SIL OFL fonts may be embedded; system fonts such as Arial may not.
- Sources named by the research, each to be checked per item: Khronos glTF Sample Assets, Kenney and Quaternius
  (believed CC0, check each), Poly Pizza, Sketchfab (often CC-BY).
