# Tools, Games & Kiosks: the interaction-first genres

Everything else a single HTML file can be: a converter, a generator, an editor, a playable game, a
museum kiosk. Shared law: **interaction is the product**: the design read still applies, but the
build order is input → state → output, and the state machine is designed before any screen.

---

## §1 · Tools (converters, generators, editors, calculators)

- **The tool loop:** input (form/canvas/file-drop) → transform (pure function) → output (result +
  copy button). Design the transform as a pure function *first*; the UI wraps it. This makes the
  tool testable via console (`transform(input)` in the browser): no harness needed.
- **Live results while typing** (debounced 120ms); a "copy" button on every output
  (`navigator.clipboard.writeText` + toast). Copy is the #1 button in tools.
- **State in the URL:** serialise inputs to `location.hash` (`#from=kg&to=lb&q=75`) so results are
  shareable and refresh-safe. Parse on boot.
- File input via drag-drop + `<input type=file>`; read with `FileReader`; for images, offer
  before/after with a range slider. Never upload anything: the point of a single file is *local*.
- Web-workers only if transforms exceed ~50ms; otherwise chunk with `requestIdleCallback`.

## §2 · Games (canvas/HTML)

- **Fixed timestep logic, RAF rendering:** accumulate `dt`, step logic at 1/60s, render every
  frame; tab-background can't explode physics.
- **State machine:** `boot → menu → playing → paused → gameover`; every input event maps through
  the current state. Most "game bugs" are inputs landing in the wrong state.
- Loop skeleton (drop-in):

```js
let last = 0, acc = 0; const STEP = 1000/60;
function frame(t){ requestAnimationFrame(frame);
  acc += Math.min(t - last, 250); last = t;
  while(acc >= STEP){ update(STEP/1000); acc -= STEP; }
  render(); }
```

- Input: `keydown/keyup` into a held-keys `Set` (with `e.repeat` ignored); touch via pointer events
  with a virtual joystick zone when `matchMedia('(pointer:coarse)')`.
- **Persistence:** high scores/settings to localStorage (versioned, try/catch: always). Games are
  where players *notice* lost progress.
- Audio: the synthesised SFX engine (`interaction.md` §4) plus one looping scene: mute toggle in
  the HUD is mandatory.
- Scope honesty: arcade/classic mechanics (snake, breakout, 2048, match-3, endless runner) ship
  beautifully in-file; anything needing netcode is not a single-file project. Deeper (loops, input,
  physics, sprites, save state, pause): `html-sensei:sensei-games`.
- Pause when hidden (`visibilitychange`) and on blur; keyboard, touch and pointer all reach every
  action; reduced motion turns off screen shake and flashes, not the game.

## §3 · Kiosks & exhibits (museum, trade show, lobby)

- **Idle attract loop:** after 60 to 90s without input, fade to an ambient attract screen (slow
  marquee/loop); any input returns to the start. `let idle; const resetIdle=()=>{clearTimeout(idle);
  idle=setTimeout(gotoAttract, 90000)}` on every pointer/key event.
- **Touch-first everything:** targets ≥ 64px, no hover-only affordances, no right-click, no text
  selection (`user-select:none`), `touch-action:manipulation` everywhere.
- **Full lockdown (kiosk hardware only):** `overflow:hidden`, hide the cursor after 3s idle
  (`.idle *{cursor:none}`), block context menu, block zoom (`user-scalable=no` + `touch-action`),
  and (when allowed) `document.documentElement.requestFullscreen()` on first touch. Never ship the
  zoom block on an ordinary page: it removes pinch zoom, which people with low vision rely on
  (WCAG 1.4.4).
- **Self-healing:** `window.onerror` → toast + auto-reload after 5s (kiosks must survive nights
  unattended); `visibilitychange` re-syncs clocks/animations.
- Content rotation: `SCENES`-style array of `{t, section}` if the exhibit cycles content on a timer.

## §4 · Cross-genre checklist (before calling any of these done)

- [ ] Input → transform → output verified with one real use (not just the happy path in your head)
- [ ] State survives refresh (hash or store) where it makes sense; deliberately not, where it doesn't
- [ ] Keyboard map documented in-UI (a `?` shortcut overlay earns trust)
- [ ] `prefers-reduced-motion` + mute toggle + focus-visible all present
- [ ] Idle/attract behaviour for kiosk genres; pause-on-blur for games
- [ ] The static gate + runtime gates all green (`verification.md`)

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| Physics explodes after tab switch | wall-clock dt unbounded | §2 clamp dt / fixed timestep |
| Game "randomly" breaks | inputs in wrong state | §2 state machine gates all input |
| Kiosk left on the settings screen all night | no idle timeout | §3 attract loop |
| Tool results lost on refresh | no URL state | §1 hash serialisation |
| Copy button does nothing on http | clipboard API needs secure ctx | fallback `execCommand('copy')` + toast |
| Typing lags in the converter | recompute per keystroke | debounce + chunked/idle transform |
