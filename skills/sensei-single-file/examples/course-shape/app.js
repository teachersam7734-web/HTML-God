// app.js: the app script of the course-shape example. It sits AFTER every element it needs and BEFORE the inert
// payloads, and it calls boot() directly: waiting for DOMContentLoaded would wait for the parser to reach the end of
// the file, payloads included. The film's base64 text is decoded only when the user asks for it.
// Original HTML-Sensei code. verified: test-build-single.mjs (Chrome, strict file://). not verified: phones, Safari.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  window.__marks = { appParsed: performance.now() };

  function decode(b64) {                       // Uint8Array.fromBase64 where it exists, atob otherwise
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64);
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  let filmUrl = null;
  function film() {                            // the block is parsed by the time anyone can press the button
    if (filmUrl) return filmUrl;
    const el = $('film'), text = el && el.textContent.trim();
    if (!text) return null;                    // optional slot left empty at build time: no film yet
    filmUrl = URL.createObjectURL(new Blob([decode(text)], { type: el.dataset.mime || 'video/webm' }));
    return filmUrl;
  }

  function boot() {
    let lessons = [];
    try { lessons = JSON.parse($('lessons-data').textContent); } catch (e) { $('status').textContent = 'The lesson data could not be read.'; }
    const list = $('lessons');
    for (const l of lessons) {
      const li = document.createElement('li');
      const h = document.createElement('h2'); h.textContent = l.title;
      const p = document.createElement('p'); p.textContent = l.summary;
      li.append(h, p); list.append(li);
    }
    $('play').addEventListener('click', () => {
      const u = film(), v = $('video');
      if (!u) { $('status').textContent = 'The film is not in this build.'; return; }
      v.hidden = false; v.src = u; v.play().catch(() => {});
      $('status').textContent = 'Film loaded.';
    });
    $('status').textContent = `${lessons.length} lessons ready.`;
    window.__marks.booted = performance.now();
    window.__done = true;
  }

  boot();
})();
