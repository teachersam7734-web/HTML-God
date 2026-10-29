# Verification: evidence before claims, always

NO completion claims without fresh verification evidence. The gates below were earned the hard way
(cache-busting ghosts, silent JS errors, "complete" images that weren't).

---

## §1 · Static gate: `python scripts/verify_html.py <file> [--strict]`

No dependencies, runs in seconds, catches the majority of ship-blockers:

- Tag balance for div/section/script/style/audio/video/canvas (counts open vs close).
- `<script>` bodies compile: `node --check` when Node is present (a brace-balance fallback without
  it): catches syntax errors without a browser.
- Data contract audits when patterns are found (`const DB=[…]` shape assertions per project type).
- Data-URI sanity: counts by type; flags accidental duplicates/empties.
- Script types: classic and module scripts through `node --check`; importmap and JSON-LD
  parsed as JSON; shader and template script types skipped and named.
- Network references (src/href, CSS `url()`/`@import`): warned; `--offline` makes them fail.
- Reduced motion: animation present with no `prefers-reduced-motion` anywhere is warned.
- Weight report: total, largest lines, per-type embed weight (information only, no budget).
- `--strict`: any finding fails (use before shipping; default warns).

## §2 · Runtime gate: in a real browser, opened the way the user opens it

A single file is opened by double-click, so test it over **strict `file://`** first (no
`--allow-file-access-from-files`): that is where module scripts, fetch of local files and some
storage behave differently. Serve it as well when it will also be hosted.

**With HTML-Sensei installed** (the package this skill ships with), run its gate. One command opens
the file in Chrome over strict `file://`, and checks console and page errors, network requests
(an offline file must make none), screenshots at 375/768/1440, reduced motion, forced colours,
axe at two widths and in dark mode, keyboard focus, target size, 200% and 400% reflow, blocked
storage, and writes a contact sheet:

```bash
node <html-sensei plugin>/skills/sensei-verify/scripts/sensei-gate.mjs page.html --project .
```

(`html-sensei:sensei-verify` has the options; playwright-core and axe-core are found in the
project or the global npm root.) It is Chromium only: Firefox and Safari stay "not verified"
unless you open the file in them yourself, and the hand-off says so.

**Without it**, serve and walk the page by hand:

```bash
python scripts/serve.py 8421        # 127.0.0.1 only; --lan to test on a phone on your network
```

Then in the browser:

- **Console: zero errors**: read the logs; a single red line fails the gate.
- Walk every route; open/close a modal; run one full quiz/cards cycle.
- Resize 375px, 768px, 1280px: no horizontal scroll, no overlap.
- Evaluate spot-checks in the page (your browser tool's evaluate or the DevTools console; run
  these, don't eyeball):
  ```js
  document.querySelectorAll('img').length                    // then per img:
  [...document.images].every(i => i.complete && i.naturalWidth > 0)
  !!(window.AudioContext||window.webkitAudioContext)
  localStorage.getItem('<your-key>')                          // after one feature use
  getComputedStyle(document.querySelector('.dock')).position  // spot-check tokens landed
  ```
- **Cache-bust every reload** (`?v=N`, increment on every check). The preview will happily show a
  stale file and gaslight you: this bug cost real hours.
- Screenshots can fail with "no frames/not composited" in some preview tools: reload and retry,
  or fall back to snapshot/evaluate. Screenshot at least once per project: layout bugs are
  invisible to DOM checks. A screenshot is for looking, not a functional test: features are
  proven by doing them (click, key, evaluate).

## §3 · Media gate

| Asset | Check |
|---|---|
| Images | `complete && naturalWidth>0`; displayed size vs embedded size sane |
| Audio | `duration>0 && !error` after `preload="auto"`; first `play()` inside a gesture |
| Fonts | `document.fonts.check('16px "YourFont"')` per family; `await document.fonts.ready` before canvas text |
| WebGL | `typeof THREE !== 'undefined'`; one composer.render() without exception |

## §4 · Environment footguns (real, encountered)

| Footgun | Detail | Fix |
|---|---|---|
| Stale preview | served file cached | `?v=N` always |
| PowerShell-style `$_` | silently misbehaves in Git Bash | bash-native or single-quoted heredocs |
| Port already in use | other agents/sessions hold 8421 | check listeners first (`netstat -ano | grep 8421`), pick free port |
| http-server dies on restart | background process not persistent | nohup + log, or rerun serve.py |
| Ripgrep missing | not installed or not on PATH in that shell | fall back to `grep -a`, `findstr` |
| 10 MB+ file read limits | file tools refuse large files | probe with `grep -a -b` / `tail -c` offsets, never whole-file reads |
| Preview viewport ≠ screenshot size | automation viewport (e.g. 398px) smaller than captured image (e.g. 1526px) | trust `innerWidth`/`getBoundingClientRect` probes over screenshot impressions |
| Screenshots fail repeatedly ("no frames") | compositor glitch in the preview webview | fall back to `elementFromPoint` hit-tests + rect math; reload or open a fresh tab first |
| Fixed-canvas content invisible, chrome fine | grid-centring a child larger than its container | arithmetic `translate+scale` (presentations.md §1) + boot self-check |

## §5 · The regression sweep (between phases)

After each workflow phase: re-run static gate + one browser boot + the phase's specific feature.
Two minutes; prevents the classic "everything broke and I don't know which change did it".

## Gate checklist (copy into the build log at ship time)

```
[ ] verify_html.py --strict (--offline if offline): PASS
[ ] HTML-Sensei gate (if installed): PASS, contact sheet looked at
[ ] boot over file:// (and served, if hosted): console clean
[ ] all routes walked; all features exercised once
[ ] resize 375/768/1280: no overflow/overlap
[ ] images: all complete, naturalWidth > 0
[ ] audio: duration > 0, plays in-gesture
[ ] fonts: check() true for all families
[ ] reduced-motion: verified calm
[ ] keyboard: every feature reachable; focus visible; forced colours keep controls visible
[ ] private window: boots (storage degrades gracefully)
[ ] weight (information, no budget): ______
[ ] not verified (browsers, devices, screen readers): ______
```
