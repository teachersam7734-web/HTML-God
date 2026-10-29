#!/usr/bin/env node
// optimise-images.mjs: re-encode images for a single-file build and SAY what each format cost in size and in fidelity.
//   SENSEI_NPM=<dir with sharp, svgo> node optimise-images.mjs <in-file-or-folder> <out-folder> [--formats webp,avif,jpeg] [--q 80] [--max-width 2400] [--svgo]
// Default is quality first (no size budget): webp at 82, jpeg mozjpeg at 85, avif at 70. For every output the script prints bytes, the
// base64 cost inside a single file (x1.333), and PSNR against the source (a low PSNR on a grainy image is the AVIF/WebP smoothing trap).
// verified: Windows 10, Node 24, sharp from SENSEI_NPM: webp, avif and jpeg written with bytes and PSNR printed; the research run measured the format table in references/assets.md.
// not verified: cwebp, avifenc, cjxl, Squoosh (not used); macOS and Linux sharp builds.
// Origin: code-engineering/optimise-images.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); paths moved to work.mjs and sensei-verify's lib.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.join(process.env.SENSEI_NPM ? path.resolve(process.env.SENSEI_NPM) : process.cwd(), 'x.js'));
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--') && !/^(webp|avif|jpeg|jpg|[\d,]+|[a-z,]+)$/.test(a) || fs.existsSync(a));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [inp, outDir] = args.filter(a => !a.startsWith('--') && (fs.existsSync(a) || a === args[1]));
if (!inp || !outDir) { console.error('usage: node optimise-images.mjs <in> <outdir> [--formats webp,avif,jpeg] [--q N] [--max-width N] [--svgo]'); process.exit(2); }
const formats = opt('formats', 'webp,jpeg').split(','), maxW = +opt('max-width', 2400);
const q = { webp: +opt('q', 82), jpeg: +opt('q', 85), avif: +opt('q', 70) };
const sharp = req('sharp'); fs.mkdirSync(outDir, { recursive: true });
const files = fs.statSync(inp).isDirectory() ? fs.readdirSync(inp).map(f => path.join(inp, f)) : [inp];

async function psnr(a, b) { const A = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const B = await sharp(b).removeAlpha().resize(A.info.width, A.info.height).raw().toBuffer(); let se = 0; for (let i = 0; i < A.data.length; i++) { const d = A.data[i] - B[i]; se += d * d; } const mse = se / A.data.length; return mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse); }

for (const f of files) {
  const ext = path.extname(f).toLowerCase(), base = path.basename(f, ext);
  if (ext === '.svg' && args.includes('--svgo')) {
    const { optimize } = req('svgo'); const src = fs.readFileSync(f, 'utf8');
    // keep ids (CSS and JS often target them) and the viewBox; svgo 4 no longer lists removeViewBox in the default preset
    const o = optimize(src, { multipass: true, plugins: [{ name: 'preset-default', params: { overrides: { cleanupIds: false } } }] }).data;
    fs.writeFileSync(path.join(outDir, base + '.svg'), o); console.log(`${base}.svg  ${src.length} -> ${o.length} bytes (ids kept; check it renders the same)`); continue;
  }
  if (!['.png', '.jpg', '.jpeg', '.webp', '.avif', '.tif', '.tiff', '.gif'].includes(ext)) continue;
  const meta = await sharp(f).metadata(); const pipeline = () => { let p = sharp(f).rotate(); if (meta.width > maxW) p = p.resize({ width: maxW }); return p; };
  const srcBuf = await pipeline().png().toBuffer();
  console.log(`\n${path.basename(f)}  ${meta.width}x${meta.height}  source ${fs.statSync(f).size} bytes`);
  for (const fmt of formats) {
    let p = pipeline(); const o = path.join(outDir, `${base}.${fmt === 'jpeg' ? 'jpg' : fmt}`);
    if (fmt === 'webp') p = p.webp({ quality: q.webp, effort: 5 }); else if (fmt === 'jpeg') p = p.jpeg({ quality: q.jpeg, mozjpeg: true }); else if (fmt === 'avif') p = p.avif({ quality: q.avif, effort: 4 }); else continue;
    const buf = await p.toBuffer(); fs.writeFileSync(o, buf);
    const ps = await psnr(srcBuf, buf);
    console.log(`  ${fmt.padEnd(5)} ${String(buf.length).padStart(9)} bytes  base64 in file ${String(Math.round(buf.length * 4 / 3)).padStart(9)}  PSNR ${ps === Infinity ? 'inf' : ps.toFixed(1)} dB${ps < 32 ? '   <- visibly lossy on detailed or grainy images: raise quality or choose another format' : ''}`);
  }
}
