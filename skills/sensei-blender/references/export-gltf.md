# Export to glTF: the exporter, its options, presets, baking

The exporter is Khronos glTF-Blender-IO (Apache-2.0), a core add-on bundled with Blender and enabled even under
`--factory-startup`. Operators: `bpy.ops.export_scene.gltf(...)`, `bpy.ops.import_scene.gltf(...)`. The add-on version
studied (5.4.6, for Blender 5.3) has 111 options; the one inside a given Blender is older or newer. **Generate the
table for the installed Blender** with `scripts/blender/export_options_dump.py` instead of trusting any list,
including this one.

## 1. The wrapper that survives version drift

An unknown keyword raises `TypeError`. A background process uses the operator's own defaults, not the values the UI
remembered. So: spell out every asset-relevant option, filter by the operator's RNA, and report what was dropped.

```python
props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
want = dict(filepath=out, export_format="GLB", export_yup=True, export_apply=False,
            export_animation_mode="NLA_TRACKS", export_force_sampling=True, export_optimize_animation_size=True,
            export_morph=True, export_skins=True, export_cameras=False, export_lights=False,
            export_meshopt_compression_enable=True)               # or the Draco block below
kw = {k: v for k, v in want.items() if k in props}
print("dropped:", sorted(set(want) - set(kw)))
bpy.ops.export_scene.gltf(**kw)
```

Draco block: `export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
export_draco_generic_quantization=12` (level 0 to 6; "higher values currently not supported").

## 2. Options that decide the asset

| Group | Options (exact keywords) |
|---|---|
| File and scope | `export_format` (`GLB`, `GLTF_SEPARATE`, `GLTF_EMBEDDED`), `use_selection`, `use_visible`, `use_renderable`, `use_active_collection`, `collection`, `export_yup` (default true), `export_extras` (custom properties to `extras`), `export_cameras`, `export_lights` |
| Geometry | `export_apply` (default false; **true drops shape keys**), `export_texcoords`, `export_normals`, `export_tangents`, `export_attributes` (only names starting with `_`), `export_vertex_color` (`MATERIAL`, `ACTIVE`, `NAME`, `NONE`), `export_gn_mesh` (experimental), `export_gpu_instances` |
| Compression | Draco block above; Meshopt: `export_meshopt_compression_enable`, `export_meshopt_extension` (`EXT_meshopt_compression` or `KHR_meshopt_compression`); gltfpack: `export_use_gltfpack` and `export_gltfpack_*` |
| Materials | `export_materials` (`EXPORT`, `PLACEHOLDER`, `VIEWPORT`, `NONE`), `export_image_format` (`AUTO`, `JPEG`, `WEBP`, `NONE`), `export_image_quality`, `export_jpeg_quality`, `export_compressed_images_type` (`WEBP`, `KTX2`), `export_compressed_images_fallback` |
| Skins and morphs | `export_skins`, `export_influence_nb` (4), `export_all_influences`, `export_def_bones`, `export_leaf_bone`, `export_rest_position_armature`, `export_morph`, `export_morph_normal`, `export_morph_animation`, `export_try_sparse_sk` |
| Animation | `export_animations`, `export_animation_mode` (`ACTIONS` default, `ACTIVE_ACTIONS`, `BROADCAST`, `NLA_TRACKS`, `SCENE`), `export_nla_strips`, `export_merge_animation`, `export_bake_animation`, `export_frame_range`, `export_frame_step`, `export_force_sampling` (default true), `export_optimize_animation_size` (default true), `export_negative_frame`, `export_anim_slide_to_zero`, `export_reset_pose_bones`, `export_pointer_animation` (experimental) |

Meshopt, gltfpack and KTX2 are newer than Draco and may be missing from an older Blender: the RNA filter tells you,
and the wrapper prints what it dropped.

## 3. Presets

| Goal | Settings |
|---|---|
| Smallest static prop | `export_apply=True` (no shape keys on it), `export_animations=False`, Meshopt or Draco, `export_image_format="WEBP"` with a fallback or JPEG at 75 to 85 |
| Rigged, animated character | `export_apply=False`, `export_skins=True`, `export_animation_mode="NLA_TRACKS"`, `export_def_bones=True` for Rigify, Meshopt (it compresses animation; Draco does not) |
| Morph-heavy face | `export_morph=True`, `export_try_sparse_sk=True`, `export_apply=False` |
| Lit landing-page hero | lights off; light in three.js with an environment map (Blender light strengths do not map cleanly) |

Compression choice for a single offline page: Meshopt by default (decoder about 30 KB inline, compresses animation);
Draco for big smooth static meshes where its 250 KB decoder pays for itself. Either way, compress again or check with
glTF-Transform (`optimise-validate.md`).

## 4. Materials: what survives, and baking the rest

Only Principled BSDF networks (and unlit) export. Procedural noise, Voronoi and custom node trees are dropped or
flattened. Unlit: mix in a Camera Ray and avoid Principled BSDF; the exporter detects the pattern. Emission above 1.0
writes `KHR_materials_emissive_strength`, which some viewers clamp: keep it at 1.0 or below and add bloom in the page.
Alpha mode is inferred (opaque, mask with a Math node rounding alpha, blend); blend sorts badly in three.js, so prefer
mask. Colour textures sRGB, data textures Non-Color. The 5 series lets the scene's working colour space differ from
Rec.709; the exporter converts to linear Rec.709; a custom OCIO config can shift colours, so keep the default.

**Bake** with `scripts/blender/bake_for_web.py` (Cycles CPU: colour, roughness, normal, optional AO multiplied into
colour; images saved and packed; one Principled material rebuilt per object; GLB export). Not run: no Blender here.
An unsaved or unpacked bake exports as a flat black texture. A separate occlusion texture goes through a node group
named `glTF Material Output` with an `Occlusion` input (the other route, not in the script). Bake size 1024 by
default; textures 2048 or less on the longest side unless it is the hero.

## 5. Before every export

* `scene.unit_settings.scale_length == 1.0` (`verify_scene.py` checks it).
* Shape keys present? Then `export_apply=False`, and apply other modifiers yourself.
* Joint influences 4 or fewer; deform bones only for Rigify.
* Clips on named NLA tracks; no active action left that would export twice.
* After export: `gltf-transform validate`, `glb_audit.mjs --expect meshopt|draco` (the per-primitive compression
  check: both encoders skip a primitive they cannot encode, log it, and still write a valid file), then the browser
  check. `grep` the JSON for `KHR_materials_*` extensions you did not intend.

## 6. Other formats

Web: glTF or GLB. Game engines take FBX (traps: rotated 90 degrees, 100 times too big, one action only, missing
textures). VFX: USD. Print: STL. This skill covers the web route; for the others, the same RNA-filter rule applies to
each format's operator.
