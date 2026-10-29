"""Geometry Nodes from plain bpy (no add-on): scatter cubes on a grid with a random scale.

    blender -b --factory-startup --python-exit-code 1 --python geonodes_scatter.py -- --out scatter.glb

verified: type-checked against the fake-bpy-module-latest stubs (20261024) with scripts/check_bpy.py
          (mypy --check-untyped-defs --no-strict-optional); see SKILL.md Verification for what remained.
not verified: NOT RUN IN BLENDER. Blender was not installed where this was written. Run it once with
          scripts/blender_run.py, read the printed report, then replace this line with the Blender version it ran on.
Copied from blender-demo/blender/geonodes_scatter.py in the HTML-Sensei build project's research notes (not shipped) (original to this project).
Uses the 4.0+ interface API (`tree.interface.new_socket`); the 3.x `tree.inputs.new` form is gone.
Exporting: the glTF exporter only sees the evaluated mesh when modifiers are applied, so this script realises the
instances and applies the modifier before export (export_apply would also work, but would drop shape keys elsewhere).
"""
import sys

import bpy


def sock(sockets, name, kind):
    """Pick a socket by name AND type. Nodes such as Random Value, Compare, Math Mix repeat one name per data type
    (identifiers Min, Min_001, ...); sockets["Min"] returns the first one, usually the vector variant."""
    return next(s for s in sockets if s.name == name and s.type == kind and s.enabled)


def build_tree():
    tree = bpy.data.node_groups.new("ScatterCubes", "GeometryNodeTree")
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n = tree.nodes
    group_in, group_out = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    grid = n.new("GeometryNodeMeshGrid")
    grid.inputs["Size X"].default_value = grid.inputs["Size Y"].default_value = 4.0
    grid.inputs["Vertices X"].default_value = grid.inputs["Vertices Y"].default_value = 8
    points = n.new("GeometryNodeMeshToPoints")                 # mesh vertices to points
    cube = n.new("GeometryNodeMeshCube")
    cube.inputs["Size"].default_value = (0.25, 0.25, 0.25)
    inst = n.new("GeometryNodeInstanceOnPoints")
    rnd = n.new("FunctionNodeRandomValue")                     # per-instance scale
    rnd.data_type = "FLOAT"
    sock(rnd.inputs, "Min", "VALUE").default_value = 0.4
    sock(rnd.inputs, "Max", "VALUE").default_value = 1.6
    realize = n.new("GeometryNodeRealizeInstances")
    L = tree.links.new
    L(grid.outputs["Mesh"], points.inputs["Mesh"])
    L(points.outputs["Points"], inst.inputs["Points"])
    L(cube.outputs["Mesh"], inst.inputs["Instance"])
    L(sock(rnd.outputs, "Value", "VALUE"), inst.inputs["Scale"])   # float to the vector Scale socket: Blender converts
    L(inst.outputs["Instances"], realize.inputs["Geometry"])
    L(realize.outputs["Geometry"], group_out.inputs["Geometry"])
    return tree


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else "scatter.glb"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    me = bpy.data.meshes.new("Host")
    obj = bpy.data.objects.new("Scatter", me)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("GN", "NODES")
    mod.node_group = build_tree()
    deps = bpy.context.evaluated_depsgraph_get()
    print("EVALUATED", len(obj.evaluated_get(deps).data.vertices), "vertices")  # must be > 0 or the tree is wrong
    bpy.ops.object.modifier_apply(modifier=mod.name)           # bake the evaluated result into the mesh
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    kw = {k: v for k, v in dict(filepath=out, export_format="GLB", export_apply=False).items() if k in props}
    bpy.ops.export_scene.gltf(**kw)
    print("EXPORTED", out)


if __name__ == "__main__":
    main()
