# GLSL building blocks and conventions

Sources: `domain-3d-shaders-glsl-webgl.md` in the HTML-Sensei build project's research notes (not shipped) sections 3 to 6 and 9, SENSEI-LOG, and the pages in
this skill. Every function here is written from the standard definitions for this project (the maths is not
copyrightable; someone's exact text is). Nothing is pasted from lygia, Shadertoy or the Book of Shaders.

## Raw WebGL2 skeleton (from `examples/raymarch.html`)

```js
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
if (!gl) { showStillFallback(); return; }                     // getContext can return null
function init() {                                             // everything the GPU holds; called again after a restore
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x);
    if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle covers the screen
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; stopLoop(); });
canvas.addEventListener('webglcontextrestored', () => { lost = false; init(); size(); restart(); });
```

Resize with a render scale (fill rate is the limit for raymarching and fbm):

```js
function size() { const d = Math.min(devicePixelRatio || 1, 2) * scale;
  c.width = Math.max(2, c.clientWidth * d | 0); c.height = Math.max(2, c.clientHeight * d | 0); gl.viewport(0, 0, c.width, c.height); }
```

## Conventions that avoid trouble

- `#version 300 es` must be the very first line: start the template literal with the backtick directly before it.
- `precision highp float;` (mediump halves precision and breaks large fbm domains on mobile).
- Constant loop bounds with an early `break`: portable and faster than a uniform bound.
- Raw WebGL has no colour management: apply gamma once, to the final colour, and author dark values in linear terms
  (a background of 0.04 came out washed grey after the gamma step, in the lane's raymarch and again in this skill's
  dissolve). In three, a plain `ShaderMaterial` converts nothing unless you add `#include <colorspace_fragment>`
  (128 stays 128; 188 with the chunk). Write the colour-space decision in a comment at the top of each fragment shader.
- `smoothstep(a, b, x)` with `a >= b` is undefined: write `1.0 - smoothstep(b, a, x)`.
- `vec4 * mat4` is the transpose multiply: always `matrix * vector`.
- `fract(sin(x) * 43758.5453)` loses precision at large arguments and differs between GPUs: fine for decoration,
  not for anything that must match across devices. Keep arguments small or use a polynomial hash like the ones below.
- Use WebGL2 for new work; decide once per raw page. three emits GLSL 3 for `ShaderMaterial` itself.
- First use of a program compiles synchronously: compile during a loading moment (`renderer.compileAsync` in three).

## Noise and SDF vocabulary

```glsl
float hash(vec3 p){ p = fract(p*.3183099 + .1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.02 + 7.1; a *= .5; } return s; }
float smin(float a, float b, float k){ float h = max(k - abs(a-b), 0.)/k; return min(a, b) - h*h*k*.25; }
```

A 2D polynomial hash for backgrounds (`reactive-bg.html`, `dissolve.html`):
`p = fract(p * vec2(.1031, .1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x);`

Domain warping (`reactive-bg.html`): `q = vec2(fbm(p + a*t), fbm(p + offset - b*t)); f = fbm(p + 2.2*q)`.

SDFs (standard maths): sphere `length(p) - r`; box `length(max(abs(p) - b, 0.)) + min(max(abs(p).x - b.x,
max(abs(p).y - b.y, abs(p).z - b.z)), 0.)`; torus; capsule. Operations: union `min`, subtraction `max(a, -b)`,
intersection `max`, smooth union `smin`, repetition `mod(p + .5*c, c) - .5*c`, twist and bend by rotating `p` by a
function of its own coordinates. When copying a primitive from iquilezles.org, keep the MIT notice his homepage
states for algorithm code (artwork code there is not MIT; check each page).

## Raymarching

64 steps, step `d * .9` (fbm in `map` breaks the distance bound, so shorten the step), stop at `d < .002` or
`t > 8`, normal by central differences (`e = .002`), fresnel rim from the normal. Cost: pixels times steps times the
cost of `map` (two spheres plus five fbm octaves here): that is why it has the governor and a render scale.

## Parallax occlusion (from `examples/parallax.html`)

```glsl
uv = (uv - .5) * uFit + .5;                                     // cover-fit: crop, never stretch
const int N = 24; vec2 dir = -uOff * uStr; vec2 p = uv; float layer = 1. / float(N), cur = 0.;
float d = texture(uDepth, p).r;
for (int i = 0; i < N; i++){ if (cur >= d) break; p += dir * layer; d = texture(uDepth, p).r; cur += layer; }
```

`uOff` in -1..1 from the pointer or tilt, eased in JS; `uStr` about 0.06. Artefacts seen: a faint ghost of a near
object at depth discontinuities (stair-stepping from a coarse N) and edge smear; mitigate with more steps, a dilated
depth map, or less travel. A CSS layer stack with `translate3d` is the no-WebGL alternative for light cases.

## Curl-noise particles (from `examples/particles.html`)

```glsl
vec3 pot(vec3 p){ return vec3(gn(p), gn(p + vec3(31.4,17.1,5.3)), gn(p + vec3(11.2,43.7,29.9))); }   // gn: 3D gradient noise
vec3 curl(vec3 p){ const float e = .1; vec3 dx = vec3(e,0,0), dy = vec3(0,e,0), dz = vec3(0,0,e);
  vec3 px0 = pot(p-dx), px1 = pot(p+dx), py0 = pot(p-dy), py1 = pot(p+dy), pz0 = pot(p-dz), pz1 = pot(p+dz);
  return vec3(py1.z-py0.z-pz1.y+pz0.y, pz1.x-pz0.x-px1.z+px0.z, px1.y-px0.y-py1.x+py0.x)/(2.*e); }
// p = position + curl(position*.7 + t*.5) * .55;   gl_PointSize = uPx * (2.2 + 3.*aRnd) * (6. / -mv.z);
```

The curl of a potential field is divergence-free: particles swirl without clumping or draining. The displacement is
recomputed from `t` each frame (seekable, no state); its limit is that particles never travel far. True trajectories
need GPU ping-pong (`GPUComputationRenderer`, three addon, MIT; not tested here) or WebGPU compute. Seeds come from an
LCG over the index, never `Math.random`. Fragment: soft disc `pow(1. - 2.*r, 1.6) * vA * uGain`, additive, no depth
write. `InstancedMesh` of low-poly spheres when particles need volume and light (20 triangles each).

## Inputs from JS (SENSEI-LOG)

- Ease every input with `x += (target - x) * (1 - pow(k, dt))`: the same feel at 30, 60 or 120 Hz.
- Integrate rates in JS and pass the sum: `drift += speed * dt`. A shader computing `speed * t` jumps the whole
  picture when `speed` changes (measured in `reactive-bg.html`: 90.83 per cent of pixels jumped; 0 with the integral).
- Writing a CSS custom property on `:root` every frame restyles the whole document: write on the effect element, and
  only when the rounded value changes.
- iOS tilt: `DeviceOrientationEvent.requestPermission()` from a gesture (ride the first tap).
