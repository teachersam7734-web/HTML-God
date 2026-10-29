// lint/three.mjs: static checks for single-file 3D, WebGL and shader pages. Ported rule for rule from the 3D lane's
// lint3d.mjs (research notes, not shipped; tested there on bad.html and the lane's pages); messages unchanged. Since
// the port: comments are blanked before matching (a comment is never a reduced-motion branch), the terminator rule
// counts openings against closings and spots a script cut inside a string (the lazy capture could never fire), and
// the transpose rule also catches a vec4 variable on the left (p * modelViewMatrix).
// Heuristics: they catch the common mistakes, they do not prove a page correct.
//
// In the hook, 'no-cdn' is left to lint-web (which knows the profile's offline flag) and 'random-in-seek-page' to
// lint-determinism, so a page is not told the same thing twice. The CLI runs every rule, like lint3d.mjs:
//   node three.mjs page.html [...]    (exit 1 if any FAIL)
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { finding, lineOf } from '../gate.mjs';
import { stripComments, scanJs, isJsScript } from './common.mjs';

// HTML, CSS, JS and GLSL comments blanked (same length), so "// prefers-reduced-motion handled later" is not a
// reduced-motion branch and a commented-out line is not a finding.
const strip = s => stripComments(s);

// "</script" inside an inline script ends the element early in the HTML parser. Two signs it happened: more
// </script> closings than <script> openings (the rest of the string reappears as text and a stray close tag), or a
// script body that ends inside a string or template literal (the string was cut at the "</script").
function scriptTerminators(s) {
  const opens = (s.match(/<script\b/gi) || []).length, closes = (s.match(/<\/script\s*>/gi) || []).length;
  const out = [];
  if (closes > opens) out.push({ text: `${closes} </script> closings for ${opens} <script> openings`, index: -1 });
  for (const m of s.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\bsrc\s*=/.test(m[1]) && isJsScript(m[1]) && !/x-shader|text\/x-/i.test(m[1]) && scanJs(m[2]).open) out.push({ text: 'an inline script ends inside a string: ' + m[2].trim().split('\n').pop().slice(-60), index: m.index });
  }
  return out;
}

// vec * matrix with a vector on the left (a vec4(...) literal or a variable that is not itself a matrix) is the
// transpose multiply.
const MATS = 'modelMatrix|modelViewMatrix|viewMatrix|projectionMatrix|normalMatrix|projectionViewMatrix|modelViewProjectionMatrix';
function transposeHits(s) {
  const out = [];
  for (const m of s.matchAll(new RegExp(String.raw`vec4\s*\([^;]*?\)\s*\*\s*(?:${MATS})\b`, 'g'))) out.push({ text: m[0].slice(0, 80), index: m.index });
  const matVars = new Set([...s.matchAll(/\bmat[234](?:x[234])?\s+([A-Za-z_]\w*)/g)].map(m => m[1]));
  for (const m of s.matchAll(new RegExp(String.raw`(?<![\w.)\]])([A-Za-z_]\w*)\s*\*\s*(?:${MATS})\b`, 'g'))) {
    const v = m[1];
    if (/matrix$/i.test(v) || matVars.has(v) || /^(?:return|vec[234]|float|uniform|in|out)$/.test(v)) continue;
    out.push({ text: m[0].slice(0, 80), index: m.index });
  }
  return out;
}
// vendored libraries (script blocks over 100 KB) are skipped by the shader and style heuristics; the no-cdn and
// terminator rules still see them
const app = s => s.replace(/(<script[^>]*>)([\s\S]{100000,}?)(<\/script>)/g, (m, a, b, c) => a + b.replace(/[^\n]/g, ' ') + c);
const FULL = new Set(['no-cdn', 'inline-script-terminator']);
export const uses3D = s => /WebGLRenderer|WebGPURenderer|getContext\(\s*['"](webgl|webgl2|experimental-webgl)/.test(s);
const hasLoop = s => /requestAnimationFrame|setAnimationLoop/.test(s);
const hits = (s, re, map = m => m[0]) => [...s.matchAll(re)].map(m => ({ text: map(m), index: m.index }));
const one = (cond, text) => cond ? [{ text, index: -1 }] : [];

export const RULES = [
  ['no-cdn', 'fail', s => hits(s, /\b(?:src|href)\s*=\s*["'](https?:)?\/\/(?!www\.w3\.org)[^"']+["']|import\s+[^;]*from\s+["']https?:|import\(\s*["']https?:|url\(\s*["']?https?:/g, m => m[0].slice(0, 90)),
    'external URL: the page must run offline from one file'],
  ['reduced-motion', 'fail', s => one(uses3D(s) && hasLoop(s) && !/prefers-reduced-motion/.test(s), '3D loop without a prefers-reduced-motion branch'),
    'needs a reduced-motion branch (draw one still frame, no loop)'],
  ['context-loss', 'warn', s => one(uses3D(s) && !/webglcontextlost/.test(s), 'no webglcontextlost handler'),
    'add preventDefault on webglcontextlost and a restore path (or a still fallback)'],
  ['pause-hidden', 'warn', s => one(uses3D(s) && hasLoop(s) && !/visibilitychange|IntersectionObserver/.test(s), 'loop never pauses when hidden or offscreen'),
    'pause the loop on visibilitychange or IntersectionObserver'],
  ['dpr-cap', 'warn', s => hits(s, /setPixelRatio\(\s*(?:window\.)?devicePixelRatio\s*\)/g),
    'cap pixel ratio: Math.min(devicePixelRatio, 2) at most, lower for heavy shaders'],
  ['no-context-null-check', 'warn', s => hits(s, /\b(\w+)\s*=\s*[\w.]+\.getContext\(\s*['"]webgl2?['"]/g).filter((h, i, all) => {
      const name = h.text.match(/\b(\w+)\s*=/)[1];
      return !new RegExp(String.raw`if\s*\(\s*!\s*${name}\s*[)|&]|${name}\s*\?|!\s*${name}\s*\)`).test(s);
    }).map(h => ({ ...h, text: h.text + ' ... never null-checked' })),
    'getContext can return null; keep a non-WebGL fallback'],
  ['transpose-matrix-multiply', 'fail', s => transposeHits(s),
    'vec4 * matrix is the TRANSPOSE multiply (drops translation, inverts rotation). Write matrix * vec4.'],
  ['reversed-smoothstep', 'warn', s => [...s.matchAll(/smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g)].filter(m => +m[1] > +m[2]).map(m => ({ text: m[0], index: m.index })),
    'smoothstep with edge0 >= edge1 is undefined by the spec; use 1.0 - smoothstep(b, a, x)'],
  ['same-random-two-axes', 'warn', s => hits(s, /(\w+)\.(x|y|z)\s*\+=\s*\(\s*(\w+\([^;]*?\))\s*-\s*0\.5\s*\)[^;]*;\s*\n\s*\1\.(?!\2)(x|y|z)\s*\+=\s*\(\s*\3\s*-\s*0\.5/g, m => m[0].slice(0, 80)),
    'the same hash drives two axes (displacement collapses to a diagonal); use decorrelated hashes'],
  ['clock-deprecated', 'warn', s => one(/new\s+(?:THREE\.)?Clock\s*\(/.test(s), 'THREE.Clock is deprecated'),
    'derive time from performance.now() or use THREE.Timer; prefer a time that can be set (seekable)'],
  ['import-meta-in-classic-script', 'fail', s => one(/<script(?![^>]*type=["']module["'])[^>]*>[\s\S]*?import\.meta[\s\S]*?<\/script>/.test(s), 'import.meta in a classic script'),
    'bundle with --define:import.meta.url=... or the page throws "Failed to construct URL" at load'],
  ['empty-media-src', 'fail', s => hits(s, /<(?:video|audio|img|source)\b[^>]*\bsrc=["']{2}/g),
    'src="" resolves to the page URL; use a data-* attribute until the media exists'],
  ['draco-cdn', 'fail', s => one(/gstatic\.com\/draco|setDecoderPath\(\s*['"]https?:/.test(s), 'Draco decoder fetched from a CDN'),
    'self-contain: setDecoderPath({js: blobUrl, wasm: blobUrl}) or use meshopt'],
  ['random-in-seek-page', 'warn', s => one(/__seek|renderFrame\s*\(/.test(s) && /Math\.random\s*\(/.test(s), 'Math.random in a page that is meant to be seekable'),
    'seed a deterministic generator so frame N is always identical'],
  ['inline-script-terminator', 'fail', s => scriptTerminators(s),
    'break the sequence (<\\/script) in vendored text'],
  ['draw-before-ready', 'warn', s => one(/new\s+(?:THREE\.)?VideoTexture/.test(s) && !/playsInline|playsinline/.test(s), 'VideoTexture source without playsinline'),
    'set muted, playsInline and a user-gesture path for sound'],
];

export function lintThree(src, { skip = [] } = {}) {
  const full = strip(String(src)); const appSrc = app(full); const out = [];
  for (const [id, level, test, msg] of RULES) {
    if (skip.includes(id)) continue;
    const h = test(FULL.has(id) ? full : appSrc);
    if (h.length) out.push(finding(`3d:${id}`, level, msg, { line: h[0].index >= 0 ? lineOf(full, h[0].index) : undefined, evidence: h.slice(0, 3).map(x => x.text) }));
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let fails = 0;
  for (const f of process.argv.slice(2)) {
    const src = fs.readFileSync(f, 'utf8'); const kb = (Buffer.byteLength(src) / 1024).toFixed(0);
    console.log(`\n${f}  (${kb} KB)`);
    const fs3 = lintThree(src);
    for (const x of fs3) { if (x.level === 'fail') fails++; console.log(`  ${x.level.toUpperCase()} ${x.id.slice(3)}: ${x.message}\n       ${x.evidence.join('\n       ')}`); }
    if (!fs3.length) console.log('  clean');
  }
  process.exit(fails ? 1 : 0);
}
