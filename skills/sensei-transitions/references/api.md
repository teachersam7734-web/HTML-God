# View Transitions and FLIP, in depth

Sources: `domain-view-transitions.md` in the HTML-Sensei build project's research notes (not shipped) (lane D2, 2026-10-19; support data from web.dev's
Baseline post and Bramus's View Transitions Feature Explorer, last updated 2026-03-24),
`domain-deployment-sharing.md` (lane D5), `repo-gsap.md`, the build project's field log (SENSEI-LOG, not shipped). "Tested here" means
`scripts/test-vt.mjs`.

## 1. Mechanisms and support

| Mechanism | Scope | Support (lane D2's sources) | Pick when |
|---|---|---|---|
| Same-document (`document.startViewTransition`) | one page | Chrome and Edge 111, Safari 18, Firefox 144 | any state change in a single file: tabs, slides, route-like swaps, detail views, theme switch |
| Cross-document (`@view-transition { navigation: auto }`) | same-origin pages | Chrome and Edge 126, Safari 18.2, Firefox: not yet | a multi-page site or a folder of pages |
| FLIP | in-place layout | everywhere | reorders, expanding panels, and the fallback where the API is missing |
| Routers: Barba (`@barba/core` 2.10.3), Swup 4.10.0, Taxi (`taxi.js` 0.3.5), all MIT | fetch the next page, swap a container | everywhere | only for Firefox cross-page parity or custom choreography; they also take over history, scroll and link handling (not run) |

Newer features in the family (support from the same table; not run here unless marked): `view-transition-class`
(Chrome 125, Safari 18.2, Firefox 144); `view-transition-name: match-element` (Chrome 137, Safari 18.4, Firefox 144);
types (Chrome 125, Safari 18.2, Firefox 147; tested here); `document.activeViewTransition` (Chrome 142, Safari 26.2,
Firefox 147; used by the tests here); nested groups (Chrome 140); element-scoped transitions (Chrome 147).

## 2. How a transition runs

1. `startViewTransition(update)` captures the old state as snapshots: the root, and every element with a
   `view-transition-name` (each name once).
2. The update runs (input is held during capture; a slow update makes the page feel hung).
3. The new state is captured; the browser builds the pseudo tree and animates it:

```
::view-transition
  ::view-transition-group(name)          size and position, old box to new box
    ::view-transition-image-pair(name)
      ::view-transition-old(name)         crossfade out (an image)
      ::view-transition-new(name)         crossfade in (live)
```

4. `vt.ready` resolves when the pseudo tree exists (the moment to start WAAPI on a pseudo element with
   `pseudoElement: '::view-transition-new(root)'`); `vt.finished` when it is gone; `vt.skipTransition()` jumps to the
   end. Tested here: the hero group's keyframes run from the card's box (306.7 by 160 at 347, 77) to the hero's (952
   by 300 at 24, 140) at 1000 by 700.

Snapshots are images: text inside a morphing element stretches when the aspect ratio changes; fixed elements without
their own name are part of the root snapshot and crossfade; videos, canvases and iframes freeze during the morph.

Aspect ratio, tested here on paused middle frames: by default each image keeps its own ratio at the group's width, so
the old card (1.9 to 1) drawn at the hero's width overflowed the group as a tall faded box. `height: 100%;
object-fit: cover` alone centred it but still painted outside; adding `overflow: clip` to
`::view-transition-old(hero), ::view-transition-new(hero)` removed it. For text inside a morph with a big aspect
change, name the children separately or crossfade.

## 3. Names

- One element per name per snapshot; a duplicate aborts the whole transition with only a console message. Move the
  name inside the update: off the old element, onto the new one (the example does).
- A name set by a class used on many elements (`.card { view-transition-name: card }`) breaks the same way; use
  `match-element` or set the name on the one element in play.
- `view-transition-class: card` styles many groups at once: `::view-transition-group(*.card) { ... }` (not run).
- Clean up when the transition finishes (`vt.finished.then(...)`), not on a timer: a timer can fire mid-transition
  or long after a second one started.

## 4. Types

Same document: `startViewTransition({ update, types: ['back'] })`; styles with
`:root:active-view-transition-type(back)::view-transition-old(root) { ... }`. Engines that only take a callback throw
on the object form: the wrapper catches and retries with the callback.

Cross document: the new page decides. In `pagereveal`, `e.viewTransition.types.add('forward')`; or declare
`@view-transition { navigation: auto; types: slide }` in CSS. A type added in `pageswap` on the old page does not
arrive (tested here, http and file://: the old page's `pageswap` had a transition, added `from-swap`, and the new page
saw only the type it set itself). Direction on arrival: the page's own depth, or the Navigation API
(`navigation.activation.navigationType === 'traverse'` for Back), guarded because not every engine has it.

## 5. Cross document over file://

Lane D5 reported that cross-document transitions ran on `file://` in Chrome, against the expectation that opaque file
origins would block them. Retested here under the strict launch the gate uses (no `--allow-file-access-from-files`):
`pagereveal` received a transition that finished, forward and back types were set, and `sessionStorage` written by the
old page was readable on the new one. So a folder of pages opened by double-click gets them in Chrome. Not verified:
Safari on `file://`, Firefox (no support), and any engine's behaviour when the pages are in different folders.

## 6. Focus, title, scroll: the transition does none of it

After a view swap: move focus to the new view's heading (`tabindex="-1"`, `focus({ preventScroll: true })`, no ring
on non-controls), because the pressed control is now hidden and focus falls to `<body>` (SENSEI-LOG); on return, focus
the control the user came from; update `document.title`; jump scroll instantly before the swap, never smooth-scroll
through new content (SENSEI-LOG). Tested here: focus on the detail heading, back on the card; the title both ways.

## 7. FLIP

First (read boxes), Last (change the DOM, read again), Invert (transform from new to old), Play (animate to none).
`examples/flip.js` is a classic script (a module import from `file://` is blocked by the browser), reads First while
an earlier FLIP is still running (`getBoundingClientRect` includes the transform, so it is where the element is on
screen), cancels those animations, then mutates. Tested here: start transform `matrix(1, 0, 0, 1, 0, -70)` for a tile
moved from the first row to the second, end `none`; an interrupted FLIP started exactly where the tile was on screen;
under reduced motion the change applies and nothing animates.

Scale distorts children and border radii: animate position only, counter-scale children, animate `clip-path`, or use
GSAP Flip.

| Library | For | Licence | Status |
|---|---|---|---|
| GSAP Flip (25.5 KB) | `Flip.getState()`, change, `Flip.from(state, { absolute: true })`; nested and scale-aware | Standard no-charge licence, keep headers | not run |
| @formkit/auto-animate 0.10.0 | one-line add, remove and reorder for lists; no shared-element morph | MIT | not run |
| react-flip-toolkit 7.2.4 | FLIP in React | MIT | not run |
| Astro's client router, React's `<ViewTransition>`, Next.js' experimental flag | framework wrappers over the native API | MIT | names and stability not verified: check their docs first |

## 8. By use case

| Use case | Do |
|---|---|
| Single-file page, course, deck | same-document transitions for view swaps; the transition replaces a separate entrance animation (never both) |
| Small multi-page site | cross-document with a named header and named shared heroes |
| Presentation | slide changes with a `slide` type; a chart that moves between slides is the headline win (`sensei-presentations`) |
| Dashboard | filter changes and drill-down: name the tile that expands (`sensei-dataviz`) |
| Game | menu to level swaps only |
| Theme switch | the circle reveal in `sensei-tokens-theming` |
| Film | not applicable (render time) |
