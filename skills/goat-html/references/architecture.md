# Architecture: the single file, structured

A one-file app is not "no architecture". It is "all architecture, compact". The projects that shipped
well share the same skeleton; the ones that suffered lacked a piece of it.

---

## §1 · File anatomy (the layered single file)

Read order top→bottom = dependency order:

```
<!doctype html>
<head>
  meta / title / description / theme-color / favicon (inline SVG emoji works great)
  fonts: inline @font-face with base64 woff2 (offline, the default); a <link> only for a hosted page
  <style>  design tokens first, then overlays, then components, then routes
</head>
<body>
  overlay divs (aurora/vignette/grain/scanlines): pointer-events:none, fixed, z-indexed
  shell chrome (HUD, top bar, dock)
  route <section>s: one per route, .on class toggles
  templates/hidden containers
  <script> library blob if any (three.js first: biggest, least likely to be edited)
  <script> data (DB, LYRICS, SCENES, with sentinel above)
  <script> engine (sentinel /*__ENGINE__*/)
  <script> modules/features (sentinel /*__MODULES__*/)
</body>
```

Z-index discipline (overlays to top): canvas/scene (0 to 10) < content (10 to 100) < chrome (800) <
overlays (990 to 999) < toasts/modals (1000+). Write it as a comment; future-you will thank you.

Weights observed across the three projects (information for the delivery note, not budgets: best
quality is the default and weight is never a gate):

| Project | Weight | What it carried |
|---|---|---|
| Idiom-Ville | 136 KB | CSS + JS + one small logo; fonts external (it needed a network) |
| Ultra Bookworm (2026-09 build) | 4.5 MB | + cover art images (webp), 192 narration clips, favicon |
| 1001 Arabian Nights | 14.6 MB | + full song (mp3), fonts, inlined three.js + postprocessing |

## §2 · Data contract (one array, one shape, one source of truth)

Every feature reads this array; no feature keeps its own copy.

```js
/* DATA CONTRACT: Idiom-Ville
   { n: string        idiom text
     cat: enum        'communication'|'risk'|'success'|'problems'|'value'
     d: string        one-sentence definition
     ex: [s, s]       exactly 2 example sentences
     alt: [s, s, s]   exactly 3 related idioms } */
const DB = [ ... ];
```

Rules:
- The shape comment sits **at the top of the array**: the contract travels with the data.
- Validate once, centrally: `DB.every(e => e.d && e.ex.length === 2 && ...)` run at boot (dev) and by
  the static verifier (ship).
- New fields (e.g. `memo`, `register`, `audio`) are additive; every feature inherits them for free.
- For lyric/musical data, timestamps are measured from the media itself (see `audio-reactive.md` §4):
  never eyeballed.

Ultra Bookworm's 50-lesson course was grafted onto an existing shell by *replacing the DB wholesale*
(zero route/store changes) because the contract held. That is the payoff.

## §3 · Store (persistence before UI)

```js
const KEY = 'appname_v1';                     // version in the key
const store = {
  data: { seen:{}, correct:{}, wrong:{}, saved:[], xp:0, streak:0, best:0, sound:true, v:1 },
  load(){ try { return JSON.parse(localStorage.getItem(KEY)) || null } catch(e){ return null } },
  save(){ try { localStorage.setItem(KEY, JSON.stringify(store.data)) } catch(e){} }
};
```

- try/catch from day one: private browsing and blocked storage must degrade to "session-only", not crash.
- Version field in the payload; on mismatch, migrate or bump the key (old data dies gracefully).
- Decide the store shape *before* the quiz exists: it is why per-idiom spaced repetition is a cheap
  add in Idiom-Ville and not a rewrite.

## §4 · Router (generated nav, hash-based)

```js
const ROUTES = [
  ['home','Home','M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z','Home'],
  ['explore','Explore','M21 21l-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z','Search everything'],
  // [id, label, svg-path, tooltip]
];
function render(){
  const r = (location.hash||'#home').slice(1);
  $$('.route').forEach(s => s.classList.toggle('on', s.id === 'route-' + r));
  $$('.dock-btn').forEach(b => b.classList.toggle('active', b.dataset.route === r));
  // lazy render hooks per route…
}
addEventListener('hashchange', render);
```

- Dock buttons are **generated from ROUTES**: adding a screen = adding one array entry.
- Route switching is a CSS class toggle + a scroll reset; transitions share one easing token.
- Idiom-Ville wraps this pattern as an inner SPA inside Ultra Bookworm's landing shell: the same
  `ROUTES`/`render()` shape works nested.

## §5 · Sentinels (injection points)

```js
/*__DATA__*/
/*__ENGINE__*/
/*__MODULES__*/
/*__COVERS__*/   // e.g. inside const COVERS=[...]
```

- Unique, greppable, human-meaningless: perfect anchors for scripted edits (str_replace, sed, or a
  node script). Regexing real code is fragile; regexing a sentinel you own is not.
- Place them in the skeleton even when unused. Arabian Nights' cover-swap and font-swap pipelines
  relied entirely on anchors that were placed "just in case" during scaffolding.

## §6 · Module discipline inside one `<script>`

- IIFE per feature: `(function featureName(){ ... })()`: no globals except deliberate ones
  (`window.UltraGate` in Ultra Bookworm is a published contract).
- Shared utilities live in one `const $ = s => document.querySelector(s)` block at the top.
- Event delegation over per-element listeners when lists re-render.
- Every engine/feature can be disabled by deleting its IIFE: no tangled dependencies.

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| Feature works once, breaks on revisit | State not reset in render | Render hook per route re-inits |
| Data edit breaks a distant feature | Feature read a second data source | One array rule (§2) |
| Progress lost after schema change | No version in store key/payload | §3 version + graceful reset |
| Scripted edit nuked surrounding code | Regexed real code instead of sentinel | §5 |
| Z-index mystery bug | Ad-hoc z values | §1 discipline + comment |
| Nested SPA fights outer shell | Both own the hash | Namespaced hash or explicit hand-off (case-studies.md §2) |
