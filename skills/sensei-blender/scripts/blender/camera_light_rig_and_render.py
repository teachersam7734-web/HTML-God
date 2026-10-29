"""Camera and light rigs plus a CLI render (turntable), for preview frames, contact sheets and video sources.

    blender -b --factory-startup --python-exit-code 1 --python camera_light_rig_and_render.py -- --blend scene.blend --out frames/f_ --engine CYCLES --frames 24

verified: type-checked against the fake-bpy-module-latest stubs (20261024) with scripts/check_bpy.py
          (mypy --check-untyped-defs --no-strict-optional); see SKILL.md Verification for what remained.
not verified: NOT RUN IN BLENDER. Blender was not installed where this was written. Run it once with
          scripts/blender_run.py, read the printed report, then replace this line with the Blender version it ran on.
Copied from blender-demo/blender/camera_light_rig_and_render.py in the HTML-Sensei build project's research notes (not shipped) (original to this project).
Defaults are chosen for a machine WITHOUT a usable GPU: Cycles on CPU, low samples, no denoiser dependency, small frames.
EEVEE needs an OpenGL 4.3 / Vulkan 1.3 capable GPU context even in background mode; a headless server needs a display
(xvfb on Linux) or it fails to initialise, so it is opt-in here.
"""
import argparse
import math
import sys

import bpy
from mathutils import Vector


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--blend", default="")
    p.add_argument("--out", default="//frames/f_")
    p.add_argument("--engine", default="CYCLES")
    p.add_argument("--frames", type=int, default=24)
    p.add_argument("--size", type=int, nargs=2, default=(640, 360))
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--alpha", action="store_true", help="transparent background (PNG RGBA) for compositing over a web page or video")
    return p.parse_args(argv)


def scene_bounds(sc):
    pts = []
    for o in sc.objects:
        if o.type in {"MESH", "CURVE", "SURFACE", "FONT"}:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2, (hi - lo).length


def turntable(sc, frames):
    """Camera on a boom parented to an Empty that rotates once: a loop with no seam (linear, last frame excluded)."""
    centre, size = scene_bounds(sc)
    pivot = bpy.data.objects.new("TurntablePivot", None)
    pivot.location = centre
    sc.collection.objects.link(pivot)
    cam_data = bpy.data.cameras.new("TurntableCam")
    cam = bpy.data.objects.new("TurntableCam", cam_data)
    sc.collection.objects.link(cam)
    cam.parent = pivot
    cam.location = (0, -size * 1.6, size * 0.45)
    track = cam.constraints.new("TRACK_TO")                     # always look at the pivot
    track.target, track.track_axis, track.up_axis = pivot, "TRACK_NEGATIVE_Z", "UP_Y"
    sc.camera = cam
    sc.frame_start, sc.frame_end = 1, frames
    pref = bpy.context.preferences.edit
    old = pref.keyframe_new_interpolation_type
    pref.keyframe_new_interpolation_type = "LINEAR"             # constant speed
    pivot.rotation_euler = (0, 0, 0)
    pivot.keyframe_insert("rotation_euler", frame=1)
    pivot.rotation_euler = (0, 0, math.tau)                     # frame frames+1 equals frame 1, so key it one past the end
    pivot.keyframe_insert("rotation_euler", frame=frames + 1)
    pref.keyframe_new_interpolation_type = old
    return centre, size


def three_point_lights(sc, centre, size):
    """Key, fill, rim as area lights. Energies are in watts and scale with distance squared, so scale with size."""
    def area(name, loc, watts, colour):
        d = bpy.data.lights.new(name, "AREA")
        d.energy, d.color, d.size = watts, colour, size * 0.6
        o = bpy.data.objects.new(name, d)
        o.location = centre + Vector(loc) * size
        sc.collection.objects.link(o)
        t = o.constraints.new("TRACK_TO")
        pivot = sc.objects.get("TurntablePivot")
        t.target, t.track_axis, t.up_axis = pivot, "TRACK_NEGATIVE_Z", "UP_Y"
        return o
    k = size * size * 400
    area("Key", (1.2, -1.4, 1.4), k, (1.0, 0.96, 0.9))
    area("Fill", (-1.6, -0.8, 0.5), k * 0.35, (0.8, 0.9, 1.0))
    area("Rim", (0.2, 1.8, 1.0), k * 0.8, (1.0, 1.0, 1.0))


def configure_render(sc, a):
    if a.engine.upper().startswith("EEVEE"):
        ids = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
        sc.render.engine = next(e for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT") if e in ids)   # name changed back in 5.0
    else:
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"                                # never assume a GPU
        sc.cycles.samples = a.samples
        sc.cycles.use_denoising = False                         # OIDN is bundled with Cycles CPU; keep off for speed and determinism
    sc.render.resolution_x, sc.render.resolution_y = a.size
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = a.alpha
    sc.render.image_settings.file_format = "PNG"                # 5.0: media_type must be set before file_format for non-image types; PNG is the image default
    sc.render.image_settings.color_mode = "RGBA" if a.alpha else "RGB"
    sc.render.filepath = a.out


if __name__ == "__main__":
    a = args()
    if a.blend:
        bpy.ops.wm.open_mainfile(filepath=a.blend)
    sc = bpy.context.scene
    centre, size = turntable(sc, a.frames)
    three_point_lights(sc, centre, size)
    configure_render(sc, a)
    bpy.ops.render.render(animation=True)                       # honours frame_start/frame_end; 5.0 also accepts frame_start/frame_end args
    print("RENDERED", a.out)
