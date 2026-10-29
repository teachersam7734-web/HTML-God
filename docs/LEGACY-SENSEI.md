# Historical HTML-Sensei documentation

This is the original combined-package README preserved for provenance and detailed reference. Package names, installation instructions, verification dates and environment claims below are historical. Use [the current installation guide](INSTALL.md) and [compatibility guide](COMPATIBILITY.md) for HTML God. The current Claude Code namespace is `html-god`; `html-package` and `html-sensei` references below retain their original wording.

---

<!-- Package note added when the combined package was built; the rest of this file is the HTML-Sensei README. -->

# HTML Package

One Claude Code plugin with everything: the **HTML Router** skill (`skills/html-router`, the entry point), HTML-Sensei (all of this README below), and the GOAT HTML (`skills/goat-html`) and HTML-Master (`skills/html-master`) skills. Start by asking for what you want built, or name the Router: "HTML Router: I want to build ...". In this package every skill, agent and command is named `html-package:<name>` (for example `html-package:sensei-reviewer`, `/html-package:sensei-gate`); where a skill or this README writes `html-sensei:<name>`, the same component is meant. Install the ZIP as it is: one top-level folder, `html-package/`, with `.claude-plugin/plugin.json` directly inside.

---

<!--
Format sources (read 2026-10-18, not from memory):
  Plugin manifest, layout, userConfig, ${CLAUDE_PLUGIN_ROOT} / ${CLAUDE_PLUGIN_DATA}, claude plugin validate:
    https://code.claude.com/docs/en/plugins-reference
  Marketplace file, plugin entries, relative "./" sources resolved from the marketplace root:
    https://code.claude.com/docs/en/plugins/marketplace-reference
  Hook configuration, matchers, stdin JSON, exit codes (0 / 2 / other), additionalContext, Stop stop_hook_active and
  last_assistant_message, exec form versus shell form:
    https://code.claude.com/docs/en/hooks
  Plugin MCP servers (.mcp.json with an "mcpServers" wrapper; started automatically when the plugin is enabled; no
  per-server "disabled" field, only a per-project toggle in /mcp):
    https://code.claude.com/docs/en/mcp
-->

# HTML-Sensei

Skills, agents and hooks for building high-end HTML: single-file pages, sites, decks, courses, dashboards, games and
films, with 3D, holograms, shaders, motion, scroll, sound and Blender, verified before anything is called done.

This folder is the plugin. `HTML-Sensei.zip` holds it as a single top-level folder (`html-sensei/`, with
`.claude-plugin/plugin.json` directly inside), which is the shape the plugin installer accepts: upload or install the
ZIP as it is.

For one session without installing: `claude --plugin-dir <path-to>/html-sensei`.

In the source tree the plugin also sits inside a one-plugin marketplace (its parent folder holds
`.claude-plugin/marketplace.json`), so it can be installed by path from there:

```
claude plugin marketplace add <path-to-source>/html-sensei
claude plugin install html-sensei@html-sensei
```

## Doctrine

1. Best quality is the default. No page-weight budget unless the user asks for one; weight is reported, never gated.
2. Do not optimise for the development machine. Judge by the target device; if something cannot be verified here, say
   so, never quietly substitute something cheaper.
3. Evidence before claims. A screenshot is not a functional test; a "finished" film needs the file on disk.
4. Licences are part of the build. Every vendored or ported piece has a row in the project's licence ledger.
5. Reduced motion, keyboard, contrast and forced colours are built in, not added.
6. Portable. Node (ESM, no dependencies) or Python standard library; tools are discovered, never hard-coded.

## Layout

| Path | What |
|---|---|
| `.claude-plugin/plugin.json` | manifest (name, description, two opt-in MCP switches and the Blender Lab clone folder in `userConfig`) |
| `hooks/hooks.json` | every hook below |
| `hooks/*.mjs` | the hook programs |
| `hooks/test/` | fixtures and `run.mjs`, the test runner |
| `lib/` | shared modules: `discover`, `profile`, `ledger`, `gate`, `approval`, `eol`, `state`, `hookio`, `mcp-optin`, `lint/*` |
| `.mcp.json` | the Blender MCP servers, off until switched on |
| `skills/` | the 25 skills, each with `SKILL.md`, references, scripts and examples |
| `agents/` | the 16 agents (section "Agents and commands" below) |
| `commands/` | the 5 commands (same section) |
| `LICENSES/` | third-party notices: `README.md` lists every shipped third-party file (the Vazirmatn font subset, the motionmaxxing eases in `motion-kit.js`, the React Bits licence template) with its path, licence and notice; the licence texts (`OFL-1.1-Vazirmatn.txt`, `Apache-2.0.txt`) and motionmaxxing's `NOTICE` sit beside it |

## The project profile

Every hook reads `.sensei/profile.json` from the project (the nearest one above the file being edited, else the project
root). Missing keys take these defaults. A missing file means the project has not opted in: the lint hooks
(`lint-web`, `lint-3d`, `lint-determinism`) stay silent, the Stop hook only notes, the SessionStart probe says so in
one line, and only the guards (secrets, browser kills, paid calls, licences, the reviewer) apply. `/sensei-start`
writes the file:

```json
{ "deliverable": "single-file", "offline": true, "languages": ["en"], "rtl": false, "budget": null,
  "tier": "premium", "motion": "cinematic", "licence_mode": "commercial", "react": false,
  "verify": { "browsers": ["chromium"], "widths": [375, 768, 1440] } }
```

Where the architecture lists alternatives the first is the default, except `licence_mode`, which defaults to
`commercial` because the stricter licence rules are the safe side when nobody has said.

An optional `outputs` key links a source to the file packed from it, so the Stop hook accepts a gate of the packed
file for an edit to the source (paths relative to the project; a key ending in `/` covers a folder):

```json
{ "outputs": { "src/index.html": "dist/page.html", "src/": ["dist/page.html"] } }
```

## Agents and commands

<!--
Format sources (read 2026-10-27, not from memory):
  Subagent files, every front matter field (name, description, tools, disallowedTools, model, skills, effort, color
  and the rest), the skills preload, nesting and the Agent tool:
    https://code.claude.com/docs/en/sub-agents
  Plugin agents (supported fields; hooks, mcpServers, permissionMode and initialPrompt ignored for plugin agents;
  names <plugin>:<name>) and plugin commands (commands/<file>.md becomes /<plugin>:<file>, same front matter as skills):
    https://code.claude.com/docs/en/plugins/components
  ${CLAUDE_PLUGIN_ROOT} substituted anywhere in skill, command and agent Markdown, but not exported to Bash:
    https://code.claude.com/docs/en/plugins-reference (now the plugin manifest reference)
  Command front matter (description, argument-hint, allowed-tools, disable-model-invocation, model), $ARGUMENTS and
  $N, the !`command` injection and why it aborts an invocation on failure:
    https://code.claude.com/docs/en/slash-commands
-->

Agents live in `agents/<name>.md` and load as `html-sensei:<name>` (invoke one explicitly with
`@agent-html-sensei:<name>`, or let the coordinator dispatch it). Each prompt says when it is dispatched, which skills
it reads first and which sections, the doctrine lines for its domain, its working method (prove the hardest slice
first, one change at a time, verified in the running page), the gate it must pass before reporting (always
`skills/sensei-verify/scripts/verify.mjs` in strict `file://`, plus its domain gate), the hooks that will fire on its
work, what it must never do, and its report format (files, what was verified and on what, what was not, defects).

Skills are read, not preloaded. The agent front matter has a `skills` field that injects whole skills at start, but
the documentation does not say how a plugin skill is named in it, and several of these agents need four or five
skills of up to 330 lines each. So every prompt tells the agent to read the exact `SKILL.md` and references by their
`${CLAUDE_PLUGIN_ROOT}` path, in order, and which sections matter; the agent can still load any skill with the Skill
tool.

| Agent | Model | Why this model |
|---|---|---|
| `sensei-art-director` | opus | taste is the work: reading a brief, inventing three to six directions that differ in structure, judging slop in screenshots |
| `sensei-interaction-engineer` | sonnet | broad but codified: four tested skills with self-tests that measure behaviour at named stops; the judgement is bounded by the direction it receives |
| `sensei-motion-director` | opus | direction, rhythm, carries and the G1 and G4 judgements by eye; the gates only catch what can be measured |
| `sensei-film-renderer` | opus | diagnosing non-determinism, chunk and mux failures and reading sheets of the master needs careful reasoning; a wrong call wastes hours of render |
| `sensei-animator` | opus | acting, timing for reads and the three-zoom review are judgement on pictures, not rules |
| `sensei-3d-engineer` | opus | scene, asset and compression trade-offs and context-loss state are subtle; failures are silent (a perfect DOM over a dead canvas) |
| `sensei-hologram-builder` | opus | shader maths (the transpose trap), flash safety and look-tuning from stills |
| `sensei-shader-artist` | opus | writes GLSL from ideas only (no lygia or Shadertoy code), measures coverage and contrast, tunes mood to numbers |
| `sensei-blender-artist` | opus | bpy across API breaks, rigging and export settings, and honesty about scripts no Blender has run |
| `sensei-sound-designer` | sonnet | the engine, scheduler and bake are tested code; the work is mapping events to sounds and proving levels numerically |
| `sensei-course-builder` | sonnet | volume work driven by a refusing validator and scripted learner paths; consistency over many lessons matters more than invention |
| `sensei-deck-builder` | sonnet | a tested own-core deck and checks (stage, keys, PDF page count) carry the craft; content structure comes from the outline |
| `sensei-dataviz-engineer` | sonnet | form and palette choice follow tables and a palette validator; correctness is checked by script |
| `sensei-game-engineer` | sonnet | the loop, input, pause and saves are tested code with a harness that runs the user's page; the rules are explicit |
| `sensei-packager` | sonnet | procedural: builder, refusals, notices, ledger and the strict gate; deviation is the risk, not lack of insight |
| `sensei-reviewer` | opus | independent judgement across three lenses on pictures, reports and licences, and spotting claims the evidence does not support |

None was chosen for cost. Where sonnet is named, the domain's craft is carried by tested scripts and refusing gates,
so following the method exactly matters more than open-ended judgement; any agent can be run on another model with
the `model` field if a project needs it.

`sensei-reviewer` is read-only: its `tools` omit Write and Edit and `disallowedTools` removes Write, Edit, MultiEdit,
NotebookEdit and Agent. It keeps Bash and PowerShell to run the gates, which write only into `.sensei/gate/`. The shell
path is closed by the `guard-reviewer` hook: Claude Code puts `agent_id` and `agent_type` in the hook input for a
subagent's tool calls (hooks reference, "Common input fields"), and when `agent_type` is `html-sensei:sensei-reviewer`
the hook refuses commands that write (see Hooks below). The prompt says the same, so the rule holds by instruction too.
What the hook cannot see: a script inside the plugin that writes somewhere unexpected (only the plugin's own gates are
allowed, and they write to `.sensei/gate/`).

The media skill `sensei-lottie-rive-video` has no agent of its own: `sensei-interaction-engineer` owns interface
Lottie, Rive and video, `sensei-motion-director` owns them inside a film.

Commands live in `commands/<name>.md` and run as `/html-sensei:<name>` (or `/<name>` when no other plugin uses the
name). Each passes `$ARGUMENTS` through and calls the plugin's scripts by `${CLAUDE_PLUGIN_ROOT}` path:

| Command | Does |
|---|---|
| `/sensei-start [brief]` | profile from a short brief through `skills/html-sensei/scripts/profile.mjs` (at most four questions, only when the brief leaves something open), the ledger and state started, skills and agents named |
| `/sensei-gate <target> [options]` | the umbrella gate `skills/sensei-verify/scripts/verify.mjs` in strict `file://`, then a summary with the not-verified list verbatim |
| `/sensei-render <film.html> [out.mp4] [options]` | preflight, probe, a look-first sheet, chunked render, contact sheet of the master, film gates, then the umbrella |
| `/sensei-pack <entry.html or build.json> [out.html]` | `build-single.mjs` or `inline.mjs`, ledger check, then the strict gate on the packed file |
| `/sensei-licences [project]` | `lib/ledger.mjs list`, rows missing notices, inlined code with no row, forbidden sources |

`/sensei-start`, `/sensei-render` and `/sensei-pack` set `disable-model-invocation`, so only a person starts them. No
command uses the `!` injection: a failing injected command aborts the whole invocation, and the gates exit 1 on a
failing page, which is exactly when the summary is needed.

## Hooks

| Event | Matcher | Hook | Effect |
|---|---|---|---|
| SessionStart | | `probe.mjs` | in a project with a `.sensei` folder: finds Node, Chrome / Chromium / Edge (including Playwright's own builds), Playwright or playwright-core, ffmpeg, Blender, uv; writes `.sensei/env.json`; tells Claude what exists. Anywhere else: one line saying there is no profile, no discovery, no file. Never blocks |
| PreToolUse | Write, Edit, MultiEdit | `guard-licence.mjs` | blocks never-ship source code (React Bits, Tailwind Plus, Aceternity Pro, Landingfolio, SceneAI) written into any plugin folder, including React Bits-shaped components with no URL (the registry's folder layout or one of its distinctive component names); blocks ideas-only code (onetake, no-licence repos, lygia, Shadertoy) anywhere; blocks a Shadertoy-shaped shader (`mainImage` with `iTime`, `iResolution` or `iChannel`) in a plugin path and warns in a project; lets own code that credits a source in an "inspired by" or "idea from" comment through with a reminder to add a ledger row with use `idea`; blocks non-commercial code in commercial mode (warns in personal mode); warns when copied code in a project lost its notice |
| PreToolUse | Write, Edit, MultiEdit, Bash, PowerShell | `guard-secrets.mjs` | blocks API keys and tokens in files or command lines (provider formats, `Bearer` headers with a literal token, and literals assigned to a name whose whole segment says secret, token, password or api key and whose value looks random by an entropy test; `authorName`, `tokenizer`, `TOKENIZER_PATH` and documented example keys pass), and commands that would print them (`echo $X_KEY`, `printenv`, `node -p process.env.X_KEY`, and `cat`, `sed`, `grep`, `node -e` or `python -c` reading `.env`). Concatenated keys are not detected |
| PreToolUse | Bash, PowerShell | `guard-process.mjs` | blocks killing browsers by image name (the browser must be the kill target: after `/IM`, `-Name`, `pkill`, `killall`, in a `pgrep` substitution or a `grep` before `xargs kill`; wildcards such as `chr*` count; comments and script names do not), paid generation without an approved plan hash, and esbuild bundles of three.js loaders without `--define:import.meta.url` |
| PreToolUse | Bash, PowerShell | `guard-reviewer.mjs` | only when the hook input's `agent_type` is `html-sensei:sensei-reviewer`: blocks shell commands that write (redirection outside `.sensei/gate/`, `sed -i`, `rm`, `mv`, `cp`, `Set-Content`, `Out-File`, tree-changing git, installs, `node -e` or `python -c` that writes, node scripts outside the plugin, `ledger.mjs add`). Every other agent and the main conversation are untouched |
| PreToolUse and PostToolUse | Write, Edit, MultiEdit | `keep-eol.mjs` | records a file's line endings before a write and reports, with the restore command, when the write changed them; logs the edit for the Stop hook. Never blocks |
| PostToolUse | Bash, PowerShell | `record-shell.mjs` | logs deliverables a command clearly wrote (redirection, `tee`, `sed -i`, `Set-Content`, `Out-File`, `cp` and `Copy-Item`, build or inline scripts with an output path, `node -e` with `writeFileSync`) as edits for the Stop hook. A script that writes files it does not name on its command line stays invisible; gate after it anyway. Never blocks, prints nothing |
| PostToolUse | Write, Edit, MultiEdit on web files, in a project with a profile | `lint-web.mjs` | reduced motion for each animation system (CSS keyframes: every animated selector reset under `prefers-reduced-motion: reduce`, by selector name; rAF loops, WAAPI, GSAP, Motion, Lottie: a guard in script code; View Transitions: a script guard or a `::view-transition` reset), `transition: all`, smooth scroll on `html`, unguarded scroll-driven and View Transition features, `cursor: none` without a hover query, drag without keys, toasts without a live region, network references when offline (`src`, `srcset`, `poster`, SVG `href`, `object data`, `form action`, CSS `url()` and `@import`, every `import` form, `fetch`, `XMLHttpRequest`, `Worker`, `WebSocket`, `EventSource`, `sendBeacon`, `.src =`; not `<link rel=canonical, alternate, license, author, me>`), vendored code without a notice, ScrollTrigger markers. Comments are ignored. Warns |
| PostToolUse | same, when WebGL or WebGPU is present | `lint-3d.mjs` | the 3D lane's tested `lint3d.mjs` rules (transposed matrix multiply, including `p * modelViewMatrix` through a variable; context loss; pixel-ratio cap; pause when hidden; Draco from a CDN; `</script` inside an inline script; playsinline and the rest), read with comments removed. Warns |
| PostToolUse | same, when `window.seek`, `__seek` or `renderFrame` is present | `lint-determinism.mjs` | `Date.now`, `performance.timeOrigin`, `document.timeline.currentTime`, unseeded random (including `crypto.randomUUID`), timers, free-running CSS animation (a paused animation driven from seek through `getAnimations()` and `currentTime`, or a negative delay from t, passes), GSAP and media in a seek page. Warns |
| Stop | | `gate-claim.mjs` | when a sentence of the reply claims done (done, finished, ready, shipped, complete, works, live, good to go, all N checks pass; a sentence that negates itself, a question, a condition, or a progress note with "next" or "so far" is not a claim) and a deliverable edited this session has no covering gate report, sends Claude back once to run the gate. Covering: a passing report written after that file's last edit whose `target` (or `targets`, `outputs`, `sources`) is the file or a folder holding it, or is the packed output named for it in the profile's `outputs` (which must be newer than the edit); a report with a content hash must still match its target; CSS, JS and other assets are covered by a page report in a folder above them; a fresh failing report always blocks. Films: an MP4 and a contact sheet newer than the last edit. In a project with no profile it only tells the user |

Blocking hooks exit 2 with a message that says what to do instead. Warning hooks exit 0 and pass their findings to
Claude as `additionalContext`. A hook that crashes exits 1, which Claude Code treats as a non-blocking error, so a hook
bug never stops the work. If Node is missing the shell reports "command not found", which is also non-blocking.

Hook commands use the shell form `node "${CLAUDE_PLUGIN_ROOT}/hooks/<hook>.mjs"`, quoted, which runs the same way in
Git Bash, PowerShell and `sh` on every platform and on Claude Code releases that predate the exec form (`args`).

Hook state (the edit log, line-ending snapshots, the once-per-edit Stop mark) lives in `${CLAUDE_PLUGIN_DATA}/state`,
never in the user's project, and is pruned after seven days.

### Paid generation approvals

`guard-process` refuses calls to paid generation services until the plan is approved:

1. Write `.sensei/plan.md`: what will be generated, by which service and model, how many calls and retries, the
   estimated cost.
2. Show it to the user and wait for an explicit yes.
3. Record the user's words: `node "${CLAUDE_PLUGIN_ROOT}/lib/approval.mjs" approve --words "<their words>" <project>`.

The record holds the plan's SHA-256; any later edit to the plan voids it. Recording is bookkeeping, not consent: never
record an approval the user did not give. API keys go in the environment or in a `userConfig` option marked
`"sensitive": true`, never in files.

## Command-line tools in lib

| Command | Does |
|---|---|
| `node lib/discover.mjs [--json]` | the same tool discovery the probe runs |
| `node lib/lint/web.mjs page.html` | lint-web rules, every finding |
| `node lib/lint/three.mjs page.html` | every 3D rule, the lane's `lint3d.mjs` rules with comments ignored, a terminator check that can fire and the transpose rule extended to variables (exit 1 on FAIL) |
| `node lib/lint/determinism.mjs page.html` | the seek contract |
| `node lib/ledger.mjs list|check [project]` | print and check `.sensei/licences.json` |
| `node lib/ledger.mjs init [project]` | create an empty `.sensei/licences.json` (an existing one is left alone) |
| `node lib/ledger.mjs add [project] --id --licence --use [--name --url --files a,b --notice --attribution --note]` | add or replace a ledger row; exit 1 when the row breaks a rule (an ideas-only source as code, copied code with no notice), 2 on bad arguments |
| `node lib/approval.mjs status|approve ...` | the paid-generation gate |
| `node lib/eol.mjs [--to lf|crlf] file` | report or restore line endings |

## Blender MCP servers (opt-in)

Claude Code starts every MCP server a plugin declares, and plugin servers have no "disabled by default" field. So each
entry in `.mcp.json` runs `lib/mcp-optin.mjs`, which reads a switch from the plugin's options:

* **Off (the default):** it answers as a small MCP server with no tools whose instructions say how to turn it on. No
  Blender, uv or network is touched.
* **On:** it finds `uv` or `uvx` and hands the connection to the real server, run as a separate process. GPL servers
  are called, never embedded or copied.

Turn a server on in the plugin's options (`/plugin`, then configure HTML-Sensei, or `/config`) and restart Claude Code.
A server you never want can also be switched off for a project in `/mcp`.

| Server | Option | What it adds | Setup |
|---|---|---|---|
| `blender-lab`: official Blender Lab MCP (GPL-3.0) | "Blender Lab MCP (official)" and "Blender Lab MCP clone folder" | Blender's own Python API reference and manual, searchable (beats guessing a `bpy` signature); headless `_for_cli` tools that inspect or run code on a `.blend` without a window; small typed scene summaries and preview renders when a session is open | Install uv with the official installer (not `pip install uv`). Clone `https://projects.blender.org/lab/blender_mcp` and set the clone folder option. Install and enable its Blender extension for the live tools. It tracks recent Blender releases closely; an older Blender needs the community server |
| `blender-live`: community blender-mcp (MIT, `uvx mcp-for-blender`) | "Blender live-scene MCP (community blender-mcp)" | Live control of an open Blender scene, viewport captures for a look-and-fix loop, Poly Haven and other asset imports | Install uv. Run `uvx mcp-for-blender install-addon` once (or install `addon.py` by hand), open Blender, start the add-on's server (default `localhost:9876`). The plugin starts it with `DISABLE_TELEMETRY=true` and `BLENDER_MCP_SAFE_MODE=1` |

Which to use when (the full rule lives in the `sensei-blender` skill): repeatable asset builds run as plain
`blender -b -P script.py`; reach for `blender-lab` to look up API facts or audit a `.blend` headlessly; reach for
`blender-live` only when a person is working in an open scene or assets must be imported. Both add-ons open a local
port that runs any Python it is sent: keep it on localhost, never forward it, and keep safe mode on when importing
third-party assets.

## Browser tools the skills need

Every page gate and skill test drives Chrome (or Edge, or Chromium) through Playwright. Discovery looks in the
project's `node_modules`, global installs and the npx cache; when it finds nothing, give it one:

```bash
npm i -D playwright-core
```

or point at an existing copy with `PW` (or `SENSEI_PW`, `PLAYWRIGHT_PATH`) set to a `playwright` or
`playwright-core` folder, and at a browser with `CHROME` when none of the standard locations has one. The
accessibility checks also need axe-core: `npm i -D axe-core`, or `SENSEI_AXE` set to `axe.min.js`. ffmpeg (for
video and audio work) is found on PATH or through `FFMPEG`; Blender through `BLENDER_EXE`. Run
`node lib/discover.mjs` to see what was found.

## Tests

```
node plugin/hooks/test/run.mjs
```

The runner spawns each real hook with the JSON Claude Code sends on stdin, in a scratch folder under the OS temp
directory, and checks the exit code and output: each hook blocks or warns on a bad case and passes a good one. It also
checks that the plugin tree passes its own licence and secrets guards, is LF only, has no em or en dashes, and that
every JSON file parses. It never runs the commands it tests.

## What is verified and what is not

Tool versions of the last full run of the skills' tests (2026-10-28), stated once here so the skills need not repeat
them: Windows 10, Node 24.16, installed Chrome 156, playwright-core 1.64.1 and axe-core 4.14.0 from the global npm
root, ffmpeg 7.1, software GL (SwiftShader). A skill's verification note that names an older version records the run
it describes.

Provenance notes in the skills ("ported from `domain-x.md` in the HTML-Sensei build project's research notes (not
shipped)", "(SENSEI-LOG)") say where a technique or number came from; those files are not part of the plugin.

Scratch folders: the test runners write under the OS temp folder. `sensei-verify/scripts/test-gate.mjs`
(`sensei-verify-test-*`) and `sensei-video-pipeline/scripts/test-pipeline.mjs` (`sensei-vp-*`) remove their folder
when every check passes and keep it, with the path printed, when one fails; `sensei-single-file`'s tests reuse one
named folder (`sensei-single-file`, or `SENSEI_WORK`); the hook runner's own folder is described under Tests.

Verified on Windows 10 with Node 24: the test runner (every case passes); `claude plugin validate` and `--strict` on
the marketplace and the plugin; the plugin loaded with `--plugin-dir` and its SessionStart hook ran and wrote
`.sensei/env.json`; `lib/lint/three.mjs` gives the same findings as `lint3d.mjs` on all ten pages of the 3D lane; the
MCP opt-in wrapper answers `initialize` and `tools/list` when off.

Agents and commands (checked 2026-10-27): `claude plugin validate` passes on the marketplace and the plugin with one
warning, the missing `version` in the manifest, so `--strict` now fails on that warning alone. The warning is kept on
purpose: the owner's rule is no version numbers in deliverables, so `plugin.json` carries none, and the plugin is not
to be given one to quiet the validator; loaded with
`--plugin-dir`, the session's init listed all 16 agents as `html-sensei:<name>` and the 5 commands, and the debug log
reported 5 commands, 25 skills and 16 agents loaded. A script checked that every `${CLAUDE_PLUGIN_ROOT}` path, skill
name and script named in the agents and commands exists, that the front matter parses, and the text rules (LF only, no
long dashes, British spelling). Not verified: any agent or command actually run by a model (the model call was not
available). The gate command is `/sensei-gate`, renamed from `/sensei-verify` so it no longer shares the
`html-sensei:sensei-verify` name with the skill (the CLI listed only one entry for that name).

Not verified: the other hooks firing inside a live Claude Code session (only through the runner with the documented
stdin JSON); macOS and Linux runs (discovery paths there are written from each platform's standard locations, not
tested); the Blender MCP servers switched on (that downloads and runs third-party servers and needs Blender, which this
machine does not have); ffmpeg and Blender discovery on a machine that has them.
