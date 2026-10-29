# Scroll libraries: Lenis, ScrollTrigger and the rest

Sources: `repo-lenis.md` in the HTML-Sensei build project's research notes (not shipped) (Lenis 1.3.27 read from a clone and the npm package, 2026-10-17),
`repo-gsap.md` (GSAP 3.15.0 and the licence page, 2026-10-17), `domain-scrolling.md` (npm registry data,
2026-10-19). Facts marked "tested here" were run while writing this skill (`scripts/test-libs.mjs`).

## 1. Which one, if any

| Need | Reach for | Not for |
|---|---|---|
| Reveals, progress, parallax, a pinned horizontal track, a scrollytelling stage | native CSS (`examples/scroll-driven.html`) | anything that must read progress as a number |
| Smooth, inertial wheel scrolling; a WebGL scene that follows the page exactly | Lenis | short pages, app UIs, dashboards, form-heavy pages, pages made of nested scrollers |
| Pin with a timeline, smoothed scrub, snapping to cards, callbacks, Firefox parity with no polyfill | GSAP ScrollTrigger | one fade (CSS does it) |
| CSS-only authoring that also runs in Firefox | `scroll-timeline-polyfill` (Apache-2.0, repo `flackr/scroll-timeline`, 1.1.0) | smoothness (main thread); not run in the lane |
| `scroll()` and `inView()` helpers that use native timelines when present | Motion (MIT, 14.3.0) | not run in the lane |
| An attribute DSL (`data-scroll-speed`) over Lenis | Locomotive Scroll 5 (MIT) | new work: use Lenis directly |
| Word and character spans with index variables for scroll-linked text | Splitting (MIT, 1.1.0), or `sensei-typography`'s splitter | Persian and other joined scripts by character |

ScrollMagic and similar older libraries: not re-checked; not recommended over native CSS or GSAP.

## 2. Lenis

MIT, copyright darkroom.engineering, zero dependencies. `dist/lenis.min.js` 18.8 KB (5.4 KB gzip), `lenis-snap.min.js`
5.8 KB, `lenis.css` 513 bytes. Pin `lenis@1.3.27`: a v2 is on the roadmap with nested options (`wheel: {smooth,
lerp, multiplier}`, `touch: {...}`) and flipped defaults (`autoRaf`, `autoToggle`, `anchors`, `allowNestedScroll`,
`stopInertiaOnNavigate`, `naiveDimensions` all true). Everything in this skill is written against v1.

**What it does.** It keeps the page's native scroll position and moves it toward the wheel target with exponential
smoothing (`damp(x, y, lambda, dt) = lerp(x, y, 1 - exp(-lambda*dt))`). Because the scroll is native, sticky, anchors,
find-in-page, keyboard scrolling, screen readers and native CSS scroll timelines keep working under it.

**Options (v1).** `autoRaf`, `lerp` (0.1), `duration` (1.2 s) and `easing` (ignored when `lerp` is set),
`wheelMultiplier`, `smoothWheel`, `syncTouch` (off: touch stays native) with `syncTouchLerp` (0.075),
`touchInertiaExponent` (1.7), `touchMultiplier`, `orientation`, `gestureOrientation`, `infinite`, `overscroll`,
`wrapper`, `content`, `eventsTarget` (scroll an element, not the page), `anchors`, `autoResize`, `autoToggle`,
`allowNestedScroll`, `prevent(node)`, `virtualScroll(e)`, `naiveDimensions`, `stopInertiaOnNavigate`,
`respectReducedMotion` (true).

**Methods and properties.** `raf(ms)`, `scrollTo(target, {offset, lerp, duration, easing, immediate, lock, force,
onComplete})` with a number, selector, keyword or element, `start()`, `stop()`, `resize()`, `on('scroll', cb)`,
`destroy()`; `scroll`, `animatedScroll`, `targetScroll`, `velocity`, `direction`, `progress` (0 to 1), `limit`,
`isScrolling`, `isStopped`, `prefersReducedMotion`.

**Attributes and classes.** `data-lenis-prevent` (and `-wheel`, `-touch`, `-vertical`, `-horizontal`) lets a box
scroll natively. Lenis puts `lenis`, `lenis-smooth`, `lenis-scrolling`, `lenis-stopped` on `<html>` (tested here).

**Reduced motion, read from the source and tested here.** With `respectReducedMotion` (the default) and the
preference set, `prefersReducedMotion` is true, a wheel turn uses `lerp: 1` (it lands at once: 598 of 600 px 60 ms
after the turn, against 259 px with motion on) and a programmatic `scrollTo` is immediate. Never set it to false.

**Snap.** CSS scroll snap does not work under Lenis; use `lenis/snap`: `new Snap(lenis, {type: 'proximity' |
'mandatory' | 'lock', ...})`, `addElement(el, {align})`, `next()`, `previous()`, `goTo(i)`; `type: 'lock'` with
`debounce: 0` makes a section pager. Not run here.

**Patterns.**

```js
lenis.stop(); /* open a modal */ lenis.start();                      // scroll lock
new Lenis({ wrapper: lessonEl, content: lessonEl.firstElementChild }); // scroll a container, not the page
new Lenis({ orientation: 'horizontal', gestureOrientation: 'both' });   // horizontal gallery
lenis.scrollTo(0, { immediate: true });                                 // on route change
```

Read `lenis.scroll` (smoothed), not `scrollY`, for anything that should follow the smoothing (a WebGL camera). Call
`lenis.resize()` after layout changes `autoResize` cannot see. Iframes swallow wheel events (Lenis sets
`pointer-events: none` on them while smoothing). Safari caps it to 60 fps (30 in Low Power Mode) per the Lenis docs;
not verified here.

**A "poor man's Lenis"** for derived visuals only (the scroll itself stays native and unsmoothed), from the Lenis
study, written on the element, never on `:root` (a per-frame `:root` property restyles the whole document):

```js
const damp = (x, y, l, dt) => x + (y - x) * (1 - Math.exp(-l * dt));
let cur = 0, target = 0, last = performance.now();
addEventListener('scroll', () => target = scrollY, { passive: true });
(function tick(now){ const dt = (now - last) / 1000; last = now; cur = damp(cur, target, 6, dt);
  stage.style.setProperty('--sy', cur.toFixed(2)); requestAnimationFrame(tick); })(last);
```

Gate it on reduced motion like any loop.

## 3. GSAP ScrollTrigger

GSAP is under the Standard "No Charge" licence (Webflow, effective 2025-04-30, read 2026-10-17): free for any
website or app, commercial included, all former Club plugins included; prohibited only inside a no-code visual
animation builder that competes with Webflow; never remove or alter the `/*! ... @license ... */` headers. Pin
`gsap@3.15.0`; plugins must match the core's version. Sizes: core 72.9 KB min (28.3 KB gzip), ScrollTrigger 44.6 KB
(18.0 KB), ScrollSmoother 13.4 KB, Observer 10.0 KB, ScrollToPlugin 4.1 KB.

**Bridge with Lenis** (tested here):

```js
const lenis = new Lenis({ autoRaf: false, anchors: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

**Pinned horizontal section** (tested here with the bridge, `examples/scroll-libs.template.html`):

```js
const mm = gsap.matchMedia();
mm.add({ ok: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, c => {
  if (!c.conditions.ok) return;                 // reduce: static layout, no pin, no scrub
  document.documentElement.classList.add('js-pin');
  const dist = () => track.scrollWidth - innerWidth;
  gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '#hs', start: 'top top', pin: true,
    pinType: 'transform', scrub: 1, invalidateOnRefresh: true, end: () => '+=' + dist() } });
  return () => document.documentElement.classList.remove('js-pin');
});
```

Numbers measured: at 1000 by 700 the section top stayed at 0 px at the pin start, middle and end, and the track moved
0, minus 814 and minus 1628 px (its overflow) once the scrub settled.

**Other documented recipes** (from `repo-gsap.md`; not run): a scrubbed pinned timeline
(`gsap.timeline({scrollTrigger: {trigger, start: 'top top', end: '+=2000', scrub: 1, pin: true, anticipatePin: 1}})`);
panels by `xPercent: -100 * (n - 1)`; `ScrollTrigger.batch` for lists; snap; scrubbing a seekable film
(`ScrollTrigger.create({ trigger, start, end, scrub: true, onUpdate: s => film.seek(s.progress * film.duration) })`,
the film side is `sensei-video-pipeline`'s seek contract).

**ScrollTrigger traps** (from `repo-gsap.md` unless marked): `ScrollTrigger.refresh()` after images, fonts or layout
change; pin spacers break flex and grid assumptions (`pinSpacing`, a wrapper, or `pinType: 'transform'`); the default
fixed pin produced CLS 2.46 in the gate's scroll pass and `pinType: 'transform'` produced 0 (tested here); never create
triggers inside other triggers' callbacks without `gsap.context`; remove `markers: true`; `scrub: true` follows the
scroll exactly, `scrub: 1` catches up over one second (assert after it settles); `ignoreMobileResize` or
`normalizeScroll` for mobile address-bar jumps; kill triggers on route change (`ctx.revert()`); GSAP has no automatic
reduced-motion behaviour: use `gsap.matchMedia()`; never hide content with a CSS `opacity: 0` that only the script
undoes. GSDevTools and MotionPathHelper are authoring tools, never shipped.

## 4. Inlining for one offline file

`scripts/inline-libs.mjs` replaces `<script data-inline="gsap/dist/gsap.min.js"></script>` (and `<style
data-inline>`) with the pinned file from `node_modules`, refuses a file that contains `</script`, keeps an existing
header, adds one where the file has none, and prints the ledger rows. Tested here: the GSAP 3.15.0 files keep their
headers; `lenis.min.js` 1.3.27 ships with **no notice at all**, so the script writes
`/*! lenis 1.3.27 | MIT | Copyright (c) 2024 darkroom.engineering | ... */` from its `package.json` and `LICENSE`.
Order: core before plugins; Lenis anywhere before the code that constructs it. The no-code README one-liner loads
Lenis from unpkg: never in an offline deliverable.
