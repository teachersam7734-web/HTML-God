"""Build a small animated scene in Blender from code and export a Draco-compressed GLB.

Headless run (no GUI, no GPU needed for the export):

    blender -b --factory-startup --python-exit-code 1 --python build_scene.py -- --out demo-blender.glb
    blender -b --factory-startup --python-exit-code 1 --python build_scene.py -- --out demo-blender.glb --render still.png

Scene: Core (icosphere + "Breathe" shape key), Ring (torus), OrbitPivot with three cubes,
Tentacle (skinned tube on a 3-bone armature). Two clips, "Idle" and "Orbit", stored on NLA tracks
of those names so the glTF exporter (NLA_TRACKS mode) writes two named animations.

verified: type-checked against the fake-bpy-module-latest stubs (20261024) with scripts/check_bpy.py
          (mypy --check-untyped-defs --no-strict-optional); see SKILL.md Verification for what remained.
not verified: NOT RUN IN BLENDER. Blender was not installed where this was written. Run it once with
          scripts/blender_run.py, read the printed report, then replace this line with the Blender version it ran on.
Copied from blender-demo/blender/build_scene.py in the HTML-Sensei build project's research notes (not shipped) (original to this project).
Works on Blender 4.2 LTS to 5.x by design (version guards below); each guard is marked VERSION.
"""
import argparse
import json
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

FPS, SECONDS = 24, 4
F0, F1 = 1, 1 + FPS * SECONDS  # 1..97, last frame equals first for a seamless loop


def cli():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="demo-blender.glb")
    p.add_argument("--no-draco", action="store_true")
    p.add_argument("--meshopt", action="store_true", help="EXT_meshopt_compression instead of Draco (5.x exporter)")
    p.add_argument("--render", default="", help="also render frame 1 to this PNG")
    p.add_argument("--engine", default="CYCLES", help="CYCLES (CPU, safe without a GPU) or EEVEE (needs OpenGL 4.3+)")
    p.add_argument("--save-blend", default="", help="also save the .blend here")
    return p.parse_args(argv)


# ---------------------------------------------------------------- scene helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = F0, F1
    sc.unit_settings.system, sc.unit_settings.scale_length = "METRIC", 1.0  # glTF is metres; scale_length != 1 bites on export
    return sc


def material(name, base, metallic, roughness, emission=(0, 0, 0)):
    m = bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):  # VERSION: 5.0 always has a node tree; use_nodes is deprecated and a no-op
        m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if any(emission):
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return m


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_from_bmesh(name, bm, mat, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    for poly in me.polygons:
        poly.use_smooth = smooth
    return me


def torus_bm(R, r, seg, side):
    bm = bmesh.new()
    verts = []
    for i in range(seg):
        u = i / seg * math.tau
        row = []
        for j in range(side):
            w = j / side * math.tau
            row.append(bm.verts.new(((R + r * math.cos(w)) * math.cos(u), (R + r * math.cos(w)) * math.sin(u), r * math.sin(w))))
        verts.append(row)
    for i in range(seg):
        for j in range(side):
            a, b = verts[i][j], verts[(i + 1) % seg][j]
            c, d = verts[(i + 1) % seg][(j + 1) % side], verts[i][(j + 1) % side]
            bm.faces.new((a, b, c, d))
    bm.normal_update()  # keep normals outward-consistent
    return bm


def keyed(id_block, clip, insert):
    """Run `insert()` (which calls keyframe_insert on id_block or its children), then park the resulting action
    on an NLA track called `clip`. Tracks with the same name on different datablocks merge into ONE glTF
    animation when the exporter runs in NLA_TRACKS mode."""
    ad = id_block.animation_data_create()
    insert()
    action = ad.action
    action.name = f"{clip}_{id_block.name}"
    track = ad.nla_tracks.new()
    track.name = clip
    track.strips.new(action.name, int(action.frame_range[0]), action)  # VERSION 4.4+: slot is auto-assigned for NLA strips
    ad.action = None  # keep it only on the NLA, not also as an active action (double export)


def linear_keys():
    class _Ctx:
        def __enter__(self):
            self.p = bpy.context.preferences.edit
            self.old = self.p.keyframe_new_interpolation_type
            self.p.keyframe_new_interpolation_type = "LINEAR"
        def __exit__(self, *a):
            self.p.keyframe_new_interpolation_type = self.old
    return _Ctx()


# ---------------------------------------------------------------- the scene
def build():
    sc = reset()
    mats = dict(
        core=material("CoreMat", (0.05, 0.55, 0.95), 0.2, 0.35, (0.0, 0.08, 0.2)),
        ring=material("RingMat", (0.95, 0.75, 0.2), 1.0, 0.25),
        tube=material("TentacleMat", (0.9, 0.25, 0.45), 0.0, 0.5),
        cube=material("OrbiterMat", (0.85, 0.9, 0.95), 0.6, 0.3),
    )

    # Core + shape key
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.9)
    core = link(bpy.data.objects.new("Core", mesh_from_bmesh("Core", bm, mats["core"])))
    core.shape_key_add(name="Basis", from_mix=False)
    breathe = core.shape_key_add(name="Breathe", from_mix=False)
    for i, v in enumerate(core.data.vertices):
        n = v.co.normalized()
        breathe.data[i].co = v.co + n * (0.18 * (1 + math.sin(n.z * 4)))  # Blender is Z-up; the exporter rotates to Y-up
    key = core.data.shape_keys

    def key_breathe():
        for f in range(F0, F1 + 1, 6):
            breathe.value = 0.5 + 0.5 * math.sin((f - F0) / (F1 - F0) * math.tau - math.pi / 2)
            breathe.keyframe_insert("value", frame=f)
    keyed(key, "Idle", key_breathe)

    # Ring
    ring = link(bpy.data.objects.new("Ring", mesh_from_bmesh("Ring", torus_bm(1.6, 0.05, 64, 8), mats["ring"])))
    ring.rotation_mode = "XYZ"

    def key_ring():
        with linear_keys():
            for k in range(5):
                ring.rotation_euler = (math.radians(15), 0, math.radians(90 * k))
                ring.keyframe_insert("rotation_euler", frame=F0 + k * (F1 - F0) // 4)
    keyed(ring, "Orbit", key_ring)

    # Orbit pivot (empty) with three cubes
    pivot = link(bpy.data.objects.new("OrbitPivot", None))
    cube_me = None
    for i, deg in enumerate((0, 120, 240)):
        if cube_me is None:
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=0.22)
            cube_me = mesh_from_bmesh("Orbiter", bm, mats["cube"], smooth=False)
        o = link(bpy.data.objects.new(f"Orbiter{i + 1}", cube_me))
        o.parent = pivot
        a = math.radians(deg)
        o.location = (math.cos(a) * 2.2, math.sin(a) * 2.2, 0.3 * (i - 1))
    pivot.rotation_mode = "XYZ"

    def key_pivot():
        with linear_keys():
            for k in range(5):
                pivot.rotation_euler = (0, 0, math.radians(90 * k))
                pivot.keyframe_insert("rotation_euler", frame=F0 + k * (F1 - F0) // 4)
    keyed(pivot, "Orbit", key_pivot)

    # Armature + skinned tube
    arm_data = bpy.data.armatures.new("TentacleRig")
    arm = link(bpy.data.objects.new("TentacleRig", arm_data))
    arm.location = (1.2, 0, -2.6)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    prev = None
    for i in range(3):
        eb = arm_data.edit_bones.new(f"Bone_{i}")
        eb.head, eb.tail = (0, 0, i), (0, 0, i + 1)
        if prev:
            eb.parent, eb.use_connect = prev, True
        prev = eb
    bpy.ops.object.mode_set(mode="OBJECT")

    bm = bmesh.new()
    rings, sides, height, radius = 9, 8, 2.0, 0.12
    grid = []
    for r in range(rings):
        z = r / (rings - 1) * height
        taper = radius * (1 - 0.55 * z / height)
        grid.append([bm.verts.new((math.cos(s / sides * math.tau) * taper, math.sin(s / sides * math.tau) * taper, z)) for s in range(sides)])
    for r in range(rings - 1):
        for s in range(sides):
            bm.faces.new((grid[r][s], grid[r][(s + 1) % sides], grid[r + 1][(s + 1) % sides], grid[r + 1][s]))
    bmesh.ops.contextual_create(bm, geom=list(grid[0]))        # bottom cap
    bmesh.ops.contextual_create(bm, geom=list(grid[-1]))       # top cap
    bm.normal_update()
    tube = link(bpy.data.objects.new("Tentacle", mesh_from_bmesh("Tentacle", bm, mats["tube"])))
    tube.parent = arm
    groups = [tube.vertex_groups.new(name=f"Bone_{i}") for i in range(3)]
    for v in tube.data.vertices:
        f = v.co.z                    # joint spacing is 1.0
        j0 = min(2, int(f)); j1 = min(2, j0 + 1); t = min(1.0, f - j0)
        if j0 == j1:
            groups[j0].add([v.index], 1.0, "REPLACE")
        else:
            groups[j0].add([v.index], 1 - t, "REPLACE")
            groups[j1].add([v.index], t, "REPLACE")
    mod = tube.modifiers.new("Armature", "ARMATURE")
    mod.object = arm

    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"

    def key_pose():
        for f in range(F0, F1 + 1, 4):
            ph = (f - F0) / (F1 - F0) * math.tau
            arm.pose.bones["Bone_1"].rotation_euler = (math.radians(28) * math.sin(ph), 0, 0)
            arm.pose.bones["Bone_2"].rotation_euler = (math.radians(40) * math.sin(ph - 0.9), 0, 0)
            arm.pose.bones["Bone_1"].keyframe_insert("rotation_euler", frame=f)
            arm.pose.bones["Bone_2"].keyframe_insert("rotation_euler", frame=f)
    keyed(arm, "Idle", key_pose)

    # Camera, light, world: for the optional preview render only. NOT exported (export_cameras/lights default False).
    cam = link(bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")))
    cam.location = (5.2, -6.4, 3.2)
    cam.rotation_euler = (math.radians(70), 0, math.radians(38))
    cam.data.lens = 50
    sc.camera = cam
    sun = link(bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN")))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    sc.world = bpy.data.worlds.new("World")
    sc.world.color = (0.05, 0.06, 0.09)
    sc.frame_set(F0)
    return sc


# ---------------------------------------------------------------- export
GLTF_WANT = dict(
    export_format="GLB",
    export_yup=True,
    export_apply=False,                  # True would drop shape keys
    export_animations=True,
    export_animation_mode="NLA_TRACKS",  # one glTF animation per NLA track name
    export_nla_strips=True,
    export_force_sampling=True,
    export_optimize_animation_size=True,
    export_morph=True,
    export_skins=True,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    export_image_format="AUTO",
)


def export_glb(path, draco=True, meshopt=False):
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    want = dict(GLTF_WANT, filepath=path)
    if meshopt:
        want.update(export_meshopt_compression_enable=True)
    elif draco:
        want.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                    export_draco_position_quantization=14, export_draco_normal_quantization=10,
                    export_draco_texcoord_quantization=12, export_draco_color_quantization=10,
                    export_draco_generic_quantization=12)
    kw = {k: v for k, v in want.items() if k in props}   # an unknown keyword raises TypeError; filter by what this Blender has
    dropped = sorted(set(want) - set(kw))
    if dropped:
        print("WARNING exporter options not present in this Blender:", dropped)
    bpy.ops.export_scene.gltf(**kw)
    return dropped


def render_still(sc, path, engine):
    if engine.upper().startswith("EEVEE"):
        ids = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
        sc.render.engine = next(e for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT") if e in ids)  # VERSION: renamed back in 5.0
    else:
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"
        sc.cycles.samples = 24
        sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 640, 360, 100
    # VERSION: 5.0 requires image_settings.media_type to be set before file_format; leave the default (image) alone
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = path
    sc.frame_set(F0)
    bpy.ops.render.render(write_still=True)


def report():
    out = {"blender": bpy.app.version_string, "objects": sorted(o.name for o in bpy.data.objects), "nla": {}}
    for o in list(bpy.data.objects) + list(bpy.data.shape_keys):
        ad = getattr(o, "animation_data", None)
        if ad and ad.nla_tracks:
            out["nla"][o.name] = [(t.name, [(s.name, s.frame_start, s.frame_end) for s in t.strips]) for t in ad.nla_tracks]
    print("REPORT " + json.dumps(out))


if __name__ == "__main__":
    a = cli()
    sc = build()
    report()
    export_glb(a.out, draco=not a.no_draco, meshopt=a.meshopt)
    print("EXPORTED", a.out)
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=a.save_blend)
    if a.render:
        render_still(sc, a.render, a.engine)
        print("RENDERED", a.render)
