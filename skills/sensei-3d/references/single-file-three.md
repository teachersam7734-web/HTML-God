# three.js in one offline HTML file

Sources: `domain-3d-holograms-vfx.md` in the HTML-Sensei build project's research notes (not shipped) section 3, `repo-three-gltf-loading-and-model-viewer.md`
section 3, SENSEI-LOG ("three.js with no CDN and no UMD", "Order a big single-file page", "DRACOLoader in a classic
bundle"), and the builds run for this skill (three 0.186.1, esbuild 0.28.2, Windows 10).

## Why a bundle step at all

Recent three.js ships ES modules only. The old UMD `three.min.js` is gone and `build/three.cjs` is a 600-byte stub
that requires the core file. A page that must open from `file://` with no network therefore carries a classic-script
IIFE bundle of the names it uses. That is the route that was built and tested from `file://`; an ES-module bundle in
an inline `<script type="module">` was not tested here, so it is not the default.

## The three steps

1. **An entry that exports only what the page uses** (`examples/entry-*.js`). Tree-shaking is the whole size win.
2. **Bundle as an IIFE with a global**: `node scripts/build-vendor.mjs vendor entry-starter.js` (Node port of the
   lane's `build-bundles.sh`; it always defines `import.meta.url`, keeps the licence block, and refuses output that
   contains `</script` or `<!--`). The CLI equivalent, which the `guard-process` hook checks for loaders:

   ```bash
   npx esbuild entry-glb.js --bundle --format=iife --global-name=T --minify \
     --define:import.meta.url='"https://invalid.local/x/"' --outfile=vendor/t-glb.js
   ```

3. **Inline** the `<script src>` files into one page: `node scripts/inline3d.mjs page.html page-single.html`
   (refuses external scripts and any vendored text with `</script` or `<!--`; warns when no licence text is found).

## Measured sizes

Bytes of minified output, three 0.186.1, esbuild 0.28.2.

| Bundle | Bytes | Where measured |
|---|---|---|
| `entry-starter.js` (renderer, standard material, lights, torus knot) | 536,184 (134,495 gzip) | this skill |
| Lane subset `entry-min.js` (ShaderMaterial, Points, textures, instancing) | 545,773 | 3D lane, file present in the lab |
| Everything (`export * from 'three'`) | 743,203 | 3D lane |
| `entry-label.js` (canvas-texture label) | 529,848 | this skill |
| `entry-glb.js` (GLTFLoader, DRACOLoader, MeshoptDecoder, Box3) | 649,794 | this skill |
| `entry-troika.js` (troika-three-text 0.52.5) | 647,516 | this skill |
| `entry-gpu.js` (`three/webgpu` plus `three/tsl`) | 904,340 | this skill |
| Lane `entry-post.js` (EffectComposer, bloom, ShaderPass, OutputPass) | 553,300 | 3D lane |
| Minimal React Three Fiber app (react 19, fiber, three) | about 1,154,000 (319 KB gzip) | 3D lane |

`WebGLRenderer` itself drags in most of the size (renderer, shader chunks, maths). Dropping geometry classes saves
little. The starter page inlined to one file was 544,011 bytes.

These are reports, not budgets: the doctrine has no page-weight budget unless the user asks for one.

## Inert script: keep parse cost off the first paint

When 3D is not on the first screen (a lesson widget, a win screen), carry the bundle as inert text and compile it on
first use (SENSEI-LOG, Save The Damsel):

```html
<script type="text/x-three" id="three-src">/* the IIFE text */</script>
<script>
let T3 = null;
function getThree() {                     // first use only
  if (!T3) T3 = new Function(document.getElementById('three-src').textContent + ';return T')();
  return T3;
}
</script>
```

Inert text still ends at `</script`, and `<!--` can flip the parser into its escaped state: both are refused by
`build-vendor.mjs` and `inline3d.mjs`. Put big optional payloads at the end of `<body>` and call `boot()` directly:
`DOMContentLoaded` waits for the parser to reach the end of the document, so moving payloads alone changed nothing
(36.7 s to 38.3 s), while the direct call took the slow-network load from 36.4 s to 10.7 s (SENSEI-LOG, measured at
20 Mbit/s with CPU x4). Carry big media as inert `<script type="application/x-...">` text, never as `data-`
attributes on a live element.

## Version pinning

Pin the exact version in the work folder (`three@0.186.1`). Within one release series `Clock` was deprecated,
`renderAsync` was deprecated and `DRACOLoader` moved to decoder URLs derived from `import.meta.url`. After any
upgrade, rebuild and rerun `gate3d.mjs` on every page. Record name, exact version and licence of each vendored file in
the project ledger (`.sensei/licences.json`, see `lib/ledger.mjs`).

## Licence notice

three.js is MIT. esbuild moves `@license` comments to a trailing "Bundled license information" block in the
minified output (checked by `build-vendor.mjs`). Do not strip it and do not pass a flag that removes legal comments.
