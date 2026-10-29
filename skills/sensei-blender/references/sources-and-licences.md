# Sources studied for this skill, and what each may be used for

Research files are in the research notes of the HTML-Sensei build project (not shipped) of the HTML-Sensei build (named in brackets). Clones were read and
deleted; nothing below is vendored into the plugin.

| Source | Licence | What it is for | Use in projects | In the plugin |
|---|---|---|---|---|
| Blender | GPL-3.0 (the program) | the tool | run it; your scenes and exports are yours | never shipped |
| glTF-Blender-IO, Khronos (`repo-glTF-Blender-IO.md`) | Apache-2.0 | the bundled exporter: 111 options in add-on 5.4.6, animation modes, extension list | run it inside Blender | option names and presets restated in `export-gltf.md` |
| glTF-Transform (`repo-glTF-Transform.md`) | MIT | validate, inspect, compress, build models in code | yes (build tool), pinned | not vendored; installed in the work folder |
| three.js loaders and `AnimationMixer` (`repo-three-gltf-loading-and-model-viewer.md`) | MIT | browser playback | yes, the bundle keeps its licence block | `entry.js` re-exports; no bundle shipped |
| `<model-viewer>` | Apache-2.0 | drop-in viewer, AR | yes, with decoder overrides offline | not shipped |
| Official Blender Lab MCP (`repo-blender-mcp-official.md`) | GPL-3.0-or-later | bundled API docs, headless tools | call it as a separate process | wired opt-in in `.mcp.json`; its briefing restated in our words only |
| Community blender-mcp, ahujasid (`repo-blender-mcp-ahujasid.md`) | MIT | live scene, viewport capture, assets | call it | wired opt-in |
| sandraschi blender-mcp (`repo-sandraschi-blender-mcp.md`) | MIT | headless executor pattern, scripted-operation map | reference | ideas only (runner pattern) |
| dcc-mcp-blender (`repo-dcc-mcp-blender.md`) | MIT | measured modelling pitfalls and a verifier | reference | rules restated; `verify_scene.py` is our own code |
| cc-blender-skill, RobLe3 (`repo-cc-blender-skill.md`) | MIT | skill layout, 5.x action helper, contact-sheet gate | reference | method only; two of its facts are stale (no Draco or KTX2 in glTF, `export_apply=True` by default) |
| 3dviz-pro-max, viettranx (`repo-3dviz-pro-max.md`) | MIT | Blender to three.js hand-off, field-tested bake script, locate-never-install | reference | method only; `bake_for_web.py` is our own code |
| fake-bpy-module, nutti (`repo-fake-bpy-module.md`) | MIT | API stubs for offline type checks | yes (tool) | not vendored; `check_bpy.py` fetches nothing itself |
| geometry-script, carson-katri (`repo-geometry-script.md`) | GPL-3.0-or-later | Geometry Nodes as a Python DSL, Blender 5.2 or newer | run it if installed | never copied |
| NodeToPython, BrendanParmer (`repo-NodeToPython.md`) | GPL-3.0-or-later | turn a GUI node graph into a script | run it; its output is yours | never copied |
| Rigify (bundled) and UniRig (`repo-rigify-and-auto-rigging.md`) | Rigify GPL (with Blender); UniRig licence and training-data terms not checked | rig generation; learned skeletons | Rigify yes; UniRig only after checking its licence, and its output is a draft | never copied |
| Flamenco (`repo-flamenco.md`) | GPL-3.0 | render farm | run it | reference only |
| BlenderProc (`repo-BlenderProc.md`) | GPL-3.0 | seeded procedural render batches (downloads its own Blender) | run it, with the user's yes for the download | reference only |
| Local `blender-web-pipeline` skill zip (`repo-blender-web-pipeline-skill-local.md`) | none stated | nothing: invalid exporter keywords (`export_colors`, `export_custom_props`), a crashing script, `export_apply=True` everywhere | never | never |
| Poly Haven, Sketchfab, Poly Pizza assets (through the live MCP) | per asset: Poly Haven CC0; others vary | assets | check and ledger each asset | never |

Licence ledger: every model, texture or HDRI that enters a project gets a row in `.sensei/licences.json`
(`node ${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs list|check`).

All scripts in this skill are original to this project. The Blender scripts, `contact_sheet.py`,
`blender_locate.py`, `blender_run.py` and the web scripts started in the Blender research lane of this same build and
were adapted here; no third-party code was copied.
