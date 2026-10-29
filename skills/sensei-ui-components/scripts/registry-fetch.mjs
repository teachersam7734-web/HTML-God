// registry-fetch.mjs: fetch one shadcn-format registry item (a component published as JSON with its files inline) into
// a USER PROJECT, write its files verbatim with the source's copyright notice added as a header comment, and add a row
// to the project's licence ledger (.sensei/licences.json). HTML-Sensei's own code; it carries no component source.
//
//   node registry-fetch.mjs <item-url-or-json-file> --out <project folder for the files> --notice <notice template>
//        [--project DIR] [--id ledger-id] [--licence "MIT + Commons Clause"] [--use fetched|ported] [--dry-run]
//
// It refuses to write into a plugin (any folder under a .claude-plugin root): sources such as React Bits may be used in
// a project but never redistributed (the plugin's licence guard blocks the same thing at write time).
//
// The notice template is a text file with placeholders {{title}}, {{name}}, {{url}}, {{date}}, {{file}}; each file gets
// it as a comment in that file's own syntax (/* */ for js, jsx, ts, tsx, css, glsl; <!-- --> for html, svg). The
// registry's own text is not changed: porting to vanilla happens after, in a separate file that keeps the same notice.
//
// verified: Windows 10, Node 24: a local fixture item (this skill's fixtures/registry-item.json) written with headers
//           and a ledger row; a live item fetched over https into a scratch project (files, headers, dependencies
//           listed, ledger row valid); refusal when --out is inside the plugin.
// not verified: items whose files use other types (registry:hook, registry:lib) beyond writing them as files;
//           registryDependencies are listed, not fetched (fetch each the same way).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const valued = ['--out', '--notice', '--project', '--id', '--licence', '--use'];
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && valued.includes(args[i - 1])));
const src = pos[0], outDir = opt('--out'), noticeFile = opt('--notice');
if (!src || !outDir || !noticeFile) {
  console.error('usage: node registry-fetch.mjs <item-url-or-json> --out DIR --notice TEMPLATE [--project DIR] [--id ID] [--licence TEXT] [--use fetched|ported] [--dry-run]');
  process.exit(2);
}
const dry = args.includes('--dry-run');
const project = path.resolve(opt('--project') || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const out = path.resolve(project, outDir);

// Plugin guard: the same test the licence hook uses (a .claude-plugin folder above the target).
const lib = p => pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../lib', p)).href;
let pluginRootOf = null, addRow = null;
try { ({ pluginRootOf } = await import(lib('lint/licence.mjs'))); } catch { /* outside the plugin tree */ }
try { ({ addRow } = await import(lib('ledger.mjs'))); } catch { /* ledger written below without validation */ }
const inPlugin = d => { if (pluginRootOf) return pluginRootOf(path.join(d, 'x')); for (let x = d; ; x = path.dirname(x)) { if (fs.existsSync(path.join(x, '.claude-plugin'))) return x; if (x === path.dirname(x)) return null; } };
const root = inPlugin(out);
if (root) { console.error(`refused: ${out} is inside a plugin (${root}). Fetch components into a user project only.`); process.exit(3); }

// Read the item.
let item, url = src;
if (/^https?:\/\//i.test(src)) {
  const res = await fetch(src, { headers: { accept: 'application/json' } });
  if (!res.ok) { console.error(`fetch failed: ${res.status} ${res.statusText} for ${src}`); process.exit(1); }
  item = await res.json();
} else { item = JSON.parse(fs.readFileSync(path.resolve(src), 'utf8')); url = pathToFileURL(path.resolve(src)).href; }
if (!item || !Array.isArray(item.files) || !item.files.length) { console.error('not a registry item: no files[]'); process.exit(1); }

const tpl = fs.readFileSync(path.resolve(noticeFile), 'utf8').trim();
const date = new Date().toISOString().slice(0, 10);
const fill = file => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => ({ title: item.title || item.name, name: item.name, url, date, file }[k] ?? m));
const commentFor = (file, text) => {
  const ext = path.extname(file).toLowerCase();
  if (['.html', '.htm', '.svg', '.xml', '.vue'].includes(ext)) return `<!--\n${text.replace(/--/g, '- -')}\n-->\n`;
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.css', '.scss', '.glsl', '.frag', '.vert'].includes(ext)) return `/*!\n${text.replace(/\*\//g, '* /').split('\n').map(l => ' * ' + l).join('\n')}\n */\n`;
  return null;
};

const written = [];
for (const f of item.files) {
  const name = path.basename(f.path || f.target || 'file');
  const dest = path.join(out, name);
  if (!path.resolve(dest).startsWith(out)) { console.error(`refused: ${name} escapes ${out}`); process.exit(1); }
  const c = commentFor(name, fill(name));
  if (!c) console.warn(`warning: no comment syntax for ${name}; add the notice beside it (NOTICE file) by hand`);
  const body = (c || '') + String(f.content ?? '');
  if (!dry) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(dest, body); }
  written.push(path.relative(project, dest).split(path.sep).join('/'));
}

const deps = [...(item.dependencies || []), ...(item.devDependencies || [])];
const row = { id: opt('--id') || String(item.name || 'item').toLowerCase(), name: item.title || item.name, url,
  licence: opt('--licence') || 'see the source licence file (record it here)', use: opt('--use') || 'fetched', files: written,
  notice: 'header', ships_in_plugin: false, note: deps.length ? 'npm dependencies: ' + deps.join(', ') : undefined };
let problems = [];
if (!dry) {
  if (addRow) problems = addRow(project, row);
  else { const f = path.join(project, '.sensei', 'licences.json'); let l = { rows: [] }; try { l = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {} l.rows = (l.rows || []).filter(r => r.id !== row.id).concat([{ added: date, ...row }]); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(l, null, 2) + '\n'); }
}

console.log(`${dry ? '(dry run) would write' : 'wrote'} ${written.length} file(s) from ${item.title || item.name}:`);
for (const w of written) console.log('  ' + w);
// Registries declare caret ranges (^3.13.0); save the exact version that installs, so the project does not drift.
console.log(deps.length ? `install its dependencies with exact versions saved: npm i -E ${deps.join(' ')}` : 'no npm dependencies declared (check its imports: react and peers are not listed)');
if ((item.registryDependencies || []).length) console.log('registry dependencies to fetch the same way: ' + item.registryDependencies.join(', '));
console.log(`ledger row ${row.id}: ${dry ? 'not written (dry run)' : 'written'}${problems.length ? '; problems: ' + problems.join('; ') : ''}`);
