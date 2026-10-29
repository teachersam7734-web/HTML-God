# Hologram recipes in depth: inputs, tuning, Save The Damsel's build

Sources: `domain-3d-holograms-vfx.md` in the HTML-Sensei build project's research notes (not shipped) sections 4 to 7, `domain-3d-assets-pipeline.md` sections 5
and 6, `repo-Three.js-Extras.md`, SENSEI-LOG (game agent round 2, video agent part 2, design-fix phase 1).

## 1. Material hologram: tuning notes (from building `holo.html`)

- With additive blending on a dark page, an interior brightness of 0.12 looked dead and 0.22 read as a solid
  hologram; fresnel gain 1.7 makes the rim. Choose values against the real page background; bloom amplifies them.
- `side: DoubleSide` plus `depthWrite: false` plus additive shows back faces through front faces: that is the look.
  For an opaque-looking hologram use `FrontSide` and a depth pre-pass (draw the mesh once with `colorWrite: false`).
- Colour space is a decision: a plain `ShaderMaterial` does no conversion (`vec3(0.5)` read back as 128); with
  `#include <colorspace_fragment>` it read 188 (tested by the lane). Add `#include <tonemapping_fragment>` too if the
  material should obey `renderer.toneMapping`. Do not mix materials with and without the includes in one scene. State
  the decision in a comment at the top of the fragment shader.
- Displacing two axes needs two decorrelated hashes, or the motion collapses to a diagonal.
- Normals: `mat3(modelMatrix) * normal` is exact for uniform scale only; with non-uniform scale use the inverse
  transpose of the model matrix.
- A transparent canvas with additive output: either premultiplied alpha (`max(rgb)` as alpha, as here), or, for a
  film where the cloud saturates, an opaque black canvas and CSS `mix-blend-mode: screen` (SENSEI-LOG).

## 2. Depth-image hologram: making the two images

1. **Cut-out without ML** (SENSEI-LOG, `holo/cut.py` in the owner's Ultra Bookworm project (not shipped) in the project): OpenCV GrabCut with a hand-seeded MASK, not
   a rectangle. Border strip and obvious scenery as sure background, face, chest and armour core as sure foreground, a
   loose polygon as probable foreground; 10 iterations; then the largest component, `binary_fill_holes`, an opening,
   and a 1.2 px feather. Clean on the first try on a busy battlefield painting.
2. **Depth without ML**: `.68 * sqrt(EDT / max) + .20 * relief + .12 * head dome`, where relief is blurred high-pass
   luminance, gated to zero near the silhouette. Inflation alone flattens the head (hair widens the silhouette there):
   the soft dome fixes it. Output at 640 by 800: RGBA WebP 91 KB (alpha = matte), depth WebP 15 KB.
3. **Depth with ML**: a monocular depth model (Depth Anything family, MiDaS) gives better depth, run once offline in
   Python; ship only the greyscale WebP. Not run here.
4. Make both images from the same source frame and resize them identically.
5. Check at the sway extremes: stretched edges mean the depth edge is too sharp; blur the depth a little, discard a
   one-pixel border at the matte edge, clamp displacement near it.
6. **Fade the slab by steepness**: fading by `|dot(N, V)|` fades the walls turned away; the stretched walls that read
   as a slab face the camera. Fade by the relief's own steepness (model-space normal z from the depth gradient) and
   clamp the yaw to about 22 degrees. Test at the sway extremes by warping time (wrap `requestAnimationFrame` and
   `performance.now` in an init script with an offset pushed from the test) (SENSEI-LOG).
7. Fresnel on normals from a noisy depth map turns the figure into a glowing rock: keep fresnel an accent (`pow` 3.2)
   and drive the tint from luminance (`pow(lum, 1.3)`) so the face reads (SENSEI-LOG).
8. Reveal from the feet: `1.0 - smoothstep(0.0, 0.06, vUv.y - uReveal)`; uv.y is 0 at the feet. Writing
   `1.0 - uReveal` gave a 5 per cent sliver (lane).

Save The Damsel's build, for scale (SENSEI-LOG): 82,000 points (every second pixel) plus a 200 by 250 displaced skin
with fresnel, scanlines, flicker, chromatic split (red and blue sampled at plus and minus a uv offset), glitch slices
(row bands jumping on hashed time), materialise from the disc; the emitter disc and an open cylinder light cone as
their own shaders; bloom faked with a second Points pass of huge gaussian sprites at gain 0.03; the point list baked
in Python as base64 in a synchronous script (no texture load at render time). In the film version, 51,000 points
with a reveal front, glitch bands, scanlines, a gold rim, the disc, the cone and rising motes.

## 3. Video hologram: making the packed MP4

Colour on the left half, matte as greyscale on the right half, one ordinary H.264 file:

```bash
ffmpeg -i colour.mp4 -i matte.mp4 -filter_complex "[1]format=gray,format=yuv420p[m];[0][m]hstack=2,format=yuv420p" \
  -c:v libx264 -crf 20 -movflags +faststart packed.mp4
```

Test clip used by the lane and this skill (a moving disc, 2 s, 512 by 256, 25 KB):

```bash
ffmpeg -y -f lavfi -i "color=c=0x1a8fff:s=256x256:d=2:r=30,format=rgb24" -f lavfi -i "color=c=black:s=256x256:d=2:r=30" \
 -filter_complex "[0]geq=r='if(lt(hypot(X-128+40*sin(T*3),Y-128),70),255,20)':g='if(lt(hypot(X-128+40*sin(T*3),Y-128),70),200,230)':b='if(lt(hypot(X-128+40*sin(T*3),Y-128),70),60,40)'[c];\
 [1]geq=lum='if(lt(hypot(X-128+40*sin(T*3),Y-128),70),255,0)':cb=128:cr=128[m];[c][m]hstack=2,format=yuv420p" \
 -c:v libx264 -crf 20 -movflags +faststart packed.mp4
```

Real footage: shoot on a plain background, or make the matte with a background-removal model offline (RVM or a
segmentation model; not run here). Encode at CRF 20 to 24, 720 tall at most, 24 or 30 fps, faststart, no audio track
unless needed. A 10 s loop at 720 by 1280 packed (so 1440 by 1280) is a few MB: embed only if the user accepts the
weight, otherwise ship beside the page and say the deliverable is no longer one file.

Alternatives to the pack: WebM VP9 with alpha (Chrome and Firefox), HEVC with alpha in a MOV (Safari only). The
alpha-packed H.264 is the portable choice.

Chroma key (only when the footage cannot be packed): alpha from the distance to the key colour times a gain (soft
edge), then despill (clamp green to the larger of red and blue), and erode the matte by a pixel; expect a green halo
on hair and fast motion from H.264 chroma subsampling.

Staging a video hologram in a scene (ideas from Three.js-Extras, re-implemented as needed): pivot the plane at the
feet; Y-only billboard so the figure stays upright; a silhouette shadow from the same video texture drawn flat and
skewed with black output and the matte as alpha; set `renderOrder` by hand when several transparent planes overlap.

Playback rules: `muted`, `playsInline`, `loop`; sound only after a gesture; for embedded bytes, a Blob URL (reliable
seeking, and never `src=""`, which resolves to the page and loads the HTML as media); pause the video on teardown and
on route change (a `<video>` removed from the DOM keeps playing its sound); for capture, `pause()`, set
`currentTime`, wait for `seeked`, then a short settle before drawing.

## 4. Particle hologram: knobs

- Count by tier (60,000, 25,000, 8,000 as starting points); gain per point falls with count: about 1 over the square
  root of N as a first guess. 60,000 additive points at alpha 0.35 with a strong bloom blew out to white in the lane's
  test; the fix was gain, not fewer points.
- `gl_PointSize` is in device pixels and capped by many GPUs (often 64 or 256): multiply by the pixel ratio.
- Bake sampled positions and normals into a base64 `Float32Array` for first paint under a second; seed any sampler.
- Instanced spheres (20 triangles each) when dots need volume and lighting; `Points` when glow is enough.
- True trajectories need state: GPU ping-pong (`GPUComputationRenderer`, not tested here) or WebGPU compute.
- Morph between two models: sample both with the same count, store the second as an attribute, mix by one progress
  uniform (as the reference repo does, in three phases: deform out, morph, reform).
