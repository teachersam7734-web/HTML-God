# Post-processing, cheaper fakes, non-WebGL VFX, and the licences of shader sources

Sources: `domain-3d-shaders-glsl-webgl.md` in the HTML-Sensei build project's research notes (not shipped) sections 2, 7, 8, `lane-3d-summary.md`,
`lib/ledger.mjs`, SENSEI-LOG.

## The post stack (from `examples/particles.html`)

```js
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.5, 0.5, 0.25);    // strength, radius, threshold
composer.addPass(bloom);
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: .0025 }, uGrain: { value: .025 } },
  vertexShader: VS, fragmentShader: `
  uniform sampler2D tDiffuse; uniform float uTime, uCA, uGrain; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){ vec2 c = vUv - .5; float r2 = dot(c, c); vec2 o = c * uCA * (1. + r2*4.);
    vec3 col = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);   // chromatic aberration
    col += (h(vUv*1000. + fract(uTime)*91.) - .5) * uGrain;                                                       // grain, seeded by time
    col *= 1. - smoothstep(.25, .85, length(c)) * .65;                                                           // vignette
    gl_FragColor = vec4(col, 1.); }` }));
composer.addPass(new OutputPass());          // last: tone mapping and sRGB; without it the image is dark and washed
// resize: composer.setPixelRatio(d); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
```

Measured: the subset with EffectComposer, RenderPass, UnrealBloomPass, ShaderPass and OutputPass is 553,300 bytes,
7 KB over the plain subset (lane). Values found while fixing a white-out (lane): per-point gain 0.6, bloom strength
0.5, radius 0.5, threshold 0.25, grain 0.025 (grain at 0.06 dominated the image).

Advice from a 2026 three.js article (plausible, not measured here): bloom at half resolution can roughly double the
frame rate when fill-rate bound; fold chromatic aberration, grain and vignette into one pass (done above); keep
full-screen passes few on mobile; typical bloom 0.5 to 2.0 strength, 0.8 to 1.0 threshold with HDR input, radius 0.5
to 1.0. `postprocessing` (pmndrs, Zlib) merges effects into fewer passes and adds selective bloom; bundle it for a
single file; not tested here.

Grain must be deterministic for capture: seed it with `fract(uTime)`; for a still, `uTime = 0`.

## Cheaper fakes (no composer, nothing in the loop)

1. A second `Points` pass of the same geometry with large soft sprites and a tiny gain (Save The Damsel, and
   `sensei-holograms`' `points-holo.html`).
2. CSS `filter: blur() brightness()` on a duplicate canvas layer with `mix-blend-mode: screen`.
3. A CSS `drop-shadow` on a still.

## VFX without WebGL (route here first; not tested in this skill)

CSS `mix-blend-mode`, `backdrop-filter`, `filter: drop-shadow`, `mask-image` gradients, SVG `feTurbulence` with
`feDisplacementMap` (heat haze, glitch), `clip-path` animation, `@property` animated gradients. Cheaper than WebGL
for overlays on a lesson page, and one media query turns them off for reduced motion. Use WebGL only when the effect
needs per-pixel maths or 3D. Owners: `sensei-motion-ui`, `sensei-landing-hero`.

## Libraries and their licences

| Item | For | Licence | In a single file | Verdict |
|---|---|---|---|---|
| three `ShaderMaterial`, `Points`, `EffectComposer` and passes | shaders on meshes, particles, bloom | MIT | yes, bundled | core |
| Raw WebGL2 | backgrounds, raymarching, parallax | your code | yes, a few KB | core for backgrounds |
| `postprocessing` (pmndrs) | merged effects, selective bloom | Zlib | after bundling | situational |
| `three-custom-shader-material` | patch a standard material's shader | MIT | after bundling | situational |
| OGL | minimal WebGL library | Unlicense | yes | when three is too much |
| twgl.js | WebGL helpers | MIT | yes | reference only |
| glslify | GLSL modules at build time | MIT | output is plain GLSL | situational |
| **lygia** | large GLSL function library | **Prosperity (non-commercial) or a paid Patron licence**; some files carry their own | include resolver needed | **ideas only**: the `guard-licence` hook blocks its include path and code anywhere |
| **Shadertoy shaders** | examples | **CC BY-NC-SA 3.0 by default** unless the author states otherwise (secondary sources; the terms page returned 403 to the lane) | port by hand only with a stated permissive licence | **ideas only**: blocked by `guard-licence` when a Shadertoy link sits next to code |
| iquilezles.org | SDFs, smooth min, noise, palettes | algorithm code MIT per his homepage; artwork code copyrighted | copy the function with its notice | core as reference, notice kept |
| The Book of Shaders | learning | believed CC BY-NC-SA (not checked) | n/a | reference only |
| Ashima webgl-noise, Gustavson simplex | classic noise | believed MIT (from memory, not checked) | copy with notice after checking | check before use |

In a commercial profile (`licence_mode: "commercial"`), `guard-licence` also blocks code carrying a CC BY-NC or
Prosperity licence text; in a personal profile it warns.
