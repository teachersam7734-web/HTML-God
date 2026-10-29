# Performance as smoothness: measuring it honestly

Source: `domain-performance-smoothness.md` in the HTML-Sensei build project's research notes (not shipped). Performance here means smooth, responsive and stable,
not small. Weight is information only (owner rule, additions section 9.3), and the standing preference is "do not
optimise for this machine": a heavy shader is never downgraded because the development machine is slow.

Software GL (`--use-angle=swiftshader --enable-unsafe-swiftshader`) makes frame **rates** CPU-rasteriser numbers,
not target-device numbers. **Counters** (layouts, style recalculations, long tasks, task time) are real on any machine.

## Targets

| Metric | Good | Meaning for a local single file |
|---|---|---|
| LCP | 2.5 s or less | a relative signal locally (a huge inline script moves it); real for hosted copies |
| INP | 200 ms or less | real: any click that starts a long task fails it; measure with a scripted click and Event Timing |
| CLS | 0.1 or less | real everywhere: font swaps, images without dimensions, late banners |
| Frame | 16.7 ms at 60 Hz (8.3 at 120 Hz) | p95 frame under 20 ms on the **target** device |
| Long task | none over 50 ms during interaction; none over 200 ms at load | |
| Total blocking time | under 200 ms | approximated as the sum of (task minus 50 ms) |

## The probe (in `../scripts/lib/inpage.mjs`, run by `--checks perf`)

Install before load with `addInitScript` (`frameSamplerInit`): a rAF loop pushing frame deltas, and
`PerformanceObserver`s with `buffered: true` for `longtask`, `layout-shift` (skipping `hadRecentInput`),
`largest-contentful-paint`, `long-animation-frame` (names the script that blocked) and `event` (40 ms threshold).
Then a 2.5 s idle sample and a 3 s programmatic scroll, each reduced to median, p95, p99, max and counts over 33 and
50 ms (`frameStats`), plus `perfSnapshot` and CDP `Performance.getMetrics` (Nodes, JSEventListeners, JSHeapUsedSize,
LayoutCount, RecalcStyleCount, ScriptDuration, LayoutDuration, TaskDuration). Enable the CDP domain **before**
navigation or the counters start at zero after load.

## What each animated property costs (counters, per second, a 100 px box for 2 s)

| Property | Layouts/s | Style recalcs/s | Main-thread ms/s |
|---|---|---|---|
| `transform` | 0 | 0 | 1 |
| `opacity` | 0 | 0 | 1 |
| `left` | 1 | 60 | 16 |
| `width` | 62 | 62 | 29 |
| `box-shadow` | 0 | 61 | 27 |
| `filter: blur()` | 0 | 62 | 27 |

`transform` and `opacity` run on the compositor and cost the main thread nothing; `width` lays out every frame;
`box-shadow` and `filter` repaint every frame, which on a weak GPU scales with area times radius. The software
rasteriser cannot show true paint cost. Rules: animate `transform` and `opacity`; never layout properties on
continuously running elements; `will-change` on the few long-running animated elements only.

## The trace recipe (why a frame was slow)

```js
await browser.startTracing(page, { path: 'trace.json', categories: ['devtools.timeline', 'v8.execute', 'disabled-by-default-devtools.timeline'] });
/* drive the page */ await browser.stopTracing();
const ev = JSON.parse(fs.readFileSync('trace.json')).traceEvents;
const ms = n => ev.filter(e => e.name === n && e.ph === 'X').reduce((s, e) => s + e.dur, 0) / 1000;
// RunTask (count those over 50000 us), FunctionCall, EvaluateScript, Layout, UpdateLayoutTree, Paint, ParseHTML, Decode Image
```

Open the same file in Chrome DevTools Performance or `ui.perfetto.dev`. Measured: 1.5 s of an animating `width`
produced about 4,700 trace events.

## What the probe said on real pages

| Page | Software GL figures | Reading |
|---|---|---|
| Landing page, CSS animation, no WebGL | 60.8 fps idle, 62.5 scrolling, p95 20 ms, CLS 0.009, no long tasks | clean |
| Full-viewport raymarch shader | 26 fps idle, p95 66 to 80 ms | expected on a CPU rasteriser; information, not a failure |
| Ultra Bookworm, 83 MB, five canvases | p95 176 ms idle with a WebGL hologram scene | software-GL numbers. Its 65 MB of inert video blocks delay DOMContentLoaded to about 4 s but not first paint (64 to 124 ms) or interactivity, because the app boots without waiting for DOMContentLoaded (measured 2026-10-19; an earlier "3 s load task" reading was a misattribution) |

## Quality bars

1. No layout-property animation on anything that runs continuously (grep and counters).
2. CLS 0.1 or less on first load and after the scripted interaction.
3. No long task over 200 ms during load, none over 50 ms during an interaction (except an announced loading state).
4. Idle and scroll p95 at or under 20 ms on the target device for 60 Hz content; measured on a real GPU (`--gpu`), or
   labelled "software GL, not meaningful".
5. Animated things pause when hidden (`visibilitychange`, `IntersectionObserver`) and under reduced motion.
6. Every number in a report states whether software GL was on.

## Proving a loop is idle (field log)

A canvas under `display: none` or `opacity: 0` still costs its full draw every frame. Wrap the draw call in an init
script and count calls per canvas id, then assert the count does not grow on screens where the effect is not shown:

```js
await context.addInitScript(() => {
  const counts = window.__draws = {};
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const orig = C.prototype.drawArrays;
    C.prototype.drawArrays = function (...a) { const id = this.canvas.id || '?'; counts[id] = (counts[id] || 0) + 1; return orig.apply(this, a); };
  }
});
```

Run here on `../fixtures/gl-seek.html` (Chrome, SwiftShader): 60 draws in the first second, then after pressing Pause
the count stayed at 70 for the next second. Wrap `drawElements` the same way for indexed geometry (three.js uses it).

## Traps

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | A shader page "fails" at 26 fps | software GL frame rates | report it as relative; never downgrade the effect; run `--gpu` where a GPU exists | tested |
| 2 | Counters read zero | CDP `Performance` enabled after load | enable before `goto` | tested |
| 3 | LCP and early shifts missing | observer installed late or without `buffered: true` | install in an init script, buffered | reported |
| 4 | rAF never ticks, every animation-timed check stalls | the desktop browser pane and an extension tab reported `visibilityState: hidden` | run headless, where pages are visible | tested (field log) |
| 5 | Wall-clock offsets drift in a test | SwiftShader takes 2 to 5 s per screenshot | assert on state, not on timestamps | tested (field log) |
| 6 | Looks fine on a fast CPU, falls over on a phone | layout-property animation | test with counters (layouts per second), not by eye | tested |
| 7 | Mid-range GPUs stutter on glass panels | `filter: blur`, `backdrop-filter`, big `box-shadow` repaint on the main thread | limit area and radius; measure | reported |
| 8 | GPU memory climbs | `will-change` on everything (each layer is a texture) | a few long-running elements only | reported |
| 9 | Reduced-motion users get a glide; scroll libraries fight it | `scroll-behavior: smooth` on `html` | jump instantly, smooth per call where content stays | tested (field log) |
| 10 | Full-page screenshot fails or clips | browsers cap captures around 16,384 px | the gate clips at 15,000 px and says so | reported |
| 11 | `content-visibility: auto` claimed to help | not reproduced in the lab (sections kept their height); in the course it broke jump-to targets by 300 to 1500 px | pair with `contain-intrinsic-size`, measure, drop it where lists are jumped through | lab: not reproduced; field log: tested |
| 12 | Code using LoAF or `scheduler.yield` breaks elsewhere | Chromium-only APIs | feature-detect, fall back to `setTimeout` | reported |
| 13 | A slow renderer cuts a fade short | at 6 fps a 420 ms transition's `transitionend` came at 971 ms; a 700 ms backstop fired first | backstop at about twice the duration | tested (field log) |
