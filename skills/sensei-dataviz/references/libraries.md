# Chart libraries: choice, offline use, measured behaviour, licences

Sources: `domain-dashboards-dataviz.md` in the HTML-Sensei build project's research notes (not shipped) (licences read from npm metadata or the GitHub API on
2026-10-19); this skill's `build-dash.mjs` and `test-dash.mjs`, run on 2026-10-27 with the versions below from npm.
"Offline" means one HTML file with the library and data inlined and no request at run time, checked by the test.

| Library | For | Version tested | Licence | Inlined size | Offline, here |
|---|---|---|---|---|---|
| none (own SVG, `examples/dashboard.html`) | a few charts designed as part of the page: headline numbers, bars, lines, sparklines | n/a | HTML-Sensei's own | about 14 KB with data | verified |
| Chart.js | ordinary bar, line, pie, doughnut, radar on canvas; good ergonomics | 4.6.1 | MIT | 210 KB | verified |
| Apache ECharts | many chart types (maps, treemap, sankey, heatmap), large-data options, SVG or canvas, built-in aria and decal patterns | 6.1.0 | Apache-2.0: keep its NOTICE when redistributing | 1.1 MB | verified (SVG renderer) |
| uPlot | time series with huge point counts; tiny and fast | 1.6.32 | MIT | 51 KB | verified, 1,000,000 points |
| D3 | bespoke charts, data joins, scales, axes, transitions, layouts | 7.9.0 | ISC | 280 KB | verified |
| Observable Plot | concise explanatory charts on D3 | 0.6.17 | ISC | 209 KB plus D3 | verified (with the role fix) |
| Vega, Vega-Lite, vega-embed | a declarative JSON grammar; the best built-in ARIA of the set | 6.4.0, 6.5.0, 7.3.0 | BSD-3-Clause | 521, 258, 60 KB | verified |
| deck.gl | large geospatial and WebGL layers (scatter, hexbins, arcs) | 9.4.0 | MIT | 2.07 MB | verified without a base map, software GL |
| MapLibre GL JS, Leaflet | slippy maps with tiles | not run | Leaflet BSD-2-Clause; MapLibre: no single SPDX on GitHub, read its LICENSE | | tiles need a network or a local pack |
| Perspective | pivot grids and streaming analytics in WebAssembly | not run | Apache-2.0 | large | |
| TanStack Table, AG Grid | headless table logic; a full data grid | not run | TanStack MIT; AG Grid editions differ, read the LICENSE and the feature table | | |
| DuckDB-Wasm | SQL over big local data | not run | MIT | large | the route for million-row data that must be queried |

## Decision rule

- No library when the charts are few and part of the design: SVG built in a few dozen lines, every pixel owned
  (`examples/dashboard.html`).
- Chart.js for standard business charts.
- ECharts when a type is missing from Chart.js or the built-in description and decals matter.
- uPlot when a series has tens of thousands of points or more.
- D3 when the chart is a designed object.
- Plot or Vega-Lite when an analyst or an agent writes a specification and wants correct defaults.
- deck.gl for a hundred thousand map points or more.
- Never one heavy library "to be safe": weight is reported, not budgeted, but each library is a ledger row and a set of
  traps.

## Building offline pages (`scripts/build-dash.mjs`)

```
npm i -D chart.js echarts uplot d3 @observablehq/plot vega vega-lite vega-embed deck.gl
node build-dash.mjs out/ [--only chartjs,echarts]
```

Each page: data in `<script type="application/json">` parsed on demand (with `<` written as `<`), the library
inlined with a comment naming its version and licence and with `</script` and `<!--` escaped, the palette chosen by
colour scheme, reduced motion decided before the first draw, and a text alternative.

## Measured behaviour (test-dash.mjs)

| Library | What was measured |
|---|---|
| Chart.js | canvas painted; follows its container from 900 to 400 px (`responsive: true, maintainAspectRatio: false`, a parent with a height); `update()` animates through intermediate positions; with `animation: false` under reduced motion an update jumps in one step |
| ECharts | marks and decal patterns in SVG; `aria.enabled` writes `role="img"` and a description on the container; `aria.data.maxCount: 12` lists all twelve months (the default stops at ten and says "first 10 items"); a `ResizeObserver` calling `resize()` follows the container; `setOption` renders intermediate frames; `animation: false` lands an update in one frame |
| uPlot | 1,000,000 points drawn; first draw about 10 ms on this machine (2D canvas; information only); the cursor resolves an index near 500,000; `setSize` from a `ResizeObserver` follows the container |
| D3 | bars grow through intermediate heights; every bar focusable with a label; `duration(0)` under reduced motion draws full height at once |
| Observable Plot | 36 bars and a legend; it writes `aria-label` on `<g>` with no role (axe `aria-prohibited-attr`); `role="group"` on those elements clears axe |
| Vega-Lite | inline data, SVG renderer: dashed series and a labelled `graphics-symbol` for every point |
| deck.gl | 200,000 points in both class colours as WebGL pixels under SwiftShader; `pickObject` returns an index |

## Maps

Tiles are not data you own: OpenStreetMap attribution is mandatory and its tile servers forbid bulk or offline use.
An offline map needs a local tile pack (PMTiles and a MapLibre protocol, for example) with its own licence, or no base
map at all (deck.gl alone draws on a blank canvas). For devices without WebGL2, ship a static image of the map as the
fallback. A choropleth shows rates (normalise by population), never raw counts.
