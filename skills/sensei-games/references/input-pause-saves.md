# Input, pause, saves, screen and options

Depth for `sensei-games` section 3. Every behaviour marked "tested" is an assertion in `scripts/test-game.mjs` run on
`examples/coin-run.html`.

## 1. Input (`GameCore.Input`)

| Behaviour | How | Status |
|---|---|---|
| Keys by `event.code`, not `event.key` | physical position: WASD stays WASD on AZERTY. Use `key` only for text | tested (rebinding by code) |
| Edges | `sample()` once at the start of each fixed update: `pressed` and `released` are true for exactly one step | tested |
| A tap shorter than one step | keydown latches the press until the next sample, so it is seen once even if keyup came first | tested; the lane code lost it (found here) |
| `preventDefault` | only for bound keys, never with Ctrl, Meta or Alt (Space yes; Ctrl+Left and an unbound Z no) | tested |
| Stuck keys | window `blur` and `visibilitychange` to hidden clear every held key (a key held through Alt-Tab never sends keyup) | tested |
| Diagonals | the move vector is normalised to length 1 | tested |
| Remapping | `input.rebind('jump', ['KeyJ'])` | tested |
| Toggle instead of hold | `input.toggleMode.jump = true`; edges are computed from the physical state, never the toggled state | tested; the lane's first draft corrupted edges this way |
| Gamepad | polled in `sample()`; radial deadzone 0.2 with rescale (0.6 becomes 0.5, inside 0.2 is exactly 0); full diagonal clamped to 1; button edges; d-pad | tested with a mocked `navigator.getGamepads` only |
| Pointer stick | pointer capture on `pointerdown`, so a drag that leaves the element keeps tracking; release gives 0; `pointercancel` handled | tested |
| Touch surface | `touch-action: none` on the game surface only; the rest of the page keeps pinch zoom | reported (lane) |

Gamepad quirks (reported, not tested on hardware): a browser lists pads only after the first button press; check
`gamepad.mapping === 'standard'` before trusting button numbers; axes drift, hence the deadzone.

## 2. Pause

Three causes, kept apart: the user (button, Escape or P), the tab hidden (`visibilitychange`), and window blur (an
option, `loop.setPauseOnBlur(bool)`).

- Read the pause key **outside** `update()`: a paused loop does not run `update`, so a pause key read there can never
  resume (found by the lane's test; `coin-run.html` handles it in its own `keydown` listener).
- On resume, drop the paused time: `last = null; acc = 0`. Tested: 0 steps in 700 ms hidden, then about 12 steps in the
  200 ms after, no catch-up burst.
- `pauseOnHidden: false` (for a game that must keep simulating, such as a timer the player knows about) keeps running
  but still drops the hidden gap on return; the lane's code paused on hidden and never resumed in this mode (found
  and fixed here, tested).
- Pause sound too: `AudioContext.suspend()` on pause and hidden, `resume()` on return (see `sensei-audio`).
- The browser stops rAF in a truly hidden tab anyway; the visible symptom of not pausing is a large delta on return,
  which `maxFrame` clamps.

## 3. Saves (`GameCore.Save`)

```js
var save = new GameCore.Save('coinrun', 2, { 1: function (d) { return { best: d.hi || 0, opts: {} }; } },
                             { best: 0, opts: { shake: true } });
var data = save.load();                 // defaults merged in; never throws
save.save(data);                        // false when storage is blocked (kept in memory)
GameCore.Save.autosave(function () { save.save(data); });   // visibilitychange to hidden, and pagehide
```

Tested: reload reads back; a version 1 save migrates to version 2; corrupt JSON falls back to defaults and records
`lastError`; a save from a newer build is refused, not misread; blocked `localStorage` (a getter that throws) starts
the game and `save()` returns false; autosave fires on hidden. Offer `exportCode()` as a copyable code when storage is
blocked. Never save on `unload` alone: it does not fire reliably on mobile (research lane).

## 4. Fullscreen, orientation and scaling

- `element.requestFullscreen()` only from a user gesture, always with `.catch`; then `screen.orientation.lock
  ('landscape')` and swallow its rejection (it rejects on desktop and in frames). Tested: no exception either way.
  iPhone Safari does not fullscreen arbitrary elements (reported).
- Size the canvas from `clientWidth * devicePixelRatio`, ratio capped at 3 for memory, not for speed; draw in a logical
  resolution with `ctx.setTransform(scale, 0, 0, scale, 0, 0)` and `imageSmoothingEnabled = false` for pixel art.
- Render with interpolation: `prev + (cur - prev) * alpha`, so motion is smooth at any refresh rate while the
  simulation stays at its fixed step.

## 5. Accessibility options (all in `coin-run.html`, axe-clean in the gate)

- Canvas `role="img"` with a label, plus the score as text; a polite live region for events ("Coin collected. Score 3").
- Every option a native, labelled control: screen shake (off by default under `prefers-reduced-motion`, tested), pause
  when the tab loses focus, toggle instead of hold, high contrast, game speed 0.5, 0.75, 1 through `loop.timeScale`
  (the fixed step itself never changes).
- On-screen Jump button for touch and switch users; 44 px targets (checkboxes at least 24 px: the gate warned at 21 px
  and they were enlarged); visible focus rings.
- Not verified: screen-reader play-through; colour-blind-safe sprites (check palettes with `sensei-dataviz`); captions
  for sound cues (`sensei-audio`).

## 6. Audio meets the loop

Create or `resume()` the one `AudioContext` inside the first gesture; route everything through a master gain and
compressor; persist mute; suspend on pause and hidden; schedule from `ctx.currentTime` with a look-ahead, never from
timers or from `update()`. The engine, the unlock and the look-ahead scheduler are `sensei-audio`'s
(`examples/heartbeat.html`). Not re-tested here: the test browsers allow autoplay, which would hide the unlock trap.
