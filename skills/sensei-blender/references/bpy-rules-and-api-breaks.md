# Writing bpy that survives: the briefing, the Blender 5 breaks, the modelling traps, script hygiene

## 1. The briefing (rules for any model writing Blender Python)

Rewritten in this project's words from the official Blender Lab MCP server's prompt file (GPL-3.0: ideas only, nothing
copied) and checked against the other Blender sources:

1. Inspect before changing; never assume a value that is not there; do not destroy anything without the user's
   confirmation.
2. Prefer the data API (`bpy.data`, `bmesh`) for procedural work: no selection or mode side effects. Use operators
   (`bpy.ops`) for what has no data-API equivalent (modifier apply, bake, render, export, import), and set the context
   they need first.
3. **Mode, active object and selection are three separate things.** Set each one explicitly before every operator,
   and again between operators on different objects.
4. Update the dependency graph before reading computed values (world matrices, modifier results):
   `obj.evaluated_get(bpy.context.evaluated_depsgraph_get())`.
5. In Edit mode use `bmesh` and write it back (`bmesh.update_edit_mesh` or `bm.to_mesh`), or every edit is lost.
6. Link every new object to a collection. Names collide and get `.001` suffixes: keep the object returned at creation;
   never look it up by the name you meant to give it.
7. Check `rotation_mode` before writing a rotation; check unit settings; apply scale before booleans or physics; use
   the world matrix for world positions.
8. Visibility has three independent switches (viewport hide, view-layer exclusion, render disable). A "missing"
   object is usually one of them.
9. Prefer non-destructive modifiers; make a shared datablock single-user before editing it.
10. End each step with one structured line (`print("REPORT " + json.dumps(...))`) and a sentinel, not print soup.
11. Never guess a signature: look it up in the bundled docs (the official MCP's `search_api_docs`), in the stubs
    (`grep -n "def create_icosphere" -A12 bmesh/ops/__init__.pyi`), or at run time
    (`bpy.ops.<x>.get_rna_type().properties`).

## 2. API breaks by series

| Series | Break | What to write instead |
|---|---|---|
| 4.0 | node-group sockets: `tree.inputs.new` and `tree.outputs.new` removed | `tree.interface.new_socket(name, in_out="INPUT", socket_type="NodeSocketGeometry")` |
| 4.2 to 4.5 | Eevee engine id is `BLENDER_EEVEE_NEXT` | pick from `RenderSettings.bl_rna.properties["engine"].enum_items` |
| 4.4 | slotted actions: NLA tracks merge by the action they use, not by track name, in `ACTIONS` export mode | name NLA tracks after clips and export with `NLA_TRACKS` (tracks with the same name on different datablocks merge) |
| 5.0 | legacy `action.fcurves` and `action.groups` removed | `keyframe_insert`, or the channelbag walker below |
| 5.0 | `scene.node_tree` removed | `scene.compositing_node_group`; many compositor nodes replaced by shader-node counterparts |
| 5.0 | `use_nodes` on materials, worlds and scenes is a no-op (a node tree always exists) | guard: `if bpy.app.version < (5, 0, 0): mat.use_nodes = True` |
| 5.0 | Eevee id back to `BLENDER_EEVEE` | same enum probe as above |
| 5.0 | `ImageFormatSettings.media_type` must be set before `file_format` for non-image types | leave the default (image) for PNG frames |
| 5.0 | log format changed, background render progress included | do not parse Blender's stdout for progress; print your own sentinel |
| 5.0 | many compositor and render-pass names changed | regenerate compositor scripts (NodeToPython does it from a GUI-built graph) |
| 5.2 | Geometry Nodes modifier inputs are real properties | `getattr(mod.properties.inputs, socket.identifier).value = 5.0` (the old `mod["Socket_1"]` no longer works) |
| 5.2 | Compare and Random Value socket identifiers changed | pick sockets by name **and** type, never by identifier or index |
| 5.2 | `gpu.init()` for background mode | the first official way to get a GPU context headless (not verified here) |

Version-proof F-curve walker (from the lane; the 5.x layout is layers, strips, channelbags):

```python
def fcurves(action):
    if bpy.app.version < (5, 0, 0) and hasattr(action, "fcurves"):
        yield from action.fcurves
        return
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves
```

Interpolation without touching F-curves: set the preference around `keyframe_insert` (the `linear_keys()` context
manager in `scripts/blender/build_scene.py`).

Socket by name and type (nodes such as Random Value, Compare and Mix repeat one name per data type):

```python
def sock(sockets, name, kind):
    return next(s for s in sockets if s.name == name and s.type == kind and s.enabled)
```

Guard moved calls with `hasattr` (for example `shade_auto_smooth` against the removed `use_auto_smooth`).

## 3. Modelling traps that pass every self-check

From the measured pitfalls skill in dcc-mcp-blender (MIT; summarised in this project's words; its numbers were
measured on the 4.5 LTS series, so re-measure on yours before trusting an exact value):

1. **Size arguments lie.** `primitive_cube_add(size=N)` is a full edge; sphere, cylinder and cone `radius` is a half
   extent. Setting `scale` afterwards halves the intent again, and `obj.dimensions` then reads the number you asked
   for, so a self-check passes on a half-size part. Size with the operator's own argument, or `transform_apply(scale=True)`.
2. **Primitives spawn at the 3D cursor.** Always pass `location=`.
3. **Euler aiming.** A cylinder is built along local +Z; rotating about Z cannot re-aim it. Aim +X with `(0, 90 deg, 0)`,
   +Y with `(-90 deg, 0, 0)`; verify the resulting axis (`matrix_world.to_3x3().normalized() @ Vector((0, 0, 1))`),
   not the Euler tuple.
4. **Only the rotation property that matches `rotation_mode` is read.** The other is stored and ignored.
5. **Flush is not joined.** Touching parts with zero overlap break booleans, shading and physics. Write a connection
   map first (joint, axis, contact face, overlap); default overlap a quarter of the thinner part, never under 1 mm.
6. **`dimensions` includes modifiers and ignores rotation.** Place and verify from the world bounding box.
7. **`scale_length` is applied on export.** 0.01 exported a one-unit cube at 0.01 with no warning. It must be 1.0.
8. **Check mechanically:** overlap per joint, orientation per part, world bounds in a sane range, positive signed
   volume (outward normals), applied scale, no leftover modifiers, export units. `scripts/blender/verify_scene.py`
   does the scene-wide ones (not run: no Blender here).

Rigify assumes 1 unit is 1 metre (a human about 2 units tall); a model built in centimetres "works" and exports tiny.

## 4. Script hygiene

* **Status header on every script:** `verified: <what, on what>` and `not verified: <what>`. A script that was only
  type-checked says "type-checked, not run" until Blender runs it; then the header names the Blender version.
* **Type-check before the first real run** (`scripts/check_bpy.py`). It turns a minute of Blender start-up per typo
  into a second. Two mypy flags are not optional: `--check-untyped-defs` (otherwise unannotated function bodies are
  skipped and a broken script "passes": this happened in the lane, and a control file proved the check was vacuous)
  and `--no-strict-optional` (otherwise `bpy.context.scene` optional-type noise buries real errors).
* **Keep a control.** `check_bpy.py --selftest` must fail on its known-bad call; if it passes, the check is vacuous.
* **Match the stub series to the target.** Latest stubs hide removed APIs (`action.fcurves` still exists in 4.x stubs
  but not 5.x); check 4.2 LTS code against the 4.2 stubs too (`pip download fake-bpy-module-4.2`).
* **Triage:** an unknown keyword argument, or an unknown attribute on a concrete type, is real. Errors that name a
  generic base type (Constraint, Light, Node, NodeSocket, Modifier, Property), the object-data union, mathutils
  iteration, Cycles settings (`scene.cycles`, registered by the add-on) or Rigify operators are stub limits;
  `check_bpy.py` sorts them into `likely_stub_noise`, which is a triage aid, not a proof.
* **The stub wheel of 2026-10-24 includes the glTF exporter's signature** (with the Draco and Meshopt options),
  contrary to the lane's note that add-on operators are absent; Rigify's operators are still absent. Filter exporter
  keywords at run time anyway: the installed Blender's exporter is what counts.
* **What the check cannot catch:** wrong mode or context, nothing selected, geometry that is wrong, behaviour that
  changed without a signature change.
