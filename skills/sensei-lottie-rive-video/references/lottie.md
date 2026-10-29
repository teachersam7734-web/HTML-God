# Lottie and dotLottie in depth

Measured with `scripts/test-lottie.mjs` (Windows 10, Chrome 155 headless, strict `file://`) on the original test
animation from `scripts/make-lottie.mjs`: 60 frames at 30 fps, 200 by 200, three layers, markers `intro` and
`outro`. Timings are from a software-rendered headless run and are not performance claims.

## 1. What it is

Lottie is a JSON description of vector animation, exported from After Effects (Bodymovin) or authored in Lottie
Creator. dotLottie (`.lottie`) is a ZIP container for one or more Lottie animations plus images, themes, fonts and
state machines. It suits icon-scale and illustrative motion a designer edits: success and error states, loaders,
empty states, onboarding, course mascots, hero accents.

## 2. Players

| Player | Renderer | Raw size | One offline file | Notes |
|---|---|---|---|---|
| `lottie-web` 5.13.0 `lottie.min.js` | SVG, canvas, HTML | 299 KB | yes, tested | full build: expressions |
| `lottie_light.min.js` | SVG | 164 KB | yes, tested | no expressions |
| `lottie_svg.min.js` | SVG | 237 KB | yes, tested | |
| `lottie_canvas.min.js` | canvas | 260 KB | yes, tested | |
| `lottie_light_canvas.min.js` | canvas | 198 KB | yes, tested | no expressions |
| `@lottiefiles/dotlottie-web` 0.81.0 | canvas through WASM (ThorVG) | JS bundle about 60 KB plus WASM 1,209 KB (1,612 KB as base64) | yes, only after `setWasmUrl`; test page 1,674 KB | `.json` and `.lottie`, markers, themes, slots, state machines, worker mode; `webgl` and `webgpu` variants in the package |

lottie-web's last push was September 2025 (research, checked 2026-10-18): maintenance mode. Vendor it; do not expect
new features. dotLottie is active.

Same result in all five lottie-web builds: `totalFrames` 60, `getDuration()` 2 s, markers read, `goToAndStop('outro',
true)` lands on frame 30, ring pixel at frame 30 `[107,99,255,255]`, `recolor()` turns the star `[255,0,0,255]`,
`setSpeed(8)` completes in 252 to 264 ms against 250 expected, teardown leaves no children, no request, no error. SVG
made 14 DOM nodes, canvas 1. dotLottie gave the same ring pixel at frame 30.

## 3. Recipes

### lottie-web, one file

```html
<div id="a" role="img" aria-label="What the animation shows" style="width:200px;height:200px"></div>
<script>/* lottie_svg.min.js, with every "</script" written "<\/script" */</script>
<script>/* lottie-helpers.js */</script>
<script type="application/json" id="d">{ ...animation JSON, escaped the same way... }</script>
<script>
  const anim = LottieHelpers.mount(lottie, document.getElementById('a'),
    JSON.parse(document.getElementById('d').textContent), { renderer: 'svg', posterFrame: 30 });
</script>
```

`mount()` clones the data (lottie-web mutates the object it is given), holds `posterFrame` and does not play under
reduced motion, pauses off screen and in a hidden tab, and gives `anim.__teardown()`.

### dotLottie, one file

```js
import { DotLottie } from '@lottiefiles/dotlottie-web';          // bundle to an IIFE with esbuild
DotLottie.setWasmUrl('data:application/wasm;base64,....');      // BEFORE the first player is constructed
const p = new DotLottie({ canvas, data: arrayBufferOfDotLottie, autoplay: !reduced, loop: true,
                          renderConfig: { devicePixelRatio: Math.min(devicePixelRatio, 2) } });
p.addEventListener('load', ...); p.addEventListener('loadError', ...);
```

Without `setWasmUrl` the player asked jsdelivr and then unpkg for `dotlottie-player.wasm` (both requests recorded
and blocked by the test) and never loaded. With it: zero requests. `data` takes an `ArrayBuffer`, a string or an
object. Events: `load`, `loadError`, `complete`, `frame`. Methods used: `markers()`, `setFrame`, `setSpeed`, `play`,
`destroy`. Worker mode (`DotLottieWorker`, needs `setWorkerUrl` or a `blob:` worker under a strict CSP), themes
(`setThemeData`), state machines and the webgl and webgpu variants were not tested.

### The container

`scripts/make-dotlottie.py` writes a dotLottie 2.0 ZIP (Deflate): `manifest.json` (`version` "2", `animations`
`[{id}]`, optional `generator`, `themes`, `stateMachines`, `initial`) and `a/<id>.json`; folders `i/` images, `t/`
themes, `s/` state machines, `f/` fonts. The test JSON (2,673 B) packed to 826 B. MIME `application/zip+dotlottie`.

## 4. Choosing a renderer

| Renderer | Choose when |
|---|---|
| SVG | crisp at any zoom, CSS-targetable layers, a few animations on a page |
| canvas | many instances at once or heavy shapes; size the canvas for the device pixel ratio |
| dotLottie (WASM) | complex files where fidelity and speed matter; biggest fixed cost (1.2 MB WASM) |
| full lottie-web build | the file uses After Effects expressions (the light builds drop them) |

## 5. Interactivity

- Scroll scrub: `LottieHelpers.scrub(anim, el, 0, anim.totalFrames - 1)`; the second argument of `goToAndStop` must be
  `true` so the value is a frame.
- Hover or click: `anim.playSegments([from, to], true)`, or marker names with `goToAndStop`; dotLottie `setMarker`.
- A real state machine with pointer tracking (toggle, rating, mascot): Rive ([rive.md](rive.md)).

## 6. Theming

`recolor(json, from, to, tol)` walks every array of four numbers, so it catches static colours and keyframe `s`/`e`
values. Run it on a copy before loading. dotLottie themes were not tested.

## 7. Licence of LottieFiles assets

The Lottie Simple License (FL 9.13.21, read from lottiefiles.com/page/license by the research lane): download,
modify, publish and use commercially, attribution encouraged not required, **but** any distribution "must contain
(and be subject to) the same terms", modifications are derivative works under the same terms, no "technical
measures that restrict exercise of the rights" (do not obfuscate or encrypt the JSON), and no compiling files into a
competing service. It is not CC0. Keep the licence and the creator in the ledger; never ship a scraped collection in
a template or plugin. Premium animations have other terms (not read). Check each animation is not a branded or
trademarked character.
