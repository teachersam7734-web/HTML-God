# Springs, clocks and composition

## 1. Springs as CSS `linear()`

`scripts/spring-linear.js` samples the exact step response of a damped spring at 240 Hz until it stays within 0.002 of
rest for 50 ms, keeps only the points needed to stay within 0.002 of the curve (Ramer-Douglas-Peucker), and writes
`linear(0, v1 p1%, ..., 1)` with the settle time as `duration`:

| Stiffness, damping (mass 1) | Damping ratio | Peak | Settle | Stops |
|---|---|---|---|---|
| 260, 16 | 0.50 | 1.166 | 812 ms | 36 |
| 170, 14 (defaults) | 0.54 | 1.135 | 792 ms | 32 |
| 170, 26 | 1.00 | 0.999 | 696 ms | 21 |
| 170, 40 | 1.53 | 0.998 | 1,367 ms | 25 |

(Node 24, 2026-10-24.) The research lane's first generator (1/60 s samples, a fixed stride) gave 917 ms and 1.165 for
260, 16: the same spring, measured more coarsely. Over-damped springs are slower than critical damping: more damping is
not "snappier".

```css
.knob { transition: translate .4s ease;                                  /* fallback first */
        transition: translate var(--spring-ms) var(--spring); }          /* set by springLinear.apply() */
```

For a value that retargets many times as a pure function of t (films, seek pages), use the closed-form sum of springs
in `sensei-video-pipeline/scripts/spring.js`, not a live engine.

## 2. Individual transform properties

`translate`, `scale` and `rotate` are separate properties that compose with `transform` (applied in the order
translate, rotate, scale, then `transform`, per CSS Transforms Level 2; the order itself was not tested here). Use them to layer states:

- An entrance or scroll-driven animation with fill `both` owns `transform` for as long as it is in effect, and an
  animation's value outranks every normal declaration: `:hover { transform: ... }` never applies (tested here: 0 px).
  Lift with `translate` (tested: 4 px). From the field log: the shadow grew for a lift that never happened.
- `:active { transform: scale(.96) }` replaces a hover `transform`, so the element snaps level before shrinking: lift
  with `translate`, press with `scale`.
- A more specific state rule with its own `transition` list silently replaces the press transition: list every
  individual property in each transition list that can win.
- The individual `rotate` composes with a running `transform` animation with fill `both` instead of being overridden
  (field log, Save The Damsel).

## 3. Clocks

- **Land on the animation's own clock**: split one keyframe list at the impact offset into two WAAPI animations and
  start the second from the first's `finished` promise (field log: a thrown weapon breaking a tile). Test by slowing
  every animation (`playbackRate` on all, re-applied by a MutationObserver as new ones start) and asserting the first is
  finished when the second begins; keep the rate where backstop timers still exceed the slowed durations.
- **Exit on `transitionend`, with a backstop of about twice the duration**: on a slow renderer (6 fps under a
  hologram) a 420 ms fade's `transitionend` came at 971 ms; a 700 ms backstop cut it short. Setting `hidden` in the same
  tick as removing the visible class kills the fade. Exit faster than entry, on an ease-in.
- **Audio clock as master** (`examples/heartbeat.html`): a 25 ms look-ahead scheduler books each beat about 100 ms ahead
  on `AudioContext.currentTime` and starts that beat's WAAPI pulse at the same moment, mapped to the document timeline
  through `getOutputTimestamp()` and set as `animation.startTime`; `performance.now()` drives it when the context is
  missing or suspended; it stops on `visibilitychange`. Field log: picture to sound measured 1 to 18 ms by pairing
  scheduled oscillator starts with animation starts (note: `OscillatorNode.frequency.value` reads the default until
  automation runs, so pair by order, not frequency). This skill verified the scheduling (exact 60/bpm spacing, every
  beat booked ahead, each pulse's start equal to its mapped beat, tempo change from the next beat) but not the acoustic
  offset.
- **Never rescale a running infinite animation for tempo**: changing the duration (directly or through a custom
  property) keeps `currentTime` and so jumps the phase (tested: progress 0.24 to 0.62 when 1 s became 2 s). Restart per
  beat, or adjust `playbackRate` at a beat boundary.
- **A custom property written every frame on `:root` restyles the whole document**: write it on the element that uses
  it, and only when the rounded value changes (field log).
- **Frame-rate-independent smoothing**: `value += (target - value) * (1 - Math.pow(k, dt))`, never a fixed fraction per
  frame (field log, live landing background).
- **A paused CSS shorthand**: `animation: a ..., b ...` under a more specific selector resets a separate
  `animation-play-state: paused` (field log: an entrance ran under an opening film). The pause rule must outrank every
  shorthand it holds.
- **Entrances gated on an observer**: `animation-play-state: paused` until a class is added by an
  IntersectionObserver at a third of the box or a third of the viewport (a tall box never reaches a 35 percent ratio on
  a short screen); no observer means play at once; reduced motion removes the animations (a paused first frame is
  usually opacity 0); `@media print` runs them (field log).
