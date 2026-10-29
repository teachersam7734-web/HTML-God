// lint/common.mjs: helpers shared by the web, 3D and determinism lints.
import path from 'node:path';

export const WEB_EXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.tsx', '.ts', '.svelte', '.vue']);
export const isWebFile = f => !!f && WEB_EXT.has(path.extname(f).toLowerCase());

const blank = s => s.replace(/[^\n]/g, ' ');

// Same length and line count as the input, with HTML comments and vendored script bodies (over `big` bytes)
// blanked out, so app-code rules do not fire on a pasted library and line numbers stay true.
export function appSource(src, { big = 100000 } = {}) {
  return String(src)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, body, c) => body.length >= big ? a + blank(body) + c : m);
}

export function withoutHtmlComments(src) { return String(src).replace(/<!--[\s\S]*?-->/g, blank); }

// JavaScript (and GLSL) comments blanked, strings, template literals and regular expression literals kept, so a
// comment such as "// TODO: reduced motion later" or a commented-out CDN link is not read as code. Same length and
// lines as the input. Returns { text, open } where `open` is true when the text ends inside a string or template
// (an inline script cut short by a "</script" inside a string).
export function scanJs(src) {
  const s = String(src); const n = s.length; let out = ''; let i = 0; let open = false;
  const tpl = []; let depth = 0;
  const copy = j => { out += s.slice(i, j); i = j; };
  const blankTo = j => { out += s.slice(i, j).replace(/[^\n]/g, ' '); i = j; };
  // From just after a backtick or a closing "}" of ${...}: to the closing backtick (inclusive) or to "${" (inclusive).
  const template = () => {
    let j = i;
    while (j < n) {
      if (s[j] === '\\') { j += 2; continue; }
      if (s[j] === '`') { copy(j + 1); return; }
      if (s[j] === '$' && s[j + 1] === '{') { copy(j + 2); tpl.push(depth); depth = 0; return; }
      j++;
    }
    copy(n); open = true;
  };
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { let j = s.indexOf('\n', i); if (j < 0) j = n; blankTo(j); continue; }
    if (c === '/' && d === '*') { let j = s.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; blankTo(j); continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && s[j] !== c && s[j] !== '\n') { if (s[j] === '\\') j++; j++; }
      if (j >= n) open = true;
      copy(Math.min(n, j + 1)); continue;
    }
    if (c === '`') { copy(i + 1); template(); continue; }
    if (c === '{') { depth++; copy(i + 1); continue; }
    if (c === '}') {
      if (depth === 0 && tpl.length) { depth = tpl.pop(); copy(i + 1); template(); continue; }
      depth = Math.max(0, depth - 1); copy(i + 1); continue;
    }
    if (c === '/') {
      const before = out.replace(/\s+$/, '');
      const regexStart = !before || /[(,=:[!&|?{};+\-*%<>~^]$/.test(before) || /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await)$/.test(before);
      if (regexStart) {
        let j = i + 1, cls = false;
        while (j < n && s[j] !== '\n') {
          if (s[j] === '\\') { j += 2; continue; }
          if (s[j] === '[') cls = true; else if (s[j] === ']') cls = false; else if (s[j] === '/' && !cls) break;
          j++;
        }
        if (j < n && s[j] === '/') { copy(j + 1); continue; }
      }
    }
    copy(i + 1);
  }
  if (tpl.length) open = true;
  return { text: out, open };
}
export const blankJsComments = src => scanJs(src).text;

// CSS comments blanked, strings kept.
export function blankCssComments(src) {
  const s = String(src); const n = s.length; let out = ''; let i = 0;
  while (i < n) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '*') { let j = s.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; out += s.slice(i, j).replace(/[^\n]/g, ' '); i = j; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < n && s[j] !== c && s[j] !== '\n') { if (s[j] === '\\') j++; j++; } out += s.slice(i, j + 1); i = j + 1; continue; }
    out += c; i++;
  }
  return out;
}

const JS_TYPE = t => !t || /^(?:module|text\/javascript|application\/javascript|text\/babel|x-shader\/[\w-]+|text\/x-(?:glsl|shader|vertex|fragment)[\w-]*)$/i.test(t);
export const scriptType = open => { const m = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(open); return m ? m[1] : ''; };
export const isJsScript = open => JS_TYPE(scriptType(open));

// Every comment kind blanked for the file's language: HTML comments, then JS comments inside <script> bodies (and
// GLSL shader scripts) and CSS comments inside <style> bodies. `kind` is 'html', 'css' or 'js'; guessed when omitted.
export function kindOf(file, src = '') {
  const ext = file ? path.extname(file).toLowerCase() : '';
  if (ext === '.css') return 'css';
  if (['.html', '.htm', '.vue', '.svelte'].includes(ext)) return 'html';
  if (ext) return 'js';
  return /<(?:!doctype|html|head|body|script|style)\b/i.test(src) ? 'html' : 'js';
}

export function stripComments(src, kind = kindOf('', src)) {
  const s = String(src);
  if (kind === 'css') return blankCssComments(s);
  if (kind === 'js') return blankJsComments(s);
  return withoutHtmlComments(s)
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, body, c) => isJsScript(a) ? a + blankJsComments(body) + c : m)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, body, c) => a + blankCssComments(body) + c);
}

// The same text with everything outside script code blanked (HTML), or the whole text (JS files), or nothing (CSS).
// JS guards are looked for here only, so the CSS text "prefers-reduced-motion" never counts as a script guard.
export function scriptOnly(src, kind) {
  const s = String(src);
  if (kind === 'css') return blank(s);
  if (kind === 'js') return s;
  let out = ''; let last = 0;
  for (const m of s.matchAll(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi)) {
    const bodyStart = m.index + m[1].length;
    out += blank(s.slice(last, bodyStart));
    const keep = isJsScript(m[1]) && !/^x-shader|^text\/x-/i.test(scriptType(m[1]));
    out += keep ? m[2] : blank(m[2]);
    last = bodyStart + m[2].length;
  }
  return out + blank(s.slice(last));
}

// The same text with script bodies blanked (HTML), so CSS rules are read from CSS only. JS files keep their text
// (CSS in template strings), CSS files keep everything.
export function cssOnly(src, kind) {
  const s = String(src);
  if (kind !== 'html') return s;
  return s.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, body, c) => a + blank(body) + c);
}

export const uses3D = s => /WebGLRenderer|WebGPURenderer|getContext\(\s*['"](?:webgl2?|experimental-webgl|webgpu)['"]/.test(s);
export const isSeekPage = s => /\bwindow\.seek\s*=|\bwindow\.__seek\b|\b__seek\s*=|\bfunction\s+renderFrame\s*\(|\brenderFrame\s*[=:]\s*(?:function|\(|async)|\bwindow\.renderFrame\b/.test(s);

// [start, end] index ranges of the bodies of at-rule blocks (e.g. @media, @supports) whose prelude matches `cond`.
export function blockRanges(src, atRule, cond) {
  const out = []; const re = new RegExp(`@${atRule}\\b([^{;]*)\\{`, 'gi'); let m;
  while ((m = re.exec(src))) {
    if (!cond.test(m[1])) continue;
    let depth = 1, i = re.lastIndex;
    for (; i < src.length && depth; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}') depth--; }
    out.push([re.lastIndex, i]);
  }
  return out;
}

export const inside = (ranges, idx) => ranges.some(([a, b]) => idx >= a && idx < b);

export function allMatches(src, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  return [...src.matchAll(g)];
}
