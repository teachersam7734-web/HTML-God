// pack-data.mjs: write binary files (GLB, decoder wasm, fonts, MP4) as base64 strings in one classic script that
// defines a global, so a page can carry them with no fetch. Generalises the one-line node -e step of the 3D lane's
// build-bundles.sh (code-3d in the HTML-Sensei build project's research notes (not shipped)).
//
//   node pack-data.mjs <out.js> <GLOBAL> key=file [key=file ...]
//   node pack-data.mjs glbdata.js GLB meshopt=meshopt.glb draco=draco.glb dracoWasm=<three>/examples/jsm/libs/draco/gltf/draco_decoder.wasm dracoWrap=<three>/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js
//
// Base64 costs a third on top of the bytes, and the page holds the string and the decoded buffer at once. Above about
// 5 MB per model, ship the file beside the page instead (repo-three-gltf-loading-and-model-viewer.md, trap 6).
// For a page that is not 3D on first paint, put the same strings in inert <script type="text/plain" id=...> blocks
// and decode on demand instead of defining a global at load.
//
// verified: Windows 10, Node 24: produced glbdata.js, fontdata.js and vdata.js for the examples; the pages decoded them.
// not verified: very large inputs (no streaming; the whole file is read into memory).
import fs from 'node:fs';

const [, , out, name, ...pairs] = process.argv;
if (!out || !name || !pairs.length) { console.error('usage: node pack-data.mjs <out.js> <GLOBAL> key=file [...]'); process.exit(2); }
const parts = pairs.map(p => { const i = p.indexOf('='); const k = p.slice(0, i), f = p.slice(i + 1); const b = fs.readFileSync(f);
  console.log(`${k}: ${f} ${b.length} bytes -> ${Math.ceil(b.length / 3) * 4} base64 chars`); return `${JSON.stringify(k)}:"${b.toString('base64')}"`; });
fs.writeFileSync(out, `window.${name}={${parts.join(',')}};\n`);
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
