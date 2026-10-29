# Engines, physics and atlases

Depth for `sensei-games` section 2 and 3.5. Versions are the ones run for this skill (fetched with npm into a
scratch folder, never vendored into the plugin); licences read from each package's `package.json`.

## 1. The library table

| Library | For | Licence | Run here | Notes |
|---|---|---|---|---|
| `scripts/game-core.js` (Loop, Input, Save) | fixed step, input sampling, versioned save | HTML-Sensei's own | yes, 32 assertions (`test-game.mjs`) | about 13 KB unminified; no dependencies |
| Phaser | full 2D framework: scenes, Arcade or Matter physics, tweens, animation, atlases, scale manager, audio | MIT | 4.2.1 (`test-engines.mjs`) | the research lane ran Phaser 3 with the same calls; inlined `phaser.min.js` was 1.38 MB in the lane |
| PixiJS | fast 2D renderer only (scene graph, sprites, filters, text); bring your own game logic | MIT | 8.22.0 | `init` is asynchronous since v8 |
| Kaplay (successor to Kaboom) | beginner-friendly components, scenes, physics, sprites, sound | MIT | 3001.0.19 | always `global: false` |
| Excalibur | TypeScript 2D engine | BSD-2-Clause | not run | |
| matter-js | casual 2D rigid bodies | MIT | 0.20.0 (`test-physics.mjs`) | tunnels fast bodies; warns above 16.667 ms per update |
| planck.js | Box2D port: continuous collision, joints, sensors | MIT | 1.5.1 | stops fast bodies at static walls |
| three.js | 3D games | MIT | see `sensei-3d` | |
| Tiled, LDtk, Aseprite, TexturePacker, free-tex-packer | map and sprite authoring | Tiled editor GPL-2 (its map format free to use); LDtk MIT; Aseprite source-available and paid; TexturePacker commercial | not run | their JSON is read by Phaser, Pixi and Kaplay |
| `scripts/atlas-pack.js` | shelf packer, edge extrusion, hash JSON | HTML-Sensei's own | yes | 38 per cent fill on 40 mixed frames: fine at run time, use MaxRects for production sheets |

Decision rule (research lane, confirmed by the runs here): **platform first** (DOM, CSS, WAAPI, canvas, GameCore) for
quiz, puzzle, card and narrative games; **Kaplay** for a prototype or small arcade game; **Phaser** when scenes,
tilemaps, physics, audio and a scale manager are all needed; **PixiJS** when the project has its own logic and needs a
fast renderer (or a visual layer on a course); **planck** for physics that must not tunnel; **matter** for casual
physics; no engine for anything a CSS animation does.

## 2. Engines in one offline file

`scripts/build-engines.mjs --libs DIR` writes the three pages below with the engine inlined. Rules for all three:
escape `</script` inside the inlined library (the builder does: `.replace(/<\/script/gi, '<\\/script')`); assets as
data URIs or Blobs, never URLs; audio decoded from `fetch(dataURI)`; a ledger row per engine; the engine's own licence
banner stays at the top of the inlined file.

Phaser:

```js
new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 320, height: 180, pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 600 } } },
  scene: { create() {
    this.textures.addAtlas('hero', atlasCanvas, atlasJson);           // a canvas works as the atlas image
    game.events.on('hidden', () => game.pause());                     // Phaser does not pause itself
    game.events.on('visible', () => game.resume());
  } } });
```

Measured here: the atlas animation cycled f0 to f3; the Arcade body came to rest on the static ground
(`blocked.down`); `Scale.FIT` gave exactly 960 x 540 from 320 x 180 in a 960 x 540 viewport; WebGL renderer under
SwiftShader. With the two `hidden` and `visible` handlers removed, the scene clock advanced 502 ms in 500 ms of hidden
time (it only emits the events); with them it froze (0 ms) and restarted on return.

PixiJS:

```js
const app = new PIXI.Application();
await app.init({ canvas, width: 320, height: 180, preference: 'webgl', antialias: false });   // async since v8
const tex = PIXI.Texture.from(atlasCanvas); tex.source.scaleMode = 'nearest';
const sheet = new PIXI.Spritesheet(tex, { ...atlasJson, animations: { run: ['f0', 'f1', 'f2', 'f3'] } });
await sheet.parse();
app.ticker.add((t) => { const dt = Math.min(t.deltaMS, 250) / 1000; /* clamp, or use GameCore.Loop */ });
document.addEventListener('visibilitychange', () => document.hidden ? app.ticker.stop() : app.ticker.start());
```

Measured: AnimatedSprite advanced through four frames; the ticker-driven fall landed on y = 138; renderer `webgl`.

Kaplay:

```js
const k = kaplay({ canvas, width: 320, height: 180, global: false, debug: false, pixelDensity: 1 });
k.loadSprite('hero', stripDataURL, { sliceX: 4, anims: { run: { from: 0, to: 3, loop: true, speed: 8 } } })
  .then(() => { k.setGravity(600); /* scenes */ });
```

Measured: the body fell and was grounded; four frames cycled; `window.add` stayed undefined with `global: false`, but
`window.kaboom` and `window.kaplay` were still defined.

## 3. Physics

Always step with a constant delta, from inside `GameCore.Loop`'s `update(dt)` (which is constant), never with the
frame time.

| Measured in Node (`test-physics.mjs`) | matter-js 0.20.0 | planck 1.5.1 |
|---|---|---|
| Same fixed step twice, 600 steps | bit-identical | bit-identical |
| Variable delta (10 to 24 ms) | a different result, and a console warning above 16.667 ms | not tested |
| Five-box stack after 10 s | stands | stands, centres 1.01 to 5.07 |
| Fast ball against a thin static wall | **passes through** (120 px per update; ends at x = 1200, wall at 300) | **stopped** (10 m per step; ends at x = 20, wall at 30) |
| The same matter ball in 40 sub-steps per frame (3 px per update) | stopped (bounced back to x = 30) | |
| Cost, 500 dense circles, this machine | 1.30 ms per step (the lane measured 4.2) | 1.44 ms (lane 4.5) |

The cost lines are information only: they changed threefold between two runs on the same machine family and will
differ on the target device. For fast bodies: planck (continuous collision against static bodies), thicker walls, or
sub-steps (split each fixed step into n engine updates and divide matter's per-update velocity by n, as the test does).

## 4. Atlases

`AtlasPack.pack(items, { maxW, pad, pow2 })` returns positions and a JSON hash that Phaser `textures.addAtlas` and
PixiJS `Spritesheet` read directly; `AtlasPack.extrude(ctx, frame, 1)` copies each frame's border pixels outward after
the frame is drawn. Padding 2 px plus 1 px extrusion prevents a neighbour bleeding in under bilinear filtering and
mipmapping (research lane). Use `pixelArt: true` (Phaser) or `scaleMode = 'nearest'` (Pixi) and
`image-rendering: pixelated` for crisp pixels. Kaplay reads a sliced strip, so copy the frames into one row first (the
builder shows how). Non-power-of-two sheets can break mipmapping on some GPUs (reported, not tested).

## 5. Not run here

Excalibur, Tiled, LDtk, Aseprite, TexturePacker, Matter inside Phaser, any engine's audio, Phaser tilemaps, real GPUs
(every engine figure is SwiftShader), Firefox and Safari.
