# Rive in depth

Measured with `scripts/test-rive.mjs` (Windows 10, Chrome 155 headless, strict `file://`, `@rive-app/*` 2.45.0)
on three sample files from the rive-wasm repository (`statemachine.riv`, `rating_animation.riv`, `truck.riv`). Those
files are test material only: their artwork authorship is not stated, so none ships with this skill. Pass your own
in `RIV`.

## 1. What it is

An editor plus a small runtime for interactive vector animation: artboards, timeline animations, and state machines
with inputs (number, boolean, trigger), pointer listeners, events and data binding. Built for animation that
reacts: toggles, ratings, mascots that follow the pointer, loading buttons, game HUD, course widgets. The runtime is
C++ compiled to WASM with a thin JS API (global `rive`). The editor is proprietary (free tier and paid); an agent
cannot author `.riv` files without it, so when nobody on the project uses the editor, choose Lottie or code.

## 2. Runtime variants

| Package | Renderer | Raw size | Test page (one file) | Notes |
|---|---|---|---|---|
| `@rive-app/canvas` | Canvas 2D | JS 575 KB (280 KB min) + WASM 2,096 KB | 2.94 to 2.96 MB | all features, Rive Text and audio |
| `@rive-app/canvas-lite` | Canvas 2D | JS 492 KB + WASM 792 KB | 1.20 to 1.23 MB | **no Rive Text, no audio** (its README); loads such files without error and draws them wrong |
| `@rive-app/canvas-single` | Canvas 2D | one JS file 3.4 MB (3.0 MB min), WASM inside | 2.97 to 3.00 MB | no WASM request and no setup: the simplest single file |
| `@rive-app/webgl2` | WebGL2 | JS 565 KB + WASM 2,233 KB | 3.10 to 3.13 MB | closest to the editor; one GL context per canvas (browsers cap them) |
| `@rive-app/react-canvas` and others | React wrappers | | | only inside React projects |

Runtime licence: MIT. Content licence is separate (section 7).

## 3. Three offline routes

1. **canvas-single**: inline its `rive.js` (minified with esbuild). Nothing else.
2. **canvas, canvas-lite or webgl2 with the WASM inlined**:

```html
<script>/* rive.js inlined, "</script" escaped */</script>
<script>
  const b = atob('...rive.wasm as base64...'), u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  rive.RuntimeLoader.setWasmBinary(u.buffer);      // the runtime never fetches
  rive.RuntimeLoader.setWasmFallbackUrl(null);     // and never falls back to a CDN
</script>
```

3. **No setup (do not ship)**: the canvas runtime asked unpkg for `rive.wasm`, then jsdelivr for `rive_fallback.wasm`
   (all blocked and recorded by the test) and failed with "Could not load Rive WASM file".

Every route also needs `enableRiveAssetCDN: false` (default true: fonts and images hosted by Rive load at run time).

## 4. Construction and state machines

```js
const r = new rive.Rive({ buffer, canvas, autoplay: !reduced, enableRiveAssetCDN: false,
  stateMachines: 'StateMachine',                       // name it NOW, or its inputs never appear
  layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
  onLoad() { r.resizeDrawingSurfaceToCanvas(); const ins = r.stateMachineInputs('StateMachine'); } });
```

Measured on all four offline variants and three files: `stateMachineInputs(name)` returned an empty list when the
machine was not named at construction, and `MyNum:56, MyBool:59, MyTrig:58` (statemachine.riv), `rating:56`
(rating) or `Bump` (truck) when it was; a number input read back the 12 written to it. Type constants:
`rive.StateMachineInputType.Number` 56, `Trigger` 58, `Boolean` 59. Discover names with a throwaway instance
(`activeArtboard`, `animationNames`, `stateMachineNames`) or in the editor.

The 2.45 type definitions mark state machine inputs, runtime Rive Events and loop events **deprecated** in favour of
data binding (view models), and `stateMachines` (plural) deprecated in favour of `stateMachine`. Inputs still work
in 2.45; data binding was not tested here. Prefer data binding for new files once it is tested on the project.

`scripts/rive-mount.js` wraps all of this: names the machine at construction, turns the asset CDN off, honours
reduced motion, pauses off screen and in a hidden tab, resizes the drawing surface, and `teardown()` calls
`cleanup()` (frees WASM memory). It touches `isPlaying` only after `onLoad`: on 2.45 that getter throws on an
instance that has not loaded yet (found here: the first draft crashed in its IntersectionObserver callback).

## 5. Other API

`play`, `pause`, `stop`, `scrub`, `reset`, `isPlaying`, `cleanup()` (always, on teardown), `RiveFile` to share one
parsed file across instances, `useOffscreenRenderer`, `tabIndex` and `focusOptions` for focus nodes, an experimental
`semanticsMode` accessibility overlay, `enableFPSCounter()`. Events: `onLoad`, `onLoadError`, `onPlay`, `onPause`,
`onStop`, `onStateChange` (the `on*` options replace the older ones). Read from the type definitions; the ones the
tests call are construction, `play`, `pause`, `stop`, `isPlaying`, `stateMachineInputs`,
`resizeDrawingSurfaceToCanvas` and `cleanup`.

## 6. Canvas or WebGL2

Canvas 2D for lists, many widgets and interface parts (no context cap, smallest runtime with lite; the browser's
vector renderer draws it, so it differs slightly from the editor). WebGL2 for one or two hero pieces or when a
feature needs it; handle `webglcontextlost` (contexts are lost on some mobile tab switches). Render the shipped file
in both before deciding. WebGL2 loaded and played here on SwiftShader; its pixels were not compared.

## 7. Licences of Rive content

The Rive Marketplace states that marketplace files are shared under CC BY (research lane, from the Rive docs): the
credit is a legal requirement and must stay visible. Free community files can carry the author's own conditions;
premium files are licensed separately; the community licence page itself could not be read. Keep the editor link
and the licence in the ledger (`.riv` is binary: nobody can diff or edit it later without the editor).
