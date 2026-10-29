#!/usr/bin/env node
// build-single.mjs: assemble ONE offline HTML file from a template and a manifest of slots. The pattern of Ultra
// Bookworm's build.py and of the HTML-Master build helper, in plain Node with no dependencies, with every guard both
// of them learned the hard way.
//
//   node build-single.mjs build.json [--out file.html] [--check]
//
// build.json (paths relative to the manifest's folder; nothing outside it is read):
//   { "template": "template.html", "out": "dist/course.html",
//     "slots": {
//       "CSS":     { "path": "style.css",        "kind": "css" },         <style>/*__CSS__*/</style>         escapes </style
//       "APP":     { "path": "app.js",           "kind": "js" },          <script>/*__APP__*/</script>       escapes </script and <!--
//       "LESSONS": { "path": "lessons.json",     "kind": "json" },        <script type="application/json">   parsed, re-serialised, < as <
//       "LOGO":    { "path": "logo.webp",        "kind": "data-url" },    src="/*__LOGO__*/"
//       "FILM":    { "path": "film.mp4",         "kind": "base64", "optional": true },   <script type="application/x-film">  inert text
//       "THREE":   { "path": "vendor/three.js",  "kind": "inert-js" },    <script type="text/x-three">       REFUSED if it holds </script or <!--
//       "NOTE":    { "path": "notice.txt",       "kind": "text" },
//       "FONTS":   { "kind": "fonts", "faces": [ { "family": "Read", "path": "fonts/inter-400.woff2", "weight": 400 },
//                                               { "family": "Read", "path": "fonts/inter-600.woff2", "weight": 600 } ] } } }
// Tokens in the template: /*__NAME__*/ (safe in CSS, JS and attribute values), <!--__NAME__--> or {{NAME}}.
//
// Refusals (exit 1, nothing written): a slot whose token is not in the template; a missing file (unless "optional",
// which writes an empty slot, as Ultra Bookworm does for a film that has not been delivered yet); a path outside the
// manifest's folder; inert-js text holding </script or <!--; any placeholder left after substitution (one nobody
// replaced does not raise, it ships as a broken src); a JSON slot that does not parse.
// Warnings: an inert payload over 1 MB placed BEFORE an executable script (it delays that script); an executable script
// that waits for DOMContentLoaded or load while over 1 MB of inert payload follows it (DOMContentLoaded waits for the
// parser to reach the end of the file: boot directly instead); <meta charset> not in the first 1024 bytes.
// Fonts: grouped by CONTENT hash per family, so a variable font listed at several weights is embedded once with a
// weight range (Ultra Bookworm saved about 300 KB this way). List woff2 only.
// --check validates everything and writes nothing (parallel agents can check without racing for the output file).
// Replacement is split/join, never String.replace with a string, so "$&" or "$1" inside code is never interpreted.
//
// verified: Windows 10, Node 24, by test-build-single.mjs (the example builds, every refusal fires, both warnings fire on
//           a bad template, the built file passes sensei-verify's gate in strict file://, and the good order boots
//           before DOMContentLoaded while the bad order does not; numbers in the test output).
// not verified: macOS and Linux; payloads above the sizes in the test (see references/embedding-forms.md for 200 MB).
// Original HTML-Sensei code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.json': 'application/json' };
const MB = 1048576;
const PLACEHOLDER = /\/\*__([A-Z0-9_]+)__\*\/|<!--__([A-Z0-9_]+)__-->|\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

export function build(manifestPath, { out, check = false } = {}) {
  const root = path.dirname(path.resolve(manifestPath));
  const errors = [], warnings = [], sizes = {};
  const inside = rel => {
    const f = path.resolve(root, rel);
    if (f !== root && !f.startsWith(root + path.sep)) throw new Error(`path escapes the project folder: ${rel}`);
    return f;
  };
  let man;
  try { man = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return { errors: [`manifest: ${e.message}`], warnings, sizes }; }
  let html;
  try { html = fs.readFileSync(inside(man.template), 'utf8').replace(/^\uFEFF/, ''); } catch (e) { return { errors: [`template: ${e.message}`], warnings, sizes }; }
  const tokens = name => [`/*__${name}__*/`, `<!--__${name}__-->`, `{{${name}}}`, `{{ ${name} }}`].filter(t => html.includes(t));

  const embed = (name, s) => {
    const kind = s.kind;
    if (kind === 'fonts') return fontCss(s.faces || []);
    const f = inside(s.path);
    if (!fs.existsSync(f)) { if (s.optional) { warnings.push(`${name}: ${s.path} not found, slot left empty (optional)`); return ''; } throw new Error(`missing file ${s.path}`); }
    const buf = fs.readFileSync(f);
    switch (kind) {
      case 'css': return buf.toString('utf8').replace(/^\uFEFF/, '').replace(/<\/(style)/gi, '<\\/$1');
      case 'js': return buf.toString('utf8').replace(/^\uFEFF/, '').replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
      case 'json': return JSON.stringify(JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, ''))).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
      case 'text': return buf.toString('utf8');
      case 'data-url': return `data:${s.mime || MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'};base64,${buf.toString('base64')}`;
      case 'base64': return buf.toString('base64');
      case 'inert-js': {
        const t = buf.toString('utf8');
        if (/<\/script|<!--/i.test(t)) throw new Error(`${s.path} contains "</script" or "<!--", which would end its inert <script> early (escape it in the bundle, or bundle with a minifier that does)`);
        return t;
      }
      default: throw new Error(`unknown kind "${kind}"`);
    }
  };
  function fontCss(faces) {
    const groups = new Map();
    for (const fc of faces) {
      const f = inside(fc.path);
      if (!fs.existsSync(f)) throw new Error(`missing font ${fc.path}`);
      if (path.extname(f).toLowerCase() !== '.woff2') warnings.push(`font ${fc.path} is not woff2: every format listed is embedded, list woff2 only`);
      const bytes = fs.readFileSync(f), key = fc.family + '|' + (fc.style || 'normal') + '|' + crypto.createHash('sha1').update(bytes).digest('hex');
      const ws = String(fc.weight ?? 400).split(/\s+/).map(Number), lo = Math.min(...ws), hi = Math.max(...ws);
      const g = groups.get(key) || { fc, bytes, lo: 1000, hi: 0 };
      g.lo = Math.min(g.lo, lo); g.hi = Math.max(g.hi, hi); groups.set(key, g);
    }
    if (groups.size < faces.length) warnings.push(`fonts: ${faces.length} faces listed, ${groups.size} distinct files embedded (same bytes grouped by content hash into weight ranges)`);
    return [...groups.values()].map(g => `@font-face{font-family:'${g.fc.family}';font-style:${g.fc.style || 'normal'};font-weight:${g.lo === g.hi ? g.lo : g.lo + ' ' + g.hi};font-display:${g.fc.display || 'swap'};${g.fc.unicodeRange ? `unicode-range:${g.fc.unicodeRange};` : ''}src:url(data:font/woff2;base64,${g.bytes.toString('base64')}) format('woff2')}`).join('');
  }

  for (const [name, s] of Object.entries(man.slots || {})) {
    const ts = tokens(name);
    if (!ts.length) { errors.push(`slot ${name}: no /*__${name}__*/, <!--__${name}__--> or {{${name}}} in the template`); continue; }
    let value;
    try { value = embed(name, s); } catch (e) { errors.push(`slot ${name}: ${e.message}`); continue; }
    sizes[name] = Buffer.byteLength(value);
    for (const t of ts) html = html.split(t).join(value);
  }
  const left = [...new Set([...html.matchAll(PLACEHOLDER)].map(m => m[1] || m[2] || m[3]))];
  if (left.length) errors.push(`placeholders never replaced: ${left.join(', ')}`);

  // order and boot checks
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m => {
    const t = (/\btype=["']([^"']*)["']/i.exec(m[1]) || [, ''])[1].trim().toLowerCase();
    return { index: m.index, len: m[2].length, body: m[2], runs: !t || ['module', 'text/javascript', 'application/javascript'].includes(t), type: t };
  });
  const lastRun = scripts.filter(s => s.runs).map(s => s.index).pop() ?? -1;
  for (const s of scripts.filter(s => !s.runs && s.len > MB && s.index < lastRun)) warnings.push(`an inert ${s.type} block of ${(s.len / MB).toFixed(1)} MB sits before an executable script: that script waits for it to be parsed. Move payloads after the app script, at the end of <body>`);
  const head = html.search(/<\/head>/i);
  for (const s of scripts.filter(s => !s.runs && s.len > MB && head > 0 && s.index < head)) warnings.push(`an inert ${s.type} block of ${(s.len / MB).toFixed(1)} MB is in <head>: first paint waits for it (measured: no paint before load at 50 to 200 MB)`);
  const after = i => scripts.filter(s => !s.runs && s.index > i).reduce((n, s) => n + s.len, 0);
  for (const s of scripts.filter(s => s.runs)) {
    if (/addEventListener\(\s*["'](?:DOMContentLoaded|load)["']|\bonload\s*=/.test(s.body) && after(s.index) > MB) {
      warnings.push(`an executable script waits for DOMContentLoaded or load while ${(after(s.index) / MB).toFixed(1)} MB of inert payload follows it: the app starts only when the parser reaches the end of the file. Call boot() directly at the end of the app script`);
      break;
    }
  }
  if (!/<meta[^>]+charset/i.test(html.slice(0, 1024))) warnings.push('<meta charset="utf-8"> is not in the first 1024 bytes: file:// has no HTTP charset header, so non-ASCII text can turn to mojibake');

  const target = path.resolve(root, out || man.out || 'dist/index.html');
  if (!errors.length && !check) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, html); }
  return { errors, warnings, sizes, out: errors.length || check ? null : target, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), pos = a.filter((x, i) => !x.startsWith('--') && a[i - 1] !== '--out');
  if (!pos.length) { console.error('usage: node build-single.mjs build.json [--out file.html] [--check]'); process.exit(2); }
  const oi = a.indexOf('--out');
  const r = build(pos[0], { out: oi >= 0 ? a[oi + 1] : undefined, check: a.includes('--check') });
  for (const [k, v] of Object.entries(r.sizes)) console.log(`  slot ${k.padEnd(14)} ${(v / 1024).toFixed(1)} KB`);
  for (const w of r.warnings) console.log('warning:', w);
  for (const e of r.errors) console.log('ERROR:', e);
  if (r.errors.length) { console.log('\nBuild refused: nothing written.'); process.exit(1); }
  console.log(r.out ? `wrote ${r.out} (${(r.bytes / MB).toFixed(2)} MB; weight is information, not a budget)` : `check only: ${(r.bytes / MB).toFixed(2)} MB, nothing written`);
}
