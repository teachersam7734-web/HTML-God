# Native component patterns: behaviour contracts and field traps

Each pattern: the element that does the work, the keyboard contract, what the browser gives for free, what you still
write, and the traps found building Ultra Bookworm's course UI (SENSEI-LOG, design-fix agent) and this skill's sheet.
Working code for every pattern: [../examples/components.html](../examples/components.html), proved by
[../scripts/test-components.mjs](../scripts/test-components.mjs) (65 assertions, left to right and right to left).

## Support (Chrome only, checked here)

`examples/probe.html` exercised these in installed Chrome (user agent 156, 2026-10-24): `popover`, `popover="hint"`,
`interestfor`, `command`/`commandfor`, `showModal()`, `closedby`, anchor positioning with `position-area` and
`position-try-fallbacks`, `@starting-style`, `interpolate-size`, `::details-content`, exclusive `details name`,
`appearance: base-select`, `:has()`, container queries, scroll-driven animation, View Transitions, nesting,
`color-mix()`, `light-dark()`, `text-wrap: balance`, `field-sizing`, custom highlights, `::scroll-marker`: all yes,
and popover, modal dialog and `command="show-modal"` actually opened. Firefox and Safari were not available: open
`probe.html` in them before relying on a row, and keep each feature behind `@supports` or a feature test with a
working fallback.

## Menu: popover plus anchor positioning

- **Element**: `<button popovertarget="m" aria-haspopup="menu">` and `<div id="m" popover role="menu">` with
  `role="menuitem"` buttons.
- **Free**: top layer (no z-index fights), light dismiss on an outside click, Escape closes, focus returns to the
  invoker on Escape (tested), one auto popover open at a time.
- **You write**: first item focused on open (`toggle` event, `newState === 'open'`), ArrowDown and ArrowUp with wrap,
  Home and End; after choosing an item, `hidePopover()` and focus the button.
- **Placement**: `anchor-name: --menu` on the button; on the popover `position-anchor: --menu; position-area:
  block-end span-inline-end; position-try-fallbacks: flip-block, flip-inline`. The logical keywords follow `dir`
  (tested: left edges aligned in LTR, right edges in RTL). Fallback under `@supports not (anchor-name: --a)`: a
  `beforetoggle` handler writes the button's rectangle into custom properties on a fixed popover (written, not run:
  no browser here lacks anchor positioning).
- **Entry and exit**: transition `opacity`, `translate`, and `display` and `overlay` with `allow-discrete`; the
  closed state under `:not(:popover-open)` and the entry state under `@starting-style`.

## Dialog: `<dialog>` with `showModal()`

- **Element**: `<dialog aria-labelledby>` with `<form method="dialog">`; buttons carry `value`, read
  `dialog.returnValue` in the `close` event.
- **Open**: `command="show-modal" commandfor="dlg"` on the button (no script) where `'command' in
  HTMLButtonElement.prototype`; otherwise a click handler calling `showModal()`.
- **Free with `showModal()`**: the page behind is inert, Tab stays inside, Escape closes, focus returns to the opener
  (tested here and in `sensei-verify/examples/dialog.html`). `autofocus` on the safe choice (Cancel). `closedby="any"`
  adds light dismiss.
- **Trap**: `show()` (non-modal) does not close on Escape and does not make the page inert. Modal UI uses
  `showModal()`.
- **Trap**: a test step that opened a dialog and never closed it made every later step fail quietly (the page was
  inert). Close dialogs between steps or start a fresh page.
- **Trap**: hiding in the same tick as removing the visible class kills the exit fade. Exit on `transitionend` with a
  backstop about twice the duration (a slow frame started a 420 ms fade late: `transitionend` came at 971 ms); exit
  faster than entry, on an ease-in.

## Tooltip: hint popover opened by interest

- `<button interestfor="tip" aria-describedby="tip">` and `<div id="tip" popover="hint" role="tooltip">`; place it with
  `position-area: block-start` (the invoker is the implicit anchor). Opens on hover and keyboard focus (tested: open
  after focus, 6 px above the button, both directions); a hint popover does not close an open auto popover.
- Fallback where `interestForElement` is missing: `showPopover({ source: btn })` on `focus` and `pointerenter`,
  `hidePopover()` on `blur` and `pointerleave` (written, not run here).
- Never put the only copy of essential information in a tooltip; touch has no hover.

## Accordion: `<details name>`

- Same `name` on each `<details>` makes an exclusive group (tested: opening one closes the other; Enter on a focused
  `summary` toggles).
- Animate with `:root { interpolate-size: allow-keywords }`, `details::details-content { block-size: 0; overflow:
  clip; transition: block-size, content-visibility allow-discrete }` and `details[open]::details-content {
  block-size: auto }`. Under reduced motion, `transition: none`.
- The summary is a real control: keep its focus ring and at least 24 CSS px of height (the sheet uses 44).

## Tabs: the ARIA pattern with a roving tab stop

- `role="tablist"` (labelled), `role="tab"` with `aria-selected`, `aria-controls`, `tabindex` 0 on the selected tab and
  -1 on the others; `role="tabpanel"` with `aria-labelledby` and `tabindex="0"`, the others `hidden`.
- Arrow keys move and select (automatic activation), Home and End jump, focus wraps; Tab leaves the tablist for the
  panel. **The arrows follow the writing direction**: in RTL, ArrowLeft is next (read `getComputedStyle(tablist)
  .direction`). Ignore keys with Alt, Ctrl or Meta.
- Tested in both directions, about 30 lines.

## Toast: one live region

- A `role="status" aria-live="polite" aria-atomic="true"` element present from page load; only its text changes.
  Clear it, then write about 80 ms later, so the same message twice is announced twice.
- Never move focus to a toast; never put the only route to an action in one; it hides after a few seconds, so
  anything the user must act on belongs in a dialog or inline.
- The plugin's `lint-web` warns on toasts with no live region.

## Select: `appearance: base-select`

- Under `@supports (appearance: base-select)`: `select, ::picker(select) { appearance: base-select }`, then style
  `::picker(select)` and `option`. Elsewhere the native select stays: it is never worse than a custom listbox.

## Field traps that apply to any component

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Six invisible focus stops before the page | a fixed bar slid off screen with `translateY(-100%)` stays in the Tab order and the tree | toggle `inert` with the show class; `visibility: hidden` with a delayed `visibility` transition so it still slides | tested (Ultra Bookworm) |
| 2 | Focus falls to `<body>` after a view change | the pressed button now lives in a `display: none` screen | focus the new view's heading with `focus({ preventScroll: true })`, `tabindex="-1"` on it and no ring for that case | tested |
| 3 | Focus falls to `<body>` after an answer | `disabled` on the focused option | `aria-disabled="true"` plus a guard in the handler; every `:hover:not(:disabled)` style also gets `:not([aria-disabled="true"])` | tested |
| 4 | Arrow keys in a tablist or slider trigger page shortcuts; Alt+Left no longer goes back | a window-level shortcut listener | return on `defaultPrevented`, any modifier, and when the target is inside an input, a tablist, a slider or a radio group; Space only on `body`; a shortcut never completes anything | tested |
| 5 | An arrow key commits a quiz answer | buttons built as a radio group without the contract | `role="radiogroup"` and `role="radio"` with `aria-checked`; arrows move focus only; a polite region speaks the verdict | tested |
| 6 | The flashcard answer is read before the flip | a back face hidden only by `rotateY(180deg)` and `backface-visibility` is still in the tree | front is a `<button aria-expanded>`; back is `inert` and `aria-hidden` until turned, then focused | tested |
| 7 | A multi-word term no longer wraps with its sentence | an inline `<button>` lays out as an unbreakable inline block | `<span role="button" tabindex="0">` with Enter and Space handled, `box-decoration-break: clone` | tested |
| 8 | A popover vanishes under the focused link while tabbing | "close on scroll" fired on the browser's own scroll-into-view | close on scroll only when the popover was opened by a pointer (`e.detail > 0` on the click) | tested |
| 9 | A popover is wider than its column | `max-width: calc(100vw - 2rem)` ignores the padded column | cap the width to the positioning box before measuring | tested |
| 10 | Hover lift stuck after a tap on a phone | `:hover` sticks on touch | hover motion only under `@media (hover: hover) and (pointer: fine)`; `:active` gets its own press | tested |
| 11 | Shadow-only controls disappear in forced colours | no real border | a real border (transparent is fine) on every control | tested (UI lane, and this sheet's forced-colours check) |
| 12 | Hover lift never applies on a card that also reveals on scroll | an animation with fill `both` owns `transform` | lift with `translate`, press with `scale` (individual properties compose) | tested (`sensei-motion-ui` owns the detail) |
