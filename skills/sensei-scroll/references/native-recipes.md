# Native scroll-driven recipes, in depth

Every recipe is in `examples/scroll-driven.html` and asserted by `scripts/test-scroll.mjs` unless marked. Numbers are
from Chrome headless at 1000 by 700. Source: `domain-scrolling.md` in the HTML-Sensei build project's research notes (not shipped) (lane D2), rerun and extended
while writing this skill.

## 1. Engines and support

| Engine | Runs on | Support (lane D2, can-i-use and vendor pages, 2026-10-19) | Use for |
|---|---|---|---|
| CSS `animation-timeline: scroll()` / `view()` | compositor for transform and opacity | Chromium 115+, Safari 26 and iOS per can-i-use; Firefox: not by default | light, declarative effects; zero JS |
| WAAPI with `new ScrollTimeline()` / `new ViewTimeline()` | same | same | effects created from script on dynamic elements; guard with `'ScrollTimeline' in window` |
| A scroll listener (hand-rolled, ScrollTrigger, Motion `scroll()`) | main thread | everywhere | Firefox, progress as a number, callbacks, snapping, smoothed scrub |

## 2. Timeline anatomy

- `scroll(root block)`: progress of a scroller from 0 to its maximum. `scroll(nearest)` is the default.
- `view()`: progress of the element's own visibility in its scroller. Ranges: `cover` (first pixel enters to last
  pixel leaves), `contain` (fully inside; for a subject taller than the viewport, the pinned interval), `entry`,
  `exit`, `entry-crossing`, `exit-crossing`, each with percentages: `animation-range: entry 0% entry 60%`.
- Named timelines: `view-timeline: --name block` on the subject, `animation-timeline: --name` on any descendant (or
  any element in scope with `timeline-scope: --name` on a common ancestor).
- `view-timeline-inset` (and the inset inside `view(block 0px)`) defaults to `auto`, which reads the scroller's
  `scroll-padding`. A `scroll-padding-top` added for a sticky header moved every `view()` timeline on this page: the
  horizontal track sat 48.7 px into its travel at the pin start and the orb read 0.45 instead of 0.4. Set the inset
  to `0px` explicitly wherever exact positions matter (tested here; see TRAPS).
- The `animation` shorthand resets `animation-timeline` to `auto`: write the timeline after the shorthand.
- `fill-mode: both` (in the shorthand) keeps the start state before the range and the end state after it.

## 3. The recipes

**Progress bar.** `transform: scaleX()` with `transform-origin: 0 50%`, never `width`; `scroll(root block)`. Measured:
0 at the top, 0.5 at mid-page, 1 at the bottom. Reduced motion: full and dimmed, no animation.

**Reveal on entry.** Start state on the element (`opacity: 0; translate: 0 40px`), `animation: rise linear both;
animation-timeline: view(block 0px); animation-range: entry 0% entry 60%` inside `@supports (animation-timeline:
view())`, and `@supports not (...) { opacity: 1; translate: none }` so an engine without it never hides content.
Use `translate`, so a hover can use `transform` or `scale` without losing to the animation (`sensei-landing-hero`
trap 5).

**Parallax.** A layer at `inset: -25% 0` inside an `overflow: clip` frame, keyframes `translate: 0 -12%` to
`0 12%`, `animation-range: cover`. Bigger percentages for nearer layers; oversize the layer by at least the travel or
its edges show.

**Pinned horizontal track.**

```css
.hs{height:400vh;position:relative}                 /* scroll distance = height minus one viewport */
.hs .pin{position:sticky;top:0;height:100vh;overflow:clip;display:flex;align-items:center}
.hs .track{display:flex;gap:4vw;padding-inline:8vw;width:max-content}
@keyframes slide{to{translate:calc(-100% + 100vw) 0}}
@supports (animation-timeline:view()){
  .hs{view-timeline:--hs block;view-timeline-inset:0px}
  .hs .track{animation:slide linear both;animation-timeline:--hs;animation-range:contain 0% contain 100%}
}
```

Measured: four 60vw cards make a 2680 px track; left edge 0 at the pin start, minus 840 at the middle, minus 1680 at
the end (the track width minus the viewport). Without `width: max-content` the track is one viewport wide and moves
0 px while the animation runs. The pin is `overflow: clip`: `hidden`, `auto` or `scroll` on any ancestor kills
`sticky`. Reduced motion: the section becomes ordinary flow and the cards wrap (no second scroller, no page-wide
horizontal scroll at 1000 px, asserted).

**Scrollytelling stage.** Same skeleton: a tall story with `view-timeline: --story block`, a sticky stage, the
subject on `animation-timeline: --story; animation-range: contain 0% contain 100%`. Measured: orb scale 0.4 at the
start, 1.0 at the middle, 0.6 at the end. Text steps follow the stage in flow (`position: relative; z-index: 1`) so
they scroll over it while it is stuck; each has its own `view()` reveal. Discrete state (which step is current, an
image swap, a caption) is an `IntersectionObserver` with `rootMargin: '-45% 0px -45% 0px'` (the middle band), not a
timeline: it works with reduced motion and without native timelines, and changes text rather than motion. Asserted:
the label reads step 1 or 2 at the story start and step 3 at its end.

**Snap.** `scroll-snap-type: y proximity` and `scroll-snap-align: start`. `mandatory` only for slide-sized content,
or users are trapped. A snapping box that is not the page is a scroller: give it `tabindex="0"`, `role="region"` and
an `aria-label` so keyboard users can scroll it (the gate's axe run passes it). Not under Lenis (use Lenis Snap).

**Stuck state.** `container-type: scroll-state` on the sticky wrapper and `@container scroll-state(stuck: top)
{ ... }` inside. Measured: the nav background changed from transparent to `rgba(0,0,0,.8)`. Chromium only;
progressive enhancement.

**Anchors under a sticky bar.** `scroll-padding-top` on `html` lands a jumped-to target below the bar (asserted), and
with it the timeline inset above. Lenis anchors honoured the same `scroll-padding-top` (target at 72 px, the 4rem
padding, under a 56 px header; tested in `test-libs.mjs`).

**Print.** No timeline runs on paper: reset every animated element to its end state and unpin stages under
`@media print` (asserted: every reveal and step at opacity 1).

## 4. The fallback for engines without timelines

The page carries a 40-line fallback: one paused Web Animation per effect with the same keyframes, `currentTime` set
from scroll progress in a `requestAnimationFrame`-throttled passive scroll listener; ranges computed as `cover` (top
of element minus viewport height to its bottom) and `contain` (top to bottom minus viewport). `?force=1` runs it in
Chromium. Measured here: bar, orb and track identical to native at all nine stops (delta 0). Lane D2 measured the
parallax layer 0.65 percent of its travel off at one position (the `cover` maths is approximate), fine for parallax.
Options, best first: this fallback for three to six effects; the `scroll-timeline` polyfill for CSS-only authoring
(main thread, not run); ScrollTrigger when the page already has GSAP. The fallback stays off under reduced motion.

## 5. Scroll-scrubbed media and films

Read progress as a number (`scrollY / (scrollHeight - innerHeight)`, or `lenis.progress`) in a rAF loop and set the
media's time. Video scrubbing, its encoding (`ffmpeg -g 1` or a keyframe every frame or two, or it stutters) and
image-sequence canvases belong to `sensei-lottie-rive-video`; a deterministic film page exposing a seek function is
scrubbed with `t = progress * duration` under `sensei-video-pipeline`'s seek contract. Not run in this skill.

## 6. By use case

| Use case | Do |
|---|---|
| Landing page | native reveals, a progress bar, one pinned story at most; first screen static and instant; Lenis optional |
| Presentation | not scroll-first: snap for a vertical pager or arrow-key slides (`sensei-presentations`) |
| Course (Ultra Bookworm) | reading progress, sparing reveals, no smooth-scroll hijack, never smooth-scroll to new content |
| Game | rarely: the game owns input |
| Dashboard | sticky headers and stuck-state styling; no parallax |
| Film or motion graphic | scroll as the scrubber of a seekable timeline |

Do not: change scroll speed or direction (scroll-jacking); put content where only a scroll effect can reveal it
(keyboard, find-in-page and screen readers must reach it); add scroll effects to long reading pages.
