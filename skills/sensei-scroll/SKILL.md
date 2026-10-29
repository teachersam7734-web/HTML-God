---
name: sensei-scroll
description: Scroll effects for HTML, native first. CSS scroll-driven animation (scroll() and view() timelines) for progress bars, reveals, parallax, pinned horizontal sections and scrollytelling stages, with a tested JavaScript fallback for engines without it; Lenis smooth scroll (pinned v1, honours reduced motion) and GSAP ScrollTrigger pinning and scrubbing, bridged and inlined offline with their notices; snap, stuck headers, anchors under sticky bars, print and reduced-motion end states, and self-tests that read positions at named scroll stops. Use when someone says scroll animation, scroll-driven, on scroll, reveal on scroll, scroll progress, reading progress, parallax, sticky section, pin, pinned, horizontal scroll, scrollytelling, scroll story, Apple-style product page, smooth scroll, buttery scroll, Lenis, ScrollTrigger, scrub, scroll snap, or the scroll feels janky.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-scroll

Scroll position drives presentation; the scroll itself stays the user's. Doctrine first (`html-sensei`): the richest
effect the content earns, nothing cut for this machine, reduced motion built in, and what was not verified said.

## 1. When to use

Any effect tied to scroll position: progress, reveals, parallax, pinned stages, horizontal sections, scrollytelling,
snap, stuck headers, smooth wheel scrolling, scroll-synced WebGL.

| The job is | Skill |
|---|---|
| A landing page's structure and its reveal-on-scroll bento | `sensei-landing-hero` (it uses this skill's reveal) |
| Hover, press, entrance and spring motion that is not scroll-linked; eases and the reduced-motion gate in general | `sensei-motion-ui` |
| Ease curves and durations as craft | `sensei-motion-graphics` |
| Splitting headlines into words or letters for a scroll reveal; Persian splitting | `sensei-typography` |
| Scroll-scrubbed video, image sequences, Lottie on scroll | `sensei-lottie-rive-video` |
| Scrubbing a seekable film by scroll (the film side) | `sensei-video-pipeline` |
| A WebGL scene that follows the page | `sensei-3d` (read `lenis.scroll` there) |
| Page-to-page and layout morphs | `sensei-transitions` |
| Slides and vertical pagers | `sensei-presentations` |
| Running the gate | `sensei-verify` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Engine | native CSS timelines; WAAPI `ScrollTimeline`/`ViewTimeline`; a scroll listener (ScrollTrigger, Motion `scroll()`, hand-rolled) | CSS for declarative effects; WAAPI for elements made by script; a listener when progress must be a number, for callbacks and snapping, or Firefox parity |
| Firefox (no `animation-timeline` by default) | this skill's fallback; the `scroll-timeline` polyfill; ScrollTrigger | three to six effects: the fallback; many CSS effects: the polyfill (not run); GSAP already on the page: ScrollTrigger |
| Smooth scrolling | none (native); Lenis; "poor man's Lenis" for derived visuals only | Lenis for long-form storytelling, case studies, WebGL sync; never on dashboards, app UIs, forms, short pages |
| Pin | CSS `position: sticky` in a tall wrapper; ScrollTrigger `pin` | sticky unless the pin needs a timeline with labels, snapping or callbacks; ScrollTrigger pins use `pinType: 'transform'` |
| Scrub | linear timeline; `scrub: 1` smoothing | native timelines follow exactly; ScrollTrigger `scrub: 1` adds a one-second catch-up feel |
| Discrete steps | per-step `view()` reveal; `IntersectionObserver` | motion per step: `view()`; state per step (caption, image, label): the observer |
| Snap | `proximity`; `mandatory`; Lenis Snap | proximity by default; mandatory only for slide-sized panels; Lenis Snap whenever Lenis runs |
| Reduced motion | end states, no timelines, pins become flow | always; not a choice |

## 3. Core technique

### 3.1 Native first, guarded, with end states

Start from [examples/scroll-driven.html](examples/scroll-driven.html). Every effect animates `transform`,
`translate`, `scale` or `opacity` only, sits inside `@supports`, and has an end state for reduced motion and print.

```css
.reveal{opacity:0;translate:0 40px}
@keyframes rise{to{opacity:1;translate:0 0}}
@supports (animation-timeline:view()){
  .reveal{animation:rise linear both;animation-timeline:view(block 0px);animation-range:entry 0% entry 60%}
}
@supports not (animation-timeline:view()){ .reveal{opacity:1;translate:none} }   /* never a blank page */
@media (prefers-reduced-motion:reduce){ .reveal{animation:none;opacity:1;translate:none} }
@media print{ .reveal{animation:none!important;opacity:1;translate:none} }
```

The timeline comes after the `animation` shorthand (the shorthand resets it); `both` holds the start state before the
range. `view(block 0px)` sets the inset: the default `auto` reads `scroll-padding`, so a sticky-header padding shifts
every view timeline (TRAPS 3).

### 3.2 The pinned stage

One skeleton serves a horizontal track and a scrollytelling stage: a tall wrapper names a timeline, a sticky child
pins, the subject animates over the wrapper's `contain` range (for a wrapper taller than the viewport, exactly the
pinned interval).

```css
.hs{height:400vh;position:relative}
.hs .pin{position:sticky;top:0;height:100vh;overflow:clip}           /* clip, never hidden */
.hs .track{display:flex;width:max-content}                          /* or -100% is one viewport */
@keyframes slide{to{translate:calc(-100% + 100vw) 0}}
@supports (animation-timeline:view()){
  .hs{view-timeline:--hs block;view-timeline-inset:0px}
  .hs .track{animation:slide linear both;animation-timeline:--hs;animation-range:contain 0% contain 100%}
}
@media (prefers-reduced-motion:reduce){ .hs{height:auto} .hs .pin{position:static;height:auto} .hs .track{animation:none;width:auto;flex-wrap:wrap} }
```

Text steps of a story follow the stage in flow so they scroll over it while it is stuck; which step is current is an
`IntersectionObserver` on the middle band (`rootMargin: '-45% 0px -45% 0px'`), not a timeline. Every recipe, the
timeline anatomy, the numbers and the use-case table: [references/native-recipes.md](references/native-recipes.md).

### 3.3 The fallback

For engines without timelines the page re-creates each effect as a paused Web Animation with the same keyframes and
sets `currentTime` from scroll progress in a rAF-throttled passive listener (`cover` and `contain` ranges computed
from the element's box). It stays off under reduced motion. `?force=1` runs it in Chromium so a test can compare it
with native: identical at nine stops here.

### 3.4 Lenis and ScrollTrigger together, offline

One clock: the GSAP ticker drives Lenis; Lenis tells ScrollTrigger. The motion branch lives in `gsap.matchMedia`, and
the static layout is the default, so no script means no hidden content.

```js
const lenis = new Lenis({ autoRaf: false, anchors: true });          // respectReducedMotion stays true
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
gsap.matchMedia().add({ ok: '(prefers-reduced-motion: no-preference)' }, c => {
  if (!c.conditions.ok) return;
  gsap.to(track, { x: () => -(track.scrollWidth - innerWidth), ease: 'none', scrollTrigger: { trigger: '#hs',
    start: 'top top', end: () => '+=' + (track.scrollWidth - innerWidth), pin: true, pinType: 'transform',
    scrub: 1, invalidateOnRefresh: true } });
});
```

Build the offline file from [examples/scroll-libs.template.html](examples/scroll-libs.template.html):

```
npm i -D lenis@1.3.27 gsap@3.15.0
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-scroll/scripts/inline-libs.mjs scroll-libs.template.html page.html
```

The inliner keeps GSAP's headers, writes the notice `lenis.min.js` lacks, refuses a file containing `</script`, and
prints the ledger rows. Give nested scrollers `data-lenis-prevent`; never put `scroll-behavior: smooth` on `html` under
Lenis (two smoothers). Options, snap, patterns and every library trap: [references/libraries.md](references/libraries.md).

### 3.5 Prove it at named stops

Assert on resulting styles at named scroll positions (top, mid-page, pin start, middle and end, story start, middle
and end, bottom), natively, with the fallback forced, under reduced motion and in print; never on
`getAnimations()[n].currentTime`. Then the gate:

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-scroll/scripts/test-scroll.mjs [page.html]
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-scroll/scripts/test-libs.mjs [--keep built.html]
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/sensei-gate.mjs page.html
```

Adapt `test-scroll.mjs`'s `read()` and stops to a project's
own ids. Headless `scrollTo` is instant; how smoothing feels is judged in a real window on the target device.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Progress bar, reveal, parallax, pinned horizontal track, scrollytelling with steps and a discrete label, snap region, stuck nav, anchors, print, reduced motion, fallback | [examples/scroll-driven.html](examples/scroll-driven.html) | verified |
| Self-test at named stops (17 assertions) | [scripts/test-scroll.mjs](scripts/test-scroll.mjs) | verified |
| Lenis under ScrollTrigger: pin, smoothed scrub, nested box, anchors, matchMedia branch | [examples/scroll-libs.template.html](examples/scroll-libs.template.html) | verified (built with lenis 1.3.27, gsap 3.15.0) |
| Inline pinned libraries with notices and ledger rows | [scripts/inline-libs.mjs](scripts/inline-libs.mjs) | verified |
| Self-test of the built library page (13 assertions) | [scripts/test-libs.mjs](scripts/test-libs.mjs) | verified |
| Timeline anatomy, every native recipe with numbers, scroll-scrubbed media, use cases | [references/native-recipes.md](references/native-recipes.md) | reference |
| Lenis API and patterns, ScrollTrigger recipes and traps, polyfill, Motion, Locomotive, Splitting, licences | [references/libraries.md](references/libraries.md) | reference (Lenis Snap, polyfill, Motion `scroll()` not run) |

## 5. Quality bars

- Reduced motion: `document.getAnimations().length === 0` at every stop; every element at its end state; pinned and
  horizontal sections become ordinary flow with no horizontal page scroll; Lenis left at `respectReducedMotion: true`.
- Positions correct at every named stop (the self-test's table), natively and with the fallback forced (bar and
  scale within 0.01, positions within 1 px).
- Only `transform`, `translate`, `scale`, `opacity` (and colour on small elements) are driven by scroll; no layout
  property; `will-change` on a handful of layers at most; no per-frame custom property on `:root`.
- All content reachable with timelines unsupported, with no script, by keyboard and by find-in-page; scrollers that
  are not the page are focusable named regions; pinned stages trap nothing.
- Anchors land below a sticky header; print shows every end state.
- The gate passes in strict `file://` with CLS at 0.1 or less (the scroll pass counts pin shifts) and no external
  request; GSAP headers and a Lenis notice present in the built file; ledger rows added.
- Pinned stages use `svh` or `dvh` where the address bar must not change the pin length; checked at 375 px.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | The horizontal track animation runs and moves nothing | a percentage `translate` is relative to the element's own box; a flex track without `width: max-content` is one viewport wide, so `-100% + 100vw` is 0 | `width: max-content` on the track | tested (lane D2, and asserted here: 1680 px travel) |
| 2 | `currentTime` reads 30 percent at the halfway point of the pin | for scroll-driven animations `getAnimations()[n].currentTime` is a percentage of the `cover` range, not of your named range | assert on resulting styles and positions | tested (lane D2) |
| 3 | Every `view()` effect starts early after adding a sticky header's `scroll-padding-top`: the track 48.7 px into its travel at the pin start, the orb at 0.45 instead of 0.4 | `view-timeline-inset` defaults to `auto`, which reads the scroller's `scroll-padding` | `view-timeline-inset: 0px` on named timelines, `view(block 0px)` on anonymous ones | found and fixed here (test-scroll failed, then passed) |
| 4 | A sticky pin scrolls away | `overflow: hidden`, `auto` or `scroll` on an ancestor | `overflow: clip` | reported (lane D2), used here |
| 5 | The timeline is ignored | the `animation` shorthand resets `animation-timeline` | declare the timeline after the shorthand | reported (lane D2, specification) |
| 6 | A hover lift does nothing on a revealed card | the scroll-driven animation owns `transform` with fill both | reveal with `translate`, hover with `transform` or `scale` (or the reverse) | tested (SENSEI-LOG; `sensei-landing-hero` trap 5) |
| 7 | Content flashes before its range, or stays invisible where timelines are missing | no `fill-mode: both`; no `@supports not` reset | `both` in the shorthand; `@supports not (animation-timeline: view())` shows content | tested |
| 8 | "Works everywhere" and Firefox users get no effect or a wrong one | Firefox has no `animation-timeline` by default | the fallback, the polyfill or ScrollTrigger; say which | reported (can-i-use, 2026-10-19) |
| 9 | The fallback or Lenis stalls during testing | a hidden or background pane reports `visibilityState: hidden` and rAF stops | test headless, where pages are visible | tested (SENSEI-LOG) |
| 10 | A test "proves" smooth scrolling | headless `scrollTo` is instant; the glide measured here (259 of 600 px after 60 ms) proves smoothing exists, not that it feels right | judge the feel in a real window on the target device | tested here |
| 11 | Snap fights the smooth scroll | CSS scroll snap and Lenis conflict | Lenis Snap (`type: 'lock'` for a pager) | reported (Lenis docs) |
| 12 | A reveal is already at its end after an anchor jump | effects fire on programmatic jumps | correct behaviour; never make meaning depend on intermediate frames | reported (lane D2) |
| 13 | Pin length jumps on iOS mid-scroll | the address bar resizes the viewport | `svh` or `dvh`; ScrollTrigger `normalizeScroll` or `ignoreMobileResize` | reported (lane D2, GSAP docs) |
| 14 | Parallax edges show | the layer is not oversized for its travel | inset at least the travel (inset -25% for 12 percent) | reported (lane D2) |
| 15 | Every frame restyles the whole document | a scroll-progress custom property written on `:root` each frame | write it on the one element, or use a native timeline | tested (SENSEI-LOG) |
| 16 | Every screen change glides through the new content while it runs its own entrance | global `scroll-behavior: smooth` on `html` | jump instantly before the swap; smooth only per call where the content stays; under Lenis never both | tested (SENSEI-LOG, Ultra Bookworm) |
| 17 | The gate reports CLS 2.46 on a ScrollTrigger page | the default fixed pin switches the section's position as it pins and releases; the gate's scroll pass counts it | `pinType: 'transform'` (measured 0 shifts), or a CSS sticky pin with ScrollTrigger only scrubbing | found and fixed here |
| 18 | The inlined Lenis carries no licence notice | `lenis.min.js` 1.3.27 ships with no header; `lint-web`'s notice check looks only at scripts over 30 KB (Lenis is 18.8 KB) | `inline-libs.mjs` writes one from `package.json` and `LICENSE`; ledger row | found here |
| 19 | `lint-web` warns "drag without keys" on a built page with no dragging | the heuristic sees `pointerdown` and `touchstart` inside inlined GSAP or Lenis code | expected on built files with libraries; lint the template, check real drags by hand | found here |
| 20 | A scrub assertion fails by hundreds of pixels | `scrub: 1` catches up over one second | assert after it settles (1.6 s here), or `scrub: true` in a test build | found here |
| 21 | A modal, code box or map will not scroll, or scrolls the page | Lenis takes their wheel events | `data-lenis-prevent` (asserted: box scrolled 200 px, page 0) or `allowNestedScroll` | tested here |
| 22 | Motion-sensitive users still get gliding | `respectReducedMotion: false`, or a custom scroll animation with no reduce branch | keep the Lenis default (asserted: wheel and `scrollTo` land at once); `gsap.matchMedia` for ScrollTrigger | tested here |
| 23 | Content invisible when the script fails | CSS `opacity: 0` that only GSAP undoes | static layout as the default; the motion branch adds a class or sets start states from script | reported (repo-gsap) |
| 24 | ScrollTrigger positions wrong after images or fonts load | cached start and end | `ScrollTrigger.refresh()` on load and after layout changes; `invalidateOnRefresh` for function values | reported (repo-gsap) |
| 25 | A Lenis page scrolls but feels broken | the CSS is missing, or nothing calls `raf` | inline `lenis.css`; `autoRaf: true` or the ticker bridge | reported (repo-lenis) |
| 26 | A future Lenis update breaks the options | v2 renames options into nested objects and flips defaults | pin `lenis@1.3.27`; this skill is written for v1 | reported (repo-lenis roadmap) |

## 7. Licences

- **This skill's code** (both examples, the fallback, `inline-libs.mjs`, both self-tests) is HTML-Sensei's own, from
  lane D2's `code-interaction` lab.
- **Lenis**: MIT, darkroom.engineering. May be inlined into projects with its notice (the inliner adds it) and a
  ledger row. Not vendored in the plugin: projects install the pinned version.
- **GSAP and ScrollTrigger**: Standard no-charge licence (Webflow): any site or app, commercial included; never inside
  a no-code visual animation builder that competes with Webflow; headers never removed or altered. Inlined into
  projects only, pinned, with a ledger row; not vendored in the plugin.
- **Motion** (MIT), **scroll-timeline polyfill** (Apache-2.0), **Locomotive Scroll** and **Splitting** (MIT): usable
  with their notices; none is in this skill.
- **react-bits** scroll components (ScrollReveal, ScrollFloat, ScrollVelocity and others): ideas here; real use only
  by the fetch-and-port procedure in `sensei-ui-components`, into a project, never into the plugin.
- Demo galleries (Bramus's scroll-driven-animations.style, CSS-Tricks): reference only; check each demo's licence.

## 8. Verification

Run here (Windows 10, Node 24, Chrome through playwright-core 1.62, axe-core 4.14, swiftshader, strict `file://`):

- `scripts/test-scroll.mjs`: 17 of 17 pass: the seven lane D2 stops plus story start and end, native and forced
  fallback identical, reduced motion with zero animations and wrapped cards, print, anchors, the step label.
- `scripts/test-libs.mjs` with lenis 1.3.27 and gsap 3.15.0: 13 of 13 pass, including the pin, the full travel, the
  glide and its absence under reduced motion, the nested box and the anchor.
- `sensei-verify`'s gate: `examples/scroll-driven.html` passes (21 checks); the built library page passes (20) after
  the CLS fix (trap 17). The contact sheet was looked at.
- `lint-web` (`plugin/lib/lint/web.mjs`) is clean on both examples; the built file draws trap 19.

Not verified: Firefox and Safari (the fallback is proved only by forcing it in Chromium); real phones, touch scrolling
and frame rates on a target device; how Lenis feels; Lenis Snap, `syncTouch`, horizontal and infinite Lenis; the
`scroll-timeline` polyfill; Motion `scroll()`; ScrollTrigger snap, batch and `normalizeScroll`; scroll-scrubbed video
(owned by `sensei-lottie-rive-video`).

## 9. Carried by

- Agent `sensei-interaction-engineer` picks the engine per effect, writes the CSS with its fallback and end states,
  wires Lenis and ScrollTrigger from the template, and runs both self-tests and the gate; `sensei-reviewer` checks the
  quality bars; `sensei-packager` keeps the inlined notices and ledger rows in a packed file.
- Hook `lint-web.mjs` (PostToolUse on web files; warns, never blocks; rules in `plugin/lib/lint/web.mjs`):
  `reduced-motion:scroll-driven` (an `animation-timeline` with no reduced-motion path in CSS or script),
  `reduced-motion:gsap` and `reduced-motion:requestAnimationFrame`; `scroll-driven-unguarded` (`animation-timeline`,
  `scroll-timeline` or `view-timeline` declared outside an `@supports` block that tests a timeline feature, which is
  why this skill's named timelines sit inside `@supports`); `scroll-timeline-js-unguarded` (`new ScrollTimeline` or
  `new ViewTimeline` without a feature check); `smooth-scroll-on-html` (unless inside a `no-preference` query);
  `scrolltrigger-markers` (`markers: true`); `no-cdn` when the profile is offline (Lenis or GSAP from a CDN); and
  `vendored-without-notice` for inline scripts over 30 KB. `gate-claim.mjs` needs a fresh passing gate before "done".
- Not enforced by any hook (covered by this skill's tests and the reviewer): a Lenis page without its CSS or a `raf`
  call, `respectReducedMotion: false`, Lenis and CSS snap together, nested scrollers without `data-lenis-prevent`,
  sticky under an `overflow: hidden` ancestor, a flex track without `width: max-content`, the `scroll-padding` inset,
  ScrollTrigger's fixed-pin CLS, and a Lenis file under 30 KB with no notice.
