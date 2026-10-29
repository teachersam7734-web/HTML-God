#!/usr/bin/env python3
"""GOAT-HTML static gate: Python standard library only (Node is used when present).

Usage:  python verify_html.py <file.html> [--strict] [--offline]

Checks:
  * tag balance (div/section/script/style/audio/video/canvas/nav/...)
  * inline <script> sanity by type: classic scripts with `node --check` (.js), module
    scripts with `node --check` (.mjs), JSON types (importmap, ld+json, application/json)
    with a JSON parse; other types (shaders, templates) are skipped and named.
    Without Node: literal-stripped brace/paren/bracket balance (warning grade).
  * network references (script/link/img/audio/video/source/iframe src or href, CSS
    @import and url()): warned; with --offline they fail (a file that must work offline)
  * reduced motion: animation present (CSS animation, @keyframes, requestAnimationFrame,
    .animate()) but no prefers-reduced-motion anywhere: warned
  * data-URI census (count + estimated bytes by type)
  * best-effort data-contract audit for a `const DB=[...]` pattern
  * weight report: total, biggest lines, per-type embed weight. Information only:
    there is no budget unless the user asked for one.

Exit 0 = pass; exit 1 = any FAIL (strict mode makes warnings fail too); exit 2 = usage.
"""
import json, os, re, shutil, subprocess, sys, tempfile

TAGS = ["div", "section", "script", "style", "audio", "video", "canvas",
        "nav", "header", "footer", "main", "form", "table"]
URI_RE = re.compile(rb"data:(image|audio|font|video)/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)")
SCRIPT_RE = re.compile(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", re.S | re.I)
TYPE_RE = re.compile(r"""\btype\s*=\s*["']?([^"'\s>]+)""", re.I)
OPEN_RE = {t: re.compile(r"<" + t + r"(?=[\s>])", re.I) for t in TAGS}
CLOSE_RE = {t: re.compile(r"</" + t + r"\s*>", re.I) for t in TAGS}
DB_DECL_RE = re.compile(r"const\s+(DB)\s*=\s*\[")
BARE_KEY_RE = re.compile(r"([{,]\s*)([A-Za-z_]\w*)\s*:")
NET_ATTR_RE = re.compile(
    r"""<(script|link|img|audio|video|source|iframe|embed|track)\b[^>]*?\b(src|href)\s*=\s*["']?((?:https?:)?//[^"'\s>]+)""",
    re.I)
NET_CSS_RE = re.compile(r"""(@import\s+(?:url\()?|url\()\s*["']?((?:https?:)?//[^"')\s]+)""", re.I)
ANIM_RE = re.compile(r"@keyframes|\banimation\s*:|requestAnimationFrame|\.animate\(", re.I)
CLASSIC_TYPES = {"", "text/javascript", "application/javascript", "javascript"}
JSON_TYPES = {"importmap", "application/json", "application/ld+json", "speculationrules"}


def js_single_to_double(s: str) -> str:
    """Convert single-quoted JS string literals to JSON double quotes (best effort).
    Quote-aware: double-quoted strings are copied verbatim (apostrophes inside them
    are data, not delimiters)."""
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '"':                      # copy double-quoted string verbatim
            j = i + 1
            while j < n:
                if s[j] == "\\": j += 2; continue
                if s[j] == '"': j += 1; break
                j += 1
            out.append(s[i:j]); i = j
        elif c == "'":                    # convert single-quoted string
            i += 1; buf = []
            while i < n and s[i] != "'":
                if s[i] == "\\" and i + 1 < n:
                    esc = s[i+1]
                    buf.append({"n": "\\n", "t": "\\t", "r": "\\r", "'": "'",
                                "\\": "\\\\", '"': '\\"', "/": "/"}.get(esc, esc))
                    i += 2
                else:
                    if s[i] == '"': buf.append('\\"')
                    else: buf.append(s[i])
                    i += 1
            i += 1
            out.append('"' + "".join(buf) + '"')
        else:
            out.append(c); i += 1
    return "".join(out)


def strip_js_literals(js: str) -> str:
    out, i, n = [], 0, len(js)
    while i < n:
        c = js[i]
        if c in "\"'`":
            q = c; i += 1
            while i < n:
                if js[i] == "\\": i += 2; continue
                if js[i] == q: i += 1; break
                i += 1
            out.append(" ")
        elif js[i:i+2] == "//":
            while i < n and js[i] != "\n": i += 1
        elif js[i:i+2] == "/*":
            j = js.find("*/", i + 2); i = n if j < 0 else j + 2
        else:
            out.append(c); i += 1
    return "".join(out)


def node_check(node, js, suffix):
    fd, tmp = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            f.write(js)
        r = subprocess.run([node, "--check", tmp], capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        return r.returncode, (r.stderr or "").strip()
    finally:
        try: os.unlink(tmp)
        except OSError: pass


def main():
    args = sys.argv[1:]
    strict = "--strict" in args
    offline = "--offline" in args
    paths = [a for a in args if not a.startswith("--")]
    if not paths:
        print(__doc__); sys.exit(2)
    path = paths[0]
    with open(path, "rb") as fh:
        raw = fh.read()
    html = raw.decode("utf-8", "replace")
    fails, warns, infos = [], [], []

    for t in TAGS:
        o, c = len(OPEN_RE[t].findall(html)), len(CLOSE_RE[t].findall(html))
        if o != c:
            (fails if t in ("script", "style", "div") else warns).append(
                f"tag balance: <{t}> open={o} close={c}")

    node = shutil.which("node")
    weak_note = False
    for idx, (attrs, js) in enumerate(SCRIPT_RE.findall(html)):
        m = TYPE_RE.search(attrs)
        typ = (m.group(1).lower() if m else "")
        if typ in JSON_TYPES:
            try:
                json.loads(js)
            except ValueError as ex:
                fails.append(f"script#{idx} ({typ}): not valid JSON: {ex}")
            continue
        if typ not in CLASSIC_TYPES and typ != "module":
            infos.append(f"script#{idx}: type={typ} not JavaScript, skipped")
            continue
        if node:
            code, err = node_check(node, js, ".mjs" if typ == "module" else ".js")
            if code != 0:
                fails.append(f"script#{idx}: node --check failed: {err[:300]}")
        else:
            stripped = strip_js_literals(js)
            for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
                if stripped.count(a) != stripped.count(b):
                    warns.append(f"script#{idx}: unbalanced {a}{b} "
                                 f"({stripped.count(a)} vs {stripped.count(b)})")
            weak_note = True
    if weak_note:
        infos.append("node not found: JS checked by brace balance only (weaker)")

    nets = sorted({m.group(3) for m in NET_ATTR_RE.finditer(html)} |
                  {m.group(2) for m in NET_CSS_RE.finditer(html)})
    for u in nets:
        msg = f"network reference: {u[:120]}"
        (fails if offline else warns).append(msg + (" (--offline)" if offline else ""))

    if ANIM_RE.search(html) and "prefers-reduced-motion" not in html:
        warns.append("animation found but no prefers-reduced-motion anywhere: "
                     "every animated system needs its reduced-motion path")

    census = {}
    for fam, sub, b64 in URI_RE.findall(raw):
        key = f"{fam.decode()}/{sub.decode()}"
        census.setdefault(key, [0, 0])
        census[key][0] += 1
        census[key][1] += len(b64) * 3 // 4
    for key, (cnt, approx) in sorted(census.items()):
        infos.append(f"embed {key}: x{cnt}, ~{approx/1024:.1f} KB")
    for key, (cnt, _) in census.items():
        if cnt > 1 and key.startswith("font/"):
            warns.append(f"{key} appears {cnt}x: check for duplicates, one @font-face per face")
    audio = census.get("audio/mpeg", [0, 0])
    if audio[0] >= 50:
        infos.append(f"audio registry: {audio[0]} clips, ~{audio[1]/1048576:.1f} MB "
                     "(information only)")

    m = DB_DECL_RE.search(html)
    if m:
        open_idx = html.find("[", m.start())
        depth, end = 0, -1
        for i in range(open_idx, len(html)):
            c = html[i]
            if c == "[": depth += 1
            elif c == "]":
                depth -= 1
                if not depth: end = i; break
        blob = html[open_idx:end + 1] if end > 0 else ""
        blob = re.sub(r"/\*.*?\*/", "", blob, flags=re.S)          # comments out
        blob = re.sub(r",(\s*[\]}])", r"\1", blob)                 # trailing commas
        blob = BARE_KEY_RE.sub(r'\1"\2":', blob)                   # unquoted keys
        blob = js_single_to_double(blob)                           # '...' -> "..."
        try:
            db = json.loads(blob)
            shape = {}
            for e in db:
                for k, v in e.items():
                    s = shape.setdefault(k, [0, set()])
                    s[0] += 1
                    s[1].add(type(v).__name__ if not isinstance(v, list) else f"list[{len(v)}]")
            infos.append(f"DB audit: {len(db)} entries; fields: " +
                         ", ".join(f"{k}:{v[1].pop() if len(v[1])==1 else '?'}({v[0]}/{len(db)})"
                                   for k, v in sorted(shape.items())))
            for req in ("n", "d"):
                if req in shape and shape[req][0] != len(db):
                    warns.append(f"DB field '{req}' missing on some entries")
        except Exception as ex:
            warns.append(f"DB found but not JSON-parseable after cleanup ({ex}); shape not audited")

    biggest = sorted(((len(l), i + 1) for i, l in enumerate(html.split("\n"))), reverse=True)[:3]
    for sz, ln in biggest:
        if sz > 100_000:
            infos.append(f"line {ln}: {sz/1e6:.2f} MB (embed blob: never line-edit inside)")
    total = len(raw)
    infos.append(f"weight: {total/1024:.1f} KB ({total/1048576:.2f} MB), {html.count(chr(10))+1} lines "
                 "(information only, no budget)")

    for w in warns: print(f"WARN  {w}")
    for f in fails: print(f"FAIL  {f}")
    for i in infos: print(f"info  {i}")
    bad = fails or (strict and warns)
    print(("STRICT " if strict else "") + ("VERDICT: FAIL" if bad else "VERDICT: PASS"))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
