# Token and theme techniques, with what was measured

Source: `domain-design-tokens-theming.md` in the HTML-Sensei build project's research notes (not shipped) (UI lane) and the runs of
[../scripts/test-tokens.mjs](../scripts/test-tokens.mjs) here (Chrome 155 headless). Chrome is the only engine tested.

## 1. The role vocabulary

| Group | Tokens | Notes |
|---|---|---|
| Ground and surfaces | `--bg`, `--surface`, `--surface-2`, `--overlay` | elevation on dark by lighter tint, not shadow |
| Text | `--text`, `--text-soft`, `--text-faint` (decorative only) | `--text-soft` must pass 4.5 on both ground and surface |
| Action | `--brand`, `--on-brand`, `--accent`, `--focus` | `--on-brand` is the label colour on a brand fill |
| Status | `--danger`, `--warn`, `--ok`, each with `--on-*` | meaning also in words or icons, never colour alone |
| Lines | `--line` (control boundaries, 3:1), `--hairline` (decorative) | two tokens, because only one must pass 1.4.11 |
| Structure | `--radius`, `--border-w`, `--shadow`, `--font-head`, `--font-body`, `--head-tracking`, `--head-transform`, `--space-*`, `--density` | what turns a recolour into a different look |
| Motion | `--ease-*`, `--dur-*`, and a still-mode switch | Calm and reduced motion read one place |

Primitives (`--p-ink-900`, `--p-violet-400`) may be named after colours because they never change meaning; role
tokens may not.

## 2. Measured techniques

| Technique | Result here |
|---|---|
| Pre-paint script in `<head>` (storage in try/catch, falls back to `prefers-color-scheme`) | the theme was set when the parser inserted `<body>`: system dark gave `ink`, light gave `paper`; a fixture with the script at the end of `<body>` showed `ink` first under a light system (a flash) |
| Storage blocked (a throwing `localStorage` getter) | themed, no page error |
| `color-scheme: dark` on the theme root | native controls and scrollbars follow; required for `light-dark()` |
| `light-dark(#fff3c4, #3a3300)` | resolved to `rgb(58, 51, 0)` under `ink` |
| `oklch(from var(--brand) calc(l + .15) c h)` and siblings | four distinct derived swatches from one brand value (research: lighter 0.81, darker 0.51, desaturated chroma 0.057) |
| `@property --accent-h { syntax: "<number>"; inherits: true; initial-value: 262 }` | animates smoothly (the value changed between reads 0.9 s apart; research: 262 to 272.7); an untyped property flips at the halfway point |
| `color-mix(in srgb, var(--brand) 88%, var(--text))` | hover states without a new token |
| View Transition circle reveal | `::view-transition-new(root)` animated with a `clipPath` keyframe; theme stored; `data-vt` cleaned |
| Second press mid-transition | `skipTransition()` on the first; the page landed two themes on with no stale `data-vt` |
| Reduced motion | the fade mode (opacity only, no circle), the theme applied, no infinite animation |
| Calm | the loop stopped, the button pressed, the choice survived a reload |
| Canvas hand-off | the canvas repainted with the new `--brand` read by `getComputedStyle` after the switch |

## 3. Persistence and choice order

1. An explicit choice this session (the switch).
2. A stored choice (`localStorage`, in try/catch; a convenience only, the page works without it).
3. The system preference (`prefers-color-scheme`).
4. The design's default.

A query override (`?theme=`) is for tests and links. Never put the theme in a cookie for an offline file.

## 4. Direction and language as theme axes

Set `dir` and `lang` on `<html>` and write logical properties only (`margin-inline-start`, `inset-inline-end`,
`border-start-start-radius`); the landing lab has no physical left or right in its CSS. Fonts per language live in
tokens (`--font-body`), with `:lang(fa)` overriding tracking (none for Persian) and leading (`sensei-typography`).
Physical light (neumorphic shadows) does not mirror.

## 5. Gates

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-tokens-theming/scripts/tokens.mjs check themes.json           # every theme, eight pairs; exit 1 on a failure
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-tokens-theming/scripts/tokens.mjs build themes.json --out themes.css
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-tokens-theming/scripts/tokens.mjs scan styles.css             # theme rules split into token rules and component overrides
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-direction/scripts/style-contrast.mjs cells.html   # alpha, gradients, images, on style cells
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/sensei-gate.mjs page.html --routes "?theme=paper,?theme=brut"
```

`tokens.mjs` judges only plain hex pairs; translucent tokens, gradients and text over images are reported as not
checked and need pixel sampling. The gate takes a file path, not a query: its `--routes` give a screenshot and an
error check per theme, and its axe runs cover the themes the system preference selects (light context: the light
theme; its dark run: the dark theme, when the page has the pre-paint fallback). A third theme gets no axe run from the
gate: `tokens.mjs check` covers its solid pairs, and a temporary copy of the page that defaults to it gets the gate's axe.
