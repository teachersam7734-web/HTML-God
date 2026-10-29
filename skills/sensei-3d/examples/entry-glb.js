// Bundle entry (export only what the page uses; tree-shaking is the whole size win). Build: node ../scripts/build-vendor.mjs vendor entry-glb.js
// verified: three 0.186.1 + esbuild 0.28.2 on Windows 10, see the page that loads it. Copied from code-3d/entry-glb.js in the HTML-Sensei build project's research notes (not shipped), plus Box3 and Vector3 for the framing guard.
export { WebGLRenderer, Scene, PerspectiveCamera, LoadingManager, MeshNormalMaterial, DirectionalLight, AmbientLight, Box3, Vector3 } from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
