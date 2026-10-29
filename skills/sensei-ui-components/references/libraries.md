# Component libraries: licences, what may be lifted, single-file routes

Licences were read from each repository's raw licence file on 2026-10-18 and 2026-10-19 (UI research lane), and
React Bits' `LICENSE.md` again on 2026-10-24 while writing this skill. Where only a vendor page or a search summary
was reachable, the row says so. This is engineering practice, not legal advice: read the licence file at the version
you copy, and record it in the ledger.

## The table

| Source | What it is | Licence (evidence) | Into a project | Into the plugin | Single-file route |
|---|---|---|---|---|---|
| Native platform (`popover`, `<dialog>`, `<details>`, anchor positioning, `base-select`, invoker commands) | the browser | none needed | yes | yes (our own code) | nothing to bundle; `examples/components.html` |
| shadcn/ui | React components on Radix and Tailwind, copied into your repo by a CLI | MIT, "Copyright (c) 2023 shadcn" (raw `LICENSE.md` read) | yes, with notice | our own re-implementations only | React, Radix and Tailwind do not lift into vanilla HTML: take the decisions (tokens, spacing, states, ARIA patterns) and re-implement |
| Magic UI | animated React components (marquees, beams, text effects, bento) | MIT, "Copyright (c) Magic UI" (raw `LICENSE.md` read). Paid pro templates exist: not examined, assume a separate commercial licence | yes, with notice | our own re-implementations only | needs React, Tailwind and often `motion`: port the CSS and the small idea |
| Origin UI (now "coss.com/ui") | large shadcn-style set | **mixed**: MIT for `apps/origin/` and `apps/ui/`, **AGPL-3.0 for every other directory** (repo page read through a fetch tool). Described as a legacy snapshot | only from the two MIT folders, and record the folder | never | React plus Tailwind |
| daisyUI | Tailwind plugin of component classes and themes | MIT, "Copyright (c) 2020 Pouya Saadeghi" (raw `LICENSE` read) | yes, compiled | no | must be compiled: the raw `daisyui.css` is 1,142,434 bytes (98 KB gzip); compile with the Tailwind CLI and inline the output |
| Open Props | design tokens as custom properties (colours, sizes, easings, shadows, animations) | MIT, "Copyright (c) 2021 Adam Argyle" (raw `LICENSE` read) | yes, with notice | no (users install it) | best fit: `open-props.min.css` is plain CSS, 7.6 KB gzip, no build; inline it or copy only the tokens used (animations 3.4 KB, borders 1.3 KB, buttons 9.2 KB minified) |
| Pico CSS | class-light semantic framework | MIT, "Copyright (c) 2019-2024 Pico" (raw `LICENSE.md` read) | yes, with notice | no | `pico.min.css` 83,319 bytes (11.6 KB gzip), classless 71,040 bytes; has `[dir=rtl]` rules for date, select and search inputs; one file per colour theme, ship one |
| uiverse.io | community gallery of CSS and Tailwind elements | MIT, "Copyright (c) 2023 Uiverse.io" (the `uiverse-io/galaxy` raw `LICENSE`); the README asks for credit (search summary). Repo last pushed 2024-09-02 | yes, with notice and the author's credit | no | CSS-only elements paste into one file; quality and accessibility uneven and not audited: run the gate on each |
| React Bits | animated React components, text effects, backgrounds, micro-interactions | **MIT plus Commons Clause**, "Copyright (c) 2026 David Haz" (raw `LICENSE.md` read 2026-10-24): use, copy, modify and port as part of an application, website or product, commercial included; **never sell, sublicense or redistribute the components themselves, alone, in a bundle or as a ported version** | **yes: fetch the real code into the project, keep the notice** (owner, ADDITIONS §9.4) | **never** (the licence guard blocks it) | React and a bundler; see [react-bits.md](react-bits.md) for the fetch-and-port procedure |
| Tailwind Plus (formerly Tailwind UI) | paid components and templates | official licence page reached only through a search summary (the page gave a login screen): end products may be unlimited and sold; **no redistribution of components, templates or derivatives separately from an end product, in code or as design assets; no UI kits, themes or page builders** | yes, for one end product, by a licence holder | **never** | a page built for one client is an end product. Never store Tailwind Plus markup in plugin files or a shared template |
| Aceternity UI | animated React components | the only licence page found is the Pro licence: unlimited end products for you or clients, modification allowed; **no redistributing the item or its source, no marketplaces, no derivative templates to sell**. The free components' licence was **not established** (a GitHub repository showed no licence file) | Pro items: in one end product by a licence holder. Free items: treat as all rights reserved, re-implement | **never** | re-implement the visual idea from scratch |

Versions installed by the lane for measurement: daisyui 5.7.50, open-props 1.7.23, @picocss/pico 2.1.1,
tailwindcss 4.3.3. This skill's Tailwind script was run with tailwindcss and @tailwindcss/cli 4.3.3.

## Lift, re-implement, never ship

1. **Liftable with the notice**: MIT sources (shadcn/ui, Magic UI, daisyUI, Open Props, Pico, uiverse elements,
   Origin's two MIT folders). In vanilla pages the liftable part is usually the CSS or token values, not the React.
   Keep the copyright and permission notice: a `/*! ... */` comment survives minification; add a ledger row.
2. **Use in the project, never in the plugin**: React Bits (fetch the original, keep its notice), Tailwind Plus and
   Aceternity Pro (licence holder, one end product). The plugin holds only the catalogue and the procedure.
3. **Re-implement, do not copy**: Aceternity free components (licence unknown), anything AGPL in a product that will
   not be released under the AGPL, Landingfolio and SceneAI content, Kombai output. View the reference, write the
   effect from `sensei-landing-hero` and `sensei-direction` recipes, record in the ledger that it is original.
4. **Mixed-licence repositories**: record the directory, not only the repository.

## Which base for which deliverable

| Deliverable | Take | Avoid |
|---|---|---|
| Landing page | own tokens (`sensei-tokens-theming`, Open Props optional) plus native components | pasting a gallery hero verbatim |
| Course | Pico classless or an own base for forms; native dialog and details; own theme tokens | a React stack for a single file |
| Presentation | own CSS | libraries |
| Game | own CSS; uiverse-style buttons as visual references | library focus handling that blocks the keyboard |
| Dashboard | daisyUI or shadcn patterns as design references; compiled Tailwind if the team already uses it | a runtime CDN |
| Existing React and Tailwind project | shadcn/ui and Magic UI directly (MIT); React Bits fetched with its notice | Tailwind Plus in reusable or shared parts |

## Ledger rows

Every lifted or fetched piece gets a row in `.sensei/licences.json` (format in the plugin's `lib/ledger.mjs`;
`node ${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs check` validates it):

```json
{ "id": "open-props", "name": "Open Props", "url": "https://github.com/argyleink/open-props",
  "licence": "MIT", "use": "vendored", "files": ["src/vendor/open-props.min.css"], "notice": "header",
  "attribution": null, "ships_in_plugin": false, "added": "2026-10-24", "note": "version 1.7.23, tokens only" }
```

`use` is `vendored`, `ported`, `fetched`, `idea` or `asset`; a copied piece without a `notice` fails the check.

## Traps (licence and library)

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | "Free to copy" taken as a licence | a gallery page is not a licence file | find the licence file; none means all rights reserved | reported (Aceternity) |
| 2 | AGPL code in a product | the repository's top-level licence differs per directory | record the directory; copy only from MIT folders | reported (Origin UI) |
| 3 | A React Bits port shipped in a template or plugin | MIT plus Commons Clause is not MIT | fetch into the project only, notice kept | read from `LICENSE.md` |
| 4 | Tailwind Plus markup in a shared file | redistribution outside one end product | keep it inside the client's project | reported (licence summary) |
| 5 | A copied React component will not run | it hides a toolchain: Tailwind config, Radix, `motion`, `clsx`, `cva` | port the behaviour too, or build the page with a bundler | reported |
| 6 | A uiverse element has no focus ring | checkbox hacks with the outline removed | gate it (`sensei-verify`), restore the ring | reported, not audited |
| 7 | A 1.1 MB stylesheet | raw daisyUI | compile with the Tailwind CLI | measured |
| 8 | Every Pico colour shipped | one file per colour theme | ship one | measured |
| 9 | "shadcn-like" code from a model reproduces licensed text | generated code can echo its training sources | treat it like any copy: check, note, ledger | reported |
| 10 | Mixed-direction form fields misaligned | the library has no `[dir=rtl]` rules | Pico has some; others need your own, tested in RTL | measured (rules counted in Pico) |
