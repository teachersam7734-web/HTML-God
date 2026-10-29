// Bundle entry for gpu-tier.html (the optional WebGPU tier). Build: node ../scripts/build-vendor.mjs vendor entry-gpu.js
// It assigns window.G itself (no export), so build-vendor.mjs gives it no global name.
// verified: three 0.186.1 + esbuild 0.28.2 on Windows 10, WebGL2 fallback backend only (no WebGPU adapter here).
// Adapted from code-3d/entry-gpu.js in the HTML-Sensei build project's research notes (not shipped) (adds uniform, for a seekable time).
import { WebGPURenderer, Scene, PerspectiveCamera, Mesh, TorusKnotGeometry, MeshBasicNodeMaterial, AdditiveBlending, DoubleSide } from 'three/webgpu';
import { color, sin, uniform, normalWorld, cameraPosition, positionWorld, normalize, dot, pow, abs, float, max } from 'three/tsl';
window.G = { WebGPURenderer, Scene, PerspectiveCamera, Mesh, TorusKnotGeometry, MeshBasicNodeMaterial, AdditiveBlending, DoubleSide,
  tsl: { color, sin, uniform, normalWorld, cameraPosition, positionWorld, normalize, dot, pow, abs, float, max } };
