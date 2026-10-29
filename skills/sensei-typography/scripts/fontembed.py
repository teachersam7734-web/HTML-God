#!/usr/bin/env python3
"""fontembed.py: subset a font for Persian + Latin and print a ready @font-face with a base64 woff2.
HTML-Sensei's own code (UI research lane; --out, --ttf and the report line added for the plugin).

Usage:  python -I fontembed.py FONT.(ttf|otf|woff2) FAMILY [--weights 300:700 | --weight 400] [--latin-only]
                               [--out FILE.woff2] [--ttf FILE.ttf] > face.css
Needs: pip install fonttools brotli (build time only).

verified: Windows 10, Python 3.13, fontTools 4.63 with Vazirmatn 33.003 (SIL OFL), re-run for the plugin on
          2026-10-24: variable Persian + Latin 48,396 bytes (this skill's assets/vazirmatn-fa-latin.woff2), weights
          300 to 700 44,424, static 400 20,124, Latin only 22,824 (the research lane measured 48,528, 44,420, 20,084
          and 22,860); the subset renders joined Persian and ss01 Persian digits and keeps the copyright and licence
          name records (IDs 0, 13, 14), checked by test-typography.mjs and font-coverage.py; --ttf output loads.
not verified: fonts other than Vazirmatn (run font-coverage.py on the subset against your real text); Urdu, Pashto
          and Kurdish letters (not in the range below: add them).

Why these ranges (each one was a measured failure when left out, see references/fonts.md):
  listing only U+0621-064A drops the Persian letters and digits (fallback glyphs appear).
  U+200C (ZWNJ) and U+200D (ZWJ) are kept so the half-space and joiner tricks do not fall back to another font.
  layout features must keep init, medi, fina, isol (joining forms). An EMPTY list breaks every join.
"""
import sys, base64, io, argparse
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

LATIN = "U+0020-007E,U+00A0,U+00AB,U+00BB,U+2010-2015,U+2018-201D,U+2022,U+2026"
FARSI = ("U+0621-063A,U+0640-064A,U+064B-0652,U+0654,U+0670,U+067E,U+0686,U+0698,U+06A9,U+06AF,U+06CC,"
         "U+06F0-06F9,U+0660-0669,U+060C,U+061B,U+061F,U+066A-066D,U+200C-200F,U+FDFC")
FEATURES = "init,medi,fina,isol,liga,rlig,calt,ccmp,locl,mark,mkmk,kern,curs,rclt,numr,dnom,frac,ss01,ss02,ss03"

ap = argparse.ArgumentParser()
ap.add_argument("font"); ap.add_argument("family")
ap.add_argument("--weights"); ap.add_argument("--weight")
ap.add_argument("--latin-only", action="store_true")
ap.add_argument("--out", help="also write the subset woff2 to this file")
ap.add_argument("--ttf", help="also write the subset as TTF (troika and other tools that reject woff2)")
a = ap.parse_args()

opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = FEATURES.split(",")
opts.notdef_outline = True; opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # keep copyright + licence strings (OFL asks for it)
unis = LATIN if a.latin_only else LATIN + "," + FARSI
font = TTFont(a.font)
sub = subset.Subsetter(opts); sub.populate(unicodes=subset.parse_unicodes(unis)); sub.subset(font)
# subset first, then narrow the weight axis (the other order raised KeyError '.notdef' with fontTools 4.63)
if "fvar" in font and (a.weights or a.weight):
    limits = {"wght": float(a.weight)} if a.weight else {"wght": tuple(map(float, a.weights.split(":")))}
    font = instancer.instantiateVariableFont(font, limits)
if a.ttf:
    font.flavor = None; font.save(a.ttf)
buf = io.BytesIO(); font.flavor = "woff2"; font.save(buf)
data = buf.getvalue()
if a.out:
    with open(a.out, "wb") as fh: fh.write(data)
b64 = base64.b64encode(data).decode()
def axis_range(f):
    if "fvar" not in f: return "400"
    w = [x for x in f["fvar"].axes if x.axisTag == "wght"]
    return "%g %g" % (w[0].minValue, w[0].maxValue) if w else "400"
wr = "font-weight:%s;" % (("%s %s" % tuple(a.weights.split(":"))) if a.weights else (a.weight or axis_range(font)))
sys.stderr.write("woff2 %d bytes, base64 %d bytes (information, not a budget)\n" % (len(data), len(b64)))
print('@font-face{font-family:"%s";font-style:normal;%sfont-display:block;src:url(data:font/woff2;base64,%s) format("woff2")}' % (a.family, wr, b64))
