// vendor-inline.mjs: inline pinned animation libraries (GSAP and its plugins, Motion, anything with a UMD build) from
// the project's node_modules into a page, keeping each library's licence header, adding the package's licence text
// where the file carries none (Motion's UMD has no banner), and reporting the versions for the licence ledger.
// HTML-Sensei's own code; it ships no library.
//
//   node vendor-inline.mjs page.src.html out.html [--project DIR] [--ledger]
//
// In the page, one marker per file, in load order (core before plugins):
//   <!-- sensei-vendor: gsap/dist/gsap.min.js -->
//   <!-- sensei-vendor: gsap/dist/ScrollTrigger.min.js -->
//   <!-- sensei-vendor: motion/dist/motion.js -->
// Each becomes <script data-vendor="pkg@version">...</script>. A marker whose package is missing stops the build
// (nothing written). --ledger adds one row per package to <project>/.sensei/licences.json.
//
// verified: Windows 10, Node 24: gsap 3.15.0 (header kept) and motion 14.6.0 (MIT text added) inlined into
//           examples/engines.src.html; the output ran from strict file:// in Chrome 156 (test-motion-ui.mjs); ledger rows
//           valid under lib/ledger.mjs check.
// not verified: packages whose UMD file contains "</script" (escaped, but not met in a real library here).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--project');
if (pos.length < 2) { console.error('usage: node vendor-inline.mjs page.src.html out.html [--project DIR] [--ledger]'); process.exit(2); }
const [src, out] = pos.map(p => path.resolve(p));
const project = path.resolve(opt('--project') || process.env.CLAUDE_PROJECT_DIR || process.cwd());

function findPkg(name) {
  for (const base of [project, path.dirname(src)]) for (let d = base; ; d = path.dirname(d)) {
    const pj = path.join(d, 'node_modules', name, 'package.json');
    if (fs.existsSync(pj)) return path.dirname(pj);
    if (d === path.dirname(d)) break;
  }
  return null;
}

let html = fs.readFileSync(src, 'utf8');
const used = new Map(); const problems = [];
html = html.replace(/<!--\s*sensei-vendor:\s*([^\s]+)\s*-->/g, (m, spec) => {
  const parts = spec.split('/'); const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const rel = parts.slice(name.startsWith('@') ? 2 : 1).join('/');
  const dir = findPkg(name);
  if (!dir) { problems.push(`${name} is not installed (npm i -E ${name})`); return m; }
  const file = path.join(dir, rel);
  if (!fs.existsSync(file)) { problems.push(`${spec} not found in ${dir}`); return m; }
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  let code = fs.readFileSync(file, 'utf8');
  const head = code.slice(0, 1500);
  if (!/\/\*!|@license/i.test(head)) {
    const lic = ['LICENSE.md', 'LICENSE', 'LICENSE.txt', 'license'].map(f => path.join(dir, f)).find(f => fs.existsSync(f));
    const text = lic ? fs.readFileSync(lic, 'utf8').trim().replace(/\*\//g, '* /') : `licence: ${pkg.license}`;
    code = `/*! ${name} ${pkg.version} (${rel}) | ${pkg.license} | inlined by HTML-Sensei vendor-inline.mjs\n${text}\n*/\n` + code;
  }
  code = code.replace(/<\/script/gi, '<\\/script');
  used.set(name, { version: pkg.version, license: pkg.license, files: [...(used.get(name)?.files || []), rel] });
  return `<script data-vendor="${name}@${pkg.version}">\n${code}\n</script>`;
});
if (problems.length) { for (const p of problems) console.error('refused: ' + p); process.exit(1); }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, information, not a budget)`);
for (const [n, u] of used) console.log(`  ${n}@${u.version}  ${u.license}  ${u.files.join(', ')}  (pin it: npm i -E ${n}@${u.version})`);

if (args.includes('--ledger') && used.size) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const { addRow } = await import(pathToFileURL(path.resolve(here, '../../../lib/ledger.mjs')).href);
  for (const [n, u] of used) {
    const errs = addRow(project, { id: n, name: n, url: `https://www.npmjs.com/package/${n}/v/${u.version}`, licence: u.license, use: 'vendored',
      files: [path.relative(project, out).split(path.sep).join('/')], notice: 'header', note: `version ${u.version}: ${u.files.join(', ')}` });
    console.log(`  ledger row ${n}${errs.length ? ': ' + errs.join('; ') : ''}`);
  }
}
