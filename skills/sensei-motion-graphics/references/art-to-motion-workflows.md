# Living art and frame-based film workflows

Original HTML God guidance, researched 2026-10-28. This reference extends `sensei-motion-graphics`; it does not install or execute an upstream engine. Read the [pinned source record](../../../docs/research/motion-game-sources.md) for provenance, licences and the distinction between source evidence and local verification.

## Choose the route before producing assets

| Result needed | HTML Sensei route | Constraint |
|---|---|---|
| An illustration with precise, interactive movement | Layered transparent art + DOM, SVG, Canvas or `sensei-3d` | Author each movable part separately; retain its original coordinates |
| Paint, ink, print or pixel texture that moves within shapes | Seeded procedural drawing + masks + independently animated motifs | Cache the expensive static construction; evaluate motion from time |
| Organic motion that a code rig cannot provide | Optional image-to-video service, then embed an approved clip | External generation; inspect temporal identity and loop seams; record service and rights |
| A 3D commercial or a long encoded film | Existing `sensei-video-pipeline`; optional Framefields authoring project | Framefields is a separate Node/native WebGPU toolchain, not an inline HTML library |
| A painting that becomes a playable environment | `sensei-games` owns input/simulation; this reference owns art motion | A decorative timeline must never mutate the game's rules |

Huashu's source makes a useful distinction between drawing a scene procedurally, animating generated layers, generating video between designed frames, and combining those routes. Adapt that decision to the subject; do not copy its characters, scene compositions or demo films.

## First design a credible still

Define the subject, camera, focal hierarchy, lighting direction, palette roles, material scale and negative space for text. Inspect one full-size still before producing a family of assets. When the user has delegated art direction, select and document the strongest direction; a research source's own approval process does not override the user's authorization.

For an image-generated layer request, supply the approved still as the reference and name its role: foreground silhouette, hero, separate moving limb, smoke plate, reflection or background. Request true transparency through the image tool. Keep text, labels and buttons in HTML/SVG. Record image dimensions, trimmed bounds, original top-left offset and semantic pivot. Cropping a layer must not change its placement in the master frame.

A portable asset record can use this shape (HTML God's own suggested schema):

```json
{
  "id": "hero",
  "src": "hero.png",
  "canvas": [1920, 1080],
  "trim": [714, 218, 482, 676],
  "pivotInCanvas": [960, 870],
  "role": "foreground",
  "source": "user asset or recorded generation",
  "rights": "record the actual terms"
}
```

The trim offset is for compositing, not a CSS transform origin. Convert the pivot to the trimmed layer's local coordinates before applying rotation. Review the composite over its real background, then inspect the transparent edge over both light and dark checks.

## Animate the material, not just its rectangle

A living shot has a clear primary event and a few subordinate motions. Examples: a fold opening with cloth shimmer; water ripples with a reflected highlight; an ink stroke spreading while paper fibres stay fixed; a carved emblem turning with dust crossing a shaft of light. A pan across a still is a camera move; it does not establish that the painted subject is moving.

Separate the scene into:

1. Static composition and material caches: geometry, paper, stone layout, background paint.
2. Subject action: the event that changes the viewer's understanding.
3. Local material motion: a restrained reflection, flow, ripple or grain reveal.
4. Atmospheric layers: depth-ordered fog, particles or leaves.
5. Type and annotations: timed for reading, kept sharp and unobstructed.

Use the material's own geometry to guide motion. Flowing strokes follow a direction field; mosaic cells keep their boundaries while their colours change; pixel art uses a fixed logical grid with nearest-neighbour scaling; ink spreads through masks over an unpainted ground. Do not solve every style by displacing the whole image with the same sine wave.

For a film, compute each phase from absolute time. Hand-made line variation can quantize only the line texture to a chosen cadence while the camera remains smooth. Seed texture identities once; do not regenerate unrelated random brush marks every frame. See the existing `motion-kit.js` and `__seek(t)` contract in the parent skill.

## Camera and continuity

Keep the camera steady when a new object, drawing operation or readable sentence already supplies the action. Choose a camera move to reveal scale, follow an action or change emphasis. Compare neighbouring moves; repeated push-ins create monotony even when each individual shot is polished.

For a travelling-world film, express events relative to semantic anchors such as "interaction begins" rather than hard-coded global timestamps. Re-timing a walk should move its dependent gestures with it. Record a ground line, standing height and foot pivot for every world. Match both sides of a transition at the boundary.

A continuous traversal benefits from a monotonic camera path, but this is a recipe for that kind of film, not a restriction on every story. For deterministic seeking, calculate that path ahead of time or derive it analytically; a "largest camera position seen so far" variable inside `seek` depends on playback history and is unsuitable.

Design a seam in the visual language of the next scene: a cut-paper edge, a pixel grid, a drawn contour or a moving mask. Test the same boundary in forward playback, backward scrubbing and direct seeking.

## Optional Framefields hand-off

Framefields supplies code-first compositing, vector text, effects, 3D, frame-based timelines and native rendering. Its inspected repository is beta and declares Node >=22. Preserve the project's pinned dependency version; consult that installed version's API instead of assuming README snippets match every release.

Use this hand-off when native video rendering earns the setup cost:

1. Create a separate authoring folder with a locked package version, TypeScript entry, local assets, fonts and an output directory. Keep service credentials outside the distributable.
2. Map the approved storyboard to integer frame ranges. One composition owns resolution, FPS and duration; the same frame index drives typography, objects, cameras and sound cues.
3. Typecheck and validate the composition; review its lint results.
4. Render the opening frame, peak action, every cut on both sides and the final exported frame. Then render small labelled grids around the hardest transitions.
5. Inspect a short motion/audio preview. A real-time preview may skip frames on a slow device; paused frame inspection and encoded output answer different questions.
6. Render the film, inspect its actual duration and audio, and retain the existing Sensei delivery gates. A renderer's successful exit is not a visual review.

Useful architectural lessons from its source are renderer-independent: absolute frame clocks; explicit layer start offsets; seeded coherent motion; analytical springs; and one measured audio structure driving a cut list. The launch example derives chapter timing from stored audio analysis. When timing to music, verify the actual waveform's beat phase and section changes rather than trusting the BPM in a generation prompt. Save those measurements so a later render does not silently reanalyse to different cuts.

Framefields' gateway is optional and separate from its local renderer. Do not require an API key for code-only composition, and never put a key in an HTML file. A native Node package or its editor does not become a standalone browser application just because it can preview in a browser. For an HTML delivery, embed a supported rendered video or build the interactive scene with browser-native code; package all required media according to `sensei-single-file`.

## Acceptance and honest reporting

Inspect the first, middle and last frames, plus cuts and peak motion. Stress the design with the longest text, a narrow crop, a square crop and the chosen caption area. Watch motion at normal speed: a contact sheet cannot reveal camera discomfort, abrupt speed changes or sound sync.

Use the parent skill's evidence for deterministic seek and film gates. Report procedural references as guidance until a project executes them. No Huashu or Framefields renderer was run as part of this documentation integration; no performance, model quality or cross-platform result is implied.

Keep provenance per asset. Huashu's MIT code/docs do not grant reuse of its author character or its Clawd fan-demo media. Fonts, stroke data, source paintings, generated clips and external service outputs have their own terms. Framefields code is Apache-2.0; any future copied implementation must keep required notices. This reference copies no upstream implementation or media.
