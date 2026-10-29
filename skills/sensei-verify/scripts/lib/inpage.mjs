// Copied unchanged from code-engineering/lib/inpage.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code) for sensei-gate.mjs.
// verified: Windows 10, Node 24, installed Chrome through playwright-core 1.62, by ../test-gate.mjs (every assertion passes).
// not verified: macOS and Linux (the paths and calls are written for them, not run there).
// inpage.mjs: functions that run INSIDE a page via page.evaluate. Each one is self-contained (no closures),
// because Playwright serialises the function source. Keep it that way.

// Pixel statistics for a PNG (base64). Run in a blank helper page, never in the page under test (CSP, side effects).
export const pixelStats = async (b64, maxSide = 256) => {
  const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const cv = new OffscreenCanvas(w, h), cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data, n = w * h;
  const hist = new Map(); let sum = 0, sum2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    hist.set(key, (hist.get(key) || 0) + 1);
    const l = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; sum += l; sum2 += l * l;
  }
  let topKey = 0, top = 0; for (const [k, v] of hist) if (v > top) { top = v; topKey = k; }
  const mean = sum / n, sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  const br = (topKey >> 8) & 15, bg = (topKey >> 4) & 15, bb = topKey & 15;
  let nonBg = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs((d[i] >> 4) - br) + Math.abs((d[i + 1] >> 4) - bg) + Math.abs((d[i + 2] >> 4) - bb) > 1) nonBg++;
  }
  return { w: bmp.width, h: bmp.height, uniqueColours: hist.size, meanLuma: +mean.toFixed(1), stddev: +sd.toFixed(2), nonBackgroundFraction: +(nonBg / n).toFixed(4) };
};

// Fraction of pixels that changed noticeably between two PNGs of equal size.
export const pixelDiff = async ([a64, b64], maxSide = 256) => {
  const load = async b => createImageBitmap(await (await fetch('data:image/png;base64,' + b)).blob());
  const A = await load(a64), B = await load(b64);
  if (A.width !== B.width || A.height !== B.height) return { sizeMismatch: true, fraction: 1 };
  const s = Math.min(1, maxSide / Math.max(A.width, A.height));
  const w = Math.max(1, Math.round(A.width * s)), h = Math.max(1, Math.round(A.height * s));
  const get = bmp => { const cv = new OffscreenCanvas(w, h), cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(bmp, 0, 0, w, h); return cx.getImageData(0, 0, w, h).data; };
  const da = get(A), db = get(B); let ch = 0;
  for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) ch++;
  return { fraction: +(ch / (w * h)).toFixed(4) };
};

// Document hygiene: things that quietly break on file:// or on phones.
export const hygiene = () => {
  const d = document, q = s => d.querySelector(s);
  const vp = q('meta[name=viewport]');
  return {
    compatMode: d.compatMode, title: d.title, lang: d.documentElement.lang || '', dir: d.documentElement.dir || '',
    characterSet: d.characterSet, viewportMeta: vp ? vp.content : null,
    themeColour: !!q('meta[name=theme-color]'), colourScheme: !!q('meta[name=color-scheme]'),
    images: d.images.length, imagesWithoutAlt: [...d.images].filter(i => !i.hasAttribute('alt')).length,
    brokenImages: [...d.images].filter(i => i.complete && i.naturalWidth === 0 && i.currentSrc).map(i => i.currentSrc.slice(0, 80)),
    iframes: d.querySelectorAll('iframe').length, h1: d.querySelectorAll('h1').length,
    landmarks: { main: d.querySelectorAll('main,[role=main]').length, nav: d.querySelectorAll('nav,[role=navigation]').length },
    scripts: d.scripts.length, externalScripts: [...d.scripts].filter(s => s.src && !/^(data|blob):/.test(s.src)).map(s => s.src.slice(0, 80)),
    externalStyles: [...d.querySelectorAll('link[rel~=stylesheet]')].map(l => l.href.slice(0, 80)),
  };
};

// Elements that stick out past the right edge of the viewport (reflow failures), ignoring scroll containers.
export const overflowers = () => {
  const W = document.documentElement.clientWidth, out = [];
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.right > W + 1 && !inScroller(el)) out.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''), right: Math.round(r.right), w: Math.round(r.width) });
    if (out.length >= 12) break;
  }
  return { scrollW: document.documentElement.scrollWidth, clientW: W, offenders: out };
};

// Clipped text under WCAG 1.4.12 text spacing: elements whose content is cut by overflow hidden.
export const clippedCount = () => {
  let n = 0; const ex = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.overflow === 'visible' && cs.overflowY === 'visible') continue;
    if (!el.textContent.trim()) continue;
    if ((cs.overflowY === 'hidden' || cs.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) { n++; if (ex.length < 5) ex.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '')); }
  }
  return { clipped: n, examples: ex };
};

// Small targets, unnamed controls, pointer-only controls (cursor:pointer but not keyboard reachable).
export const controlAudit = () => {
  const focusable = el => el.matches('a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),[contenteditable=true]');
  const name = el => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent || el.innerText || el.value || el.getAttribute('title') || el.querySelector('img[alt]')?.alt || (el.labels && el.labels[0]?.innerText) || '').trim();
  const small = [], unnamed = [], pointerOnly = [];
  for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab]')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if ((r.width < 24 || r.height < 24) && !el.closest('p,li,span') ) small.push(el.tagName.toLowerCase() + ':' + name(el).slice(0, 14) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (!name(el) && el.type !== 'range') unnamed.push(el.outerHTML.slice(0, 80));
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (focusable(el) || el.closest('a[href],button,[tabindex],label,summary')) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.cursor === 'pointer' && r.width > 8 && r.height > 8 && cs.visibility !== 'hidden' && cs.display !== 'none') pointerOnly.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''));
    if (pointerOnly.length > 12) break;
  }
  return { small: small.slice(0, 12), smallCount: small.length, unnamed: unnamed.slice(0, 8), unnamedCount: unnamed.length, pointerOnly: pointerOnly.slice(0, 12) };
};

// Motion inventory: running CSS/Web animations, infinite ones, videos playing, canvases.
export const motionInventory = () => {
  const anims = document.getAnimations().filter(a => a.playState === 'running');
  const infinite = anims.filter(a => a.effect && a.effect.getComputedTiming().iterations === Infinity);
  return {
    runningAnimations: anims.length, infiniteAnimations: infinite.length,
    videosPlaying: [...document.querySelectorAll('video')].filter(v => !v.paused && !v.ended).length,
    autoplayVideos: [...document.querySelectorAll('video[autoplay]')].length,
    canvases: document.querySelectorAll('canvas').length,
    smoothScrollOnRoot: getComputedStyle(document.documentElement).scrollBehavior === 'smooth',
  };
};

// Forced-colours audit: controls whose shape vanished (no border, no outline) once the palette is forced.
export const forcedAudit = () => {
  const bad = [];
  for (const el of document.querySelectorAll('button,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,[role=button],a[href].btn,a[class*=btn]')) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden') continue;
    const bw = ['Top', 'Right', 'Bottom', 'Left'].reduce((m, s) => Math.max(m, parseFloat(cs['border' + s + 'Width']) * (cs['border' + s + 'Style'] !== 'none' ? 1 : 0)), 0);
    const ol = cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) : 0;
    if (bw < 1 && ol < 1) bad.push(el.tagName.toLowerCase() + ':' + ((el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 14)));
  }
  return { forcedColors: matchMedia('(forced-colors: active)').matches, shapeless: bad.slice(0, 12), shapelessCount: bad.length };
};

// Run axe in the page (axe must already be injected).
// label-content-name-mismatch (WCAG 2.5.3, an accessible name that does not contain the visible text) is tagged
// experimental, so selecting by WCAG tags leaves it out; it caught a real bug on the landing lab that every tag
// run passed (measured 2026-10-25: tags only, missed; tags plus this switch, caught). Enable it explicitly.
// The rule list stays inside the function: page.evaluate sends this function's source, not its module scope.
export const runAxe = async (tags) => {
  const rules = { 'label-content-name-mismatch': { enabled: true } };
  const r = await axe.run(document, { runOnly: { type: 'tag', values: tags }, rules, resultTypes: ['violations', 'incomplete'] });
  const pick = v => ({ id: v.id, impact: v.impact, help: v.help, url: v.helpUrl, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => n.target.join(' ').slice(0, 100)) });
  return { violations: r.violations.map(pick), incomplete: r.incomplete.map(pick), passes: r.passes.length, inapplicable: r.inapplicable.length, axeVersion: axe.version };
};

// Frame-time sampler. Install with addInitScript BEFORE load so the first frames are seen.
export const frameSamplerInit = () => {
  window.__sf = []; window.__sfOn = true; let last = performance.now();
  const loop = t => { if (window.__sfOn && window.__sf.length < 30000) window.__sf.push(+(t - last).toFixed(2)); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.__loaf = [];
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__loaf.push({ d: Math.round(e.duration), blocking: Math.round(e.blockingDuration || 0), scripts: (e.scripts || []).slice(0, 2).map(x => ({ src: (x.sourceURL || x.invoker || '').slice(-60), fn: x.sourceFunctionName || '', ms: Math.round(x.duration) })) }))).observe({ type: 'long-animation-frame', buffered: true }); } catch (e) {}
  window.__lt = []; window.__ls = []; window.__lcp = null; window.__ev = [];
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push({ s: Math.round(e.startTime), d: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__ls.push(e.value); })).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { window.__lcp = { t: Math.round(e.startTime), size: e.size, el: e.element ? e.element.tagName.toLowerCase() : null }; })).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__ev.push({ n: e.name, d: Math.round(e.duration) }))).observe({ type: 'event', durationThreshold: 40, buffered: true }); } catch (e) {}
};

export const frameStats = () => {
  const f = window.__sf.slice(2).sort((a, b) => a - b);
  if (!f.length) return null;
  const q = p => f[Math.min(f.length - 1, Math.floor(p * f.length))];
  const total = f.reduce((a, b) => a + b, 0);
  return { frames: f.length, medianMs: q(.5), p95Ms: q(.95), p99Ms: q(.99), maxMs: f[f.length - 1], over33ms: f.filter(x => x > 33.4).length, over50ms: f.filter(x => x > 50).length, avgFps: +(1000 * f.length / total).toFixed(1) };
};

export const perfSnapshot = () => {
  const nav = performance.getEntriesByType('navigation')[0], paint = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]));
  const lt = window.__lt || [];
  return {
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null, loadMs: nav ? Math.round(nav.loadEventEnd) : null,
    firstPaintMs: paint['first-paint'] ?? null, fcpMs: paint['first-contentful-paint'] ?? null, lcp: window.__lcp,
    cls: +(window.__ls || []).reduce((a, b) => a + b, 0).toFixed(4),
    longTasks: lt.length, longestTaskMs: lt.reduce((m, t) => Math.max(m, t.d), 0), tbtApproxMs: lt.reduce((a, t) => a + Math.max(0, t.d - 50), 0),
    slowEvents: (window.__ev || []).slice(0, 6),
    longAnimationFrames: (window.__loaf || []).length, worstLoaf: (window.__loaf || []).slice().sort((a, b) => b.d - a.d).slice(0, 3),
    jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    transferBytes: nav ? nav.transferSize : null,
  };
};
