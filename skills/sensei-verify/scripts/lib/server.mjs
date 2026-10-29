// Copied unchanged from code-engineering/lib/server.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code) for sensei-gate.mjs.
// verified: Windows 10, Node 24, installed Chrome through playwright-core 1.62, by ../test-gate.mjs (every assertion passes).
// not verified: macOS and Linux (the paths and calls are written for them, not run there).
// server.mjs: a tiny static server for the gate. No caching (so a stale file can never hide a bug),
// Range support (video and audio seeking need it), correct MIME types for wasm/webm/woff2/mjs,
// optional COOP/COEP headers (cross-origin isolation, needed for SharedArrayBuffer).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };

export function serve(root, { port = 0, isolated = false } = {}) {
  const base = path.resolve(root);
  const srv = http.createServer((req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(base, p);
      if (!f.startsWith(base)) { res.writeHead(403); return res.end('forbidden'); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
      const st = fs.statSync(f), type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
      const h = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
      if (isolated) { h['Cross-Origin-Opener-Policy'] = 'same-origin'; h['Cross-Origin-Embedder-Policy'] = 'require-corp'; }
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) {
        const s = m[1] ? +m[1] : 0, e = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
        res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 });
        fs.createReadStream(f, { start: s, end: e }).pipe(res);
      } else {
        res.writeHead(200, { ...h, 'Content-Length': st.size });
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(f).pipe(res);
      }
    } catch (e) { res.writeHead(500); res.end(String(e.message)); }
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r({
    origin: 'http://127.0.0.1:' + srv.address().port,
    close: () => new Promise(c => { srv.closeAllConnections && srv.closeAllConnections(); srv.close(c); }),
  })));
}
