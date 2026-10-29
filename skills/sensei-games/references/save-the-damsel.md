# Save The Damsel: what it does and what it teaches

The owner's game, read from its code (the `dm*` section of Ultra Bookworm's `app/app.js` in the owner's Ultra Bookworm project (not shipped), its rules in
`app/styles.css` in the owner's Ultra Bookworm project (not shipped)) and its field notes (the build project's field log (SENSEI-LOG, not shipped)). Nothing of its art, questions or wording is copied
into this plugin; `examples/strike.html` re-teaches the patterns with plain shapes and its own content.

## 1. What it is

An extracurricular game inside an English vocabulary course, kept apart from the course on purpose: it reads nothing
from the lessons and writes nothing to progress; the only thing it stores is the player's mute choice. Three screens
on the course's ordinary hash router (a landing and two trials). Each trial is twenty four-option questions of four
kinds (gap, definition, synonyms, odd one out) and one picture under a 2 x 4 grid of iron plates. A wrong answer
throws a weapon (a spear in one trial, an arrow in the other) and breaks the next plate in a **fixed order** that
starts at the edges and spends the last plate on the focal point. Eight wounds and she falls; seven or fewer after
twenty and she lives, which plays a gilded reveal and a three.js hologram of her. Around it: a live fullscreen shader
background, a heartbeat that quickens with each wound, synthesised sound in a stone-hall reverb, a lesson film slot.

The bank's rules (from the code's comments): four options every time, the key never the unique longest option, key
positions balanced five per letter in each trial, no question or key shared between the trials.

## 2. The patterns, and what each teaches

| Pattern (function in the code) | What it does | Lesson | In this skill |
|---|---|---|---|
| A run object (`dmRuns[mode]`, `dmLater`, `dmClear`) | each trial's state and its timers live on one object; leaving the screen or restarting clears them; every late callback first checks `dmRuns[mode] === run` and the current screen | a callback from an old run must never act on a new one | `strike.html` (`later`, `clear`, `run !== current`); tested: restart mid-flight opens nothing |
| The weapon on its own clock (`dmMissile`) | keyframes built from the impact time, split at the impact into two WAAPI animations; the flight's `finished` breaks the plate, then the recoil plays; a timer is only the backstop | a timer counted from `ready` is script time against the animation's clock: slowed playback broke the tile before the weapon arrived (its QC finding DM-15) | `strike.html`; tested at half speed, and the backstop with a frozen flight |
| A hinged plate (`.dm-tile`, `.dm-win`, `.dm-shutter`) | perspective on the plate's own parent, which does not clip; the picture slice clips in an inner window; the breaking cell rises above its neighbours; the outer frame clips the whole; easing per segment in the keyframe | `perspective` on a grandparent does nothing for a grandchild, and `overflow: hidden` on the cell flattens and cuts the fall (QC DM-14) | `strike.html`; tested structurally (perspective, overflow) |
| Steps gated on animations (`dmAfterAnim`, `dmAfterTransition`) | run once on the named `animationend` or `transitionend` of that element, or on a run timer | a hidden tab gives no frames, so no events: the eighth wound landed late on the backstop in a hidden pane; pick the last element that really animates (hidden plates fire nothing) | `strike.html` `afterAnim`; tested |
| A climax chained on events (`dmTriumph`) | stamp on the last plate's `animationend`, hologram on the light pass's `done`, each with a backstop; three.js compiled while the player reads the last explanation | beats started together on timers overlapped (QC DM-11); build the heavy part while it is certain and unseen | described; the hologram belongs to `sensei-holograms` |
| A spring without a library (`dmSpring`) | integrates a damped spring at 60 Hz into linear keyframes for WAAPI | a short spring beats a dependency | `sensei-motion-ui` (`spring-linear.js`) |
| Individual transform properties | hover lift on `translate`, press on `scale`, tilt on `rotate` | `transform` in one state replaces another state's | `strike.html` options; `sensei-motion-ui` 3.3 |
| The heartbeat (`dmBeat`) | a 25 ms scheduler books each beat 100 ms ahead on `AudioContext.currentTime` and restarts a WAAPI pulse at the same moment; falls back to `performance.now` when audio is missing or suspended; stops when hidden; tempo rises with wounds | a CSS custom property driving an infinite animation's duration rescales its progress, so the pulse jumps phase at every tempo change; measured picture to sound 1 to 18 ms | `sensei-audio` and `sensei-motion-ui` (`examples/heartbeat.html`) |
| Sound (`dmSound`) | oscillators and filtered noise through a compressor, a convolver fed a decaying noise burst as the hall; mute persisted; unlocked on the first click or key; a `clock()` for scheduling | synthesised effects cost no asset bytes | `sensei-audio` |
| Calm (`calm()`) and reduced motion | `calm()` is the system's reduced motion OR the learner's own Calm switch, and stills the background (one frame, redrawn on input) and the heartbeat pulse; the system setting alone also makes the missile land without a flight and skips bursts and springs | offer both, and check each effect against the right one | `strike.html` reduced-motion path; tested |
| Keyboard (`damselInit`) | 1 to 4 or A to D answer, Enter or Right moves on, ignored with modifiers; the Next button handles its own Enter; options disabled with `aria-disabled` so focus stays | a global shortcut must not steal keys from controls | `strike.html` |
| The end dialog (`dmEnd`) | a labelled modal with the tally, the missed words with the key in bold, and the actions; focus moves to its first button; a live region speaks the verdict | | `strike.html` (simplified) |
| Live background (`dmBg`) | one fragment shader, every uniform eased in JS with `1 - pow(k, dt)`; context loss handled; reduced motion draws one still frame on input | `wind * t` in a shader jumps when wind changes: integrate in JS | `sensei-shaders-vfx` |

## 3. What it does not need, and what it still lacks

It needs no engine: a quiz game is DOM, CSS and WAAPI (research lane). It has no shared hidden-tab pause signal (the
beat, background and hologram each listen to `visibilitychange`) and no versioned save; neither matters while the only
saved value is mute, but a longer game should take `GameCore.Save` and one pause signal. If it ever grows arcade
segments, start from `GameCore` and reach for Kaplay or Phaser only when sprites and physics arrive.
