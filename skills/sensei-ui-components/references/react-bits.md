# React Bits: catalogue and the fetch-and-port procedure

React Bits (github.com/DavidHDev/react-bits, site reactbits.dev) is a copy-in library of animated React components.
**This plugin carries no React Bits source, and must not**: the licence forbids redistributing the components "alone,
in a bundle, or as a ported version", and the plugin's licence guard blocks React Bits code written into plugin files.
What it carries: this catalogue (names and effects described in our own words), the procedure, the notice template
([react-bits-notice.txt](react-bits-notice.txt)) and a generic fetcher ([../scripts/registry-fetch.mjs](../scripts/registry-fetch.mjs)).

**Owner's rule (ADDITIONS §9.4)**: in a project the plugin builds, use the real React Bits code: fetch the original
component into that project and use or port it verbatim, keeping the copyright and licence notice in a header comment.
The same applies to the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab) and
the sound library: their exports may be used in a product, never sold or redistributed on their own as a pack.

## 1. The licence in four lines

- `LICENSE.md` (read 2026-10-24): "MIT + Commons Clause License Condition v1.0", Copyright (c) 2026 David Haz.
- Allowed: use, copy, modify, merge, publish and distribute **as part of an application, website or product**,
  commercial use included.
- Required: the copyright notice and the permission notice in all copies or substantial portions (so a header with
  the copyright line alone is not enough: the template carries the whole text).
- Forbidden: selling, sublicensing or redistributing the components themselves, alone, in a bundle or as a ported
  version. A starter kit, template pack or plugin that contains them is redistribution.

## 2. The procedure

**Choose.** Read the live index (`https://www.reactbits.dev/llms.txt`, about 94 KB: every component with its effect and
CLI id) or the demo pages (every prop has a control). Do not copy the index into the project or the plugin; read it
when choosing. Pick the flavour: `JS` or `TS`, `CSS` or `TW` (Tailwind).

**Fetch into the project** (never into a plugin, a shared template or a starter pack). Two routes:

```
# A. the generic fetcher: files written verbatim with the notice header, plus the ledger row
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-ui-components/scripts/registry-fetch.mjs https://reactbits.dev/r/Aurora-JS-CSS.json \
  --out src/components/aurora --notice ${CLAUDE_PLUGIN_ROOT}/skills/sensei-ui-components/references/react-bits-notice.txt \
  --id react-bits-aurora --licence "MIT + Commons Clause"

# B. the shadcn CLI in a React project that already uses it (then add the notice header by hand: the registry files have none)
npx shadcn@latest add https://reactbits.dev/r/Aurora-JS-CSS
```

The item URL is `https://reactbits.dev/r/<Name>-<JS|TS>-<CSS|TW>.json` (the `.json` suffix is optional; both returned
the same item on 2026-10-24). With route B, `components.json` may carry `"registries": { "@react-bits":
"https://reactbits.dev/r/{name}.json" }` so `npx shadcn@latest add @react-bits/Aurora-JS-CSS` works, and the shadcn
MCP server (`npx shadcn@latest mcp init --client claude`) lets an agent search and add components.

**Install its dependencies with exact versions.** The registry lists them with caret ranges (SplitText:
`gsap@^3.13.0`, `@gsap/react@^2.1.2`; WarpText: `ogl@^1.0.11`), and lists neither `react` nor peers. Use
`npm i -E <deps>` so the installed version is saved exactly, and read the component's imports for anything the list
leaves out.

**Keep or port.**

- In a React project: use the component as fetched. The header is the only change.
- In a vanilla page or a single offline file: port **verbatim** in the project: keep every shader string, constant,
  maths and event rule as written; replace only the React shell. Write the port in its own file that starts with the
  same notice, and set the ledger row's `use` to `ported`. Then pack it (`sensei-single-file`) and vendor GSAP, ogl or
  three instead of a CDN.
- Or bundle the React component as it is: a small esbuild or Vite project, the component, React (about 140 KB
  minified), built to one file. Allowed in the user's product.

| React shell | Vanilla equivalent |
|---|---|
| props with defaults | an `opts` object merged over defaults |
| `useRef` on the container | the element passed to `mount(el, opts)` |
| `useEffect(() => { ...; return cleanup }, deps)` | `mount` does the setup and returns `destroy()`; call `update(opts)` where deps changed |
| `useState` for UI state | a local variable plus a function that writes the DOM |
| `className` and CSS import | `class` plus the CSS file inlined (`sensei-single-file`) |
| `motion/react` springs | WAAPI or a small spring (`sensei-motion-ui`) |
| `@gsap/react` `useGSAP` | `gsap.context()` and `ctx.revert()` in `destroy()` |
| `'use client'` | remove (keep the notice above where it was) |

A port skeleton (our own shape; the component's own code goes inside, unchanged):

```js
/*! {{the filled notice from react-bits-notice.txt}} */
export function mount(el, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  // ...the component's setup, verbatim, with refs replaced by el...
  return { update(next) { Object.assign(opts, next); /* ...what its effect deps did... */ }, destroy() { /* ...its cleanup, verbatim... */ } };
}
```

**Harden in the project** (the components vary in how production-ready they are): check the reduced-motion path (221
files mention `prefers-reduced-motion`, which is not a guarantee per component), pause off screen and when the tab is
hidden, WebGL context loss, a touch and keyboard path for cursor effects, real DOM text for canvas text, a scrim under
text on shader backgrounds, flashes at most 3 per second. Then the gate (`sensei-verify`).

**Record.** The ledger row (`registry-fetch.mjs` writes it): id, name, URL, licence, `use: fetched` or `ported`,
files, `notice: header`, `ships_in_plugin: false`, dependencies in the note.

## 3. Catalogue (studied 2026-10-17; 218 free components)

Counts by folder: Text Animations 33, Animations 38, Components 48, Micro 35, Backgrounds 64. Each comes in four
flavours (JS or TS, CSS or Tailwind). 133 have no third-party dependency (React plus DOM, canvas or raw WebGL), 86 run
raw WebGL. Square brackets name the third-party dependency; none means React only. A paid "Pro" tier exists and is not
in the free registry: do not name or suggest Pro items without the user's licence.

**Text animations.** ASCIIText (waving ASCII text, scramble on hover) · BlurText (blur-to-sharp resolve) [motion] ·
CircularText (letters on a rotating circle) [motion] · CountUp (number counter) [motion] · CurvedLoop (marquee on a
curved path, draggable) · DecryptedText (glyph cycling that resolves) [motion] · DepthText (layered extruded type,
pointer parallax) · EchoText (ghost copies merge) · FallingText (letters become physics bodies) [matter-js] · FoldText
(lines unfold like paper) [gsap, ScrollTrigger] · FuzzyText (vibrating edge) · GlitchText (RGB split jitter) ·
GradientText (sweep inside letters) · MaskedHeading (colour or image through the heading, word by word) [gsap] ·
ParticleText (particles reform into text) · RotatingText (phrases flip in 3D) [motion] · ScrambledText (pointer
proximity scramble) [gsap, ScrambleTextPlugin, SplitText] · ScrollFloat [gsap, ScrollTrigger] · ScrollReveal
(unblur on scroll) [gsap, ScrollTrigger] · ScrollVelocity (marquee speed follows scroll) [motion] · ShinyText (sheen)
· Shuffle [gsap, SplitText, ScrollTrigger, @gsap/react] · SplitFlapText (departure board) · SplitText (staggered
character or word entrance) [gsap, SplitText, ScrollTrigger, @gsap/react] · StrokeText (outline draws, then fills)
[gsap, ScrollTrigger] · TechText (letters become dashed paths under the cursor) · TextCursor (stamps trail the cursor)
· TextLoop (marquee along curved paths) [gsap] · TextPressure (variable axes by pointer pressure) · TextType
(typewriter with caret) [gsap] · TrueFocus (focus frame moves across words) [motion] · VariableProximity (variable
axes by pointer distance) · WarpText (WebGL warp around the pointer) [ogl].

**Animations (cursor, hover, scroll, image, border).** AnimatedContent and FadeContent (scroll-reveal wrappers)
[gsap, ScrollTrigger] · BlobCursor (liquid blob cursor) [three] · ClickSpark (sparks on click) · Crosshair (measuring
crosshair cursor) · CrystalizedBall [ogl] · Cubes (grid of cubes facing the cursor) · CursorGrid · DitherVeil [ogl] ·
ElasticMesh (pokeable jelly logo) · ElectricBorder · ElectricLogo [ogl] · GhostCursor · GlareHover (sweeping glare) ·
GlowCursor · GradualBlur (progressive edge blur) · HalftoneReveal · ImageTrail [gsap] · LaserFlow · LogoLoop (logo
marquee, pause on hover) · Magnet (element eases toward the cursor) · MetaBalls · MetallicPaint (liquid chrome over a
logo) · Noise (film grain overlay) · OrbitImages · PixelSwap · PixelTrail · PixelTransition (pixel dissolve card swap) ·
Ribbons · RippleDistortion [ogl] · ScrollExpand (media grows to full bleed) · ShapeBlur · SplashCursor (fluid ink) ·
StarBorder · StickerPeel · Strands · SwarmCursor · TargetCursor (reticle snaps around targets).

**Components (cards, navigation, carousels, galleries).** AccordionGallery [gsap] · AnimatedList (keyboard-selectable
rows) · BorderGlow · BounceCards · BubbleMenu [gsap] · CardNav · CardSwap (3D card stack) · Carousel · ChromaGrid ·
CircularCarousel · CircularGallery · Counter (odometer) · CurvedInput · DecayCard · DepthCarousel [gsap] · Dock
(magnifying dock) · DomeGallery [@use-gesture] · DriftWall · ElasticSlider · FlexCarousel [ogl] · FlowingMenu ·
FluidGlass [three via react-three-fiber] · FlyingPosters · Folder · GlassIcons · GlassSurface (liquid glass via SVG
displacement) · GooeyNav · HoloCard (holographic foil card) · InfiniteMenu · InfiniteSpiral · Lanyard [three] ·
LineSidebar · MagicBento (bento grid with edge light) · Masonry · ModelViewer [react-three-fiber, drei, three] ·
MorphSlider [gsap, ogl] · OptionWheel · PillNav · PixelCard · ProfileCard · ReflectiveCard · ScrollStack · SpecularButton
· SpotlightCard · Stack [motion] · StaggeredMenu [gsap] · Stepper · TiltedCard.

**Micro (small tactile controls, mostly [motion]).** BellToggle, BranchedMenu, CallChip, CodeSlots (one-time code
input), CometDial, DodgeField, FlipCard, FolderFloat [matter-js], FuseButton (undo before a fuse burns out),
GlideSelect, HoldButton (hold to confirm), JellyRadio, LatticeLoader, PaperCrumple [three], PeekRating, PromptBar,
PulseHeart, RefineFrame, RubberSegment, ScrubField (drag to scrub a number), Shredder, SlideCommit (slide to confirm),
SlingButton, SloshGauge, SpringCheck, SquishSwitch, StatusMark, SwipeRow, SwipeToast, TearTicket, ThoughtLine,
VoicePill, WakeSlider, WarmTooltip (later tooltips open at once while the group is warm).

**Backgrounds (mostly raw WebGL, no dependency).** AcidSquares, AeroShards, Antigravity, Aurora, Balatro, Ballpit,
Beams, ColorBends [three], CRTWarp, DarkVeil, Dither, DotField, DotGrid, FaultyTerminal, Ferrofluid, FloatingLines,
FluxLines, Galaxy, GhostFibers, GradientASCII, GradientBlinds, GradientWaves, Grainient, GridDistortion, GridMotion,
GridScan, Hyperspeed [three], Iridescence, LetterGlitch, Lightfall, Lightning, LightPillar, LightRays, LightTunnel,
LineWaves, LiquidChrome, LiquidEther, MagicRings, MagnetLines, MicroSlats [ogl], MoltenMetal, Orb, Particles,
PatternWaves [ogl], PixelBlast, PixelSnow, Plasma, PlasmaWave, Prism, PrismaticBurst, Radar, RippleGrid, Scanner,
ShapeGrid, ShapeWaves, SideRays, Silk, SlicedWaves, SoftAurora, Threads, Topography, Waves, WebThreads.

**By HTML-Sensei domain.** Hero: the backgrounds plus SplitText, BlurText, ShinyText, GradientText, MaskedHeading,
CardNav, PillNav, MagicBento, SpotlightCard (`sensei-landing-hero`). Pointer: TargetCursor, Crosshair, BlobCursor,
SplashCursor, Magnet, GlareHover, TiltedCard, ClickSpark (`sensei-pointer`). Scroll: ScrollReveal, ScrollFloat,
ScrollVelocity, ScrollStack, ScrollExpand, AnimatedContent (`sensei-scroll`). Kinetic type: the text animations
(`sensei-typography`; their per-letter splitting breaks Persian and Arabic joining). 3D: HoloCard, Lanyard,
ModelViewer, FluidGlass (`sensei-3d`). Micro-interactions: the Micro folder (`sensei-motion-ui`).

## 4. Traps

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | The licence guard blocks a write | React Bits code going into a plugin path | fetch into the project instead; the plugin keeps the catalogue | by design (`guard-licence`) |
| 2 | A fetched file has no notice | registry items carry no header (Aurora's JSON starts at `'use client'`) | `registry-fetch.mjs` adds it; with the shadcn CLI add it by hand | tested 2026-10-24 |
| 3 | A header with only "Copyright (c) 2026 David Haz" | the permission notice must be included too | use the full template | read from `LICENSE.md` |
| 4 | Versions drift between builds | registry dependencies are caret ranges | `npm i -E` | tested (SplitText, WarpText items) |
| 5 | Import of `react` or a peer missing | the registry's `dependencies` omits React and peers | read the imports | tested (Aurora lists none) |
| 6 | Several WebGL effects on one page stutter on weak GPUs | 86 components run a shader every frame | keep the effects (target device rule), add adaptive quality, off-screen and hidden-tab pause, context-loss handling | reported (repo study) |
| 7 | A cursor effect leaves keyboard and touch users with nothing | about 40 components are pointer-driven | a focus and tap path, native cursor kept for keyboard, a way to turn it off | reported |
| 8 | Canvas text invisible to screen readers and search | text drawn to canvas | real DOM text (`aria-label` or visually hidden copy) | reported |
| 9 | Persian or Arabic letters fall apart in a text effect | per-character `inline-block` splitting | split by word or use the `sensei-typography` rules | tested (typography lane, +150 px on a 498 px line) |
| 10 | Flashing components (Lightning, GlitchText, LetterGlitch, Hyperspeed, ClickSpark) | strobe-like motion | at most 3 flashes per second, reduced-motion path | reported |
| 11 | A Pro item suggested | Pro is paid and not in the free registry | only with the user's licence | reported |
