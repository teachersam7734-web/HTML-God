# Interaction: routers UX, modals, toasts, SFX, keyboard, access

The parts users touch. Small code, outsized feel.

---

## §1 · Router UX details

- Hash routing (`architecture.md` §4) plus: scroll reset per route (`behavior:'instant'`), route
  transition = one in/out keyframe pair (blur+translate), deep-linkable state via `?param=` when
  content is shareable (an `?idiom=` deep link was a skipped good idea: keep it on the menu).
- Landing→course hand-offs (Ultra Bookworm): `body.in-course` class flip; hide the landing top bar;
  the inner SPA owns the hash from then on. One owner of the hash, always.

## §2 · Modals & toasts

```js
function toast(msg, kind='info'){                    // one element, reused, class-flipped
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toast._t); toast._t = setTimeout(()=> t.className = '', 2200);
}
```

- Modal: backdrop click + Esc close; focus moves in on open, returns on close; `aria-modal="true"`.
- Toast copy: what happened, in plain words. Errors never apologise, never vagueness ("Couldn't save: your
  browser blocks local storage" beats "Error").

## §3 · Keyboard map (cheap, huge feel)

| Key | Action |
|---|---|
| 1 to 4 | quiz answers |
| ←/→ | flashcard prev/next · carousel rotate |
| Space/Enter | flip card · play/pause |
| S | sound toggle |
| [ / ] | nudge active lyric ±0.2s (dev tooling) |
| Esc | close modal |

Bind on `keydown`, guard by route (`render()` knows where you are), ignore when typing in inputs.

## §4 · Synthesised SFX (zero assets, the GOAT-HTML way)

```js
const SFX = (() => {
  let ctx;
  const ensure = () => { if(!ctx) try{ ctx = new (window.AudioContext||window.webkitAudioContext)() }catch(e){}
                         if(ctx && ctx.state==='suspended') ctx.resume(); return ctx };
  const tone = (f, t=0, dur=.12, type='sine', vol=.06, slide=0) => { const c = ensure(); if(!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, c.currentTime + t);
    if(slide) o.frequency.exponentialRampToValueAtTime(f*slide, c.currentTime + t + dur);
    g.gain.setValueAtTime(vol, c.currentTime + t);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t + dur);
    o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + dur + .02); };
  return { click:()=>tone(520,0,.06,'triangle',.05), whoosh:()=>tone(220,0,.25,'sawtooth',.04,.4),
           chime:()=>{tone(660,0,.18);tone(880,.09,.22)}, error:()=>tone(180,0,.2,'square',.05) };
})();
```

- Created lazily, resumed on gesture (autoplay policy). One toggle in the HUD; persisted in the store.
- Keep volumes ≤ .07: UI sound is texture, not soundtrack.
- Never SFX on every hover; on click/select/success/error only.

## §5 · Accessibility floor (from web-design-guidelines + Vercel UI rules)

- Real `<button>`s for everything clickable; `aria-label` on icon-only buttons; `<nav aria-label>` for docks.
- Visible `:focus-visible` styles (glow ring, not outline:none).
- Forced colours (Windows contrast themes): give buttons a `1px solid transparent` border so they
  keep their shape when backgrounds and shadows are removed.
- Hidden panels, off-screen slides and closed drawers are `inert`; a dialog uses `<dialog>` or
  traps focus and returns it on close.
- A keyboard route for every pointer feature (drag, hover reveal, swipe).
- Canvas scenes: `aria-hidden="true"` (decorative), or a text alternative when informational.
- Contrast ≥ 4.5:1 for body text; verify `--dim` on `--bg`: dim greys fail most often.
- Touch targets ≥ 44px; `viewport-fit=cover` + safe-area padding for notches.
- `prefers-reduced-motion`: kill loops, static frames, keep functionality identical.
- Verify all of the above with a gate, not by eye: `verification.md` §2 (HTML-Sensei's gate runs
  axe, keyboard, forced colours, reduced motion and reflow in one command).

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| Dock button "sticks" active | render not called on hashchange | §1 + `hashchange` listener |
| Audio settings lost on reload | sound flag not in store | §4 persist via store |
| Modal traps keyboard forever | no Esc/focus-return | §2 |
| iOS double-tap zoom on buttons | missing touch handling | `touch-action:manipulation` |
| Screen reader hears the canvas noise | canvas unlabeled | §5 aria-hidden |
