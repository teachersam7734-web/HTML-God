---
name: sensei-verify
description: The HTML-Sensei gate harness. Opens a page the way a user will (strict file:// by default, network blocked), runs every check a script can run (errors, offline self-containment, screenshots at the profile's widths, canvas pixels, reduced motion, forced colours, dark scheme, axe three times, a keyboard walk with a focus-ring pixel test, reflow at 320 and 640 px, text spacing, blocked storage, smoothness counters, routes and scripted steps), makes a contact sheet, and writes the report the Stop hook reads, saying plainly what it did not check. The umbrella script also runs the 3D, film and determinism gates of the other skills. Use when someone says verify, test it, check it, QA, audit, is it accessible, does it work offline, did it break, run the gate, prove it works, before release, or before writing "done". Fixing what it finds belongs to the skill that owns that domain.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-verify

Evidence before claims. One command opens the deliverable like a user, checks what can be checked, writes
`.sensei/gate/<name>.json` (the file the Stop hook `gate-claim.mjs` reads), and lists what it could not check. Weight
is reported, never failed. Software-GL frame rates are reported as relative, never used to cut an effect.

## 1. When to use

At the end of every production loop; the quick subset after each big edit of a 3D, shader or motion page; the full
gate before any "done", "finished" or "ready"; both protocols for anything that will be hosted and also emailed.

Another skill owns it instead:

| Request | Skill |
|---|---|
| Fixing a reduced-motion path, contrast token, focus style or forced-colours border | the domain skill (`sensei-motion-ui`, `sensei-tokens-theming`, `sensei-ui-components`) |
| 3D-specific gates (frames at two times, context loss round trip) | `sensei-3d` (`gate3d.mjs`, called by this skill's umbrella) |
| Film gates G0 to G5, the storyboard gate | `sensei-motion-graphics` (`film-gates.mjs`, called by the umbrella) |
| Determinism hash, rendering, contact sheets of an MP4 | `sensei-video-pipeline` (`render.mjs --probe`, `sheet.mjs`, called by the umbrella) |
| Packaging into one file, the file versus http matrix, hosting | `sensei-single-file` |
| Design quality, slop, taste | `sensei-direction`, and a person or model looking at the contact sheet |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Which script | `verify.mjs` (umbrella) or `sensei-gate.mjs` (page only) | the umbrella before any claim (it runs every gate that applies and writes the combined report last); the page gate alone while iterating |
| File access | strict `file://` (default), `--lenient-file` | strict always for a single file: it is what a double-click gets. Lenient only to reproduce a dev server, and say so |
| Protocol | `--mode file`, `http`, `both` | file for a single file, http for a folder or hosted site, both when it will be hosted and also emailed |
| Network | blocked and failed (default), `--allow-external` | the profile's `offline`; `"offline": false` makes external requests warn |
| GL | software (default), `--gpu` | `--gpu` on a machine with a real GPU; only then do frame rates mean anything |
| Checks | all (default), `--checks` subset, `verify.mjs --quick` | subset while iterating; the full set for the final, newest report |
| Widths | the profile's `verify.widths`, else 375, 768, 1440 | `--widths` to add a breakpoint the design uses |
| Behaviour beyond the first screen | `--routes`, `--steps file.json` | routes for states; steps for component behaviour (dialogs, menus, tabs, quiz flows). Steps start from a fresh load of the target, not from the page the last route left; `--steps-after-routes` to chain them |
| Strictness | default, `--strict` | `--strict` for a release: warnings fail (weight never does) |

## 3. Core technique

```
S="${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts"
node "$S/verify.mjs" page.html                       # umbrella: page gate, plus 3D, film and determinism gates when they apply
node "$S/verify.mjs" dist/page.html --steps flows.json --strict   # page-gate options are forwarded as given
node "$S/sensei-gate.mjs" page.html                  # the page gate alone
node "$S/sensei-gate.mjs" page.html --checks load,net,canvas   # quick, after a shader edit
node "$S/sensei-gate.mjs" dist/ --mode both --steps flows.json  # a folder, both protocols, scripted behaviour
node "$S/gate-fresh.mjs"                              # is the newest report still true of the files now?
```

The umbrella forwards every page-gate option (`--steps`, `--routes`, `--strict`, `--mode`, `--checks` and the rest),
with or without `--` before them, and exits 2 on any option it does not know, so an option can never be dropped while
the report says PASS; the run header's `page-gate options:` line and the report's `page_options` show what ran. Run
from the project root, or pass
`--project DIR`: the report goes to `<project>/.sensei/gate/`, the folder the Stop hook reads (`CLAUDE_PROJECT_DIR`,
else the current folder). Playwright is discovered (`SENSEI_PW` or `PW`, then `node_modules` up from the cwd and the
target, then the global npm root); the browser too (`SENSEI_CHROME`, `CHROME`, `CHROME_PATH`, then installed Chrome or
Edge, then Playwright's own build). Installed Chrome is preferred because it has H.264 and AAC; the managed Chromium
does not, so media checks would lie. axe-core: `SENSEI_AXE`, then `node_modules`, then global; missing means `skip`
with the install command, never a fake pass. If nothing is installed: `npm i -D playwright-core axe-core` in the
project (no browser download when Chrome or Edge exists).

The six design decisions that make it honest:

1. **Strict file mode.** No `--allow-file-access-from-files`: with it, sibling fetches, Workers and module scripts
   "work" over `file://` and the most common single-file failure hides.
2. **Offline is enforced.** Every request off the page's origin is recorded and aborted, so a page cannot pass because
   a CDN answered.
3. **Pixels, not DOM, for canvases.** A dead WebGL canvas has a perfect DOM. Each canvas is isolated (everything else
   hidden, magenta behind it) and photographed twice, 450 ms apart.
4. **A scroll pass before every capture**, so scroll reveals and lazy media are not mistaken for empty space.
5. **A fresh browser context per variant** (width, reduced motion, forced colours, dark, blocked storage, each axe
   run), so preference emulation is exact and nothing leaks.
6. **Honest by construction**: every report carries the not-checked list; measurements that are not judgements
   (weight, software-GL frame rates, a screenshot to compare by eye, an inconclusive reduced-motion comparison) are
   `not-verified` in the hook report, never `pass`.

The report the hook reads (written through the plugin's `lib/gate.mjs`, so the two cannot drift):

```json
{ "gate": "page-html", "target": ".../page.html", "at": "...", "verdict": "pass | warn | fail",
  "checks": [{ "id": "keyboard", "status": "pass | fail | warn | skip | not-verified", "detail": "..." }],
  "verified": ["..."], "not_verified": ["...every check it could not make..."] }
```

plus the full gate fields (freshness hash, counts, failing ids, browser, profile, artefact paths, contact sheet). The
full `report.json`, `report.md`, screenshots, ARIA tree and contact sheet go to `.sensei/gate/<name>/`. Exit 0 for
pass or warn, 1 for fail, 2 when the harness could not run. Every option, every check and both formats:
[references/checks.md](references/checks.md).

**The review loop** (detail and the hand-off format: [references/review-loop.md](references/review-loop.md)): run;
open the contact sheet and failing shots with the Read tool and look; fix causes, not flags; re-run the affected
`--checks`; run the full umbrella once at the end so the newest report covers everything; hand off with the verified
list, the warnings kept and why, and the not-verified list verbatim.

**Scripted behaviour** (what a Tab walk cannot prove), a steps file. Routes run first, in order, on one page; the
steps then start from a fresh load of the target in a new browser context, so a route that switched the language or
the theme cannot change what they see. To test a state, make it step 1 (`click` the language button);
`--steps-after-routes` chains them onto the last route instead:

```json
[{ "do": "click", "sel": "#open" }, { "do": "press", "key": "Escape" },
 { "do": "eval", "expr": "document.activeElement.id", "expect": "open" }, { "do": "shot", "name": "closed" }]
```

Accessibility depth: [references/accessibility.md](references/accessibility.md). Smoothness, counters, the trace
recipe: [references/performance.md](references/performance.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| The page gate | [scripts/sensei-gate.mjs](scripts/sensei-gate.mjs) with [scripts/lib/discover.mjs](scripts/lib/discover.mjs), [scripts/lib/server.mjs](scripts/lib/server.mjs), [scripts/lib/inpage.mjs](scripts/lib/inpage.mjs) | verified |
| The umbrella over every gate | [scripts/verify.mjs](scripts/verify.mjs) | verified (page and 3D branches); film branch runs scripts tested in their own skills |
| Freshness check before a claim | [scripts/gate-fresh.mjs](scripts/gate-fresh.mjs) | verified |
| The gate's self-test (45 assertions, including the real Stop hook, option forwarding and the steps start) | [scripts/test-gate.mjs](scripts/test-gate.mjs) | verified |
| Fixtures: must fail, must flag, must pass, WebGL seek page | [fixtures/bad-page.html](fixtures/bad-page.html), [fixtures/no-ring.html](fixtures/no-ring.html), [fixtures/good-page.html](fixtures/good-page.html), [fixtures/gl-seek.html](fixtures/gl-seek.html) | verified |
| Dialog behaviour proved by steps | [examples/dialog.html](examples/dialog.html), [examples/dialog.steps.json](examples/dialog.steps.json) | verified |
| Draw-call counter to prove a loop is idle | [references/performance.md](references/performance.md) | verified on `gl-seek.html` |

## 5. Quality bars

- Verdict pass (or warn with every warning fixed or explained) in strict `file://` mode; no `fail`.
- axe: zero serious or critical violations on mobile, desktop and dark; every `incomplete` item looked at.
- Every focus stop shows a visible change and has a name; no trap; skip link first on multi-section pages.
- Reduced-motion run calm (no infinite animation, no playing video); forced colours keep every control's edge; no
  horizontal scroll at 320 px; no clipping under the spacing overrides; targets at least 24 CSS px.
- No console error, no uncaught exception, no failed or external request.
- CLS 0.1 or less; no load task over 200 ms; frame figures labelled software GL unless `--gpu`.
- The contact sheet looked at; the newest report in `.sensei/gate/` is newer than the last edit; the hand-off carries
  the not-verified list.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | An unpacked page passes, then fails when double-clicked | `--allow-file-access-from-files` makes `file://` behave like http (fetch of siblings, Workers, module scripts) | strict mode by default; `--lenient-file` only on purpose. `gate3d.mjs` and `film-gates.mjs --page` launch with that flag, so only the page gate answers the double-click question | tested (packager run in the research lane) |
| 2 | A dead WebGL canvas reads as alive | a screenshot of a canvas includes overlays and the page behind it | isolate it: hide everything else, magenta sentinel, compare two frames | tested |
| 3 | Full-page screenshot fails or is cut | captures above about 16,384 px fail or clip | clip at 15,000 px and say so | reported |
| 4 | rAF runs at 0 fps, animation-gated logic stalls | a desktop browser pane or an extension tab reported `visibilityState: hidden` | run headless, where pages are visible | tested (field log) |
| 5 | Timing assertions drift | SwiftShader takes 2 to 5 s per screenshot | assert on state, not timestamps | tested (field log) |
| 6 | "Screen-reader tested" written | `ariaSnapshot` is the tree, not speech | never write it; the ARIA tree is an artefact, speech is in not-verified | reported |
| 7 | Playwright "not found" on Windows | a `PW` value that is a folder must load through its `package.json`; a sibling lane deleted the shared `node_modules` mid-run | install Playwright in the project or point `SENSEI_PW` at it; never rely on another project's folder | tested (research lane) |
| 8 | Node deprecation warning from discovery | `shell: true` in `execFileSync` | `execSync` with a string for `npm root -g` | tested (research lane) |
| 9 | Regexes lose their backslashes, a string literal splits across lines | a Python or bash heredoc that edits JavaScript swallows or turns escapes into real newlines | write files with the file tool; `node --check` after any scripted edit | tested (research lane, and again while writing this skill) |
| 10 | Firefox or Safari bug ships | the gate drives Chromium only | listed as not verified in every report | reported |
| 11 | The gate takes a minute | a new context per variant and an 80-stop Tab walk | `--checks` while iterating, the full run once at the end | measured (about 30 s per protocol on a small page) |
| 12 | A page that reads storage unguarded passes elsewhere, fails for private-mode users | Safari private mode and sandboxed iframes throw `SecurityError` | the blocked-storage check; read storage inside `try` | tested |
| 13 | A legitimately black canvas is flagged blank | the blank test is a heuristic (two colours or fewer, spread under 1.5) | almost always a bug; if not, say so in the hand-off | reported |
| 14 | Hooks warn and the gate never runs | no Node on the machine | hooks fail open; say the gate could not run | reported |
| 15 | The Stop hook kept asking for a gate that had run | the research gate wrote `report.json` inside `.sensei/gate/<name>/`, relative to the cwd; the hook reads only `*.json` directly in `<project>/.sensei/gate/` | the gate now writes `<project>/.sensei/gate/<name>.json` through `lib/gate.mjs` | found and fixed while writing this skill |
| 16 | A failure is hidden by a later quick run | the Stop hook judges only the newest report; a passing `--checks load` run after a failing full run looks clean | run the umbrella last: it writes one combined report with the worst verdict of every gate | found while writing this skill |
| 17 | Every later step fails quietly | a scripted click opened a `<dialog>` and never closed it; the rest of the page is inert | close dialogs between steps or start a fresh page | tested (field log) |
| 18 | Escape test passes on one dialog, fails on another | `showModal()` closes on Escape and returns focus to the opener in Chrome; `show()` does not close on Escape | modal UI uses `showModal()`; prove it with steps | tested here (`examples/dialog.html`) |
| 19 | axe passes a page whose focus ring is gone | axe does not test focus visibility | the focus pixel test | tested (no-ring fixture) |
| 20 | A shader page "fails" at 26 fps | software GL frame rates | report as relative; never cut the effect; `--gpu` where a GPU exists | tested |
| 21 | The Stop hook says the report is older than the last edit, right after a fresh gate run | the edited file's mtime is in the future (the system clock moved back; a copy keeps the source's mtime on Windows), and the hook takes the later of the edit time and the file's mtime | touch the file (`fs.utimesSync` to now) and re-run the gate; check the clock | found while testing this skill |
| 22 | `verify.mjs page.html --steps flows.json --strict` reported PASS with no steps run and no strict mode | the umbrella took any `--x` as its own option and never used it; only options after `--` reached the page gate | the umbrella now forwards every page-gate option and exits 2 on an unknown one (`scripts/lib/gate-options.mjs`); test-gate section 7 | found by the independent QC run, fixed and tested |
| 23 | Steps that pass alone fail after `--routes "?lang=fa,click:#bTheme"` | the steps ran on the page the last route left (Persian, theme toggled) | steps now start from a fresh load in a new context; `--steps-after-routes` for the old order; test-gate section 8 | found by the independent QC run, fixed and tested |

More accessibility traps: [references/accessibility.md](references/accessibility.md); more performance traps:
[references/performance.md](references/performance.md).

## 7. Licences

| Piece | Licence | Use |
|---|---|---|
| `sensei-gate.mjs`, `verify.mjs`, `gate-fresh.mjs`, `lib/*`, fixtures, examples | HTML-Sensei's own code | ships in the plugin |
| playwright-core | Apache-2.0 | a dependency the user installs; never vendored into the plugin |
| axe-core | MPL-2.0 | the user installs it; loaded from their disk at run time. If a project vendors `axe.min.js`, keep its header and add a ledger row |

Nothing from a never-ship or ideas-only source is in this skill.

## 8. Verification

Run here (Windows 10, Node 24, installed Chrome, playwright-core and axe-core from the global npm root, software GL,
strict `file://`; the tool versions of the last full run are in the plugin README): `scripts/test-gate.mjs`, 45 of 45
assertions pass, about three minutes; its scratch projects in the OS temp folder are removed when every assertion
passes and kept, with the path printed, when one fails. It proves: the bad fixture fails for each of
its named reasons and its hook report says fail; the no-ring fixture is flagged while axe passes it; the good fixture
passes every check over `file://` and `http://` and the two agree; `gate-fresh.mjs` in its four states; the **real**
`hooks/gate-claim.mjs` blocks "done" with no report, lets it through after a passing gate and blocks it after a
failing one; `verify.mjs` runs the page gate and `gate3d.mjs` on a WebGL seek page and its combined report is the
newest; the umbrella forwards `--steps` and `--strict` without `--` (a failing steps file fails it, a passing one
passes), keeps the old `--` form working, and exits 2 on an unknown option or a missing steps file; steps start from
a fresh load after routes, and `--steps-after-routes` chains them. The dialog steps example passes, and fails as
expected with `show()`. The contact sheets were looked at.

The research version of the gate was also run on a landing page, a WebGL raymarch page over both protocols, a
multi-file project with routes and steps, and the 83 MB Ultra Bookworm file (it passes strict mode).

Not verified: Firefox and Safari; macOS and Linux; a real GPU; phones; screen readers; the film branch of
`verify.mjs` end to end inside this skill (its scripts are tested in `sensei-video-pipeline` and
`sensei-motion-graphics`); everything on the not-checked list in each report.

## 9. Carried by

- Agent `sensei-reviewer` (read-only, never edits): runs `verify.mjs`, reads the contact sheet and failing shots,
  applies its lenses (design quality, accessibility, licences), writes the hand-off. Every builder agent runs the
  gate before reporting; `sensei-packager` runs it in strict file mode on the packed file.
- Command `/sensei-gate`: runs this skill's umbrella.
- Hooks: `gate-claim.mjs` (Stop: a "done" claim after edits needs a passing report in `.sensei/gate/` newer than the
  last edit; for a film, an MP4 and a contact sheet newer than the last edit); `probe.mjs` (SessionStart: records
  Chrome, Playwright and ffmpeg in `.sensei/env.json`); `lint-web.mjs`, `lint-3d.mjs` and `lint-determinism.mjs`
  (PostToolUse: the static half of what this gate proves in a browser).
