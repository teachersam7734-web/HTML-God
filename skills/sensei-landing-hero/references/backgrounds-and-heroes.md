# Hero backgrounds and hero structures

Sources: `domain-landing-hero.md` (five backgrounds, built and measured), `site-kombai-gallery.md` (three hero
structures read from raw HTML), `site-sceneai.md` (background categories, rebuilt in code only). Built in
[../examples/landing.html](../examples/landing.html) with `?bg=`.

## 1. The container

Every background sits in one layer that cannot catch the pointer or escape the hero:

```css
.hero{position:relative;isolation:isolate;overflow:clip}
.hero .bg{position:absolute;inset:0;z-index:-1;pointer-events:none}   /* <div class="bg" aria-hidden="true"> */
```

## 2. Five CSS backgrounds

| `?bg=` | Recipe | Notes |
|---|---|---|
| `mesh` | three `70vmax` circles, `radial-gradient(circle, glow, transparent 62%)`, each animating `transform` only (22 to 31 s, `alternate`) | a radial gradient is already soft: no `filter: blur`, so the layers stay on the compositor |
| `aurora` | one oversized (`inset: -40%`) `conic-gradient`, radial `mask-image`, rotating 360 degrees in 40 s; a static disc of the page colour over the centre | the cone's apex shows as a pinched star unless it sits at the rotation centre and is covered (found by looking at the screenshot) |
| `spotlight` | `radial-gradient(520px circle at var(--mx) var(--my), glow, transparent 70%)`; one `pointermove` listener, throttled to one write per frame, attached only for `(pointer: fine)` and no reduced motion | repaints per move (paint cost, not compositor); centred without script or on touch |
| `grid` | two 1px `linear-gradient` line sets at 56px with a radial mask fade | static; the cheapest premium look |
| `noise` | a 160px SVG `feTurbulence` tile as a data-URI background at 14% opacity | rasterised once and tiled; never `filter: url(#noise)` on a full-viewport element (re-runs the filter on every paint; reported, not measured) |

Relative frame rates (software raster, 1280 by 800, `sensei-direction`'s `blur-cost.mjs`): this run gave grid 60.3,
aurora 60.7, mesh 61.0, noise 60.7, spotlight 60.7 fps (the pointer was not moving); the research run with the marquee
running gave grid 59 to 60, aurora 58, mesh 54, noise 54, spotlight 53. None is expensive here; this says nothing about
a phone. Never remove an effect for this machine (owner's rule); on real devices use a quality tier and the Calm
pattern (`sensei-tokens-theming`).

## 3. Grounds owned by other skills

| Ground | Skill and example |
|---|---|
| A living shader (domain-warped fbm answering pointer and scroll), raymarched forms, particles | `sensei-shaders-vfx`: `examples/reactive-bg.html`, `raymarch.html`, `particles.html`, with the render-scale governor and the page contract |
| A 3D object or scene behind the copy | `sensei-3d`: `examples/starter.html`, `glb.html`; layer it in the same `.bg` container |
| A hologram figure | `sensei-holograms`: `examples/holo.html`, `depthholo.html`, `points-holo.html` |
| Hero or background video, alpha video, scroll-scrubbed video | `sensei-lottie-rive-video`: `examples/hero-video.html` (poster, pause, reduced motion), `scrub-video.html` |
| Lottie or Rive hero art | `sensei-lottie-rive-video` |

Text over any moving ground: put a scrim between them and pixel-sample the busiest frame (`sensei-direction`); a
nominal colour pair cannot judge it.

## 4. Hero structures (from reading three Kombai gallery heroes; described in our words, not run)

All three were plain HTML with one style block, tokens in `:root`, `clamp()` type and gutters, a `100svh` minimum
height, decoration marked `aria-hidden`, a stacking breakpoint at 760 to 860 px, no script, and every one hotlinked
Google Fonts and remote media (so not offline, and the design licence is unverified: structure only).

| Structure | Mechanism | Our additions |
|---|---|---|
| Full-bleed image or video with a slow drift and a scrim | background scaled 1.05 to 1.12 with a 1.5% drift over 44 s, `alternate`; scrim of a top gradient, a bottom gradient and a radial pocket behind the copy | reduced motion stops the drift; the media embedded; contrast sampled over the busiest area; `transform` only, no `will-change` left on (it blurs text) |
| Oversized wordmark | `font-size: clamp(4.5rem, 17vw, 17rem); line-height: .86`, a soft text shadow over video | a rem term in the clamp so zoom still grows it (`sensei-typography`); Persian needs taller leading |
| Edge-cropped picture tiles | absolutely placed images with negative offsets (`top: -4%`, `right: -5%`) bleeding off the edges; small ones hidden under 760 px; centred `h1` capped at `17ch` | real `alt` or `aria-hidden` per tile; images embedded |

Entrance used by all three: `@keyframes rise { from { opacity: 0; transform: translateY(26px) } }` at 1 s on
`cubic-bezier(.2,.7,.2,1)`, siblings delayed by 0.1 s. None had a reduced-motion rule; ours always does.

## 5. Background categories from paid libraries, rebuilt in code

SceneAI sells animated hero backgrounds and prompts whose licence forbids redistribution, AI training and embedding
where the end user can extract the file (a data URI can always be extracted). So the categories are rebuilt in code:

| Category | Code route |
|---|---|
| Futuristic city, space, VR | layered gradients plus a canvas starfield or a parallax SVG skyline; depth with a noise shader (`sensei-shaders-vfx`) |
| Nature and sky | gradient mesh with slow drift; clouds as large soft radial gradients |
| Glowing abstract forms | domain-warped fbm coloured by a palette ramp, with a little hash dither against banding (`reactive-bg.html`) |
| Gradients | `conic-gradient` and `radial-gradient` stacks, or a dithered canvas to avoid banding |
| Cars, products over scenes | not code: pre-rendered media the user owns or licenses (`sensei-lottie-rive-video`), with a ledger row |
