# Design Read: `<project name>`

> Fill this in **before any code** (workflow phase 1). One page, five minutes, saves hours.
> Copy this file into the project directory and fill every blank. Blanks left blank = defaults
> chosen for you, and defaults are how generic output happens.

---

## The one-liner

> "Reading this as: **\<kind>** for **\<audience>**, with a **\<vibe>** language, leaning towards
> **\<palette family> / \<type pairing> / \<motion level>**."

Example: *"Reading this as: an interactive lyric journey for music listeners, with a golden-dusk
cinematic language, leaning towards deep indigo + gold gradients / Cinzel Decorative + Space Grotesk /
high motion."*

## Dials

| Dial | Value | Why |
|---|---|---|
| `DESIGN_VARIANCE` | 1 to 10 | |
| `MOTION_INTENSITY` | 1 to 10 (default 8 when the brief is silent: cinematic) | |
| `VISUAL_DENSITY` | 1 to 10 | |

Reduced-motion path for each animated system (built in from the start): ________________

## The one memorable element

The single thing a stranger would describe afterwards:

> ________________________________________

Everything else stays quieter than this. (Idiom-Ville: the hologram globe. Ultra Bookworm: the fire
library. Arabian Nights: the carpet flight over the dunes.)

## Expected engines

- [ ] Canvas 2D: which scene? ________________
- [ ] three.js + bloom: why is hand-rolled not enough? ________________
- [ ] WebAudio: synthesised SFX / analyser bands / both
- [ ] Embedded audio: tracks & sizes: ________________
- [ ] Router: routes list: ________________
- [ ] Store: what persists? ________________

## Delivery and weight (information, not a budget)

| Question | Answer |
|---|---|
| Delivery channel (emailed / USB / LMS / hosted / venue laptop) | ______ |
| Must work offline (no network requests)? | yes / no |
| Target devices (the ones it must look best on) | ______ |
| Did the user ask for a size budget? (only then is there one) | no / yes: ______ |

Planned embeds (asset → est. size; weight is reported, never used to cut quality):

| Asset | Est. size | Format |
|---|---|---|
| | | |

## Palette sketch (4 to 6 named hex values)

```
--bg      #________   (the ground everything sits on)
--ink     #________   (primary text)
--dim     #________   (secondary text: check 4.5:1 on --bg!)
--accent  #________   (the one bold color)
--accent2 #________   (used sparingly)
--line    rgba(255,255,255,.09)
```

## Type roles

- Display: ______________ (weight 700 to 900, `clamp()` sizing)
- Body: ______________ (400 to 600, line-height 1.6 to 1.75, <80ch)
- Mono/data: ____________ (tiny caps, wide tracking; a third family is fine when it has this job)
- How each face is shipped: embedded base64 woff2 (offline) / hosted link / system stack: ______

## Data contract sketch

```js
/* { field: type, meaning,
     field: type, meaning } */
const DB = [ ];
```

## Store sketch

```js
const KEY = '_________v1';
data: { v:1, ________: , ________: }
```

## Feature list (ranked)

**Must:** ______________________________
**Should:** ____________________________
**Could:** _____________________________ (the Part-B menu: record, don't build)

## Anti-slop pre-check (design.md §7)

- [ ] The palette/type would not appear on any other subject unchanged
- [ ] One orchestrated load moment planned, not scattered fades
- [ ] Overlays serve the scene, not stickered on
- [ ] Copy planned in the user's voice ("Save changes", not "Submit")
