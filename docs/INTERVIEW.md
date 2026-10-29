# The Creative Observatory

The HTML God interview is a self-contained HTML experience built using HTML-Sensei's Router, direction, form, motion, single-file and verification workflows. Its animated centerpiece is an original Blender-made metallic code-bracket logo with a luminous eye. Actual exported geometry spins in a self-contained WebGL2 viewer, with a glow treatment, pointer rotation and keyboard view controls. The outer orbital rings were removed at the owner’s request. No CDN, browser API key or hosted form service is required.

## Open it

Double-click [interview.html](../interview.html). Seven question chapters cover the idea and audience, deliverable, direction, motion, source material, delivery/language/devices, and constraints. The eighth chapter reviews the brief. Defaults are labelled, every chapter is editable, and drafts save locally when browser storage is available.

In standalone mode, **Submit creative brief** creates a complete HTML-Sensei brief. Download Markdown or JSON, or copy the build request into a Claude Code or Codex session with HTML God installed. A standalone file cannot start an agent by itself; it never claims a build has started.

## Submit and build

Install and sign in to the current [Codex CLI](https://learn.chatgpt.com/docs/non-interactive-mode) or [Claude Code](https://code.claude.com/docs/en/headless), then run from the HTML God folder:

~~~sh
node scripts/interview.mjs --project /path/to/my-creations --agent codex
# or
node scripts/interview.mjs --project /path/to/my-creations --agent claude
~~~

On Windows, quote a project path containing spaces:

~~~powershell
node scripts/interview.mjs --project "D:\My Creations" --agent codex
~~~

Open the printed loopback URL. The last chapter identifies the agent and output destination. **Submit & build** validates the answers, creates the brief and profile, and starts the chosen signed-in CLI. The browser follows progress and offers an HTML preview, entry-file download, complete project ZIP, and build report when output exists. Each build receives a new folder under the selected project; existing projects are not overwritten.

The CLI uses its own authentication, provider usage and normal permissions. Codex runs with a workspace-write sandbox. Claude Code uses acceptEdits, without bypassing permission checks; tools that need approval may be refused in a non-interactive run. If an agent or required tool is missing, the page preserves the brief and reports the limitation. No API keys are requested in the page. Native executables and recognised npm CLI wrappers are supported; custom executable paths can be supplied via HTML_GOD_CODEX_BIN or HTML_GOD_CLAUDE_BIN.

## Output and verification

Each output folder contains index.html and .sensei/brief.md, profile.json, interview.json, build.log and build-report.md. The prompt requires HTML-Sensei's production loop, a real deliverable, and the final verification gate. The UI only reports a verified pass when it finds a fresh passing umbrella report plus a matching file-hash report. A produced file alone is not evidence that accessibility or functionality passed.

Previewed HTML uses an opaque sandbox origin to separate generated code from the builder API. A contained asset server supports local images, fonts, CSS/JS, 3D files and media. The ZIP includes public generated artifacts; hidden files, node_modules, logs and symlinks are excluded. Use the downloaded project for normal hosting and full browser capabilities. The preview may restrict capabilities that require a normal origin.

## Local data and security

The server binds only to 127.0.0.1, checks the Host and Origin, rejects cross-site API requests, and requires a random session token for status and submission. Answers are posted in a body, never a URL. The server generates the brief/profile from an allowlisted schema; it does not trust a client-supplied prompt or filesystem path. No user text is interpolated into a shell command. Quoted source material cannot overwrite Markdown profile sections. Only one build runs at a time.

Before submission, draft data stays in this browser. On submission, the brief goes to the local builder and then to the selected agent's configured provider. Do not paste credentials into project content. Local logs stay in the selected output folder. Closing the browser does not cancel a running CLI process; keep the terminal open until it finishes.

## Accessibility and resilience

Native labelled inputs, radio groups and checkboxes support keyboard use. Errors identify the affected field and move focus there. The interview supports narrow screens, forced colours, text reflow, right-to-left input, and a live reduced-motion preference. Motion can also be paused explicitly. No sound autoplays. Blocked storage keeps the draft in memory; clipboard failure offers a downloaded build request instead.

## Production evidence

The design notes and verification artifacts are in docs/interview/. The automated tests cover standalone export, retained answers, final validation, Persian direction, motion controls, and the local builder's submission and artifact paths. Real paid model generation is deliberately not part of repeatable tests; it depends on the user's signed-in CLI and provider availability.

## Bundled craft used by the interview

HTML-Master supplies the embedded Manrope and Orbitron fonts and the premium-solar atmospheric artwork. HTML-Sensei supplies motion-kit easing, the live reduced-motion gate, and the opt-in procedural SFX engine. The composition adopts GOAT HTML’s rich-starter approach to atmospheric layers and native interaction. Blender 5.2.2 LTS authors the custom logo: the script, editable .blend, GLB, mesh snapshot, transparent poster and run report are included in docs/blender/ and docs/assets/. Browser code is original and does not require a model decoder or a CDN.
