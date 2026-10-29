# Sound in a room, materials, levels, spatial audio

## 1. Why a room

The ideas come from the onetake film skill's sound notes (PolyForm Noncommercial: ideas only, none of its code is
used; `scripts/sensei-room.js` is this project's own):

* Raw sines read as chiptune. Real objects have **inharmonic partials plus a short noise transient**.
* One sound per event is a slot machine: use **fewer sound events than visual beats**, and let rests be silent.
* Every sound shares **one room**: about 1.1 s T60, 12 ms pre-delay, send 15 to 70 per cent by distance. Sounds in
  different rooms do not belong to one world.
* Palette peaks at about **-8 dBFS**; a mastered score at -16 LUFS with true peak -3.5 to -4 dBTP keeps AAC under
  -3 dBFS.
* Drive sound from **continuous curves** (camera air from the zoom rate, brush rasp from speed times pressure)
  rather than one-shots.
* Find **mud** per half-second window (a 41.6 per cent low-mid share came from marimba tails at F3; the fix was F4
  and above with short tails); keep music from burying effects (a rejected cut had effects 17 to 23 dB under music).

## 2. `sensei-room.js`

```js
const room = SenseiRoom.create(ctx, { t60: 1.1, predelay: 0.012, ceilingDb: -8, wetTrim: 1, seed: 7, destination: master });
room.glass(t, { dist: 0.3 }); room.wood(t, { dist: 0.6 }); room.sub(t); room.air(t, { dur: 0.5, from: 400, to: 2400 });
room.airFromCurve(t, speeds /* 0..1, evenly over dur */, dur, { dist: 0.2 });
const input = room.bus(0.5); mySource.connect(input);      // any source, sent to the room by distance
```

* The impulse is seeded noise with an exponential decay (-60 dB at T60, measured -60.2 dB) through a one-pole
  low-pass that closes as it decays, level-corrected, scaled to unit energy, used with `normalize = false`.
* Distance 0: dry 1, send 0.15. Distance 1: dry 0.45, send 0.70.
* Materials: partial ratios and decays are this project's choices (glass 1, 2.32, 4.25, 6.63; wood 1, 2.57, 4.1),
  levels normalised so the sum stays at the ceiling. Measured peaks: glass 0.300 near and 0.150 far, wood 0.228 and
  0.103, sub 0.345 and 0.170, air 0.096 and 0.044, all under -8 dBFS (0.398).
* No `DynamicsCompressorNode` as a limiter: it adds automatic make-up gain (a 0.1 sine came out at 0.246 through
  threshold -30, ratio 20; measured), so it lifts quiet sounds instead of only catching peaks. The ceiling is kept by
  level design. (The engine's master compressor in `sensei-sfx.js` is there to soften stacking, not to limit.)
* `normalize = true` on a convolver applies the browser's own calibration; with this impulse it left the room almost
  inaudible (measured). Unit energy plus `wetTrim` makes the level a decision you can read.
* Not verified: how any of it sounds. Tune `t60`, the sends and `wetTrim` by ear on real speakers and headphones.

## 3. Levels and loudness

* Interface sounds sit well under speech and music; the engine's master volume is 0.8 by default.
* Recorded samples: loudness-match before inlining (`ffmpeg -af loudnorm=I=-16:TP=-1.5`, or measure and normalise
  with `sensei-video-pipeline`'s `scripts/audio.mjs`).
* A film mix (narration, music bed, effects, ducking, -14 or -16 LUFS, -1.5 dBTP): `sensei-video-pipeline`.
  Field numbers from the Save The Damsel films: voice about -17 dB RMS while speaking, music bed about 21 dB under it
  and about 8 dB up in the gaps; a first pass with the bed 26 dB under was inaudible. Measure stems; do not guess.

## 4. Spatial audio

* 2D interfaces: `StereoPannerNode`, pan from the element's horizontal position (`play(name, { pan })`). Pan -1 is
  left only (measured).
* 3D scenes: `PannerNode` with `panningModel = 'HRTF'`; move it through `positionX`, `positionY`, `positionZ`
  AudioParams (not the deprecated `setPosition`). Measured offline: x = -5 gave left and right energy 833 and 280,
  x = +5 gave 281 and 835; the `inverse` distance model gave peaks 0.707, 0.354 and 0.088 at 1, 2 and 8 units.
* Headphones are needed to judge HRTF by ear: only the energy balance was verified.
