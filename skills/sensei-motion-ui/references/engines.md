# Engines: CSS, WAAPI, Motion, GSAP

Facts below come from the research lanes (motion.dev studied 2026-10-18 with `motion` 14.3.0 installed, bundled and
run; GSAP studied 2026-10-17 from the 3.15.0 release repository and its live licence page) and from this skill's own
runs on 2026-10-24 with `motion` 14.6.0 and `gsap` 3.15.0 installed from npm.

## 1. Which engine

| Need | Engine | Why |
|---|---|---|
| A state change (hover, press, open, toggle) | CSS transitions, with a spring as `linear()` if it should bounce | no script per frame; interruptible by the browser; reduced motion in one media query |
| An entrance or a one-off sequence of a few elements | CSS `@keyframes` with `--i` stagger, or WAAPI | WAAPI gives promises (`finished`), `startTime`, `playbackRate`, `getAnimations()` for tests |
| Chained steps that must land on the animation's own clock | WAAPI, the next step from the previous one's `finished` promise | no timer guessing |
| Springs that keep velocity when interrupted, gestures, scroll-linked progress, layout animation in vanilla | Motion (MIT) | the reference spring quality; vanilla `animate`, `stagger`, `scroll`, `inView`, `hover`, `press`, `animateLayout`, `animateView` |
| Timelines (nested, labelled, scrubbed, reversed), ScrollTrigger, SplitText, Flip, MorphSVG, DrawSVG, MotionPath, Draggable | GSAP (free Standard licence) | the richest timeline and plugin set |
| Anything that must render the same frame for the same t (films, video export) | none of the live engines: pure functions of t (`sensei-motion-graphics`, `sensei-video-pipeline/scripts/spring.js`), or one paused GSAP timeline set with `tl.time(t)` | live engines schedule themselves on rAF |
| A 3D or shader value | the 3D loop itself, or GSAP tweening a uniform | `sensei-3d`, `sensei-shaders-vfx` |

Never mix Motion and GSAP on one page; pick one. A simple fade or slide does not need either.

## 2. Motion (motion.dev)

- **Licence**: MIT, "Copyright (c) 2024 Motion B.V." (`LICENSE.md` read 2026-10-24 in the installed 14.6.0 package).
  Motion+ (paid: Solo 399 USD once, Team 249 USD per seat per year, per the lane) is separate, private source:
  `splitText`, `scrambleText`, `cursor`, Typewriter, Ticker, Carousel, AnimateNumber are Motion+ and **not** in the
  free UMD (the lane checked the 331 exports). Never ship Motion+ source in the plugin.
- **Sizes** (information, not a budget): `dist/motion.js` UMD with global `Motion` was 154,394 bytes in 14.3.0 and
  172,451 bytes in 14.6.0, **with no licence banner** (add one: `vendor-inline.mjs` adds the package's MIT text);
  tree-shaken `animate, stagger, scroll, inView` built with esbuild to an IIFE: 70.6 KB min, 27.3 KB gzip;
  `motion/mini` 8.2 KB min (no independent transforms, sequences, SVG paths or objects).
- **Reduced motion**: the vanilla API ignores `prefers-reduced-motion` (lane: 1,020 ms for a 1 s animation with the
  setting forced; this skill: 1,007 ms under Playwright's reduced-motion emulation). Gate it: `SenseiMotionGate.motion(
  Motion.animate)` finished the same call in 17 ms. `MotionConfig` reduced motion is React only.
- Spring options: physics (`stiffness`, `damping`, `mass`) or duration-based (`duration` or `visualDuration` plus
  `bounce` -1 to 1). The docs table gives stiffness 1, damping 10, mass 1 as defaults: always state them.
- Sequences: `animate([[sel, kf, { at: '<' }], ...])`; `at` takes a number, a label, `'<'`, `'+0.5'`, `'<-0.2'`.
  `pathLength: [0, 1]` sets `pathLength="1"` and the dash array automatically (lane, tested).
- `scroll(cb)` and `scroll(animation, { target, offset })` use `ScrollTimeline` where available; `target` is measured
  by layout, so transforms on it are ignored. `inView(el, cb)` returns a leave callback. Detail: `sensei-scroll`.
- `animateView` exists only where the View Transition API exists (`sensei-transitions`).
- Ids such as `a`, `c`, `out` become window globals and collide with script variables (the lane's first test failed
  silently).
- Version churn: minor versions weekly (12.x in June, 13.x in September, 14.x in October 2026, per the lane): pin the
  exact version (`npm i -E motion@14.6.0`).

## 3. GSAP

- **Licence**: the Standard "No Charge" GSAP License (effective 2025-04-30, copyright Webflow), checked 2026-10-17:
  free for commercial use, **including every former Club plugin** (SplitText, MorphSVG, DrawSVG, ScrambleText,
  ScrollSmoother, Inertia, Physics2D, CustomBounce, CustomWiggle, GSDevTools, MotionPathHelper). Prohibited: using GSAP
  in a no-code visual animation builder that competes with Webflow; removing or altering its notices. Not open
  source. Keep the `/*! GSAP 3.15.0 ... @license ... standard-license */` header in every shipped or inlined file
  (`vendor-inline.mjs` keeps it); files from 3.12.x carry the old paid-Club wording. The plugin ships no GSAP file:
  projects install it.
- **Files** (3.15.0, minified): core `gsap.min.js` 72.9 KB (28.3 KB gzip); ScrollTrigger 44.6 KB; SplitText 7.7 KB;
  Flip 25.5 KB; Draggable 35.8 KB; Observer 10.0 KB; MotionPath 22.0 KB; MorphSVG 21.2 KB; DrawSVG 4.4 KB; CustomEase
  7.2 KB. Never ship `all.js` (834 KB), GSDevTools or MotionPathHelper to production. Plugins must match the core's
  minor version.
- **Single file**: inline core first, then plugins, each in its own `<script>`, headers intact, then
  `gsap.registerPlugin(...)` (lane: 126 KB page with core, SplitText and ScrollTrigger ran from `file://`).
- **Core cheat sheet**:

```js
gsap.to(el, { x: 200, duration: 1, ease: 'power3.out', stagger: 0.05 });
gsap.fromTo(el, { x: 0 }, { x: 200 });                          // explicit start: repeatable
const tl = gsap.timeline({ defaults: { duration: 0.6, ease: 'power2.out' } });
tl.to(a, { x: 100 }).to(b, { y: 50 }, '<0.1').to(c, { scale: 2 }, '+=0.2').addLabel('end');
const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });   // pointer followers (sensei-pointer)
const ctx = gsap.context(() => { /* tweens */ }, scope); ctx.revert();  // cleanup in SPAs
const mm = gsap.matchMedia();
mm.add({ full: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, c => {
  if (c.conditions.reduce) { gsap.set(targets, { autoAlpha: 1, y: 0 }); return; }
  gsap.fromTo(targets, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: 0.08 });
});
```

  Eases: `power1` to `power4` (power3 is x to the fourth: a 2 s power3.out tween read at 1 s gives 188 of 200),
  `back`, `elastic`, `bounce`, `expo`, `circ`, `sine`, `steps(n)`, CustomEase; any function from 0..1 to 0..1 works,
  so `sensei-motion-graphics`' measured eases plug in as `ease: SenseiMotion.EASE.softLand`.
- **Reduced motion**: GSAP has none built in. `gsap.matchMedia()` with a reduce branch that sets end states; disable
  scrub and pin for those users. Test headless with Playwright's `reducedMotion: 'reduce'` (or Chrome's
  `--force-prefers-reduced-motion`, lane).
- **Live page versus seek page**: in a live page keep `fromTo`'s default `immediateRender: true`, so the start state
  shows at once; `immediateRender: false` belongs to paused seek timelines (`sensei-motion-graphics`). Found here: with
  it set false in a live entrance, the cards showed fully before jumping to their start state on the first tick.
- Content revealed by GSAP must not be hidden by CSS alone (`opacity: 0` in the stylesheet): set the hidden start
  state from the same script, so content shows if the script fails.
- SplitText `chars` wraps each character in an inline-block: it breaks Persian and Arabic joining (`sensei-typography`).

## 4. CSS and WAAPI essentials

- Animate `transform` (or the individual `translate`, `scale`, `rotate`), `opacity`, `filter` and colour; never width,
  height, top or left for motion.
- `transition: all` animates layout properties and anything that changes later: name the properties (the plugin's
  lint warns).
- `@starting-style` plus `transition-behavior: allow-discrete` (or `allow-discrete` in the shorthand) for entries
  from `display: none` (popovers and dialogs: `sensei-ui-components`).
- WAAPI: `el.animate(keyframes, { duration, delay, easing, fill })` accepts `easing: 'linear(...)'`; set
  `animation.startTime` to start on a precise document-timeline moment (the heartbeat example);
  `document.getAnimations()` lists every CSS and WAAPI animation for tests (pause them, set `currentTime`, read
  computed styles).
