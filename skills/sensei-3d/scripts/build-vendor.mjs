// build-vendor.mjs: bundle a three.js subset (and loaders, post, troika, WebGPU) into classic-script IIFE files that
// a single offline HTML page can inline. Node port of the 3D lane's build-bundles.sh (code-3d in the HTML-Sensei build project's research notes (not shipped)).
//
//   cd <a work folder>                     (holds node_modules; nothing here is shipped)
//   npm i three@0.186.1 esbuild@0.28.2 troika-three-text@0.52.5 --no-audit --no-fund
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-3d/scripts/build-vendor.mjs <outDir> <entry.js> [more entries]
//
// Each entry-NAME.js becomes <outDir>/t-NAME.js with the global T (an entry that assigns its own window global, like
// entry-gpu.js, simply runs). import.meta.url is always defined: recent DRACOLoader and troika read it at module load
// and an IIFE has none, so without the define the bundle throws "Failed to construct 'URL'" and T is never created.
// esbuild keeps the libraries' @license comments in a trailing "Bundled license information" block: keep it.
// The output is refused if it contains "</script" or "<!--" (it could not be inlined safely).
//
// verified: Windows 10, Node 24, three 0.186.1, esbuild 0.28.2, troika-three-text 0.52.5: built every entry in
//           sensei-3d/examples, sensei-holograms/examples and sensei-shaders-vfx/examples; sizes as in
//           references/single-file-three.md; the pages that load them passed gate3d.mjs.
// not verified: other three versions (pin the exact version and rerun the gates after any upgrade); macOS, Linux.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [, , outDir, ...entries] = process.argv;
if (!outDir || !entries.length) { console.error('usage: node build-vendor.mjs <outDir> <entry-NAME.js> [...]   (run where node_modules holds three and esbuild)'); process.exit(2); }
let esbuild;
try { esbuild = createRequire(path.join(process.cwd(), 'noop.js'))('esbuild'); }
catch { console.error('esbuild not found from ' + process.cwd() + ': npm i esbuild@0.28.2 three@0.186.1 there first'); process.exit(2); }
const req = createRequire(path.join(process.cwd(), 'noop.js'));
try { const pj = path.join(path.dirname(req.resolve('three')), '..', 'package.json'); console.log('three', JSON.parse(fs.readFileSync(pj, 'utf8')).version); } catch { /* version print only */ }
fs.mkdirSync(outDir, { recursive: true });
let bad = 0;
for (const e of entries) {
  const name = path.basename(e).replace(/^entry-/, '').replace(/\.m?js$/, '');
  const src = fs.readFileSync(e, 'utf8');
  const ownGlobal = !/^\s*export\s/m.test(src);              // an entry that writes window.X itself
  const r = await esbuild.build({
    entryPoints: [path.resolve(e)], absWorkingDir: process.cwd(), nodePaths: [path.join(process.cwd(), 'node_modules')],
    bundle: true, minify: true, format: 'iife', write: false, target: 'es2020',
    ...(ownGlobal ? {} : { globalName: 'T' }),
    define: { 'import.meta.url': '"https://invalid.local/x/"' },
  });
  const code = r.outputFiles[0].text;
  if (/<\/script/i.test(code) || /<!--/.test(code)) { console.error(`REFUSE ${name}: output contains "</script" or "<!--"`); bad++; continue; }
  const out = path.join(outDir, `t-${name}.js`); fs.writeFileSync(out, code);
  console.log(`${out}  ${(code.length / 1024).toFixed(0)} KB${/Bundled license information/.test(code) ? '' : '  (WARN: no licence block found)'}`);
}
process.exit(bad ? 1 : 0);
