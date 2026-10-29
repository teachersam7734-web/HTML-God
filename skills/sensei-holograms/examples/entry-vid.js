// Bundle entry. Build: node ../../sensei-3d/scripts/build-vendor.mjs vendor entry-vid.js
// verified: three 0.186.1 + esbuild 0.28.2 on Windows 10, see the pages that load it. Copied from code-3d/entry-vid.js in the HTML-Sensei build project's research notes (not shipped).
export { WebGLRenderer, Scene, PerspectiveCamera, ShaderMaterial, Mesh, PlaneGeometry, VideoTexture, SRGBColorSpace, LinearFilter, Color, NormalBlending, CustomBlending, OneFactor, OneMinusSrcAlphaFactor } from 'three';
