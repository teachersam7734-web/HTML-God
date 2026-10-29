# Chart form, colour, motion, big data and text alternatives

Sources: `domain-dashboards-dataviz.md` in the HTML-Sensei build project's research notes (not shipped) sections 3.2 to 3.7 and 6; this skill's
`palette-check.mjs`, `test-palettes.mjs` and `test-dash.mjs`, run on 2026-10-27.

## The question first, then the form

| Question | Form | Avoid |
|---|---|---|
| Compare a few categories | horizontal bars sorted by value; long labels read well | a pie with more than four slices; 3D |
| Change over time | a line (up to about five series); an area only for one series or stacked parts of a whole | dual axes unless clearly labelled |
| Distribution | histogram, box or violin, a jittered strip | a bar of averages alone |
| Two measures | scatter; a trend line only if it is justified | bubble size for precise values |
| Part of a whole | a stacked bar on a shared baseline; a treemap for a hierarchy | a donut for precise comparison |
| Many points in time | uPlot or a downsampled line | a million SVG nodes |
| Geography | a choropleth of rates; points for events | a choropleth of raw counts |
| One headline number | the number, its change in words, a sparkline | a gauge |

Every chart gets: a title that states the finding ("North leads with 365 units"), direct labels where they fit (the
legend is a lookup), units, the source and date, bars from zero (lines may start elsewhere), no truncated bar axes.

## The palette method (`scripts/palette-check.mjs`)

1. Choose candidate colours per background (light and dark are two palettes, not one).
2. `node palette-check.mjs "#a,#b,#c" --bg "#ffffff"`: every colour at 3:1 or more against the background (WCAG
   1.4.11, graphical objects), and every pair at least the distance bar apart in CIEDE2000 under normal vision and
   simulated protan, deutan and tritan (Machado and others 2009, severity 1.0, applied in linear RGB). The distance bar
   is 8 by default: a working heuristic for "tell apart without a legend lookup", not a standard; `--min-delta` states
   the project's own.
3. Sequential ramps: `--sequential` checks that CIE L* changes monotonically with a span of 40 or more.
4. Pair colour with a second channel anyway: direct labels, dashes, shapes, decal patterns.
5. Test the colours actually in the page, in both schemes (`test-dash.mjs` reads them from the live page).

Measured here:

| Palette | Result |
|---|---|
| Okabe-Ito, first six, on white | colour-blind distances 22.2, 12.3, 12.5, 11.1 (normal, protan, deutan, tritan): safe; but orange `#E69F00` 2.25:1 and sky blue `#56B4E9` 2.31:1 fail 3:1 on white. Yellow `#F0E442` is 1.32:1 on white and 13.72:1 on `#12161c` |
| Tableau 10 on white | deutan 0.7 (`#e15759` against `#59a14f`), protan 1.3, tritan 7.0; five colours under 3:1 (2.42, 2.29, 1.61, 1.98, 2.12). Not a default for a public dashboard |
| Red, green, blue default | red and green 48.6 apart for normal vision, 4.8 under deutan: the classic failure, caught |
| `#0072B2, #D55E00, #009E73` on white | contrast 5.19, 3.87, 3.42; distances 38.4, 18.2, 20.5, 12.1: pass (this skill's light palette) |
| `#56B4E9, #E69F00, #009E73` on `#12161c` | contrast 7.86, 8.06, 5.3; distances 34.7, 17.9, 26.6, 12.2: pass (the dark palette) |
| `#0072B2, #D55E00, #009E73` on `#12161c` | passes too (3.5, 4.69, 5.3), with less margin for blue |
| Viridis, five steps | L* 15, 36, 55, 73, 91: monotonic, span 76 |
| A jet-style rainbow | L* 32, 91, 88, 97, 53: not monotonic |

The validator's references: 21:1 black on white, 4.54:1 for `#767676` on white, and the published CIEDE2000 test pair
of Sharma, Wu and Dalal (2.0425), all reproduced by `test-palettes.mjs`. The simulation is a model of colour-vision
deficiency, not a substitute for asking people.

## Responsive and density

The chart follows its container, not the window: a sidebar or a grid change resizes a chart without a window resize,
so use a `ResizeObserver` (ECharts `resize()`, uPlot `setSize()`, own SVG: redraw). Chart.js needs a parent with a
height for `maintainAspectRatio: false`, or it collapses to 0. D3 and own SVG: a `viewBox` and `width: 100%`, or redraw
at the measured width. Change density, not only size: when narrow, fewer ticks (the example keeps every third month
under 420 px), legends below, labels thinned. Grids of cards with `minmax(min(100%, 20rem), 1fr)` so a card never
forces a horizontal scroll at 320 px.

## Motion between data states

Animate from the old value to the new one, never from zero on an update; keep the axis stable or move it too; 400 to
900 ms. Grow from zero once, on arrival, and do not replay it on a redraw for a new width. Under reduced motion every
update is a cut: Chart.js `animation: false`, ECharts `animation: false`, D3 `duration(0)`, own SVG no transition.
Chart.js and ECharts do not read `prefers-reduced-motion` themselves; decide before the first draw. A width change on
an SVG `rect` transitions when it is set as a CSS property (`style.width`), not when only the attribute changes.

## Big data

| Size | Route |
|---|---|
| Up to a few thousand marks | SVG is fine |
| Tens of thousands | canvas (Chart.js, ECharts canvas renderer, uPlot) or aggregate first |
| A million points in a series | uPlot with typed arrays (`Float64Array`); 1,000,000 drawn here |
| Hundreds of thousands of map points | deck.gl (WebGL2) |
| 100,000 table rows | a windowed table (`examples/table.html`): 22 rows in the DOM at a 420 px region |
| Millions of rows that must be queried | DuckDB-Wasm (not run here), and say so |

Data inlined as a JavaScript literal is parsed with the script at load; put it in `<script type="application/json">`
and parse on demand, or ship a typed array as base64 for very large numeric data. A windowed table breaks the browser's
find and print: give a search box (the example filters 100,000 rows by city), an export, and print all rows only when
the count is small.

## Text alternatives

| Chart | Alternative measured here |
|---|---|
| Own SVG | `role="img"` and an `aria-label` that states the values; a finding sentence above; a "Show as tables" switch with real `<table>` markup, `scope` on headers |
| Chart.js | `role="img"` and a label on the canvas, plus a visually hidden table of all 36 values |
| ECharts | `aria.enabled`: a generated description on the container; raise `aria.data.maxCount` above the item count |
| Vega-Lite | every mark a `graphics-symbol` with a label of its values (built in) |
| D3 | your job: focusable bars with labels (`tabindex=0`, `role="img"`), the svg a labelled group |
| Plot | fix its labelled `<g>` elements with `role="group"` |
| Big table | `role="table"` with `aria-rowcount` and `aria-rowindex`, `aria-sort` on headers, a status line for sort and search |

The honest default for any dashboard is a visible "show as table" switch: a description says what a chart shows; a
table lets a person check it.
