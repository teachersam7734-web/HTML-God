// test-assets.mjs: measures image formats and SVGO on a synthetic photo and a real-ish SVG, then proves Chromium decodes
// each format from a data: URI inside a single file.   SENSEI_NPM=<dir with node_modules containing sharp and svgo> node test-assets.mjs
// verified: Windows 10, Node 24, sharp and svgo from SENSEI_NPM, installed Chrome: every format decodes from a data: URI; SVGO result renders.
// not verified: JPEG XL decode (no encoder); other browsers.
// Origin: code-engineering/test-assets.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); paths moved to work.mjs and sensei-verify's lib.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { launch } from '../../sensei-verify/scripts/lib/discover.mjs';
import { WORK } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const npmDir = process.env.SENSEI_NPM ? path.resolve(process.env.SENSEI_NPM) : process.cwd();
const req = createRequire(path.join(npmDir, 'x.js'));
const sharp = req('sharp'), { optimize } = req('svgo');
const W = 1600, H = 1000;

// synthetic photo: smooth gradients, soft blobs, film grain
const raw = Buffer.alloc(W * H * 3);
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 3, u = x / W, v = y / H;
  const b = Math.exp(-(((u - .3) ** 2 + (v - .4) ** 2) / .03)) + .7 * Math.exp(-(((u - .75) ** 2 + (v - .6) ** 2) / .02));
  const g = (rnd() - .5) * 14;
  raw[o] = Math.max(0, Math.min(255, 40 + 160 * u + 90 * b + g)); raw[o + 1] = Math.max(0, Math.min(255, 30 + 120 * v + 70 * b + g)); raw[o + 2] = Math.max(0, Math.min(255, 90 + 100 * (1 - u) + 60 * b + g));
}
const src = sharp(raw, { raw: { width: W, height: H, channels: 3 } });
const out = {};
out.png = await src.clone().png({ compressionLevel: 9 }).toBuffer();
out.jpeg80 = await src.clone().jpeg({ quality: 80, mozjpeg: true }).toBuffer();
out.webp80 = await src.clone().webp({ quality: 80 }).toBuffer();
out.avif50 = await src.clone().avif({ quality: 50, effort: 4 }).toBuffer();
out.avif70 = await src.clone().avif({ quality: 70, effort: 4 }).toBuffer();
out.webpLossless = await src.clone().webp({ lossless: true }).toBuffer();
const sizes = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
console.log('image sizes (bytes) for a 1600x1000 synthetic photo with grain:', sizes);
console.log('base64 text cost in a single file is x1.333:', Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, Math.round(v * 4 / 3)])));

// responsive images in one file: every srcset candidate must be embedded, so srcset multiplies weight
const small = await src.clone().resize(800).webp({ quality: 80 }).toBuffer();
console.log('srcset 800w + 1600w embedded together =', small.length + out.webp80.length, 'bytes vs 1600w alone', out.webp80.length, '(srcset in one file costs size and saves no download; ship one size, pick it for the largest layout)');

// SVGO
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Illustrator -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns" width="400px" height="200px" viewBox="0 0 400 200" version="1.1">
  <title>Logo</title><desc>Created with Sketch.</desc>
  <defs><linearGradient x1="0%" y1="0%" x2="100%" y2="0%" id="g"><stop stop-color="#6C5CE7" offset="0.000000"/><stop stop-color="#00B8D4" offset="100.000000"/></linearGradient></defs>
  <g id="Page-1" stroke="none" stroke-width="1.000000" fill="none" fill-rule="evenodd" sketch:type="MSPage">
    <g id="Group" transform="translate(10.000000, 10.000000)">
      <rect id="Rectangle" fill="url(#g)" x="0.000000" y="0.000000" width="380.000000" height="180.000000" rx="24.000000"></rect>
      <path d="M 100.000000 90.000000 L 200.000000 40.000000 L 300.000000 90.000000 L 200.000000 140.000000 Z" id="Diamond" fill="#FFFFFF" fill-opacity="0.900000"></path>
      <text id="Label" font-family="Arial" font-size="20.000000" fill="#111111" x="150" y="95">hello</text>
    </g>
  </g>
</svg>`;
const opt = optimize(svg, { multipass: true, plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }, 'removeDimensions'] });
console.log('svgo:', svg.length, '->', opt.data.length, 'bytes (', Math.round(100 - 100 * opt.data.length / svg.length), '% smaller)');
// the classic SVGO trap: removeViewBox without removeDimensions makes the SVG unscalable; and ids get minified, which breaks CSS and JS that target them
const trap = optimize('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><rect id="box" width="100" height="50"/></svg>', { plugins: ['preset-default'] }).data;
console.log('svgo default preset on an svg with id="box":', trap, '(ids are stripped or shortened: keep them with cleanupIds {preserve:[...]} or minify:false when CSS/JS refers to them)');

// Chromium decode from data: URIs inside one file
const html = `<!doctype html><meta charset=utf-8><body>${Object.entries(out).map(([k, v]) => `<img id="${k}" decoding="async" src="data:image/${k.startsWith('jpeg') ? 'jpeg' : k.startsWith('png') ? 'png' : k.startsWith('webp') ? 'webp' : 'avif'};base64,${v.toString('base64')}" width="200">`).join('')}<img id="svgo" src="data:image/svg+xml;utf8,${encodeURIComponent(opt.data)}" width="200"></body>`;
const tmp = path.join(WORK, 'assets-decode.html'); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, html);
const { browser } = await launch(); const page = await browser.newPage();
await page.goto('file:///' + tmp.replace(/\\/g, '/'));
const dec = await page.evaluate(async () => { const r = {}; for (const i of document.images) { try { await i.decode(); r[i.id] = i.naturalWidth; } catch (e) { r[i.id] = 'ERR ' + e.message; } } return r; });
console.log('Chromium decode from data: URI (natural width):', dec);
const feats = await page.evaluate(async () => {
  const sup = {};
  for (const [n, m] of [['avif', 'image/avif'], ['webp', 'image/webp'], ['jxl', 'image/jxl']]) { sup[n] = await new Promise(res => { const c = document.createElement('canvas'); c.width = c.height = 1; res(c.toDataURL(m).startsWith('data:' + m)); }); }
  return { canvasEncode: sup, fromBase64: typeof Uint8Array.fromBase64, ua: navigator.userAgent.match(/Chrome\/[\d.]+/)[0] };
});
console.log('browser:', feats);
await browser.close(); fs.unlinkSync(tmp);
