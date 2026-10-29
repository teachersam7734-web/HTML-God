/* sensei-assets-runtime.js: the small runtime inline.mjs injects when code loads assets BY PATH at run time
 * (fetch, Worker, WebAssembly streaming, JSON, audio, models). A static inliner cannot see those, so the packager
 * stores the bytes as base64 text blocks (script elements of type application/x-sensei-asset, never compiled as
 * JavaScript) and this file maps requests for those paths to Blob URLs.
 *
 * API:  SenseiAssets.url(path) -> blob: URL        SenseiAssets.blob(path) -> Blob
 *       SenseiAssets.bytes(path) -> Uint8Array      SenseiAssets.text(path) -> string      SenseiAssets.has(path)
 * Shims: fetch(path) and new Worker(path) resolve to the embedded bytes when the path is known.
 * Lazy:  elements with data-sensei-asset="path" get src (and data-sensei-poster -> poster) when they come near
 *        the viewport, or at once with data-sensei-eager. The base64 text is only decoded then.
 * Timing: the byte blocks normally sit at the END of <body> so they never delay first paint. A script that runs
 *        earlier can still call fetch(path) (the shim waits for DOMContentLoaded); a synchronous call such as
 *        new Worker(path) before the blocks are parsed throws a clear error: build with --assets-at head, or
 *        create the worker after DOMContentLoaded.
 *
 * verified: Windows 10, installed Chrome, strict file:// (test-inline.mjs: fetch, instantiateStreaming, Worker, JSON, audio, lazy video).
 * not verified: Firefox and Safari; element src setters (no shim: use SenseiAssets.url); XHR (no shim).
 * Origin: code-engineering/lib/sensei-assets-runtime.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code).
 */
(function () {
  'use strict';
  var KNOWN = /*SENSEI_KEYS*/[]/*END*/;
  var T = Object.create(null), cache = Object.create(null), realFetch = window.fetch && window.fetch.bind(window), seen = 0;
  function scan() {
    var tag = document.querySelectorAll('script[type="application/x-sensei-asset"]');
    if (tag.length === seen) return;
    for (var i = 0; i < tag.length; i++) { var pth = tag[i].getAttribute('data-path'); if (!T[pth]) T[pth] = { mime: tag[i].getAttribute('data-mime') || 'application/octet-stream', el: tag[i] }; }
    seen = tag.length;
  }
  scan();
  function key(p) {
    if (p == null) return null;
    var s = String(p);
    if (/^(data|blob):/.test(s)) return null;
    var u; try { u = new URL(s, document.baseURI); } catch (e) { return null; }
    var path = decodeURIComponent(u.pathname);
    for (var n = 0; n < KNOWN.length; n++) { var k = KNOWN[n]; if (path === '/' + k || path.slice(-(k.length + 1)) === '/' + k) return k; }
    return null;
  }
  function decode(b64) {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64);
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function entry(p) {
    scan(); var k = KNOWN.indexOf(p) >= 0 ? p : key(p);
    if (!k) throw new Error('SenseiAssets: no embedded asset for ' + p);
    if (!T[k]) throw new Error('SenseiAssets: ' + k + ' is embedded but not parsed yet (it sits at the end of <body>). Wait for DOMContentLoaded or build with --assets-at head.');
    return k;
  }
  function bytes(p) { var k = entry(p); return decode(T[k].el.textContent.trim()); }
  function blob(p) { var k = entry(p); return cache[k] || (cache[k] = new Blob([bytes(k)], { type: T[k].mime })); }
  var urls = Object.create(null);
  function url(p) { var k = entry(p); return urls[k] || (urls[k] = URL.createObjectURL(blob(k))); }
  function text(p) { return new TextDecoder().decode(bytes(p)); }
  window.SenseiAssets = { has: function (p) { return KNOWN.indexOf(p) >= 0 || !!key(p); }, url: url, blob: blob, bytes: bytes, text: text, keys: function () { return KNOWN.slice(); } };

  function respond(k) { var b = blob(k); return new Response(b, { status: 200, headers: { 'Content-Type': T[k].mime, 'Content-Length': String(b.size) } }); }
  if (realFetch) window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url) || String(input), k = key(u);
    if (!k) return realFetch(input, init);
    scan();
    if (T[k]) return Promise.resolve(respond(k));
    return new Promise(function (res, rej) { // bytes not parsed yet: wait for the document to finish
      function go() { scan(); T[k] ? res(respond(k)) : rej(new TypeError('Failed to fetch (embedded asset ' + k + ' missing)')); }
      document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go, { once: true }) : go();
    });
  };
  var RW = window.Worker;
  if (RW) {
    var W = function (u, o) { var k = key(u); return new RW(k ? url(k) : u, o); };
    W.prototype = RW.prototype; window.Worker = W;
  }

  function lazy() {
    scan();
    var els = document.querySelectorAll('[data-sensei-asset]');
    function load(el) {
      scan();
      var p = el.getAttribute('data-sensei-asset'), po = el.getAttribute('data-sensei-poster');
      if (po && T[po]) el.poster = url(po);
      if (T[p]) { el.src = url(p); if (el.load && el.tagName !== 'IMG') el.load(); }
      el.removeAttribute('data-sensei-asset');
    }
    if (!('IntersectionObserver' in window)) { for (var i = 0; i < els.length; i++) load(els[i]); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } }); }, { rootMargin: '400px' });
    for (var j = 0; j < els.length; j++) { if (els[j].hasAttribute('data-sensei-eager')) load(els[j]); else io.observe(els[j]); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lazy); else lazy();
})();
