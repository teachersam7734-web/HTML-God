---
name: sensei-pointer
description: Pointer and cursor effects for HTML on one input model (Pointer Events) and one sleeping rAF loop with frame-rate independent smoothing. Custom cursor ring, magnetic buttons, spotlight and reveal masks, 3D tilt cards, drag with inertia and throw, cursor trails, swipe gestures, with the touch, pen, hybrid-laptop, keyboard, forced-colours and reduced-motion equivalent of each, and a self-test that moves the mouse, flicks, presses keys and repeats as a phone. Use when someone says custom cursor, cursor effect, cursor follower, cursor trail, magnetic button, magnet effect, spotlight, flashlight, reveal on hover, mouse follow, tilt card, 3D hover, parallax on mouse, drag, draggable, flick, throw, inertia, swipe, hover effects, pointer effects, or "make it react to the mouse".
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-pointer

Pointer effects answer the user's hand; they never take away the hand's own tools. Doctrine first (`html-sensei`):
the richest effect the brand earns, nothing cut for this machine, and every effect has its touch, keyboard and
reduced-motion equivalent built in, not added.

## 1. When to use

Custom cursors, magnetic and spotlight effects, tilt, drag and throw, trails, swipes: anything that follows the
pointer. The organising rules: **Pointer Events are the single input model** (mouse, pen and touch share
`pointerdown`, `pointermove`, `pointerup`), and **hover effects belong to `(hover: hover) and (pointer: fine)`**.

| The job is | Skill |
|---|---|
| A hero's spotlight ground (the radial-gradient background, not a mask) | `sensei-landing-hero` |
| Hover lift, press scale, focus styles, springs, toasts, `linear()` easing | `sensei-motion-ui` |
| Buttons, menus, sliders and their native semantics | `sensei-ui-components` |
| A shader that reacts to the pointer | `sensei-shaders-vfx` |
| Raycasting and pointer effects in 3D | `sensei-3d` |
| Drag that reorders a layout and animates the change | this skill for the drag, `sensei-transitions` for the FLIP |
| Game input loops | `sensei-games` |
| Scripted cursor choreography in a film | `sensei-video-pipeline` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Use an effect at all | brand or landing page; presentation spotlight; course or form (almost never); dashboard (handles only) | attention: a learner's or buyer's attention belongs to the content and the action |
| Engine | vanilla Pointer Events plus `damp` (this skill); GSAP `quickTo` and Draggable with Inertia; Motion `hover()`, `press()`, drag | vanilla by default (about 200 lines covers all six effects); GSAP when the page already has it or needs snap-to-grid throws; Motion in a React project already using it |
| Smoothing | `damp(cur, target, lambda, dt)`; a spring | `damp` for followers (lambda 22 attached, 14 magnet, 12 tilt); a spring only where overshoot means something |
| Cursor | none; ring; ring with blend | none unless the brand asks; a ring hides the system cursor only on fine pointers, only after the ring exists, never in text fields, never under forced colours |
| Touch | native feedback; press state; gesture | hover effects become `:active` presses; drag stays the same code; tilt becomes nothing (or permission-gated gyroscope) |
| Keyboard | built-in (buttons); focus reveal; arrow keys | every hover reveal has a `:focus-visible` twin; every drag has keys (or buttons doing the same move) |
| Reduced motion | snap; off; keep | followers snap; magnet, tilt, trail and inertia off; one-to-one effects such as the spotlight stay |

## 3. Core technique

Start from [examples/pointer.html](examples/pointer.html). Five rules make every effect in it correct.

### 3.1 One loop, frame-rate independent, clamped both ways, asleep when idle

```js
function damp(cur, target, lambda, dt){ return cur + (target - cur) * (1 - Math.exp(-lambda * dt)); }
var last = 0, raf = 0;
function wake(){ if (!raf) { last = performance.now() - 16.7; raf = requestAnimationFrame(frame); } }
function frame(now){
  raf = 0;
  var dt = Math.max(0, Math.min((now - last) / 1000, 0.05)); last = now;   // a rAF time can be earlier than wake()'s
  var moving = false;
  /* ...each effect: value = damp(value, target, lambda, dt); moving = moving || not settled... */
  if (moving) raf = requestAnimationFrame(frame);                          // otherwise sleep until the next input
}
addEventListener('pointermove', function(e){ /* record */ wake(); }, { passive: true });
```

`cur += (target - cur) * 0.1` feels different at 30, 60 and 144 Hz; `damp` does not. The upper clamp stops a resumed
tab teleporting things; the lower clamp matters because the frame's timestamp can precede the `performance.now()` read
in the input event that woke the loop, and a negative `dt` pushed the ring away from the pointer (TRAPS 15). Settled
values snap to their targets so the loop can stop.

### 3.2 Gate hover effects, keep the system's tools

```css
.cursor{display:none}
@media (hover:hover) and (pointer:fine){
  html.has-cursor:not(.touching), html.has-cursor:not(.touching) a, html.has-cursor:not(.touching) button{cursor:none}
  html.has-cursor input, html.has-cursor textarea, html.has-cursor select, html.has-cursor [contenteditable]{cursor:text}
  html.has-cursor:not(.touching) .cursor{display:block; /* fixed ring */}
}
```

```js
var fine = matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(forced-colors: active)').matches;
if (fine) document.documentElement.classList.add('has-cursor');            // only after the ring element exists
function track(e){ var touchy = e.pointerType === 'touch' || e.pointerType === 'pen';
  document.documentElement.classList.toggle('touching', touchy); /* ... */ }  // hybrid laptops: touch hides the ring
```

### 3.3 Measure from where the thing would be

A magnet that measures from its own translated rectangle chases itself: subtract the current offset to get the
un-offset centre. Tilt reads the pointer's position inside the card from `getBoundingClientRect` on `pointermove`, not
in the loop.

### 3.4 Write variables where they are used

The spotlight writes `--mx` and `--my` on its own box, only when the rounded value changes. A per-frame custom property
on `:root` restyles the whole document.

### 3.5 Drag: capture, sample, coast, and keys

```js
puck.addEventListener('pointerdown', e => { puck.setPointerCapture(e.pointerId); /* offset, samples = [] */ });
// on move: clamp to bounds, push {t, x, y}, keep the last six
// on up or cancel: velocity from first and last sample, ignored if the last is older than 80 ms; zero under reduce
// in the loop: x += vx * dt; bounce v = -0.5 v at the edges; v *= Math.exp(-4 * dt)
puck.addEventListener('keydown', e => { /* arrows 20 px, Shift 60 px, Home resets, preventDefault */ });
```

`touch-action: none` on the handle only, never on the page; `pointercancel` handled like `pointerup`; instructions
tied to the handle with `aria-describedby`. Every number, equivalent and library: [references/catalogue.md](references/catalogue.md).

### 3.6 Prove it

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-pointer/scripts/test-pointer.mjs [page.html]
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/sensei-gate.mjs page.html
```

The self-test reads the page's `window.__state`; expose the
same numbers from a project's effects and adapt the selectors. The gate adds forced colours, axe, the keyboard walk
and the contact sheet; it does not move the pointer, so the self-test is what proves the effects.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Ring cursor, magnet, spotlight with focus reveal, tilt, drag with inertia and keys, trail on a lazy canvas, hybrid switch, forced colours, sleeping loop | [examples/pointer.html](examples/pointer.html) | verified |
| Self-test in mouse, keyboard, reduced-motion, forced-colours, hybrid and phone contexts (19 assertions) | [scripts/test-pointer.mjs](scripts/test-pointer.mjs) | verified |
| Numbers and equivalents per effect, swipe to grade, libraries, GSAP idioms, use cases, device tilt | [references/catalogue.md](references/catalogue.md) | reference (GSAP, Motion, Atropos, confetti not run) |

## 5. Quality bars

- The ring sits on the pointer within 1 px by 500 ms after a jump, is placed directly on first sight, and never
  replaces the I-beam in text fields; no ring on coarse pointers, under forced colours, or while a touch or pen is in
  use.
- Reduced motion: the ring snaps; magnet, tilt, trail and inertia are off; no trail canvas exists.
- Every drag moves by keys too (arrows, a bigger step with Shift, a reset); every hover reveal has a focus
  equivalent; controls keep their edge in forced colours (transparent borders).
- One rAF loop that sleeps when idle (the self-test asserts no frames for 500 ms after settling); DPR capped at 2;
  canvas cleared each frame; no `getBoundingClientRect` in the loop for static elements (one magnet reading its
  rectangle per frame is acceptable; cache it for many).
- No custom property written on `:root` per frame; `touch-action: none` only on drag handles.
- The gate passes in strict `file://` with zero warnings; 60 fps on the target device is unverified here and said so.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | No I-beam in text fields | `cursor: none` on `html` reaches inputs | `cursor: text` on inputs, textareas, selects and `[contenteditable]` | tested (lane D2) |
| 2 | The ring sits at the corner, or flies in from off-screen, before the first move | it has no position until a `pointermove` | start it off-screen; on first sight set it to the pointer directly | lane D2 (start off-screen); first-sight placement found and fixed here |
| 3 | The magnet jitters | measuring from its own translated rectangle | subtract the current offset (un-offset centre) | tested (lane D2) |
| 4 | Cards stay lifted after a tap | `:hover` sticks on touch | hover motion only under `(hover: hover) and (pointer: fine)`; `:active` for everyone | tested (SENSEI-LOG) |
| 5 | Dragging scrolls the page instead | no `touch-action: none` on the handle | set it on the handle only, never the page | reported (lane D2) |
| 6 | A fast drag drops the element | events stop when the pointer leaves it | `setPointerCapture` on `pointerdown` | reported (lane D2) |
| 7 | Cleanup never runs on touch | `pointerleave` and `pointerenter` are unreliable for touch | handle `pointercancel` and `pointerup` | reported (lane D2) |
| 8 | A heavy WebGL page drops frames with a blended ring | `mix-blend-mode: difference` on a fixed element composites over the whole page | fine on a landing page; measure on a heavy page before using | reported, not measured |
| 9 | Releasing after a pause flings the puck | stale velocity samples | ignore samples older than 80 ms | tested (lane D2, and here) |
| 10 | Every pointer move restyles the document | custom properties written on `:root` | write on the element, only when the rounded value changes | tested (SENSEI-LOG; asserted here: `<html>` style empty) |
| 11 | The ring freezes at the edge of a video or iframe | they swallow pointer events | accept, or put `pointer-events: none` on decorative media | reported (lane D2) |
| 12 | On a touch-screen laptop the ring appears at the finger, or the cursor vanishes for touch | `(hover: hover)` is true on hybrid devices | read `e.pointerType`: touch or pen hides the ring and restores the cursor; mouse brings it back | lane D2 left it open; fixed here, tested with a synthetic touch event |
| 13 | The page has no cursor at all when the script fails | `cursor: none` applied by CSS before the ring exists | add the class from script after the ring is made | tested (lane D2) |
| 14 | Device tilt does nothing on iOS | permission needed from a gesture | `DeviceOrientationEvent.requestPermission()` on the first tap | reported (SENSEI-LOG), not tested |
| 15 | The ring moved away from the pointer (to minus 236 px) right after waking | the rAF timestamp is the frame's start and was earlier than the `performance.now()` read in `wake()`, so `dt` was negative and `damp` pushed backwards | clamp `dt` to at least 0, and start `last` one frame back | found and fixed here |
| 16 | The gate fails a page with "1 canvas blank" | a full-viewport trail canvas is empty until someone moves | create the canvas on first use; phones and reduced motion never get one | found and fixed here |
| 17 | The button and the puck lose their shape in forced colours | `border: 0` with only a background | `border: 2px solid transparent` (forced colours paints it) | found by the gate here |
| 18 | Keyboard users never see the spotlight's hidden content | a reveal driven only by the pointer | `:focus-visible` on a focusable box removes the mask | found here |
| 19 | An idle page runs a frame loop forever | a loop that never stops | stop when every value has settled; wake on input | found here (asserted: no frames for 500 ms when idle) |
| 20 | GSAP Draggable control unusable by keyboard | Draggable adds no key handling | add arrows yourself or give buttons | reported (repo-gsap; `lint-web` warns) |
| 21 | The follower feels different on a 144 Hz screen | per-frame `cur += (t - cur) * k` | `damp` with real `dt` | reported (lane D2, Lenis maths) |

## 7. Licences

- **This skill's code** (`pointer.html`, `test-pointer.mjs`) is HTML-Sensei's own, from lane D2's `code-interaction`
  lab.
- **GSAP** (quickTo, Draggable, InertiaPlugin, Observer): standard no-charge licence; inline into projects with headers
  kept, pinned, a ledger row; not in the plugin. **Motion** (MIT), **vanilla-tilt** and **Atropos** (MIT),
  **canvas-confetti** (ISC): usable with notices; none is in this skill.
- **react-bits** cursor components (SplashCursor, Magnet, TiltedCard, GlareHover and the rest): ideas only here; use
  the real component only through `sensei-ui-components`' fetch-and-port procedure, into a project, with its notice,
  never into the plugin.

## 8. Verification

Run here (Windows 10, Node 24, Chrome through playwright-core 1.62, axe-core 4.14, swiftshader, strict `file://`):

- `scripts/test-pointer.mjs`: 19 of 19 pass in mouse, keyboard, reduced-motion, forced-colours, hybrid (synthetic
  touch `PointerEvent`) and phone (`hasTouch`, `isMobile`, 400 px) contexts.
- `sensei-verify`'s gate on `examples/pointer.html`: pass, 20 checks, no warnings, after fixing what it found (the
  blank canvas, forced-colours edges, content outside a landmark). The contact sheet was looked at.
- `lint-web` (`plugin/lib/lint/web.mjs`): clean.

Not verified: real touch screens, pens and hybrid laptops; frame rate on a target device; Firefox and Safari; screen
reader speech of the puck and its instructions; device tilt; GSAP `quickTo`, Draggable and Inertia, Motion gestures,
Atropos and confetti; the swipe-to-grade pattern inside this skill (it was tested in Ultra Bookworm).

## 9. Carried by

- Agent `sensei-interaction-engineer` builds the effects from the example with their equivalents and runs the
  self-test and the gate; `sensei-reviewer` checks the quality bars under its accessibility lens.
- Hook `lint-web.mjs` (PostToolUse on web files; warns, never blocks; rules in `plugin/lib/lint/web.mjs`):
  `cursor-none-without-hover-query` (`cursor: none` outside a `hover: hover`, `pointer: fine` or `any-pointer: fine`
  media block); `drag-without-keys` (a press event, `draggable="true"` or `Draggable.create` together with a move or
  drag event, and no key handler anywhere in the file: one `keydown` anywhere satisfies it, so it cannot tell which
  control has keys); `reduced-motion:requestAnimationFrame` (a loop with no reduced-motion check in script);
  `reduced-motion:css-motion-transitions` and `transition-all`. `gate-claim.mjs` needs a fresh passing gate before
  "done".
- Not enforced by any hook (covered by the self-test and the reviewer): hover motion outside the hover query,
  `touch-action: none` on the page, per-frame writes to `:root`, a hover reveal with no focus equivalent, the hybrid
  switch, a loop that never sleeps, a negative `dt`.
