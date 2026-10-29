---
name: sensei-transitions
description: Transitions between states and pages in HTML with continuity. Same-document View Transitions through one guarded wrapper (reduced motion, hidden tabs, missing API, a second press), shared-element morphs from a card to a hero with names moved inside the update, direction types, the snapshot aspect-ratio fix, focus and title management; cross-document View Transitions between pages of a site (also proved on file:// in Chrome) with types set on arrival; FLIP reorders that survive interruption, as a classic script that loads from file://; and a self-test that reads the morph's keyframes against both rectangles. Use when someone says page transition, view transition, View Transitions API, startViewTransition, morph, shared element, card to detail, hero animation between pages, smooth navigation, route transition, slide transition between views, FLIP, animate layout change, reorder animation, list shuffle animation, or "make the page change feel smooth".
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-transitions

A transition says where the new state came from. Doctrine first (`html-sensei`): continuity where it explains
something, no transition where it would only delay, reduced motion built in, and focus, title and scroll handled
because the browser does none of it.

## 1. When to use

View swaps in one page (gallery to detail, tabs, slides, route-like screens), navigation between pages of a site,
layout changes in place (reorder, expand, filter). The theme switch's circle reveal is a View Transition too, and it
is already written and tested: `sensei-tokens-theming` (section 3.4 there); do not rebuild it here.

| The job is | Skill |
|---|---|
| The theme switch (circle reveal, crossfade under Calm and reduced motion) | `sensei-tokens-theming` |
| Entrance, hover and press motion; springs and `linear()` easing; the reduced-motion gate in general | `sensei-motion-ui` |
| Ease curves, durations and continuity as craft (match cuts, hand-offs) | `sensei-motion-graphics` |
| Scroll-linked motion | `sensei-scroll` |
| Dragging that triggers a reorder | `sensei-pointer` for the drag, this skill for the FLIP |
| Slide decks and their steps and morphs | `sensei-presentations` |
| Dashboard drill-down | `sensei-dataviz` with this skill's naming |
| Packaging several pages into one file | `sensei-single-file` (cross-document transitions need separate pages) |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Mechanism | same-document View Transition; cross-document View Transition; FLIP; a router (Barba, Swup, Taxi) | one file or SPA: same-document; separate pages: cross-document; a layout change in place or no API: FLIP; Firefox cross-page parity or custom choreography: a router (not run) |
| What morphs | the root crossfade only; one shared element; several named parts | one shared element tells the story (card to hero); name parts separately when text would stretch |
| Direction | none; types (`forward`, `back`, `slide`) | types whenever back and forward should look different |
| Where types are set | the wrapper's `types`; the new page's `pagereveal`; `@view-transition { types }` | same document: the wrapper; cross document: the new page (types from `pageswap` never arrive) |
| FLIP engine | `flip.js` (this skill); GSAP Flip; auto-animate | `flip.js` for moves; GSAP Flip when scale and nesting matter and GSAP is on the page; auto-animate for plain list add and remove |
| Duration | root 250 to 300 ms; shared group 400 to 450 ms | total under about 500 ms; no group over 600 ms; eases from `sensei-motion-graphics` |
| Reduced motion | skip the API in script; `navigation: none` in CSS | always both; the state still changes |

## 3. Core technique

### 3.1 One wrapper, every caller

```js
var current = null;
function transition(update, types){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce || document.hidden) { update(); return null; }
  if (current) { try { current.skipTransition(); } catch (e) {} }      // a second press finishes the first
  var vt;
  try { vt = document.startViewTransition({ update: update, types: types || [] }); }
  catch (e) { vt = document.startViewTransition(update); }              // engines that take only a callback
  current = vt;
  vt.finished.catch(function(){}).then(function(){ if (current === vt) current = null; });
  return vt;
}
```

Skipping in script, not only with `animation: none` in CSS, matters: the CSS-only route still runs the API and holds
input during capture. Keep `update` synchronous and fast; fetch data before calling it.

### 3.2 Shared element: move the name inside the update

```js
card.classList.add('vt-active');                       // old state: the card carries the name
transition(function(){
  card.classList.remove('vt-active');                  // never twice in one snapshot
  showDetail(card);
  hero.classList.add('vt-active');                     // new state: the hero carries it
  document.title = card.textContent + ' | Gallery';
  heading.focus({ preventScroll: true });              // the pressed card is hidden now
}, ['forward']);
```

```css
.vt-active{view-transition-name:hero}
::view-transition-group(hero){animation-duration:.45s;animation-timing-function:cubic-bezier(.2,.8,.2,1)}
::view-transition-old(hero),::view-transition-new(hero){height:100%;object-fit:cover;overflow:clip}   /* aspect fix */
:root:active-view-transition-type(back)::view-transition-old(root){animation-name:out-right}
header{view-transition-name:site-header}             /* fixed and sticky bars get their own name or they crossfade */
```

Going back: name the hero in the old state and the card it came from in the new one, return focus to that card, and
remove the card's name when `vt.finished` settles (not on a timer). The full example:
[examples/vt-same.html](examples/vt-same.html).

### 3.3 Cross document: opt in on both pages, decide the type on arrival

```css
@view-transition{navigation:auto}
@media (prefers-reduced-motion:reduce){@view-transition{navigation:none}}
```

```js
addEventListener('pagereveal', function(e){
  if (!e.viewTransition) return;
  var nav = window.navigation, back = nav && nav.activation && nav.activation.navigationType === 'traverse';
  e.viewTransition.types.add(back || pageDepth === 0 ? 'back' : 'forward');
});
```

Persistent parts (the header) and matching parts (card on one page, hero on the next) share names across pages. In
Chrome this also works between pages opened from disk, under the gate's strict `file://` launch (TRAPS 4). Example:
[examples/vt-multi/index.html](examples/vt-multi/index.html) and [examples/vt-multi/detail.html](examples/vt-multi/detail.html).

### 3.4 FLIP that survives interruption

Read First while any earlier FLIP still runs (`getBoundingClientRect` includes the transform: where the element is on
screen), cancel those animations, change the DOM, read Last, animate the inverse transform to `none`; under reduced
motion change and animate nothing. [examples/flip.js](examples/flip.js) is a classic script defining `window.flip`, so
it loads from a sibling file over `file://` (a module import is blocked there) or pastes inline; demo:
[examples/flip.html](examples/flip.html).

```js
flip([...list.children], () => list.appendChild(list.firstElementChild), { duration: 300 });
```

The pseudo-element tree, names, types, support, routers and library choices:
[references/api.md](references/api.md).

### 3.5 Prove it

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-transitions/scripts/test-vt.mjs
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/sensei-gate.mjs page.html --routes "click:.card"
```

The self-test reads `::view-transition-group(name)`
keyframes from `document.getAnimations()` after `vt.ready` and compares them with both rectangles, and runs the
cross-document pair over http and strict `file://`. To see a frame, pause every animation after `vt.ready`, set
`currentTime` to the middle and take a screenshot (that is how the aspect overflow in TRAPS 15 was found).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Card to hero morph, types, named header, focus and title, double press, reduced motion | [examples/vt-same.html](examples/vt-same.html) | verified |
| Two pages with a cross-document transition, types on arrival, reduced motion | [examples/vt-multi/index.html](examples/vt-multi/index.html), [examples/vt-multi/detail.html](examples/vt-multi/detail.html) | verified (http and strict `file://`) |
| FLIP, interrupt-safe, reduced-motion aware, classic script | [examples/flip.js](examples/flip.js), [examples/flip.html](examples/flip.html) | verified |
| Self-test (16 assertions) | [scripts/test-vt.mjs](scripts/test-vt.mjs) | verified |
| How a transition runs, names, types, support, file://, focus, FLIP libraries, use cases | [references/api.md](references/api.md) | reference (routers, GSAP Flip, auto-animate, `match-element` not run) |

## 5. Quality bars

- Reduced motion: no ViewTransition object and no FLIP animation, and the state still changes (asserted for same
  document, cross document and FLIP).
- Without the API the update runs; cross-document pages work as plain links where unsupported.
- The shared group's keyframes start at the old element's rectangle and end at the new one's (within 1 px).
- Root 250 to 300 ms, shared groups 400 to 450 ms, nothing over 600 ms; input never waits on a slow update.
- No duplicate names, and none left behind after a transition (asserted).
- Focus lands on the new view's heading and returns to the control the user came from; `document.title` follows;
  scroll jumps before the swap, never glides through new content.
- A paused middle frame looked at for every morph whose aspect ratio changes.
- The gate passes in strict `file://` for every page, with the route that opens the view.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | The transition silently does not happen, one console message | a `view-transition-name` on two elements in one snapshot | move the name from the old element to the new one inside the update | reported (lane D2); the example asserts no stray names |
| 2 | Every card shares one name and nothing morphs | a name set by a class used on many elements | name only the element in play, or `match-element` | reported (lane D2) |
| 3 | The new page has no direction type | types added in `pageswap` on the old page do not reach the new document | set them in the new page's `pagereveal`, or in `@view-transition { types }` | tested (lane D2 over http; rerun here over http and strict `file://`, with `pageswap` proved to have had a transition) |
| 4 | Cross-document transitions written off for double-clicked pages | the expectation that opaque `file://` origins block them | they run in Chrome under the gate's strict launch (`pagereveal` got a transition that finished, types set) | reported by lane D5; retested here under strict `file://`; Safari not checked |
| 5 | The page feels frozen on click | input is held while the old state is captured and the update runs | keep the update synchronous and fast; await data first | reported (lane D2) |
| 6 | A fixed header jumps or fades during the transition | without its own name it is part of the root snapshot | give fixed and sticky bars their own `view-transition-name` | reported (lane D2); the examples name the header |
| 7 | A video, canvas or iframe freezes mid-morph | snapshots are images | accept for short morphs; keep live media out of named groups | reported (lane D2) |
| 8 | An item flashes in its old place | its name stays on an element that remains in the DOM | test forward and back; remove names when done | reported (lane D2) |
| 9 | Reduced-motion users still wait on the API | only `animation: none` in CSS | skip the API in script; `navigation: none` for pages | reported (lane D2); asserted here |
| 10 | FLIP distorts children and corners | the inverse transform scales | animate position only, counter-scale children, `clip-path`, or GSAP Flip | reported (lane D2) |
| 11 | A second FLIP jumps before moving | First was read after cancelling, or with the old animation ignored | read First while the earlier FLIP runs, then cancel it | reported (lane D2); fixed and asserted here (start equals the on-screen position) |
| 12 | Back, scroll, analytics or forms break after adding a router | routers take over link clicks and history | test back and forward, scroll restoration, hash links, `target="_blank"`, posts | reported (lane D2), not run |
| 13 | "Works everywhere" and Firefox gets plain navigation | no cross-document support in Firefox at the time of the research | say "Chrome and Safari"; a router only if parity is required | reported (lane D2) |
| 14 | Transitions never run while testing | a hidden pane stops frames | test headless | tested (SENSEI-LOG) |
| 15 | A tall faded box appears around the hero mid-morph | each snapshot keeps its own aspect ratio at the group's width; `object-fit` alone still paints outside | `height: 100%; object-fit: cover; overflow: clip` on the old and new images | found here on a paused middle frame, fixed and photographed again |
| 16 | Focus falls to `<body>` after opening the detail view | the pressed control is now hidden | focus the new heading (`tabindex="-1"`); on return, focus the original control | tested (SENSEI-LOG); asserted here |
| 17 | A card keeps its name, or loses it mid-transition | cleanup on a timer (the lab used 800 ms) | clean up when `vt.finished` settles | found here |
| 18 | A quick second press leaves a half state | a new transition while one runs | `skipTransition()` on the running one; clear the marker only if it is still current | tested (SENSEI-LOG theme switch); asserted here |
| 19 | The FLIP demo does nothing when opened from disk | `<script type="module">` importing a sibling file is blocked on `file://` (CORS, origin null) | a classic script (`window.flip`) or inline it | found here: the lab's `flip.html` fails under strict `file://` |
| 20 | `startViewTransition({ update, types })` throws | an engine that takes only a callback | the wrapper catches and calls it with the callback | reported (lane D2); in the wrapper |
| 21 | A spring easing on a group does nothing in some engines | a `linear()` declaration is dropped as invalid where unsupported | declare a plain easing first, then the `linear()` one (generator in `sensei-motion-ui`) | reported (lane D2, micro-interactions) |

## 7. Licences

- **This skill's code** (`vt-same.html`, `vt-multi/`, `flip.js`, `flip.html`, `test-vt.mjs`) is HTML-Sensei's own, from
  lane D2's `code-interaction` lab.
- **GSAP Flip**: standard no-charge licence; inline into projects with headers kept, pinned, a ledger row; not in the
  plugin. **Barba, Swup, Taxi, auto-animate, react-flip-toolkit**: MIT, usable with notices; none is in this skill.
- **react-bits** transition components: ideas only here; real use through `sensei-ui-components`' fetch-and-port
  procedure, into a project, never into the plugin.

## 8. Verification

Run here (Windows 10, Node 24, Chrome through playwright-core 1.62, axe-core 4.14, swiftshader):

- `scripts/test-vt.mjs`: 16 of 16 pass: the morph's keyframes (306.7 by 160 at 347, 77 to 952 by 300 at 24, 140),
  types, focus, title, cleanup, the double press, reduced motion; the cross-document pair over http and over strict
  `file://`, both directions, `pageswap` proved and its type absent, reduced motion; FLIP start, end, interruption and
  reduced motion.
- `sensei-verify`'s gate in strict `file://`: `vt-same.html` (with the card route), `flip.html` (with the shuffle
  route), `vt-multi/index.html` and `detail.html` all pass. A paused middle frame of the morph was looked at before and
  after the aspect fix.
- `lint-web` (`plugin/lib/lint/web.mjs`): clean on every example.
- The lab's module-script `flip.html` was run under strict `file://` to confirm trap 19.

Not verified: Firefox and Safari (rendering, cross-document on `file://` in Safari); frames other than the paused
middle; screen reader speech of the view change; routers; GSAP Flip; auto-animate; `match-element`,
`view-transition-class`, nested and element-scoped transitions; framework wrappers.

## 9. Carried by

- Agent `sensei-interaction-engineer` maps the page's state changes, assigns names, writes the wrapper and the FLIPs,
  and runs the self-test and the gate; `sensei-reviewer` checks focus, titles and reduced motion under its
  accessibility lens; `sensei-art-director` owns the theme switch through `sensei-tokens-theming`.
- Hook `lint-web.mjs` (PostToolUse on web files; warns, never blocks; rules in `plugin/lib/lint/web.mjs`):
  `view-transition-unguarded` (`document.startViewTransition` with no feature check anywhere in the file);
  `reduced-motion:view-transitions` (`startViewTransition` in a file with no reduced-motion handling in CSS or
  script); `reduced-motion:web-animations` (an `element.animate()` call, as in `flip.js`, with no reduced-motion check
  in script); `transition-all`. `gate-claim.mjs` needs a fresh passing gate before "done".
- Not enforced by any hook (covered by the self-test and the reviewer): a cross-document `@view-transition` with no
  reduced-motion override (the hook looks only for `startViewTransition`), duplicate or class-wide names, types added
  in `pageswap`, focus and title after a swap, cleanup on a timer, a module script loaded from `file://`.
