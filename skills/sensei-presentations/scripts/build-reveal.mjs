#!/usr/bin/env node
// build-reveal.mjs: build a reveal.js deck into ONE offline HTML file. reveal.js, its theme (with the theme's fonts as
// data URIs) and the notes plugin are inlined from the project's own node_modules; nothing is fetched at run time.
//
//   node build-reveal.mjs slides.html -o deck.html [--title "Talk"] [--theme white] [--handout] [--no-notes]
//
// slides.html holds the <section> elements (the content of .slides). reveal.js comes from SENSEI_NODE_MODULES, else
// node_modules up from the current folder (npm i -D reveal.js). The built page:
//   - honours prefers-reduced-motion, which reveal.js does not do by itself: transition 'none' and autoAnimate off,
//     chosen before initialize();
//   - --handout sets pdfSeparateFragments: false, so ?print-pdf gives one page per slide instead of one per fragment;
//   - escapes "</script" and "<!--" in inlined scripts, which would otherwise end or upset the script element;
//   - carries the licence notices: reveal.js (MIT, its own banner kept), the notes plugin (MIT, bundles marked, MIT),
//     the theme's fonts (Source Sans Pro and others in the themes are under the SIL Open Font Licence).
//
// verified: Windows 10, Node 24, reveal.js 6.0.2 from npm, installed Chrome 155 through playwright-core 1.62.1
//           (test-reveal.mjs): no requests from file://, scale, keyboard, fragments, auto-animate interpolation,
//           vertical stack, hash, the speaker view window, ?print-pdf page counts with and without --handout, and
//           transitions off under reduced motion.
// not verified: plugins other than notes (highlight, math, search, zoom); themes other than white; Firefox, Safari.
// HTML-Sensei's own code. Origin: code-apps/deck/build-reveal.cjs in the HTML-Sensei build project's research notes (not shipped).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function findReveal() {
  const bases = [];
  if (process.env.SENSEI_NODE_MODULES) { const e = process.env.SENSEI_NODE_MODULES; bases.push(path.basename(e) === 'node_modules' ? path.dirname(e) : e); }
  bases.push(process.cwd());
  /* walk up node_modules by hand: the package's "exports" map hides package.json from require.resolve */
  for (const b of bases) {
    let d = path.resolve(b);
    for (;;) {
      const f = path.join(d, 'node_modules', 'reveal.js', 'package.json');
      if (fs.existsSync(f)) return path.dirname(f);
      const up = path.dirname(d); if (up === d) break; d = up;
    }
  }
  return null;
}
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const safeCss = (css) => css.replace(/<\/style/gi, '<\\/style');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function buildReveal({ slides, title = 'Presentation', theme = 'white', handout = false, notes = true, lang = 'en-GB', width = 1920, height = 1080 }) {
  const root = findReveal();
  if (!root) throw new Error('reveal.js not found: npm i -D reveal.js in the project, or set SENSEI_NODE_MODULES');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const D = path.join(root, 'dist');
  const rd = (f) => fs.readFileSync(path.join(D, f), 'utf8');
  if (!fs.existsSync(path.join(D, 'theme', theme + '.css'))) throw new Error('no reveal.js theme ' + theme);
  const config = { width, height, margin: 0.04, hash: true, pdfSeparateFragments: !handout };
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<!-- Built with build-reveal.mjs from reveal.js ${esc(pkg.version)} (MIT, Copyright (C) 2011-2026 Hakim El Hattab and
     reveal.js contributors; https://revealjs.com). The notes plugin bundles marked (MIT). Theme fonts are under the
     SIL Open Font Licence. Keep these notices when the deck is shared. -->
<style>${safeCss(rd('reveal.css'))}</style>
<style>${safeCss(rd('theme/' + theme + '.css'))}</style>
<style>@media (prefers-reduced-motion:reduce){.reveal .slides section,.reveal .fragment{transition:none!important}}</style>
</head>
<body>
<div class="reveal"><div class="slides">
${slides}
</div></div>
<script>${safe(rd('reveal.js'))}</script>
${notes ? `<script>/* reveal.js notes plugin, MIT; bundles marked, MIT */\n${safe(rd('plugin/notes.js'))}</script>` : ''}
<script>
(function () {
  var config = ${JSON.stringify(config)};
  /* reveal.js ignores prefers-reduced-motion: decide before initialize() */
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { config.transition = 'none'; config.backgroundTransition = 'none'; config.autoAnimate = false; }
  ${notes ? 'config.plugins = [RevealNotes];' : ''}
  var deck = window.deck = new Reveal(config);
  deck.initialize().then(function () { window.__ready = true; });
})();
</script>
</body>
</html>
`;
}

function main(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '-o') a.out = argv[++i];
    else if (k === '--title') a.title = argv[++i];
    else if (k === '--theme') a.theme = argv[++i];
    else if (k === '--lang') a.lang = argv[++i];
    else if (k === '--handout') a.handout = true;
    else if (k === '--no-notes') a.notes = false;
    else a._.push(k);
  }
  if (!a._[0] || !a.out) { console.error('usage: node build-reveal.mjs slides.html -o deck.html [--title T] [--theme white] [--handout] [--no-notes] [--lang en-GB]'); return 2; }
  const html = buildReveal({ slides: fs.readFileSync(a._[0], 'utf8'), title: a.title, theme: a.theme, handout: a.handout, notes: a.notes !== false, lang: a.lang });
  fs.writeFileSync(a.out, html);
  console.log(`wrote ${a.out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, information only)`);
  return 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
