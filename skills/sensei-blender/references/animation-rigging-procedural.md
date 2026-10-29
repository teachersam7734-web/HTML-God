# Animation, shape keys, rigs and procedural geometry from code

Every recipe here is in a script under `scripts/blender/`, type-checked against the stubs and **not run in Blender**.

## 1. Scene construction (data API)

```python
import bpy, bmesh
bpy.ops.wm.read_factory_settings(use_empty=True)          # empty, deterministic scene
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.9)
me = bpy.data.meshes.new("Core"); bm.to_mesh(me); bm.free()
obj = bpy.data.objects.new("Core", me); bpy.context.scene.collection.objects.link(obj)
```

Set `scene.unit_settings.scale_length = 1.0` and `system = "METRIC"` at the start (glTF is metres). Capture each
object at creation. `scripts/blender/build_scene.py` builds the whole demo this way (icosphere with a shape key,
torus, three orbiting cubes under an Empty, a skinned tube on a three-bone armature).

## 2. Clips for the web: NLA tracks named after the clips

For each animated datablock (object, armature, shape-key `Key`): insert keys, rename the action, push it onto an NLA
track whose name is the clip name, clear the active action so nothing exports twice. Export with
`export_animation_mode="NLA_TRACKS"`: tracks with the same name on different datablocks merge into one glTF
animation, which three.js plays as one `AnimationClip`. The `keyed()` helper in `build_scene.py`:

```python
def keyed(id_block, clip, insert):
    ad = id_block.animation_data_create()
    insert()                                              # calls keyframe_insert on id_block or its children
    action = ad.action
    action.name = f"{clip}_{id_block.name}"
    track = ad.nla_tracks.new(); track.name = clip
    track.strips.new(action.name, int(action.frame_range[0]), action)   # 4.4+: the slot is assigned for NLA strips
    ad.action = None                                      # only on the NLA, never also active
```

Loops: the last frame equals the first (key one frame past the end for a rotation sweep), linear interpolation for
constant speed, then prove it with a contact sheet (loop seam under 2). Rotation: only the property matching
`rotation_mode` is read; an Euler spin over 180 degrees needs intermediate keys (a single 0 to 360 key pair does not
spin); `export_force_sampling=True` makes the exporter write quaternions.

What glTF animates: node translation, rotation and scale, pose bones, shape-key values. Physics, lights and material
properties are ignored unless the experimental `export_pointer_animation` is on and the mode is baked (`NLA_TRACKS`
or `SCENE`). Simulation results do not export: bake them to shape keys, Alembic, or a vertex animation texture.

## 3. Shape keys (morph targets)

```python
obj.shape_key_add(name="Basis", from_mix=False)
sk = obj.shape_key_add(name="Breathe", from_mix=False)
for i, v in enumerate(obj.data.vertices): sk.data[i].co = v.co * 1.1
sk.value = 0.5; sk.keyframe_insert("value", frame=1)      # the animation lives on obj.data.shape_keys, not the object
```

Export with `export_morph=True` and `export_apply=False` (apply drops shape keys). Faces: a handful of named visemes;
three.js reads them through `mesh.morphTargetDictionary`. Shape-key animation driven by bone transforms is sampled
only when the mesh is a direct child of the armature.

## 4. Rigs

| Need | Route | Script or source |
|---|---|---|
| Two or three joints (tentacle, lamp arm, door, mascot tail) | armature from code, vertex groups by hand, Armature modifier | `build_scene.py` (skinned tube), `rig_and_drivers.py` (two-bone arm with IK) |
| Humanoid or quadruped to keyframe or retarget | Rigify: enable the add-on, add a meta-rig, fit it, `bpy.ops.pose.rigify_generate()`, export deform bones only (`export_def_bones=True`) | `rig_and_drivers.py`, function `rigify_route` (a sketch, never run; Rigify is not in the stubs) |
| Face acting on a landing page | shape keys, not a bone face | section 3 |
| Creature of unusual shape, a GPU available | UniRig proposes a skeleton (a learned model; the skinning model was announced, not released, when studied); check by hand | `sources-and-licences.md` |
| Real-time puppet in the browser | maybe no Blender at all: a three.js procedural rig | `sensei-3d` |

Rules: glTF carries bones, skin weights and sampled motion only. IK, constraints and drivers are baked by sampling
(`export_force_sampling`), or bake them yourself with `bpy.ops.nla.bake`. Keep 4 influences per vertex
(`export_influence_nb=4`), deform bones under 60 for a web character, clips at 24 or 30 fps with
`export_optimize_animation_size=True`. Rigify's generated rig has hundreds of bones (control and mechanism bones):
exporting without `export_def_bones` ships controls the web never uses. Generation needs the meta-rig active in
Object mode; check that the generated object exists afterwards. Test weights with a stress pose (arms up, deep squat)
in the browser; no candy-wrapper collapse at elbows.

Drivers: `rig_and_drivers.py` adds a shape key whose value follows a bone's X rotation through a `TRANSFORMS`
variable. Python driver expressions need auto-run scripts (`--enable-autoexec`); a plugin must not turn that on.

## 5. Procedural geometry

| Route | When | Notes |
|---|---|---|
| `bmesh` | one object, direct control | the default; no add-on |
| Geometry Nodes through plain `bpy` | scatter, arrays, parametric families | `geonodes_scatter.py`: grid, mesh to points, cube instances, random scale, realise instances, apply the modifier, export |
| geometry-script DSL (carson-katri) | agent-authored node trees, if Blender 5.2 or newer and the extension is installed | GPL-3.0 tool: run it, never copy it; one build per Blender minor; `agent.run` reports geometry stats |
| NodeToPython (BrendanParmer) | a person built a node graph in the GUI; turn it into a script | GPL-3.0 add-on; its generated code is the user's own; supports 4.2 to 5.2 when studied |

Node graphs never export. Apply the modifier (`bpy.ops.object.modifier_apply`) or realise instances; GPU instancing
is possible only for children of an Empty (`export_gpu_instances`), and `export_gn_mesh` (instance meshes) is
experimental. After evaluation, print the vertex count (`obj.evaluated_get(deps).data.vertices`): zero means the tree
is wrong. Blender converts float to vector and bool to float silently, so a mis-typed link builds and gives wrong
geometry: check the stats, not just the absence of errors.

## 6. Batch variation with seeds

For many randomised variants (props, backgrounds, texture variants), seed every random choice from one number and
write the seed into the output's name and report, so the same script and seed give the same frames. BlenderProc does
this for datasets (GPL-3.0, downloads its own Blender, pinned to an older LTS when studied): read it as prior art; a
100-line `bpy` loop usually does the job.
