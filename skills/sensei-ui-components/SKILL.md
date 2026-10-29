---
name: sensei-ui-components
description: "UI components, native platform first: forms (accessible validation, and what submit does in an offline single file versus a hosted page), menus, dialogs, tooltips, accordions, tabs, toasts and selects built from popover, dialog, details, anchor positioning and invoker commands, with keyboard, RTL, reduced motion and forced colours built in; choosing a component library by licence (shadcn/ui, Magic UI, daisyUI, Open Props, Pico, uiverse, Origin UI, Tailwind Plus, Aceternity); compiling Tailwind into one offline file; and the React Bits fetch-and-port procedure with its notice. Use when someone says form, sign-up or contact form, validation, submit, component, UI kit, modal, dialog, dropdown, menu, tooltip, accordion, tabs, toast, select, shadcn, daisyUI, Tailwind, React Bits, Aceternity, Magic UI, or asks whether a component's licence is OK."
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-ui-components

Components the platform already has come first: they are accessible, keyboard-complete, licence-free and weigh
nothing. A library comes in when the platform has no answer or the project already uses it, and then its licence
decides how: lifted with a notice, fetched into the project, or re-implemented. Nothing from a never-ship source
enters the plugin.

## 1. When to use

Building or reviewing any interactive control in a page, including forms (sign-up, contact, waitlist, enrolment); choosing or auditing a component library; putting Tailwind
into a single file; using a React Bits component in a project.

Another skill owns it instead:

| Request | Skill |
|---|---|
| Tokens, themes, light and dark, contrast gate | `sensei-tokens-theming` |
| Visual style (glass, neumorphism, brutalism) and directions | `sensei-direction` |
| Hero sections, landing structure, backgrounds | `sensei-landing-hero` |
| Hover, press and entrance motion, springs, the reduced-motion gate | `sensei-motion-ui` |
| Cursor effects, magnetic, tilt, drag | `sensei-pointer` |
| Text effects, splitting, fonts, Persian | `sensei-typography` |
| Packing the page into one file | `sensei-single-file` |
| Proving it (keyboard walk, axe, forced colours, steps) | `sensei-verify` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| What a form does on submit | offline: save on this device, then copy, download or `mailto:`; hosted: `fetch` POST with sending, success and failure states | the deliverable: an offline single file has no server, so it never claims "sent"; a hosted page with an endpoint posts a body, never a query string ([references/forms.md](references/forms.md)) |
| Native or library | native element; MIT library code; a fetched project-only component; your own | native whenever the platform has the control ([references/native-patterns.md](references/native-patterns.md)); a library only for what it adds, and only on its licence's terms |
| Which native element | `popover` (menu, picker, toast), `<dialog>` + `showModal()` (anything that blocks the page), `popover="hint"` + `interestfor` (tooltip), `<details name>` (accordion), ARIA tabs (no native tabs), `<select>` with `base-select` | does it block the page: dialog; does it float and dismiss lightly: popover; does it describe: hint |
| Placement | CSS anchor positioning with logical `position-area`; a script fallback under `@supports not` | anchor positioning where the target browsers have it (probe them); logical keywords so RTL follows |
| Opening without script | `command`/`commandfor`, `popovertarget`, `interestfor`; a click handler as fallback | invoker attributes where supported, feature-tested with a fallback |
| Library licence | lift with notice (MIT); project-only (React Bits, Tailwind Plus, Aceternity Pro); re-implement (unknown or AGPL) | the licence file at the version used ([references/libraries.md](references/libraries.md)) |
| Tailwind | none; compiled once and inlined; the CDN script | compiled and inlined when the project uses Tailwind; the CDN never (it breaks offline use and the no-CDN rule) |
| React Bits in a vanilla page | bundle the React component; port verbatim in the project; write your own | port when the page must stay vanilla; bundle when React is acceptable; your own when the effect is simple. Never in the plugin ([references/react-bits.md](references/react-bits.md)) |
| Base CSS | own tokens; Open Props; Pico classless; compiled daisyUI | own tokens for designed work; Pico for forms and documents; Open Props for tokens without a build |

## 3. Core technique

### 3.1 The native sheet

[examples/components.html](examples/components.html) is the reference: one file, no library, every control below,
tested in both writing directions. The essentials:

```html
<button id="menu-btn" popovertarget="menu" aria-haspopup="menu">Actions</button>
<div id="menu" popover role="menu" aria-labelledby="menu-btn">
  <button role="menuitem">Duplicate</button> ...
</div>
<button commandfor="dlg" command="show-modal">Delete project</button>
<dialog id="dlg" aria-labelledby="dlg-title" closedby="any">
  <form method="dialog"> ... <button value="cancel" autofocus>Cancel</button><button value="delete">Delete</button></form>
</dialog>
<button interestfor="tip" aria-describedby="tip">Help</button><div id="tip" popover="hint" role="tooltip">...</div>
<details name="faq" open><summary>Question</summary><p>Answer</p></details>
<div id="toast" role="status" aria-live="polite" aria-atomic="true"></div>   <!-- present from load -->
```

```css
#menu-btn { anchor-name: --menu; }
#menu { position-anchor: --menu; position-area: block-end span-inline-end;
  position-try-fallbacks: flip-block, flip-inline;
  transition: opacity .22s, translate .22s, display .22s allow-discrete, overlay .22s allow-discrete; }
#menu:not(:popover-open) { opacity: 0; translate: 0 -4px; }
@starting-style { #menu:popover-open { opacity: 0; translate: 0 -4px; } }
:root { interpolate-size: allow-keywords; }
details::details-content { block-size: 0; overflow: clip;
  transition: block-size .22s, content-visibility .22s allow-discrete; }
details[open]::details-content { block-size: auto; }
@supports (appearance: base-select) { select, ::picker(select) { appearance: base-select; } }
@media (prefers-reduced-motion: reduce) { /* keep state changes, drop movement and size animation */ }
```

The browser gives Escape, light dismiss, the top layer, focus return to the invoker, the modal focus trap and the inert
page. You write: focus the first menu item on open, arrow keys inside menus and tabs, `returnValue` handling, the toast
text, and a fallback for each feature you test for (`'command' in HTMLButtonElement.prototype`,
`'interestForElement' in HTMLButtonElement.prototype`, `CSS.supports('anchor-name', '--a')`).

Tabs have no native element: the ARIA pattern with one tab stop, arrows that **follow the writing direction**, Home
and End, automatic activation, about 30 lines (in the sheet). Every control keeps a real border (transparent is fine)
so forced colours keep its edge, a visible `:focus-visible` ring, and at least 24 CSS px of target (the sheet uses
44). Write placement with logical properties (`inset-inline-end`, `padding-inline`, `position-area` keywords): one
`dir` attribute then flips the page.

### 3.2 Forms

[examples/form.html](examples/form.html), with the full recipe in [references/forms.md](references/forms.md):
`novalidate` plus the constraint API (`required`, `type`, `minlength`, `pattern`, `el.validity`) mapped to your own
messages per language; `aria-invalid` and the error text in the element `aria-describedby` names; focus to the first
invalid field; a summary of links in a live region present from load; a polite status line for the result. Persian
and Arabic-Indic digits normalised before validation; Latin-only fields `dir="ltr"` inside RTL; autocomplete tokens
(`name`, `email`, `tel`). The submit is honest: offline, "Saved on this device only. Nothing has been sent" with copy,
download and `mailto:`; hosted, POST with `aria-busy`, success only on a 2xx, failures that keep the entry. Read
controls through `form.elements`, never `form.name`.

### 3.3 Choosing a library

1. Can the platform do it? Then do not add a library.
2. Read the licence file at the version you will use; record the folder for mixed repositories (Origin UI is MIT in
   two folders and AGPL in all others).
3. Lift MIT code with its notice and a ledger row; in vanilla pages lift the CSS and token values, port the behaviour.
4. Project-only sources (React Bits, Tailwind Plus, Aceternity Pro): used inside the user's product by the user, never
   copied into the plugin, a shared template or a starter pack.
5. Unknown licence (Aceternity free components) or AGPL in a closed product: re-implement from the idea in your own
   code and record it as original.

Full table with sizes and single-file routes: [references/libraries.md](references/libraries.md).

### 3.4 Tailwind in one file

```
npm i -D tailwindcss @tailwindcss/cli             # build time only
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-ui-components/scripts/tailwind-one-file.mjs page.src.html dist/page.html [--css theme.css]
```

The page marks the spot with `<style data-tailwind></style>`. The script compiles from
`@import "tailwindcss" source(none); @source "<page>";` (only this page's classes), appends your `--css` (`@theme`,
`@layer`, `@utility`), minifies, keeps Tailwind's `/*! ... MIT License */` header, inlines the result and removes a
Tailwind CDN script if one is left in the page. The fixture page compiled to 8,250 bytes of CSS (information, not a
budget). Logical utilities (`ps-8`, `border-s-4`) and `rtl:` variants work: prove the flip in RTL. Then pack and gate:
`sensei-single-file`, `sensei-verify`.

### 3.5 React Bits: fetch and port, in the project only

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-ui-components/scripts/registry-fetch.mjs https://reactbits.dev/r/<Name>-<JS|TS>-<CSS|TW>.json \
  --out src/components/<name> --notice ${CLAUDE_PLUGIN_ROOT}/skills/sensei-ui-components/references/react-bits-notice.txt --licence "MIT + Commons Clause"
npm i -E <the dependencies it prints>
```

It writes each file verbatim with the full copyright and permission notice as a header comment, adds the ledger row,
lists the dependencies, and refuses any folder inside a plugin. For a vanilla page, port in the project: keep the
component's code as written and replace only the React shell (`mount(el, opts)` returning `update` and `destroy`), in a
file that keeps the notice, ledger `use: ported`. Then harden (reduced motion, pause off screen, context loss, touch
and keyboard paths) and gate. Procedure, React-to-vanilla table and the catalogue of 218 components:
[references/react-bits.md](references/react-bits.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Native sheet: anchored popover menu, invoker-command modal dialog, hint tooltip, exclusive animated accordion, RTL-aware tabs, live-region toast, base-select | [examples/components.html](examples/components.html) | verified, Chrome headless, LTR and RTL |
| Its behaviour test (65 assertions: open, keys, focus return, placement in both directions, inert page, reduced motion, forced colours) | [scripts/test-components.mjs](scripts/test-components.mjs) | verified |
| Its gate steps for `sensei-verify` | [examples/components.steps.json](examples/components.steps.json) | verified (gate pass, 25 steps) |
| Form: validation, accessible errors, Persian and RTL, offline and hosted submit | [examples/form.html](examples/form.html), recipe [references/forms.md](references/forms.md) | verified, Chrome headless, strict `file://` |
| Its behaviour test (40 assertions: both submit modes with a routed endpoint, digits, storage blocked, reduced motion, the `form.name` trap) | [scripts/test-form.mjs](scripts/test-form.mjs) | verified |
| Its gate steps (33 steps, offline submit and the Persian switch) | [examples/form.steps.json](examples/form.steps.json) | verified (gate pass, `--strict`) |
| Feature probe: open in each target browser | [examples/probe.html](examples/probe.html), [scripts/probe-features.mjs](scripts/probe-features.mjs) | verified in Chrome only |
| Tailwind compiled and inlined, CDN removed | [scripts/tailwind-one-file.mjs](scripts/tailwind-one-file.mjs), fixture [fixtures/tailwind-page.src.html](fixtures/tailwind-page.src.html), test [scripts/test-tailwind.mjs](scripts/test-tailwind.mjs) | verified, Tailwind 4.3.3 |
| Registry fetch with notice and ledger row, plugin refusal | [scripts/registry-fetch.mjs](scripts/registry-fetch.mjs), fixture [fixtures/registry-item.json](fixtures/registry-item.json), test [scripts/test-registry.mjs](scripts/test-registry.mjs) | verified, fixture and two live items |
| React Bits notice template | [references/react-bits-notice.txt](references/react-bits-notice.txt) | text of `LICENSE.md` read 2026-10-24 |
| Browser and Playwright discovery for the tests | [scripts/pw.mjs](scripts/pw.mjs) | verified |

## 5. Quality bars

- Every control reachable and operable by keyboard alone: Escape closes what opened, focus returns to the invoker,
  modal UI traps focus and makes the page inert, arrow keys where the ARIA pattern says so (in the writing direction).
- axe: zero violations on mobile, desktop and dark (the sheet: 0, 35 rules passed).
- Visible focus ring on every stop; targets at least 24 CSS px (44 where the design allows).
- Forced colours: every control keeps an edge; selected and focused states use system colours.
- Reduced motion: state changes kept, movement and size animation gone.
- RTL: placement, arrow keys and logical spacing proven in both directions, not assumed.
- No runtime network: no CDN for Tailwind or any library in an offline deliverable.
- Every lifted, fetched or ported piece has its notice in the file and a valid ledger row
  (`node ${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs check`).
- Each feature used is checked against the target browsers (`probe.html` there) or sits behind a tested fallback.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Escape test passes on one dialog, fails on another; the page behind stays clickable | `show()` instead of `showModal()` | modal UI uses `showModal()` (or `command="show-modal"`) | tested (`sensei-verify` dialog example, and here) |
| 2 | Every later test step fails quietly | a scripted step opened a modal dialog and never closed it; the page was inert | close dialogs between steps or use a fresh page | tested (field log) |
| 3 | Exit fade cut short or never seen | `hidden` set in the same tick as the class removal; a backstop timer shorter than a late `transitionend` (971 ms for a 420 ms fade on a slow frame) | exit on `transitionend`, backstop about twice the duration; for popover and dialog use `allow-discrete` transitions on `display` and `overlay` | tested (field log) |
| 4 | Menu opens in the middle of the screen | a popover is centred by default; anchor positioning missing or not wired | `anchor-name` on the button, `position-anchor` and `position-area` on the popover; `@supports not` fallback | tested (sheet), fallback written not run |
| 5 | In RTL the menu hangs off the wrong edge, or arrows move tabs backwards | physical keywords (`left`, `right`) and physical arrow mapping | logical `position-area` keywords; read `direction` and swap ArrowLeft and ArrowRight in RTL | tested (sheet, both directions) |
| 6 | Screen readers say nothing when a toast appears | the live region was created with the message | the region exists from load; clear, then write about 80 ms later so repeats are announced | tested (field log) |
| 7 | Six invisible focus stops before the content | a bar moved off screen stays in the Tab order and the tree | `inert` plus a delayed `visibility` transition | tested (field log) |
| 8 | Focus lands on `<body>` after an action | the focused control was hidden or `disabled` | move focus deliberately (`focus({ preventScroll: true })`); `aria-disabled` instead of `disabled` on a focused control | tested (field log) |
| 9 | Page shortcuts hijack arrow keys in tabs and sliders | a window-level key listener with no guards | ignore modifiers, `defaultPrevented`, and targets inside inputs and composite widgets | tested (field log) |
| 10 | Controls vanish in Windows high contrast | shape carried by shadow or background only | a real border on every control | tested (UI lane; sheet check 9 of 9) |
| 11 | The page needs the network after "offline" packing | the Tailwind CDN script, or a library's stylesheet by URL | compile and inline (`tailwind-one-file.mjs` removes the CDN script); the gate's offline check | tested |
| 12 | A 1.1 MB stylesheet | raw daisyUI CSS shipped | compile with the Tailwind CLI | measured (UI lane) |
| 13 | Tailwind output contains classes from other files, or misses this page's | automatic source detection scans the working folder | `source(none)` plus one `@source` for the page (the script does this) | tested |
| 14 | The licence guard blocks a write into the plugin | React Bits, Tailwind Plus, Aceternity Pro, Landingfolio or SceneAI code going into a plugin path | keep it in the user project; the plugin carries catalogue, procedure and template | by design (`guard-licence`) |
| 15 | A fetched component has no notice | registry items carry none | `registry-fetch.mjs` adds it; with the shadcn CLI add it by hand | tested (live item) |
| 16 | The notice is only a copyright line | the licence requires the permission notice as well | the full template | read from `LICENSE.md` |
| 17 | Builds drift | registries declare caret ranges | `npm i -E` | tested (two live items) |
| 18 | AGPL code in a closed product | Origin UI outside its two MIT folders | record the folder; copy only MIT folders | reported (UI lane) |
| 19 | "Free" components assumed MIT | Aceternity's free-component licence is not stated | re-implement | reported (UI lane) |
| 20 | A gallery element has no focus ring or fails contrast | uiverse quality is uneven, often checkbox hacks with outlines removed | gate every lifted element | reported, not audited |
| 21 | A copied React component does not run in the page | hidden toolchain: Radix, `motion`, `clsx`, `cva`, Tailwind config | port the behaviour or bundle; prefer native | reported |
| 22 | A tooltip holds the only copy of something important | hover does not exist on touch | put essential text in the page; tooltips describe | reported (general practice) |
| 23 | Hover lift sticks after a tap | `:hover` persists on touch | hover motion only under `(hover: hover) and (pointer: fine)` | tested (field log) |
| 24 | An input named `name` makes `form.name` an element | named controls shadow `HTMLFormElement` properties | read controls through `form.elements`; never name a control `submit`, `action` or `method` | tested (`test-form.mjs`) |
| 25 | A sign-up "succeeds" in an offline file and nothing ever arrives | success text written with no server, or before the answer | offline: say it was saved here and nothing was sent, offer copy, download, `mailto:`; hosted: success only on a 2xx | tested (`test-form.mjs`, both modes) |

More component traps from the field log: [references/native-patterns.md](references/native-patterns.md); library and
licence traps: [references/libraries.md](references/libraries.md); React Bits traps:
[references/react-bits.md](references/react-bits.md).

## 7. Licences

- **Ships in the plugin**: this skill's own code and pages (`components.html`, `probe.html`, every script, the
  fixtures), the catalogue and the notice template (the licence text itself, which is meant to be copied).
- **May be used in projects, never shipped in the plugin**: React Bits (fetch the original into the project, keep the
  full notice; same for its tools and sounds), Tailwind Plus and Aceternity Pro (licence holder, one end product),
  Landingfolio, SceneAI.
- **Lift with notice**: shadcn/ui, Magic UI, daisyUI, Open Props, Pico, uiverse elements (credit the author), Origin
  UI's two MIT folders. Tailwind's compiled CSS keeps its `/*! tailwindcss ... MIT License */` header.
- **Re-implement only**: Aceternity free components (licence unknown), Origin UI's AGPL folders in a closed product.
- Tooling the user installs (never vendored here): tailwindcss and @tailwindcss/cli (MIT), playwright-core
  (Apache-2.0), axe-core (MPL-2.0).

## 8. Verification

Run here (Windows 10, Node 24, installed Chrome with user agent 156 through playwright-core 1.64, axe-core 4.14,
both installed in a scratch work folder, strict `file://`, software GL):

- `test-components.mjs`: 65 of 65 (menu, tooltip, dialog, accordion, tabs, toast, select in LTR and RTL; reduced motion;
  forced colours).
- `sensei-gate.mjs examples/components.html --steps examples/components.steps.json`: PASS, 21 pass, 0 warn, 0 fail;
  axe 0 violations on mobile, desktop and dark; keyboard 11 stops with visible rings; reflow at 320 px; blocked
  storage. The contact sheet was looked at (menu open, dialog open, RTL frame).
- `test-form.mjs`: 40 of 40 (playwright-core 1.64.1, Chrome 156). `verify.mjs examples/form.html --steps
  examples/form.steps.json --strict`: PASS, 21 pass, 0 warn, 0 fail, 33 steps; axe 0 violations on mobile, desktop
  and dark. The contact sheet was looked at (errors, saved, saved in Persian).
- `probe-features.mjs`: every row yes.
- `test-tailwind.mjs` with tailwindcss and @tailwindcss/cli 4.3.3: 11 of 11, and the output page passed the gate (20
  pass, 0 fail).
- `test-registry.mjs`: 12 of 12 with the fixture, the plugin refusal and one live item each run (Aurora, then
  SplitText) fetched into a scratch project outside the plugin and deleted after.

Not verified: Firefox, Safari and phones (open `probe.html` there); screen-reader speech; a real form endpoint and
its CORS answers; real autofill; the script fallbacks for
invoker commands, `interestfor` and anchor positioning (this Chrome has all three, so only the native paths ran);
Tailwind 3; daisyUI compiled through the script; the shadcn CLI route (only the generic fetcher ran); any library's
components other than the registry items fetched.

## 9. Carried by

- Agents: `sensei-art-director` (component look within the direction and tokens), `sensei-interaction-engineer`
  (behaviour and motion of the controls), `sensei-reviewer` with its licence and accessibility lenses (read-only; runs
  the gate and `ledger.mjs check`), every builder agent that adds a control.
- Hooks: `guard-licence.mjs` (PreToolUse: blocks never-ship code written into plugin paths, warns when project code
  from those sources lost its notice); `lint-web.mjs` (PostToolUse: reduced motion per animation system, toasts
  without a live region, network references in an offline deliverable, vendored code without a notice, `transition:
  all`); `gate-claim.mjs` (Stop: a done claim needs a fresh passing gate report).
- Command `/sensei-licences` prints the ledger this skill's procedures fill.
