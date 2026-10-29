#!/usr/bin/env node
/* GOAT-HTML engine analyser: probe any HTML file's engines, data and sentinels.
 *
 * Usage:  node engine-analyzer.js <file.html>
 * Node 22 or newer; ES module syntax and no dependencies, so it runs whether or not a
 * package.json nearby says "type": "module".
 *
 * Reports:
 *   - size and lines (information only, no budget) and the largest lines (embed blobs flagged)
 *   - <script>/<style> block census
 *   - detected engines, with real occurrence counts: canvas 2D, three.js, WebAudio,
 *     SpeechSynthesis, RAF loops, IntersectionObserver, instancing, bloom; localStorage keys
 *   - whether prefers-reduced-motion is referenced at all
 *   - data arrays: const NAME=[...] with size and start line (best effort)
 *   - sentinels present (block-comment __NAME__ and <!--__NAME__--> forms)
 *   - data-URI census by type
 *   - network references (http/https src or href, CSS url()), which fail an offline file
 * Built for 14 MB+ files: reads the file once in Node, never through an editor's line buffer.
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node engine-analyzer.js <file.html>'); process.exit(2); }
const buf = fs.readFileSync(file);
const html = buf.toString('utf8');
const lines = html.split('\n');
const KB = n => (n / 1024).toFixed(1) + ' KB';
const count = re => [...html.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))].length;

console.log(`FILE   ${file}`);
console.log(`SIZE   ${KB(buf.length)}, ${lines.length} lines (information only, no budget)`);

// -- largest lines (embed blobs) --------------------------------------------
const big = lines.map((l, i) => [l.length, i + 1]).sort((a, b) => b[0] - a[0]).slice(0, 4);
for (const [len, ln] of big)
  console.log(`BIG    line ${ln}: ${KB(len)}${len > 100000 ? '  (embed blob: never line-edit inside)' : ''}`);

// -- script/style blocks -----------------------------------------------------
const scripts = html.match(/<script\b[^>]*>/gi) || [];
const externals = scripts.filter(s => /\bsrc=/i.test(s)).length;
console.log(`BLOCKS ${scripts.length - externals} inline script(s), ${externals} external, ${count(/<style\b/i)} style`);

// -- engines -------------------------------------------------------------------
const has = (re, label) => { const n = count(re); if (n) console.log(`ENGINE ${label} (x${n})`); return n; };
has(/\bgetContext\(\s*['"]2d['"]/, 'canvas 2D');
has(/\bgetContext\(\s*['"]webgl2?['"]/, 'raw WebGL context');
has(/\bTHREE\./, 'three.js');
has(/\bnew\s+(window\.)?(AudioContext|webkitAudioContext)/, 'WebAudio');
has(/\bcreateMediaElementSource\b/, 'audio element analysis');
has(/\bspeechSynthesis\b/, 'SpeechSynthesis');
has(/\brequestAnimationFrame\b/, 'RAF loops');
has(/\bIntersectionObserver\b/, 'scroll reveals');
has(/\bInstancedMesh\b/, 'instanced meshes');
has(/\bUnrealBloomPass\b/, 'unreal bloom');
const rm = count(/prefers-reduced-motion/);
console.log(rm ? `MOTION prefers-reduced-motion referenced (x${rm})`
               : 'MOTION prefers-reduced-motion not found: every animated system needs a reduced-motion path');
const keys = [...new Set([...html.matchAll(/localStorage\.(?:get|set)Item\(\s*['"]([\w-]+)['"]/g)].map(x => x[1]))];
if (keys.length) console.log(`STORE  localStorage keys: ${keys.join(', ')}`);

// -- data arrays ----------------------------------------------------------------
const arrRe = /const\s+([A-Z][A-Z0-9_]{1,20})\s*=\s*\[/g;
let m;
while ((m = arrRe.exec(html))) {
  const start = m.index, open = html.indexOf('[', start);
  let depth = 0, end = -1;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (!depth) { end = i; break; } }
  }
  if (end < 0) continue;
  console.log(`DATA   const ${m[1]}: ~${KB(end - open)}, starts line ${html.slice(0, start).split('\n').length}`);
}

// -- sentinels --------------------------------------------------------------------
const sens = [...new Set(html.match(/\/\*__[A-Z0-9_]+__\*\/|<!--__[A-Z0-9_]+__-->/g) || [])];
console.log(`SENTEL ${sens.length ? sens.join(' ') : 'none found (add sentinel anchors such as <!--__THREE__-->)'}`);

// -- data URIs ---------------------------------------------------------------------
const census = {};
for (const um of html.matchAll(/data:((?:image|audio|font|video)\/[a-z0-9.+-]+);base64/g))
  census[um[1]] = (census[um[1]] || 0) + 1;
for (const [k, n] of Object.entries(census)) console.log(`EMBED  ${k} x${n}`);

// -- network references (an offline file must have none) ------------------------
const net = [...new Set([
  ...[...html.matchAll(/<(?:script|link|img|audio|video|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']?((?:https?:)?\/\/[^"'\s>]+)/gi)].map(x => x[1]),
  ...[...html.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi)].map(x => x[1]),
])];
console.log(net.length ? `NET    ${net.length} network reference(s): ${net.slice(0, 5).join(' ')}` : 'NET    no network references');
console.log('DONE   (runtime truth still needs the browser gates: verification.md)');
