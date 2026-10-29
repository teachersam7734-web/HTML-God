# Library Ecosystem: the 2026 effects wave, mapped to single-file doctrine

react-three-fiber, liquid-glass-js, shadergradient and liquid-logo (plus their neighbours) defined
the current "expensive web" look. They are React/npm-era projects; this skill ships one HTML file
with zero dependencies. This reference is the honest bridge: what each library actually is, when
its code may enter the file, and how to re-derive its effect in vanilla when the code shouldn't.

---

## §0 · The two doors

| | **Door A: port the technique** | **Door B: bundle the library** |
|---|---|---|
| How | Re-implement the effect in vanilla against the build's tokens | esbuild-bundle the app + library, inline the bundle (`media-embedding.md` §7) |
| Cost | Hours; 30 to 80 lines you own | Build tooling + the runtime of the React/3D stack (about 1 MB minified, an estimate not measured here) |
| Keeps | Zero deps, tokens win, nothing to vendor, offline forever | Exact library look + behaviour; React ecosystem (drei, leva, state) |
| Breaks | Exact replication of the demo's edge cases | Email/chat/markdown delivery channels; instant boot; "view source" |
| Default for | Single-file deliverables (this skill's whole premise) | Genuinely stateful apps that must *also* ship as one file |

**The doctrine: a dependency is a look-decision, not a shortcut.** Choose Door B when the library's
*state model* is the point (interactive 3D with real React state, editor UIs). Choose Door A when
only its *pixels* are the point: which is almost always, for landing pages and cinematic pieces.
Neither door is chosen to save weight: pick the one that gives the best result, report the weight
as information, and give every vendored or ported piece a row in the project's licence ledger
(HTML-Sensei: `html-sensei:sensei-ui-components` for library choice and licences).

## §1 · pmndrs/react-three-fiber: a React renderer for three.js *(MIT)*

**Verified from the repo:** JSX components compile to real three.js objects (`<mesh/>` →
`new THREE.Mesh()`), "no overhead" (components render outside React), and a hard version pairing:
fiber@8 ↔ React 18, fiber@9 ↔ React 19. The docs' own warning applies double here: *you must be
versed in both React and three.js* before reaching for it.

- **Door B only.** It brings react + react-dom + fiber + three (about 1 MB minified, an estimate not
  measured here) before your scene code (inline three r128 alone is 589 KB, measured,
  `scripts/inline_three.py`). If React state is not genuinely driving the scene, Door B buys
  ceremony, not capability. In a project that already uses React, see `html-sensei:sensei-3d`.
- **Patterns worth stealing in vanilla:**
  - `useFrame((state, delta) => …)`: the delta clock. Every per-frame update multiplied by
    `delta` is iron rule "one RAF loop" in library clothing. Adopt `delta` in every engine.
  - Declarative reuse: one `Box` component, many instances: mirrors one geometry + `InstancedMesh`
    (`webgl.md` §4).
- **drei** (helper components, also MIT) is best read as a *menu of effects to re-derive*:
  `Stars` → THREE.Points with size attenuation; `Sparkles` → additive points with per-point phase;
  `Float` → a sine-transform parent group; `MeshTransmissionMaterial` / `Environment` → door-B-only,
  don't re-derive transmission.

## §2 · dashersw/liquid-glass-js: WebGL liquid glass *(MIT)*

**Verified from the repo:** Apple-Liquid-Glass-style glass in **vanilla JS + WebGL 2.0**, zero
dependencies except html2canvas for page sampling; no build step; multi-layer refraction (edge /
rim / base intensities), nested glass (children sample the parent's output), live parameter
control, three shape types (rounded / circle / pill).

- **Door A is genuinely available**: it's vanilla and no-build, so it can be inlined as-is
  (tens of KB, plus html2canvas 1.4.1 at 194 KB minified, measured, *if* you need live page
  sampling). This is the rare library that survives the single-file rule on its own terms.
- **The honest cost:** it re-renders from a page snapshot, so any content change under the glass
  needs a re-capture (expensive on animation); it needs WebGL 2.0; a CSS-grade panel is ~15 lines.
- **The CSS/SVG port** lives in `design.md` §9: `backdrop-filter` glass + specular rim +
  an `feTurbulence`/`feDisplacementMap` edge layer. Use the library when you want *true refraction*
  of a static backdrop; use the recipe everywhere else.
- Its **parameter model** (edge intensity, rim intensity, falloff distances, ripple, blur, tint)
  is itself worth copying in any home-grown glass: name your uniforms after it.

## §3 · ruucm/shadergradient: animated shader gradients *(MIT per its npm packages; the repo root has no licence file)*

**Verified from the repo:** a `ShaderGradient` plane rendered via react-three-fiber (peer deps:
three, @react-three/fiber, three-stdlib, camera-controls), also shipped for Framer/Figma/Vue.
Gradient vocabulary: `type` plane/sphere/waterPlane, `uSpeed`, `uStrength`, `uFrequency`,
`uAmplitude`, three colours, camera angles, wireframe, grain: and a **query-string preset format**
(`?animate=on&uFrequency=5.5&uSpeed=0.4&uStrength=4&color1=…`) copied from shadergradient.co.

- **Door A by default:** this is exactly `webgl.md` §6's shader: a plane, 2 to 3 octaves of value
  noise displacing vertices or colours, three `color-mix` uniforms, one `uTime` uniform. ~50 lines,
  and yours can do what the library can't: pump `uStrength` with the audio bass
  (`audio-reactive.md`) and lerp with the scene timeline.
- **Adopt the query-string preset idea**: expose the same 5 to 6 params as URL search params
  (`?g_speed=.4&g_strength=4`): shareable looks, zero UI.
- **Door B** when the brief demands shadergradient.co's exact look: esbuild route
  (`media-embedding.md` §7) and price the four peer deps against "client emailed this file".

## §4 · paper-design/liquid-logo (+ paper-design/shaders): liquid metal logos *(liquid-logo: PolyForm Shield 1.0.0; shaders: Apache-2.0)*

**Verified from the repos:** `liquid-logo` is the demo app ("turn your logo into liquid metal",
liquid.paper.design) under the **PolyForm Shield 1.0.0** licence (source-available, not open
source: use is allowed except in a product that competes with the licensor; checked 2026-10-27).
Treat its code as reference. The engine is **paper-design/shaders**: a set of canvas/WebGL shaders
(mesh-gradient, liquid-metal, grain-gradient, …) shipped as **zero-dependency vanilla JS** with
optional React wrappers, **Apache-2.0** (npm `@paper-design/shaders` 0.0.82 on 2026-10-27: pre-1.0,
so pin the version you vendor).

- **Door A is surprisingly real here too:** because `@paper-design/shaders` has a zero-dep vanilla
  build, you can vendor *the one shader module you want* into the file (keep its Apache-2.0 notice,
  add the ledger row, done). Vendor from `paper-design/shaders`, not from the liquid-logo app.
  This is the correct move when the brief says "liquid metal" specifically.
- **Re-derived (the 60-line version):** liquid metal ≈ domain-warped noise (`p + k·noise(p)`, two
  octaves) pushed through a metallic palette ramp + specular highlights where the derivative of the
  noise field crosses zero: a `ShaderMaterial` in the `webgl.md` §6 skeleton. Logo variant:
  sample the logo as a texture and displace its edges along the same noise field; keep the log
  readable by clamping displacement.
- **Similar tool:** `collidingScopes/liquid-logo`: a vanilla-canvas liquid-metal logo maker; MIT
  per GitHub's licence detection (2026-10-27); keep its notice if you lift code.

## §5 · The similar-repos sweep

**Liquid glass family:**

| Repo | What it holds | Licence |
|---|---|---|
| `dashersw/liquid-glass-js` | WebGL2 refraction glass, vanilla, no build | MIT ✓ |
| `nikdelvin/liquid-glass` | iOS 26 liquid glass in **pure CSS + SVG filters** (LiquidGlass/Button/Text) | MIT (GitHub, 2026-10-27) |
| `childrentime/liquid-glass` | Vanilla notes on the `feDisplacementMap` approach | check repo |
| `ybouane/liquidglass` (npm) | Glass refraction/blur/lighting for any element | check repo |

**Gradient & shader engines:**

| Repo | What it holds | Licence |
|---|---|---|
| `paper-design/shaders` | Shader set, zero-dep vanilla build + React wrappers | Apache-2.0 ✓ |
| `paper-design/liquid-logo` | The liquid-metal logo demo app | PolyForm Shield 1.0.0 (reference only) |
| `ruucm/shadergradient` | Animated gradient planes + param/preset vocabulary | MIT (npm packages) ✓ |
| `pmndrs/postprocessing` (moved from `vanruesc/postprocessing`) | The composer engine behind react-postprocessing: full-screen pass math to study | Zlib ✓ |

**The pmndrs ecosystem (door-B context, MIT unless noted):** `drei` (helpers: read as a
re-derive menu), `zustand` (state: the store pattern this skill already hand-rolls in
`architecture.md` §4), `leva` (control panels: a debug-mode idea worth stealing in vanilla),
`use-gesture` (pointer gestures), `@react-spring/three` (springs: port the *spring function*,
~20 lines, not the library), `three-stdlib` (typed three examples: a study index),
`TresJS` (the same idea for Vue 3).

## §6 · Decision table: which door

| The brief asks for… | Default (Door A) | Pay for Door B when… |
|---|---|---|
| Glass panels, frosted chips, liquid buttons | `design.md` §9 recipe | True refraction of a *static* busy backdrop → inline liquid-glass-js |
| Animated 3-colour gradient background | `webgl.md` §6 noise shader or `design.md` §3 aurora | shadergradient.co's exact look is contractual |
| Liquid-metal logo treatment | domain-warped noise ShaderMaterial (`§4`) | Vendor one `paper-design/shaders` module instead: it's vanilla |
| Interactive 3D with real app state | (rarely single-file) | React state genuinely drives the scene (weight reported, not a gate) |
| Sparkles/stars/float ambience | `canvas-2d.md` §3 + drei-as-menu | never |

## §7 · Rules

1. Name the door in the build log before naming the library. "Use X" is not a decision; "Door A,
   re-derive X's gradient as a noise shader" is.
2. A library enters the file as-is only if it is genuinely dependency-free (liquid-glass-js,
   paper-design/shaders vanilla); otherwise through the esbuild door, decided in writing
   (`media-embedding.md` §7). Either way: a licence-ledger row and the weight reported.
3. Steal parameter vocabularies, clocks, and preset formats even when you skip the code:
   that's where most of the value lives.
4. React renderers never enter a single file as script tags; only through the bundle pipeline.
5. Check the licence per repo before lifting *code*: repos in §5 marked "check repo" were
   verified for technique, not rights. Licences above were rechecked on 2026-10-27 against
   GitHub's licence detection, the LICENSE file or the npm package; they drift, so check again
   before shipping.

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| File gained ~1 MB and the stack adds nothing visible | React/3D stack bundled for a pixels-only brief | §0: door-A re-derivation (for the better result, not for the weight) |
| Glass effect invisible over flat colours | refraction has nothing to displace | `design.md` §9: busy backdrop or drop the displacement layer |
| Shader gradient looks like CSS gradient | no displacement/noise term | `webgl.md` §6: 2-octave noise + uTime |
| Liquid metal looks like grey soup | no palette ramp / no specular | §4: metallic ramp + derivative-based highlights |
| Copied repo code breaks on minify | unknown transitive deps | §7 rule 2: dependency-free check first |
