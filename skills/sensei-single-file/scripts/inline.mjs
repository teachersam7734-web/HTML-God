#!/usr/bin/env node
// inline.mjs: turn a small multi-file web project into ONE offline HTML file. Plain Node, no dependencies.
//
//   node inline.mjs <entry.html> <out.html> [--lazy-over KB] [--assets-at end|head] [--keep-external] [--manifest out.json]
//
// What it inlines (relative references only; http(s) references are reported, and kept unless they are fatal):
//   <link rel=stylesheet>      -> <style>, recursively: @import, url(...) fonts and images become data: URIs
//   <script src>               -> inline <script> (classic or module); "</script" and "<!--" are escaped
//   <img src/srcset>, <source>, <video poster>, <link rel=icon>, <input type=image>, <image href> -> data: URIs
//   <video src>, <audio src>   -> data: URI, or (over --lazy-over KB, default 1024) a lazy asset decoded on demand
//   anything else that code loads BY PATH at run time (fetch("x.wasm"), new Worker("w.js"), new Audio("a.mp3"),
//   JSON, glTF, text): write the path through SenseiAssets.url("x") / fetch("x") / new Worker("x"); the packager
//   finds string literals that name an existing file next to the entry (or listed in data-sensei-assets="a,b" on <html>)
//   and stores the bytes in <script type="application/x-sensei-asset"> blocks, which sensei-assets-runtime.js maps to Blob URLs.
//
// Why base64 text blocks and not one giant JS string: a <script type="application/x-sensei-asset"> body is never
// compiled, never copied into a JS heap string until asked for, and can sit at the END of <body> so it cannot
// delay first paint (measured: see domain-single-file-packaging.md).
//
// Two guards added for the plugin, from Ultra Bookworm's build.py and its 2026-10-19 load trace:
//   - leftover template placeholders (/*__NAME__*/, <!--__NAME__-->, {{NAME}}) are a refusal (exit 1), never a warning:
//     a placeholder nobody replaced does not raise, it ships as a broken src or a dead comment;
//   - an inline script that waits for DOMContentLoaded or load while megabytes of inert payload follow it is warned
//     about: DOMContentLoaded waits for the parser to reach the end of the file, payloads included. Boot directly.
//
// verified: Windows 10, Node 24, installed Chrome through playwright-core 1.62, strict file:// (test-inline.mjs: the
//           original project fails its run-time loads, the packed file passes all of them with one request; the two
//           guards by test-build-single.mjs). The research version was run the same way (20 checks).
// not verified: srcset with several candidates beyond a unit run; <object> and <iframe> of local HTML (reported, not
//           inlined); CSS image-set(); source maps; element src setters in code (use SenseiAssets.url); XHR (no shim);
//           Firefox and Safari; macOS and Linux.
// Origin: code-engineering/inline.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.json': 'application/json',
  '.txt': 'text/plain', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream', '.lottie': 'application/zip', '.riv': 'application/octet-stream' };
const mimeOf = f => MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
const isRemote = u => /^(https?:)?\/\//i.test(u);
const isData = u => /^(data|blob|about|javascript|mailto|tel):/i.test(u) || u.startsWith('#');

export function inline(entry, opts = {}) {
  const lazyOver = (opts.lazyOver ?? 1024) * 1024, assetsAt = opts.assetsAt || 'end';
  const root = path.dirname(path.resolve(entry));
  const log = { inlined: [], assets: [], external: [], missing: [], warnings: [] };
  const rel = f => path.relative(root, f).split(path.sep).join('/');
  const read = f => fs.readFileSync(f);
  const resolve = (from, u) => path.resolve(path.dirname(from), decodeURIComponent(u.split('#')[0].split('?')[0]));
  const b64 = buf => Buffer.from(buf).toString('base64');
  const dataUri = (f, buf = read(f)) => {
    const m = mimeOf(f);
    if (m === 'image/svg+xml' && buf.length < 60000) {
      // utf8 SVG: smaller and diff-able. Encode only what breaks a data URI or a CSS/HTML attribute.
      const s = buf.toString('utf8').replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim().replace(/%/g, '%25').replace(/#/g, '%23').replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\r?\n/g, ' ');
      return 'data:image/svg+xml;charset=utf-8,' + s;
    }
    return 'data:' + m + ';base64,' + b64(buf);
  };
  const track = (kind, f, bytes) => log.inlined.push({ kind, file: rel(f), bytes });
  const escScript = s => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  const escStyle = s => s.replace(/<\/(style)/gi, '<\\/$1');

  // ---- CSS: @import and url()
  const seenCss = new Set();
  function processCss(css, file) {
    if (seenCss.has(file)) { log.warnings.push('circular @import: ' + rel(file)); return ''; }
    seenCss.add(file);
    css = css.replace(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?\s*([^;]*);/g, (m, u, media) => {
      if (isRemote(u)) { log.external.push(u); return m; }
      const f = resolve(file, u); if (!fs.existsSync(f)) { log.missing.push(rel(f)); return m; }
      const inner = processCss(read(f).toString('utf8'), f); track('css-import', f, fs.statSync(f).size);
      return media.trim() ? `@media ${media.trim()}{${inner}}` : inner;
    });
    css = css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, u) => {
      if (isData(u) || u.startsWith('about:')) return m;
      if (isRemote(u)) { log.external.push(u); return m; }
      const f = resolve(file, u); if (!fs.existsSync(f)) { log.missing.push(rel(f)); return m; }
      const buf = read(f); track('css-url', f, buf.length);
      return `url("${dataUri(f, buf)}")`;
    });
    seenCss.delete(file);
    return css;
  }

  // ---- assets loaded by path from code
  const assetTable = new Map(); // key -> {file, mime}
  const addAsset = (key, f) => { if (!assetTable.has(key)) { assetTable.set(key, { file: f, mime: mimeOf(f) }); log.assets.push({ key, bytes: fs.statSync(f).size }); } };
  function findPathStrings(code, fromFile) {
    // string literals that look like a relative file path with a known asset extension and exist on disk
    const exts = ['wasm', 'glb', 'gltf', 'json', 'woff2', 'woff', 'ttf', 'mp3', 'ogg', 'wav', 'm4a', 'mp4', 'webm', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'svg', 'bin', 'ktx2', 'hdr', 'lottie', 'riv', 'txt', 'js', 'mjs'];
    const re = new RegExp(String.raw`["'\`]((?:\.{0,2}/)?[\w@%+.\-/]+\.(?:${exts.join('|')}))(?:\?[^"'\`]*)?["'\`]`, 'g');
    for (const m of code.matchAll(re)) {
      const u = m[1]; if (isRemote(u) || isData(u)) continue;
      const f = resolve(fromFile, u); if (!fs.existsSync(f) || !fs.statSync(f).isFile()) continue;
      if (path.resolve(f) === path.resolve(entry)) continue;
      addAsset(rel(f), f);
    }
  }

  let html = read(entry).toString('utf8').replace(/^\uFEFF/, '');
  const entryAbs = path.resolve(entry);

  // explicit list on <html data-sensei-assets="a.wasm,w.js">
  const dl = /<html\b[^>]*\bdata-sensei-assets=["']([^"']+)["']/i.exec(html);
  if (dl) for (const u of dl[1].split(',').map(s => s.trim()).filter(Boolean)) { const f = resolve(entryAbs, u); fs.existsSync(f) ? addAsset(rel(f), f) : log.missing.push(u); }

  // <link rel=stylesheet>
  html = html.replace(/<link\b([^>]*)>/gi, (m, attrs) => {
    const rl = /\brel=["']?([^"'\s>]+(?:\s+[^"'\s>]+)*)["']?/i.exec(attrs), href = /\bhref=["']([^"']+)["']/i.exec(attrs);
    if (!rl || !href) return m;
    const kinds = rl[1].toLowerCase().split(/\s+/), u = href[1];
    if (isData(u)) return m;
    if (isRemote(u)) { log.external.push(u); return m; }
    const f = resolve(entryAbs, u); if (!fs.existsSync(f)) { log.missing.push(rel(f)); return m; }
    if (kinds.includes('stylesheet')) {
      const media = /\bmedia=["']([^"']+)["']/i.exec(attrs);
      const css = processCss(read(f).toString('utf8'), f); track('stylesheet', f, fs.statSync(f).size);
      return `<style${media ? ` media="${media[1]}"` : ''}>${escStyle(css)}</style>`;
    }
    if (kinds.some(k => ['icon', 'shortcut', 'apple-touch-icon', 'mask-icon'].includes(k))) { track('icon', f, fs.statSync(f).size); return m.replace(href[0], `href="${dataUri(f)}"`); }
    if (kinds.includes('manifest')) { log.warnings.push('manifest link kept as a file reference: a PWA manifest cannot be inlined usefully (blob/data manifests are not installable); a single-file page is not installable'); return m; }
    if (kinds.includes('preload') || kinds.includes('modulepreload') || kinds.includes('prefetch')) { log.warnings.push('removed ' + kinds.join(' ') + ' link for ' + u + ' (its target is inlined)'); return ''; }
    return m;
  });

  // <script src>
  html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (m, a1, u, a2) => {
    if (isData(u)) return m;
    if (isRemote(u)) { log.external.push(u); return m; }
    const f = resolve(entryAbs, u); if (!fs.existsSync(f)) { log.missing.push(rel(f)); return m; }
    const code = read(f).toString('utf8').replace(/^\uFEFF/, '');
    const attrs = (a1 + ' ' + a2).replace(/\s*\b(?:integrity|crossorigin)=["'][^"']*["']/gi, '').replace(/\s*\bdefer\b/i, '').replace(/\s*\basync\b/i, '').trim();
    const isModule = /type=["']module["']/i.test(attrs);
    if (isModule && /^\s*(import|export)\b[^;]*\bfrom\b|^\s*import\s*["']/m.test(code)) log.warnings.push(`module ${rel(f)} has import/export statements: they cannot resolve in one file. Bundle first (esbuild --bundle --format=iife).`);
    if (/\bimport\.meta\b/.test(code)) log.warnings.push(`${rel(f)} uses import.meta: in a classic inline script it is a SyntaxError; bundle with --define:import.meta.url=...`);
    findPathStrings(code, f);
    track('script', f, code.length);
    // classic scripts keep execution order; defer is implicit for module scripts. Dropped defer/async on classic scripts: they now run inline in order.
    return `<script${attrs ? ' ' + attrs : ''}>${escScript(code)}</script>`;
  });

  // inline <script> bodies (path strings, escape check)
  html.replace(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, (m, code) => { findPathStrings(code, entryAbs); return m; });

  // media and images in attributes
  const lazyEls = [];
  const attrRe = /<(img|source|video|audio|input|image|track|embed|object|iframe)\b([^>]*)>/gi;
  html = html.replace(attrRe, (m, tagName, attrs) => {
    let out = m; const tn = tagName.toLowerCase();
    const sub = (attr, onFile) => {
      const rx = new RegExp(`\\b${attr}=(["'])([^"']+)\\1`, 'i'); const mm = rx.exec(out); if (!mm) return;
      const u = mm[2]; if (isData(u) || (attr === 'href' && tn !== 'image')) return;
      if (isRemote(u)) { log.external.push(u); return; }
      const f = resolve(entryAbs, u); if (!fs.existsSync(f)) { log.missing.push(rel(f)); return; }
      out = out.replace(rx, onFile(f, u, mm[0]));
    };
    const small = (f, kind) => (_f, _u, whole) => { const b = read(f); track(kind, f, b.length); return `${whole.split('=')[0]}="${dataUri(f, b)}"`; };
    if (tn === 'img' || tn === 'source' || tn === 'input' || tn === 'image' || tn === 'track' || tn === 'embed') {
      sub(tn === 'image' ? 'href' : 'src', (f, u, whole) => { const sz = fs.statSync(f).size, m = mimeOf(f); if (/^(video|audio)\//.test(m) && sz > lazyOver) { addAsset(rel(f), f); lazyEls.push(1); return `data-sensei-asset="${rel(f)}"`; } return small(f, 'image')(f, u, whole); });
      // srcset: "a.png 1x, b.png 2x"
      const ss = /\bsrcset=(["'])([^"']+)\1/i.exec(out);
      if (ss) {
        const parts = ss[2].split(',').map(p => p.trim()).filter(Boolean).map(p => { const [u, d] = p.split(/\s+/); if (isData(u) || isRemote(u)) return p; const f = resolve(entryAbs, u); if (!fs.existsSync(f)) { log.missing.push(rel(f)); return p; } track('srcset', f, fs.statSync(f).size); return dataUri(f) + (d ? ' ' + d : ''); });
        out = out.replace(ss[0], `srcset="${parts.join(', ')}"`);
      }
    }
    if (tn === 'video' || tn === 'audio') {
      sub('src', (f, u, whole) => {
        const sz = fs.statSync(f).size;
        if (sz > lazyOver) { addAsset(rel(f), f); lazyEls.push(1); track('media-lazy', f, sz); return `data-sensei-asset="${rel(f)}"`; }
        track('media', f, sz); return `src="${dataUri(f)}"`;
      });
      sub('poster', (f, u) => { const sz = fs.statSync(f).size; track('poster', f, sz); return `poster="${dataUri(f)}"`; });
    }
    return out;
  });
  // <video><source src=big.mp4></video>: lazily too
  html = html.replace(/(<(?:video|audio)\b[^>]*>)([\s\S]*?)(<\/(?:video|audio)>)/gi, (m, open, inner, close) => {
    inner = inner.replace(/<source\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/gi, (mm, a1, u, a2) => {
      if (isData(u) || isRemote(u)) { if (isRemote(u)) log.external.push(u); return mm; }
      const f = resolve(entryAbs, u); if (!fs.existsSync(f)) { log.missing.push(rel(f)); return mm; }
      const sz = fs.statSync(f).size, b = read(f);
      if (sz > lazyOver) { addAsset(rel(f), f); track('media-lazy', f, sz); lazyEls.push(1); return `<source${a1}data-sensei-asset="${rel(f)}"${a2}>`; }
      track('media', f, sz); return `<source${a1}src="${dataUri(f, b)}"${a2}>`;
    });
    return open + inner + close;
  });
  // <source data-sensei-asset> inside a <video>: runtime sets src on the <source> then needs video.load(); handled by load() on parent. Simplest: lift to the video.
  html = html.replace(/(<(video|audio)\b[^>]*>)\s*<source\b[^>]*\bdata-sensei-asset="([^"]+)"[^>]*>([\s\S]*?<\/\2>)/gi, (m, open, tn, key, rest) => open.replace('>', ` data-sensei-asset="${key}">`) + rest);

  // inline CSS style="" and <style> url() references
  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, a, css) => `<style${a}>${escStyle(processCss(css, entryAbs))}</style>`);
  html = html.replace(/\bstyle=(["'])([^"']*url\([^"']+\)[^"']*)\1/gi, (m, q, css) => `style=${q}${processCss(css, entryAbs).replace(/"/g, "'")}${q}`);

  // external references that remain
  const ext = [...new Set(log.external)];
  if (ext.length && !opts.keepExternal) log.warnings.push(`${ext.length} external reference(s) remain (the file will not be fully offline): ${ext.slice(0, 5).join(', ')}`);

  // asset table + runtime
  if (assetTable.size) {
    const runtime = fs.readFileSync(path.join(HERE, 'lib', 'sensei-assets-runtime.js'), 'utf8');
    const blocks = [...assetTable].map(([k, a]) => `<script type="application/x-sensei-asset" data-path="${k}" data-mime="${a.mime}">${b64(read(a.file))}</script>`).join('\n');
    const rt = `<script>${escScript(runtime.replace('/*SENSEI_KEYS*/[]/*END*/', JSON.stringify([...assetTable.keys()])))}</script>`;
    // runtime in <head> (it must exist before any script that calls fetch/Worker); the byte table at the end of <body>
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, rt + '\n</head>') : rt + html;
    html = assetsAt === 'head' && /<\/head>/i.test(html) ? html.replace(/<\/head>/i, blocks + '\n</head>') : (/<\/body>/i.test(html) ? html.replace(/<\/body>/i, blocks + '\n</body>') : html + blocks);
    for (const [k, a] of assetTable) track('asset-table', a.file, fs.statSync(a.file).size);
  }

  // charset first in <head> (file:// has no HTTP header; the meta must be in the first 1024 bytes)
  if (!/<meta[^>]+charset/i.test(html.slice(0, 1024))) {
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, '<head$1>\n<meta charset="utf-8">') : '<meta charset="utf-8">\n' + html;
    log.warnings.push('added <meta charset="utf-8"> at the top of <head>');
  }
  if (!/^\s*<!doctype html/i.test(html)) { html = '<!doctype html>\n' + html; log.warnings.push('added missing <!doctype html>'); }
  // guard 1: leftover placeholders (refusal)
  log.placeholders = [...new Set([...html.matchAll(/\/\*__([A-Z0-9_]+)__\*\/|<!--__([A-Z0-9_]+)__-->|\{\{\s*([A-Z0-9_]+)\s*\}\}/g)].map(m => m[1] || m[2] || m[3]))];
  // guard 2: boot that waits for the whole file
  const PAYLOAD = 1048576;
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m => {
    const t = (/\btype=["']([^"']*)["']/i.exec(m[1]) || [, ''])[1].trim().toLowerCase();
    return { index: m.index, body: m[2], runs: !t || ['module', 'text/javascript', 'application/javascript'].includes(t) };
  });
  const after = idx => scripts.filter(s => !s.runs && s.index > idx).reduce((n, s) => n + s.body.length, 0);
  for (const sc of scripts.filter(s => s.runs && !/window\.SenseiAssets\s*=/.test(s.body))) {   // the runtime's own lazy hook is fine
    if (/addEventListener\(\s*["'](?:DOMContentLoaded|load)["']|\bonload\s*=|\$\(\s*(?:document\s*\)\.ready|function)/.test(sc.body) && after(sc.index) > PAYLOAD) {
      log.warnings.push(`an inline script waits for DOMContentLoaded or load while ${(after(sc.index) / 1048576).toFixed(1)} MB of inert payload follows it: the app will not start until the parser reaches the end of the file. Call boot() directly at the end of the app script (every element it needs is above it).`);
      break;
    }
  }
  return { html, log };
}

// ---- CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2); const pos = []; const o = {};
  for (let i = 0; i < a.length; i++) { if (a[i] === '--lazy-over') o.lazyOver = +a[++i]; else if (a[i] === '--assets-at') o.assetsAt = a[++i]; else if (a[i] === '--keep-external') o.keepExternal = true; else if (a[i] === '--manifest') o.manifest = a[++i]; else pos.push(a[i]); }
  if (pos.length < 2) { console.error('usage: node inline.mjs <entry.html> <out.html> [--lazy-over KB] [--assets-at end|head] [--keep-external] [--manifest out.json]'); process.exit(2); }
  // A missing entry is a clear message and exit 2, not a raw ENOENT stack; a missing output folder is created
  // (QC finding 13: `inline.mjs src/index.html dist/page.html` crashed when dist/ did not exist yet).
  if (!fs.existsSync(pos[0])) { console.error(`inline: entry not found: ${pos[0]} (resolved to ${path.resolve(pos[0])})`); process.exit(2); }
  if (!fs.statSync(pos[0]).isFile()) { console.error(`inline: entry is not a file: ${pos[0]} (give the entry .html, not its folder)`); process.exit(2); }
  if (path.resolve(pos[0]) === path.resolve(pos[1])) { console.error('inline: the output would overwrite the entry; give another output path'); process.exit(2); }
  const { html, log } = inline(pos[0], o);
  fs.mkdirSync(path.dirname(path.resolve(pos[1])), { recursive: true });
  fs.writeFileSync(pos[1], html);
  const total = log.inlined.reduce((s, x) => s + x.bytes, 0);
  console.log(`wrote ${pos[1]}: ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB from ${log.inlined.length} inlined file(s), ${(total / 1048576).toFixed(2)} MB of sources, ${log.assets.length} runtime asset(s)`);
  for (const w of log.warnings) console.log('warning:', w);
  for (const m of [...new Set(log.missing)]) console.log('MISSING:', m);
  for (const m of log.placeholders) console.log('PLACEHOLDER LEFT (refusing):', m);
  if (o.manifest) fs.mkdirSync(path.dirname(path.resolve(o.manifest)), { recursive: true });
  if (o.manifest) fs.writeFileSync(o.manifest, JSON.stringify(log, null, 2));
  process.exit(log.missing.length || log.placeholders.length ? 1 : 0);
}
