# WebGL: when hand-rolled isn't enough

three.js inlined + post-processing turns a single file into a 3D music video. Arabian Nights did
exactly this: chase-cam flight over procedural dunes, instanced city, cloth-simulated carpet,
6000-point audio-reactive starfield, UnrealBloom: zero network dependencies, 14.6 MB total.

---

## §1 · When to pay for three.js

| Signal | Verdict |
|---|---|
| Solid geometry, lighting, shadows, camera movement | yes |
| Post-processing (bloom, DOF, film grain pass) | yes |
| Thousands of instanced objects | yes (InstancedMesh) |
| "3D-feeling" particles and wireframes | no: `canvas-2d.md` §3 for 50 lines |

## §2 · The inline pipeline

1. Download once, never at runtime: `three.min.js` (r128: 589 KB, measured 2026-10-27) +
   `UnrealBloomPass.js`, `EffectComposer.js`, `RenderPass.js`, `ShaderPass.js`,
   `CopyShader.js`, `LuminosityHighPassShader.js` (r128: about 23 KB unminified, 15 KB minified,
   measured; minify them, but they are small). These classic `examples/js` files exist up to
   r147 only: three.js removed `examples/js` in r148, so newer versions are ES modules and go
   through the bundle route (`media-embedding.md` §7).
2. Order matters: three.js first, then shaders, then passes, then your scene.
3. Anchors: `<!--__THREE__-->` before the blob, `/*__SCENE__*/` before your scene code.
4. Use `scripts/inline_three.py`: it fetches, minifies, injects at the sentinel, checks each blob
   landed once, and reports the weight (information, not a budget).
5. Verify: `typeof THREE !== 'undefined'` and one bloom frame renders *before* building the scene.
   (Verified 2026-10-27: r128 core + bloom inlined by the script, opened over file:// in Chrome,
   one `composer.render()` with no error. Firefox and Safari not verified.)

Pin a version you have tested. "Latest three" on npm changes APIs; r128-era
`new THREE.WebGLRenderer({antialias:true, canvas})` + `EffectComposer` is a stable, well-documented
combination.

## §3 · Scene skeleton (proven in Arabian Nights)

```js
const renderer = new THREE.WebGLRenderer({canvas: document.getElementById('gl'), antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a24, 0.0016);          // fog = depth for cheap
const cam = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .1, 3000);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, cam));
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.5, 0.2);
composer.addPass(bloom);

// dunes: one PlaneGeometry, vertex-displaced in JS, gradient vertex colors
// city: THREE.InstancedMesh of dome/cylinder geometry, 100s of instances
// carpet: PlaneGeometry, per-vertex sine ripple each frame = cloth feel
// stars: THREE.Points with a PointsMaterial, positions jittered by bass each frame

const clock = new THREE.Clock(); let t = 0;
function tick(){ requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1); t += dt;    // delta clock, one loop for everything
  const { bass } = bands();                               // audio-reactive.md §2: {bass, mid, treble}
  carpet.position.y = Math.sin(t*3)*.2*bass;              // audio-reactive lift (the mesh, not its geometry)
  bloom.strength = 0.7 + bass * 0.9;                      // bloom pumps with the beat
  stars.rotation.y += (0.03 + bass * 0.18) * dt;          // per second, not per frame
  composer.render();
}
```

## §4 · Performance rules

- One RAF loop for the whole scene; all animation reads time from it, none run their own loop.
- Reuse geometries/materials; `InstancedMesh` for repeats (cities, trees): not per-object meshes.
- Fog sells depth for free; distant objects fade before the camera far-plane cost bites.
- DPR clamp at 2; `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Never cut counts, shadows or bloom by screen size or an assumed device class. Judge on the target
  device: if the target is a phone, design and measure for it there; numbers taken on this machine
  (often software GL) are relative. What could not be checked on the target is named in the hand-off.
- Pause the loop when the tab is hidden; handle `webglcontextlost` / `webglcontextrestored`.
- `prefers-reduced-motion`: static camera, no ripple, no bloom pumping.
- Dispose on route-exit if the scene is route-scoped (`geometry.dispose()`, `material.dispose()`).

## §5 · Scene choreography (from Arabian Nights' SCENES array)

Timeline-scene changes = an array of `{t, name, pal, fog, hue, sun, sky}` entries; each frame finds
the current entry and lerps palette/fog/hue towards it. Scenes change on musical time, not wall time
(see `audio-reactive.md` §3). This array *is* the direction of the piece: write it like a film
treatment, one row per "shot".

## §6 · Custom shaders (the threejs-pro pattern)

When a look needs GPU work (liquid, displacement, noise fields), add a `ShaderMaterial`: this is
the one place a lifted *technique* (from Shadertoy, study-only, re-derived) belongs in a single
file:

```js
const mat = new THREE.ShaderMaterial({
  uniforms: { uTime:{value:0}, uBass:{value:0}, uHue:{value:0.12} },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
    gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform float uTime,uBass; varying vec2 vUv;
    // 2-octave value noise: compact, adequate for dunes/liquid shimmer
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    void main(){ float n = noise(vUv*6. + uTime*.1) + .5*noise(vUv*12. - uTime*.2);
      vec3 col = mix(vec3(.05,.03,.1), vec3(1.,.72,.3), n*.8 + uBass*.4);
      gl_FragColor = vec4(col,1.); }`
});
// per frame: mat.uniforms.uTime.value = t; mat.uniforms.uBass.value = bands().bass;
```

Rules: keep shaders ≤ 60 lines (they live in template literals: no tooling protects them);
uniforms for every externally-driven value (`uTime`, `uBass`, `uHue`) so the audio/scene clocks
stay the only clocks; measure on the target device (fragment shaders are fill-rate-bound). If the
target cannot hold frame rate, lowering resolution is a quality decision to make with the user,
not a silent default. Deeper shader craft and licences: `html-sensei:sensei-shaders-vfx`.

## §7 · The library ecosystem behind the 2026 look

react-three-fiber (React renderer for three), shadergradient (animated gradient planes),
liquid-glass-js (WebGL refraction glass) and paper-design/shaders (zero-dep vanilla shaders,
Apache-2.0, including the liquid-metal engine behind liquid-logo), what each one actually is,
when its code may enter a single file, and how to re-derive its effect in vanilla:
**`library-ecosystem.md`**. §6 above is the door-A target for shadergradient; the two-doors rule
(port the technique vs bundle via esbuild) lives there in §0.

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| `THREE is not defined` | passes loaded before core, or minified blob broken | §2 order; verify `typeof THREE` first |
| Bloom makes everything white | strength too high with additive materials | start 0.6 to 0.9, threshold 0.15 to 0.3 |
| Stutter on phones | per-object meshes / full DPR | §4 instancing + DPR clamp; measure on the target phone; any quality cut is agreed with the user |
| Scene looks flat | no fog, no vertex colour variance | fog + per-vertex gradients |
| Post pass doubles memory | composer created per resize | create once; `setSize` on resize |
| Black canvas after sleep or a driver reset | WebGL context lost, never restored | listen for `webglcontextlost` (preventDefault) and rebuild on `webglcontextrestored` |
