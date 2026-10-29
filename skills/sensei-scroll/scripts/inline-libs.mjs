#!/usr/bin/env node
// inline-libs.mjs: inline pinned library files from a project's node_modules into one offline HTML file, keeping or
// adding each licence notice, and print the ledger rows to add to .sensei/licences.json.
//
//   node inline-libs.mjs template.html out.html [--from DIR ...]
//
// In the template, mark each file with an empty element whose data-inline names a package path:
//   <style data-inline="lenis/dist/lenis.css"></style>
//   <script data-inline="lenis/dist/lenis.min.js"></script>
//   <script data-inline="gsap/dist/gsap.min.js"></script>
//   <script data-inline="gsap/dist/ScrollTrigger.min.js"></script>
// Packages are found in node_modules walking up from each --from DIR, the template's folder and the current folder
// (LIBS_DIR env adds one more). Nothing is downloaded: install the pinned versions first, for example
//   npm i -D lenis@1.3.27 gsap@3.15.0
// Refuses a file that contains "</script" (it would end the inline block early). A file with no notice in its first
// 600 characters (lenis.min.js ships none) gets one built from its package.json and LICENSE. Exit 1 on any missing
// package or refused file.
//
// verified: Windows 10, Node 24: built ../examples/scroll-libs.html with lenis 1.3.27 and gsap 3.15.0 (Lenis notice
//           added, GSAP headers kept); the result ran in strict file:// (../scripts/test-libs.mjs).
// not verified: macOS and Linux paths (written for them, not run there); packages other than lenis and gsap.
// HTML-Sensei's own code.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const froms = []; const pos = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--from') froms.push(args[++i]); else pos.push(args[i]); }
const [tpl, out] = pos;
if (!tpl || !out) { console.error('usage: node inline-libs.mjs template.html out.html [--from DIR ...]'); process.exit(2); }

const starts = [...froms, process.env.LIBS_DIR, path.dirname(path.resolve(tpl)), process.cwd()].filter(Boolean);
function findPkg(name) {
  for (const s of starts) {
    let d = path.resolve(s);
    for (;;) { const c = path.join(d, 'node_modules', name); if (fs.existsSync(path.join(c, 'package.json'))) return c; const up = path.dirname(d); if (up === d) break; d = up; }
  }
  return null;
}
const pkgName = spec => spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

const rows = new Map(); let errors = 0;
const html = fs.readFileSync(tpl, 'utf8').replace(/<(script|style)\b([^>]*)\bdata-inline="([^"]+)"([^>]*)>\s*<\/\1>/g, (all, tag, a, spec, b) => {
  const name = pkgName(spec), dir = findPkg(name);
  if (!dir) { console.error(`missing package ${name} (for ${spec}): npm i -D ${name}@<pinned version>`); errors++; return all; }
  const file = path.join(dir, spec.slice(name.length + 1));
  if (!fs.existsSync(file)) { console.error(`missing file ${file}`); errors++; return all; }
  let body = fs.readFileSync(file, 'utf8').replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n');
  if (tag === 'script' && /<\/script/i.test(body)) { console.error(`refused ${spec}: it contains "</script"`); errors++; return all; }
  const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const licFile = fs.readdirSync(dir).find(f => /^licen[cs]e/i.test(f));
  const holder = licFile ? (fs.readFileSync(path.join(dir, licFile), 'utf8').match(/copyright[^\n]*/i) || [''])[0].trim() : '';
  if (!/@license|licen[cs]e|copyright|\(c\)|©/i.test(body.slice(0, 600))) {
    body = `/*! ${pj.name} ${pj.version} | ${pj.license || 'see package'} | ${holder || 'see the package LICENSE'} | notice added by inline-libs.mjs */\n` + body;
  }
  rows.set(pj.name, { id: pj.name, name: pj.name, url: `https://www.npmjs.com/package/${pj.name}/v/${pj.version}`,
    licence: pj.license || 'see package', use: 'vendored', files: [...((rows.get(pj.name) || {}).files || []), spec],
    notice: holder || 'kept from the file header', ships_in_plugin: false, added: new Date().toISOString().slice(0, 10), note: `pinned ${pj.version}` });
  console.log(`inlined ${spec} (${pj.name} ${pj.version}, ${(body.length / 1024).toFixed(1)} KB)`);
  return `<${tag}${a}${b}>\n${body}\n</${tag}>`;
});
if (errors) process.exit(1);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out}\nledger rows for .sensei/licences.json:\n${JSON.stringify([...rows.values()], null, 2)}`);
