// verified: Windows 10, Node 24 (3D lane, then again here): inlined t-min.js into holo.html and the sensei-3d
//           starter; refused a bundle containing "</script"; the single files passed gate3d.mjs.
// not verified: pages whose <script src> carries extra attributes after src in unusual orders (regex, not a parser).
// Copied from code-3d/inline3d.mjs in the HTML-Sensei build project's research notes (not shipped) (original code of this project).
// inline3d.mjs: turn a page that references local <script src> files into ONE offline HTML file.
// usage: node inline3d.mjs page.html out.html
// Refuses (exit 1) if a vendored file contains "</script" or "<!--" (the HTML parser would end or escape the script block).
// Warns if the vendored file carries no licence text (esbuild keeps a trailing 'Bundled license information' comment; keep it).
import fs from 'node:fs'; import path from 'node:path';
const [,, inFile, outFile] = process.argv; const base = path.dirname(path.resolve(inFile));
let html = fs.readFileSync(inFile, 'utf8'); let bad = 0; const report = [];
html = html.replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)><\/script>/g, (m, a, src, b) => {
  if (/^(https?:)?\/\//.test(src)) { console.error('REFUSE external script: ' + src); bad++; return m; }
  const file = path.resolve(base, src); let code = fs.readFileSync(file, 'utf8');
  if (/<\/script/i.test(code)) { console.error(`REFUSE ${src}: contains "</script"`); bad++; return m; }
  if (/<!--/.test(code)) { console.error(`REFUSE ${src}: contains "<!--"`); bad++; return m; }
  if (!/@license|Bundled license|^\s*(\/\*!|\/\*\*|\/\/)/.test(code)) console.error(`WARN ${src}: no licence text found (esbuild keeps a trailing 'Bundled license information' block); add a banner`);
  report.push(`${src}: ${(code.length / 1024).toFixed(0)} KB`);
  return `<script${a}${b}>\n${code}\n</script>`;
});
if (bad) process.exit(1);
fs.writeFileSync(outFile, html); console.log(report.join('\n') + `\n-> ${outFile} ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
