# Film direction: from brief to accepted film

Sources: lemo-opuscar `AGENTS.md`, `DIRECTOR.md`, `TECHNIQUE.md` (MIT); motionmaxxing `SKILL.md` protocol and laws
(Apache-2.0); ClaudeAnimationBase `ANIMATION_GUIDE.md` (MIT); PDoomVideo's guide and storyboard (no licence: method
only); the awesome-opus video corpora (CC BY 4.0 and MIT for their own writing; summarised, nothing quoted at length);
gbro-collage-broll (MIT); makevoid music-video plugin (MIT); the Save The Damsel films (SENSEI-LOG). All rewritten
in our own words.

## 1. The protocol

1. **Toolbox check** (`sensei-video-pipeline` preflight): Chrome, ffmpeg, disk, GPU or SwiftShader, estimate.
2. **Know the subject.** Brand, product, lesson: real colours, real copy, real UI. Never invent a statistic.
3. **One true thing.** Problem, audience, goal, emotion in four lines. One subject, one goal, one turn.
4. **Three ideas of different kinds** (one element transforms through everything; one camera move through scale;
   before and after; a chain reaction; a physical metaphor; one continuous surface; a typographic system). Each is
   one sentence about the picture, not the story. The user picks; the template's own story is never the default.
   Cover-the-logo test: if the idea fits any brand, it is not an idea yet.
5. **Treatment before build** (lemo-opuscar): logline, three candidate structures, a benchmark (what to learn and
   what not), the shot list with reasons, a second-by-second beat sheet, the cue map, the sound table, the subtitle
   design. Compare against any demo you studied: at least four of structure, opening, signature shot, camera path,
   score shape and ending must differ.
6. **Storyboard** (`storyboard-template.md`) with, per beat: role, what it buys, copy, what moves, what is still,
   the hand-off and the carried object, the reads, frames, and the picture with the text covered. Run
   `storyboard-check.mjs`.
7. **Narration first** when there is a voice: generate every line for the whole film in one sitting, measure each,
   then time the picture against the measured beats (pre, gap, tail). Never time the voice to the picture.
8. **Hardest beat first**: build and render the hardest 2 to 4 seconds, inspect 12 to 24 neighbouring frames.
9. **Look honestly, then fix**: contact sheet, strips around every fast move, crops of faces and text. Describe
   every sheet frame in one sentence before judging. Fix in this order: broken or untrue; the idea; connections
   between beats; hierarchy and scale; timing; surface; sound polish. Two or three honest passes.
10. **Sound to picture**, from the same plan numbers (`sensei-audio`).
11. **Deliver** the MP4, the editable source, and `NOTE.md`: the idea and why, each beat and what it buys, what is
    real and what is illustrative, the gate numbers quoted from the scripts, the one-sentence frame descriptions,
    what you would still improve. Describe what you checked; never certify the film as good.

## 2. Laws (the ones that change outcomes)

Every beat buys one belief; show, then say; shots hand off; cut on motion; land decelerates and leave accelerates;
almost nothing fades; arrival decelerates from oversize; no dead frame; one system per film; one focal point; words
move at speech rhythm; the demo is physical (a cursor parks before it acts, a press squashes 2 to 3 frames, the
target answers a frame later); emphasis is spent, not spread; ambition goes on the hero moment.

From lemo-opuscar: judge in the order sound, rhythm, camera, directing. Hook in 3 s; an ending that echoes the
opening; one native move at the emotional peak; at least four different camera moves and one signature shot; every
action has a sound, three layers (ambience, foley, music), at least two real silences and two J or L cuts.

From ClaudeAnimationBase: model the viewer with **reads**: list what the viewer must understand in each shot, in
order; give each read time to be found, understood and registered; one read at a time; fast actions, slow meanings;
lead the eye before the important read; let the reads set the shot length. (Its demo first packed seven events into
1.3 s and nobody could tell what happened.) Something happens in every scene; transitions at every seam; one world,
a colour arc, a recurring motif that pays off, an ending that rhymes with the opening.

## 3. Production brief and acceptance stages

Before any build, fill a brief (structure after athemeroy's production brief, CC BY 4.0, rewritten): goal and
delivery (size, duration, fps, aspect ratios, captions), inputs and their rights (fonts, music, footage, logos, VO),
who does what, shots and visible states, factual claims with sources, cost and disclosure (models, services, asset
libraries, human decisions).

Three acceptance stages:
1. **Brief and keyframes** approved before the full build: purpose, takeaway, frame size, duration, fps, shot and
   state changes, fixed text and brand, asset provenance; a storyboard and a keyframe sheet.
2. **Hardest 2 to 4 seconds**: 12 to 24 neighbouring frames, occlusion, contacts, speed, loop seams, caption bounds;
   re-render a frame after seeking in different orders.
3. **Full sequence and reproducible hand-off**: watch and listen to the whole film; MP4, editable project, render
   command, asset and service list, remaining unverified claims. Nine-frame tiles are a screening aid, not acceptance.

Pick the path before the prompt: product UI and type motion in HTML or SVG with a seek clock; explainers with
facts, units and pronunciation checked; abstract loops with fixed seeds and loop-seam checks; interactive 3D with a
measured frame rate; character shorts with rigs and style sheets (`sensei-handmade-animation`); generated footage
only behind a paid-generation approval.

## 4. Writing a motion brief for an agent (or yourself)

The strong prompts in the corpora share six parts: **inputs** (what the human must supply), **direction** (the
look in two sentences, fonts, palette, a banned list), **structure** (BPM or narration, what happens at each bar or
beat), **build** (numbered engineering constraints including determinism and the render method), **gotchas**, and
**start** ("ask me for the inputs, then show me a storyboard before writing code"). A destination plus a quality
bar plus an anti-pattern plus a freedom clause beats a step list for a capable agent, but only with a required
verification loop.

Banned vocabulary seen across the corpora (use as a review list, not as law): scene crossfades, blur-ins as
default, 3D card flips, particle bursts, glows and shockwave rings, RGB split everywhere, camera shake everywhere,
lens flares, neon grid floors, bouncy easing on everything, holds over 1 s with nothing alive, template looks, stock
footage, fake dashboards, tiny unreadable code, spinning logos, corner labels, heading over three cards, full stops
in on-screen fragments. Positive inverses: each hand-off starts on the exact last frame of the scene before; motion
connects to an element already on screen; scenes grow from the last; every transition demonstrates something
instead of replacing a title card; the story works muted.

Accessibility is close to absent from this genre (one mention of reduced motion in 703 prompts): our films ship
captions (a track and an `.srt`), a transcript where there is narration, and the page version's reduced-motion path.

## 5. Team builds (one agent per chapter)

From PDoomVideo's guide (method only): one file per chapter wrapped in its own scope; a chapter agent edits only its
own file and reports bugs in shared files instead of fixing them; a shot is a pure function `fn(t, localT, dur)` that
paints the whole frame; shared surfaces (subtitle band, wipes, meters) are drawn by the timeline, with a safe area;
a stated per-frame budget; each agent returns a contact sheet and its ms per frame.

From the HyperFrames podcast pipeline in the corpus: write the shared style bible and component kit first so every
piece looks like the same show; build at medium effort; judge each piece once at high effort and send back only the
egregious ones (no blanket redo loops). From the makevoid plugin: dispatch in waves (2, then 3 to 4, then more), each
reviewed before the next, each worker owning a distinct range and a persistent log.

## 6. Paid generation inside a film

Generated plates, AI B-roll, TTS and music cost money and cannot be reproduced exactly. Use the three-gate protocol
(gbro): gate 1 the metaphor in text only (no image or video call), gate 2 a still for approval, gate 3 the video.
Partial approval advances only the approved items. The plan goes in `.sensei/plan.md`; the user's yes is recorded
with `lib/approval.mjs`; `guard-process` refuses ElevenLabs, fal, OpenAI image or speech, Google generative,
Replicate, Stability, Runway, Luma and Ideogram calls until the plan hash matches. A changed plan needs a new yes.

## 7. The halftone paper collage look in HTML (gbro, rebuilt natively)

A flat even colour field (colour by meaning, one language per batch); black and white halftone photo cut-outs and
coloured card pieces with crisp edges, a warm cream keyline, a low soft shadow, visible dots and paper fibre;
assembly from empty in stop-motion steps (structure, subject, connectors, action, result), not drift or zoom; 3 to
6 large pieces; no text, logos or UI in the frame. HTML route: paper fibre from an SVG `feTurbulence` multiplied
over the ground, halftone as a dot `radial-gradient` multiplied over a greyscale image under a high-contrast
wrapper, keylines from `outline` and `drop-shadow`, poses held two frames at 24 fps (`clock: twos`). The CSS
snippets in the research were not executed; build and screenshot them before relying on them. The last frame is
also the reduced-motion still.
