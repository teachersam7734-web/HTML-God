# Practical recipes

These are adaptable patterns, not promises that every installed version accepts identical flags. Use the current local tool help and official documentation when changing versions. Examples use relative paths, not a previous user's machine paths.

## Bundle a live scene

```
npm install --save-exact three@<chosen-version>
npm install --save-dev --save-exact esbuild@<chosen-version>
npx esbuild motion/scene.js --bundle --format=iife --minify --outfile=vendor/scene.bundle.js
```

Choose and verify versions before replacing the metavariables. Read an existing lockfile first. Do not run a broad dependency upgrade during an unrelated visual edit.

## Single-file assembly

The supplied `scripts/build_single_file.py` takes a project root, a template and a slot manifest, all paths relative to the root:

```json
{
  "slots": {
    "STYLES": {"path": "ui/style.css", "kind": "css"},
    "APP": {"path": "vendor/app.bundle.js", "kind": "js"},
    "DATA": {"path": "content/course.json", "kind": "json"},
    "HERO": {"path": "assets/hero.png", "kind": "data-url"}
  }
}
```

The template holds one `{{NAME}}` token per slot: `<style>{{STYLES}}</style>`, `<script>{{APP}}</script>`, `<script type="application/json" id="data">{{DATA}}</script>`, `<img src="{{HERO}}" alt="...">`. Kinds are `css`, `js`, `json`, `text` and `data-url`. The helper rejects paths outside the root and missing tokens, escapes `</style` and `</script` in any letter case, writes JSON with `<` as `<`, and replaces all tokens in one pass, so a `{{NAME}}` inside embedded content stays literal. `text` is inserted unescaped: never use it for untrusted content. It does not crawl dependency graphs; bundle JS and list assets explicitly first.

```
python scripts/build_single_file.py --root path/to/project --template index.template.html --manifest build/slots.json --output output/experience.html
python scripts/asset_manifest.py --root path/to/project --include assets --include vendor --output qa/asset-manifest.json
```

The manifest records each file's relative path, bytes, MIME type and SHA-256, and only the root's folder name, so it carries no machine path. With HTML-Sensei installed, `html-sensei:sensei-single-file` (`build-single.mjs`) is the fuller packer: base64 media, load order, placeholders refused and a weight report.

## Media preparation

Inspect first:

```
ffprobe -v error -show_format -show_streams -of json input.mp4
```

Silent trimmed H.264 example, with times chosen from inspected footage:

```
ffmpeg -i input.mp4 -ss 0.15 -t 7.5 -an -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart output.mp4
```

Seek-oriented short video example:

```
ffmpeg -i input.mp4 -an -c:v libx264 -g 1 -keyint_min 1 -sc_threshold 0 -crf 20 -pix_fmt yuv420p -movflags +faststart scroll.mp4
```

All-intra increases size and is not always necessary. Compare real scroll responsiveness. For alpha footage, inspect source/matte quality, encode a supported alpha format and verify decoded frames in the target browser. The original project's `prepare-intro.py` (not included in this package) was a **case-specific** edge-connected matte, not a universal background-removal service.

## Pure time mapping

```js
function routeState(time, duration, legs) {
  const p = Math.min(1, Math.max(0, time / duration));
  const index = Math.min(legs - 1, Math.floor(p * legs));
  const local = p === 1 ? 1 : p * legs - index;
  return {index, local, complete: p === 1};
}
```

Use this state for position, caption and outcome. A held scenario should clamp at its named boundary. Do not let a `setInterval` caption scheduler drift away from the geometry.

## GLTF normalisation outside animation

```js
const actor = cloneRig(gltf.scene);
actor.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(actor);
const size = bounds.getSize(new THREE.Vector3());
const center = bounds.getCenter(new THREE.Vector3());
const scale = desiredHeight / size.y;
const normalizer = new THREE.Group();
normalizer.add(actor);
normalizer.scale.setScalar(scale);
normalizer.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
const mixer = new THREE.AnimationMixer(actor);
// Choose and inspect a real clip, then derive mixer.setTime(time) from the scene clock.
```

Handle empty/invalid bounds in production. Clone per-instance materials if recoloring. Keep shared resources alive until their last owner is disposed.

## Pointer-safe projected controls

```css
.decorative-canvas, .environment { pointer-events: none; }
.node { position:absolute; transform:translate(-50%,-50%); }
.node:active { transform:translate(-50%,-50%); }
```

Do not rely on that snippet alone: ancestor stacking contexts, overlays and global selectors still matter. Test an ordinary browser click without `force:true`.

## Portable state

Use a versioned envelope and validate before replacing state. Store text, not executable HTML. Export via Blob; import via FileReader/file.text. Guard local storage errors and show a backup action. The runnable starter demonstrates a minimal notes envelope; the course's reader/pro modules show a larger normalised schema.

## Browser smoke

```
node scripts/browser_smoke.cjs output/experience.html qa/smoke
```

The helper finds `playwright` or `playwright-core` in the script's folder, the current folder or the global npm root; `PLAYWRIGHT_MODULE` overrides that with a path or name. It launches `BROWSER_EXECUTABLE` if set, else `BROWSER_CHANNEL`, else Chrome, then Edge, then Playwright's own Chromium. It opens the file in strict `file://` mode with the network off, at 1440 x 900 and at 390 x 844 with touch, each with and without reduced motion, and fails on page or console errors, external requests or horizontal overflow. It exercises the starter's card, sequence, Pause motion and notes controls when they exist. Install Playwright in the project if it is absent and installation is authorised. Extend assertions for the actual product; generic smoke is not complete QA. When HTML-Sensei is installed, also run its gate (`html-sensei:sensei-verify`).

Verified on Windows 10 with Node 24 and a global `playwright-core`, in Chrome and Edge; not verified on macOS or Linux.

## Packaging the skill

```
python scripts/build_catalog.py
python scripts/validate_skill.py path/to/html-master --output path/to/html-master/validation/report.json
python scripts/self_test.py
python scripts/pack_skill.py path/to/html-master path/outside/HTML-Master.skill
```

Run `build_catalog.py` after changing any file under `assets/`; the self-test fails while the catalogue is stale. The self-test works in a temporary folder and leaves nothing behind. The packer validates first, refuses to write the archive inside the skill folder and always names the archive's root `html-master/`. `.skill` here is a ZIP archive with one `html-master/` root. Keep `SKILL.md`, references, examples, scripts, assets and notices together. An archive extension does not guarantee automatic installation in every assistant host; use that host's importer or extract the folder into its supported skill directory.
