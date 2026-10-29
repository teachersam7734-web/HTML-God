---
name: sensei-games
description: "Games in HTML, real-time and turn-based: a fixed-timestep loop that behaves the same at 30 to 240 Hz; input by physical key with edges, rebinding, gamepad and touch; pause that always resumes; versioned saves that never throw; fullscreen and scaling; accessibility options; sprite atlases; Phaser, PixiJS and Kaplay inlined into one offline file; matter-js against planck.js and tunnelling; and turn-based patterns from Save The Damsel (run-scoped timers, hits on the animation's own clock, backstops). Use when someone says game, browser game, HTML5 game, arcade, platformer, puzzle or quiz game, game loop, delta time, controls, WASD, gamepad, touch controls, pause, save game, high score, sprites, Phaser, PixiJS, Kaplay, matter-js, planck, physics, collisions or Save The Damsel."
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-games

A game is a loop that reads input, advances a simulation and draws, plus what makes it a product: pause, saves,
options, sound, fullscreen and a build that works offline. Doctrine first (`html-sensei`): the richest game the brief
earns, nothing cut because this machine is slow (software GL proves correctness, not frame rate), and every recipe
says what it was and was not verified on.

## 1. When to use

Any game, or a game layer on another deliverable (a course's challenge round, a landing page's toy). Two families:
**real-time** (canvas or WebGL, fixed step, physics, sprites: `GameCore`, then an engine if needed) and **turn-based
or narrative on DOM and CSS** (quiz, card, puzzle: the platform alone, as Save The Damsel is).

| The job is | Skill |
|---|---|
| Sound effects, music, the unlock, the look-ahead scheduler, a pulse in step with sound | `sensei-audio` |
| Springs, WAAPI chains, individual transform properties, `finished` and backstops in UI motion | `sensei-motion-ui` |
| Drag with inertia, cursors, touch and keyboard equivalents of pointer effects | `sensei-pointer` |
| A 3D game: three.js in one file, assets, WebGPU tier | `sensei-3d` |
| Shader backgrounds and post effects in a game | `sensei-shaders-vfx`; a hologram reveal: `sensei-holograms` |
| Grading, spaced review and LMS packaging when the game is part of a course | `sensei-courses` |
| A game inside a deck, or charts of player data | `sensei-presentations`, `sensei-dataviz` |
| Packing the game and its engine into one offline file | `sensei-single-file` |
| The gate (axe, keyboard walk, forced colours, contact sheet) | `sensei-verify` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Family | platform only (DOM, CSS, WAAPI); `GameCore` on a canvas; an engine | turns and answers: platform; continuous movement: `GameCore`; scenes, tilemaps, physics and audio all at once: an engine |
| Engine | none; Kaplay; Phaser; PixiJS | Kaplay for a prototype or small arcade game; Phaser for a full 2D game; PixiJS when the logic is yours and you need a fast renderer; never Phaser for a flash-card game ([references/engines-and-physics.md](references/engines-and-physics.md)) |
| Physics | none; own maths; matter-js; planck.js | own maths for a platformer's gravity; planck when bodies are fast or must not tunnel; matter for casual piles; always a constant step |
| Simulation time | fixed step with accumulator; variable `dt` | always the fixed step: a variable `dt` changes jump heights with frame rate and breaks replays |
| Pause causes | user; hidden tab; window blur | user and hidden always; blur as an option the player can switch off |
| Saves | none; `GameCore.Save`; the course's store | anything that outlives a session: `GameCore.Save` (versioned, migrating); a course game: the course's store plus a version |
| Input | keyboard, gamepad, pointer stick, on-screen buttons | all that the target devices have; every action reachable by keyboard and by a big on-screen button |
| Reduced motion | the system setting and a player switch | the loop keeps running (it is the game); decorative motion (shake, flashes, flights, bursts) goes; offer a speed option |
| One file or a folder | inline engine and assets; a site | the profile's `offline` and deliverable (`sensei-single-file`) |

For engine-aware task routing, cohesive asset families, interruptible enemy decisions, utility scoring or cinematic/game-clock hand-offs, read [references/agent-game-workflows.md](references/agent-game-workflows.md). It extends the existing browser recipes with an original workflow and explicit verification targets.

## 3. Core technique

### 3.1 Write the pure step first

State plus input plus `dt` gives state: no DOM, no clock, no `Math.random` (use a seeded generator). Then it can be
replayed, tested at any frame rate, and saved.

```js
function step(s, move, jumpPressed, dt) {        // dt is ALWAYS the fixed step
  s.vx = move * SPEED;
  if (jumpPressed && s.onGround) { s.vy = -JUMP; s.onGround = false; }
  s.vy += G * dt; s.x += s.vx * dt; s.y += s.vy * dt;
  if (s.y >= GROUND) { s.y = GROUND; s.vy = 0; s.onGround = true; }
}
```

### 3.2 The fixed-step loop ([scripts/game-core.js](scripts/game-core.js))

```js
var loop = new GameCore.Loop({ step: 1/60, maxFrame: 0.25, maxSteps: 10,
  update: function (dt) { prev = copy(state); input.sample(); step(state, input.move.x, input.pressed.jump, dt); },
  render: function (alpha) { draw(lerp(prev, state, alpha)); },        // interpolate: smooth at any refresh rate
  onPause: persist });
loop.start();
```

The accumulator runs `update` as many times as the wall clock demands; `maxFrame` clamps a stall to 250 ms and
`maxSteps` caps a frame at 10 updates, so a hitch never becomes a catch-up burst. `advance(ms)` is the code the rAF
callback runs, so a test can drive any frame pattern. Measured: the same scripted input ends byte-identical at 30,
60, 144 and 240 Hz and with random 3 to 43 ms frames; a 5 s stall ran 10 updates and dropped the rest; 121 steps in
2 s of real rAF. `loop.timeScale` slows the game for a speed option without touching the step.

### 3.3 Pause that can always resume

```js
addEventListener('keydown', function (e) {                  // OUTSIDE update(): it does not run while paused
  if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP') && !e.ctrlKey && !e.metaKey && !e.altKey) loop.setPaused(!loop.userPaused);
});
```

Hidden tab: the loop pauses itself and drops the hidden time on return (0 steps in 700 ms hidden, about 12 in the
200 ms after). Blur: `loop.setPauseOnBlur(true)`, a player option. Suspend the `AudioContext` on pause too.

### 3.4 Input sampled once per step

```js
var input = new GameCore.Input(stage, { radius: 40 });     // keys by e.code, pointer stick on the stage
input.sample();             // first line of update(): pressed/released true for exactly one step
input.rebind('jump', ['KeyJ']); input.toggleMode.jump = true;   // remapping, and hold-as-toggle
```

Keys by `event.code`; `preventDefault` only on bound keys without modifiers; blur and hidden release every key; a tap
shorter than a step is latched; diagonals normalised; gamepad radial deadzone with rescale; pointer capture for the
stick; `touch-action: none` on the game surface only. Details and status of each:
[references/input-pause-saves.md](references/input-pause-saves.md).

### 3.5 Saves that never throw

```js
var save = new GameCore.Save('mygame', 2, { 1: function (d) { return { best: d.hi || 0 }; } }, { best: 0 });
var data = save.load();  GameCore.Save.autosave(function () { save.save(data); });   // hidden and pagehide
```

`{v, t, data}`; migrations run in order; a save from a newer build is refused; corrupt JSON gives defaults and
`lastError`; blocked storage keeps memory and `save()` returns false (tell the player; offer `exportCode()`).

### 3.6 Turn-based games on the platform (the Save The Damsel patterns)

```js
function later(run, fn, ms) { run.timers.push(setTimeout(fn, ms)); }        // a run owns its timers
var fl = dart.animate(flightFrames, { duration: flight, fill: 'forwards' }); // keyframes split at the impact
fl.finished.then(function () { land(); dart.animate(recoilFrames, ...); });  // the hit lands on the animation's clock
later(run, land, flight + 1500);                                             // backstop only (hidden tab, paused)
function land() { if (landed || run !== current) return; landed = true; /* break the plate, then afterAnim(...) */ }
```

Give the hinged plate `perspective` on its own parent, which must not clip; clip the picture in an inner window; raise
the breaking cell above its neighbours. Gate the next step on that plate's `animationend` with a backstop, and under
reduced motion call the step directly, because no animation will end. Layer hover and press with `translate` and
`scale`. Full working page: [examples/strike.html](examples/strike.html); what the original does and teaches:
[references/save-the-damsel.md](references/save-the-damsel.md).

### 3.7 Engines and physics in one file

`scripts/build-engines.mjs --libs DIR` inlines Phaser, PixiJS or Kaplay (fetched into the project with npm, never
into the plugin), escapes `</script`, and builds the atlas at run time. The three rules that bit: call
`game.pause()` and `game.resume()` on Phaser's `hidden` and `visible` events; `await app.init()` for PixiJS;
`global: false` for Kaplay. Step physics with the loop's constant `dt`; matter tunnels fast bodies through thin walls,
planck does not. All of it: [references/engines-and-physics.md](references/engines-and-physics.md).

### 3.8 Prove it

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-games/scripts/test-game.mjs [page.html]          # loop, input, pause, saves on a GameCore page
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-games/scripts/test-strike.mjs [page.html]        # turn-based: clock, backstop, restart, reduced motion
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-games/scripts/test-engines.mjs --libs DIR        # packer, and the three engine pages
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-games/scripts/test-physics.mjs --libs DIR        # matter and planck in Node
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/sensei-gate.mjs page.html
```

Playwright and Chrome are discovered (`SENSEI_PW` or `PW`,
`SENSEI_CHROME` or `CHROME`, then `lib/discover.mjs`); the libraries come from `--libs DIR` or `GAME_LIBS` (a folder
where `npm i --ignore-scripts phaser pixi.js kaplay matter-js planck` was run). The tests read `window.__g` or
`window.__strike`: expose the same names from a project's game, or adapt the selectors.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Fixed-step loop, input manager, versioned save (three fixes over the lane code) | [scripts/game-core.js](scripts/game-core.js) | verified |
| Real-time game: pure step, interpolation, pause, options, fullscreen, live region, reduced motion | [examples/coin-run.html](examples/coin-run.html) | verified, gate pass |
| Self-test of loop, input, pause and saves (32 assertions) | [scripts/test-game.mjs](scripts/test-game.mjs) | verified |
| Turn-based quiz game with the Save The Damsel patterns | [examples/strike.html](examples/strike.html) | verified, gate pass |
| Its self-test (10 assertions) | [scripts/test-strike.mjs](scripts/test-strike.mjs) | verified |
| Shelf atlas packer with extrusion and hash JSON | [scripts/atlas-pack.js](scripts/atlas-pack.js) | verified |
| Phaser, PixiJS and Kaplay one-file pages from a run-time atlas | [scripts/build-engines.mjs](scripts/build-engines.mjs) | verified (Phaser 4.2.1, PixiJS 8.22.0, Kaplay 3001.0.19) |
| Engine and packer tests (18 assertions) | [scripts/test-engines.mjs](scripts/test-engines.mjs) | verified |
| matter-js against planck: determinism, stacks, tunnelling, sub-steps, cost (8 assertions) | [scripts/test-physics.mjs](scripts/test-physics.mjs) | verified (Node) |
| Playwright and browser discovery for the tests | [scripts/pw.mjs](scripts/pw.mjs) | verified |
| Library table, one-file engine recipes, physics, atlases | [references/engines-and-physics.md](references/engines-and-physics.md) | reference |
| Input, pause, saves, fullscreen, options, audio meeting the loop | [references/input-pause-saves.md](references/input-pause-saves.md) | reference |
| Save The Damsel: what it does and teaches | [references/save-the-damsel.md](references/save-the-damsel.md) | reference (read from its code) |

## 5. Quality bars

- The simulation is a pure step at a fixed `dt`: the same input gives the same state at 30, 60, 144 and 240 Hz and
  with jitter (asserted, not assumed); a stall runs at most `maxSteps` updates.
- Pause always resumes; a hidden tab runs no steps and replays no hidden time; sound suspends with the game.
- Every action works by keyboard (rebindable, `event.code`) and by an on-screen control of at least 44 px; gamepad
  and pointer stick where the target has them; no key held through a blur stays held.
- Saves are versioned, migrate, refuse a newer build, survive blocked storage and autosave on hidden and `pagehide`.
- Turn-based steps land on the animation's own `finished` or end event, each with a run-timer backstop; nothing from an
  old run touches a new one.
- Accessibility options: shake off under reduced motion, speed, toggle-for-hold, pause on blur, high contrast; a text
  score and a polite live region; the gate passes in strict `file://` with no warnings.
- An engine in one file makes no network request (asserted) and has a ledger row; 60 fps on the target device is
  stated as not verified unless measured there.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Jumps go higher at low frame rates; replays drift | variable `dt` in the simulation | the accumulator and a fixed step | tested (lane; identical state at four rates here) |
| 2 | After a stall the game races (the spiral of death) | the accumulator holds seconds | clamp the frame (250 ms) and cap steps (10) | tested |
| 3 | A burst of catch-up on return to the tab | hidden time replayed | drop it: `last = null; acc = 0` on resume | tested |
| 4 | Every animation-timed step stalls in a test, or the eighth wound lands late | the desktop Browser pane and extension tabs report `hidden`, so rAF runs at 0 fps | test in headless; keep a backstop on every animation-gated step | tested (field log) |
| 5 | The game pauses and can never resume | the pause key read inside `update()`, which does not run while paused | handle pause in its own `keydown` listener | tested (lane) |
| 6 | Toggle-for-hold makes jumps fire twice or never | edges computed from the toggled state | edges from the physical state | tested (lane) |
| 7 | With `pauseOnHidden: false` the game freezes after the tab returns | the lane's `_auto` paused on hidden but refused to resume in that mode | ignore visibility in that mode and only drop the gap | found and fixed here, tested against the lane code |
| 8 | A quick tap does nothing | keydown and keyup both arrived between two steps | latch presses until sampled | found and fixed here, tested against the lane code |
| 9 | Keys stay held after Alt-Tab | no keyup is sent to a blurred window | clear on `blur` and hidden | tested |
| 10 | WASD scrambled on AZERTY | `e.key` for movement | `e.code`; `e.key` only for text | reported (lane) |
| 11 | Browser shortcuts and Tab stop working | `preventDefault` on every key | only bound keys, never with modifiers | tested |
| 12 | Saves lost on phones | saving on `unload` | `visibilitychange` to hidden and `pagehide` | reported (lane), autosave tested |
| 13 | A seeded save in a test is overwritten | the old page autosaves on `pagehide` during reload | seed in a fresh context before the first load | tested (lane, again here) |
| 14 | The game crashes in private mode or from `file://` in Firefox | `localStorage` throws | wrap, keep memory, tell the player | tested (blocked getter) |
| 15 | Phaser keeps running in a hidden tab | it emits `hidden` and `visible` but does not pause its clock | `game.pause()` and `game.resume()` on those events; clamp the delta on return | tested here on Phaser 4.2.1 (502 ms advanced in 500 ms hidden without the recipe, 0 with it) |
| 16 | PixiJS throws on `app.renderer` | `init` is asynchronous since v8 | `await app.init(...)` first | tested |
| 17 | Your own `add` or `pos` is overwritten | Kaplay's default `global: true` copies every function onto `window`; even `global: false` defines `window.kaboom` and `window.kaplay` | always `global: false`; do not name globals `kaboom` or `kaplay` | tested |
| 18 | A fast ball passes through a wall | matter-js has no continuous collision (ended at x = 1200, wall at 300) | planck (stopped at 20, wall at 30), thicker walls, or sub-steps (40 per frame stopped it) | tested |
| 19 | matter results differ between runs and it warns in the console | a variable delta, or one above 16.667 ms | a constant step from the loop | tested |
| 20 | Neighbouring frames bleed into a sprite | tight atlas under bilinear filtering or mipmaps | pad 2 px and extrude 1 px; nearest filtering for pixel art | reported (lane); packer gutters tested |
| 21 | Huge fill cost on some phones | `devicePixelRatio` of 4 used as is | cap at about 3 for memory; never lower quality for this machine | reported (lane) |
| 22 | Gamepad not seen; buttons wrong | pads appear only after a button press; non-standard mappings; stick drift | check `mapping === 'standard'`; deadzone | reported; deadzone tested with a mock only |
| 23 | Fullscreen throws; orientation lock throws | outside a gesture; desktop and frames reject `lock` | call from the click and catch both | tested (no error either way) |
| 24 | Silence until the second tap; sound runs while paused | the context starts suspended; no `suspend()` on pause | resume in the first gesture; suspend on pause and hidden | reported (lane, `sensei-audio`) |
| 25 | The plate breaks before the weapon arrives when frames are slow | timing the hit with a timer from `ready`: script time against the animation's clock | split the keyframes at the impact; land on the flight's `finished` | tested (field log, QC DM-15; `test-strike.mjs`) |
| 26 | A slowed test breaks the plate early anyway | the slowed flight outlasted the real backstop | keep slowed durations well inside the backstops (quarter speed lost to a 1.9 s backstop here; half speed passed) | field log, reproduced here |
| 27 | The hinged plate only shakes and fades | `perspective` on a grandparent; `overflow: hidden` on the cell | perspective on the plate's own parent, clip in an inner window, outer frame clips the whole | tested (field log, QC DM-14; structure asserted here) |
| 28 | The final step never comes under reduced motion | waiting for `animationend` from an animation that is switched off | call the step directly on that path | found here, tested |
| 29 | A restart shows a plate breaking in the new run | a late callback from the old run | run-scoped timers and `run !== current` in every callback | tested here |
| 30 | Beats of a climax overlap | each started on its own timer | chain on events, each with a backstop; build the heavy part while it is certain and unseen | reported (field log, QC DM-11) |
| 31 | The pressed element snaps level before shrinking | `transform` in `:active` replaces the hover `transform` | `translate` for lift, `scale` for press, listed in every transition that can win | tested (field log; `sensei-motion-ui`) |
| 32 | `lint-web` flags the loop library for reduced motion | a game loop is the simulation, not decoration | keep the loop; turn off decorative motion and say so in the code | found here |
| 33 | Assets from a marketplace pack shipped inside a file anyone can unpack | sprite, font and sound licences often forbid that; CC-BY needs credit | read each licence before inlining; ledger row; credits screen | reported (lane) |

## 7. Licences

- **This skill's code** (`game-core.js`, `atlas-pack.js`, `coin-run.html`, `strike.html`, the builders and tests,
  `pw.mjs`) is HTML-Sensei's own, from the research lane's `code-apps/game` and written here; ships in the plugin.
- **Engines and physics**: Phaser, PixiJS, Kaplay, matter-js, planck.js MIT; Excalibur BSD-2-Clause. Usable in any
  project: inline the minified file with its banner kept, pinned, with a ledger row. **Not vendored in the plugin**:
  the builder reads them from the project's own `node_modules`.
- **Authoring tools**: Tiled's editor is GPL-2 (its map files are yours); LDtk MIT; Aseprite source-available and paid;
  TexturePacker commercial. Use their output; never ship the tools.
- **Save The Damsel** is the owner's game: its art, questions and sounds stay in Ultra Bookworm; this skill teaches
  its patterns with its own code and shapes.
- **Assets**: the trap is the asset, not the engine (TRAPS 33).

## 8. Verification

Run here (Windows 10, Node 24, installed Chrome 155 headless through Playwright 1.63, software GL, strict `file://`;
libraries fetched with npm into a scratch folder: phaser 4.2.1, pixi.js 8.22.0, kaplay 3001.0.19, matter-js 0.20.0,
planck 1.5.1, axe-core 4.14.0):

- `test-game.mjs` on `coin-run.html`: 32 of 32 pass, including the three fixes; the two lane-code faults (stuck pause
  with `pauseOnHidden: false`, lost tap) were reproduced against the lane's original `core.js` before fixing.
- `test-strike.mjs` on `strike.html`: 10 of 10 pass (after the quarter-speed run failed on the backstop, TRAPS 26).
- `test-engines.mjs`: 18 of 18; `test-physics.mjs`: 8 of 8.
- `sensei-verify`'s `sensei-gate.mjs`: `coin-run.html` pass, 21 checks, after enlarging the checkboxes it flagged at
  21 px; `strike.html` pass, 20 checks. Both contact sheets were looked at.
- `lint-web` (`plugin/lib/lint/web.mjs`) clean on every file after the note of TRAPS 32.

Not verified: frame rate on any target device; real gamepads (mocked), real touch screens and hybrid devices; iOS
audio unlock and iPhone fullscreen; Firefox and Safari; screen-reader play-through; Excalibur, tilemaps, Matter inside
Phaser, engine audio; production atlases from MaxRects packers; the original Save The Damsel was read, not re-run.

## 9. Carried by

- Agent `sensei-game-engineer` builds from the examples: the pure step first, then `GameCore`, pause, saves, options
  and fullscreen before polish; runs the self-tests and the gate; reports frame rate, gamepads and iOS audio as not
  verified unless tested on them. `sensei-sound-designer` supplies the sound (`sensei-audio`); `sensei-reviewer`
  checks the quality bars under its accessibility lens; `sensei-packager` packs engine and assets into one file.
- Hook `lint-web.mjs` (PostToolUse, warns): `reduced-motion:requestAnimationFrame` (a loop with no reduced-motion
  check), `transition-all`, network references when offline, vendored code without its notice. `lint-3d.mjs` for a
  WebGL game (context loss, pixel-ratio cap, pause when hidden, `</script` in an inline script). `guard-licence.mjs`
  blocks never-ship sources; `keep-eol.mjs` reports changed line endings; `gate-claim.mjs` wants a fresh passing gate
  before "done".
- Not enforced by any hook (covered by the self-tests and the reviewer): a variable `dt` in the simulation,
  `Math.random` in a step, `e.key` for movement, a pause key read inside `update`, `unload`-only saves, `localStorage`
  without `try`, Kaplay without `global: false`, Phaser without a hidden-tab pause, animation-gated steps without a
  backstop. The research lane proposed hook rules for these; they are not in `plugin/lib/lint/` yet.
