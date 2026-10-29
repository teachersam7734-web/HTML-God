---
name: sensei-handmade-animation
description: "Hand-drawn and painted 2D animation in HTML, rendered or scrubbed as a film: boiling ink lines with stable seeds, drawings on twos with the camera on ones, paper and watercolour washes, squash and stretch, anticipation, takes, iris and brush-wipe seams, reads-based timing, and the sheet, strip and crop review loop. Use when someone asks for a cartoon, a hand-drawn or painted look, a storybook cut-scene, a mascot or character short, a watercolour or ink animation, says it looks AI-generated and should feel handmade, or needs to review an animation frame by frame. Product and type motion graphics belong to sensei-motion-graphics; rendering to MP4 to sensei-video-pipeline."
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-handmade-animation

Character and painted animation drawn by code, frame by frame, as a pure function of time: it renders to MP4 through
`sensei-video-pipeline` and scrubs in a page through its player. The craft rules come from ClaudeAnimationBase,
claude-animation-skill and papermotion (MIT) and PDoomVideo (method only); the code here is our own.

## 1. When to use

Character shorts, storybook or lesson cut-scenes, mascot moments, painted title cards, hand-drawn loops, game
cut-scenes in a drawn style, and any review of an animation's motion ("check the landing", "why does it look stiff").

Another skill owns it instead:

| Request | Skill |
|---|---|
| Brand stings, product promos, kinetic type, UI demos, film gates G0 to G5 | `sensei-motion-graphics` |
| Rendering, motion blur, chunked renders, audio mux, captions, the player | `sensei-video-pipeline` |
| Sprites, game loops and live game feel (hit-stop in a running game) | `sensei-games` |
| Visual style choice before animating | `sensei-direction` |
| Sound effects and score | `sensei-audio` |
| Lottie or Rive files made in their own editors | `sensei-lottie-rive-video` |
| 3D characters and rigs | `sensei-3d`, `sensei-blender` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Route | canvas seek page (default), Node `@napi-rs/canvas`, p5 + p5.brush, a stateful engine | `references/pipelines.md`: canvas unless the look needs p5.brush pigment (and a GPU to render it) or the story needs real physics |
| Boil method | jitter path points (exact), SVG turbulence seed (repeatable in order only), none | a film checked by hash in any order: path points; a live SVG page: turbulence is fine; reduced motion or long loops: none |
| Exposure | twos (default for drawings), ones for fast actions, holds | hand-drawn feel on twos; camera, light and parallax always on ones |
| Boil rate | 12 per second for characters, 6 for big calm backgrounds, 0 for "no boil" | 12 Hz reads as drawn at 24 fps; at 60 fps hold values about 5 frames or it flickers |
| Frame rate | 24 (default), 30 | 24 for a drawn look; 30 when it sits with UI motion |
| Text | none in the painted picture; real HTML text and captions over it | story pieces stay text-free; lessons overlay accessible text |
| Characters | original only | never ship Anthropic's Clawd or claude-animation-skill's critter; design our own |

## 3. Core technique

### 3.1 One seek function, two clocks

```js
const H = window.Handmade;                        // scripts/handmade-kit.js
function seek(t) {
  const tp = H.onTwos(t, 24, 2);                  // drawings on twos: poses change every 2 frames
  const camX = H.lerp(0, -40, H.ease.inOut(H.seg(t, 0, DUR)));   // camera on ones
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(PAPER, 0, 0);    // paper drawn once in __ready from a seed
  g.save(); g.translate(camX, 0);
  H.wash(g, hill, { key: 'hill', t: tp, color: '#7a9a5a', alpha: 0.42, rate: 6 });   // calm background, slow boil
  drawCharacter(t, tp, pose(tp));                 // every mark keyed by a stable name, never by frame number
  g.restore();
  if (t < 0.6) H.iris(g, W, HT, 520, 420, H.ease.in(H.seg(t, 0, 0.6)) * 900);     // a seam into the first shot
  H.brushWipe(g, W, HT, H.ease.inOut(H.seg(t, P.wipe, DUR)));                     // and out of the last
}
window.__meta = { dur: 6, fps: 24, w: 1280, h: 720 };
window.__seek = window.seek = seek;
window.__ready = Promise.resolve().then(() => { PAPER = H.paper(document, W, HT, { seed: 'pip-paper' }); seek(0); return true; });
```

The contract is `sensei-video-pipeline`'s: no clock, no unseeded random, no state between frames. Boiling is
`jit(key, i, t)`: a stable number per element and point that changes only at boil steps, so a held drawing is
identical inside a step and a moving element never re-randomises the rest.

### 3.2 Act, do not move

Build key poses first and read them on a sheet. Anticipation before every action (a crouch `squash` about 0.78 over
0.25 s), stretch on the way up, a landing squash of 1.35 to 1 in about 0.18 s with a ring on the follow-through, dust
and a small decaying shake on the hit. Faces change through `mood(t, keys)`: eyes squeeze shut, the body does a take,
the new face opens. A look leads (eyes, then head, then body). Characters big. Something happens in every scene.
Numbers and rig traps: `references/timing-and-acting.md`.

### 3.3 Time it for the viewer

Write the reads for each shot (what the viewer must understand, in order, with times) and let them set the shot
length: fast actions, slow meanings, one read at a time. Transitions at every seam. One world, a colour arc, an ending
that rhymes with the opening. `references/principles.md` has the rules, the failure list and the storyboard with reads.

### 3.4 Look honestly at three zooms

```bash
node scripts/review.mjs film.html --sheet 0.3,1.0,1.6,1.95,2.76,3.4,4.2,5.6   # the shape of the whole piece
node scripts/review.mjs film.html --strip 2.6:3.0                             # every frame of the landing
node scripts/review.mjs film.html --crop 700,240,280,300@3.4 --zoom 2         # the face, at full resolution
```

Budget: a sheet per shot, a strip per key motion and transition, a crop per face that carries the story. Describe
each frame in one sentence before judging. Then render (`sensei-video-pipeline/scripts/render.mjs`) and review a sheet
of the master too: judge motion only from the render, never from a live view that drops frames (papermotion).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Kit: seeded boil and exposure, eases, keyframes, beat pulse, ring, area-keeping squash, arcs, mood changes with a take, paper texture, tapered boiling ink line, pooled wash, blob, iris, brush wipe | `scripts/handmade-kit.js` | verified (Node unit checks, Chrome) |
| A six-second short: original character, notice, anticipation, arc hop, landing squash and dust, take, bloom, beat bounce, iris in, brush wipe out, on twos with the camera on ones, sound cues in `__events` | `examples/hop.html` | verified, deterministic in any order |
| Boiling line in plain SVG with a stepped turbulence seed, steam on twos | `examples/svg-boil.html` | verified in order; not bit-exact out of order (trap 1) |
| Three-zoom review: sheet, strip of every frame, full-resolution crop with zoom | `scripts/review.mjs` | verified, images looked at |
| End-to-end test of the kit, both examples and the review loop | `scripts/test-handmade.mjs [outDir]` | verified |

Render either example with `node ../sensei-video-pipeline/scripts/render.mjs examples/hop.html hop.mp4`.

## 5. Quality bars

- Same frame in and out of order (`render.mjs --probe`), with samples straddling every hand-off; for SVG-filter boil,
  two fresh in-order renders identical.
- Held drawings identical inside a boil step; poses change only on twos unless the exposure sheet says ones.
- Frame 0 is part of the film; transitions at every seam; nothing pops without an in-between.
- Every shot's reads have time: no two important reads overlap; the final read gets its own hold.
- Characters at least about a third of the frame height in a medium shot.
- No pure black or white; one light direction per shot; no flat shapes near the camera.
- A sheet, a strip per key motion and a crop per face looked at, plus a sheet of the rendered master.
- Page version: `role="img"` with a description, captions for any voice, reduced motion shows a poster and holds the
  boil, flashes at most 3 per second.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | `--probe` fails on an SVG boil page by a few edge pixels | Chrome caches the turbulence and displacement result; revisiting a seed rasterises slightly differently (mean 0.004 levels) | fresh in-order renders match; for hash-exact films boil the path points (`inkLine`) instead | tested: 2 of 4 frames differed after out-of-order seeks, two fresh runs identical |
| 2 | The last frames are fully covered by the closing wipe | wipe bands finished before k = 1 | each band finishes exactly at k = 1 (`brushWipe` now divides by `1 - lag`) | tested on our own sheet |
| 3 | The character reads as a wide shot | the body was about a sixth of the frame height | scale to about a third or more | tested on our own sheet |
| 4 | Held drawings shimmer | the jitter seed was tied to the frame number | seed from the element's name and the boil step | reported, claude-animation-skill |
| 5 | Boil looks like flicker | 12 Hz boil on a 60 fps film | hold boil values for about 5 frames at 60 fps, or render at 24 | reported, PDoomVideo |
| 6 | The first frames are empty | everything enters after frame 0 | open mid-action or under an opening iris | reported, claude-animation-skill |
| 7 | Seven events in 1.3 s and nobody knows what happened | reads packed together | one read at a time; anticipation, action, hold | reported, ClaudeAnimationBase |
| 8 | Black frames, `CONTEXT_LOST_WEBGL` | p5.brush on a virtual GPU | SwiftShader (very slow: 2.8 to 34 s per frame) or a real GPU; say it was not verified at speed | reported, ClaudeAnimationBase run |
| 9 | Strokes collapse when the camera zooms | p5.brush draws far from the origin | paint each shape around its own centre | reported, ClaudeAnimationBase |
| 10 | A yellow glow turns green | pigment mixes subtractively | draw light additively (`lighter`, `screen`) | reported, ClaudeAnimationBase |
| 11 | Washes go muddy on dark grounds | multiply blending | paint over instead | reported, claude-animation-skill |
| 12 | `ERR_UNSUPPORTED_ESM_URL_SCHEME` on Windows | `import()` of a `C:\` path (Node canvas route) | `import(pathToFileURL(p).href)` | reported, claude-animation-skill run |
| 13 | A long 1080p Node canvas render stops silently | a native fault in `@napi-rs/canvas` (twice, between 20 and 25 s of film) | render in chunks or by scene | reported, not diagnosed |
| 14 | A verify step passes but renders still differ | samples missed the frame where state was carried | sample frames that straddle every hand-off | reported, claude-animation-skill |
| 15 | Stilt legs, crossing knees, waist pivots | rig origin offsets, IK without a preferred knee, rotating about the waist | origin at the ground point, pass the knee, rotate about the contact | reported, claude-animation-skill |
| 16 | Expressions snap | the face switched in one frame | `mood()` take: squint, squash, overshoot, open | reported, PDoomVideo and ClaudeAnimationBase |
| 17 | The same character keeps appearing in "original" work | the agent read earlier films first | do not open previous films when asked for an original | reported, papermotion |
| 18 | A stateful render differs from its stills | `draw` changed state and the renderer skipped draws | keep state changes in update; or stay pure in t | reported, papermotion |
| 19 | The text font differs on another machine | canvas text uses system fonts (and `@napi-rs/canvas` needs `GlobalFonts`) | embed or register fonts; keep story text out of the painting | reported, claude-animation-skill |
| 20 | A sound bed scratches under every draw-on | continuous pencil sound | draw-ons silent, contacts make sound | reported, claude-animation-skill |
| 21 | `evaluate` rejects a function in a CDP script | `Runtime.evaluate` takes an expression string | pass a string, `(() => { ... })()` | tested, while writing `test-handmade.mjs` |

## 7. Licences

- **Ship and use**: `handmade-kit.js`, both examples, `review.mjs` and the test (original HTML-Sensei code).
- **MIT, notice kept if code is copied into a project**: claude-animation-skill (its `core.mjs`, `pen.mjs`, `film.mjs`
  and sound scripts are vendorable with the notice), ClaudeAnimationBase, papermotion, lemo-opuscar styles.
- **Never ship as our asset**: Clawd (Anthropic's mascot, in ClaudeAnimationBase and PDoomVideo) and the "critter"
  character of claude-animation-skill; PDoomVideo's song.
- **Ideas only**: PDoomVideo (no licence); onetake (PolyForm Noncommercial).
- **p5.js** is LGPL-2.1: inlined in a project it keeps its notice and stays replaceable; p5.brush is MIT.
- `@napi-rs/canvas` is installed in the user's project when that route is chosen, never bundled in the plugin.

## 8. Verification

How to prove an animation: `render.mjs --probe` (or two fresh in-order renders for SVG-filter boil); the three-zoom
review looked at, one sentence per frame; a rendered master and its sheet; the reads checked against the storyboard;
sound cues placed from `__events`.

Verified here (`scripts/test-handmade.mjs`, all passing; Windows 10, Node 24.16, Chrome 155 headless with SwiftShader,
ffmpeg 7.1): the kit's unit checks; `hop.html` identical in and out of order at 6 times and drawn with ink present;
`svg-boil.html` repeatable across fresh in-order runs, holding inside a boil step and changing at the next; the review
loop writing a sheet, a strip and a 2x crop. The sheets, the landing strip and the face crop were looked at (they
caught traps 2 and 3).

Not verified: Safari and Firefox (canvas and filter output differ by engine); the Node canvas, p5.brush and papermotion
routes in this skill (described from the research runs); a live playback loop on a phone; sound for `hop.html` (cues
only).

## 9. Carried by

- Agent: `sensei-animator` (hand-made animation): writes the storyboard with reads and the style bible, builds key
  poses as stills, animates, runs the three-zoom review, renders through `sensei-film-renderer`, and reports the sheet,
  strip and crop paths with what was and was not verified. `sensei-reviewer` reads the sheets.
- Hooks: `lint-determinism.mjs` (PostToolUse: warns on wall clock, unseeded random, timers, CSS animation and playing
  media in any page with `window.seek`, `__seek` or `renderFrame`, which every example here exposes);
  `gate-claim.mjs` (Stop: on a `film` project, refuses "done" until an MP4 and a contact sheet newer than the last edit
  exist; `review.mjs` names its sheets `<page>-sheet-<id>.png`, which that check recognises); `guard-licence.mjs`
  (blocks ideas-only code such as onetake's); `guard-process.mjs` (refuses paid image or video generation without an
  approved plan, for example generated plates behind a painted scene); `lint-web.mjs` (reduced motion and offline
  rules for the page version).
