// build_html.mjs: one offline HTML player for a GLB. Bundles three and its loaders into one IIFE (esbuild), inlines
// the GLB (and, for Draco, the decoder-only wrapper and wasm) as base64 in inert text/plain scripts.
//
//   node build_html.mjs <model.glb> <codec: draco|meshopt|none> <out.html> [title] [alt text]
//
// Run from the work folder that holds node_modules (three 0.186.1, esbuild 0.28.2; see package.json here).
// TEMPLATE overrides the template path (default: template.html next to this file).
// verified: Windows 10, Node 24, three 0.186.1, esbuild 0.28.2: Draco and Meshopt pages built from the demo GLBs and
//           passed test-web.mjs (load from file:// with the network blocked, clock advancing, non-blank frame).
// not verified: GLBs with KTX2 textures (the Basis transcoder would need the same inline treatment as Draco);
//               models above about 5 MB (base64 parse cost; ship the GLB beside the page instead).
// Adapted from blender-demo/web/build_html.mjs in the HTML-Sensei build project's research notes (not shipped) (run there); paths are now resolved from the
// work folder and this file's folder, nothing machine-specific. Original code of this project.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [glb, codec = 'none', out = 'model.html', title = 'Model', alt] = process.argv.slice(2);
if (!glb || !['draco', 'meshopt', 'none'].includes(codec)) {
  console.error('usage: node build_html.mjs <model.glb> <draco|meshopt|none> <out.html> [title] [alt text]');
  process.exit(2);
}
const req = createRequire(path.join(process.cwd(), 'noop.js'));
const pkgDir = name => { let d = path.dirname(req.resolve(name)); while (!existsSync(path.join(d, 'package.json')) || JSON.parse(readFileSync(path.join(d, 'package.json'), 'utf8')).name !== name) d = path.dirname(d); return d; };
const { build } = await import(pathToFileURL(req.resolve('esbuild')).href);
const threeDir = pkgDir('three');

const r = await build({
  entryPoints: [path.join(HERE, 'entry.js')], bundle: true, minify: true, format: 'iife', globalName: 'GLBDEMO', write: false, target: 'es2020',
  nodePaths: [path.join(process.cwd(), 'node_modules')],
  // DRACOLoader computes default decoder URLs with new URL(rel, import.meta.url) at module load; an IIFE has no
  // import.meta, so without this define the bundle throws "Failed to construct 'URL'" and GLBDEMO is never created.
  define: { 'import.meta.url': '"https://invalid.local/x.js"' },
  legalComments: 'eof',
});
let bundle = r.outputFiles[0].text;
// inline <script> text must never contain a closing tag or an HTML comment opener
bundle = bundle.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const b64 = f => readFileSync(f).toString('base64');
let dracoTags = '';
if (codec === 'draco') {
  const d = path.join(threeDir, 'examples', 'jsm', 'libs', 'draco', 'gltf');   // decoder only: 58 KB wrapper + 192 KB wasm
  dracoTags = `<script type="text/plain" id="draco-wrapper">${b64(path.join(d, 'draco_wasm_wrapper.js'))}</script>\n<script type="text/plain" id="draco-wasm">${b64(path.join(d, 'draco_decoder.wasm'))}</script>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let html = readFileSync(process.env.TEMPLATE || path.join(HERE, 'template.html'), 'utf8');
html = html.replace(/<!--[\s\S]*?-->\n/, '')                               // drop the template's own header comment
  .replaceAll('__TITLE__', esc(title)).replaceAll('__ALT__', esc(alt || 'Animated 3D model: ' + title)).replace('__CODEC__', codec)
  .replace('__DRACO_TAGS__', () => dracoTags).replace('__GLB_B64__', () => b64(glb)).replace('__BUNDLE__', () => bundle);
writeFileSync(out, html);
console.log(JSON.stringify({ out, kb: Math.round(html.length / 1024), bundle_kb: Math.round(bundle.length / 1024), glb_kb: Math.round(readFileSync(glb).length / 1024), codec }));
