"""Bake what glTF cannot carry (procedural colour, roughness and normal detail, optionally ambient occlusion) into
images with Cycles on the CPU, pack them, rebuild each mesh with one plain Principled material that reads them, and
export a GLB.

    python blender_run.py --blend hero.blend --script blender/bake_for_web.py --expect hero.glb --timeout 900 \
        -- --out hero.glb --size 1024 --samples 16 --ao
    options: --objects A B (default: every mesh)  --size 1024  --samples 16  --ao  --texdir baked  --meshopt

Why: the exporter reads Principled BSDF inputs (plus unlit) only; noise, Voronoi and custom node trees are dropped or
flattened to a default. A bake turns them into textures. Rules followed here:
  * every image is saved to a PNG and PACKED before export: an unsaved bake still has a GENERATED source and exports
    as a flat black texture (field-tested trap from 3dviz-pro-max);
  * colour maps are sRGB, roughness and normal maps Non-Color;
  * roughness goes through Separate Color (green), the channel glTF packs roughness in;
  * AO is multiplied into the colour map (a runtime without an AO map still shows contact shadow), the 3dviz-pro-max
    method; a separate occlusion texture through the "glTF Material Output" node group is the other route (not done here);
  * objects without UVs get one Smart UV Project atlas; objects without a material get a plain grey one.
Bake time grows with --size squared and --samples; keep the job under its timeout.

verified: type-checked against the fake-bpy-module-latest stubs (20261024) with scripts/check_bpy.py.
not verified: NOT RUN IN BLENDER (none installed where this was written). Written from the Blender Python API (checked
              through the stubs) and the bake method described in repo-3dviz-pro-max.md in the HTML-Sensei build project's research notes (not shipped) (MIT;
              no code was copied). Run it on a copy of the .blend: it replaces the objects' materials.
Original code of this project.
"""
import argparse
import math
import os
import sys

import bpy


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="baked.glb")
    p.add_argument("--objects", nargs="*", default=None)
    p.add_argument("--size", type=int, default=1024)
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--ao", action="store_true")
    p.add_argument("--texdir", default="baked")
    p.add_argument("--meshopt", action="store_true")
    return p.parse_args(argv)


def tree_of(mat):
    if bpy.app.version < (5, 0, 0):        # VERSION: 5.0 always has a node tree; use_nodes is deprecated there
        mat.use_nodes = True
    return mat.node_tree


def ensure_uv_and_material(obj):
    if not obj.material_slots or not any(s.material for s in obj.material_slots):
        m = bpy.data.materials.new(obj.name + "_grey")
        tree_of(m)
        obj.data.materials.append(m)
    if not obj.data.uv_layers:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")


def bake_pass(obj, kind, size, texdir):
    img = bpy.data.images.new(f"{obj.name}_{kind.lower()}", size, size, alpha=False)
    img.colorspace_settings.name = "sRGB" if kind in ("COLOR", "AO") else "Non-Color"
    added = []
    for slot in obj.material_slots:                       # the bake writes into the ACTIVE image node of each material
        if not slot.material:
            continue
        nt = tree_of(slot.material)
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = img
        n.select = True
        nt.nodes.active = n
        added.append((nt, n))
    if kind == "COLOR":
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=8, use_clear=True)
    elif kind == "ROUGHNESS":
        bpy.ops.object.bake(type="ROUGHNESS", margin=8, use_clear=True)
    elif kind == "NORMAL":
        bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=8, use_clear=True)
    else:
        bpy.ops.object.bake(type="AO", margin=8, use_clear=True)
    for nt, n in added:
        nt.nodes.remove(n)
    path = os.path.abspath(os.path.join(texdir, f"{obj.name}_{kind.lower()}.png"))
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()                                            # an unsaved bake exports black: save, then pack
    img.pack()
    return img


def multiply_ao(colour, ao):
    import numpy as np                                    # numpy ships inside Blender's Python
    n = colour.size[0] * colour.size[1] * 4
    c = np.empty(n, dtype=np.float32)
    a = np.empty(n, dtype=np.float32)
    colour.pixels.foreach_get(c)
    ao.pixels.foreach_get(a)
    c4, a4 = c.reshape(-1, 4), a.reshape(-1, 4)
    c4[:, :3] *= a4[:, :1]
    colour.pixels.foreach_set(c)
    colour.save()
    colour.pack()


def first_metallic(obj):
    for slot in obj.material_slots:
        if slot.material:
            b = tree_of(slot.material).nodes.get("Principled BSDF")
            if b:
                return float(b.inputs["Metallic"].default_value)
    return 0.0


def baked_material(obj, imgs):
    m = bpy.data.materials.new(obj.name + "_baked")
    nt = tree_of(m)
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Metallic"].default_value = first_metallic(obj)
    col = nt.nodes.new("ShaderNodeTexImage")
    col.image = imgs["COLOR"]
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    rough = nt.nodes.new("ShaderNodeTexImage")
    rough.image = imgs["ROUGHNESS"]
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(rough.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    nrm = nt.nodes.new("ShaderNodeTexImage")
    nrm.image = imgs["NORMAL"]
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(nrm.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def export(path, meshopt):
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    want = dict(filepath=path, export_format="GLB", export_apply=False, export_image_format="AUTO",
                export_cameras=False, export_lights=False)
    if meshopt:
        want["export_meshopt_compression_enable"] = True
    kw = {k: v for k, v in want.items() if k in props}
    dropped = sorted(set(want) - set(kw))
    if dropped:
        print("WARNING exporter options not present in this Blender:", dropped)
    bpy.ops.export_scene.gltf(**kw)


def main():
    a = args()
    os.makedirs(a.texdir, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"                              # never assume a GPU
    sc.cycles.samples = a.samples
    names = a.objects or [o.name for o in sc.objects if o.type == "MESH"]
    report = {}
    for name in names:
        obj = bpy.data.objects[name]
        if bpy.context.object and bpy.context.object.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        ensure_uv_and_material(obj)
        imgs = {k: bake_pass(obj, k, a.size, a.texdir) for k in ("COLOR", "ROUGHNESS", "NORMAL")}
        if a.ao:
            multiply_ao(imgs["COLOR"], bake_pass(obj, "AO", a.size, a.texdir))
        mat = baked_material(obj, imgs)
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        report[name] = {k: v.filepath_raw for k, v in imgs.items()}
    export(a.out, a.meshopt)
    print("BAKED", report)
    print("EXPORTED", a.out)


if __name__ == "__main__":
    main()
