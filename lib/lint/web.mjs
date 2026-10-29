// lint/web.mjs: the web lane's rules (architecture section 5, lint-web). Heuristics: they catch the common mistakes,
// they do not prove a page correct. Reported, never blocking. WebGL loops belong to lint/three.mjs and seek pages to
// lint/determinism.mjs, so those are not repeated here.
//
// CLI: node web.mjs page.html [...]   (exit 1 when any 'fail' finding)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { finding, lineOf, result, formatResult } from '../gate.mjs';
import { appSource, uses3D, blockRanges, inside, allMatches, stripComments, scriptOnly, kindOf } from './common.mjs';
import { DEFAULTS } from '../profile.mjs';

const CSS_RM = /@media[^{]*prefers-reduced-motion/i;
// A reduced-motion guard in script code (comments already removed, CSS text excluded): a matchMedia query for
// prefers-reduced-motion (directly or through a string constant), gsap.matchMedia, React's useReducedMotion, Motion's
// reducedMotion config, or a variable named for it that the code reads.
function jsGuard(js) {
  if (/matchMedia\s*\(/.test(js) && /prefers-reduced-motion/i.test(js)) return true;
  return /\buseReducedMotion\s*\(|\breducedMotion\s*[:=]\s*["'`](?:user|always)|MotionGlobalConfig\.skipAnimations|\bSenseiMotionGate\b|\.reduce(?:d|dMotion|Motion)?\b(?!\s*\()|\b(?:prefersReducedMotion|reducedMotion|reduceMotion|isReducedMotion)\b/.test(js);
}

// A requestAnimationFrame loop (a callback that schedules itself), as opposed to a one-shot rAF that coalesces a
// redraw. Named callbacks are followed to their definition; an inline callback is a loop when its body calls rAF again.
function rafLoop(js) {
  if (/setAnimationLoop\s*\(/.test(js)) return true;
  for (const m of js.matchAll(/requestAnimationFrame\s*\(\s*(?:this\.)?([A-Za-z_$][\w$]*)\s*\)/g)) {
    const name = m[1].replace(/[$]/g, '\\$');
    const def = new RegExp(String.raw`(?:function\s+${name}\s*\(|\b${name}\s*[=:]\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>))`).exec(js);
    if (!def) return true;                              // defined elsewhere: assume it is a loop
    if (new RegExp(String.raw`requestAnimationFrame\s*\(\s*(?:this\.)?${name}\b`).test(js.slice(def.index, def.index + 4000))) return true;
  }
  for (const m of js.matchAll(/requestAnimationFrame\s*\(\s*(?:function\s*([\w$]*)\s*\([^)]*\)|\([^)]*\)\s*=>|[\w$]+\s*=>)\s*\{/g)) {
    let d = 1, i = m.index + m[0].length; for (; i < js.length && d; i++) { if (js[i] === '{') d++; else if (js[i] === '}') d--; }
    if (/requestAnimationFrame\s*\(/.test(js.slice(m.index + m[0].length, i))) return true;
  }
  return false;
}

// CSS rules as { prelude, body, decls, start, ancestors } from text whose comments are already blanked. Rough but
// enough to compare selectors by name: nested blocks are removed from `decls`, at-rule preludes become ancestors.
const ownDecls = body => { let d = body, prev; do { prev = d; d = d.replace(/[^;{}]*\{[^{}]*\}/g, ' '); } while (d !== prev); return d; };
export function cssRules(css) {
  const out = []; const stack = []; let boundary = 0; let q = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (q) { if (c === '\\') i++; else if (c === q || c === '\n') q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '{') { stack.push({ prelude: css.slice(boundary, i).replace(/\s+/g, ' ').trim(), start: i + 1 }); boundary = i + 1; }
    else if (c === '}') {
      const top = stack.pop(); boundary = i + 1;
      if (!top) continue;
      const body = css.slice(top.start, i);
      if (!top.prelude.startsWith('@')) out.push({ prelude: top.prelude, body, decls: ownDecls(body), start: top.start, ancestors: stack.map(x => x.prelude) });
    } else if (c === ';') boundary = i + 1;
  }
  return out;
}
const splitSelectors = p => { const out = []; let d = 0, cur = ''; for (const ch of p) { if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean); };
const UNIVERSAL = /^(?:\*|(?:html|body|:root) \*|\*::?(?:before|after)|\*:not\([^)]*\))$/;
const inReduce = r => r.ancestors.some(a => /^@media\b.*prefers-reduced-motion\s*:\s*reduce/i.test(a));
const inNoPref = r => r.ancestors.some(a => /^@media\b.*prefers-reduced-motion\s*:\s*no-preference/i.test(a));

// Keyframe animations whose selectors are not reset under reduce. Returns null when the page applies its keyframes
// in a way this cannot see (inline styles, script), so the caller falls back to "some reduce block exists".
function unresetAnimations(css, vt = false) {
  const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]);
  if (!names.length) return null;
  const rules = cssRules(css);
  const usesName = v => names.some(n => new RegExp(`(?:^|[\\s,])${n.replace(/[-]/g, '\\-')}(?:$|[\\s,])`).test(v));
  const animated = rules.filter(r => !r.ancestors.some(a => /^@keyframes/i.test(a)) && !inReduce(r) && !inNoPref(r) &&
    [...r.decls.matchAll(/(?:^|[;\s])animation(?:-name)?\s*:\s*([^;]+)/gi)].some(m => !/^\s*(?:none|initial|unset|inherit)\s*$/i.test(m[1]) && usesName(m[1])) &&
    !/@media[^{]*prefers-reduced-motion/i.test(r.body));
  if (!animated.length) return null;
  const reset = new Set(); let universal = false;
  for (const r of rules) {
    if (!inReduce(r) || !/(?:^|[;\s])animation(?:-[\w-]+)?\s*:/i.test(r.decls)) continue;
    for (const sel of splitSelectors(r.prelude)) { if (UNIVERSAL.test(sel)) universal = true; reset.add(sel); }
  }
  if (universal) return [];
  return animated.flatMap(r => splitSelectors(r.prelude).filter(sel => !covered(sel, reset, vt)).map(sel => ({ sel, start: r.start })));
}

// Does a reset selector R (under reduce) reach the animated selector A? By name only: the same selector, A a
// refinement of R (".rv .sk-c" reaches ".rv .sk-c.sk-inl"), or R one compound whose parts all appear in A's last
// compound (".card" reaches ".grid .card:hover"). View Transition pseudo-elements are reached when vt is true.
const parts = c => c.match(/[.#]?[\w-]+(?:\([^)]*\))?|\[[^\]]*\]|::?[\w-]+(?:\([^)]*\))?/g) || [];
function covered(a, reset, vt) {
  if (/::view-transition/.test(a) && vt) return true;
  for (const r of reset) {
    if (a === r || (a.startsWith(r) && /^[.:#[]/.test(a.slice(r.length)))) return true;
    if (!/[\s>+~]/.test(r)) { const last = a.split(/\s*[\s>+~]\s*/).pop(); const lp = parts(last); if (parts(r).length && parts(r).every(p => lp.includes(p))) return true; }
  }
  return false;
}

// Each animation system, how to spot it, and which kind of reduced-motion path it needs.
const SYSTEMS = [
  { id: 'css-keyframes', re: /@keyframes\s+[\w-]+/, needs: 'css', fix: 'Add @media (prefers-reduced-motion: reduce) { ... animation: none; } (or a short opacity-only version) for these animations.' },
  { id: 'css-motion-transitions', re: /transition(?:-property)?\s*:[^;}"']*\b(?:transform|translate|scale|rotate|all|top|left|right|bottom|margin|inset)\b/, needs: 'css', fix: 'Under @media (prefers-reduced-motion: reduce), drop movement transitions (keep colour and opacity).' },
  { id: 'scroll-driven', re: /animation-timeline\s*:/, needs: 'css', fix: 'Wrap the scroll-driven animation in @media (prefers-reduced-motion: no-preference), or set animation: none under reduce.' },
  { id: 'requestAnimationFrame', re: /requestAnimationFrame\s*\(/, needs: 'js', skip3D: true, fix: 'Check matchMedia("(prefers-reduced-motion: reduce)") before starting the loop: draw one still frame instead, and listen for changes.' },
  { id: 'web-animations', re: /\.animate\(\s*(?:[[{]|[A-Za-z_$][\w$.]*\s*[,)(])/, needs: 'js', fix: 'Skip or shorten element.animate() when matchMedia("(prefers-reduced-motion: reduce)").matches.' },
  { id: 'gsap', re: /\bgsap\.(?:to|from|fromTo|timeline)\s*\(/, needs: 'js', fix: 'Use gsap.matchMedia() with "(prefers-reduced-motion: no-preference)" for the motion and a reduce branch that sets end states.' },
  { id: 'motion', re: /\bMotion\.(?:animate|scroll|inView|timeline)\s*\(|from\s+['"](?:motion|framer-motion)(?:\/[\w-]+)?['"]/, needs: 'js', fix: 'Gate Motion animations on matchMedia("(prefers-reduced-motion: reduce)") (or useReducedMotion in React).' },
  { id: 'autoplay-video', re: /<video\b[^>]*\bautoplay\b/i, needs: 'js', fix: 'Under reduced motion, do not autoplay: remove the attribute from script and show the poster, with a play button.' },
  { id: 'view-transitions', re: /startViewTransition\s*\(/, needs: 'any', fix: 'Skip document.startViewTransition under reduced motion (update the DOM directly), or set ::view-transition-group(*) { animation: none } under reduce.' },
  { id: 'lottie', re: /lottie\.loadAnimation\s*\(|<(?:dotlottie|lottie)-player\b|new\s+DotLottie\s*\(/, needs: 'js', fix: 'Under reduced motion, load the animation paused on a meaningful frame (autoplay false) and offer a play control.' },
];

// Vendored libraries inlined into a page carry their own pointer and key handlers (GSAP, Lenis); judge the page's
// own code only. A body counts as vendored when it opens with a licence banner or is minified (very long lines).
const vendoredBody = b => b.length > 4000 && (/^\s*\/\*[!*][\s\S]{0,400}?(?:@license|licen[cs]e|copyright|\(c\)|©)/i.test(b) || b.length / Math.max(1, b.split('\n').length) > 400);
const ownCode = s => s.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, body, c) => vendoredBody(body) ? a + body.replace(/[^\n]/g, ' ') + c : m);

export function lintWeb(src, { file = '', profile = DEFAULTS } = {}) {
  const kind = kindOf(file, String(src));
  // Every rule reads text with HTML, CSS and JS comments blanked (same length, so line numbers stay true).
  const raw = stripComments(src, kind);
  const s = appSource(raw);
  const own = ownCode(s);
  // The same text with @media and @supports preludes blanked, so a condition such as @supports (animation-timeline: view())
  // is not read as a use of the feature it tests.
  const body = s.replace(/@(?:supports|media|container)\b[^{;]*/gi, m => m.replace(/[^\n]/g, ' '));
  const out = [];
  const at = re => { const m = s.match(re); return m ? { line: lineOf(s, m.index), text: m[0] } : null; };
  const js = scriptOnly(s, kind);
  // CSS read from <style> bodies (HTML) or the whole file (CSS, and JS with CSS in strings).
  const css = kind === 'html' ? [...s.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n') : kind === 'css' ? s : s;
  const cssRM = CSS_RM.test(kind === 'js' ? s : css), jsRM = jsGuard(js);
  const reduceBlocks = blockRanges(css, 'media', /prefers-reduced-motion\s*:\s*reduce/i).map(([a, b]) => css.slice(a, b));
  const three = uses3D(s);

  for (const sys of SYSTEMS) {
    if (sys.skip3D && three) continue;
    // Script systems are looked for in script code only, CSS systems in CSS (plus markup for autoplay video).
    const hay = sys.needs === 'js' && sys.id !== 'autoplay-video' && sys.id !== 'lottie' ? js : s;
    const m = hay.match(sys.re); if (!m) continue;
    if (sys.id === 'requestAnimationFrame' && !rafLoop(js)) continue;
    const hit = { line: lineOf(s, m.index), text: m[0] };
    let ok; let evidence = [hit.text]; let message = `${sys.id} motion with no reduced-motion path.`;
    if (sys.id === 'css-keyframes' && kind !== 'js') {
      const missing = unresetAnimations(css, jsRM || reduceBlocks.some(b => /::view-transition|@view-transition/.test(b)));
      if (missing === null) ok = cssRM || jsRM;
      else if (!missing.length) ok = true;
      else {
        ok = false;
        const sels = [...new Set(missing.map(x => x.sel))];
        message = `${sels.length} animated selector(s) not reset under prefers-reduced-motion: reduce.`;
        evidence = sels.slice(0, 3);
        const first = s.indexOf(css.slice(missing[0].start, missing[0].start + 40));
        if (first >= 0) hit.line = lineOf(s, first);
      }
    } else if (sys.id === 'view-transitions') ok = jsRM || reduceBlocks.some(b => /::view-transition|@view-transition/.test(b));
    else ok = sys.needs === 'js' ? jsRM : (cssRM || jsRM);
    if (!ok) out.push(finding(`reduced-motion:${sys.id}`, 'fail', message, { fix: sys.fix, line: hit.line, evidence }));
  }

  const noPref = blockRanges(s, 'media', /prefers-reduced-motion\s*:\s*no-preference/i);
  for (const m of allMatches(s, /transition(?:-property)?\s*:\s*all\b/i)) {
    out.push(finding('transition-all', 'warn', '"transition: all" animates every property, including layout and theme colours, and costs frames.',
      { fix: 'Name the properties: transition: transform 200ms, opacity 200ms.', line: lineOf(s, m.index), evidence: [m[0]] }));
    break;
  }
  for (const m of allMatches(body, /(?:^|[}\s,;>])(?:html|:root)\s*\{[^}]*scroll-behavior\s*:\s*smooth/i)) {
    if (inside(noPref, m.index)) continue;
    out.push(finding('smooth-scroll-on-html', 'warn', 'scroll-behavior: smooth on html makes every jump and find-in-page glide, including for reduced-motion users.',
      { fix: 'Move it inside @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth } }, or scroll smoothly only from the controls that need it.', line: lineOf(s, m.index) }));
    break;
  }
  const supportsTL = blockRanges(s, 'supports', /animation-timeline|scroll-timeline|view-timeline|timeline-scope/i);
  for (const m of allMatches(body, /animation-timeline\s*:|(?<![-\w])(?:scroll|view)-timeline(?:-name)?\s*:/i)) {
    if (inside(supportsTL, m.index)) continue;
    out.push(finding('scroll-driven-unguarded', 'warn', 'Scroll-driven animation without @supports: browsers without it apply the animation with no timeline (jumps to the end or runs on load).',
      { fix: 'Wrap it in @supports (animation-timeline: view()) { ... } with a static fallback outside, and reset it for print.', line: lineOf(s, m.index) }));
    break;
  }
  if (/new\s+(?:Scroll|View)Timeline\s*\(/.test(s) && !/['"](?:Scroll|View)Timeline['"]\s+in\s+window|typeof\s+(?:Scroll|View)Timeline|window\.(?:Scroll|View)Timeline\s*(?:&&|\?)|CSS\.supports\(/.test(s))
    out.push(finding('scroll-timeline-js-unguarded', 'warn', 'new ScrollTimeline/ViewTimeline without a feature check.', { fix: "Guard with if ('ScrollTimeline' in window) and keep a fallback (IntersectionObserver or a static state).", line: at(/new\s+(?:Scroll|View)Timeline/).line }));
  const vt = at(/startViewTransition\s*\(/);
  if (vt && !/if\s*\(\s*!?\s*document\.startViewTransition|document\.startViewTransition\s*(?:\?|&&)|['"]startViewTransition['"]\s+in\s+document|\?\.\s*startViewTransition|typeof\s+document\.startViewTransition/.test(s))
    out.push(finding('view-transition-unguarded', 'warn', 'document.startViewTransition called without a feature check; it throws where unsupported.',
      { fix: 'if (!document.startViewTransition) { update(); return; } document.startViewTransition(update);', line: vt.line }));
  const hover = blockRanges(s, 'media', /hover\s*:\s*hover|pointer\s*:\s*fine|any-pointer\s*:\s*fine/i);
  for (const m of allMatches(body, /cursor\s*:\s*none/i)) {
    if (inside(hover, m.index)) continue;
    out.push(finding('cursor-none-without-hover-query', 'warn', 'cursor: none outside a hover media query hides the pointer on touch and pen devices and for anyone whose custom cursor fails to load.',
      { fix: 'Put it inside @media (hover: hover) and (pointer: fine) { ... }, and keep the system cursor under forced colours and reduced motion.', line: lineOf(s, m.index) }));
    break;
  }
  if (/pointerdown|mousedown|touchstart|dragstart|draggable\s*=\s*["']true|Draggable\.create\s*\(/i.test(own) && /pointermove|mousemove|touchmove|\bdrag(?:over|enter)?\b|Draggable\.create/i.test(own) && !/keydown|keyup|onkey|addEventListener\(\s*['"]key/i.test(own))
    out.push(finding('drag-without-keys', 'warn', 'Dragging with no keyboard path: keyboard and switch users cannot do this.',
      { fix: 'Make the draggable focusable (tabindex="0", a role and an aria-label) and move it with arrow keys (Shift for bigger steps), or give buttons that do the same move.', line: at(/pointerdown|mousedown|touchstart|dragstart|draggable|Draggable/i).line }));
  const toast = at(/class(?:Name)?\s*=\s*["'`][^"'`]*\b(?:toast|snackbar)\b|\.(?:toast|snackbar)\b|\b(?:show|create|make|add)(?:Toast|Snackbar)\b/i);
  if (toast && !/aria-live\s*=|ariaLive|role\s*=\s*\\?["'](?:status|alert|log)|setAttribute\(\s*['"](?:role|aria-live)['"]/i.test(s))
    out.push(finding('toast-without-live-region', 'warn', 'Toasts with no live region are silent for screen-reader users.',
      { fix: 'Render toasts inside one persistent container with role="status" aria-live="polite" (role="alert" for errors) that exists before the first message.', line: toast.line }));
  if (profile.offline !== false) {
    const ext = [];
    const U = String.raw`(?:https?:)?\/\/[^"'\s,)]+`;
    const nets = [
      new RegExp(String.raw`<(?:script|img|video|audio|source|iframe|embed|track|input|frame)\b[^>]*?\bsrc\s*=\s*["']${U}`, 'gi'),
      new RegExp(String.raw`<(?:img|source)\b[^>]*?\b(?:srcset|imagesrcset)\s*=\s*["'][^"']*?${U}`, 'gi'),
      new RegExp(String.raw`<video\b[^>]*?\bposter\s*=\s*["']${U}`, 'gi'),
      new RegExp(String.raw`<(?:image|use|feImage)\b[^>]*?\b(?:xlink:)?href\s*=\s*["']${U}`, 'gi'),
      new RegExp(String.raw`<object\b[^>]*?\bdata\s*=\s*["']${U}`, 'gi'),
      new RegExp(String.raw`<form\b[^>]*?\baction\s*=\s*["']${U}`, 'gi'),
      new RegExp(String.raw`\burl\(\s*["']?${U}`, 'gi'),
      new RegExp(String.raw`@import\s+(?:url\()?\s*["']${U}`, 'gi'),
      /\bimport\s+[^;]*?\bfrom\s+["']https?:\/\/[^"']+|\bimport\s*\(\s*["'`]https?:\/\/[^"'`]+|\bimport\s*["']https?:\/\/[^"']+|\bimportScripts\s*\(\s*["'`]https?:\/\/[^"'`]+/g,
      /\bfetch\(\s*["'`]https?:\/\/[^"'`]+|\.open\(\s*["']\w+["']\s*,\s*["'`]https?:\/\/[^"'`]+/g,
      /\bnew\s+(?:Shared)?Worker\s*\(\s*["'`]https?:\/\/[^"'`]+|\bnew\s+(?:WebSocket|EventSource)\s*\(\s*["'`](?:wss?|https?):\/\/[^"'`]+/g,
      /\bsendBeacon\s*\(\s*["'`](?:https?:)?\/\/[^"'`]+/g,
      // script.src = "https://..." and the like (not .href: assigning a link or location is navigation, not a load)
      /\.(?:src|srcset|poster|action)\s*=\s*["'`](?:https?:)?\/\/[^"'`]+|\.setAttribute\(\s*["'](?:src|srcset|poster|data|action)["']\s*,\s*["'`](?:https?:)?\/\/[^"'`]+/g,
    ];
    // <link> tags that name a page rather than load one (canonical, alternate languages, licence, author) are not
    // requests; preload, stylesheet, icon, modulepreload and preconnect are.
    const NON_LOADING = /^(?:canonical|alternate|license|author|me|bookmark|help|external|nofollow|noopener|noreferrer|tag|privacy-policy|terms-of-service|shortlink|search|webmention|pingback|next|prev)$/i;
    const linkNet = new RegExp(String.raw`<link\b[^>]*?\bhref\s*=\s*["']${U}`, 'gi');
    for (const m of raw.matchAll(linkNet)) {
      const tag = raw.slice(m.index, raw.indexOf('>', m.index) + 1 || undefined);
      const rel = (/\brel\s*=\s*["']?([^"'>]+)/i.exec(tag) || [, ''])[1].trim().split(/\s+/).filter(Boolean);
      if (rel.length && rel.every(r => NON_LOADING.test(r))) continue;
      if (!/www\.w3\.org/.test(m[0])) ext.push(m);
    }
    for (const re of nets) for (const m of raw.matchAll(re)) if (!/www\.w3\.org/.test(m[0])) ext.push(m);
    ext.sort((a, b) => a.index - b.index);
    if (ext.length) out.push(finding('no-cdn', 'fail', `${ext.length} network reference(s) in a deliverable the profile marks offline.`,
      { fix: 'Vendor the file locally and inline it (fonts as base64 woff2, libraries inside <script> with their licence header). If this project is meant to be online, set "offline": false in .sensei/profile.json.', line: lineOf(raw, ext[0].index), evidence: ext.slice(0, 3).map(m => m[0]) }));
  }
  const looksVendored = body => body.length > 30000 && (body.split('\n').length < body.length / 400 || /\/\*!|@license/.test(body));
  const hasNotice = body => /@license|licen[cs]e|copyright|\(c\)|©|SPDX-License-Identifier/i.test(body.slice(0, 3000) + body.slice(-4000));
  const bodies = /\.html?$/i.test(file) ? [...String(src).matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => ({ body: m[1], index: m.index })) : (/\.(?:m?js|cjs)$/i.test(file) ? [{ body: String(src), index: 0 }] : []);
  for (const b of bodies) if (looksVendored(b.body) && !hasNotice(b.body)) {
    out.push(finding('vendored-without-notice', 'warn', `A ${(b.body.length / 1024).toFixed(0)} KB vendored script carries no licence notice.`,
      { fix: 'Keep the library\'s licence header (esbuild keeps "Bundled license information" unless --legal-comments=none), add one by hand if the build dropped it, and add a row to .sensei/licences.json.', line: lineOf(String(src), b.index) }));
    break;
  }
  // Cross-document View Transitions are opted into in CSS, not through startViewTransition.
  const xvt = at(/@view-transition\s*\{[^}]*navigation\s*:\s*auto/i);
  if (xvt && !blockRanges(s, 'media', /prefers-reduced-motion/i).some(r => /@view-transition|::view-transition/.test(s.slice(r[0], r[1]))))
    out.push(finding('cross-document-vt-without-reduced-motion', 'warn', '@view-transition { navigation: auto } with no reduced-motion override: every page change animates for users who asked for less motion.',
      { fix: '@media (prefers-reduced-motion: reduce) { @view-transition { navigation: none } }', line: xvt.line }));
  // Media players that fetch their engine from a CDN unless told otherwise (sensei-lottie-rive-video, tested).
  if (profile.offline !== false) {
    const dl = at(/new\s+DotLottie(?:Worker)?\s*\(|<dotlottie-(?:player|wc)\b/);
    if (dl && !/setWasmUrl\s*\(/.test(own)) out.push(finding('dotlottie-wasm-from-cdn', 'warn', 'dotLottie with no setWasmUrl: the player fetches its WASM from jsdelivr or unpkg, so the offline page breaks with no network.',
      { fix: 'Inline the WASM (base64 to a Blob URL) and call DotLottie.setWasmUrl(url) before creating the player.', line: dl.line }));
    const rv = at(/new\s+(?:rive\.)?Rive\s*\(/);
    if (rv && !/setWasmBinary\s*\(|setWasmUrl\s*\(|canvas-single|webgl2-single/.test(own)) out.push(finding('rive-wasm-from-cdn', 'warn', 'Rive runtime with no local WASM: it fetches rive.wasm from unpkg unless the single-file build or setWasmBinary is used.',
      { fix: 'Use @rive-app/canvas-single (WASM inside), or RuntimeLoader.setWasmBinary(bytes) with setWasmFallbackUrl(null).', line: rv.line }));
    if (rv && !/enableRiveAssetCDN\s*:\s*false/.test(own)) out.push(finding('rive-asset-cdn', 'warn', 'Rive may fetch referenced fonts and images from its CDN.',
      { fix: 'Pass enableRiveAssetCDN: false and embed the assets in the .riv.', line: rv.line }));
    for (const m of allMatches(raw, /<track\b[^>]*\bsrc\s*=\s*["'](?!data:|blob:|https?:|\/\/)[^"']+/gi)) {
      out.push(finding('relative-track-offline', 'warn', 'A caption track loaded by relative path fails over strict file:// (a double-clicked page).',
        { fix: 'Embed the WebVTT as a data: URI (or a Blob URL built from inline text).', line: lineOf(raw, m.index), evidence: [m[0]] }));
      break;
    }
  }
  for (const v of allMatches(raw, /<video\b[^>]*>[\s\S]*?<\/video>/gi)) {
    const srcs = [...v[0].matchAll(/<source\b[^>]*>/gi)].map(x => x[0]);
    if (srcs.length && srcs.every(x => /hvc1|hev1|hevc|\.mov["']/i.test(x))) {
      out.push(finding('hevc-only-video', 'warn', 'HEVC is the only video source: Chrome failed to load it in testing (MediaError 4).',
        { fix: 'Add an H.264 MP4 (and AV1 or VP9 WebM) source; keep HEVC only as an extra for Apple alpha.', line: lineOf(raw, v.index) }));
      break;
    }
  }
  const loopVid = at(/<video\b[^>]*\bautoplay\b[^>]*\bloop\b|<video\b[^>]*\bloop\b[^>]*\bautoplay\b/i);
  if (loopVid && !/\.pause\s*\(|<video\b[^>]*\bcontrols\b/i.test(own)) out.push(finding('looping-video-without-pause', 'warn', 'A looping autoplay video with no way to pause it (WCAG 2.2.2 for motion lasting over five seconds).',
    { fix: 'Add a visible pause and play button that calls video.pause() and play(), and keep the paused state.', line: loopVid.line }));
  const ac = at(/new\s+(?:window\.)?(?:webkit)?AudioContext\s*\(/);
  if (ac) {
    if (!/\.resume\s*\(/.test(own)) out.push(finding('audio-without-unlock', 'warn', 'An AudioContext with no resume(): browsers start it suspended until a user gesture, so the first sounds are silent.',
      { fix: 'Call ctx.resume() inside the first pointerdown or keydown handler, and check ctx.state before scheduling.', line: ac.line }));
    // Script code only: a <video muted> attribute is not a sound control for the page's own audio.
    const js = /<script/i.test(own) ? [...own.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n') : own;
    if (!/\bmute|muted|volume/i.test(js)) out.push(finding('audio-without-mute', 'warn', 'Sound with no mute or volume control.',
      { fix: 'Add a visible mute toggle wired to a master GainNode, remember the choice, and start muted where sound is not essential.', line: ac.line }));
    const st = at(/setTimeout\s*\([^;]{0,200}?(?:\.start\s*\(|\bplay\w*\s*\(|\b(?:sfx|sound|beep|blip)\w*\s*\()/i);
    if (st) out.push(finding('audio-timed-by-settimeout', 'warn', 'A sound scheduled with setTimeout drifts by tens of milliseconds and stalls in background tabs.',
      { fix: 'Schedule on ctx.currentTime with a short look-ahead loop (sensei-audio) and start() at the exact time.', line: st.line }));
  }
  const mk = at(/\bmarkers\s*:\s*true\b/);
  if (mk) out.push(finding('scrolltrigger-markers', 'warn', 'ScrollTrigger markers: true left on.', { fix: 'Remove markers before release (or tie them to a debug flag).', line: mk.line }));
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let fails = 0;
  for (const f of process.argv.slice(2)) {
    const res = result('lint-web', f, lintWeb(fs.readFileSync(f, 'utf8'), { file: f }));
    if (res.verdict === 'fail') fails++;
    console.log(res.findings.length ? formatResult(res) : `${path.basename(f)}: clean`);
  }
  process.exit(fails ? 1 : 0);
}
