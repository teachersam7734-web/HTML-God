"""Rigging and drivers from code: a two-bone arm with an IK constraint, a custom-property control, and a shape key
driven by a bone rotation. Also shows the Rigify route (unverified) at the bottom.

    blender -b --factory-startup --python-exit-code 1 --python rig_and_drivers.py -- --save rig.blend

verified: type-checked against the fake-bpy-module-latest stubs (20261024) with scripts/check_bpy.py
          (mypy --check-untyped-defs --no-strict-optional); see SKILL.md Verification for what remained.
not verified: NOT RUN IN BLENDER. Blender was not installed where this was written. Run it once with
          scripts/blender_run.py, read the printed report, then replace this line with the Blender version it ran on.
Copied from blender-demo/blender/rig_and_drivers.py in the HTML-Sensei build project's research notes (not shipped) (original to this project).
glTF notes: IK constraints and drivers are NOT exported as such. The exporter samples the resulting motion
(export_force_sampling=True) or, for drivers on shape keys, only when the mesh is a direct child of the armature.
Bake the pose to keyframes (bpy.ops.nla.bake) for any rig feature you need to survive export.
"""
import math

import bpy


def build_arm():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    arm_data = bpy.data.armatures.new("Arm")
    arm = bpy.data.objects.new("Arm", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    upper = arm_data.edit_bones.new("Upper")
    upper.head, upper.tail = (0, 0, 0), (0, 0, 1)
    lower = arm_data.edit_bones.new("Lower")
    lower.head, lower.tail = (0, 0, 1), (0, 0, 2)
    lower.parent, lower.use_connect = upper, True
    target = arm_data.edit_bones.new("IKTarget")               # a free bone the animator moves
    target.head, target.tail = (0.8, 0, 1.6), (0.8, 0, 2.0)
    bpy.ops.object.mode_set(mode="POSE")
    ik = arm.pose.bones["Lower"].constraints.new("IK")
    ik.target, ik.subtarget, ik.chain_count = arm, "IKTarget", 2
    # A custom property on a bone, exposed as a slider-like control (also exported to glTF extras if export_extras=True)
    arm.pose.bones["IKTarget"]["wave_amount"] = 0.0
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def add_bone_driven_shape_key(arm):
    """A 'Squash' shape key whose value follows the Lower bone's X rotation (driver)."""
    bm_me = bpy.data.meshes.new("Skin")
    bm_me.from_pydata([(-.1, 0, 0), (.1, 0, 0), (.1, 0, 2), (-.1, 0, 2)], [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.new("SkinMesh", bm_me)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = arm                                            # direct child of the armature, required for sampled SK drivers
    obj.shape_key_add(name="Basis")
    squash = obj.shape_key_add(name="Squash")
    for v in squash.data:
        v.co.x *= 1.6
    fcurve = squash.driver_add("value")                         # returns the F-curve carrying the driver
    drv = fcurve.driver
    drv.type = "SCRIPTED"
    var = drv.variables.new()
    var.name, var.type = "rot", "TRANSFORMS"
    var.targets[0].id = arm
    var.targets[0].bone_target = "Lower"
    var.targets[0].transform_type = "ROT_X"
    var.targets[0].transform_space = "LOCAL_SPACE"
    drv.expression = "min(1.0, abs(rot) / %f)" % math.radians(90)   # Python expressions in drivers need auto-run scripts: see traps
    return obj


def rigify_route():
    """UNVERIFIED sketch (Rigify is an add-on, so it is not in the stubs and was not run).
    Enable the add-on, add a meta-rig, generate, then export only deformation bones."""
    import addon_utils
    addon_utils.enable("rigify", default_set=False, persistent=False)
    bpy.ops.object.armature_human_metarig_add()                # meta-rig, scaled for a ~2 m human
    bpy.ops.pose.rigify_generate()                             # needs the meta-rig active, object mode
    # then export with export_def_bones=True so only deform bones (not controls or mechanism bones) reach the GLB


if __name__ == "__main__":
    import sys
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    a = build_arm()
    add_bone_driven_shape_key(a)
    print("OK bones:", [b.name for b in a.data.bones])
    if "--save" in argv:                                       # gives blender_run.py an artefact to check
        out = argv[argv.index("--save") + 1]
        bpy.ops.wm.save_as_mainfile(filepath=out)
        print("EXPORTED", out)
