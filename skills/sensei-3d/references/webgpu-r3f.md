# WebGPU tier, TSL, and React Three Fiber

Sources: `domain-3d-holograms-vfx.md` in the HTML-Sensei build project's research notes (not shipped) sections 8 and 9, `repo-hologram-particles.md`,
`repo-threejs-holographic-material.md`, SENSEI-LOG, and the runs for this skill.

## WebGPU: an opt-in tier, never the base

- three's `WebGPURenderer` uses WebGPU when an adapter exists and otherwise a WebGL2 backend (`forceWebGL: true`
  forces it). Here `navigator.gpu` exists but `requestAdapter()` returns null, so only the fallback could run
  (`examples/gpu-tier.html`; console: "No available adapters", "WebGPU is not available, running under WebGL2
  backend").
- **A hand-written `ShaderMaterial` does not render under `WebGPURenderer`**, even with `forceWebGL`: console
  `THREE.NodeBuilder: Material "ShaderMaterial" is not compatible.` and a black frame (lane, reconfirmed for this
  skill). Adopting WebGPU means rewriting every GLSL material as TSL node materials.
- Current API shape (three 0.186.1): `import { WebGPURenderer, MeshBasicNodeMaterial } from 'three/webgpu'`,
  node functions from `three/tsl`; `await renderer.init()` before the first `render()`. `renderAsync` and
  `computeAsync` are deprecated and warn.
- Read the real backend from `renderer.backend.isWebGPUBackend` (constructor names are minified).
- The built-in TSL `time` node is not seekable: drive time from your own `uniform(0)` and set `.value`.
- WebGPU pipelines allow 8 vertex buffers: instanced attributes use slots fast (hash the rest position instead of a
  seed attribute; from the hologram-particles repo's own comment).
- Browser support (third-party summaries, January 2026, not checked against MDN): Chrome and Edge since 113, Safari
  26, Firefox 141 on Windows and 145 on macOS. MDN lists WebGPU as limited availability and secure-context only.
- Bundle: `three/webgpu` plus `three/tsl` subset 904,340 bytes here (WebGL subset about 536 KB).
- Compute particles with storage buffers are the one thing WebGL2 cannot match cleanly (transform feedback is the
  workable WebGL2 equivalent for simple simulations). HyperFrames capture uses software GL, so WebGPU is unavailable
  in film renders.

The TSL fresnel-plus-scanline material (from `gpu-tier.html`):

```js
const uT = uniform(0);
const V = normalize(cameraPosition.sub(positionWorld));
const fres = pow(float(1).sub(abs(dot(V, normalWorld))), 2.6);
const scan = sin(positionWorld.y.mul(90).sub(uT.mul(6))).mul(.5).add(.5);
const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
m.colorNode = color('#35d8ff').mul(fres.mul(1.7).add(.22)).mul(pow(scan, 3).mul(.65).add(.35));
```

Gate for a WebGPU page: the capability probe, the fallback branch (still or WebGL tier), the reduced-motion branch, a
non-blank frame and zero errors under each backend that can run, and "WebGPU backend not verified here" in the report
unless a device with an adapter ran it.

## React Three Fiber and drei: only inside an existing React project

Worth it when the host project is already React or Next: declarative scene graph, `useFrame`, `useGLTF` (Draco and
meshopt wired), `Environment`, `Text`, `Html`, `ScrollControls`, `PerformanceMonitor`, postprocessing wrappers.

Not worth a build step for a single file: a minimal R3F app measured 1,154 KB minified (319 KB gzip) against about
536 KB for vanilla three; a bundler is mandatory; each fiber major pairs with one react major; and drei helpers fetch
from CDNs (`Environment preset=` downloads an HDR, the default `useGLTF` Draco path is a CDN). If you must use drei
offline: pass your own `files` to `Environment`, set the Draco decoder path, and run the no-network gate.

Patterns to avoid, seen in the owner's R3F hologram repo: rebuilding the material with `useMemo` on every prop change
(a shader recompile per slider move: use uniforms and refs); `extend` called during render; a transparent hologram
left writing depth (it hides its own back faces); Create React App (unmaintained).

The profile decides: `react: true` in `.sensei/profile.json` (or `@react-three/fiber` in the project's
`package.json`) allows the R3F route; otherwise write vanilla three.
