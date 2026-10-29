---
name: sensei-tokens-theming
description: Design tokens and themes for HTML. Three layers (primitives, role tokens, components), structural tokens so a theme can change radius, borders, shadows and type and not only colour, light and dark with light-dark() and color-scheme, colours derived with relative colour and color-mix, typed @property animation, a pre-paint theme script with no flash, a designed theme switch (View Transition circle reveal, crossfade under Calm and reduced motion), a Calm still mode, canvas and WebGL hand-off, and a WCAG contrast gate on every theme (tokens.mjs) plus a scanner that finds theme overrides leaking out of the tokens. Ultra Bookworm's Ink and Pulse looks are the worked example. Use when someone says tokens, design tokens, CSS variables, custom properties, theme, themes, dark mode, light mode, theme switcher, toggle theme, skins, brand colours, palette to CSS, colour system, contrast of my palette, flash of wrong theme, or calm mode.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-tokens-theming

A theme is a block of role tokens; components read roles only; every theme passes the contrast gate before anything
is built on it. Doctrine first (`html-sensei`): best quality is the default, reduced motion is built in, what was not
verified is said.

## 1. When to use

After `sensei-direction` has chosen a direction (its palette roles and type roles become tokens); whenever a project
needs more than one look, light and dark, a brand swap, or a learner-chosen still mode; when an existing stylesheet's
themes have grown into overrides.

| The job is | Skill |
|---|---|
| Choosing the palette, style and direction | `sensei-direction` |
| Contrast of translucent, gradient or image grounds (pixel sampling) | `sensei-direction` (`style-contrast.mjs`) |
| Fonts, subsetting, Persian type metrics | `sensei-typography` |
| Page-to-page and element View Transitions beyond the theme switch | `sensei-transitions` |
| Motion tokens' use in UI animation, the reduced-motion gate | `sensei-motion-ui` |
| Shader or 3D palettes that must follow the theme | `sensei-shaders-vfx`, `sensei-3d` (this skill gives the hand-off) |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| How many themes | one; light and dark; two or three skins | the brief. A landing page rarely needs more than light and dark; a course may offer skins as a learner preference |
| Token layers | primitives, role tokens, components | always three; components never read primitives |
| What a theme may change | colours only; colours plus structure | structure (radius, border width, shadow, heading font and tracking, density) whenever the looks differ in more than colour; otherwise overrides leak into components |
| Light and dark in one rule | `light-dark()` with `color-scheme`; two theme blocks | `light-dark()` for small one-off pairs; theme blocks for the system |
| Derived states | relative colour, `color-mix`; hand-picked tokens | derive hover, pressed, muted, tint from one brand value; hand-pick only when a derived value fails contrast |
| First paint | head script; app script | the head script, always, unless an opaque cover (an opening film) hides the first frames |
| Switch transition | circle reveal; crossfade; none | reveal for a designed, rare switch; 220 ms crossfade under Calm and reduced motion; none when the API is missing or the tab is hidden |
| A still mode | Calm toggle; reduced motion only | offer Calm whenever there is ambient motion (`motion: cinematic` or `lively`); Calm and reduced motion mean the same to every loop |
| Canvas, WebGL, video | a theme hand-off function | always, when any layer draws colour outside CSS |
| Gate | `tokens.mjs check`; pixel sampling; the page gate | `tokens.mjs` for solid pairs on every theme; pixel sampling for alpha and gradients; `sensei-verify` on the rendered page |

## 3. Core technique

### 3.1 Three layers, role names, structural tokens

```css
:root {                                           /* 1 primitives: raw values, never read by components */
  --p-ink-900: #0b0a14; --p-ink-800: #15132a; --p-ink-050: #f4f2ff; --p-violet-400: #8b7bff;
  --p-paper-050: #faf8f3; --p-paper-900: #17142b; --p-indigo-600: #4a35e8;
}
html[data-theme="ink"] { color-scheme: dark;      /* 2 role tokens: the ONLY layer a theme sets */
  --bg: var(--p-ink-900); --surface: var(--p-ink-800); --text: var(--p-ink-050); --text-soft: #c9c4e6;
  --brand: var(--p-violet-400); --on-brand: var(--p-ink-900); --line: #6a6694;
  --radius: 16px; --border-w: 1px; --shadow: 0 20px 50px -20px #000a; --font-head: var(--font-ui); }
html[data-theme="brut"] { color-scheme: light;
  --bg: #fff4c2; --surface: #9ad8ff; --text: #000; --text-soft: #111; --brand: #ff5d8f; --on-brand: #000; --line: #000;
  --radius: 0; --border-w: 3px; --shadow: 6px 6px 0 #000; }
.card { background: var(--surface); border: var(--border-w) solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
.btn  { background: var(--brand); color: var(--on-brand); border: var(--border-w) solid transparent; }   /* 3 components */
.btn:hover { background: color-mix(in srgb, var(--brand) 88%, var(--text)); }
.chip { background: var(--brand); background: oklch(from var(--brand) l calc(c * .3) h); }  /* plain fallback first */
```

`brut` differs from `ink` in colour, radius, border, shadow and heading font with no component change. Name role
tokens by job (`--brand`, `--accent`, `--danger`), never by colour: themes reassign colours. The full vocabulary and
the measured techniques: [references/techniques.md](references/techniques.md).

### 3.2 Gate every theme before building on it

Keep the themes in JSON, generate the blocks, and gate them:

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-tokens-theming/scripts/tokens.mjs check themes.json                  # eight pairs per theme, exit 1 on a failure
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-tokens-theming/scripts/tokens.mjs build themes.json --out themes.css
```

Pairs: text and text-soft on bg and on surface 4.5; on-brand on brand 4.5; brand on bg 3; line on bg and on surface
3 (WCAG 1.4.11). Non-hex values are listed as not checked (pixel-sample them). A colour-named token in a theme warns.

### 3.3 No flash: the pre-paint script

In `<head>`, synchronous, before any stylesheet that paints:

```html
<script>
(function () {
  var t = null, d = document.documentElement;
  try { t = localStorage.getItem("site-theme"); } catch (e) {}       /* storage is a convenience; it may throw */
  if (!t) t = matchMedia("(prefers-color-scheme: light)").matches ? "paper" : "ink";
  if (["ink", "paper", "brut"].indexOf(t) < 0) t = "ink";
  d.setAttribute("data-theme", t);
})();
</script>
```

### 3.4 The switch: a designed moment, calm when asked

Ultra Bookworm's pattern ([references/ultra-bookworm-themes.md](references/ultra-bookworm-themes.md)), as in
[examples/tokens.html](examples/tokens.html):

```js
var lookVT = null;
function switchLook(fn, origin, plain) {
  var root = document.documentElement;
  if (!document.startViewTransition || document.hidden) { fn(); return; }
  if (lookVT) { try { lookVT.skipTransition(); } catch (e) {} }          /* a second press finishes the first */
  var r = origin.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  var R = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
  var mode = plain || calm() ? "fade" : "reveal";
  root.setAttribute("data-vt", mode);
  var vt = lookVT = document.startViewTransition(fn);
  vt.ready.then(function () {
    if (mode !== "reveal") return;
    root.animate({ clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + R + "px at " + x + "px " + y + "px)"] },
      { duration: 720, easing: "cubic-bezier(.77,0,.175,1)", pseudoElement: "::view-transition-new(root)" });
  }).catch(function () {});
  vt.finished.catch(function () {}).then(function () { if (lookVT === vt) { lookVT = null; root.removeAttribute("data-vt"); } });
}
```

```css
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
html[data-vt="fade"]::view-transition-old(root) { animation: vt-out 220ms ease both; }
html[data-vt="fade"]::view-transition-new(root) { animation: vt-in 220ms ease both; }
@keyframes vt-out { to { opacity: 0; } } @keyframes vt-in { from { opacity: 0; } }
```

The switch button is named by state and action ("Ink look. Switch to Paper"), not `aria-pressed`; the change is
announced in a polite live region. `applyTheme` sets the attribute, stores the choice in try/catch, relabels, and runs
the hand-off.

### 3.5 Calm, and the layers CSS cannot reach

- **Calm**: `function calm() { return root.classList.contains("calm") || RM.matches; }`. Every loop asks it before
  requesting a frame; the toggle is a real `aria-pressed` button, stored, announced, and switched with the fade (a
  dissolve, not a jolt). Listen for the reduced-motion query's `change` event while the page is open. Rebuild loops
  that were skipped at boot when Calm turns off.
- **Hand-off**: canvas, WebGL and video never see CSS variables. After the theme changes, read
  `getComputedStyle(document.documentElement).getPropertyValue('--brand')` and repaint, set shader uniforms, or swap
  the clip; observe the canvas with `ResizeObserver` so a canvas measured while hidden (0 by 0) is re-measured.

### 3.6 Converting an existing stylesheet

1. `node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-tokens-theming/scripts/tokens.mjs scan styles.css`: counts theme-scoped rules, splits token rules from component
   overrides, lists colour-named tokens.
2. Rename colour-named tokens to roles (keep the primitives named by colour).
3. For each group of component overrides, find the structural difference (radius, border, transform, tracking, a
   texture on or off) and turn it into a role token set by each theme; delete the override.
4. Re-run the scan and `tokens.mjs check`; run the gate with a route per theme.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Three themes on one markup: pre-paint, layers, structural tokens, `light-dark()`, relative colour, typed `@property`, the switch, Calm, canvas hand-off | [examples/tokens.html](examples/tokens.html) | verified |
| Example theme JSON (two passing themes, one failing on purpose) | [examples/themes.example.json](examples/themes.example.json) | verified |
| Generator, contrast gate and leak scanner | [scripts/tokens.mjs](scripts/tokens.mjs) | verified |
| Self-test (21 assertions: gate, scanner, page behaviour, a late-theme flash caught) | [scripts/test-tokens.mjs](scripts/test-tokens.mjs) | verified |
| Fixtures: leaky theme CSS, a theme set too late | [fixtures/leaky.css](fixtures/leaky.css), [fixtures/late-theme.html](fixtures/late-theme.html) | verified |
| Role vocabulary, measured techniques, choice order, direction as an axis, gates | [references/techniques.md](references/techniques.md) | reference |
| Worked example: Ultra Bookworm's Ink, Pulse and Calm, with its measured costs | [references/ultra-bookworm-themes.md](references/ultra-bookworm-themes.md) | reference |

## 5. Quality bars

- Every theme passes `tokens.mjs check` (zero failing pairs); alpha and gradient grounds are pixel-sampled.
- `tokens.mjs scan` shows no component overrides scoped to a theme (or each one is justified in a comment), and no
  colour-named role tokens.
- The right theme is set before `<body>` exists, under light and dark systems and with storage blocked.
- The switch keeps scroll position, focus and state; under Calm and reduced motion it is a 220 ms crossfade or
  instant, never the circle; a second press never leaves a stale state.
- Canvas, WebGL and video follow the theme; nothing measured at boot stays wrong after a switch.
- The gate passes with a route per theme; RTL and LTR both looked at per theme when the project is bilingual.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | `var(--violet)` paints orange | colour-named tokens reassigned per theme (Ultra Bookworm Pulse: `--violet` `#FF8A00`, `--blue` `#00E5FF`, `--red` `#FFD60A`) | role names; primitives may keep colour names | read in `styles.css`; the scan lists 11 such tokens |
| 2 | A second theme became a second stylesheet | structural differences done as component overrides (143 in Ultra Bookworm against 2 token rules) | structural tokens per theme; `tokens.mjs scan` | measured here |
| 3 | The wrong theme flashes on load | the theme script runs after the body is parsed | synchronous script in `<head>` | tested (late-theme fixture shows `ink` first under a light system) |
| 4 | Private window or sandbox: the page breaks | `localStorage` throws `SecurityError` | every access in try/catch; the page works without storage | tested (blocked storage, no error) |
| 5 | Canvas or video keeps the old palette | CSS variables do not reach canvas, WebGL or video | a hand-off after every switch (`__ubSetPalette`, `__ubPoseSync` in Ultra Bookworm) | tested (canvas repaint) and read in Ultra Bookworm |
| 6 | Native controls stay light in a dark theme; `light-dark()` does nothing | no `color-scheme` on the theme root | set `color-scheme` per theme, on purpose | tested |
| 7 | A typed token is ignored | `@property` with `inherits: false` and no `initial-value` is invalid | declare `syntax`, `inherits` and `initial-value` | reported (research) |
| 8 | A colour token animates in a jump at 50% | untyped custom property | `@property` with a `<color>` or `<number>` syntax | tested (typed one animates) |
| 9 | Switching twice quickly leaves a half state | the first transition still running; its cleanup clears the second's marker | `skipTransition()` on the first; clean up only if still the current transition | tested here; trap recorded in SENSEI-LOG |
| 10 | The switch hides focus or leaves stale state | a View Transition is a snapshot; a throwing callback leaves the page mid-change | keep the callback small and safe; catch `ready` and `finished`; skip when hidden | reported (research), handled in the pattern |
| 11 | Motion-sensitive users get a sweeping circle | reveal used under reduced motion or Calm | fade mode (opacity only) for both, and for the Calm switch itself | tested |
| 12 | A canvas shows nothing after switching to the theme that displays it | it was measured at boot while `display: none` (0 by 0) | `ResizeObserver` on the canvas plus an explicit re-fit from the switch | reported (SENSEI-LOG, Ultra Bookworm) |
| 13 | A loop under `display: none` or `opacity: 0` still costs a full draw | hidden is not stopped | one `shouldRun()` per loop (screen, theme, visibility, Calm, reduced motion); count draw calls to prove idle | reported (SENSEI-LOG) |
| 14 | Changing a custom property that sets an infinite animation's duration makes it jump | the progress is rescaled | change duration only at a cycle boundary, or drive the phase yourself | reported (SENSEI-LOG) |
| 15 | Line breaks change after a theme switch | a theme changed font metrics | test the longest headings per theme and per language | reported (research) |
| 16 | `color-mix` or relative colour shows nothing in an old engine | unsupported function invalidates the declaration | a plain declaration first, the derived one after | reported (research); only Chrome tested |
| 17 | A screen reader says "Pulse, pressed" | `aria-pressed` on a two-look switch describes neither look | name by state and action; announce in a live region | reported (Ultra Bookworm QC F-AT-3) |
| 18 | A gradient or translucent token passes the gate but text is unreadable | the gate judges plain hex only | pixel-sample (`sensei-direction`'s `style-contrast.mjs`) | by design |
| 19 | `transition: all` animates every theme colour on switch and costs frames | the hook flags it | list the properties | `lint-web` rule |
| 20 | The scanner split a selector inside `:is(h1,h2)` | commas inside functions | split on top-level commas only | found and fixed while writing this skill |

## 7. Licences

Everything here is HTML-Sensei's own code (from the UI lane's `code-ui` lab) or read from the owner's own project
(Ultra Bookworm); nothing vendored. Projects that adopt Open Props (MIT) or another token set add a ledger row
(`sensei-ui-components`).

## 8. Verification

Run here (Windows 10, Node 24, Chrome 155 through playwright-core 1.64, axe-core 4.12, software GL):

- `scripts/test-tokens.mjs`: 21 of 21 assertions pass: the gate fails `pulse-bad` on exactly text-soft on surface
  4.22, on-brand on brand 2.00, line on bg 1.20, line on surface 1.12 and passes `ink` and `paper`; the scanner counts
  the fixture; the page sets the theme before `<body>` under both schemes (and the late fixture is caught); every
  behaviour in section 3 works, including the double press, blocked storage, reduced motion and Calm across a reload.
- `tokens.mjs scan` on Ultra Bookworm's `app/styles.css` in the owner's Ultra Bookworm project (not shipped): 145 theme-scoped selectors, 2 token rules, 143
  component overrides, 11 colour-named tokens.
- `sensei-verify`'s gate on `examples/tokens.html`, strict `file://`, with routes for `?theme=paper`, `?theme=brut`
  and a click on the switch: pass (25 pass); the contact sheet was looked at (all three themes, forced colours, 320 px).

Not verified: Firefox and Safari (`light-dark()`, relative colour, `@property`, View Transitions); the axe runs cover
only the themes a system preference selects (a third theme's rendered page was screenshotted, not axe-checked);
screen reader speech of the announcements; a refactor of Ultra Bookworm's overrides (proposed, not done); theme
switching with live WebGL in this skill's example (the canvas is 2D; Ultra Bookworm's WebGL hand-off was read, not
run here).

## 9. Carried by

- Agent `sensei-art-director` writes the role palette and theme JSON from the direction note and runs the gate;
  builders read the tokens; `sensei-reviewer` checks the quality bars.
- Hooks: `lint-web.mjs` warns on `transition: all`, an unguarded `startViewTransition`, and View Transitions or
  animations without a reduced-motion path; `gate-claim.mjs` needs a fresh passing gate before "done". Rules the
  research proposed that no hook enforces yet (component selectors naming a theme, colour-named tokens in theme blocks,
  a theme script outside `<head>`, `localStorage` without try/catch) are covered by `tokens.mjs scan` and the test
  pattern here.
