# Design: looking expensive with zero dependencies

The "production" look is a stack of cheap layered effects plus discipline. Nothing here needs a
library. Everything here needs restraint.

---

## §1 · Tokens first

```css
:root{
  --bg:#070403; --ink:#f8f0e2; --dim:#a89f90;
  --amber:#ffb640; --orange:#ff7a1a; --blue:#59c2ff;
  --line:rgba(255,255,255,.09);
  --grad-fire:linear-gradient(100deg,#fff0b8,#ffd66e 22%,#ffb640 45%,#ff7a1a 70%,#ff4d0a);
  --ease:cubic-bezier(.22,1,.36,1);
  --dock-h:66px;
}
```

- One `--ease` for the whole app (maybe two). Six easings = six apps in a trenchcoat.
- Every colour a custom property. Retheme = edit 10 lines.
- Palette families proven in the three projects: **aurora tech** (dark violet + cyan/violet glow,
  Space Grotesk), **ember library** (near-black warm + fire gradient text, Unbounded + Inter),
  **golden dusk** (deep indigo + gold/magenta gradient spans, Cinzel Decorative).

## §2 · Typography

- One family per role, each role clearly distinct: display (Unbounded/Cinzel/Space Grotesk 800 to 900),
  body (Inter 400 to 600), and a third for data/mono accents (JetBrains Mono, tiny caps, wide tracking)
  when it has a real job. A family without a role is the thing to cut, not the third family.
  Deeper: `html-sensei:sensei-typography` (embedding, subsetting, kinetic type, Persian and RTL).
- Display sizes via `clamp()`, `font-size:clamp(46px,9vw,128px)`, never fixed px for heroes.
- `line-height:.98` on huge display text; `1.6` to `1.75` on body.
- Gradient text: `background-clip:text; color:transparent` on an **inner span**, with
  `background-size:220% 100%` + `background-position` animation for shimmer.
- **Compositor trap (from Arabian Nights):** do NOT put `filter` or `text-shadow` on the same element
  as `background-clip:text`: the glow disappears. Glow comes from a parent frame instead.
- Line length < 80ch for reading text. Serif body gets a touch more line-height.

## §3 · The overlay stack (the cinematic base)

Fixed, `pointer-events:none`, full-viewport, layered:

```css
/* aurora */  body::before { inset:fixed; layered radial-gradients, blurred, slow drift }
/* scanlines */ repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 3px)
/* grain */   inset:-120px, url("data:image/svg+xml,<feTurbulence…>"), steps(4) translate animation
/* vignette */ radial-gradient(130% 100% at 50% 50%, transparent 40%, rgba(0,0,0,.85) 100%)
```

Order matters: vignette above content but below modals; grain nearly invisible (opacity .04 to .06):
it should be *felt*, not seen. Together they make flat UI feel like footage. All are skipped by
`prefers-reduced-motion` where animated.

## §4 · Glow discipline (light responds, it doesn't decorate)

- Hover states respond with **light**, not colour swaps: `box-shadow` bloom + slight `scale(1.02)` to `scale(1.06)`
  + `translateY(-2px)` to `translateY(-3px)`, all on one shared `--ease` over .3 to .45s.
- `drop-shadow` for irregular shapes (SVG icons, PNG logos); `box-shadow` for boxes.
- One direction, one temperature. A warm fire scene glows warm everywhere; cool tech glows cool.
- Active nav item earns an additive glow; inactive items get none. Glow is a status, not a texture.

## §5 · Components that read as "real product"

- **Floating HUD** (top-left chips: STREAK/XP with pulsing dot) instead of a heavy header.
- **Floating dock** (bottom-centre, icon+label, generated from ROUTES) instead of a navbar.
- **Boot/loader screen** with a short animated mark: makes instant load feel *chosen*, not empty.
- **Toast** for feedback; **modal** for details; both one CSS class flip away.
- Cards: `backdrop-filter:blur(12px)`, 1px inset light border (`inset 0 0 0 1px rgba(255,255,255,.1)`),
  radius 16 to 24px, one shadow scale for the whole app.
- Shine sweep on premium buttons: absolutely-positioned skewed gradient sliding via keyframes.

## §6 · Naturalism (phase 6 of the workflow)

- **Ambient motion:** one aurora breathe, one grain loop, one marquee, one parallax: no more.
  Each at the lowest speed that still reads.
- **Page-load choreography:** stagger 4 to 6 elements (`animation: riseIn .9s var(--ease) both`,
  delays 0.1 to 0.5s): one orchestrated moment, not ten scattered fades.
- **Parallax:** mouse-parallax on the hero scene (translate the canvas by 8 to 20px with dampening);
  scroll-reveal via IntersectionObserver adding `.in` (translateY 36px → 0).
- **Depth:** `perspective:1400px` to `1700px` on a stage; `preserve-3d` on the carousel; reflections via a
  flipped, masked, blurred copy of the image (Arabian Nights' `.refl` trick).
- **Sound design:** UI sounds synthesised (see `interaction.md` §4); the scene reacts to audio
  (`audio-reactive.md`).

## §7 · Anti-slop gates (from frontend-design + taste-skill)

Run this list on the design *before* building and the result *after*:

- [ ] Not the cream+terracotta default, not near-black+acid-green by reflex, not broadsheet hairlines
      unless the brief asks.
- [ ] Not identical rounded cards with the same soft shadow, one radius for everything.
- [ ] No ALL-CAPS eyebrow over every heading; no "A · B · C" meta strings; no "→" on every link.
- [ ] Numbered markers only if the content is actually a sequence.
- [ ] Copy is written for the user ("Save changes" not "Submit"); errors say what happened and how
      to fix it; empty states invite action.
- [ ] Boldness spent in exactly one place.

## §8 · Philosophy-first (from canvas-design)

For hero-level pieces, write a 2-sentence **movement name + philosophy** before CSS: "Chromatic
Silence", "Ember Library", "Golden Dusk". Then verify every style decision serves it. This sounds
precious and works: it is why Ultra Bookworm feels coherent rather than decorated. Identify the
subtle conceptual thread from the subject and weave it into color/texture/motion, not into a caption.

## §8b · Named style presets (from the design-catalogue skills)

When the brief names no look, *choose* one from a closed vocabulary instead of defaulting. Each row
is a complete signature (palette + type + motion + texture) that fills the design read in one
line. Mix at most two; always re-derive from the subject first.

| Style | Palette | Type | Motion | Texture |
|---|---|---|---|---|
| **Aurora Tech** (Idiom-Ville) | deep violet bg, cyan/violet glow | Space Grotesk display, Inter body | hologram parallax, shimmer buttons | scanlines + grain |
| **Ember Library** (Ultra Bookworm) | near-black warm, fire gradient accent | Unbounded 900 display | fire canvas, flicker text | grain + vignette |
| **Golden Dusk** (Arabian Nights) | deep indigo, gold/magenta spans | Cinzel Decorative | scene-palette lerp, bloom pump | vignette + starfall |
| **Swiss Statement** | white/one anchor, hairlines | extreme scale contrast, single family | none to minimal | none (whitespace is the texture) |
| **Paper Editorial** | cream ink, drop caps, pull quotes | serif display + sans body | fade-in reveals only | paper grain |
| **Terminal** | near-black, green/amber mono | mono everything | typewriter, cursor blink | scanlines |
| **Soft Pastel** | low-sat pastels, white cards | rounded sans | gentle float | soft shadows |
| **Neo-Brutalist** | saturated primaries, black borders | heavy grotesque | hard 2px-shadow hovers | none |
| **Blueprint** | navy/white line work | mono labels + clean sans | draw-on (SVG stroke) | grid |

## §9 · Liquid glass, the vanilla way (from the liquid-glass-js family)

The 2026 "Apple liquid glass" look, at zero dependencies: three layers. Verified in Chromium only;
Firefox and Safari not verified. The svg-filter path is the intended Firefox route (Firefox does not
apply SVG displacement through `backdrop-filter`), written but not tested there:

```css
.glass{
  /* 1. refraction/blur: backdrop-filter where supported, svg-filter fallback for Firefox */
  backdrop-filter: blur(6px) saturate(1.6);
  background: linear-gradient(120deg, rgba(255,255,255,.14), rgba(255,255,255,.03) 45%, rgba(255,255,255,.10));
  /* 2. specular rim: inner light top-left, darker edge bottom-right */
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), inset 0 -1px 0 rgba(0,0,0,.25),
              inset 0 0 20px rgba(255,255,255,.06), 0 20px 50px rgba(0,0,0,.45);
  border-radius: 20px;
}
/* 3. liquid edge: feTurbulence + feDisplacementMap at very low scale on a ::before ring:
      a faint wobble only where the rim is; skip it over flat, quiet backdrops (nothing to refract) */
```

Keep displacement subtle (scale ≤ 4 on a 2px rim ring); it is a texture, not an effect. Full
library/technique map (WebGL refraction, nested glass, the parameter vocabulary) in
`library-ecosystem.md` §2.

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| Glass panel looks flat, not liquid | no rim layers / no displacement | §9: all three layers, subtle scale |
| Glass effect invisible over flat colours | refraction has nothing to displace | §9 note: drop the layer or busy the backdrop |
| Gradient text glow missing | filter/text-shadow on clipped element | §2 compositor trap |
| Looks "AI-generic" | defaults instead of choices | §7 checklist + §8 philosophy |
| Overlays fight content | opacity/scale too high | grain ≤ .06, vignette soft edge |
| Everything wobbles | motion on everything | §6: one orchestrated moment, few loops |
| Mobile is noise | desktop composition squeezed onto a phone | design the mobile composition on purpose (re-frame the scene, move it behind the content, re-scale overlays); never switch an effect off because a device class is assumed weak: judge on the target device and say what was not verified there |
| Hover states feel cheap | colour swap only | §4: light + lift, one easing |
