# The gate's checks, options and report formats

Provenance: ported from the research file domain-verification-harness.md (sections 1 to 4) in the HTML-Sensei build
project, not shipped; the code in `../scripts/` is the reference.

## Every check

| Check id | How | Fails when | Evidence from the research runs |
|---|---|---|---|
| `load` | `goto` and wait for `load`, then `document.fonts.ready`, then `--wait-for` or the page's own `window.__done` / `window.__ready`, then `--settle` ms | the page does not load | all pages |
| `load-readiness` | the wait-for expression, or `__done` / `__ready`, never became true | warns | |
| `console-errors`, `console-warnings`, `page-errors` | console and `pageerror` events | any error or uncaught exception (warnings warn) | bad fixture: errors and an exception caught |
| `request-failures` | `requestfailed`, HTTP 400 and above (favicon ignored) | any failed request | bad fixture: broken image caught |
| `offline-self-contained` | every request that is not `file:`, `data:`, `blob:`, `about:` or the page's own origin is recorded and **aborted**, so the run really is offline | any external request (warns with `--allow-external` or `"offline": false` in the profile) | bad fixture: the CDN script caught |
| `expect-text` | `--expect-text "A|B"` against `document.body.innerText` | a string is missing | |
| `hygiene` | quirks mode, viewport meta, `lang`, title, charset within the first 1024 bytes (file:// has no HTTP charset header), broken images, `alt`, `<main>`, one `<h1>` | warns only | Ultra Bookworm: an 8 `<h1>` warning |
| `weight` | file bytes, `data:` URI bytes by MIME type, the three largest inline scripts (file:// runs only) | **never fails**; warns only when the user set a budget in the profile, and `--strict` never escalates it | Ultra Bookworm: 83.26 MB, 79.58 MB of it data URIs |
| `shot-<w>` | a fresh browser context per width, a scroll pass first (so reveals and lazy media have fired), viewport and full-page PNG, pixel statistics, horizontal overflow | the viewport is one flat colour (overflow warns) | all pages |
| `shot-<w>-full` | full page clipped at 15,000 px, and the report says so | never (info) | |
| `canvas-pixels`, `canvas-motion` | each canvas (up to 8) **isolated**: everything else hidden, a magenta sentinel behind it, two screenshots 450 ms apart; colours, spread, frame difference | a visible canvas is blank or transparent only | bad fixture: a WebGL canvas that never draws; good fixture: content and motion |
| `motion-present`, `expect-motion` | running and infinite animations, playing video, pixel change over 700 ms | `--expect-motion` fails a page where nothing moves | |
| `reduced-motion` | a second context with `reducedMotion: 'reduce'`: infinite animations, playing videos, pixel change over 700 ms | warns when something still moves; says "inconclusive" when the normal run is static too | bad fixture's spinner warned |
| `smooth-scroll-root` | `html { scroll-behavior: smooth }` | warns | |
| `forced-colors` | a context with `forcedColors: 'active'`; controls with neither a border of 1 px or more nor an outline | warns (shapeless controls) | bad fixture: a button shaped only by `box-shadow` |
| `dark-scheme` | a context with `colorScheme: 'dark'`, screenshot | never (compare by eye) | |
| `axe-mobile`, `axe-desktop`, `axe-dark` | axe-core injected from a local file, tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa best-practice`, reduced motion on, after a scroll pass; ARIA tree written as `*-aria-tree.yml` | any serious or critical violation (others warn); `skip` with the install command when axe-core is absent | a finished landing page: one real serious violation; bad fixture: 6 |
| `keyboard` | Tab up to 80 times: traps, invisible stops, unnamed stops, `tabindex` above 0, large backward jumps, cycling, skip link first; focus-ring pixel test on up to 25 stops; pointer-only controls | warns | no-ring fixture caught while axe passed it |
| `target-size` | controls under 24 CSS px (WCAG 2.2 AA; 44 is platform advice) | warns | |
| `reflow-400pc`, `reflow-200pc` | 320 px and 640 px wide viewports (400 and 200 per cent zoom on a 1280 px screen), overflow offenders listed | warns | bad fixture's 900 px block |
| `text-spacing` | the WCAG 1.4.12 overrides injected at 320 px; elements that start clipping | warns | |
| `blocked-storage` | `localStorage`, `sessionStorage`, `indexedDB` getters throw `SecurityError` before the page runs | warns on errors or an empty page | |
| `performance` | frame sampler from first paint, long tasks, long animation frames, CLS, LCP, slow events, CDP counters; 2.5 s idle and 3 s scroll samples | never fails; warns on CLS over 0.1, a load task over 300 ms, p95 frame over 50 ms; always states software GL | see `performance.md` |
| `route-*` | `--routes`: `#hash`, `?query`, `click:<selector>` or a path, run in order on one page (each route starts from the state the previous one left); screenshot, blank test, new-error test | any new error or a blank route | |
| `step-*`, `steps`, `steps-errors` | `--steps file.json`: `click`, `fill`, `press`, `hover`, `wait`, `shot`, `eval` (with `expect`), `text` (with `has`). Steps start from a fresh load of the target in a new browser context, after the routes, so a route that switched the language, the theme or stored state cannot change what the steps see; `--steps-after-routes` makes them continue on the page the last route left instead. The `steps` detail says which start was used | a failed step or assertion, an unknown `do`, or an uncaught exception during routes and steps | `../examples/dialog.steps.json`; `../fixtures/steps-fresh.json` (test-gate section 8) |
| `file-vs-http` | with `--mode both`, every check runs over both protocols; any status difference fails | | good fixture: agree |
| `contact-sheet` | every screenshot (widths, forced colours, dark, reduced motion, zoom, routes, steps) in one labelled image | never: look at it | |

## Options

`node scripts/sensei-gate.mjs --help` prints the full list from the file header. The ones that matter most:

| Option | Use |
|---|---|
| `--checks load,net,canvas` | the quick subset after a big edit of a 3D or shader page |
| `--mode both` | anything that will be hosted and also emailed or double-clicked |
| `--steps file.json` | component behaviour (dialogs, menus, tabs, sliders, quiz flows) that a Tab walk cannot prove; a missing or malformed file exits 2 |
| `--steps-after-routes` | steps continue from the last route's state (default: a fresh load of the target). To script a flow that needs a state, prefer putting that state in the steps themselves (`click` the language button as step 1), which keeps each file self-contained |
| `--strict` | a release: warnings fail (weight never does) |
| `--routes "#/a,click:#menu"` | states beyond the first screen |
| `--wait-for "window.app && app.ready"` | a page that becomes ready later than `load` |
| `--gpu` | a machine with a real GPU; only then do frame rates mean anything |
| `--lenient-file` | reproduce a dev server only; it hides the most common single-file failure |
| `--project DIR`, `--name ID` | where the Stop hook will look, and the report's name |

An unknown option, or an option with no value, exits 2 and runs nothing, in both the page gate and the umbrella
(the one list is `../scripts/lib/gate-options.mjs`).

**The umbrella forwards every page-gate option.** `verify.mjs page.html --steps flows.json --routes "?lang=fa"
--strict` passes those three to the page gate; `--` before them is accepted but no longer needed. The umbrella's own
options are `--project`, `--name`, `--only`, `--film`, `--expect`, `--quick`, `--audio`, `--dry-run`; `--quick` and
`--checks` together are refused. The run header prints `page-gate options: ...` and the combined report stores them as
`page_options`, so a report shows which options it ran with. (Before this, the umbrella read `--steps` as its own
option, dropped it, and wrote a PASS with no steps run: QC finding 1, now tested in test-gate section 7.)

## Report formats

**Hook report**, `<project>/.sensei/gate/<name>.json`, written through the plugin's `lib/gate.mjs`
(`writeGateReport`), the file the Stop hook `gate-claim.mjs` reads (`latestGateReport` takes the newest `*.json` in
that folder by file time and blocks a "done" claim when it failed or is older than the last edit):

```json
{ "gate": "page-html", "target": "C:/.../page.html", "at": "2026-10-24T...", "verdict": "pass | warn | fail",
  "checks": [ { "id": "axe-desktop", "status": "pass | fail | warn | skip | not-verified", "detail": "..." } ],
  "verified": ["load: opened in 866 ms (file)", "..."],
  "not_verified": ["performance: Software GL: yes, ...", "What a screen reader actually says ...", "..."],
  "tool": { "name": "sensei-gate", "schema": 2 }, "kind": "file", "freshness": { "sha256": "...", "newestSourceMtimeMs": 0 },
  "counts": { "pass": 22, "warn": 0, "fail": 0, "info": 6 }, "failing": [], "browser": { "softwareGL": true, "strictFile": true },
  "profile": { "found": true, "offline": true, "budget": null }, "artefactsDir": "...", "reportPath": ".../report.json",
  "contactSheet": ".../page-html-contact-sheet.png" }
```

Status mapping: the gate's `info` results (weight, software-GL frame rates, a screenshot to compare by eye, an
inconclusive reduced-motion comparison, the contact sheet) become `not-verified`, never `pass`: they were measured, not
judged. Verdict: `fail` if any check fails, `warn` if any warns, else `pass`; `--strict` turns warnings into a fail,
except `weight`.

**Full report**, `<project>/.sensei/gate/<name>/report.json` and `report.md`: `{ tool, target, kind, startedAt,
finishedAt, durationMs, node, platform, browser: {path, source, version, softwareGL, strictFile}, playwright, modes,
widths, checks, project, profile, freshness, verdict, counts, results: [{id, status, summary, data}], artefacts:
[{kind, file}], notChecked: [...] }`. The `data` field holds the detail: axe violations with targets, the focus stop
list, overflow offenders, frame statistics, CDP counters.

**Combined report** (`scripts/verify.mjs`), `<project>/.sensei/gate/verify-<name>.json`: one check per gate run
(`page`, `3d`, `film-page`, `determinism`, `film-video`, `contact-sheet`), each with the gate's own report path; the
`verified` and `not_verified` lists merged; `page_options` (what was forwarded to the page gate); written last so the
Stop hook reads it.

## The per-domain gates the umbrella calls

| Gate | Lives in | Runs when | Its own report |
|---|---|---|---|
| `gate3d.mjs`: lint, load, network, frames at two times, motion, reduced motion still, context loss round trip | `sensei-3d/scripts/` | the page uses WebGL and the seek contract (`window.__seek`, `?t=`) | `.sensei/gate/gate3d-<name>.json` |
| `film-gates.mjs --page`: G5, no interface chrome in a film frame | `sensei-motion-graphics/scripts/` | a seek page with a duration (`__meta`, `DURATION`) and no WebGL | JSON beside the artefacts |
| `render.mjs --probe`: determinism hash in order and out of order | `sensei-video-pipeline/scripts/` | the same film page | stdout |
| `film-gates.mjs --video`: G0 plays and moves, G2 no flat run over 3 frames, G3 end hold | `sensei-motion-graphics/scripts/` | an MP4 target or `--film` | JSON beside the artefacts |
| `sheet.mjs`: contact sheet of the master | `sensei-video-pipeline/scripts/` | an MP4 target or `--film` | the image (the Stop hook's film rule looks for it) |

File access: every gate runs strict `file://` by default (no `--allow-file-access-from-files`), as a double-click
opens the page: `sensei-gate.mjs`, `gate3d.mjs` (through `sensei-3d/scripts/browser.mjs`) and `film-gates.mjs --page`.
Each takes `--lenient-file` for unpacked work in progress; a pass under that flag does not prove the double-click
case. The film renderer (`sensei-video-pipeline/scripts/cdp.mjs`) keeps the flag because it renders source projects
that load sibling files; it certifies nothing, the gates do. (Coordinator change, 2026-10-25: all 14 3D, hologram
and shader example pages and the film gate's suite were rerun strict and pass.)
