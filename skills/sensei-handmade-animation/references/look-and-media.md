# The look: paper, ink, wash, boil, light

## Detail bible (claude-animation-skill, rewritten)

Every surface gets a **base** (the colour), a **texture** (fibre, hatching, cells, grain) and an **edge** (ink, a rim
light, a darker pooled edge). Near the camera nothing is a flat colour: a core shadow, a rim, two tones. One light
direction per shot. Layers separate by value. Line weight in close-ups scales with zoom about `zoom^-0.55` (papermotion)
so lines do not balloon. Design inside the code makes slides; a cut must add information.

## Materials in `handmade-kit.js`

| Tool | What it does | Notes |
|---|---|---|
| `paper(document, w, h, { seed })` | blotches, fibres and a vignette drawn once into an offscreen canvas | seeded, so every frame and every render has the same paper; draw it first each frame |
| `inkLine(g, pts, { key, t, w })` | a tapered filled stroke, swelling in the middle, boiling with the element's own seed | the path points move, not a filter, so frames are exact in any order |
| `wash(g, pts, { key, t, color, alpha })` | three jittered translucent passes, pigment pooling at the edge | for big calm fills use a slower boil rate |
| `blob(g, pts)` | a closed boiling outline | pair with a wash |
| `ellipse(cx, cy, rx, ry, n, rot)` | points for bodies, petals, puffs | raise a point to make a tip |
| `iris`, `brushWipe` | the two seam transitions | `brushWipe` finishes every band exactly at k = 1 (an early version left several fully covered frames) |

## Boil, three ways

| Method | Exact in any seek order? | Use it for |
|---|---|---|
| Jitter the path points from a seed per element and boil step (`inkLine`, `wash`) | yes (tested: 6 of 6 frames in `hop.html`) | films that must pass a hash probe; canvas work |
| SVG `feTurbulence` plus `feDisplacementMap`, seed stepped 12 times a second (`svg-boil.html`) | no: revisited seeds differ by a few edge pixels in Chrome (tested); fresh in-order renders match | live pages, SVG illustrations, drafts; one attribute change per step |
| p5.brush jitter reseeded 12 times a second (ClaudeAnimationBase) | pure in t by design (reported) | when the p5 route is chosen; WebGL-heavy |

Stable seeds: seed from the element's name (`'pip-body'`), never from the frame index, or held drawings shimmer
(claude-animation-skill). A boil is continuous low-level motion: in an interactive page give a "no boil" setting and
hold one seed under reduced motion (`jit(key, i, t, 0)` freezes it).

## Colour

- Pigment mixes subtractively: a yellow wash over blue goes green. Light is added, not painted: `globalCompositeOperation
  = 'lighter'` or CSS `mix-blend-mode: screen`.
- Multiply washes go muddy on dark grounds: paint over instead (claude-animation-skill `over: true`).
- No pure black or white: ink (`#2b2233` in our examples) and cream paper (`#f3ebdc`), a soft palette with a colour arc
  across the piece. ClaudeAnimationBase's palette: paper `#F3EBDC`, ink `#2B2233`, clay `#D97757` (values only; the
  palette idea is not a licence question).
- Painted light reads best as a separate pass over the washes.

## Paper collage and other hand-made looks

The halftone paper collage look (gbro) and the stop-motion assembly are in `sensei-motion-graphics/references/
film-direction.md`. lemo-opuscar's hand-drawn styles (crayon picture book, watercolour, ink wash, impasto, one-line
drawing, whiteboard, urban sketch) each have a STYLE.md with materials, motion and pitfalls (MIT): read the matching
one before building in that look, and keep its notice if code is copied.

## Accessibility of painted pieces

A canvas has no semantics: `role="img"` and an `aria-label` that tells the story, captions or a transcript for any
voice, a pause control in the player, a still poster under reduced motion, flashes at most 3 per second (iris flashes,
brush wipes and hit flashes count), and a "no boil" option for long loops.
