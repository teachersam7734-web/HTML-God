---
name: sensei-motion-ui
description: "Motion in interactive pages: choosing CSS transitions, WAAPI, Motion (motion.dev) or GSAP; springs as CSS linear() easing; micro-interactions (press, hover lift, switch, toast, skeleton, form feedback, success check) as state machines with announced states; layering states with individual translate, scale and rotate; landing steps on the animation's own clock and syncing to the audio clock; inlining pinned GSAP and Motion with their licence headers; and the reduced-motion gate every animation system must pass (vanilla Motion and GSAP ignore the setting on their own). Use when someone says animation, animate, transition, hover effect, button press, micro-interaction, spring, bounce, easing, stagger, entrance, loading state, GSAP, Motion, Framer Motion, WAAPI, reduced motion, make it feel alive or snappy, or sync animation to sound."
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-motion-ui

Motion in a page answers the user: it confirms, explains a change of state, or draws the eye once. It starts within
100 ms, can be interrupted, never carries meaning alone, and every system that moves has a reduced-motion path. Eases
and durations for designed motion live in `sensei-motion-graphics`; this skill is the engineering of motion in
interactive UI.

## 1. When to use

Any hover, press, open, close, entrance, toggle, toast, loading or feedback motion in a page; choosing an animation
library; wiring reduced motion; syncing motion to sound.

Another skill owns it instead:

| Request | Skill |
|---|---|
| The ease tables, duration tables, entry and exit grammar, overshoot budget | `sensei-motion-graphics` (`references/eases-and-durations.md`) |
| Films and seek pages (every value a pure function of t) | `sensei-motion-graphics`, `sensei-video-pipeline` (`scripts/spring.js` for pure springs) |
| Scroll-driven animation, ScrollTrigger, Lenis, pinning | `sensei-scroll` |
| Cursor, magnetic, tilt, drag physics | `sensei-pointer` |
| View Transitions, FLIP, shared-element morphs | `sensei-transitions` |
| Text effects, splitting, Persian-safe reveals | `sensei-typography` |
| The components themselves (dialog, popover, tabs) | `sensei-ui-components` |
| Sound design and the audio graph | `sensei-audio` |
| Theme-switch transitions | `sensei-tokens-theming` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Engine | CSS transition; CSS `@keyframes`; WAAPI; Motion; GSAP; pure f(t) | state change: CSS; a short sequence: keyframes or WAAPI; chained steps or tests that need promises: WAAPI; interruptible springs, gestures, layout in vanilla: Motion; timelines and the plugin set: GSAP; anything rendered to video: pure f(t). One of Motion or GSAP per page ([references/engines.md](references/engines.md)) |
| Easing | named curves from `sensei-motion-graphics`; a spring as `linear()`; an engine spring | UI release and toggles: spring `linear()`; designed entrances: the measured eases; Motion or GSAP when already on the page |
| Duration | the spring's settle time; the motion-graphics duration table | springs: the generator's `duration`; tweens: the tables (press 80 ms, release on the spring) |
| Layering states | `transform`; individual `translate`, `scale`, `rotate` | individual properties whenever an element has more than one source of motion (entrance plus hover plus press) |
| Sequencing | timers; `finished` promises; a timeline | promises or a timeline; never timers guessing durations |
| Sync to sound | page clock; audio clock | audio clock as master whenever a sound and a picture must hit together |
| Reduced motion | remove; shorten to a fade; replace movement with a colour or opacity change | removal of movement always; keep state changes visible; essential motion becomes a fade |
| Library delivery | inline pinned UMD with header; a bundle; a CDN | inline or bundle; never a CDN in an offline deliverable |

## 3. Core technique

### 3.1 The reduced-motion gate (every system, every page)

CSS: `@media (prefers-reduced-motion: reduce) { ... }` beside each animation. Script: one switch for every engine,
live when the setting changes ([scripts/motion-gate.js](scripts/motion-gate.js)):

```js
const G = SenseiMotionGate;                      // G.reduce is current; <html data-motion="reduce|full">
G.animate(el, keyframes, opts);                  // WAAPI that lands on the last frame under reduce
const animate = G.motion(Motion.animate);        // vanilla Motion ignores the setting: wrap it
G.on(reduce => reduce ? stopLoop() : startLoop());
const mm = gsap.matchMedia();                    // GSAP: write matchMedia in the page (G.gsap wraps it)
mm.add({ full: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, c => {
  if (c.conditions.reduce) { gsap.set(items, { autoAlpha: 1, y: 0 }); return; }
  gsap.fromTo(items, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: .08 });
});
```

Tested: a 1 s vanilla Motion animation still took 1,007 ms under reduced motion; wrapped, 17 ms. Under reduce: no
infinite animation, no shimmer, no shake, end states shown, state changes still visible.

### 3.2 Springs without a library

```html
<script src="spring-linear.js"></script>
<script>springLinear.apply(document.documentElement, 'spring', { stiffness: 260, damping: 16 });</script>
<style>
.btn { transition: scale .35s ease; transition: scale var(--spring-ms) var(--spring); }   /* plain easing first */
.btn:active { scale: .96; transition-duration: 80ms; }                                     /* press instant, release springs */
</style>
```

`springLinear()` returns `{ css, duration, peak, stops, zeta }` from the exact step response (stiffness 260, damping 16:
peak 1.166, settle 812 ms, 36 stops, within 0.0022 of the closed form). Use `duration` as the transition duration: a
shorter one cuts the tail. Detail: [references/springs-and-clocks.md](references/springs-and-clocks.md).

### 3.3 Layer states with individual properties

```css
.card { animation: rise .5s both; }                       /* the entrance owns transform while in effect */
@media (hover: hover) and (pointer: fine) { .card:hover { translate: 0 -4px; } }   /* composes: lifts */
.card:active { scale: .985; transition: scale .1s, translate .25s; }               /* list every property that can win */
```

Tested: the `translate` lift moved the card 4 px; the same lift written as `transform` moved it 0 px.

### 3.4 Micro-interactions as state machines

Idle, pending, success, error: each visible, announced (`aria-live` region present from load, `aria-invalid`,
`aria-busy`), and leaving focus where it was (`aria-disabled` plus a guard, never `disabled` on the focused button).
Recipes and bars: [references/micro-interactions.md](references/micro-interactions.md).

### 3.5 Clocks

Chain on `finished`, exit on `transitionend` with a backstop of about twice the duration, and when a sound and a
picture must hit together make the audio clock the master: book each beat about 100 ms ahead on
`AudioContext.currentTime`, map it with `getOutputTimestamp()`, and set the pulse's `animation.startTime` to it.
Never change the duration of a running infinite animation for tempo (the phase jumps: progress 0.24 to 0.62 measured).
[examples/heartbeat.html](examples/heartbeat.html), [references/springs-and-clocks.md](references/springs-and-clocks.md).

### 3.6 GSAP and Motion in one offline file

```
npm i -E gsap@3.15.0 motion@14.6.0
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-motion-ui/scripts/vendor-inline.mjs page.src.html dist/page.html [--ledger]
```

The page marks each file (`<!-- sensei-vendor: gsap/dist/gsap.min.js -->`, core before plugins). The script inlines
from the project's `node_modules`, keeps GSAP's licence header, adds the package's MIT text to Motion's banner-less
UMD, escapes `</script`, refuses when a package is missing, prints the pinned versions and, with `--ledger`, writes the
ledger rows. In a live page keep GSAP `fromTo`'s default `immediateRender` (true); `false` is for paused seek timelines.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Spring to CSS `linear()` generator | [scripts/spring-linear.js](scripts/spring-linear.js) | verified (Node and Chrome) |
| Reduced-motion gate for CSS, WAAPI, Motion and GSAP | [scripts/motion-gate.js](scripts/motion-gate.js) | verified |
| Micro-interactions: spring press, hover lift over an entrance, switch, toast with backstop, skeleton, form feedback, pending to success keeping focus, check draw, guarded haptics | [examples/micro.html](examples/micro.html) | verified, gate pass |
| Audio-clock heartbeat with look-ahead scheduler, page-clock fallback, stop when hidden | [examples/heartbeat.html](examples/heartbeat.html) | verified (scheduling), gate pass |
| One entrance in WAAPI, Motion and GSAP behind one gate (build with `vendor-inline.mjs`) | [examples/engines.src.html](examples/engines.src.html) | verified with gsap 3.15.0 and motion 14.6.0, gate pass on the built page |
| Inline pinned libraries with headers and ledger rows | [scripts/vendor-inline.mjs](scripts/vendor-inline.mjs) | verified |
| The test of all of the above (51 assertions with `--libs`, 39 without) | [scripts/test-motion-ui.mjs](scripts/test-motion-ui.mjs) with [scripts/pw.mjs](scripts/pw.mjs) | verified |

## 5. Quality bars

- Feedback within 100 ms of input; press instant, release on a spring whose duration is its settle time.
- Every animation system on the page has its reduced-motion path, proven in a reduced-motion run: no infinite
  animation, no movement-only meaning, end states visible (the gate's reduced-motion check and this skill's test).
- Every animated state has a non-motion equivalent and is announced; focus never falls to `<body>`.
- UI springs overshoot about 5 to 20 percent; press-like moves settle under about 600 ms, larger moves under about
  900 ms.
- Only `transform` or individual transform properties, `opacity`, `filter` and colour animate; no `transition: all`.
- Hover motion only under `(hover: hover) and (pointer: fine)`; `:active` has its own feedback for everyone.
- Flashing at most 3 per second.
- Vendored libraries pinned, headers intact, ledger rows present; one of Motion or GSAP per page.
- Frame timing judged on the target device; software-GL numbers are relative (the owner's rule: never cut motion for
  the development machine).

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Motion still plays for users who asked for less | vanilla Motion ignores `prefers-reduced-motion` (1,020 ms lane, 1,007 ms here for a 1 s animation) | `SenseiMotionGate.motion(Motion.animate)` or your own check | tested |
| 2 | GSAP plays under reduced motion | GSAP has no built-in handling | `gsap.matchMedia()` with a reduce branch setting end states | reported (lane), branch tested here |
| 3 | Hover lift never happens; only the shadow grows | an entrance or scroll-driven animation with fill `both` owns `transform`, outranking `:hover` | lift with `translate` | tested (field log, and here: 0 px against 4 px) |
| 4 | On press the element snaps level before shrinking | `:active { transform: scale() }` replaces the hover transform | `translate` for lift, `scale` for press | tested (field log) |
| 5 | The press transition disappears in one state | a more specific rule's `transition` list replaces it | list every individual property in each list that can win | tested (field log) |
| 6 | Spring easing ignored in an older engine | invalid `linear()` drops the declaration | plain easing first | reported (lane) |
| 7 | The spring's end snaps | duration shorter than the settle time | the generator's `duration` | by construction |
| 8 | Cards show fully, then jump to their start and animate | `immediateRender: false` on a live-page GSAP `fromTo` | keep the default in live pages; `false` only in paused seek timelines | found while testing this skill |
| 9 | The picture jumps phase on every tempo change | the duration of a running infinite animation was changed (directly or by a custom property) | one animation per beat, or `playbackRate` at a beat boundary | tested (field log, and here: 0.24 to 0.62) |
| 10 | Sound and pulse drift apart | the picture runs on the page clock, the sound on the audio clock | audio clock as master, look-ahead scheduling, `startTime` from `getOutputTimestamp()` | tested (field log 1 to 18 ms; scheduling here) |
| 11 | A scheduled-start test pairs the wrong events | `OscillatorNode.frequency.value` reads the default until automation runs | pair by order, not frequency | tested (field log) |
| 12 | A fade is cut short, or never seen | a backstop shorter than a late `transitionend` (971 ms for 420 ms on a slow frame); `hidden` set in the same tick | backstop about twice the duration; hide after the end | tested (field log) |
| 13 | An entrance plays under an opening film | an `animation` shorthand in a more specific rule reset `animation-play-state: paused` | the pause rule outranks every shorthand it must hold | tested (field log) |
| 14 | Content invisible in print or when the observer never fires | entrances paused at opacity 0 | no observer means play; reduced motion removes the animations; `@media print` runs them | tested (field log) |
| 15 | The whole document restyles every frame | a custom property written on `:root` each frame | write on the element that uses it, only when the rounded value changes | tested (field log) |
| 16 | Motion speed depends on the frame rate | a fixed fraction per frame | `1 - Math.pow(k, dt)` smoothing | tested (field log) |
| 17 | Focus falls to `<body>` during a pending state | `disabled` on the focused button | `aria-disabled` plus a guard | tested here |
| 18 | A toast is not announced | the live region arrived with its message | the region exists from load | tested |
| 19 | Hover sticks after a tap on phones | `:hover` persists on touch | hover motion under `(hover: hover) and (pointer: fine)` | tested (field log) |
| 20 | Every jump glides through new content | `scroll-behavior: smooth` on `html` | `auto` on `html`; smooth per call where the content stays | tested (field log) |
| 21 | A vendored Motion file ships without its notice | the UMD has no banner | `vendor-inline.mjs` adds the MIT text | read from the file (14.3.0 and 14.6.0) |
| 22 | Motion+ features assumed in the free build | `splitText`, `scrambleText`, `cursor` and others are paid and private | the free exports only; never ship Motion+ source | reported (lane) |
| 23 | GSAP headers stripped by a minifier or an inliner | notices removed | keep `/*! ... @license */`; `vendor-inline.mjs` keeps them | read from the licence |
| 24 | Plugins break after an update | GSAP plugins must match the core's minor; Motion ships minors weekly | pin exact versions (`npm i -E`) | reported (lane) |
| 25 | Variables collide with element ids in a test page | ids like `a`, `c`, `out` become window globals | unique ids, or `const` in a module scope | tested (lane) |
| 26 | The plugin's lint reports "no reduced-motion path" for GSAP when the gate lives in a helper file | `lint-web` reads one file and looks for `gsap.matchMedia` or a `prefers-reduced-motion` query in it | write `gsap.matchMedia()` in the page | found while testing this skill (reported to the hook owner) |
| 27 | The lint misses a WAAPI animation with no reduced-motion path | `lint-web` matches `.animate([` or `.animate({` only; keyframes from a variable or function are not seen | gate WAAPI yourself (`G.animate`); the gate's reduced-motion run still catches it | found while testing this skill (reported) |
| 28 | Content stays hidden when the script fails | CSS sets `opacity: 0` for a script-driven reveal | set the hidden start state from the same script | reported (lane) |

## 7. Licences

- **Ships in the plugin**: `spring-linear.js`, `motion-gate.js`, `vendor-inline.mjs`, the tests and the three examples
  (HTML-Sensei's own code). No library file ships.
- **In projects**: GSAP under the Standard "No Charge" licence (free commercially, all plugins included; never inside a
  competing no-code animation builder; headers kept; date checked 2026-10-17); Motion under MIT (add its notice: the UMD
  has none); animejs, Popmotion, canvas-confetti, animate.css under their permissive licences after reading the
  package's licence file. Each gets a ledger row (`vendor-inline.mjs --ledger`).
- **Never**: Motion+ source anywhere it would be redistributed; React Bits motion components in the plugin
  (`sensei-ui-components` has the fetch-and-port procedure).

## 8. Verification

Run here (Windows 10, Node 24, installed Chrome with user agent 156 through playwright-core 1.64, strict `file://`,
software GL; gsap 3.15.0 and motion 14.6.0 installed in a scratch folder):

- `test-motion-ui.mjs --libs <folder>`: 51 of 51 (spring numerics; micro.html press, spring overshoot 27.97 px over a
  24 px rest, hover lift and the transform trap, switch, toast, skeleton, form, pending with focus kept, check, reduced
  motion, forced colours; gate live change and WAAPI landing; the infinite-duration trap; heartbeat scheduling, tempo
  change, hidden stop, page-clock fallback, reduced pulse; vendor-inline headers, refusal; engines normal and reduced;
  the Motion reduced-motion trap and its gate; the GSAP gate branch). Without `--libs`: 39 of 39.
- `sensei-gate.mjs` on `micro.html`, `heartbeat.html` and the built `engines.html`: PASS each (20 pass, 0 warn, 0 fail);
  the heartbeat page first warned for a missing `<h1>`, small range and checkbox targets and a 320 px overflow, fixed.
  The micro contact sheet was looked at.

Not verified: Firefox, Safari and phones; haptics; the acoustic picture-to-sound offset (only the scheduling); feel and
frame timing on a target device; GSAP plugins other than the core in this skill (ScrollTrigger, SplitText and Flip
were run by the research lane); Motion's `animateLayout` and `animateView`; React APIs.

## 9. Carried by

- Agents: `sensei-interaction-engineer` (motion UI, with scroll, pointer and transitions), `sensei-art-director`
  (motion character within the direction), `sensei-course-builder` (answer feedback), `sensei-game-engineer` (HUD
  motion), `sensei-reviewer` (accessibility lens: the reduced-motion run, announcements, focus).
- Hooks: `lint-web.mjs` (PostToolUse: a reduced-motion path for each system it detects: CSS keyframes, movement
  transitions, scroll-driven, rAF, WAAPI, GSAP, Motion, autoplay video, View Transitions, Lottie; `transition: all`;
  smooth scroll on `html`; vendored code without a notice; network references when offline); `lint-determinism.mjs`
  (warns when GSAP or CSS animation runs free in a seek page); `guard-licence.mjs`; `gate-claim.mjs` (Stop: a fresh
  passing gate before a done claim).
