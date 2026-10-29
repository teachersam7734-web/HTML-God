# Timing and acting numbers

From claude-animation-skill `references/motion.md` (MIT), ClaudeAnimationBase (MIT), PDoomVideo (method only) and the
Save The Damsel films; rewritten. Treat them as starting values to judge on a strip, not laws.

## Timing table

| What | Number |
|---|---|
| Shot length | 0.8 to 2.7 s for most shots; let the reads set it |
| A pop or state change | changes in 1 to 2 frames, then holds (snap then hold) |
| Overshoot | back ease about 1.8 to 2.2 over 0.3 to 0.4 s (`ease.back(k, s)`; s 1.9 peaks at about 1.12, tested) |
| Zoom-out transition | about 0.55 s with a slight roll |
| Stagger within a group | 0.05 to 0.14 s |
| Blink | about every 3.3 s |
| Breathing | about 2% scale |
| Anticipation | about 1.22x (the opposite deformation) for about 2 frames before a fast action; a crouch before a jump |
| Landing squash | 1.35 to 1 over about 0.18 s |
| Hit-stop | 0.083 s (0.125 for a big hit, 0.3 for a finisher), with sparks still moving in real time |
| Game-feel camera | world zoom about 1.3 |
| A hit | five things on one frame: a flash capped near 0.6, sparks, a ring, a comic word or number, a shake; plus a thump and crack pair in sound |
| Sound cue | about 0.03 s before the visual contact; draw-ons are silent, contacts make sound |

## Exposure: ones, twos, holds

- Drawings on twos (each pose held 2 frames at 24 fps) read as hand animation; the camera stays on ones (smooth), as do
  light and camera-driven parallax (lemo-opuscar TECHNIQUE, claude-animation-skill).
- Switch to ones for a fast action and back (`exposure(t, [{ at, on }])`).
- Boil is a decision, not a default: a 12 Hz boil reads as hand-drawn at 24 fps; at 60 fps it reads as flicker unless
  each value is held for about 5 frames (PDoomVideo trap). Big calm backgrounds can boil slower (6 Hz in `hop.html`).
- Never combine a shutter blur with a film on twos: it smears the held poses.

## Acting

- **Mood changes never snap** (PDoomVideo and ClaudeAnimationBase): eyes squeeze shut, the body does a take (a squash
  then an overshoot), an emote mark may pop, the new face opens. `mood(t, [[t, face], ...])` returns the squint, the take
  scale and which face to draw.
- **Blend poses, never switch them in an `if`** (lemo-opuscar DIRECTOR): interpolate between key poses so the change has
  in-betweens.
- **A look leads**: eyes move first, then the head, then the body.
- **Characters big**: a medium shot about a third of the frame height or more; close-ups fill it. (Our first `hop.html`
  sheet had Pip at about a sixth of the height and read as a wide shot; we scaled him up.)
- **Beat-locked motion** for music: helpers for beat position and a pulse that is 1 on each beat then decays; put hits
  on beats (PDoomVideo used 88 BPM, beats at `0.21 + n * 0.682 s`); idles on the beat.
- **Rig traps** (claude-animation-skill, reported): a per-call ground offset gives stilt legs (the rig origin is the
  ground point); two-bone IK picks crossing knees unless you pass the preferred knee; rotate about the contact point,
  not the waist; short polygons smooth into blobs unless marked sharp; shoulder order is abduction then flexion, and the
  overlapped part of an arm is not outlined (lemo-opuscar).
- **Physics as character** (papermotion): intents (speed, look, reach) drive springs and gaits; keyframes only shape an
  intent over time; beats are condition-triggered (`next` when near, `after` as a fallback), so a cut never shows the
  wrong moment.

## Reads in practice (Save The Damsel)

The Damsel films used a reads sheet per beat (each thing the viewer must understand with a start and an end, no two
important reads overlapping), word micro-acting after the word lands (about 30 of 40 words acted their meaning for
about 2 s: ephemeral dissolves and re-forms, moribund droops and dims, curtail is clipped short), and a recurring motif
that pays off (a 20-notch progress rail with the weapon advancing).
