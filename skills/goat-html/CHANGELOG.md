# GOAT HTML: changelog

## 2026-10-27: revised for the HTML Router package

Why: the owner asked for GOAT HTML to be freed of errors and brought into line with HTML-Sensei,
because the HTML Router will call GOAT HTML, HTML-Master and HTML-Sensei as one package, and
HTML-Sensei takes priority where they clash (owner, `HTML-SENSEI-ADDITIONS.md` sections 10 and 12).
The original `GOAT HTML.zip` is kept untouched as the backup. The skill's identity, voice and
structure are unchanged; SKILL.md is 315 lines.

Evidence was gathered on Windows 10, Python 3.13.3, Node 24.16.0 and Chrome through playwright-core
1.64.1 with axe-core 4.14.0. All browser checks are **Chromium only**; Firefox and Safari were not run.

### 1. Clashes with HTML-Sensei's doctrine (HTML-Sensei wins)

The clashes are the ones recorded in `sensei-direction/references/design-read.md` section 5 and
`sensei-presentations/references/deck-craft.md` ("Where HTML-Sensei differs"), plus any others the
review turned up.

| What GOAT HTML said | Now | Where |
|---|---|---|
| Size-budget tiers (Feather 200 KB / Middle 5 MB / Heavy 5 to 20 MB) as a design input, "over budget? cut", "size vs budget" in the gates | No budget unless the user asks for one; weight is reported as information at every gate and never used to cut quality. A delivery channel with a known limit is told to the user, never solved by a silent quality cut | `SKILL.md` §0, §6; `workflow.md` phase 1 and phase 8, failure table; `architecture.md` §1 (tiers became observed weights); `media-embedding.md` §1 (rewritten); `sources.md` §0.6, §8; `case-studies.md`; `verification.md` checklist; `design-read-template.md`; `verify_html.py`, `inline_three.py`, `engine-analyzer.js` output |
| Iron rule 9 "One heavy library max" | "Use what the best result needs": hand-roll when it gives the same picture, import as many libraries as the result needs; weight reported, a licence-ledger row per library | `SKILL.md` §4; `library-ecosystem.md` §0, §6, §7; `canvas-2d.md` §1 |
| Mobile: "fade canvas to .2 at ≤1100px, off at ≤640px"; webgl "On SMALL (≤760px): halve star counts, disable shadows, lower bloom resolution"; "test on SMALL devices ... halve resolution" | Never fade or switch an effect off by device class; judge on the target device, label this machine's numbers as relative, name what was not verified; any real quality cut is the user's decision | `design.md` symptom table; `webgl.md` §4, §6, symptom table; `canvas-2d.md` symptom table; new eval 10 |
| "Two families max" | One family per role; a third (data or mono) is fine when it has a job | `design.md` §2; `SKILL.md` §7 checklist; `design-read-template.md` |
| Motion dial default 6 | Default 8 (cinematic, 7 to 9) when the brief is silent, mapped to HTML-Sensei's `motion` profile; reduced motion whatever the level | `SKILL.md` §2; `design-read-template.md` |
| Liquid glass "verified cross-browser" | Verified in Chromium only; Firefox and Safari not verified; the svg-filter path is the intended Firefox route, untested | `design.md` §9 |
| Starters load Google Fonts over the network | No network request in any starter: font stacks name the families first and fall back to system faces, with a comment on embedding a base64 woff2 face. Fonts strategy table now makes the embedded face the single-file default | `assets/starter-*.html`; `media-embedding.md` §4; `architecture.md` §1; `workflow.md` phase 3 |
| Presenter sync "by postMessage or localStorage events" | `postMessage` only, tagged and checked by `event.source` (storage can throw on `file://`; BroadcastChannel never connects between `file://` pages in Firefox). The starter deck's presenter now drives the deck and gets the echo back | `presentations.md` §3; `assets/starter-deck.html` |
| Print CSS sizes slides at `100vw` by `100vh` | Slides at 1920 by 1080 px under `@page { size: 1920px 1080px }`, no blank page after the last slide | `presentations.md` §7; `assets/starter-deck.html` |
| Starter deck has no reduced-motion path, no `inert`, no slide roles, no `touch-action` | All four built in, plus a live region, Pointer Events swipe (50 px, 1.5 times vertical, 800 ms), visible Previous / Next / Presenter buttons, keys ignored with modifiers and in fields | `assets/starter-deck.html`; `presentations.md` §2, new §3b |
| "Budget it: presenter mode is ~120 lines" | "about 60 lines in the starter" (no budget wording) | `presentations.md` §3 |
| Big-number and statement slides sized in `vw` (20vw, 8 to 10vw) | Sized in canvas px (about 380 px; 150 to 190 px): `vw` follows the viewport, which breaks the fixed-canvas rule this same reference makes | `presentations.md` §5 |
| Runtime gate: "Never trust a file that hasn't been served" | Open a single file the way the user does (strict `file://`) first, serve as well when hosted; HTML-Sensei's gate is the runtime gate when installed | `SKILL.md` §4 rule 1, §6; `verification.md` §2; `workflow.md` phase 8 |
| Reduced motion treated as a hardening step (phase 7) | Built in with each engine (phase 4), confirmed in phase 7; keyboard routes, forced colours and `inert` added to hardening | `SKILL.md` §3, §4 rule 7; `workflow.md`; `interaction.md` §5 |
| Dashboard "Motion budget" | "Motion: almost none" (HTML-Sensei's `calm`), still with a reduced-motion path | `dashboards-reports.md` §6 |
| "Photo-real or heavy: don't build it in one file" | Decide file versus site by delivery, not weight | `SKILL.md` §5 |
| No statement of the package relationship | New `SKILL.md` §0: package rules (the six doctrine points as this skill applies them) and a table pointing to the deeper `html-sensei:<skill>` for each topic; the description says HTML-Sensei wins where they disagree. Pointers to `html-sensei:<skill>` added in the references where HTML-Sensei covers a topic in depth; GOAT HTML still works on its own | `SKILL.md` §0, §8; most references |

### 2. Errors found by running things, and fixed

| File | Error (evidence) | Fix |
|---|---|---|
| `scripts/verify_html.py` | Fed every inline script to `node --check`, so an `importmap` and a JSON-LD block were reported as syntax FAILs (`SyntaxError: Unexpected token ':'` on a test page) | Script type aware: classic as `.js`, module as `.mjs`, JSON types parsed as JSON, other types skipped and named. Rerun: only the genuinely broken script fails |
| `scripts/verify_html.py` | The data-URI census used bytes keys, printing `embed b'image'/b'png'`; so the duplicate-font warning (`key.startswith("font/")`) and the audio-registry note (`census.get("audio/mpeg")`) could never fire | Keys decoded; output now `embed image/png: x1, ~26.6 KB` |
| `scripts/verify_html.py` | No check for network references or for missing reduced motion, though the skill's rules require both | Added: network references warned (`--offline` makes them fail); animation without any `prefers-reduced-motion` warned. It caught the original deck starter's missing reduced motion and all three starters' Google Fonts |
| `scripts/verify_html.py` | Warned "DB field 'n' missing" on any `DB` that simply uses other field names | Warns only when the field exists on some entries but not all |
| `scripts/inline_media.py` | Converted the HTML file's LF line endings to CRLF on Windows (text-mode write; `file` reported "CRLF line terminators" after one run) | Reads and writes with `newline=""`; LF stays LF (rechecked) |
| `scripts/inline_media.py` | Injecting into `<img ... />` produced `<img ... / src="...">` | Inserts before `/>`: `<img id="logo" alt="Logo" src="data:..." />` (rechecked) |
| `scripts/inline_media.py`, others | Non-ASCII dashes and ellipses in console messages printed as `?`/mojibake through a Windows pipe | ASCII messages |
| `scripts/inline_three.py` | Docstring advertised `--pin` and `--examples-base`, which did not exist (`error: unrecognized arguments: --pin r128`); claimed a post-injection verification it did not do | `--pin` (accepts `r128` or `0.128.0`) and `--base` added; after writing, each blob is checked to be present exactly once |
| `scripts/inline_three.py` | Crashed on Windows with `FileNotFoundError: [WinError 2]` calling `npx` (it is `npx.cmd`); `npx -y` also downloads terser silently | Minifier discovery: `GOAT_MINIFIER`, then `terser` or `esbuild` on PATH (resolved with `shutil.which`); `--minifier npx` opts into the download; `--minifier none` embeds as is |
| `scripts/inline_three.py` | `--bloom` with any three newer than r147 would 404 (`examples/js` was removed in r148) | Refuses with a clear message and points to the bundle route |
| `scripts/inline_three.py` | Rewrote the file in text mode (CRLF on Windows) and did not guard against `</script` inside a blob | Keeps the file's line endings; escapes `</script` inside a blob |
| `scripts/serve.py` | Claimed to print "the LAN URL for phone testing" but did not; listened on every interface (`""`), exposing the folder to the network; its banner was lost when stdout was piped (no flush) | Listens on 127.0.0.1 by default; `--lan` listens on all interfaces and prints the LAN address, with a warning in the docstring; output flushed; `.mjs` and `.wasm` MIME types |
| `assets/engine-analyzer.js` | `has()` used a non-global regex, so every engine count printed `(x1)` (three.js page showed `three.js (x1)`; real count 602); `require()` breaks under a `"type": "module"` package.json; dead variable; non-ASCII output | Real counts via `matchAll`; ES module syntax (runs with or without `"type": "module"`, tested both); reports `prefers-reduced-motion` presence and network references; ASCII output |
| `assets/starter-lite.html` | HTML-Sensei gate: FAIL (console error, failed request, offline-self-contained: Google Fonts); WARN forced colours (button loses its shape); reduced motion done by pausing animations once at load in JS | Fonts offline; transparent border; CSS `prefers-reduced-motion` block; `type="button"` |
| `assets/starter-rich.html` | Gate: FAIL (Google Fonts as above; axe `aria-hidden-focus`, serious: a focusable sound toggle inside an `aria-hidden` HUD); WARN forced colours (5 dock buttons); a dead `var r2` line; DB text inserted as HTML unescaped | HUD is a labelled `header` landmark; the toggle is a real `<button aria-pressed>`; dock buttons get a transparent border and `aria-current="page"`; dead line removed; `esc()` for DB text; shortcut keys ignore modifiers and editable fields; `transition: all` replaced by named properties |
| `assets/starter-deck.html` | Gate: FAIL (Google Fonts; axe colour-contrast on the hint, serious; landmark region); WARN hygiene (no `<main>`, two `<h1>`), keyboard (nothing focusable); hint advertised a `G` grid that does not exist; print gave a blank last page once fixed to px (found here: 4 pages for 3 slides) | Rewritten engine (see section 1), `main` landmark, one `h1`, hint at full `--dim` contrast, `G` removed from the hint, `.slide:last-child` no page break, slide titles keep the space where a `<br>` was |
| `references/webgl.md` §3 | Scene skeleton used undefined `bass` and `t` and set `carpetGeo.position` (a geometry has no position) | Delta clock, `const { bass } = bands()`, `carpet.position`; pixel ratio and size set on the renderer |
| `references/tools-games.md` §3 | Idle timer code `idle.setTimeout(gotoAttract, 90000)` throws (calls a method on a number) | `idle=setTimeout(gotoAttract, 90000)` |
| `references/canvas-2d.md` §2 | Engine skeleton advanced time by a fixed 0.016 per frame (double speed at 120 Hz) and never paused when hidden | Delta clock and a `visibilitychange` pause |
| `SKILL.md` | Manifest said "6 test prompts" (there were 9); "60-line" lite starter; stale anchor `verification.md §Runtime`; §8 cited a "§0 structure" that did not exist | Corrected (now 10 prompts, CHANGELOG listed, anchors to §2). The frontmatter description was reworded to add the package line and drop the dashes; it stays under the 1,024-character limit (1,003; the original was 1,009) |
| `references/verification.md` §1 | Said the static gate compiles scripts with `new Function(code)`; the script uses `node --check` | Text matches the script |

### 3. Outdated or unverifiable claims, checked against the source (2026-10-27)

| Claim | Was | Now | Checked against |
|---|---|---|---|
| three.js size | "~620 KB" | r128 `three.min.js` 589 KB | fetched from jsDelivr by `inline_three.py` and measured |
| Bloom postprocessing size | "~2 MB unminified, minify drops ~60%" | about 23 KB unminified, 15 KB minified (r128, six files) | fetched and minified with esbuild here |
| r128 inlined + bloom works | stated | verified: inlined by the script, opened over `file://` in Chrome, `typeof THREE` "object", REVISION "128", one `composer.render()` without error | `probe-three.mjs` run here (Chromium only) |
| GSAP | "100% free since Webflow's acquisition (2025) ... no building competing dev tools"; "~70 KB core" | Free for commercial use, plugins included, under the Standard "No Charge" licence effective 30 April 2025; restricted from no-code visual animation builders competing with Webflow; `gsap.min.js` 3.15.0 73 KB | gsap.com/standard-license (fetched); npm registry (3.15.0, licence field); jsDelivr (measured) |
| react-bits | not mentioned | MIT + Commons Clause: projects only, fetched verbatim with its notice, never redistributed in a skill, plugin or bundle | `DavidHDev/react-bits` LICENSE.md (fetched) |
| jsfxr | BSD | Unlicense | GitHub licence detection |
| animate.css | MIT | Hippocratic License 2.1 in the repo LICENSE (npm 4.1.1 metadata says MIT); flagged to read before commercial use | repo LICENSE (fetched), npm registry |
| paper-design/liquid-logo | Apache-2.0 (together with shaders) | PolyForm Shield 1.0.0 (reference only); `paper-design/shaders` Apache-2.0, npm 0.0.82 (pre-1.0); "29 shaders" replaced by "a set of shaders" (count not verified) | repo LICENSE (fetched), GitHub, npm |
| ruucm/shadergradient | MIT | MIT per the npm packages (`@shadergradient/react` 2.4.20); no licence file in the repo root | GitHub API (no licence; root listing), npm |
| vanruesc/postprocessing | MIT | moved to `pmndrs/postprocessing`, Zlib | GitHub (301 redirect), npm |
| nikdelvin/liquid-glass, collidingScopes/liquid-logo | "check repo" | MIT | GitHub licence detection |
| html2canvas | "~195 KB min" | 1.4.1, 194 KB minified | jsDelivr (measured), npm (MIT) |
| twemoji | CC-BY 4.0 | graphics CC-BY 4.0, code MIT | GitHub (MIT detected for the repo) |
| Tailwind UI, Aceternity, Landingfolio | free tier / study only | Tailwind Plus (paid) and Aceternity Pro never redistributed; Landingfolio study only, never vendored (HTML-Sensei doctrine 4) | HTML-Sensei entry skill section 7 |
| Shadertoy | "CC-BY-NC (study/re-derive)" | "CC BY-NC-SA by default, ideas only" as HTML-Sensei records; **not rechecked**: shadertoy.com/terms returned 403 to the fetch | HTML-Sensei's records only |
| react-three-fiber stack | "≈ 1 MB minified" | kept, marked "an estimate not measured here" | not measured |

Unchanged and judged still right (not re-fetched): fiber@8 with React 18 and fiber@9 with React 19;
Uiverse MIT; Lucide ISC; Heroicons MIT; mdn/dom-examples CC0 (GitHub detection agreed).

### 4. Paths, secrets, personal data, dashes, spelling

- Machine-specific: none found (no drive letters, user folders or secrets). One environment-specific
  line generalised: "Ripgrep missing | Codebuff env var issue" became "not installed or not on PATH";
  tool names `preview_evaluate` and `preview_screenshot` generalised to "your browser tool".
- `serve.py` no longer exposes the working folder to the LAN by default (see section 2).
- Em and en dashes: none left in any file. Ranges became "1 to 10"; dashes became colons, commas or
  parentheses. Arrows (→) and the minus sign (−) are not dashes and were kept.
- British spelling in prose and comments (colour, licence as a noun, centre, behaviour, synthesise,
  analyse, artefact, catalogue, towards, grey, recolour, and similar). Code is untouched (`color`,
  `center`, `behavior:'instant'` stay as the web platform spells them), as are proper names
  (Apache License, Hippocratic License, the `web-artifacts-builder` skill, the
  `engine-analyzer.js` file name, the `license:` key in the frontmatter).

### 5. Evals (`evals/evals.json`, valid JSON, 10 prompts)

- Eval 4: "size budget stated up front" replaced by: offline check, weight reported as information,
  reduced-motion path.
- Eval 8: the deck now also asserts postMessage presenter sync, no network requests, slide roles and
  `inert`, px print sizing, reduced motion.
- Eval 9: budget-tier assertion replaced by "no budget or one-heavy-library rule; argued on quality,
  licence note per library".
- Eval 10 (new): a WebGL background that stutters on the development laptop must not be faded or
  switched off by device class; target devices named, unverified items stated.
- Eval 1 keeps its 200 KB limit: there the user asked for a budget, which the doctrine allows.

### Verified (fresh runs on the final files)

- `verify_html.py --strict --offline`: PASS on all three starters; on an edge-case page it validates
  the importmap and JSON-LD, passes the module script with top-level await, fails only the broken
  script.
- HTML-Sensei gate, strict `file://`, `--strict`: starter-lite PASS (21 pass, 0 warn, 0 fail),
  starter-rich PASS (21/0/0), starter-deck PASS (20/0/0). Originals for comparison: FAIL with 3, 6
  and 6 failures.
- Functional probe (Chrome, `file://`): 23 of 23 checks pass. Deck: boot and hash, centring at
  1280x720 and at 900x900 with no scrollbars, roles, `inert`, live region, Right / End / Home,
  buttons, hashchange, refresh, synthetic swipe, no running animation under reduced motion,
  presenter opens with notes, presenter Previous drives the deck, deck navigation updates the
  presenter, print to PDF gives 3 pages of 1440 by 810 pt (1920 by 1080 px). Rich: dock routing with
  `aria-current`, key 5, sound toggle `aria-pressed`, no console errors.
- `inline_media.py` on a real 1.6 MB PNG: 144 px PNG 26.6 KB, then a WebP swap; LF kept; exactly one
  data URI.
- `inline_three.py --bloom --pin r128` with esbuild as minifier: 7 blobs, 604 KB; runtime check above.
  `--pin 0.186.0 --bloom` refuses as designed; `--minifier none` path works.
- `serve.py`: `Cache-Control: no-store` returned on 127.0.0.1; `--lan` prints a LAN address.
- `engine-analyzer.js`: real counts; runs under `"type": "module"`.

### Not verified

- Firefox and Safari for anything (starters, liquid glass, presenter window, print).
- Real touch hardware (the swipe was exercised with synthetic pointer events only); real screen
  readers; real-GPU frame rates (the gate ran on software GL).
- The `npx` terser path of `inline_three.py` (not run, to avoid an unrequested download); the
  `terser`-on-PATH path (terser is not installed here; the esbuild path was run).
- `inline_three.py` on macOS or Linux; `serve.py --lan` from a second device.
- The Shadertoy default licence (fetch refused); the react-three-fiber bundle weight.

## Owner request, 2026-10-28

- The owner's name and pen name were removed from `references/case-studies.md` (two course briefs now
  describe the courses without naming their author). No other file carried them.
