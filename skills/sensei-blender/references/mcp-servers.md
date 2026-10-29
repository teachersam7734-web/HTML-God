# Blender MCP servers: what the plugin wires, what each adds, which to use when

## 1. What the plugin already ships (read-only for this skill)

`plugin/.mcp.json` declares two servers. Claude Code starts every server a plugin declares and has no "disabled"
field for plugin servers, so each entry runs `node ${CLAUDE_PLUGIN_ROOT}/lib/mcp-optin.mjs <id>`:

| Entry | Switch (plugin option, `userConfig`) | Off (default) | On |
|---|---|---|---|
| `blender-lab` | `blender_lab_mcp` ("Blender Lab MCP (official)") plus `blender_lab_mcp_dir` ("Blender Lab MCP clone folder") | answers as a tiny MCP server with no tools whose instructions say how to turn it on; touches nothing | finds `uv` and runs `uv --directory <clone>/mcp run blender-mcp` as a separate process |
| `blender-live` | `blender_live_mcp` ("Blender live-scene MCP (community blender-mcp)") | same stub | finds `uvx` and runs `uvx mcp-for-blender` with `DISABLE_TELEMETRY=true` and `BLENDER_MCP_SAFE_MODE=1`; `.mcp.json` sets `BLENDER_HOST=localhost`, `BLENDER_PORT=9876` |

If a switch is on but something is missing, the wrapper still answers as a stub whose message names the fix: the
clone folder is not set (git clone `https://projects.blender.org/lab/blender_mcp` first), or uv / uvx is not
installed (use the official installer, not `pip install uv`). Turn a server on in the plugin's options (`/plugin`,
configure HTML-Sensei, or `/config`), then restart Claude Code. A server can also be switched off per project in `/mcp`.
Setup notes: `plugin/README.md`, section "Blender MCP servers (opt-in)". This skill does not edit any of these files.

GPL-3.0 servers are called as separate processes, never embedded or copied into the plugin. That is why the wrapper
only spawns them.

## 2. What each server adds over the runner and scripts

| Server | Licence | Adds | Needs |
|---|---|---|---|
| Official Blender Lab MCP (`blender-lab`) | GPL-3.0-or-later | **Bundled Blender Python API reference and user manual, searchable** (`search_api_docs`, `get_python_api_docs`, `search_manual_docs`): the antidote to guessing a `bpy` signature. **Headless `_for_cli` tools**: `execute_blender_code_for_cli(blend_file, code)` and the `get_blendfile_summary_*_for_cli` audits (datablocks, missing files, linked libraries) run `blender --background` on a `.blend` with no window. Code assigns a JSON-serialisable dict to `result`. Live tools (object summaries, screenshots of an area or window, `render_thumbnail_to_path`, `render_viewport_to_path`) when its extension runs in an open Blender | uv, a clone of the repository, a recent Blender (downstream users report the 5.1 series or newer); its extension for the live tools |
| Community blender-mcp (`blender-live`, PyPI `mcp-for-blender`; older name `blender-mcp`) | MIT | **Live control of an open scene** through an add-on socket (`execute_blender_code`, `get_scene_info`), **viewport captures** (multi-angle, camera, wireframe) for a look-and-fix loop, **asset import** (Poly Haven, Sketchfab with a key, Poly Pizza), optional paid text or image to 3D generators | uvx; Blender 3.0 or newer with its add-on (`uvx mcp-for-blender install-addon`, or `addon.py` by hand); Blender open with the add-on's server started |

Researched but not wired (reference only): sandraschi `blender-mcp` (MIT, headless-first, 48 or more tools: a large
tool list in every turn; its subprocess executor is the pattern `blender_run.py` follows), and `dcc-mcp-blender` (MIT,
an embedded HTTP server behind a shared gateway whose installers are `curl | sh` and `irm | iex` one-liners: never run
those without the user's yes). Neither adds anything the runner, the scripts and the two wired servers do not.

## 3. The rule: which to use when

1. **Building a repeatable asset (the default): no MCP.** Write the script to a file in the project, type-check it
   (`check_bpy.py`), run it with `blender_run.py`, verify the artefact. A script plus the runner is reproducible on any
   machine; a live session is not.
2. **Need an API fact for the installed Blender: `blender-lab`'s doc search** (if it is on), else the stubs and
   `get_rna_type()` at run time. Never guess a signature from memory.
3. **Audit someone else's `.blend` without opening a window: `blender-lab`'s `_for_cli` summaries.** One-off
   probes are fine there; anything that builds goes back into a script file.
4. **A person is working in an open Blender and wants the agent to look and adjust, or assets must be imported:
   `blender-live`.** Ask the live session for `bpy.app.version_string` first. Save the `.blend` before the first
   `execute_blender_code`. Work in small steps; after each, capture the viewport and measure (bounding boxes, polygon
   count), not just look. When done, save the final steps as a script file so the scene can be rebuilt headless.
5. **The machine runs Blender 4.x:** `blender-lab` may not support it; use the runner, and `blender-live` for live work.
6. **One back end per task.** Choose at the start and stay on it; two servers driving one scene step on each other,
   and only one client should own the community add-on's socket.
7. **Neither server is ever required.** If both are off, say what they would add and carry on with the runner.

## 4. Safety

* Both add-ons open a local port that runs any Python it is sent, with no authentication. Keep it on localhost and
  never forward the port.
* `BLENDER_MCP_SAFE_MODE=1` (set by the plugin) screens scripts on the MCP path with an allow-list (no `os`,
  `subprocess`, sockets, `eval`, `exec`, `open`, handlers, timers, class registration, `wm.append` or `wm.link`). It
  guards the MCP path only: the socket itself accepts raw code from any local process. Keep it on when importing
  third-party assets: asset descriptions flow into the model's context (prompt injection).
* Telemetry of the community server is on at a minimal level by default; the plugin sets `DISABLE_TELEMETRY=true`.
  Tell the user, as the plugin README does.
* The official server's code runs inside Blender "without any guards" (its own description): no destructive call
  without the user's confirmation, read back after every edit.
* Generators (Rodin, Hunyuan3D, Tripo) send data to third parties and cost money: they fall under the plugin's paid
  generation rule (write `.sensei/plan.md`, get the user's explicit yes, record it with `lib/approval.mjs`). Note
  that `guard-process.mjs` only screens Bash and PowerShell commands against a list of known API hosts; it does not
  see MCP tool calls, so for these generators the rule is enforced by the agent, not by a hook.
* GUI clients on Windows can lose PATH (`spawn uvx ENOENT`); `mcp-optin.mjs` resolves uv and uvx itself through
  `lib/discover.mjs`, which avoids that.

## 5. What was and was not verified

Verified (by the plugin build, recorded in `plugin/README.md`): the opt-in wrapper answers `initialize` and
`tools/list` when off. Read for this skill: `.mcp.json`, `lib/mcp-optin.mjs`, `plugin.json` userConfig, the README.
Not verified: either server switched on (that downloads and runs third-party servers and needs Blender, which the
build machine does not have).
