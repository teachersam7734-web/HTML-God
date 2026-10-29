#!/usr/bin/env python3
"""Check package structure, relative Markdown links, private strings, machine paths and dashes.

Private names from the original project are stored only as SHA-256 hashes of lower-case words and word pairs, so the
validator itself does not carry the branding it guards against. Python standard library only.
verified: Windows 10, Python 3.13; not verified: macOS, Linux.
"""
import argparse, hashlib, json, re, sys
from pathlib import Path

REQUIRED = ['SKILL.md','assets/starter/index.html','scripts/build_single_file.py',
            'scripts/asset_manifest.py','scripts/browser_smoke.cjs','scripts/self_test.py',
            'references/asset-catalog.json','examples/project-source/SOURCE-MAP.md','CHANGELOG.md']
PRIVATE_HASHES = {
    'b08eb5b1b603513394ea59d0fec2697d4da157086887fd279faa47bc0d0ed6da',  # original brand name
    '31752868a6afadf0ae5f4a4a2aa6ea01e62bad0e736f41d7ba8737dd7e255859',  # original brand stem
    'd2504ada0f4df48e9dc7d36d88cf2e68d004ca20339360601997ad99a3beda3e',  # original machine user name
    '59e008c40b656937393fb031fac696890723300f914f7abc002591a0d93a6f20',  # original workspace folder
}
PATTERNS = {
    'embedded PDF data': r'data:application/pdf;' + 'base64,',  # split so this file does not match itself
    'machine path': r'(?<![A-Za-z])[A-Za-z]:\\(?:Users|Documents and Settings)\\|/Users/[A-Za-z][^/\s]*/|/home/[a-z][^/\s]*/',
    'em or en dash': '[\u2013\u2014]',
}
TEXT = {'.md','.py','.js','.cjs','.mjs','.json','.html','.css','.yaml','.yml','.txt'}

def private_hits(text):
    words = re.findall(r'[a-z0-9]+', text.lower())
    grams = set(words) | {a + ' ' + b for a, b in zip(words, words[1:])}
    return sorted(g for g in grams if hashlib.sha256(g.encode()).hexdigest() in PRIVATE_HASHES)

def validate(root: Path):
    root = root.resolve()
    errors = []
    for rel in REQUIRED:
        if not (root / rel).is_file(): errors.append(f'missing {rel}')
    for md in root.rglob('*.md'):
        text = md.read_text(encoding='utf-8-sig')
        for link in re.findall(r'\]\(([^)]+)\)', text):
            if link.startswith(('http://','https://','#','mailto:','data:')): continue
            target = (md.parent / link.split('#')[0]).resolve()
            if not target.is_relative_to(root) or not target.exists(): errors.append(f'broken link {md.relative_to(root).as_posix()} -> {link}')
    for file in root.rglob('*'):
        if file.is_file() and file.suffix.lower() in TEXT and '__pycache__' not in file.parts:
            data = file.read_text(encoding='utf-8-sig')
            rel = file.relative_to(root).as_posix()
            if private_hits(data): errors.append(f'private name in {rel}')
            for label, pattern in PATTERNS.items():
                if re.search(pattern, data): errors.append(f'{label} in {rel}')
    return errors

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('root',type=Path); p.add_argument('--output',type=Path)
    a=p.parse_args(); errors=validate(a.root)
    result={'valid':not errors,'errors':errors,'files':sum(f.is_file() and '__pycache__' not in f.parts for f in a.root.rglob('*'))}
    if a.output: a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2)); sys.exit(bool(errors))
