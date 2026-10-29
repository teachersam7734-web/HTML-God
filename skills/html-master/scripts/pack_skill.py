#!/usr/bin/env python3
"""Create a .skill ZIP with exactly one html-master root directory (whatever the source folder is called).

Usage: pack_skill.py SKILL_FOLDER OUTPUT.skill. Validates first; skips __pycache__. Python standard library only.
"""
import argparse, zipfile
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_skill import validate

def pack(root: Path, output: Path):
    root=root.resolve(); errors=validate(root)
    if errors: raise ValueError('validation failed: '+repr(errors))
    if output.resolve().is_relative_to(root): raise ValueError('write the archive outside the skill folder')
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for file in sorted(root.rglob('*')):
            if file.is_file() and '__pycache__' not in file.parts:
                z.write(file,arcname=f'html-master/{file.relative_to(root).as_posix()}')
    with zipfile.ZipFile(output) as z:
        if z.testzip(): raise ValueError('ZIP CRC failed')
    return len(zipfile.ZipFile(output).namelist())

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('root',type=Path); p.add_argument('output',type=Path)
    a=p.parse_args(); print(f'Packed {pack(a.root,a.output)} files: {a.output}')
