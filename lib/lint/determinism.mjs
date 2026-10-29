// lint/determinism.mjs: the seek contract for film pages (pages with window.seek, __seek or renderFrame).
// Frame N must be a pure function of t: render it twice, in any order, and get the same pixels. Wall-clock time,
// unseeded randomness, timers, free-running CSS animation and playing media all break that.
//
// CLI: node determinism.mjs page.html [...]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { finding, lineOf, result, formatResult } from '../gate.mjs';
import { appSource, isSeekPage, stripComments } from './common.mjs';

const RULES = [
  ['date-now', 'fail', /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bperformance\.timeOrigin\b|\bdocument\.timeline\.currentTime\b/, 'Wall-clock time in a seek page (Date, performance.timeOrigin or document.timeline.currentTime).', 'Derive everything from the t passed to seek/renderFrame.'],
  ['performance-now', 'warn', /\bperformance\.now\s*\(/, 'performance.now() in a seek page.', 'Use it only in the live-preview driver that calls seek(t); never inside render code.'],
  ['unseeded-random', 'fail', /\bMath\.random\s*\(|crypto\.getRandomValues\s*\(|crypto\.randomUUID\s*\(/, 'Unseeded randomness: frame N changes between renders.', 'Use a seeded generator (for example mulberry32(seed)) created once, or hash(t, index) per element; derive ids from a counter, not crypto.randomUUID().'],
  ['timers', 'fail', /\bset(?:Timeout|Interval)\s*\(/, 'Timers run on wall time, not on t.', 'Schedule by comparing t with each event time inside seek(t).'],
  ['raf-state', 'warn', /requestAnimationFrame\s*\(/, 'requestAnimationFrame in a seek page.', 'Keep rAF only as a preview driver that calls seek(clock()); state must not accumulate between frames (no x += v).'],
  ['css-animation', 'fail', /@keyframes\s+[\w-]+|(?<![-\w])animation\s*:\s*[^;}"']*\d+m?s/, 'CSS animations run on the wall clock, not on t.', 'Drive them from seek: pause them (animation-play-state: paused) and set each one\'s currentTime from t through document.getAnimations(), or compute the style from t.'],
  ['css-transition', 'warn', /transition\s*:\s*(?!none)[^;}"']*\d+m?s/, 'CSS transitions animate over wall time after each seek.', 'Set transition: none on film elements; interpolate in seek(t).'],
  ['gsap-free-running', 'warn', /gsap\.timeline\(\s*(?:\{(?![^}]*paused\s*:\s*true)[^}]*\})?\s*\)|gsap\.(?:to|from|fromTo)\s*\(/, 'GSAP tween or timeline that plays by itself.', 'Build one timeline with { paused: true } and call tl.seek(t) (or tl.time(t)) inside seek.'],
  ['media-playback', 'warn', /<(?:video|audio)\b[^>]*\bautoplay\b|\.play\s*\(\s*\)/, 'Playing media advances on its own clock.', 'Pause media and set currentTime from t in seek (await the seeked event before capture).'],
];

// CSS animations driven from seek, the fix this lint recommends: paused (animation-play-state: paused) and set from t,
// either through document.getAnimations() and currentTime, or through a negative animation-delay computed from t.
export function seekDrivenCss(s) {
  if (!/animation-play-state\s*:\s*paused|animationPlayState\s*=\s*["'`]paused/.test(s)) return false;
  const viaAnimations = /getAnimations\s*\(/.test(s) && /\.currentTime\s*=/.test(s);
  const viaDelay = /\.animationDelay\s*=|setProperty\(\s*["'`](?:animation-delay|--[\w-]*delay[\w-]*)["'`]/.test(s) && /-\s*\$\{|["'`]-["'`]\s*\+|\(\s*-\s*[\w.]+|-\s*t\b/.test(s);
  return viaAnimations || viaDelay;
}

export function lintDeterminism(src, { force = false } = {}) {
  const s = appSource(stripComments(src));
  if (!force && !isSeekPage(s)) return [];
  const out = [];
  const driven = seekDrivenCss(s);
  for (const [id, level, re, msg, fix] of RULES) {
    if (id === 'css-animation' && driven) continue;
    const m = s.match(re);
    if (m) out.push(finding(`seek:${id}`, level, msg, { fix, line: lineOf(s, m.index), evidence: [m[0]] }));
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  for (const f of process.argv.slice(2)) {
    const res = result('lint-determinism', f, lintDeterminism(fs.readFileSync(f, 'utf8')));
    console.log(res.findings.length ? formatResult(res) : `${f}: clean (or not a seek page)`);
  }
}
