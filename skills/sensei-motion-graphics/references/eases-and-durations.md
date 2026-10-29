# Eases, durations, entries, exits, smear

The numbers below are motionmaxxing's measurements (about 4,300 moves in 53 professional moments, frames at 30 fps),
read from its `references/motion.md` and `runtime/motion.js` on 2026-10-18 (Apache-2.0, Tejas Makwana). They are
summarised here in our own words; the ease maths is shipped in `../scripts/motion-kit.js` with its notice. At 60 fps
double every frame count. The sample is 3 to 7 second SaaS-style clips: treat the numbers as defaults for brand
films and stings, not as targets for a whole lesson film.

## The twelve eases

| Name | Shape (% of travel at 10 / 25 / 50 / 75% of time) | Median frames | Use it for |
|---|---|---|---|
| `cruise` | linear | 9 | fades, drift, camera creep, counters; every drift is linear |
| `glide` | 16 / 39 / 69 / 91 | 10 | medium lands, camera pushes, blur-in |
| `softInOut` | 4 / 17 / 50 / 83 | 9 | opacity, blur, ground and colour ramps |
| `softLand` | 30 / 59 / 85 / 95 | 12 | the workhorse landing: words rise, panels slide, scale-ins (85% are entries) |
| `gentleIn` | 1 / 6 / 24 / 55 | 9 | exits, fade-out and blur-out starts, a push running into a cut |
| `snapSettle` | 54 / 84 / 96 / 98 | 11 | the hero entry and CTA pieces; once per scene |
| `whip` | 23 / 52 / 83 / 97 | 7 to 8 for true whips | big fast moves, entry half of a whip |
| `accelExit` | 0 / 3 / 16 / 47 | 13 | the leaving curve: off-frame exits, scale exits, peak speed at the end |
| `crashOut` | 0 / 0 / 6 / 32 | 17 | camera pull-offs and exits that end in a hard cut at full speed |
| `popOver` | peak 1.08 at t 0.72 | 15 | the late small lean past the mark (88% of real overshoots look like this) |
| `crashIn` | peak 1.18 at t 0.27 | 10 | slams that touch the mark at once, pass it, relax |
| `bounceHard` | peak 1.48 at t 0.62 | 22 | the big overshoot; under 1.5% of moves |

Peaks and the snapSettle shape were re-measured by `test-motion-kit.mjs` (crashIn 1.180 at 0.269, popOver 1.077 at
0.721, bounceHard 1.475 at 0.62, snapSettle 54.4% in the first tenth).

GSAP takes any of these directly: `ease: SenseiMotion.EASE.softLand` (a function from 0..1 to 0..1).

## Duration by property (median frames, p25 to p75)

| Property | Median | p25 to p75 | Typical travel |
|---|---|---|---|
| translate x / y | 12 | 6 to 24 (x), 6 to 22 (y) | 61 px median |
| scale | 10 | 5 to 22 | delta 0.25 |
| rotation | 11 | 6 to 21 | 25 degrees |
| opacity | 6 | 4 to 12 | |
| blur | 7 | 4 to 10 | 5 px |
| size (width or height) | 8 | 4 to 16 | 56 px |

Entries and exits are close (translate entry 12, exit 13 to 14; opacity 6 and 7). CTA entries are fast (6 f) and
snap-heavy; CTA stagger gaps widen to about 8 f.

## The grammar

1. **Landing decelerates, leaving accelerates.** 58% of landings ease out; leaving moves split ease-in 37% and
   ease-out 35%, and scale and blur exits accelerate most. Do not make every exit ease-in.
2. **Things arrive by moving, not fading.** Transform entries outnumber opacity fades about six to one. Use opacity
   as a 4 to 6 f helper (0.12 to 0.3, then 1) under a move. A hard one-frame cut reads as a system event.
3. **Start oversized and come down** for identity objects: a sign-off logo from 3.5 to 3.75x, 39% of the drop in
   frame 1, 86% by frame 6, rest at about 0.67 s, then a linear creep.
4. **Stagger siblings 1 to 3 f apart, unevenly** (for example 3, 2, 2, 2, 2), each move about twice as long as the
   gap so tails overlap. Whole words run slower: 2 to 5 f, 8 to 12 f when led by a voice. A uniform timer delay reads
   as a loading list.
5. **Overshoot is rare, late and small.** About 9% of moves; peak after 35% of the duration. Spend `popOver` at most
   once per beat and one visible spring per film, on the payoff.
6. **No dead frame.** Anything held over 3 f keeps one living thing: a 1 to 3 px/f linear drift, a 0.5 to 1% scale
   creep, a caret, a sweep. A designed breath of 0.6 to 1.5 s before a payoff is wanted, with one living thing on it.
7. **End mid-motion.** The last frame of a clip is still moving (accelerating exit, still-shrinking lockup) so the
   cut inherits its speed. The resolved end hold is 0.6 to 1.4 s (gate G3).

## Entries in numbers

| Channel | Start | Decays over |
|---|---|---|
| Offset, words and lines | 0.03 to 0.07 H below the slot (hero first word 0.10 to 0.24 H) | 12 to 15 f, tail 0.4 to 0.6 s |
| Offset, cards and panels | from 0.6 H below, or 0.14 W beside; already mid-open on frame 0 | 62 to 72% in the first 4 f |
| Scale | oversize, or 0.46 to 0.75x of rest for identity objects | 8 to 30 f |
| Blur | 3 to 6 px for type, 8 to 12 px status words, 18 px logo | 4 to 8 f |
| Colour | accent tint settling to ink | about 6 f |
| Opacity | 0.12 to 0.3 to 1 | 4 to 6 f |

Exits: accelerate off-frame (ease-in 6 to 10 f, the object stays sharp); shrink into the centre before a hard cut;
a clip edge sweeping through the glyphs in 5 f; words out one frame apart; a single-object fade only (linear 10 f),
never between scenes.

## Smear and blur: pick one grammar per film

- **Smear films**: directional blur along the travel axis on the first frame of a fast move, roughly halving each
  frame over 2 to 4 f. Word arrivals 8 to 30 px, cards 15 to 35 px, whips growing to 65 px, one-frame pan smears up
  to about 500 px. Keep the length near 0.5 to 1x of that frame's displacement and under 0.15 W. Build it with an SVG
  `feGaussianBlur stdDeviation="sx sy"` per element (`"0 14"` vertical), set per frame, and `filter: none` when idle.
  For diagonal travel, rotate a wrapper to the travel angle, blur along x, rotate the child back.
- **Crisp films**: hard steps and cuts, no smear even on fast moves; change content during the move instead.
- **Shutter films**: a real shutter at render time (sub-frame averaging, `sensei-video-pipeline`). Never combine it
  with per-element smear (double blur) or with an on-twos stepped film (it smears the held poses).
- Blur is also a focus tool in every grammar: resolve a status word in place (blur 12 to 0 px, opacity 0.1 to 1, 4 f
  per word, back to back); rack-focus the UI behind a headline (to about 11 px), never the type.
- RGB split only on the first word or hero, peak 1 to 4 f, gone by 9 f.

## Camera numbers

Push or pull median 18 f at about 1.46x; slow creeps linear; a camera punch is a one-frame step to 0.56 to 0.77x
then a 0.3 to 0.6 s `softLand` tail; pulls 62% ease-in. Key zoom in log space (`zoomAt`), so 1x to 20x reads as one
speed. More in `transitions-and-continuity.md`.

## Kinetic type inside a film

- Words move at speech rhythm: 2 to 12 frames apart; when voice-led, the onset lands on the spoken word and a wipe
  or reveal leads the voice by about 0.16 s (measured from the Save The Damsel films: reveals fired on the spoken
  word minus about 0.05 s, from edge-tts word boundaries).
- Meaning on the word: the word that carries the claim gets the accent tint or the move; the rest stay calm.
- Counters step per frame with decaying steps; never a smooth tween that blurs the digits.
- Typing is authored with an irregular rhythm and a caret, not a fixed interval.
- Persian and Arabic: split by word, never by letter with inline-block (it breaks joining); mask reveals are the
  shaping-safe way to animate a line. The tested rules live in `sensei-typography`.
- Reading time is a gate, not a feeling: `characters / 15 + 1.5 s` (Latin), `characters / 4.5 + 1.5 s` (Chinese),
  subtitles at least 1.8 s and at least the speech plus 0.6 s, a title card at least 4 s (lemo-opuscar DIRECTOR.md).
