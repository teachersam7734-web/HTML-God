"""Mechanical checks on a built scene before export: the silent failures that look right in a viewport.

    python blender_run.py --blend scene.blend --script blender/verify_scene.py --expect verify.json \
        --sentinel VERIFIED -- --out verify.json

Fails (no VERIFIED line, "pass": false in the report) when:
  units        scene.unit_settings.scale_length is not 1.0 (it is applied on export: 0.01 shipped a model 100 times
               too small with no warning, measured by the dcc-mcp-blender pitfalls skill)
  bounds       an object's world bounding box is not finite
  inside-out   a closed (manifold) mesh has a negative signed volume (normals point inwards)
  weights      a mesh deformed by an Armature modifier has vertices with no positive weight in any group (glTF zero
               weights: NaN bounds and a blank canvas in three.js)
Warns when: scale not applied, the rotation property that does not match rotation_mode holds a value (Blender
stores it and ignores it), modifiers other than Armature are left (only the evaluated result exports with
export_apply, which drops shape keys), more than 4 weighted groups on a vertex, world size outside 0.001 to 1000 units.
The report is JSON, written to --out; the line VERIFIED is printed only when nothing failed, so blender_run.py's
sentinel check doubles as the pass test.

verified: type-checked against the fake-bpy-module-latest stubs (20261024) with scripts/check_bpy.py.
not verified: NOT RUN IN BLENDER (none installed where this was written). The checks follow the measured traps in
              repo-dcc-mcp-blender.md in the HTML-Sensei build project's research notes (not shipped), rewritten in this project's own code (that skill is MIT; no
              code was copied from it).
Original code of this project.
"""
import json
import math
import sys

import bmesh
import bpy
from mathutils import Vector


def world_box(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    return lo, hi


def signed_volume(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    try:
        if not bm.edges or not all(e.is_manifold for e in bm.edges):
            return None                                      # open mesh: volume means nothing
        return bm.calc_volume(signed=True)
    finally:
        bm.free()


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else "verify.json"
    sc = bpy.context.scene
    fails, warns = [], []
    if abs(sc.unit_settings.scale_length - 1.0) > 1e-9:
        fails.append(f"units: scale_length is {sc.unit_settings.scale_length}, set it to 1.0 before export")
    for obj in sc.objects:
        lo, hi = world_box(obj)
        if not all(math.isfinite(v) for v in lo + hi):
            fails.append(f"bounds: {obj.name} has a non-finite world box")
            continue
        size = max(h - l for l, h in zip(lo, hi))
        if obj.type == "MESH" and (size > 1000 or 0 < size < 0.001):
            warns.append(f"size: {obj.name} is {size:.4g} units across (glTF is metres)")
        if any(abs(s - 1.0) > 1e-6 for s in obj.scale):
            warns.append(f"scale: {obj.name} has unapplied scale {tuple(round(s, 4) for s in obj.scale)}")
        if obj.rotation_mode == "QUATERNION" and any(abs(a) > 1e-9 for a in obj.rotation_euler):
            warns.append(f"rotation: {obj.name} is in QUATERNION mode but rotation_euler holds a value (ignored)")
        if obj.rotation_mode != "QUATERNION" and any(abs(a - b) > 1e-9 for a, b in zip(obj.rotation_quaternion, (1, 0, 0, 0))):
            warns.append(f"rotation: {obj.name} is in {obj.rotation_mode} mode but rotation_quaternion holds a value (ignored)")
        if obj.type != "MESH":
            continue
        others = [m.type for m in obj.modifiers if m.type != "ARMATURE"]
        if others:
            warns.append(f"modifiers: {obj.name} still has {others}; apply them or realise instances before export")
        vol = signed_volume(obj)
        if vol is not None and vol < 0:
            fails.append(f"inside-out: {obj.name} has signed volume {vol:.4g}; recalculate normals outside")
        if any(m.type == "ARMATURE" for m in obj.modifiers):
            zero = many = 0
            for v in obj.data.vertices:
                ws = [g.weight for g in v.groups if g.weight > 0]
                zero += not ws
                many += len(ws) > 4
            if zero:
                fails.append(f"weights: {obj.name} has {zero} vertices with no positive weight")
            if many:
                warns.append(f"influences: {obj.name} has {many} vertices weighted to more than 4 groups (glTF keeps 4)")
    report = {"blender": bpy.app.version_string, "file": bpy.data.filepath, "pass": not fails, "fails": fails, "warns": warns}
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(report, fh, indent=1)
    print("VERIFY " + json.dumps(report))
    if not fails:
        print("VERIFIED", out)


if __name__ == "__main__":
    main()
