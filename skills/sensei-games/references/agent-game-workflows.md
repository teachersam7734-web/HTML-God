# Agent-assisted games for a single HTML file

Original HTML God guidance, researched 2026-10-28, informed by [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills). Exact inspected revisions and licence evidence are in the [source record](../../../docs/research/motion-game-sources.md). These recipes extend the existing tested `GameCore` and engine packer; they do not bundle the upstream catalogue or add untested engines.

## Route one runtime, then compose concerns

Inspect the actual game entry point, imported scripts and dependency lock before selecting APIs. An art tool in a subfolder is not evidence that it is the game engine. Preserve an existing engine and version. For a new single-file project, use this skill's decision table: DOM for turn-based interfaces, Canvas plus `GameCore` for custom 2D play, a verified bundled engine recipe when it earns its size, and `sensei-3d` for WebGL scenes.

Load only the additional concern needed now:

| Brief signal | Compose with this skill | First concrete artifact |
|---|---|---|
| Platformer or arcade | movement/collision + camera + game feel | Greybox movement, one obstacle, one goal |
| Puzzle or card game | pure rule model + DOM/SVG interface + saves | Valid/invalid move tests and an undoable turn |
| Roguelike or dungeon | seeded generation + AI + saves | Reproducible map seed, reachable exit and one encounter |
| Narrative or visual novel | dialogue state + accessible choices + saves | One branch, return path and save/load round-trip |
| Cohesive game art | image workflow + asset manifest + engine import | One hero/enemy/background family at native scale |
| 3D character play | `sensei-3d` + animation/asset workflow | One loaded model, one clip, input and collision proxy |
| A cinematic reveal inside the game | `sensei-motion-graphics` + `sensei-audio` | A skippable cut-scene and a clean return to play |

The source catalogue includes native engines and publishing workflows beyond the browser. Their coverage is useful research, not a claim that HTML God exports Unity, Unreal, Roblox or Steam builds. Do not migrate a browser project to a native engine because an upstream router prefers it.

## Build the playable slice before producing the world

State the player action, objective, failure condition and restart path in one short paragraph. Make a greybox that can be won and lost. Judge movement, fairness and readability before producing a large asset set.

Keep rules independent of rendering and sound. Run the existing fixed-step loop and latch input as documented in the parent skill. A presentation event may follow a rule change; it must not be the only record that a rule changed. For example, reduce health in the simulation and emit a damage event; a hit animation reads that event. Reduced motion can remove shake without deleting damage.

A useful order of operations is: sample input; update intents; resolve movement/collisions; update objectives; queue presentation events; save at a stable checkpoint; render. Freeze or reset all run-owned timers and callbacks when restarting.

## Produce asset families with a measurable target

The researched asset skill's strongest contribution is a production chain: visual brief, manifest, one accepted target, related assets, deterministic normalization, engine import and in-context review.

For each required asset, record:

- Identifier and gameplay role, including its states and animation names.
- Source dimensions, logical display size, view, palette, light direction and edge treatment.
- Frame order and durations, trim bounds, pivot, baseline and collision proxy.
- Source/tool, licence, modifications and whether it is placeholder, selected or verified.
- Runtime filtering, alpha, colour-space needs and packaging size.

Generate a representative family against the real background before expanding: idle hero, moving hero, one enemy, one hazard and one UI element. Use the selected seed image as a reference for follow-on edits. Keep text in code. A sprite's painted shadow is not its collision shape.

Inspect the family at actual gameplay size and at an enlarged nearest-neighbour view where appropriate. Check silhouettes, foot anchors, identity across frames, alpha fringes and state readability. A generated "eight-frame sheet" is not evidence that it contains eight clean cells: detect and normalize its actual layout first.

For tiles, repeat a small block across a 3-by-3 area and check seams. For 3D, check the model's scale, pivot, normals, materials, skeleton, animation names and collision proxy in the actual browser scene. A render of a concept is not a rigged model.

Use the existing atlas packer with padding/extrusion, and keep the manifest available after packing. Inline only assets whose terms permit distribution in an easily unpacked HTML file. Record asset rights separately from the engine's licence.

## Enemy decisions: use the smallest model that stays clear

A small patrol/chase/attack state machine is enough for many browser games. Use a behavior tree when priorities, interruption and actions that span several steps make a state machine awkward. Use utility scoring when decisions involve competing continuous needs such as distance, danger and remaining health.

Keep per-agent facts separate from decision logic. A blackboard can hold target ID, line of sight, health ratio and current action. Store stable IDs rather than DOM nodes so saves and replays remain meaningful.

Define three behavior-tree outcomes: success, failure and still running. Be explicit whether a sequence resumes a running child or rechecks its conditions. A remembered "visible target -> chase" sequence can continue chasing after visibility disappears. A reactive guard or an explicit validity check in the chase action fixes that. When an action is interrupted, release its resources and input intent; do not erase cooldown deadlines just because a branch resets.

For utility selection, normalize each consideration to 0..1. Separate hard eligibility rules from preference scores; unreachable targets and attacks without ammunition must be excluded. Keep a current action until a challenger exceeds it by a stated margin or a commitment window ends. This prevents near-tie oscillation. Use the simulation's time for cooldowns; use seeded choice if variety must replay.

Run decisions on a deliberate simulation cadence while movement remains on the fixed step. Allocate decision structures at spawn, not on every tick. A developer overlay showing active state, chosen target and scores is more informative than tuning behavior by guesswork.

These are architecture recipes, not a shipped BT/utility runtime. The upstream C# implementations must not be pasted into JavaScript as if engine types, lifecycle and allocation behavior were identical.

## Motion graphics become gameplay through clear contracts

A living background can use cached material layers, independent motif loops and time-based cameras from the [art-motion workflow](../../sensei-motion-graphics/references/art-to-motion-workflows.md). Keep three clocks explicit:

| Clock | Owns | On pause / reduced motion |
|---|---|---|
| Fixed simulation time | Input, physics, AI, objectives, cooldowns | Pauses with the game; speed options use the loop's supported time scale |
| Presentation time | Particles, hit response, decorative texture | Freeze on pause; reduce nonessential movement |
| Cut-scene time | Authored camera, type, narration and cues | Pause or skip coherently; resume play in a defined state |

A camera animation must never alter collision coordinates. Keep world-space positions distinct from screen transforms. A cinematic must have a keyboard-accessible skip action and return focus and control to the game. Do not use animation completion as a rule engine; where a turn intentionally waits on animation, use the existing run-scoped completion/backstop pattern.

A generated video may supply background atmosphere. It is not a physics world or an interactive NPC. Use a browser simulation and actual collision geometry for play.

## Verify the promise made by the game

Keep the existing self-tests and Sensei gate. Add focused checks when the new behavior requires them:

| New behavior | Meaningful check |
|---|---|
| Seeded map | Same seed gives the same map; start and goal are connected; spawn is valid |
| Undoable puzzle | Move and undo restore the rule state; invalid moves leave it unchanged |
| Reactive enemy | Lose sight during a running chase; priority can interrupt; cooldown survives interruption |
| Utility enemy | Scores stay finite/in range; invalid options lose; near ties do not switch every tick |
| Asset family | Review native-scale composition, anchors and alpha over the real backgrounds |
| Cut-scene | Pause, resume, skip, restart mid-scene and reduced-motion all return to a playable state |
| Offline packaging | Open the delivered HTML with networking disabled; exercise every asset and scene |

Record the device, browser and what was exercised. Separate a successful smoke test from an actual play-through. The research catalogue's engine versions and its own verification claims are source information; local project results require running this project's checks. No new engine, AI runtime or performance benchmark was executed for this reference addition.
