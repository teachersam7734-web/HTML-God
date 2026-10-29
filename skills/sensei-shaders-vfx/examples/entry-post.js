// Bundle entry for particles.html. Build: node ../../sensei-3d/scripts/build-vendor.mjs vendor entry-post.js
// verified: three 0.186.1 + esbuild 0.28.2 on Windows 10 (particles.html passed gate3d.mjs). Copied from code-3d/entry-post.js in the HTML-Sensei build project's research notes (not shipped).
export { WebGLRenderer, Scene, PerspectiveCamera, ShaderMaterial, Mesh, Points, BufferGeometry, Float32BufferAttribute, Color, Vector2, AdditiveBlending, DoubleSide, TorusKnotGeometry, HalfFloatType } from 'three';
export { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
export { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
export { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
export { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
