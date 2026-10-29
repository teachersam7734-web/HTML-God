---
name: sensei-dataviz
description: Dashboards, charts and big tables in HTML, offline in one file. Choosing the chart form from the question, choosing a library (none, Chart.js, ECharts, uPlot, D3, Observable Plot, Vega-Lite, deck.gl) and inlining it with its data, a palette validator for contrast and colour blindness (light and dark), responsive charts that follow their container, animated updates that never start from zero and stop for reduced motion, a million points, a 100,000-row windowed table, text alternatives and a show-as-table switch, and maps with their tile licences. Use when someone says dashboard, chart, graph, plot, data visualisation, dataviz, KPI, stat tile, sparkline, bar chart, line chart, pie chart, heatmap, scatter, map, choropleth, colour palette for charts, colour-blind safe, Chart.js, ECharts, D3, Observable Plot, Vega-Lite, uPlot, deck.gl, big table, data grid, 100,000 rows, or make this data readable.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-dataviz

A dashboard answers a few recurring questions at a glance and lets the reader check the numbers. The HTML part is
choosing the form and the library, shipping both with the data in one offline file, drawing correctly at any width,
moving between data states without lying, colours that survive contrast and colour blindness, very many rows, and
text alternatives. Doctrine first: best quality is the default, no page-weight budget unless the user asks (sizes
below are information), never downgrade for this machine, and say what was not verified. Frame rates here are
software GL; nothing was measured on the target device.

## 1. When to use

Any chart, headline number, sparkline, dashboard, data table or map in a page, deck, course or game HUD.

| The job is | Skill |
|---|---|
| Charts on slides | `sensei-presentations` (this skill draws them) |
| Scores and progress in a course | `sensei-courses` |
| Live telemetry in a game loop | `sensei-games` (uPlot from here for the stream) |
| Colour tokens and contrast of text and surfaces | `sensei-tokens-theming` |
| Scroll-driven chart stories | `sensei-scroll` |
| Packing libraries and data into one file | `sensei-single-file` |
| Motion craft of chart transitions in a film | `sensei-motion-graphics`, `sensei-video-pipeline` |
| Proving it | `sensei-verify` |

## 2. Decision table

| Choice | Pick | What decides it |
|---|---|---|
| Form | the form table in [references/forms-and-palettes.md](references/forms-and-palettes.md) | the question: compare, change over time, distribution, relationship, part of a whole, geography, one number |
| Library | none (own SVG) | a few charts that are part of the design (`examples/dashboard.html`) |
| | Chart.js (MIT) | standard business charts |
| | ECharts (Apache-2.0) | types Chart.js lacks; built-in description and decal patterns |
| | uPlot (MIT) | tens of thousands of points or more per series |
| | D3 (ISC) | the chart is a designed object |
| | Observable Plot (ISC), Vega-Lite (BSD-3-Clause) | an analyst or an agent writes a specification and wants good defaults |
| | deck.gl (MIT) | a hundred thousand map points or more (WebGL2) |
| Renderer | SVG | up to a few thousand marks; crisp, inspectable |
| | canvas or WebGL | tens of thousands and more |
| Data in the file | `<script type="application/json">`, parsed on demand | always; a typed array as base64 for very large numeric data |
| Palette | two palettes, light and dark, each passing `palette-check.mjs` | always; never a library default unchecked |
| Second channel | direct labels, dashes, shapes, decals | always: colour is never the only channel |
| Tables | a plain `<table>` | up to a few thousand rows |
| | windowed (`examples/table.html`) | tens of thousands and more; add search |
| | DuckDB-Wasm | millions of rows that must be queried (not run here) |
| Maps | deck.gl or MapLibre with a local tile pack, or no base map | offline; tiles have their own terms |

## 3. Core technique

### 3.1 The chart answers a question

Title it with the finding ("North leads with 365 units, 104 more than West"), label lines at their ends and bars at
their tips, give units, source and date, start bars at zero, prefer sorted horizontal bars to pies, and keep a
"Show as tables" switch next to the charts. The full form table and rules:
[references/forms-and-palettes.md](references/forms-and-palettes.md).

### 3.2 One offline file

```html
<script type="application/json" id="data">{"months":["Jan","Feb"],"units":{"North":[52,58]}}</script>
<script>var D = JSON.parse(document.getElementById('data').textContent);</script>
<script>/* chart.js 4.6.1, MIT: inlined from the project's node_modules; keep this notice */ ...</script>
```

Write `<` inside the JSON as `<`; escape `</script` and `<!--` inside inlined libraries; name each library, its
version and licence in a comment and in the ledger. `node scripts/build-dash.mjs out/` writes a tested starting page
per library from the project's own `node_modules`. Measured behaviour, versions, licences:
[references/libraries.md](references/libraries.md).

### 3.3 Colour that passes

```
node scripts/palette-check.mjs "#0072B2,#D55E00,#009E73" --bg "#ffffff"      # PASS: 5.19, 3.87, 3.42; deutan 20.5
node scripts/palette-check.mjs "#56B4E9,#E69F00,#009E73" --bg "#12161c"      # PASS in dark: 7.86, 8.06, 5.3
node scripts/palette-check.mjs "#440154,#3b528b,#21918c,#5ec962,#fde725" --sequential
```

Each colour 3:1 against its background (WCAG 1.4.11), every pair at least 8 apart in CIEDE2000 under normal vision
and simulated protan, deutan and tritan (8 is a heuristic; `--min-delta` sets the project's own), sequential ramps
monotonic in lightness. Light and dark are separate palettes, switched with `prefers-color-scheme` or the theme, and
the test reads the colours from the live page in both. Two famous defaults fail: Okabe-Ito's orange and sky blue on
white, and Tableau 10 under deutan.

### 3.4 Follow the container, change the density

```js
new ResizeObserver(() => chart.resize()).observe(container);   // ECharts; uPlot: u.setSize(); own SVG: redraw
```

Chart.js: `responsive: true, maintainAspectRatio: false` inside a parent with a height. When narrow: fewer ticks,
legends below, labels thinned; card grids with `minmax(min(100%, 20rem), 1fr)` so nothing scrolls sideways at 320 px.

### 3.5 Move between states honestly

```js
var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;     // the libraries do not read it for you
new Chart(el, { ..., options: { animation: RM ? false : { duration: 900 } } });
chart.setOption({ animation: !RM, animationDurationUpdate: 900, ... });          // ECharts
bars.transition().duration(RM ? 0 : 800)                                         // D3
rect.style.width = newWidth + 'px';  /* own SVG: a CSS property transitions; an attribute change does not */
```

From the old value to the new, never from zero on an update; grow from zero once, on arrival; keep the axis stable or
move it too.

### 3.6 Big data

uPlot with typed arrays for a million points (first draw about 10 ms here, information only); deck.gl for hundreds of
thousands of map points; a windowed table for 100,000 rows: fixed row height, a spacer of `N * rowHeight`, only the
visible rows plus a buffer rendered on a frame-coalesced scroll, `role="table"` with `aria-rowcount` and
`aria-rowindex`, `aria-sort` on header buttons, and a search box because the browser's find cannot see unrendered rows
(`examples/table.html`).

### 3.7 Text alternatives

Own SVG: `role="img"` and a label that states the values, a finding sentence, and the tables switch. Chart.js: a label
on the canvas plus a hidden table. ECharts: `aria: { enabled: true, decal: { show: true }, data: { maxCount: N } }`
with N above the item count. Vega-Lite: built in. D3: focusable, labelled marks. Plot: add `role="group"` to its
labelled `<g>` elements. Detail: [references/forms-and-palettes.md](references/forms-and-palettes.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| A library-free dashboard: headline numbers, sorted bars, a line chart, tables switch, two palettes, resize, reduced motion | [examples/dashboard.html](examples/dashboard.html), gate steps [examples/dashboard.steps.json](examples/dashboard.steps.json) | verified |
| 100,000 rows: windowed, sortable, searchable, ARIA table | [examples/table.html](examples/table.html), gate steps [examples/table.steps.json](examples/table.steps.json) | verified |
| Palette validator (contrast, colour-blind distance, sequential lightness) | [scripts/palette-check.mjs](scripts/palette-check.mjs) | verified |
| One offline page per library (Chart.js, ECharts, uPlot, D3, Plot, Vega-Lite, deck.gl) | [scripts/build-dash.mjs](scripts/build-dash.mjs) | verified |
| Self-tests | [scripts/test-palettes.mjs](scripts/test-palettes.mjs) (15), [scripts/test-dash.mjs](scripts/test-dash.mjs) (49); discovery [scripts/pw.mjs](scripts/pw.mjs) | verified |

## 5. Quality bars

- Pixels painted, not only "no error" (canvas ink, screenshot colour counts for WebGL).
- Every palette passes `palette-check.mjs` against its own background, in light and dark, read from the live page.
- Colour is never the only channel; every chart has a finding title, units, source and a table to check it.
- Charts follow their container; no horizontal scroll at 320 px; fewer ticks when narrow.
- Updates animate from the old values; under reduced motion every update is a cut and nothing grows on arrival.
- axe-core with every rule: no violations, in light, dark, narrow and with the tables shown.
- No request at run time; each inlined library named with its version and licence, and in the ledger.
- Big data: a million points drawn, the end of a 100,000-row table reachable with the right `aria-rowindex`.
- `sensei-verify`'s gate passes in strict `file://` with a steps file; the contact sheet looked at.
- Human bars no test proves: the chart answers the question asked, and nothing in it misleads.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | "Colour-blind safe" chart fails contrast | Okabe-Ito is distance-safe, not contrast-safe: orange 2.25:1, sky blue 2.31:1, yellow 1.32:1 on white | run the validator per background; use its darker members on white, or a dark background (yellow 13.72:1 on `#12161c`) | tested |
| 2 | Red and green series merge for many viewers | Tableau 10 collapses under deutan (0.7) and protan (1.3); five of its colours are under 3:1 on white (the research said four) | never a default unchecked; the validator | tested |
| 3 | A plain red, green, blue default reads fine to its author | 48.6 apart for normal vision, 4.8 under deutan | the validator, and a second channel | tested |
| 4 | axe reports `aria-prohibited-attr` on an Observable Plot chart | Plot writes `aria-label` on `<g>` elements with no role | add `role="group"` to them after render | tested |
| 5 | The ECharts description stops after ten items ("first 10 items") | `aria.data.maxCount` defaults to ten | raise it above the item count; it lists all twelve here | tested |
| 6 | Charts keep animating for reduced-motion users | Chart.js and ECharts ignore `prefers-reduced-motion` | `animation: false` from `matchMedia` before the first draw | tested |
| 7 | A Chart.js chart is 0 px tall | `maintainAspectRatio: false` inside a parent with no height | give the parent a height | reported (research) |
| 8 | An ECharts or uPlot chart overflows or stays small | neither follows its container by itself; `window.resize` misses container changes | `ResizeObserver` calling `resize()` or `setSize()` | tested |
| 9 | Bars "grow" from zero on every update or every resize | the transition starts from zero, or a redraw replays the entrance | animate from the old values; grow once, on arrival | tested (the example) |
| 10 | An SVG bar jumps instead of easing | the width was set as an attribute, which does not transition | set `style.width` (a CSS geometry property) with a CSS transition | found while writing the example |
| 11 | A card grid scrolls sideways at 320 px | `minmax(20rem, 1fr)` with padding is wider than the screen | `minmax(min(100%, 20rem), 1fr)` | found by the gate on the example |
| 12 | Sort buttons vanish in forced colours | a borderless button has no shape there | a `forced-colors` border | found by the gate on the table example |
| 13 | Browser find does not find a row; print shows twenty rows | a windowed table renders only what is visible | a search box and an export; print all only when small | tested (search) |
| 14 | A tab's charts never finish animating in a test | a desktop pane or extension tab reports `visibilityState: hidden`, so frames stop | test headless; never let frames carry a result | tested (field log) |
| 15 | A dual-axis chart suggests a correlation | two scales chosen to align | one axis, or two small charts | reported |
| 16 | A bar chart exaggerates a small change | a truncated bar axis (`beginAtZero: false`) | bars from zero; lines may start elsewhere | reported |
| 17 | Tens of thousands of SVG nodes paint slowly | SVG per mark | canvas (Chart.js, ECharts canvas, uPlot) or aggregate | reported |
| 18 | Load is slow with big inline data | a JavaScript literal is parsed with the script | `<script type="application/json">` parsed on demand, or a base64 typed array | reported |
| 19 | An inlined library ends the page's script early | a literal `</script` or `<!--` inside it | escape both (`build-dash.mjs`) | tested |
| 20 | A map is blank offline, or breaks the tile provider's terms | tiles come from a server; OpenStreetMap forbids bulk or offline use and requires attribution | a local tile pack with its own licence, or no base map; a static image where WebGL2 is missing | reported |
| 21 | deck.gl or MapLibre shows nothing on some devices | they need WebGL2 | a static fallback image | reported |
| 22 | A library's licence obligations missed | ECharts is Apache-2.0 (keep its NOTICE); D3 and Plot ISC, Vega BSD-3 keep their notices; AG Grid and MapLibre are not single-licence repositories | a ledger row per library, the notice comment in the page | reported (licences read from npm) |

## 7. Licences

| Piece | Licence | Use |
|---|---|---|
| `palette-check.mjs`, `build-dash.mjs`, the tests, `dashboard.html`, `table.html` | HTML-Sensei's own code | ship in the plugin and in projects |
| Chart.js, uPlot, deck.gl | MIT | inlined into a project with the notice comment; never vendored in the plugin |
| ECharts | Apache-2.0 | the same, and keep its NOTICE file's text with a redistributed page |
| D3, Observable Plot | ISC | the same |
| Vega, Vega-Lite, vega-embed | BSD-3-Clause | the same |
| axe-core, playwright-core | MPL-2.0, Apache-2.0 | test tools the user installs |
| Map tiles | the provider's terms | read before use; OpenStreetMap: attribution, no bulk or offline use of its servers |
| Okabe-Ito, Viridis, Tableau 10 colour values | published palettes, colour values only | used as test inputs here |

## 8. Verification

Run here (Windows 10, Node 24, playwright-core 1.62.1 with installed Chrome 155, software GL, axe-core 4.14.0, strict
`file://`; chart.js 4.6.1, echarts 6.1.0, uplot 1.6.32, d3 7.9.0, @observablehq/plot 0.6.17, vega 6.4.0, vega-lite
6.5.0, vega-embed 7.3.0, deck.gl 9.4.0 from npm): `test-palettes.mjs` 15 of 15, `test-dash.mjs` 49 of 49.
`sensei-verify`'s gate on `examples/dashboard.html` and `examples/table.html` with their steps files: verdict pass
for both (21 checks each), after fixing the two findings it raised (trap 11 and trap 12); the contact sheets were
looked at.

Not verified: Firefox and Safari rendering; real GPUs and frame rates (the owner's target device differs from this
machine); touch interaction with charts; screen-reader speech; MapLibre, Leaflet, Perspective, AG Grid, TanStack
Table and DuckDB-Wasm (not run); a map with tiles; colour-vision results with real viewers (the simulation is a model).

## 9. Carried by

- Agent `sensei-dataviz-engineer`: from a dataset and the questions, chooses forms and a library, builds the page
  offline, passes the palette check in both schemes, adds the tables switch, runs `test-dash.mjs`-style checks and the
  gate, and reports pixel evidence rather than "it rendered".
- Agent `sensei-reviewer`: the design lens (does each chart answer its question, does anything mislead) and the
  accessibility lens; never edits.
- Hooks: `lint-web.mjs` (reduced motion per animation system, network references when offline, vendored code without
  a notice); `lint-3d.mjs` (WebGL rules for deck.gl pages); `guard-licence.mjs`; `gate-claim.mjs`; `keep-eol.mjs`;
  `probe.mjs`.
