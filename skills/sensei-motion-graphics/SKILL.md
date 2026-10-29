---
name: sensei-motion-graphics
description: "Motion-graphics craft for films, stings, promos, explainers, lesson intro films and kinetic-type pieces built in HTML: twelve measured eases and duration tables, entry and exit grammar, smear, transitions and carries between beats, camera, rhythm, film direction (treatment, storyboard, reads, reading time) and the G0 to G5 film gates. Use when someone says motion graphic, promo, launch video, sting, title sequence, explainer clip, kinetic type film, make it look professional, it looks like a slideshow, it feels AI-made, or asks to storyboard, critique or fix a film. Rendering to MP4 belongs to sensei-video-pipeline; hand-drawn character animation to sensei-handmade-animation."
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-motion-graphics

The look and the joints of a film: how things move, how beats hand off, how long text stays, and how to prove a
film is not a slideshow. Rendering, audio muxing and HyperFrames belong to `sensei-video-pipeline`.

## 1. When to use

Use for any piece that plays as a film, even inside a page: brand stings, product promos, lesson intro films,
narrated explainers, kinetic-type pieces, title cards, cut-scenes, and for reviewing an existing film ("rate it",
"why does it feel like PowerPoint").

Another skill owns it instead:

| Request | Skill |
|---|---|
| Render a seek page to MP4, motion blur, chunked render, audio mux, captions track, HyperFrames hand-off | `sensei-video-pipeline` |
| Hand-drawn, painted, boiling-line or character animation; sheet/strip/crop review | `sensei-handmade-animation` |
| UI motion in an interactive page (hover, entrances, springs, reduced-motion gate) | `sensei-motion-ui` |
| Scroll-driven storytelling (the scroll position is the clock) | `sensei-scroll` |
| Splitting, scramble, font embedding, Persian and RTL type | `sensei-typography` |
| Score, SFX, loudness, sound from the picture's plan | `sensei-audio` |
| Lottie, Rive, hero video in a page | `sensei-lottie-rive-video` |
| Visual style choice before motion | `sensei-direction` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Clock | smooth (every frame) or twos (poses held 2 frames) | UI, type and camera read best smooth; stop-motion, collage and cel looks on twos. Never put a shutter on a twos film |
| Frame rate | 24, 30, 60 | 24 for a film or painted look; 30 for UI-heavy motion (the ease tables are at 30); 60 for fast UI and type, doubling every frame count |
| Blur grammar | smear, crisp steps, shutter | one per film: smear for consumer and premium, crisp for technical and flat vector, shutter for a smooth film rendered with sub-frames |
| Engine in the page | hand-written f(t) with `motion-kit.js`; one paused GSAP timeline; canvas or WebGL drawn from t | DOM and SVG pieces: hand-written or GSAP; many particles or painted looks: canvas; a 3D hero: three.js state as a pure function of t |
| Transition at each boundary | T1 to T20, or a carry | what changes between A and B (`references/transitions-and-continuity.md`); the transition is made of the film's own shapes |
| Overshoot budget | none, one spring, a few popOvers | technical films none; consumer films one visible spring on the payoff; popOver at most once per beat |
| Text on screen | words in the picture, captions, none | reading time decides the hold; lessons need captions; music videos may be text-light |
| Renderer route | our CDP renderer, HyperFrames, Remotion | `sensei-video-pipeline` decides; this skill writes a page any of them can seek |

For static art that must move, layered image compositing, material-specific animation, travelling worlds or an optional Framefields film hand-off, read [references/art-to-motion-workflows.md](references/art-to-motion-workflows.md). It separates browser delivery from external rendering and records the source and verification limits.

## 3. Core technique

### 3.1 Every value is a pure function of t

A film page exposes `window.__seek(t)` (and `seek`), `window.__meta = {dur, fps, w, h}`, `window.__ready` (a
promise) and `window.READY`. `seek(t)` writes every style from t alone: no wall clock, no `Math.random` (use
`SenseiMotion.rng(seed)` or `rand(key, i)`), no timers, no CSS animations or transitions, no state carried from the
previous frame (no `x += v`). Measure text once after `document.fonts.ready`, never inside seek. Keep the live
preview and the reduced-motion path in a player page (`sensei-video-pipeline/examples/player.html`), so the film
itself has no clock at all. The plugin's `lint-determinism` hook warns when a seek page breaks this.

```js
const K = window.SenseiMotion, E = K.EASE, f = n => n / 30;      // motion-kit.js, frames to seconds
function seek(t) {
  P.wordOn.forEach((on, i) => {                                   // on: uneven gaps 4, 3, 6 frames
    const land = E.softLand(K.seg(t, on, on + f(12)));             // landing decelerates
    const leave = E.accelExit(K.seg(t, P.carry, P.carry + f(13))); // leaving accelerates
    words[i].style.transform = `translateY(${(1 - land) * 54 - leave * 76}px)`;
    words[i].style.opacity = t < on ? 0 : K.lerp(0.2, 1, K.seg(t, on, on + f(5)));   // opacity only as a helper
    words[i].style.filter = smearFilter(i, 0, K.smear(Math.floor((t - on) * 30), 14)); // smear halves each frame
  });
  world.style.transform = `scale(${K.zoomAt(1, 1.035, K.seg(t, 0, P.carry))})`;      // creep: no dead frame
}
window.__meta = { dur: 8, fps: 30, w: 1920, h: 1080 };
window.__seek = window.seek = seek;
window.__ready = document.fonts.ready.then(() => { measure(); seek(0); window.READY = true; return true; });
```

With GSAP, build ONE timeline `{ paused: true }` from `tl.fromTo(..., { immediateRender: false })` with explicit
start values, never relative `+=` values, and call `tl.time(t)` inside seek; set each element's initial state with
`tl.set` at its scene start. Two tweens must never drive the same property of the same element at once (put one on
a parent).

### 3.2 Move like the measured films

The defaults (full tables in `references/eases-and-durations.md`): words land with `softLand` over 12 f from 0.03
to 0.07 H below; heroes enter with `snapSettle`; exits accelerate (`accelExit` 13 f); fades are 4 to 6 f helpers
under a move; siblings stagger 1 to 3 f apart unevenly with overlapping tails; one late `popOver` per beat at most;
anything held over 3 f keeps one living thing; clips end still moving; the resolved end hold is 0.6 to 1.4 s.

### 3.3 Design the joints

Author every cut as a pair (A's last 6 frames and B's first 6 together). Name what carries across each boundary:
the full stop that grows into the next ground, the caret, the card, the ground colour. No crossfades between
scenes. Pick the transition by what changes (`references/transitions-and-continuity.md`) and build it from shapes
the film already owns. Vary shot lengths (cv at least 0.25), place designed rests, cut every 0.3 to 2.3 s inside a
beat and let the last scene linger.

### 3.4 Direct before building

Three ideas, a treatment, then a storyboard with buys, reads, carries and the reading-time check; narration first
when there is a voice; the hardest 2 to 4 seconds first; look at stills, strips and the sheet; fix in order (true,
idea, joints, hierarchy, timing, surface, sound); deliver `NOTE.md` with the gate numbers. Full protocol and the
production brief: `references/film-direction.md`; template: `references/storyboard-template.md`.

### 3.5 Gate it

`storyboard-check.mjs` before building; the determinism check after building; `film-gates.mjs` on the draft MP4
(G0, G2, G3) and on the page (G5); G1 and G4 by eye, written as such. Definitions and blind spots:
`references/gates.md`.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Ease and clock toolkit (12 measured eases, kf with hard steps, seeded rng, log zoom, shake, hand, smear, cv, reading time) | `scripts/motion-kit.js`, self-test `scripts/test-motion-kit.mjs` | verified, Node 24 |
| A complete 8 s sting: uneven word rise with smear and accent tint, breath with camera creep, carried full stop grows into the next ground (T3), whip entry with smear, one-frame punch with tail and decaying shake, blur-focus words, one popOver, ending mid-motion; sound cues in `__events` | `examples/sting.html` | verified, Chrome headless |
| Its storyboard, passing the gate | `examples/sting.storyboard.json` | verified |
| Storyboard gate (rhythm, rest, carries, buys, reading time, frame 0, end hold) | `scripts/storyboard-check.mjs` | verified on pass and fail fixtures |
| Film gates G0, G2, G3 on an MP4 and G5 on a page | `scripts/film-gates.mjs` | verified on the sting draft and on bad fixtures |
| End-to-end test of everything above, writing stills, a contact sheet and a draft MP4 | `scripts/test-examples.mjs [outDir]` | verified |

Render the sting properly with `sensei-video-pipeline/scripts/render.mjs`; the test's draft encoder is only a probe.

## 5. Quality bars

- Storyboard gate passes: beat-length cv at least 0.25; every boundary carries or is marked burst or end card;
  every text on screen for at least `characters / 15 + 1.5 s` (Latin script).
- Frame 0 is part of the film (no empty opening frames); G2 passes (no run of more than 3 flat frames).
- G3: end hold at most 1.4 s; final shot at most 25% of the film when cuts exist.
- G5 passes on films (never applied to lesson UI, dashboards or game HUDs).
- Same frame in and out of order at every hand-off (screenshot hash), at least 5 frames straddling each boundary.
- One blur grammar, one overshoot budget, one system of type per film.
- Flashing at most 3 per second (glitch, strobe, double exposure transitions).
- Captions as a track and as `.srt` for any film with words spoken; the story works muted.
- `NOTE.md` quotes script numbers; nothing is certified by the author.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | The first frames of the film are empty | every element enters after frame 0 | open mid-action: the first onset is negative so frame 0 already shows the move | tested: G2 flagged 6 flat opening frames on our own sting; also claude-animation-skill traps |
| 2 | A headline fails the reading gate in a short sting | a 22-character line needs 2.97 s; the first cut held it about 1.9 s | lengthen the beat or cut the copy; check with `storyboard-check.mjs` before building | tested on our sting (it grew from 5 s to 8 s) |
| 3 | Elements animated twice jump to their later from-state at load | GSAP `fromTo` defaults to `immediateRender: true` | `immediateRender: false` on every later tween plus an explicit `tl.set` at the scene start | reported, Save The Damsel films |
| 4 | Words meant to orbit all sit at the front | GSAP composes translate before rotate | an arm parent takes `rotationY`, the child takes `z` | reported, Save The Damsel films |
| 5 | A payoff never reads | a darkness layer sat above the glowing word | engraved word under the dark layer, a separate glowing copy and all text above it | reported, Save The Damsel films |
| 6 | Two tweens fight; the value flickers or snaps | two animations on one property of one element | one on a parent, or one tween with keyframes | reported, motionmaxxing and GSAP research |
| 7 | Edges look double-blurred | shutter blur combined with per-element smear, or a shutter on a twos film | one blur grammar per film | reported, motionmaxxing |
| 8 | Dark gradients band after encoding | yuv420p quantisation | fixed seeded noise at alpha about 7/255 over the frame (static); animated grain goes in ffmpeg, not the page, or frames stop compressing | reported, onetake and lemo-opuscar; static grain used in our sting |
| 9 | The frame turns black during a big move | a blur filter on an element translated far off-screen | `display: none` once it has left | reported, onetake |
| 10 | Shadows shrink as the camera pulls out | canvas `shadowBlur` and filter blur are in device pixels | multiply by device pixel ratio times zoom | reported, onetake |
| 11 | Scaled text renders blurry, 3D faces flatten, text overlaps during a morph | `will-change` on camera-scaled elements; `opacity` or `filter` on a `preserve-3d` element; text swapped inside a morphing container | no `will-change` there; fade a wrapper; text enters after the morph starts and leaves before the next | reported, awesome-ai-motion prompts |
| 12 | A whip plays as a hard cut | the whip starts in the next segment | start the whip in A, cut at peak speed | reported, lemo-opuscar style pitfalls |
| 13 | Sound blips break a designed silence | UI sounds fired inside a rest | no cue inside silences; fewer events than beats | reported, lemo-opuscar, onetake |
| 14 | A lesson UI fails the film lint | G5 and the never-ship list applied to interactive chrome | apply G5 to films only | reported, motionmaxxing research scope note |
| 15 | Viewers report discomfort | strobe, glitch or one-frame double exposure too often | at most 3 flashes per second; reduced-motion path in the page version | reported, motionmaxxing, lemo-opuscar |
| 16 | Layout differs between machines or offline renders | remote or system fonts; fallback metrics move every letter | embed fonts as data URIs, measure after `document.fonts.ready` | reported, PDoomVideo, Austerlitz research; our example uses the Georgia stack and says so |
| 17 | Ambient words print over each other | random speeds make fast words overtake slow ones | one speed for every word, place each only where it never meets another over a full cycle | reported, design-fix agent |
| 18 | A continuity score of 1.00 means nothing | the checker saw no boundaries, or a carry made of two elements | a pass over fewer boundaries than the beat sheet is not evidence | reported, onetake probe limits |
| 19 | The measured end hold is shorter than the real one | x264 keeps refining a frozen picture | treat G3's number as a lower bound | tested: a 4 s freeze measured 2.67 s (still failed) |
| 20 | `lint-determinism` warns on GSAP in a seek page | it flags any `gsap.to/from/fromTo` call and unpaused timelines | build with `tl.fromTo` on one `{ paused: true }` timeline | read from the hook source |
| 21 | Taste rules applied to the wrong film | the numbers come from 3 to 7 s SaaS clips; "motion on 99% of frames" is not a whole-film target | use them for stings and promos; long films breathe more | reported, motionmaxxing KNOWN-LIMITS |
| 22 | Halftone or collage CSS looks wrong | the snippets in the research were never executed | build, screenshot and compare before relying on them | reported (unverified recipe) |

## 7. Licences

- **May ship and use**: `motion-kit.js` (ease maths copied from motionmaxxing under Apache-2.0; the notice and the
  modification statement stay in the header; the plugin's `LICENSES/` carries the Apache-2.0 text and motionmaxxing's
  `NOTICE` verbatim, indexed in `LICENSES/README.md`; a project that inlines `motion-kit.js` keeps its header and adds a
  ledger row); the rest of our
  scripts and examples (original).
- **Ideas only, never code**: onetake (PolyForm Noncommercial; its `OM.*` move library, scripts and looks may not be
  copied anywhere, and `guard-licence` blocks its markers); Battle-of-Austerlitz-Film and PDoomVideo (no licence).
- **Text only**: the awesome-opus corpora (their writing is CC BY 4.0 or MIT; prompts, stills and media belong to
  their creators; summarise, never paste).
- **In projects, with notices**: GSAP (Standard No Charge licence: free commercially, keep the header, pin the
  version; old 3.12.x files carry the old wording), lemo-opuscar engines (MIT, keep the notice), fonts (OFL).
- Never carry third-party marks or characters (lemo-opuscar's fan films, Anthropic's mascot in the animation repos).
- Generated imagery and music: record service, model, cost and licence in `.sensei/licences.json`.

## 8. Verification

Prove a film with: `storyboard-check.mjs`; the in-order and out-of-order hash check; stills and a contact sheet that
a person or model actually looked at (one sentence per frame); `film-gates.mjs` on the draft and on the page; the
loudness numbers from `sensei-video-pipeline`; G1 and G4 stated as judged by eye.

Verified here (Windows 10, Node 24, system Chrome 155 headless with SwiftShader flags, Playwright 1.63, ffmpeg 7.1):
every script and the sting example via `test-examples.mjs` (8 of 8 frames identical in and out of order; draft MP4
of 240 frames at 960x540 in about 17 s; G0, G2, G3 and G5 pass on the sting; the gates fail a frozen end, a blank
stretch and a page with chrome); the contact sheet was looked at.

Not verified: Safari and Firefox; the sting's layout on a machine without Georgia; G5 on canvas or WebGL text;
storyboards in Persian (no reading-time formula in the research); audio for the sting (cues only); any taste claim.

## 9. Carried by

- Agent: `sensei-motion-director` (motion-graphics craft and continuity) writes the treatment and storyboard, builds
  the hardest beat first, runs the gates and writes `NOTE.md`; `sensei-film-renderer` renders; `sensei-reviewer`
  judges with its slop lens; `sensei-sound-designer` scores from the same plan.
- Hooks: `lint-determinism.mjs` (PostToolUse, warns on wall clock, unseeded random, timers, CSS animation and
  transitions, free-running GSAP and playing media in any page with `window.seek`, `__seek` or `renderFrame`);
  `gate-claim.mjs` (Stop: on a project whose profile says `film`, refuses a "done" claim until an MP4 and a contact
  sheet newer than the last edit exist); `guard-process.mjs` (PreToolUse: refuses paid generation such as
  ElevenLabs, fal, OpenAI image or speech, Google generative APIs, Replicate, Stability, Runway, Luma, Ideogram until
  an approved plan hash matches); `guard-licence.mjs` (blocks onetake markers and no-licence code);
  `lint-web.mjs` (reduced motion and offline rules for the page version).
