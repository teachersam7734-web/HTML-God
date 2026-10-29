// Bundle entry for points-holo.html: three core plus MeshSurfaceSampler (three addon, MIT).
// Build: node ../../sensei-3d/scripts/build-vendor.mjs vendor entry-points.js
// verified: three 0.186.1 + esbuild 0.28.2 on Windows 10 (points-holo.html passed gate3d.mjs). Original code of this project.
export { WebGLRenderer, Scene, PerspectiveCamera, ShaderMaterial, Points, Mesh, BufferGeometry, Float32BufferAttribute, TorusKnotGeometry, Color, Vector3, AdditiveBlending } from 'three';
export { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
