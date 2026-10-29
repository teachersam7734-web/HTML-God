// test-sw.mjs: a minimal offline-first service worker, proven in Chromium: first visit online, second visit with the network cut.
// Also proves the update trap: a cache-first worker keeps serving the OLD page until the cache name changes.
//   node test-sw.mjs
// verified: Windows 10, Node 24, installed Chrome: offline reload served from the cache; the stale-page trap and its fix by a new cache name.
// not verified: other browsers; a real HTTPS host.
// Origin: code-engineering/test-sw.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); paths moved to work.mjs and sensei-verify's lib.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../../sensei-verify/scripts/lib/discover.mjs';
import { serve } from '../../sensei-verify/scripts/lib/server.mjs';
import { WORK } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = path.join(WORK, 'sw'); fs.mkdirSync(D, { recursive: true });
const page = v => `<!doctype html><html lang="en"><meta charset="utf-8"><title>sw</title><link rel="manifest" href="app.webmanifest"><h1 id="v">version ${v}</h1>
<script>navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => { window.__sw = true; });</script>`;
const sw = cache => `const CACHE='${cache}', ASSETS=['./','index.html','app.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });`;
fs.writeFileSync(path.join(D, 'app.webmanifest'), JSON.stringify({ name: 'Test', short_name: 'T', start_url: './', display: 'standalone', background_color: '#000', theme_color: '#000', icons: [] }));
fs.writeFileSync(path.join(D, 'index.html'), page(1)); fs.writeFileSync(path.join(D, 'sw.js'), sw('v1'));

const srv = await serve(D); const { browser } = await launch();
const ctx = await browser.newContext({ serviceWorkers: 'allow' }); const p = await ctx.newPage();
await p.goto(srv.origin + '/'); await p.waitForFunction('window.__sw===true', null, { timeout: 8000 });
let fails = 0; const check = (n, ok, d) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? '  [' + d + ']' : '')); };
await ctx.setOffline(true); await p.reload();
check('offline reload served from the service worker cache', (await p.textContent('#v')) === 'version 1', await p.textContent('#v'));
await ctx.setOffline(false);
// ship version 2 of the page WITHOUT changing the worker: the cache-first worker keeps serving version 1
fs.writeFileSync(path.join(D, 'index.html'), page(2)); await p.reload(); await p.waitForTimeout(500);
check('TRAP: page edited, worker unchanged, user still sees the old version', (await p.textContent('#v')) === 'version 1', await p.textContent('#v'));
// bump the cache name: worker bytes change, install, activate, old cache deleted
fs.writeFileSync(path.join(D, 'sw.js'), sw('v2'));
await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }); await p.waitForTimeout(1500); await p.reload(); await p.waitForTimeout(500);
check('bumping the cache name delivers the new version', (await p.textContent('#v')) === 'version 2', await p.textContent('#v'));
check('old cache removed', (await p.evaluate(() => caches.keys())).join() === 'v2', (await p.evaluate(() => caches.keys())).join());
await browser.close(); await srv.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
