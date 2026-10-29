#!/usr/bin/env node
// tokens.mjs: theme JSON to CSS custom-property blocks with a WCAG contrast gate, and a scanner that finds where a
// stylesheet's themes leak out of their token blocks.
//
//   node tokens.mjs build themes.json [--out themes.css] [--selector 'html[data-theme="{name}"]'] [--json report.json]
//   node tokens.mjs check themes.json          the gate only, no CSS
//   node tokens.mjs scan styles.css [--attr data-theme] [--json report.json]
//
// build/check: every theme is checked on the pairs that matter. Exit 1 when any required pair fails or a token is
// missing; the report goes to stderr (stdout carries the CSS when there is no --out).
//   text, text-soft on bg and surface  4.5   (body and secondary text, on the page and on cards)
//   on-brand on brand                  4.5   (button labels)
//   brand on bg                        3     (brand as UI colour or large text)
//   line on bg and surface             3     (control boundaries, WCAG 1.4.11)
// Colour tokens must be hex (#rgb, #rrggbb); a value with alpha cannot be judged without what is behind it: it is
// listed as not checked (pixel-sample it with sensei-direction's style-contrast.mjs). Warns on colour-named tokens
// (--violet, --red ...) inside a theme: name tokens by role, because themes reassign colours.
//
// scan: counts the rules scoped to a theme selector (html[data-theme="x"] ... or [data-theme=x] ...) and splits them
// into token rules (only custom properties set) and component overrides (any normal property). Many component
// overrides mean structural differences leaked out of the tokens. Also lists colour-named custom properties.
// Exit 0 always (it is a report).
//
// verified: Windows 10, Node 24: build and check on ../examples/themes.example.json (ink and paper pass, pulse-bad
//           fails the four measured pairs, exit 1); scan on Ultra Bookworm's app/styles.css in the owner's Ultra Bookworm project (not shipped) (see SKILL.md 8)
//           and on ../fixtures/leaky.css (scripts/test-tokens.mjs).
// not verified: CSS with nested rules or @layer blocks (the scanner reads flat rules and @media bodies); oklch or
//           named colours as token values (not judged, reported as not checked).
// Origin: code-ui/tokens.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), extended with check, scan, short hex,
//         alpha handling and the colour-name warning.
import fs from 'node:fs';

const [cmd, file, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
if (!['build', 'check', 'scan'].includes(cmd) || !file) {
  console.error('usage: node tokens.mjs build|check themes.json [--out themes.css] | scan styles.css'); process.exit(2);
}
if (!fs.existsSync(file)) { console.error('not found: ' + file); process.exit(2); }

export const PAIRS = [
  ['text', 'bg', 4.5, 'body text'], ['text', 'surface', 4.5, 'text on cards'],
  ['text-soft', 'bg', 4.5, 'secondary text'], ['text-soft', 'surface', 4.5, 'secondary text on cards'],
  ['on-brand', 'brand', 4.5, 'button label'], ['brand', 'bg', 3, 'brand as UI colour or large text'],
  ['line', 'bg', 3, 'control boundaries (WCAG 1.4.11)'], ['line', 'surface', 3, 'boundaries on cards'],
];
const COLOUR_NAMES = /^(red|green|blue|violet|purple|pink|orange|yellow|gold|teal|cyan|magenta|indigo|lime|amber|brown|grey|gray|black|white)(-|$)/i;
const hex = h => {
  const s = String(h || '').trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s); if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = /^#([0-9a-f]{3})$/i.exec(s); if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  return null;
};
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

if (cmd === 'scan') {
  const attr = opt('--attr', 'data-theme');
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  // flat rules, including those inside @media/@supports bodies (one level)
  const re = /([^{}@]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) rules.push({ sel: m[1].trim(), body: m[2] });
  const themeRe = new RegExp(`\\[${attr}\\s*=\\s*["']?([\\w-]+)["']?\\]`);
  const out = { file, attr, themed: 0, tokenRules: 0, componentOverrides: 0, byTheme: {}, colourNamed: [], examples: [] };
  for (const r of rules) {
    // split the selector list on top-level commas only (not inside :is(), :where(), :not())
    const sels = []; let depth = 0, cur = '';
    for (const ch of r.sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { sels.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) sels.push(cur.trim());
    const themed = sels.filter(s => themeRe.test(s));
    if (!themed.length) continue;
    const decls = r.body.split(';').map(d => d.trim()).filter(Boolean);
    const props = decls.map(d => d.split(':')[0].trim());
    const onlyTokens = props.length > 0 && props.every(p => p.startsWith('--'));
    for (const s of themed) {
      const name = themeRe.exec(s)[1];
      out.themed++; out.byTheme[name] = out.byTheme[name] || { tokenRules: 0, componentOverrides: 0 };
      if (onlyTokens) { out.tokenRules++; out.byTheme[name].tokenRules++; }
      else { out.componentOverrides++; out.byTheme[name].componentOverrides++; if (out.examples.length < 8) out.examples.push(s); }
    }
    if (onlyTokens) for (const p of props) { const n = p.slice(2); if (COLOUR_NAMES.test(n) && !out.colourNamed.includes(p)) out.colourNamed.push(p); }
  }
  console.log(`${file}: ${out.themed} theme-scoped selectors: ${out.tokenRules} token rules, ${out.componentOverrides} component overrides`);
  for (const [n, v] of Object.entries(out.byTheme)) console.log(`  ${n}: ${v.tokenRules} token, ${v.componentOverrides} component`);
  if (out.examples.length) console.log('  component overrides, first few: ' + out.examples.join(' | '));
  if (out.colourNamed.length) console.log('  colour-named tokens set by a theme (rename by role): ' + out.colourNamed.join(' '));
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(out, null, 2));
  process.exit(0);
}

const themes = JSON.parse(fs.readFileSync(file, 'utf8'));
const selector = opt('--selector', 'html[data-theme="{name}"]');
let bad = 0, css = '';
const report = { file, themes: {} };
for (const [name, t] of Object.entries(themes)) {
  const rep = report.themes[name] = { pairs: [], notChecked: [], warnings: [] };
  css += selector.replace('{name}', name) + ' {\n' + Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join('\n') + '\n}\n';
  for (const k of Object.keys(t)) if (COLOUR_NAMES.test(k)) { rep.warnings.push(`--${k} is named after a colour: name it by role`); console.error(`[${name}] warn --${k} is named after a colour: name tokens by role (themes reassign colours)`); }
  for (const [f, g, min, why] of PAIRS) {
    if (t[f] == null || t[g] == null) { bad++; rep.pairs.push({ f, g, status: 'missing' }); console.error(`[${name}] FAIL missing token ${t[f] == null ? f : g}`); continue; }
    const a = hex(t[f]), b = hex(t[g]);
    if (!a || !b) { rep.notChecked.push(`${f} on ${g}`); console.error(`[${name}] not checked ${f} on ${g}: not plain hex (${t[f]}, ${t[g]}); pixel-sample it`); continue; }
    const r = +ratio(a, b).toFixed(2), ok = r >= min;
    rep.pairs.push({ f, g, ratio: r, min, status: ok ? 'pass' : 'fail' });
    if (!ok) bad++;
    console.error(`[${name}] ${ok ? 'ok  ' : 'FAIL'} ${f} on ${g}: ${r.toFixed(2)}${ok ? '' : ' < ' + min} (${why})`);
  }
}
report.verdict = bad ? 'fail' : 'pass';
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(report, null, 2));
if (cmd === 'build') { if (opt('--out')) fs.writeFileSync(opt('--out'), css); else process.stdout.write(css); }
console.error(`verdict: ${report.verdict}`);
process.exit(bad ? 1 : 0);
