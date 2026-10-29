# Micro-interactions: the state-machine model and the recipes

A micro-interaction is a small state machine with feedback: idle, pending, success, error. Each state is visible, is
announced to assistive technology, and can be left. Working code: [../examples/micro.html](../examples/micro.html),
proved by [../scripts/test-motion-ui.mjs](../scripts/test-motion-ui.mjs).

## Recipes

| Interaction | How | Proven here |
|---|---|---|
| Press | `:active { scale: .96; transition-duration: 80ms }`, release on the spring (`linear()`); hover only under `(hover: hover) and (pointer: fine)` | scale 0.96 while held |
| Hover lift on an element that also animates in | `translate` for the lift (composes); never `transform` on `:hover` when an animation with fill `both` owns `transform` | lift 4 px; the transform version moved 0 px |
| Switch | a real `<input type="checkbox" role="switch">`, `appearance: none`, knob on `::after`, `:checked`; a real border; mirrored in RTL with `:dir(rtl)` | Space toggles; knob overshoots to 27.97 px and settles at 24 |
| Toast | a `role="status" aria-live="polite"` container present from load; toasts inserted into it; 4 s, paused on hover; exit on `animationend` with a backstop of about twice the exit; errors use `role="alert"` and never auto-dismiss | inserted, announced region, removed |
| Skeleton | one moving gradient, final dimensions reserved, `aria-busy="true"` until content lands; nothing under about 300 ms, a skeleton to about 1 s, then a labelled indicator | busy flipped to false; shimmer off under reduced motion |
| Form feedback | validate on blur, then live once touched; message in the element named by `aria-describedby`; `aria-invalid`; a one-off shake that reduced motion removes; submit with errors focuses the first invalid field | both states |
| Pending to success | lock the width, `aria-disabled="true"` plus a guard (not `disabled`, which drops focus), label "Saving...", then "Saved", announce through the toast | focus stayed on the button; a second press ignored |
| Success check | SVG with `pathLength="1"`, `stroke-dasharray: 1`, `stroke-dashoffset` 1 to 0; under reduced motion it is simply shown | drawn; shown at once under reduce |
| Haptics | `navigator.vibrate(ms)` inside `try`, skipped under reduced motion, always with a visual cue | **not verifiable**: Android Chromium only, iOS has no Vibration API |
| Celebration | canvas-confetti (ISC, `disableForReducedMotion: true`) or your own burst; decoration, not on every success | not run (lane reference) |

Libraries for reference (licences read from npm by the lane, 2026-10-19): Motion and framer-motion 14.3.0 MIT;
react-spring 10.1.2 MIT (React only); Popmotion 11.0.5 MIT; animejs 4.5.0 MIT; sonner 2.0.8 MIT (React only: use its
behaviour as the spec for a vanilla toast); canvas-confetti 1.9.4 ISC; animate.css 4.1.1 MIT per the registry (read the
package's licence file before redistributing); web-haptics 0.0.6 (unread, unverified).

## Bars

- Feedback starts within 100 ms of input; the press is instant, the spring is for the release.
- Every animated state has a non-motion equivalent (text, icon, colour plus shape) and is announced.
- Springs for UI: overshoot about 5 to 20 percent; press-like moves settle under about 600 ms, larger moves up to about
  900 ms; the transition duration equals the spring's settle time.
- Reduced motion: transitions near zero, shimmer off, shake off, end states shown.
- A visible focus ring of at least 3 px on every control; a real border on every control (forced colours).

## Traps

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | The spring easing does nothing in an older engine | an invalid `linear()` drops the whole declaration | a plain easing declaration first, then the `linear()` one | reported (lane) |
| 2 | A spring on opacity looks wrong | opacity clamps at 1 | springs on `scale`, `translate`, `rotate` | reported |
| 3 | The end of a spring snaps | duration shorter than the settle time | use the generator's `duration` | reported, generator returns it |
| 4 | Press feels laggy | the same duration on press and release | short on `:active`, spring on release | tested |
| 5 | A toast is not announced | the live region was created with its message | region in the DOM from load | tested (lane and here) |
| 6 | An error toast vanished before it was read | auto-dismiss on errors | errors stay until dismissed | reported |
| 7 | Vestibular discomfort from invalid-field shakes | motion carries the meaning | reduced motion removes the shake; the message carries the meaning | tested |
| 8 | A dismissed toast still takes space | `animation-fill-mode: forwards` keeps the element | remove it from the DOM | tested |
| 9 | Focus jumps to `<body>` during "Saving..." | `disabled` on the focused button | `aria-disabled` plus a guard | tested here (the lane had used `disabled` and not tested focus) |
| 10 | Hover lift never shows on a card that animated in | the animation owns `transform` | individual `translate` | tested |
| 11 | A cleanup never runs | gated on an event that may not fire | a timer backstop beside the event | tested (lane, field log) |
| 12 | Vibration silently does nothing | iOS has no Vibration API; it needs a gesture | never rely on it | reported |
| 13 | Confetti on every click | decoration as feedback | once, on the real success; off under reduced motion | reported |
| 14 | animate.css classes fight other transforms | class libraries animate `transform` | individual properties, or one owner of `transform` | reported |
| 15 | A skeleton causes a bigger shift than a spinner would | it does not match the final layout | reserve the final dimensions | reported |
