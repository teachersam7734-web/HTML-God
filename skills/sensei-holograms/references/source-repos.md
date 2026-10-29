# The owner's five hologram repos: what each is, what to take, what never to take

Sources: `repo-threejs-vanilla-holographic-material.md` in the HTML-Sensei build project's research notes (not shipped), `repo-threejs-holographic-material.md`,
`repo-holographic-shader-visualizer-three-js.md`, `repo-Three.js-Extras.md`, `repo-hologram-particles.md`,
`lane-3d-summary.md`. All five were cloned shallow, read in full, and deleted; the two cheap ones were also run.

Only the two ektogamat repos carry a licence file (MIT). The other three have none, so their code is all rights
reserved: ideas only, re-implemented in this skill's own code. The `guard-licence` hook blocks code that arrives with
an origin from those three (`lib/ledger.mjs`, ids `holographic-shader-visualizer`, `threejs-extras`,
`hologram-particles`).

| Repo | Licence | Verdict | Take | Never take |
|---|---|---|---|---|
| ektogamat/threejs-vanilla-holographic-material | MIT (2023) | reference only | the 30-line mental model: fresnel rim, scanlines, flicker, additive | its vertex shader (transpose multiply), the Star Wars helmet, the EXR and skybox |
| ektogamat/threejs-holographic-material (React Three Fiber) | MIT (2023) | reference only | declarative post with multisampling, as an idea | the same shader and bug; the `useMemo` rebuild per prop; CC-BY Star Wars GLBs |
| YasirAwan4831/holographic-shader-visualizer-three.Js | none (README badge says MIT, no file) | ideas only | the sweep swap between two meshes; clean teardown in one effect; a params file with presets | any code (also an uncredited copy of a course exercise) |
| BOXNYC/Three.js-Extras | none | ideas only | video hologram on a plane; pivot at the feet; Y-only billboard; silhouette shadow from the same video | any code; the dance clip with no rights |
| cortiz2894/hologram-particles | none | ideas only | surface-sampled particles, wrapped diffuse on dots, spring-damper pointer physics in compute, morph by one progress value | any code; the BB-8 and droid GLBs; presenting the igloo.inc design as new work |

## ektogamat vanilla material: what the shader does, and its traps

Fragment-only effect on a pass-through vertex shader: base colour with alpha mixed from brightness and the mesh's
`uv.y` (so the fade depends on the UV layout); scanlines from a sine of **screen-space** y (they do not ride the
model); a tiny hash noise on the scanlines; fresnel as `clamp(amount - dot(view, normal) * k, 0, opacity)`; a blink
from `fract(cos(t) * 43758.5)` clamped to a floor; additive, `depthTest: false`, transparent.

Traps, found by reading and running:

1. **World position and normal by `vec4(x, 1.0) * modelMatrix`**: the transpose multiply. Translation is dropped and
   rotation inverted, so the view vector and the fresnel are wrong on any moved or turned mesh. A mesh at the origin
   looks right, so the demo hides it. This skill's `examples/transpose-test.html` measures it.
2. Screen-space scanlines slide over a moving model.
3. `smoothstep(1.3 * cos(...), 0.78, 0.9)` can have edge0 above edge1: undefined by the GLSL spec.
4. On current three: `Clock` deprecation warning and one `setValues` warning per unknown option key
   (`hologramColor`, `blendMode`, ...), because the constructor passes options straight through.
5. Wall-clock time: not seekable.
6. Additive plus transparent plus no depth test draws back faces over front faces and blooms to white once a strong
   bloom is added; on a transparent canvas additive needs premultiplied alpha.
7. The demo renderer is set up for its post stack (`antialias: false`, `depth: false`, pixel ratio 1): copying it
   without the composer gives a low-resolution canvas with no depth.
8. The README table lists `enableBlinking` twice and documents `enableAdditive`, which the vanilla class does not read.
9. No reduced motion, no context loss, a lil-gui panel always visible.
10. "Random flicker per frame" clamped to the full range is not safe against flashing limits by default.

## The R3F twin

Same shader, character for character, so the same bugs. Extra lessons: the material is rebuilt on every prop change
(a recompile per slider move: use uniforms and refs); `extend` is called during render; a transparent hologram that
writes depth hides its own back faces; drei's Draco decoder defaults to a CDN; Create React App is unmaintained and
its pinned fiber and react majors do not mix with current ones.

## The HOLO.SYS sweep repo

Ideas worth re-implementing (done in `examples/sweep.html`): one progress uniform swaps two meshes by discarding the
old below the sweep line and the new above it; a glitch slab from a smoothed product of sines; fresnel faded by a
`smoothstep` of itself so the rim does not end hard; full teardown including `forceContextLoss`.

Its bugs: the same random value displaces x and z (the glitch only moves along the diagonal); sweep bounds from the
un-rotated box compared with world y of a rotating mesh (the line ends early or late and flashes the whole shape);
reversed `smoothstep` edges in two places; three material clones never disposed; per-change allocations; ACES tone
mapping at exposure 1.2 compressing the additive colours so the picked hue is not the shown hue.

## Three.js-Extras (video holograms)

Ideas (in `references/hologram-recipes.md`): a keyed or alpha-packed video on a plane; the plane's pivot at the
performer's feet (translate the geometry by half its height); a Y-only billboard
`rotation.y = atan2(cam.x - obj.x, cam.z - obj.z)` that keeps the figure upright; a silhouette shadow made from the
same video drawn again flat and skewed with black output and the keyed alpha; a soft key from distance times a gain.

Traps: written as pre-class prototypes (`THREE.ShaderMaterial.call(this)`), which throws on modern three;
`THREE.Math`, `PlaneBufferGeometry` and `type: 't'` uniforms are gone; no colour management (set
`colorSpace = SRGBColorSpace` on the `VideoTexture`); plain RGB-distance keying with no despill gives green fringes,
worse with H.264 4:2:0 chroma; `depthTest: false` needs manual `renderOrder` with several holograms.

## hologram-particles (WebGPU, TSL, compute)

How it works: normalise the GLB (centre, 3 units tall, on y = 0); `MeshSurfaceSampler` per mesh picks N points by
triangle area with world normals; one `InstancedMesh` of a 20-triangle sphere; a TSL node material whose position is
the instance centre mixed towards a morph target, plus wobble, masked fractal noise and a physics offset; colour from
a two-light wrapped diffuse blending the figure's normal with each sphere's own normal ("volume strength"), plus a
glow that rises with displacement; physics in a compute pass on storage buffers (offset, velocity, hold timer): a
cursor "pusher" cylinder expels particles, a spring and damper return them, a cylinder wall clamps them; a morph runs
in three phases from one progress value; node bloom and chromatic aberration.

Traps: no adapter means a silent fall back to WebGL2, where compute behaves differently, and the repo has no
detection, no still and no message; `renderAsync` and `computeAsync` deprecated; WebGPU allows 8 vertex buffers per
pipeline (the author hashed the rest position instead of a seed attribute); `Math.random` scatter at load makes it
unseekable; no reduced motion, no context loss, no visibility pause; Stats and leva ship in the main component; the
whole renderer is rebuilt on a count change.

This skill's `examples/points-holo.html` is the WebGL default route for the same look (seeded sampler, wrapped
diffuse on dots, analytic pointer push, fake bloom); the TSL and WebGPU route is `sensei-3d`'s opt-in tier.
