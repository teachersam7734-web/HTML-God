#!/usr/bin/env node
// palette-check.mjs: the HTML-Sensei palette validator for charts. Node, no dependencies.
//   categorical: every colour needs 3:1 against the background (WCAG 1.4.11, graphical objects) and every pair must
//                stay apart (CIEDE2000) under normal vision and simulated protan, deutan and tritan deficiencies
//                (Machado, Oliveira and Fernandes 2009, severity 1.0, applied in linear RGB);
//   sequential:  CIE L* must change monotonically along the ramp, with a span of at least 40.
//
//   node palette-check.mjs "#0072B2,#D55E00,#009E73" [--bg "#ffffff"] [--min-contrast 3] [--min-delta 8] [--json]
//   node palette-check.mjs "#440154,#3b528b,#21918c,#5ec962,#fde725" --sequential
//   import { checkCategorical, checkSequential, contrast, simulate, dE2000, lab } from './palette-check.mjs'
// Exit 0 when the palette passes, 1 when it fails, 2 on bad input.
//
// The 3:1 bar is WCAG's. The dE2000 bar of 8 ("tell apart without a legend lookup") is a working heuristic, not a
// standard; it is an option so a project can state its own.
//
// verified: Windows 10, Node 24 (test-palettes.mjs): contrast 21:1 black on white and 4.54:1 for #767676; CIEDE2000
//           against the published Sharma, Wu and Dalal test pair (2.0425); the measured palette results in SKILL.md.
// not verified: the simulation against people with colour-vision deficiency (it is a model); display calibration.
// Origin: code-apps/dash/palette-check.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM with options.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const delin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const luminance = (rgb) => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function contrast(a, b) { const la = luminance(hex(a)), lb = luminance(hex(b)); const [hi, lo] = la > lb ? [la, lb] : [lb, la]; return (hi + 0.05) / (lo + 0.05); }
// Machado, Oliveira, Fernandes 2009, severity 1.0, applied in LINEAR RGB
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
};
function simulate(h, kind) { if (!kind || kind === 'normal') return h; const l = hex(h).map(lin), m = CVD[kind]; return toHex(m.map((row) => delin(row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))); }
function lab(h) {
  const [r, g, b] = hex(h).map(lin);
  let x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function dE2000(l1, l2) { // Sharma, Wu, Dalal 2005
  const rad = Math.PI / 180, [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { const t = Math.atan2(b, a) / rad; return t < 0 ? t + 360 : t; };
  const h1p = C1p === 0 ? 0 : h(b1, a1p), h2p = C2p === 0 ? 0 : h(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p; let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2), Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p !== 0) { hbp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2)), Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const Sl = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2)), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
}
function minPair(cols, kind) {
  let best = { d: Infinity, i: -1, j: -1 };
  for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) { const d = dE2000(lab(simulate(cols[i], kind)), lab(simulate(cols[j], kind))); if (d < best.d) best = { d, i, j }; }
  return best;
}
/* Categorical: each colour needs 3:1 against the background (WCAG 1.4.11 graphical objects) and every pair must stay apart
   under each simulated deficiency. dE2000 >= 8 is a pragmatic bar for "tell apart without a legend lookup"; it is a heuristic, not a standard. */
function checkCategorical(cols, o = {}) {
  const bg = o.bg || '#ffffff', minC = o.minContrast || 3, minD = o.minDelta || 8, out = { contrast: [], cvd: {}, ok: true, problems: [] };
  cols.forEach((c) => { const r = contrast(c, bg); out.contrast.push(+r.toFixed(2)); if (r < minC) { out.ok = false; out.problems.push(`${c} contrast ${r.toFixed(2)} < ${minC}`); } });
  ['normal', 'protan', 'deutan', 'tritan'].forEach((k) => { const m = minPair(cols, k); out.cvd[k] = { min: +m.d.toFixed(1), pair: [cols[m.i], cols[m.j]] }; if (m.d < minD) { out.ok = false; out.problems.push(`${k}: ${cols[m.i]} vs ${cols[m.j]} dE ${m.d.toFixed(1)} < ${minD}`); } });
  return out;
}
/* Sequential ramp: lightness (CIE L*) must change monotonically, and ends must differ by at least 40 L* so low and high read apart */
function checkSequential(cols) {
  const L = cols.map((c) => lab(c)[0]), inc = L.every((v, i) => i === 0 || v > L[i - 1]), dec = L.every((v, i) => i === 0 || v < L[i - 1]);
  return { monotonic: inc || dec, span: +Math.abs(L[L.length - 1] - L[0]).toFixed(1), L: L.map((v) => +v.toFixed(0)) };
}

export { contrast, simulate, lab, dE2000, checkCategorical, checkSequential, hex, toHex };

function main(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--bg') o.bg = argv[++i]; else if (k === '--min-contrast') o.minContrast = +argv[++i];
    else if (k === '--min-delta') o.minDelta = +argv[++i]; else if (k === '--sequential') o.seq = true;
    else if (k === '--json') o.json = true; else o._.push(k);
  }
  const cols = (o._[0] || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!cols.length || cols.some((c) => !/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c))) { console.error('usage: node palette-check.mjs "#aaa,#bbbbbb" [--bg "#fff"] [--sequential] [--min-contrast 3] [--min-delta 8] [--json]'); return 2; }
  if (o.seq) {
    const r = checkSequential(cols), pass = r.monotonic && r.span >= 40;
    if (o.json) console.log(JSON.stringify({ ...r, ok: pass })); else console.log(`${pass ? 'PASS' : 'FAIL'}  L* ${r.L.join(', ')}: ${r.monotonic ? 'monotonic' : 'NOT monotonic'}, span ${r.span}`);
    return pass ? 0 : 1;
  }
  const r = checkCategorical(cols, { bg: o.bg, minContrast: o.minContrast, minDelta: o.minDelta });
  if (o.json) console.log(JSON.stringify(r, null, 1));
  else {
    console.log(`contrast on ${o.bg || '#ffffff'}: ${cols.map((c, i) => c + ' ' + r.contrast[i]).join(', ')}`);
    console.log('closest pair (dE2000): ' + Object.entries(r.cvd).map(([k, v]) => `${k} ${v.min}`).join(', '));
    for (const p of r.problems) console.log('FAIL  ' + p);
    if (r.ok) console.log('PASS');
  }
  return r.ok ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
