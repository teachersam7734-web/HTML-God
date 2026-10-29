# Worked example: Ultra Bookworm's Ink and Pulse looks, and Calm

Ultra Bookworm (the owner's offline reading course, `build/app/` in the project that built this plugin) carries two
complete looks over one markup and one set of lesson data, a designed switch between them, and a learner-chosen still
mode. Read from `app/styles.css` in the owner's Ultra Bookworm project (not shipped) and `app/app.js` in the owner's Ultra Bookworm project (not shipped); the switch was reproduced and tested in
[../examples/tokens.html](../examples/tokens.html).

## 1. What it does well

- **Two skins, one content.** `applyTheme(id)` sets `html[data-theme]`, updates the button label, stores the choice,
  and hands the theme to the layers CSS cannot reach: `window.__ubSetPalette(id)` (the WebGL background's palette) and
  `window.__ubPoseSync()` (the keyed video clip). The header comment: no markup and no lesson data is duplicated, so a
  switch cannot lose reading state.
- **The switch is named by state and action.** The button reads "Ink look. Switch to Pulse". An earlier
  `aria-pressed` version made screen readers say "Pulse, pressed", which described neither look (its QC note F-AT-3).
- **The switch is a designed moment.** `switchLook(fn, origin, plain)`:

```js
var lookVT = null;
function switchLook(fn, origin, plain) {
  var root = document.documentElement;
  if (!document.startViewTransition || document.hidden) { fn(); return; }
  if (lookVT) { try { lookVT.skipTransition(); } catch (e) {} }
  var r = origin.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  var R = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
  var mode = plain || calm() ? "fade" : "reveal";
  root.setAttribute("data-vt", mode);
  var vt = lookVT = document.startViewTransition(fn);
  vt.ready.then(function () {
    if (mode !== "reveal") return;
    root.animate({ clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + R + "px at " + x + "px " + y + "px)"],
                   filter: ["brightness(1.4) saturate(1.25)", "none"] },
                 { duration: 720, easing: "cubic-bezier(.77,0,.175,1)", pseudoElement: "::view-transition-new(root)" });
  }).catch(function () {});
  vt.finished.catch(function () {}).then(function () { if (lookVT === vt) { lookVT = null; root.removeAttribute("data-vt"); } });
}
```

```css
::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
html[data-vt="fade"]::view-transition-old(root){animation:vtOut 220ms ease both}
html[data-vt="fade"]::view-transition-new(root){animation:vtIn 220ms ease both}
@keyframes vtOut{to{opacity:0}} @keyframes vtIn{from{opacity:0}}
```

  The new look opens as a circle from the switch over the still old one, 720 ms on a strong in-out curve, with a
  brief brightness lift; it is chosen once or twice a course, so it may take that long. Calm and reduced motion get a
  220 ms crossfade (opacity, not movement), and so does the Calm switch itself, because stopping every loop at once
  is a jolt and a dissolve is not. No API, or a hidden tab: switch at once.
- **Calm** is the learner's own still mode (`state.perfLite`): `calm()` is `perfLite || prefers-reduced-motion`, and
  every loop asks it. `setCalm(on)` toggles `html.perf-lite`, tells every loop (`__ubPoseSync`, `__ubNebulaKick`, the
  game background's `kick()`), stores the choice, and announces "Calm on. Still pictures, no motion." through the live
  region (on Home) or a toast. Loops built only when motion was allowed at boot are rebuilt when Calm turns off. The
  system's own reduced-motion setting can change while the page is open, so the app listens for its `change` event.

## 2. What it teaches by its costs (measured with `scripts/tokens.mjs scan`)

- **143 component overrides** scoped to `html[data-theme="pulse"]` against **2 token rules** (145 theme-scoped
  selectors in `styles.css`; the research counted 142 earlier). Pulse changes type behaviour, geometry, button shapes,
  gradients, vignette and grain through component rules: a second stylesheet in practice. Structural tokens
  (`--radius`, `--border-w`, `--head-transform`, `--head-tracking`, `--surface-effect`) would have folded many of them
  into the token block.
- **Colour-named tokens reassigned**: the scan lists `--violet`, `--violet-deep`, `--violet-glow`, `--blue`,
  `--blue-deep`, `--blue-glow`, `--red`, `--red-deep`, `--red-glow`, `--gold`, `--cyan` set by the Pulse block. In
  Pulse `--violet` is orange, `--blue` is cyan, `--red` is yellow (`#FF8A00`, `#00E5FF`, `#FFD60A`, with those comments in `styles.css`), so a component reading
  `var(--violet)` lies. Name tokens by role (`--brand`, `--accent`, `--danger`).
- **Contrast discipline lived in comments** (a faint ink lifted from 4.00:1 to clear 4.5:1, per its QC notes). The
  `tokens.mjs` gate turns that into a check on every theme.
- **No pre-paint theme script**: the theme is applied by the app script (`initTheme`). It does not flash in practice
  because the first thing on screen is a dark opening film; a page without such a cover needs the `<head>` script.
- **Calm is implemented as a class plus many per-component rules** (`.perf-lite ...` throughout `styles.css`, and
  `html[data-theme="pulse"].perf-lite ...` combinations). A motion token (`--motion: 0 | 1`) read by the components
  would have kept it in one place.

## 3. If it were rebuilt

Three layers (primitives, role tokens, components); structural tokens per theme; role names; `tokens.mjs check` in
the build; the head script for first paint; the same `switchLook` (it is good); Calm as a token plus the `calm()`
function every loop asks; the canvas and video hand-off kept, since CSS variables never reach WebGL.
