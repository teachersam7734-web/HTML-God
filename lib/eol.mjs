// eol.mjs: line-ending detection and conversion for keep-eol.
// CLI: node eol.mjs --to lf|crlf <file> [...]     converts in place (keeps a UTF-8 BOM if present)
//      node eol.mjs <file> [...]                  reports the style of each file
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// 'crlf' | 'lf' | 'cr' | 'mixed' | 'none' (no line breaks), plus bom: true/false
export function detect(buf) {
  const s = Buffer.isBuffer(buf) ? buf.toString('latin1') : String(buf);
  const crlf = (s.match(/\r\n/g) || []).length;
  const lf = (s.match(/(?<!\r)\n/g) || []).length;
  const cr = (s.match(/\r(?!\n)/g) || []).length;
  const kinds = [crlf && 'crlf', lf && 'lf', cr && 'cr'].filter(Boolean);
  const bom = Buffer.isBuffer(buf) ? buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf : s.charCodeAt(0) === 0xfeff;
  return { style: kinds.length === 0 ? 'none' : kinds.length > 1 ? 'mixed' : kinds[0], crlf, lf, cr, bom };
}

export function convert(text, to) {
  const lf = String(text).replace(/\r\n?/g, '\n');
  return to === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf;
}

export function convertFile(file, to) {
  fs.writeFileSync(file, convert(fs.readFileSync(file, 'utf8'), to), 'utf8');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2); const i = a.indexOf('--to'); const to = i >= 0 ? a[i + 1] : null;
  const files = a.filter((x, k) => x !== '--to' && (i < 0 || k !== i + 1));
  for (const f of files) {
    if (to) { if (!['lf', 'crlf'].includes(to)) { console.error('--to lf or --to crlf'); process.exit(1); } convertFile(f, to); console.log(`${f}: now ${to}`); }
    else { const d = detect(fs.readFileSync(f)); console.log(`${f}: ${d.style}${d.bom ? ' +BOM' : ''} (crlf ${d.crlf}, lf ${d.lf}, cr ${d.cr})`); }
  }
}
