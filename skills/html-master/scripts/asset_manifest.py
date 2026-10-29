#!/usr/bin/env python3
"""List allowed-root files with path, size, MIME and SHA-256; reject symlinks and paths outside the root.

Usage: asset_manifest.py --root DIR --include REL [--include REL ...] --output FILE
Paths in the output are relative to the root, and the root is recorded by folder name only, so a manifest carries no
machine-specific path. Python standard library only.
"""
import argparse, hashlib, json, mimetypes
from pathlib import Path

def manifest(root: Path, includes: list[str]):
    root = root.resolve()
    items = []
    for rel in includes:
        target = root / rel
        paths = sorted(target.rglob('*')) if target.is_dir() else [target]
        for path in paths:
            if path.is_symlink():
                raise ValueError(f"symlink not allowed: {path}")
            if not path.is_file():
                continue
            safe = path.resolve()
            if not safe.is_relative_to(root):
                raise ValueError(f"outside root: {path}")
            items.append({'path': safe.relative_to(root).as_posix(), 'bytes': safe.stat().st_size,
                          'mime': mimetypes.guess_type(safe.name)[0] or 'application/octet-stream',
                          'sha256': hashlib.sha256(safe.read_bytes()).hexdigest()})
    return sorted({i['path']: i for i in items}.values(), key=lambda x: x['path'])

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--include', action='append', required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps({'root': a.root.resolve().name, 'assets': manifest(a.root, a.include)}, indent=2), encoding='utf-8')
    print(a.output)
