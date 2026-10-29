"""Packs a Lottie JSON into a dotLottie 2.0 container: a ZIP (Deflate) holding manifest.json and a/<id>.json.
Python 3 standard library only.

    python make-dotlottie.py anim.json out.lottie [id]

The container (dotlottie.io spec 2.0): MIME application/zip+dotlottie; manifest.json with "version": "2" and
"animations": [{"id": ...}] (optional "generator", "themes", "stateMachines", "initial"); folders a/ animations,
i/ images, t/ themes, s/ state machines, f/ fonts.
verified: Windows 10, Python 3.13: the 2,673-byte test JSON packs to 826 bytes and dotlottie-web 0.81.0 plays it
          (test-lottie.mjs).
not verified: images, themes, state machines or fonts inside the container.
Copied from code-media/lottie/make-dotlottie.py in the HTML-Sensei build project's research notes (not shipped) (original to this project).
"""
import json
import sys
import zipfile

src, dst = sys.argv[1], sys.argv[2]
aid = sys.argv[3] if len(sys.argv) > 3 else "main"
with open(src, "r", encoding="utf-8") as f:
    anim = f.read()
manifest = {"version": "2", "generator": "html-sensei-test", "animations": [{"id": aid}]}
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr("manifest.json", json.dumps(manifest))
    z.writestr("a/%s.json" % aid, anim)
print("wrote", dst, "json", len(anim), "bytes")
