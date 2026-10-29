"""Animation QA: tile frames into one contact sheet and report frame-to-frame change. Needs Pillow only.

    python contact_sheet.py frames/ sheet.png            # frames/*.png in name order; last frame should equal first for a loop
    python contact_sheet.py frames/ sheet.png --cols 3 --json

Reports per step the mean absolute pixel difference (0 to 255) between neighbouring frames, plus:
  loop_seam   difference between the LAST and FIRST frame (small = seamless loop; large = a pop at the wrap)
  static      steps with almost no change (a stalled animation)
  spikes      steps whose change is more than 3 times the median (flicker, popping, a morph jumping)
Exit code 1 if the loop seam is not small or the clip is entirely static. Thresholds are starting points, tune per piece.
Works on any folder of PNG frames: captures of a three.js page (web/capture_frames.mjs) or a Blender render folder.
verified: Python 3.13, Pillow 12.2, Windows 10: 9 frames captured from the demo player (loop seam 0.0), and the
          synthetic seam, static and spike cases in tests/test_python_tools.py.
not verified: Blender render folders (no Blender here); frames of different sizes (all frames must match).
Copied from blender-demo/scripts/contact_sheet.py in the HTML-Sensei build project's research notes (not shipped) (original to this project).
"""
import argparse
import glob
import json
import os
import statistics
import sys

from PIL import Image, ImageChops, ImageDraw, ImageStat


def mad(a, b):
    d = ImageChops.difference(a.convert("RGB"), b.convert("RGB"))
    return sum(ImageStat.Stat(d).mean) / 3.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("out")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--thumb", type=int, default=320, help="thumbnail width")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--seam", type=float, default=2.0, help="max loop-seam difference")
    a = ap.parse_args()
    paths = sorted(glob.glob(os.path.join(a.folder, "*.png")))
    if len(paths) < 2:
        sys.exit("need at least two frames")
    frames = [Image.open(p).convert("RGB") for p in paths]
    steps = [mad(frames[i], frames[i + 1]) for i in range(len(frames) - 1)]
    seam = mad(frames[0], frames[-1])
    med = statistics.median(steps)
    report = {
        "frames": len(frames),
        "steps": [round(s, 2) for s in steps],
        "loop_seam": round(seam, 2),
        "static": [i for i, s in enumerate(steps) if s < 0.05],
        "spikes": [i for i, s in enumerate(steps) if med > 0 and s > 3 * med],
    }
    w = a.thumb
    h = round(frames[0].height * w / frames[0].width)
    rows = -(-len(frames) // a.cols)
    sheet = Image.new("RGB", (a.cols * w, rows * h), (20, 20, 24))
    draw = ImageDraw.Draw(sheet)
    for i, f in enumerate(frames):
        x, y = (i % a.cols) * w, (i // a.cols) * h
        sheet.paste(f.resize((w, h)), (x, y))
        draw.text((x + 6, y + 4), f"{i}" + (f"  d={steps[i - 1]:.1f}" if i else ""), fill=(255, 255, 0))
    sheet.save(a.out)
    print(json.dumps(report) if a.json else f"{report}\nsheet: {a.out}")
    bad = seam > a.seam or len(report["static"]) == len(steps)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
