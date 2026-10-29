# Rendering headless, turntables, frames to video, batches

## 1. Engines

| Engine | Use | Headless |
|---|---|---|
| Cycles on the CPU | the default in this skill's scripts: needs no GPU, deterministic with denoising off | yes, no graphics context |
| Cycles on the GPU | the user's machine with a supported GPU: probe the devices, then set it | yes |
| Eevee | fast look development, stylised looks | needs a graphics context even with `-b` (OpenGL 4.3 or Vulkan 1.3 in Blender 5); a virtual display on servers; `gpu.init()` in 5.2 (not verified) |

Doctrine: the default is the best look the target machine can render, not what renders on the development machine.
Cycles on the CPU is the default because it runs everywhere, not because it is cheaper; when the user's machine has
a GPU, use it. Say which engine and device produced every frame.

Preview budget (keep each job under a minute): 640 by 360, 16 to 64 samples, denoiser off or OIDN. Final frames:
whatever the deliverable needs, timed on the target machine.

## 2. Turntable and three-point light rig

`scripts/blender/camera_light_rig_and_render.py`: a camera on a boom parented to an Empty that turns once (keyed at
frame 1 and one frame past the end, linear, so the loop has no seam), a Track To constraint on the pivot, key, fill
and rim area lights whose power scales with the scene size squared, Cycles CPU, optional transparent background.

```bash
python blender_run.py --blend scene.blend --script blender/camera_light_rig_and_render.py \
    --expect frames/f_0001.png --sentinel RENDERED --timeout 600 -- --frames 48 --out //frames/f_ --size 640 360 --samples 16
blender -b scene.blend -o //out/f_#### -F PNG -E CYCLES -s 1 -e 96 -a -- --cycles-device CPU
```

Order: file, then `-o`, then frame options, then `-a` (animation) or `-f N` (one frame). `#` characters are the
zero-padded frame number. `-j 4` renders every fourth frame of a long range.

## 3. Frames to video (for the film pipeline)

Render a PNG sequence (with `--alpha` for a cut-out), then hand it to `sensei-video-pipeline`, which owns encoding,
loudness, captions and the contact sheet of the master. The two encodes the lane recorded (not run here; ffmpeg is
discovered by the plugin, never hard-coded):

```bash
ffmpeg -framerate 24 -i frames/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 out.mp4              # opaque
ffmpeg -framerate 24 -i frames/f_%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 out.webm   # alpha
```

Alpha video in a page (VP9 alpha, HEVC alpha for Safari) belongs to `sensei-lottie-rive-video`. Choose live three.js
playback when the viewer should orbit; choose video when they should not (no decoder, identical everywhere).

## 4. Contact-sheet gate

No animation is done without a contact sheet. The same tool works on Blender render folders and on browser captures:

```bash
python contact_sheet.py frames/ sheet.png --json    # steps, loop_seam, static, spikes; exit 1 on a seam or a stalled clip
```

Quality bars: loop seam under 2 (mean absolute pixel difference, 0 to 255), no static steps inside a moving clip,
no spikes over 3 times the median step. Thresholds are starting points; tune per piece and say so.

## 5. Batches and farms

| Approach | For |
|---|---|
| One CLI process | the default |
| Several CLI processes over frame ranges (`-s 1 -e 48` and `-s 49 -e 96`, a shell loop, `-t` threads each) | one machine with many cores, or a few machines with a shared folder |
| Flamenco (Blender Studio, GPL-3.0, self-hosted Manager and Workers) | hundreds of Cycles frames across a handful of machines with failure tracking |
| Commercial farms | a deadline and no local GPU; they document Eevee black frames on virtual machines |

Every batch writes a manifest next to the frames (frame list, Blender version, engine, device, samples, seed); count
files against the range before assembling video. Treat workers as disposable: kill on timeout, retry.
