#!/usr/bin/env python3
"""GOAT-HTML three.js inliner: fetch, minify and inject three.js and postprocessing.

Usage:
  python inline_three.py <file.html> [--three-anchor '<!--__THREE__-->'] [--bloom]
                        [--pin 0.128.0] [--base URL] [--minifier auto|none|npx]

Behaviour:
  * Downloads build/three.min.js (and, with --bloom, EffectComposer, RenderPass,
    ShaderPass, UnrealBloomPass and the two shaders they require) for the pinned
    npm version from jsDelivr (or --base, a mirror with the same layout).
  * The bloom files come from examples/js/ (classic scripts that extend the global
    THREE). three.js removed examples/js in r148, so --bloom needs a pin of 0.147.0
    or older; newer versions ship ES modules only (bundle them instead:
    media-embedding.md section 7).
  * Minifies the unminified files with the first minifier found: GOAT_MINIFIER (a command
    that reads a file argument and writes to stdout), `terser` or `esbuild` on PATH;
    `--minifier npx` downloads terser through npx; `--minifier none` embeds as is.
  * Injects at --three-anchor in dependency order (core, shaders, passes), one
    <script> per file, then checks the file holds each injected blob exactly once and
    prints the size of each (weight is information, not a budget).
  * Keeps the HTML file's line endings as they were.

The default pin, 0.128.0 (r128), is the version the shipped Arabian Nights build used
with EffectComposer and UnrealBloomPass. Pin a version you have tested.
"""
import argparse, os, shlex, shutil, subprocess, sys, tempfile, urllib.request

DEFAULT_PIN = "0.128.0"
DEFAULT_BASE = "https://cdn.jsdelivr.net/npm/three@{pin}/"

POST = [
    "postprocessing/EffectComposer.js",
    "postprocessing/RenderPass.js",
    "postprocessing/ShaderPass.js",
    "shaders/CopyShader.js",
    "shaders/LuminosityHighPassShader.js",
    "postprocessing/UnrealBloomPass.js",
]


def fetch(url):
    print(f"  fetch {url}", flush=True)
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def find_minifier(mode):
    """Return a function bytes->bytes, or None to embed unminified."""
    if mode == "none":
        return None
    env = os.environ.get("GOAT_MINIFIER")
    if mode == "auto" and env:
        cmd = shlex.split(env, posix=(os.name != "nt"))
        return lambda src: run_min(cmd + [src])
    if mode == "auto":
        terser = shutil.which("terser")
        if terser:
            return lambda src: run_min([terser, src, "-c", "-m"])
        esbuild = shutil.which("esbuild")
        if esbuild:
            return lambda src: run_min([esbuild, src, "--minify"])
        return None
    if mode == "npx":
        npx = shutil.which("npx")        # resolves npx.cmd on Windows
        if npx:
            return lambda src: run_min([npx, "-y", "terser", src, "-c", "-m"])
    return None


def run_min(cmd):
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0 or not r.stdout.strip():
        raise RuntimeError((r.stderr or b"").decode("utf-8", "replace")[:300])
    return r.stdout


def minify(js_bytes, name, minifier):
    if minifier is None:
        print(f"  (no minifier: embedding {name} unminified; see --minifier)")
        return js_bytes
    fd, src = tempfile.mkstemp(suffix=".js")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(js_bytes)
        out = minifier(src)
    except Exception as ex:
        print(f"  minifier failed on {name}: {ex}; embedding unminified")
        return js_bytes
    finally:
        try: os.unlink(src)
        except OSError: pass
    print(f"  minified {name}: {len(js_bytes)/1024:.0f} KB -> {len(out)/1024:.0f} KB")
    return out


def main():
    ap = argparse.ArgumentParser(description="Inline three.js (and bloom passes) into one HTML file.")
    ap.add_argument("html")
    ap.add_argument("--three-anchor", default="<!--__THREE__-->")
    ap.add_argument("--bloom", action="store_true")
    ap.add_argument("--pin", default=DEFAULT_PIN, help="npm version of three, e.g. 0.128.0 (r128)")
    ap.add_argument("--base", default=None, help="mirror URL holding build/ and examples/js/")
    ap.add_argument("--minifier", default="auto", choices=["auto", "none", "npx"])
    args = ap.parse_args()

    pin = args.pin.lstrip("r")
    if pin.isdigit():                       # accept r128 as well as 0.128.0
        pin = f"0.{pin}.0"
    base = (args.base or DEFAULT_BASE.format(pin=pin)).rstrip("/") + "/"
    try:
        minor = int(pin.split(".")[1])
    except (IndexError, ValueError):
        minor = 0
    if args.bloom and minor >= 148:
        sys.exit(f"FAIL: three {pin} has no examples/js (removed in r148); use --pin 0.147.0 "
                 "or older, or bundle the ES modules with esbuild.")

    files = [("three.min.js", base + "build/three.min.js", True)]
    if args.bloom:
        files += [(p, base + "examples/js/" + p, False) for p in POST]

    with open(args.html, encoding="utf-8", newline="") as fh:
        html = fh.read()
    if html.count(args.three_anchor) != 1:
        sys.exit(f"FAIL: anchor {args.three_anchor!r} must appear exactly once "
                 f"(found {html.count(args.three_anchor)}).")

    minifier = find_minifier(args.minifier)
    blobs, total = [], 0
    for name, url, already_min in files:
        js = fetch(url)
        if not already_min:
            js = minify(js, name, minifier)
        text = js.decode("utf-8", "replace")
        if "</script" in text.lower():
            text = text.replace("</script", "<\\/script").replace("</SCRIPT", "<\\/SCRIPT")
        total += len(js)
        blobs.append((name, f"<script>/* {name} (three {pin}, inlined by GOAT-HTML) */\n{text}\n</script>"))
        print(f"  + {name}: {len(js)/1024:.1f} KB")

    nl = "\r\n" if "\r\n" in html else "\n"
    html = html.replace(args.three_anchor, nl.join(b for _, b in blobs) + nl + "<!--__THREE_DONE__-->")
    with open(args.html, "w", encoding="utf-8", newline="") as fh:
        fh.write(html)

    missing = [n for n, b in blobs if html.count(b) != 1]
    if missing:
        sys.exit(f"FAIL: after writing, these blobs are not present exactly once: {missing}")
    print(f"OK: injected {len(blobs)} file(s), {total/1024:.0f} KB total (information, no budget). "
          f"Runtime check: open the page and evaluate `typeof THREE` (expect 'object').")


if __name__ == "__main__":
    main()
