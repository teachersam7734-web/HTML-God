# Hand-off to HyperFrames

HyperFrames is a separate toolchain whose own skills may be installed on the user's machine (on the build machine:
`hyperframes`, `hyperframes-core`, `hyperframes-cli`, `hyperframes-animation`, `hyperframes-creative`,
`hyperframes-keyframes`, `hyperframes-audio`, `hyperframes-registry`, `hyperframes-studio`). This plugin does not
copy their content. When they are present, they are the authority on HyperFrames itself; read them before making any
claim about its CLI or composition format.

## When to hand off

| Situation | Route |
|---|---|
| A HyperFrames project already exists, or the user asks for HyperFrames, Studio editing, its registry blocks, or its cloud render | hand off: load the `hyperframes` entry skill and follow it |
| The user wants an editable timeline with tracks and sub-compositions for later human editing | prefer HyperFrames |
| A single seek page (DOM, SVG, canvas, WebGL) that must also play inside a lesson or deck | stay here: `render.mjs` plus `player.js` |
| Hand-drawn canvas film (`sensei-handmade-animation`) | stay here |
| Remotion is already in the project | use Remotion; check its licence terms for companies before commercial use (not verified here) |

## What carries over unchanged

The craft (`sensei-motion-graphics`), the storyboard and gates, the narration-first timing, the audio targets and the
review loop are renderer-neutral. A HyperFrames composition is also a seek-safe page driven by paused timelines, so
the determinism rules in `contract.md` apply to it as written.

## Field notes from the Save The Damsel films (rendered with HyperFrames, reported in SENSEI-LOG)

- The lint wanted the timeline registration inline: setting `window.__timelines` inside an external `lib.js` gave
  `missing_timeline_registry`. Fix: one inline line after the script tag.
- About 30 `nested_structure_needs_subcomposition` warnings are advisory for Studio editing; a deliberate
  data-driven monolith with one timeline can be kept. Note it, do not chase it.
- `hyperframes check` failed to screenshot ("Unable to capture screenshot") on that machine; `snapshot
  --no-browser-gpu` worked and became the review loop.
- The virtual GPU blanked WebGL under load; `--no-browser-gpu` (SwiftShader) fixed it, deterministic and only
  slightly slower there.
- Multi-worker capture wrote every frame to disk first (about 7.3 GB for 3:55 at 1080p);
  `HF_CAPTURE_PARALLEL_STREAM=true` streamed frames into the encoder: 3 workers, 7,063 frames, 12 min 50 s.
- Picture and sound read one plan file, so every cue lined up by construction: render silent, then mix and mux.

## Hand-off checklist

1. Storyboard and gate results from `sensei-motion-graphics` travel with the request.
2. Narration measured and the timeline built (`timeline.mjs`), so beat times are numbers, not guesses.
3. Fonts and media local; licences in `.sensei/licences.json`.
4. After the HyperFrames render, come back here for `sheet.mjs` (contact sheet and strips of the master),
   `audio.mjs` (loudness and mux) and `film-gates.mjs` (G0, G2, G3), so the evidence matches every other film.
