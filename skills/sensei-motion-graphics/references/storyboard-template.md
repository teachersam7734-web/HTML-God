# STORYBOARD template

Copy into the project as `STORYBOARD.md`, and keep the beat table also as `STORYBOARD.json` for
`storyboard-check.mjs` (fields listed in that script's header). Structure combines motionmaxxing's storyboard,
ClaudeAnimationBase's reads sheet, PDoomVideo's "what ties it together" section and onetake's carry column (ideas,
our wording).

```
# <title>

PAGE      problem: | audience: | goal: | emotion:
One true thing:
The idea (one sentence about the picture):   Three ideas considered, and why this one:
Benchmark: what to learn | what not to copy
World: ground | light | depth | texture | sound palette            (per act if acts differ)
Motif that pays off:            Colour arc:            Ending rhymes with the opening by:
Hero moment (the screenshot-worthy frame):
Blur grammar (smear | crisp | shutter):      Clock (smooth | twos):      fps:      size:

| # | t start | t end | role | buys (one belief) | copy (verbatim) | what moves | what is still | reads (in order, with times) | hand-off | carried object | sound cue |
|---|---|---|---|---|---|---|---|---|---|---|---|

Hand-off table (one row per boundary):
| boundary | A last frame (object, position, scale, colour, blur, velocity) | B first frame (same fields) | carried | cut type | frame |

Cue map: time | picture event | sound event | voice line
Text-covered test: describe each beat's picture with all text hidden.
Facts: every number on screen and its source (FACTS.md for factual films).
```

Rules the checker enforces: beat lengths vary (cv at least 0.25); a long film has at least one designed rest and is
not mostly still; every boundary names what carries unless it is a burst or the end card; every beat names what it
buys; every text stays readable for `characters / 15 + 1.5 s` (Latin); frame 0 is part of the film; the end hold is
at most 1.4 s.
