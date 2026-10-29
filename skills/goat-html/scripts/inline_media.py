#!/usr/bin/env python3
"""GOAT-HTML media inliner: resize + base64-embed an image into one HTML data URI.

Usage:
  python inline_media.py <image> <file.html> [--selector '#logo'] [--max-h 144]
                         [--max-w 480] [--fmt png|webp|jpeg] [--quality 80]
                         [--dry-run]

Behaviour:
  * Resizes to FIT INSIDE max-h/max-w (never crops: the identity-art rule).
  * Re-encodes with requested format/quality, base64-encodes.
  * Selector supports #id, .class, or bare tag. Finds matching <img> tags:
      - exactly one with a data URI -> swaps the URI in place;
      - exactly one without any src -> injects src;
      - anything else -> refuses with a clear error (no ambiguity tolerated).
  * --dry-run reports the plan and writes nothing.
  * Keeps the HTML file's line endings and encoding (UTF-8) exactly as they were.

Requires Pillow:  pip install pillow
"""
import argparse, base64, io, os, re, sys

def sel_regex(sel):
    m = re.fullmatch(r"#([\w-]+)", sel)
    if m:
        return re.compile(r"""id\s*=\s*["']""" + re.escape(m.group(1)) + r"""["']""", re.I)
    m = re.fullmatch(r"\.([\w-]+)", sel)
    if m:
        return re.compile(r"""class\s*=\s*["'][^"']*\b""" + re.escape(m.group(1)) + r"""\b[^"']*["']""", re.I)
    m = re.fullmatch(r"([a-zA-Z][\w-]*)", sel)
    if m:
        return re.compile(r"<" + re.escape(m.group(1)) + r"(?=[\s>])", re.I)
    sys.exit(f"FAIL: unsupported selector {sel!r}: use #id, .class, or a bare tag")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image"); ap.add_argument("html")
    ap.add_argument("--selector", default="img")
    ap.add_argument("--max-h", type=int, default=144)
    ap.add_argument("--max-w", type=int, default=480)
    ap.add_argument("--fmt", default="png", choices=["png", "webp", "jpeg"])
    ap.add_argument("--quality", type=int, default=80)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    try:
        from PIL import Image
    except ImportError:
        sys.exit("FAIL: Pillow not installed: pip install pillow")

    im = Image.open(a.image)
    im.thumbnail((a.max_w, a.max_h))                      # fit inside, never crop
    buf = io.BytesIO()
    save = {"png": dict(optimize=True), "webp": dict(quality=a.quality),
            "jpeg": dict(quality=a.quality, optimize=True)}[a.fmt]
    if a.fmt in ("jpeg", "webp") and im.mode in ("RGBA", "P", "LA"):
        im = im.convert("RGB")
    im.save(buf, a.fmt.upper(), **save)
    b64 = base64.b64encode(buf.getvalue()).decode()
    uri = f"data:image/{a.fmt};base64," + b64
    new_kb = len(b64) * 3 / 4 / 1024
    print(f"resized {im.size[0]}x{im.size[1]} -> {a.fmt}, {new_kb:.1f} KB "
          f"(source {os.path.getsize(a.image)/1024:.1f} KB)")

    with open(a.html, encoding="utf-8", newline="") as fh:   # newline="": keep LF/CRLF as is
        html = fh.read()
    tag_re = re.compile(r"<img\b[^>]*>", re.I)
    sel = sel_regex(a.selector)
    hits = [(m.start(), m.end(), m.group(0)) for m in tag_re.finditer(html) if sel.search(m.group(0))]
    if not hits:
        sys.exit(f"FAIL: no <img> matching selector {a.selector!r}.")
    with_uri = [(s, e, t) for s, e, t in hits
                if re.search(r"""src\s*=\s*["']data:image/""", t, re.I)]
    plain = [(s, e, t) for s, e, t in hits
             if re.search(r"""src\s*=\s*["'][^"']*["']""", t) and not re.search(r"src\s*=\s*['\"]data:image/", t, re.I)]

    if with_uri:
        if len(with_uri) != 1:
            sys.exit(f"FAIL: {len(with_uri)} matching <img> tags carry data URIs; "
                     "expected exactly 1. Refusing to guess.")
        s, e, tag = with_uri[0]
        action = f"swap data URI in {tag[:60]}..."
    elif len(hits) == 1 and not plain:
        s, e, tag = hits[0]
        action = f"inject src into {tag[:60]}..."
    else:
        sys.exit(f"FAIL: {len(hits)} matching <img> tags, none with a data URI to swap; "
                 "point --selector at the specific element.")
    print(f"plan: {action}")
    if a.dry_run:
        print("DRY-RUN: no changes written."); return

    if with_uri:
        new_tag = re.sub(r"""(src\s*=\s*["'])data:image/[^"']+(["'])""",
                         lambda m: m.group(1) + uri + m.group(2), tag, count=1)
    else:
        body = tag[:-2].rstrip() if tag.endswith("/>") else tag[:-1]    # keep <img ... /> valid
        new_tag = body + f' src="{uri}"' + (" />" if tag.endswith("/>") else ">")
    html = html[:s] + new_tag + html[e:]
    with open(a.html, "w", encoding="utf-8", newline="") as fh:
        fh.write(html)
    print(f"OK: {a.html} updated (+{new_kb:.1f} KB). Verify: "
          f"`grep -o 'data:image/{a.fmt};base64' {a.html} | wc -l` counts what you expect.")

if __name__ == "__main__":
    main()
