// Bundle entry (export only what the page uses; tree-shaking is the whole size win). Build: node ../scripts/build-vendor.mjs vendor entry-troika.js
// verified: three 0.186.1 + esbuild 0.28.2 on Windows 10, see the page that loads it. Copied from code-3d/entry-troika.js in the HTML-Sensei build project's research notes (not shipped).
export { WebGLRenderer, Scene, PerspectiveCamera, Color } from 'three';
export { Text, configureTextBuilder, preloadFont } from 'troika-three-text';
