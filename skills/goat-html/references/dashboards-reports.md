# Dashboards & Reports: data-dense, printable, zero-dependency

A dashboard-style single file is the opposite genre from the cinematic builds: density is the point,
motion is nearly absent, and the same file often must print as a clean report. The discipline is
choosing the *right* 40-line chart, not the biggest canvas. Deeper (chart form, palettes,
transitions, big tables): `html-sensei:sensei-dataviz`.

---

## §1 · Charts without libraries (the decision table)

| Chart | Implementation | When |
|---|---|---|
| Sparkline | inline `<svg><polyline points="…"/></svg>` from the data | every KPI card |
| Bar chart | flex divs with `height:%` (vertical) or `width:%` (horizontal) | comparisons, ≤ 30 items |
| Donut / pie | `conic-gradient(var(--a1) 0 34%, var(--a2) 34% 61%, …)` + `border-radius:50%`, hole via inner circle | part-to-whole, ≤ 6 slices |
| Progress ring | SVG circle + `stroke-dasharray`/`stroke-dashoffset` (proven in Ultra Bookworm's score arc) | single KPIs |
| Line/area | SVG `<path>` built in JS: `M x0 y0 L …`; area = close the path + gradient fill | trends, ≤ 200 points |
| Heatmap | CSS grid of cells, `background:color-mix(in srgb, var(--accent) calc(quantum*100%), transparent)` | calendars, matrices |
| Everything bigger | embed Chart.js/ECharts (`media-embedding.md` §7 pipeline): but first ask if the 40-line version is enough | > 2 chart types, tooltips, zoom |

Rules: label axes in plain text, not canvas; number formatting via `Intl.NumberFormat`; every chart
gets a `role="img"` + `aria-label` summary ("Revenue up 12% QoQ"): screen readers can't read pixels.

## §2 · The KPI card (the dashboard atom)

```html
<div class="kpi">
  <span class="kpi-label">Monthly active users</span>
  <span class="kpi-value">48,210</span>
  <span class="kpi-delta up">▲ 12.4% vs last month</span>
  <svg class="spark">…</svg>
</div>
```

- Value at `clamp(28px, 4vw, 44px)`, tabular numerals (`font-variant-numeric: tabular-nums`) so
  columns of numbers don't wobble.
- Delta chips: green up / red down *plus* the arrow glyph: never colour alone (colour-blind users).
- Sparkline behind/beside the value; one accent colour; no 3D, no shadows on the chart itself.
- Grid: `repeat(auto-fill,minmax(240px,1fr))`; the whole dashboard must survive 320px width.

## §3 · Tables that don't embarrass you

- Sticky header (`position:sticky;top:0;background:var(--bg)`), zebra rows via `nth-child(even)`,
  right-aligned numerics with tabular-nums, left-aligned text.
- Sort buttons in `<th>` (single `data-key` comparator, ~15 lines); filter input debounced 150ms;
  row count visible ("showing 24 of 1,392").
- `overflow-x:auto` wrapper for narrow screens; never let the table own the viewport.
- Numbers copy-paste clean: no thousands separators *inside* `<input>`s, formatted only in display.

## §4 · Data handling

- Data lives in one `const DATA=[...]` array (same contract rule as everywhere); views derive from
  it. Report files often get data pasted in by non-engineers: put the array at the **top of the
  script with a comment banner** marking it as the only edit point.
- Aggregate once at boot (`reduce` into summaries), render from aggregates. Re-sorting/re-filtering
  must never re-parse the raw data.
- Deterministic rendering: no `Math.random()` in reports: the same file must render identically
  twice (audits, screenshots, diffs).

## §5 · The print stylesheet (reports live or die here)

```css
@media print {
  body { background:#fff; color:#111; }
  .aurora, .grain, .scan, .vignette, .dock, .hud { display:none !important; }
  .kpi, .card { break-inside: avoid; box-shadow:none; border:1px solid #ddd; }
  table { font-size:10pt; }
  @page { margin: 14mm; size: A4; }
  a { color:inherit; text-decoration:none; }
}
```

- Force light-on-white in print regardless of theme: dark backgrounds murder toner and most office
  printers mangle them.
- `break-inside:avoid` on cards/rows; repeated `<thead>` on long tables (browsers do this natively).
- Verify in Print Preview: the print gate is part of the ship gate for this genre.

## §6 · Motion policy (opposite of the cinematic genre)

- Motion: **almost none** (HTML-Sensei's `calm` motion setting). Allowed: one count-up on the hero KPI
  (600ms, once), hover lift on rows/cards, skeleton shimmer while (hypothetically) loading.
- Nothing loops. Nothing pulses. No parallax, no grain, no scanlines: density + noise = mess.
- `prefers-reduced-motion` still gets its path (the count-up shows the final number at once);
  it costs nothing because there is so little motion.

## §7 · Genre palette guidance

- Light theme is the default for reports (print + daytime reading + export screenshots); dark theme
  is a `prefers-color-scheme` bonus, not the base.
- One accent + semantic trio (`--up/--down/--warn`) + neutrals. Charts inherit the palette: a
  rainbow chart is a chart that says nothing.
- The anti-slop checklist still applies; the "dashboard slop" tell is *identical grey cards with
  identical soft shadows at identical radii*: vary card hierarchy (hero KPI row vs secondary grid)
  so the layout encodes importance.

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| Numbers wobble when they update | proportional font | `font-variant-numeric:tabular-nums` |
| Chart unreadable on projector | thin lines, low contrast | 2px+ strokes, label directly, no legend mazes |
| Print is 12 pages of black ink | dark theme printed | §5 print stylesheet forces light |
| Table scrolls the whole page on mobile | no wrapper | `overflow-x:auto` wrapper |
| Same data, different totals | aggregates computed per render | §4 aggregate once at boot |
| Dashboard feels like AI slop | uniform cards everywhere | §7 vary hierarchy, encode importance |
