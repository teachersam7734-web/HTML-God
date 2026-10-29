#!/usr/bin/env python3
"""Embed explicitly listed local resources into an HTML template.

Manifest example: {"slots": {"STYLES": {"path": "style.css", "kind": "css"}}}
Template token: {{STYLES}}. Kinds: css, js, json, text, data-url.
Only relative paths within --root are accepted. Never interpolate untrusted HTML.
Tokens are replaced in one pass, so a {{NAME}} that appears inside embedded content is left alone.
Python standard library only. verified: Windows 10, Python 3.13 (self_test.py); not verified: macOS, Linux.
"""
import argparse, base64, json, mimetypes, re
from pathlib import Path

def within(root: Path, rel: str) -> Path:
    path = (root / rel).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError(f"asset escapes root or is missing: {rel}")
    return path

def embed(root: Path, entry: dict) -> str:
    path = within(root, entry['path'])
    kind = entry['kind']
    if kind == 'data-url':
        mime = entry.get('mime') or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"
    raw = path.read_text(encoding='utf-8-sig')
    if kind == 'css':
        return re.sub(r'</(style)', r'<\\/\1', raw, flags=re.I)
    if kind == 'js':
        return re.sub(r'</(script)', r'<\\/\1', raw, flags=re.I).replace('<!--', '<\\!--')
    if kind == 'json':
        return json.dumps(json.loads(raw), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    if kind == 'text':
        return raw
    raise ValueError(f"unknown kind: {kind}")

def build(root: Path, template: Path, manifest: Path, output: Path):
    config = json.loads(within(root, str(manifest)).read_text(encoding='utf-8-sig'))
    html = within(root, str(template)).read_text(encoding='utf-8-sig')
    slots = config['slots']
    for name in slots:
        if '{{' + name + '}}' not in html:
            raise ValueError(f"missing token: {{{{{name}}}}}")
    values = {name: embed(root, entry) for name, entry in slots.items()}
    pattern = re.compile('|'.join(re.escape('{{' + name + '}}') for name in values))
    html = pattern.sub(lambda m: values[m.group(0)[2:-2]], html)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding='utf-8')
    return output.stat().st_size

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--template', type=Path, required=True, help='relative to root')
    p.add_argument('--manifest', type=Path, required=True, help='relative to root')
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    print(f"Wrote {build(a.root, a.template, a.manifest, a.output):,} bytes to {a.output}")
