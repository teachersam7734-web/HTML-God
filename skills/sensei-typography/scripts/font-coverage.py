#!/usr/bin/env python3
"""font-coverage.py: does this (subset) font cover the text that will be set in it, with the shaping it needs?
HTML-Sensei's own code.

Usage:  python -I font-coverage.py FONT.(woff2|woff|ttf|otf) PAGE.html [MORE.html|.txt ...] [--text "..."] [--json]

Reports, and exits 1 when any is found:
  - characters in the text with no glyph in the font (they would render in a fallback face), with their names;
  - Arabic-script text but missing joining features (init, medi, fina), or an empty GSUB (every letter isolated);
  - missing copyright (name ID 0) or licence (name ID 13) records (the OFL asks for the notice to travel with the font).
Text is read from HTML with script and style contents and tags removed; attribute values are not read (alt, title,
aria-label text: pass it with --text if it uses the font).

Needs: pip install fonttools brotli (build time only).
verified: Windows 10, Python 3.13, fontTools 4.63: passes the plugin's Vazirmatn subset against examples/kinetic.html;
          flags a subset built from the "Arabic" range only (the Persian letters and digits missing, named) and a subset
          with an empty feature list (no joining features), both made by ../scripts/test-typography.mjs.
not verified: CFF2 and colour fonts; text inserted by script at run time (pass it with --text).
"""
import sys, re, json, argparse, unicodedata, html as htmllib
from fontTools.ttLib import TTFont

ap = argparse.ArgumentParser()
ap.add_argument("font"); ap.add_argument("files", nargs="*")
ap.add_argument("--text", action="append", default=[])
ap.add_argument("--json", action="store_true")
a = ap.parse_args()
# Windows consoles default to a legacy code page that cannot print Persian: force UTF-8 (found while testing).
for stream in (sys.stdout, sys.stderr):
    try: stream.reconfigure(encoding="utf-8")
    except Exception: pass

def page_text(src):
    src = re.sub(r"(?is)<(script|style)\b.*?</\1\s*>", " ", src)
    src = re.sub(r"(?s)<!--.*?-->", " ", src)
    src = re.sub(r"(?s)<[^>]+>", " ", src)
    return htmllib.unescape(src)

text = "".join(a.text)
for f in a.files:
    with open(f, encoding="utf-8") as fh: s = fh.read()
    text += page_text(s) if f.lower().endswith((".html", ".htm", ".svg")) else s

font = TTFont(a.font)
cmap = font.getBestCmap() or {}
IGNORE = set(range(0, 0x20)) | {0x7F, 0xFEFF}
# Every character counts, format characters too: without ZWNJ, ZWJ, LRM or RLM in the font the browser consults a
# fallback face for them and the line box can grow (measured: 1 px with ZWNJ missing).
chars = sorted({ord(c) for c in text} - IGNORE)
missing = [c for c in chars if c not in cmap]

arabic = any(0x0600 <= c <= 0x06FF or 0x0750 <= c <= 0x077F or 0xFB50 <= c <= 0xFDFF or 0xFE70 <= c <= 0xFEFF for c in chars)
feats = set()
if "GSUB" in font and font["GSUB"].table.FeatureList:
    feats = {fr.FeatureTag for fr in font["GSUB"].table.FeatureList.FeatureRecord}
need = {"init", "medi", "fina"}  # isol is optional: the default glyph is the isolated form (Vazirmatn has no isol feature)
lacking = sorted(need - feats) if arabic else []

names = {r.nameID for r in font["name"].names} if "name" in font else set()
lost_names = [n for n, what in ((0, "copyright"), (13, "licence")) if n not in names]

report = {
    "font": a.font, "characters": len(chars),
    "missing": [{"cp": "U+%04X" % c, "char": chr(c), "name": unicodedata.name(chr(c), "?")} for c in missing],
    "arabic_script": arabic, "joining_features_missing": lacking, "gsub_features": sorted(feats),
    "name_records_missing": lost_names,
}
bad = bool(missing or lacking or lost_names)
if a.json:
    print(json.dumps(report, ensure_ascii=False, indent=2))
else:
    print("%s: %d distinct characters checked" % (a.font, len(chars)))
    for m in report["missing"]: print("  MISSING %s %s %s" % (m["cp"], m["char"], m["name"]))
    if lacking: print("  JOINING FEATURES MISSING: %s (Arabic-script text will render as isolated letters)" % ", ".join(lacking))
    for n in lost_names: print("  NAME RECORD %d MISSING (%s): keep it, the licence travels with the font" % (n, "copyright" if n == 0 else "licence"))
    print("FAIL" if bad else "PASS")
sys.exit(1 if bad else 0)
