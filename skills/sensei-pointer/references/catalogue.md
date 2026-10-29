# Pointer effects: catalogue, equivalents and libraries

Sources: `domain-pointer-cursor.md` in the HTML-Sensei build project's research notes (not shipped) (lane D2, 2026-10-19, npm licences read that day),
`repo-gsap.md`, `repo-react-bits.md`, the build project's field log (SENSEI-LOG, not shipped). Numbers marked "measured" come from
`scripts/test-pointer.mjs` on `examples/pointer.html`.

## 1. Each effect, its numbers and its equivalents

| Effect | Method | Numbers | Touch equivalent | Keyboard equivalent | Reduced motion |
|---|---|---|---|---|---|
| Custom cursor ring | fixed 28 px ring moved by `translate3d` in the loop, `damp` lambda 22 (about 100 ms lag, feels attached; under 12 feels laggy); grows over `a, button, [role=button]` via a delegated `pointerover` | measured: on the pointer within 1 px by 500 ms after a 500 px jump; placed directly on first sight | none: native touch feedback (an optional ripple at the tap point) | the focus ring is the cursor; never hide it | ring snaps to the pointer (measured: exactly 700, 300) |
| Magnetic button | target = 35 percent of the offset from the button's un-offset centre inside a 110 px radius, else 0; `damp` lambda 14 | measured: (+90, +10) gave (31.5, 3.5); 0 again outside the radius | `:active` press scale (`sensei-motion-ui`) | none needed: it is still a button | off (offset stays 0) |
| Spotlight reveal | `mask: radial-gradient(circle 110px at var(--mx) var(--my), ...)`; variables on the box, only when the rounded value changes | measured: 100px and 120px on the box, nothing on `<html>` | follows `pointermove` while a finger is down | `:focus-visible` on the box removes the mask (measured) | stays on: it is one-to-one with the user's own movement |
| Tilt card | `perspective` on the wrapper, `preserve-3d` on the card, max 9 degrees each way, lambda 12, transition only for the return | measured: 8.36 and 8.18 degrees at the top-right corner; 0 after leaving | gyroscope tilt with permission, or none | none (decorative) | off |
| Drag with inertia | `pointerdown` plus `setPointerCapture`, `touch-action: none` on the handle, release velocity from the first and last of six samples, ignored after an 80 ms pause, friction `v *= exp(-4 dt)`, bounce `v = -0.5 v` | measured: a six-step flick released at (170, 68) coasted to about (305 to 357, 111 to 128), depending on frame timing | the same code (Pointer Events unify input) | arrows 20 px, Shift 60 px, Home resets, instructions linked by `aria-describedby` (measured) | no coast |
| Trail | points pushed per pointer change, alpha falls 2.2 per second, circles on a full-viewport canvas with `pointer-events: none`, cap 80 points, DPR capped at 2; canvas made on first use | measured: 10 live points after a ten-step move | none | none | none, and no canvas |

Hybrid laptops report `(hover: hover) and (pointer: fine)` and also have a touch screen: the example reads
`e.pointerType` on every `pointermove` and `pointerdown`, hides the ring and gives the system cursor back while a touch
or pen is in use, and brings the ring back on the next mouse movement (measured with a synthetic touch
`PointerEvent`; real hybrid hardware not tested).

## 2. Swipe to grade (field-tested in Ultra Bookworm)

From the SENSEI-LOG entry: pointer events with capture after the axis is decided (6 px); velocity smoothed (0.4 old
plus 0.6 new, px per ms); commit at a third of the width or 0.5 px per ms; `touch-action: pan-y` on the card so
vertical scrolling still works; a rubber band before the card turns; a click swallowed after any drag; WAAPI for the
fling and the spring home; `navigator.vibrate(8)` guarded and never the only signal. Tested there with Playwright's
`page.mouse` drags, which go down the same pointer path. Buttons do the same grading for keyboard users.

## 3. Libraries

| Item | For | Licence | Status |
|---|---|---|---|
| Vanilla Pointer Events plus `damp` (this skill) | every effect above | HTML-Sensei's own | verified |
| GSAP `quickTo`, Draggable (35.8 KB), InertiaPlugin (7.3 KB), Observer (10.0 KB) | follower without allocating tweens; drag with bounds, snap and throw; unified wheel, touch and pointer input | Standard no-charge licence (keep headers; see `sensei-scroll`'s `references/libraries.md`) | documented, not run |
| Motion `hover()`, `press()`, drag, springs | gesture-aware hover and press that already ignore touch hover; drag constraints | MIT | not run |
| vanilla-tilt 1.8.1 | tilt with glare in one call | MIT | reference: the example's tilt is enough and easier to make reduced-motion safe |
| Atropos 2.0.2 | layered depth tilt (`data-atropos-offset`) | MIT | not run |
| canvas-confetti 1.9.4 | pointer-origin bursts for success | ISC | honours `disableForReducedMotion: true` per its docs; not run |
| three.js raycasting | pointer effects in 3D | MIT | `sensei-3d` |
| react-bits cursor and hover components (SplashCursor, Magnet, TiltedCard, GlareHover and others) | ready-made React effects, many WebGL | MIT plus Commons Clause | ideas here; real use only through `sensei-ui-components`' fetch-and-port procedure into a project, never in the plugin |

GSAP idioms from `repo-gsap.md` (not run here):

```js
const xTo = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3' }), yTo = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3' });
addEventListener('pointermove', e => { xTo(e.clientX); yTo(e.clientY); });
Draggable.create('.puck', { bounds: '.dragarea', inertia: true });   // needs InertiaPlugin; add arrow keys yourself
```

Draggable gives no keyboard path by itself; `lint-web` warns on `Draggable.create` in a file with no key handler.

## 4. By use case

| Use case | Do |
|---|---|
| Landing page, brand page | a ring or a spotlight on brand pages only; a magnetic primary action; tilt on feature cards; never on a conversion form |
| Presentation | a laser-pointer spotlight is legitimate |
| Course | almost none; drag-to-order exercises (drag plus keys, or buttons) are the real use |
| Game | its own input loop; reuse `damp` and the drag code (`sensei-games`) |
| Dashboard | cursors and tilt off; drag and resize handles on, each with keys |
| Film | cursor choreography is scripted keyframes, not live input (`sensei-video-pipeline`) |

## 5. Device tilt

iOS needs `DeviceOrientationEvent.requestPermission()` from a user gesture: ride the first tap (SENSEI-LOG, from the
Save The Damsel landing shader). Treat it as an enhancement with a still default. Not tested on a device.
