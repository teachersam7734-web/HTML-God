# Transitions, continuity and camera

Sources: motionmaxxing `references/transitions.md` (Apache-2.0; catalogue and decision table summarised in our own
words, read 2026-10-18); onetake's method (PolyForm Noncommercial: **ideas only**, no code; every function named
below is described, not copied); ClaudeAnimationBase and PDoomVideo transition rules; the Save The Damsel films
(SENSEI-LOG).

## The two theses

- **The cut is a pair.** Spec A's last 6 frames and B's first 6 frames together (object, position within about
  0.02 of the frame, scale, colour, blur, ground, velocity), then draw both. A accelerates into the cut; the cut is
  one frame with no fade; B's first frame is already moving; B's entrance continues A's vector.
- **The boundary is the design object** (onetake). A film that replaces scenes reads as a slideshow; a film where
  something survives every boundary reads as one take. Name what carries in the storyboard, for every boundary
  except a burst or the end card (`storyboard-check.mjs` enforces it).

## Catalogue (T1 to T20)

| # | Transition | Mechanics in brief |
|---|---|---|
| T1 | Hard cut on motion | cut at peak velocity; B opens mid-move |
| T2 | Carried-object match cut | one object (caret, dot, card, headline) identical across the cut |
| T3 | The effect becomes the next scene | a bead grows into a disc that is B's ground; a band sweeps and stays |
| T4 | Container replacement | the old container contracts, the next appears at full size in one step |
| T5 | Grey or flat dip hiding a theme flip | a 4 f dip covers a dark to light change |
| T6 | Blur-matched cut | A exits at 18 px blur, B enters at 80 px and resolves in about 8 f |
| T7 | Wipe that starts in A and finishes in B | feathered edge painted in B's ground, about 0.56 s |
| T8 | Mask or clip edge through glyphs | the clip edge sweeps a line in 5 f while it slides the same way |
| T9 | Stair or block wipe | screen-grid steps |
| T10 | Pixel or mosaic dissolve | stepped coverage 90 to 0% over 0.33 s |
| T11 | Zoom-through into a logo detail | about 22x in 0.53 s, up to 3 blank frames, container zoom-out |
| T12 | Pull-back reveal with snap | snap ratio 0.56 to 0.77 then a 0.3 to 0.6 s tail |
| T13 | Whip pan with content changing during the whip | the content swaps while blurred |
| T14 | Scale cut | 3.7x in one frame plus a content jump on the same frame |
| T15 | Ground flips by act | dark and light acts, cut hidden in a band |
| T16 | Localised glitch rectangles | 6 frames or fewer, matched to A's last and B's first object |
| T17 | Occlusion | a rising card covers the old content |
| T18 | One-frame double exposure | a ghost of A for one frame |
| T19 | Hard replacement of a word or line | one frame |
| T20 | Strobe or reel flip | 4 f plates for a montage of styles |

T16, T18 and T20 can trip photosensitivity guidance: cap at 3 flashes per second.

## Choosing (by what changes between A and B)

| What changes | First choice | Alternatives |
|---|---|---|
| Only state | T1 plus T2 | T18 |
| Ground (dark and light) | T3 | T15, T5 |
| Scale, same subject | T14 | T12 |
| Subject, text to UI | T7 | T4, T17 |
| Text line to text line | T19 | T8 |
| Act or chapter | T1 plus T2 with one carried object; never a number, index or corner label | T15, T16 |
| Brand to product | T11 | T12 |
| Product to sign-off | T4 plus T16 plus T1 | T14 slam |
| Field or texture to logo or number | T10 | T9 |
| List or form to result | T4 | T17 |

Rules: no crossfades between scenes (fade only a single object whose motion continues); cut every 0.3 to 2.3 s
inside a beat, let claims run 1.5 to 3 s, shorten scenes toward the end and let the last one linger; build the
transition from a shape the film already owns (the logo's mark, its dot, its grid), never a generic bar; one grammar
per film (crisp films use T1, T2, T4, T9, T10, T14, T19; smear films add T6 and the blurred whip).

## Motivated seams (Save The Damsel, used and rendered)

The transition INTO a scene belongs to that scene: iron shutter plates into a forge, a crimson cloth sweep into a
banner, an RGB glitch into a hologram panel, a page push into parchment, a flash into a word slam, an iris into
torchlight, a zoom into a 3D extrude, a blade slash into a split. Ten treatments shared one skeleton with different
palettes and orders, so no two neighbours matched.

## The carry set (ideas from onetake, implement your own)

| Carry | What it does | How to build it in HTML |
|---|---|---|
| Container transform | one rect becomes another (button to window) | interpolate left, top, width, height and radius of ONE element; content enters after the morph starts and leaves before the next |
| Iris | a circle opens from a point until it covers the frame | `clip-path: circle(r at x y)` with r from 0 to the farthest-corner distance |
| Push-through | log-space push until the target fills the frame | `zoomAt(z0, z1, k)` on a wrapper whose origin is the target |
| Hop and land | an arc to the next slot, landing with an impact | quadratic arc for position, squash on the landing frame, `shake` from the landing time |
| Gather | the cast travels on fanned arcs into a cluster | per-item arcs with staggered onsets 1 to 3 f |
| Seal | the cast folds onto a turning disc | rotate a disc, scale items toward its centre |

Speed reference at 60 fps from onetake: a whip moves about 540 px per frame, an iris about 206, a fly-through 189, a
container morph 156; at 30 fps double them. Moves faster than about 80 px per frame need the shutter or a smear.

## Rhythm (starting thresholds)

- Shot lengths vary: coefficient of variation at least 0.25 (a metronome below), and in a multi-scene film the
  longest at least 4x the shortest.
- Rest and burst: at least 25% of a long film is near-still (onetake's measure); rests are what make bursts land. A
  slow push is not a rest.
- Small elements on a big ground; the cause is visible (draw the cursor or the hand).
- These are one author's taste, measured on product films: starting points, not laws.

## Camera

- **Follow**: key the subject about 0.1 s ahead on a sine in-out; the camera chases and never loses it.
- **Whip**: key the landing point before the snap on an expo in-out; content changes during the whip.
- **Hand**: a slow two-sine float (`hand(t, amp, env)`), enveloped to zero in holds; a decaying `shake` on landings,
  zero before the hit.
- **Lattice**: a far dot grid so a camera move reads on an empty ground.
- **Deep zoom beyond about 20x**: key the anchor's screen position and the log zoom, and recover the camera from
  them; draw nested levels in their own units and fade detail by the parent's on-screen size.
- **One world-to-screen function** for any effect that follows a subject (lemo-opuscar TECHNIQUE).
- Austerlitz-style camera paths: a Catmull-Rom spline through `[t, eye, at, fov]` keys with eased ends, plus a shake
  from summed sines (described, not copied: the repo has no licence).
- GSAP trap from the Damsel films: `rotationY` and `z` on one element do not put it on a ring, because GSAP composes
  translate before rotate. Give an arm parent the rotation and the child the `z`.
