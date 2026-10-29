# Principles: handmade, alive, one piece

Rewritten in our own words from ClaudeAnimationBase's `ANIMATION_GUIDE.md` (MIT, John Heibel), claude-animation-skill's
`SKILL.md` and references (MIT, Hanif), papermotion's skill (MIT, Franco Zanardi) and PDoomVideo's guide and storyboard
(no licence: method only). The Save The Damsel films applied several of these (SENSEI-LOG).

## Three goals

1. **Handmade**: it must look drawn or painted, not assembled from shapes.
2. **Alive**: nothing is ever fully still; faces and bodies act.
3. **One piece**: one world, one thread, an ending that rhymes with the opening.

## Seven rules

1. **The medium is solid.** Everything goes through the drawing tools (wash plus ink outline for characters, soft
   washes for backgrounds), never a plain flat shape. Linework boils about 12 times a second with stable seeds per
   element, so a moving thing never re-randomises the rest. Flat 2D: turn through drawn key views rather than projecting
   3D. Light is the exception: pigment mixes subtractively (yellow over blue goes green), so glows are drawn additively
   (canvas `lighter`, CSS `mix-blend-mode: screen`). A soft palette with no pure black or pure white (ink and cream).
2. **No text in the painted picture** for story pieces: show it; reactions are painted marks (!, ?, zzz, sweat, hearts,
   a bulb). For lessons the rule inverts: keep the painted scene text-free and lay real HTML text and captions over it
   (accessible, selectable, translatable).
3. **Something happens in every scene**: an event between the first and last frame; cause, then reaction; every setup
   pays off.
4. **Model the viewer with reads.** List what the viewer must understand in each shot, in order, with times. Give each
   read time to be found, understood and registered. One read at a time. Fast actions, slow meanings: anticipation, then
   a hold on the result. Lead the eye before the important read. Let the reads set the shot length, including the final
   one. (The guide's demo first packed seven events into 1.3 s and nobody could tell what happened.)
5. **Alive**: a per-mood idle (breathing about 2%, a blink about every 3.3 s), a drifting camera, swaying grass. Faces
   change through a take (anticipation squint, squash, overshoot), never a snap. Characters big: a medium shot puts the
   character at about a third of the frame height or more. Everything on one beat when there is music.
6. **Transitions at every seam**, into the first shot and out of the last: brush wipe, iris, whip pan with smear, match
   cut, cut on action, a carrying camera move, a fade or push from paper.
7. **One piece**: storyboard first; one world and a colour arc; one thread; rhyme the ending with the opening; link
   scenes by screen direction and carried props.

## Principles of animation, in code

| Principle | In code |
|---|---|
| Anticipation | a short opposite move before the action (crouch `squash` about 0.78 over 0.25 s before a hop) |
| Squash and stretch | `squash(s)` keeps the area; stretch on the way up, squash on contact |
| Slow in and slow out | eases on poses, but **snap then hold**: the change happens in 1 to 2 frames, only the settle eases |
| Weight | heavy things accelerate slowly and land with a longer squash and a shake |
| Arcs | `arc(k, ...)`: natural motion travels on curves |
| Overlap and follow-through | parts settle after the body stops (`ring` on a leaf, an ear, hair) |
| Avoid twinning | left and right never move identically: offset timing and amplitude |
| Exaggeration | push the key poses further than feels safe, then judge on the sheet |
| Strong key poses | build key poses as stills first and read them on a sheet before in-betweening |
| Show the thought | a look before an action (eyes move, then the head, then the body) |
| Secondary action | a breath, a blink, a sway under the main action, never competing with it |

## Common failures that make animation look generated

Shapes that are not drawn (flat fills with no edge, texture or light); frame 0 empty because everything pops in;
everything moving at once; no anticipation; faces that switch expression in one frame; characters too small to act;
events packed faster than they can be read; cuts with no transition; a world that changes style between shots; text
explaining what the picture should show; held drawings that shimmer because their seed is tied to the frame number;
a scratchy sound bed under every draw-on; a story that does not pay off; static cameras on long shots; identical
left and right limbs.

## Engine versus content (papermotion)

New reusable behaviour goes into the kit as a parameterised function with a test; story content stays in the scene.
Do not grow a catalogue of props in the engine. When asked for an original piece, do not open earlier films first: an
agent that has read other shorts tends to reuse their characters, sets and beats.

## Team builds

One file per chapter in its own scope; an agent edits only its own chapter and reports bugs in shared files rather than
fixing them; a shot is a pure function painting the whole frame; shared surfaces (subtitle band, wipes) belong to the
timeline; a per-frame budget is stated; every agent returns a sheet and its milliseconds per frame (PDoomVideo, method
only). Details in `sensei-motion-graphics/references/film-direction.md`.

## Storyboard with reads

```
Logline:            World:            Motif:            Arc (colour and feeling):
| shot | t start | t end | what happens (event) | reads, in order, with times | camera | exposure (ones/twos) | transition out | sound cue |
Ending rhymes with the opening by:
Style bible (paste verbatim at the top of the scene file so the look does not drift between sessions):
  palette, line weight, wash opacity, boil rate, paper, light direction, character proportions
```
