// tailwind-one-file.mjs: compile Tailwind for ONE page and put the CSS inside that page, so the page needs no CDN and no
// stylesheet beside it. HTML-Sensei's own code.
//
//   node tailwind-one-file.mjs page.src.html out.html [--css theme.css] [--project DIR] [--no-minify]
//
// The page marks where the CSS goes with  <style data-tailwind></style>  (or a <link data-tailwind ...>). Without a
// marker the CSS goes at the end of <head>. Only classes used in this page are generated: the input CSS is
//   @import "tailwindcss" source(none); @source "<page>";
// plus your own --css file (its @theme, @layer and @utility rules) appended. A Tailwind CDN script in the page is
// removed and reported: it breaks offline use and the plugin's no-CDN rule.
//
// Needs Node at build time only, and the Tailwind CLI in the project:  npm i -D tailwindcss @tailwindcss/cli
// (found in DIR/node_modules, then up from the page, then env TAILWIND_CLI pointing at @tailwindcss/cli).
//
// verified: Windows 10, Node 24, tailwindcss and @tailwindcss/cli 4.3.3: a fixture page with logical, rtl:, dark:,
//           hover: and arbitrary-value classes; compiled CSS inlined; the page passed sensei-gate in strict file://;
//           the CDN script removed; unused classes absent from the output.
// not verified: Tailwind 3 (its CLI and config differ: tailwind.config.js content globs, @tailwind directives);
//           plugins such as daisyUI through this script (compile them the same way, then check the output).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--css', '--project'].includes(args[i - 1])));
if (pos.length < 2) { console.error('usage: node tailwind-one-file.mjs page.src.html out.html [--css theme.css] [--project DIR] [--no-minify]'); process.exit(2); }
const src = path.resolve(pos[0]), out = path.resolve(pos[1]);
const project = path.resolve(opt('--project', process.env.CLAUDE_PROJECT_DIR || process.cwd()));
const extraCss = opt('--css'); const minify = !args.includes('--no-minify');

function findCli() {
  if (process.env.TAILWIND_CLI) {
    const p = process.env.TAILWIND_CLI; const f = fs.statSync(p).isDirectory() ? path.join(p, 'dist', 'index.mjs') : p;
    if (fs.existsSync(f)) return f;
  }
  for (let d = project; ; d = path.dirname(d)) { const f = path.join(d, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'); if (fs.existsSync(f)) return f; if (d === path.dirname(d)) break; }
  for (let d = path.dirname(src); ; d = path.dirname(d)) { const f = path.join(d, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'); if (fs.existsSync(f)) return f; if (d === path.dirname(d)) break; }
  return null;
}
const cli = findCli();
if (!cli) { console.error('Tailwind CLI not found. In the project: npm i -D tailwindcss @tailwindcss/cli (or set TAILWIND_CLI).'); process.exit(2); }
// The input CSS must sit where "tailwindcss" resolves: next to the CLI's own node_modules.
const nodeModules = path.resolve(cli, '..', '..', '..', '..');
const work = fs.mkdtempSync(path.join(path.dirname(nodeModules), '.tw-'));
const fwd = p => p.split(path.sep).join('/');

let html = fs.readFileSync(src, 'utf8');
const notes = [];
const cdn = /<script\b[^>]*\bsrc=["'][^"']*(?:cdn\.tailwindcss\.com|@tailwindcss\/browser)[^"']*["'][^>]*>\s*<\/script>\s*/gi;
if (cdn.test(html)) { html = html.replace(cdn, ''); notes.push('removed the Tailwind CDN script (it breaks offline use)'); }

// Scan the page as it will ship (CDN script gone), from a copy in the work folder.
const scan = path.join(work, 'page.html'); fs.writeFileSync(scan, html);
let input = `@import "tailwindcss" source(none);\n@source "${fwd(scan)}";\n`;
if (extraCss) input += '\n' + fs.readFileSync(path.resolve(extraCss), 'utf8') + '\n';
const inFile = path.join(work, 'in.css'), outFile = path.join(work, 'out.css');
fs.writeFileSync(inFile, input);

const r = spawnSync(process.execPath, [cli, '-i', inFile, '-o', outFile, ...(minify ? ['--minify'] : [])], { encoding: 'utf8', cwd: work });
if (r.status !== 0 || !fs.existsSync(outFile)) {
  console.error('Tailwind failed:\n' + (r.stderr || r.stdout)); fs.rmSync(work, { recursive: true, force: true }); process.exit(1);
}
let css = fs.readFileSync(outFile, 'utf8').replace(/<\/style/gi, '<\\/style');
fs.rmSync(work, { recursive: true, force: true });

const block = `<style data-tailwind>\n${css}\n</style>`;
const marker = /<style\b[^>]*\bdata-tailwind\b[^>]*>[\s\S]*?<\/style>|<link\b[^>]*\bdata-tailwind\b[^>]*>/i;
if (marker.test(html)) html = html.replace(marker, () => block);
else if (/<\/head>/i.test(html)) { html = html.replace(/<\/head>/i, () => block + '\n</head>'); notes.push('no data-tailwind marker: CSS placed at the end of <head>'); }
else { console.error('no <head> and no data-tailwind marker: nowhere to put the CSS'); process.exit(1); }

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
const header = (css.match(/^\/\*![^*]*\*\//) || [''])[0];
console.log(`wrote ${out}: ${Buffer.byteLength(css)} bytes of CSS inlined (information, not a budget)`);
console.log(header ? `licence header kept: ${header.slice(0, 60)}` : 'note: no /*! */ licence header in the output; add Tailwind\'s MIT notice and a ledger row');
for (const n of notes) console.log('note: ' + n);
