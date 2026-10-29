#!/usr/bin/env python3
"""Run small package tests without the original course or network.

Works in a temporary folder (deleted afterwards), so it runs from a read-only skill install and leaves nothing behind.
Python standard library only. verified: Windows 10, Python 3.13; not verified: macOS, Linux.
"""
import json, sys, tempfile, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_single_file import build
from asset_manifest import manifest
import hashlib
import validate_skill
from validate_skill import validate, private_hits

root = HERE.parent
errors = validate(root)
assert not errors, errors
validate_skill.PRIVATE_HASHES.add(hashlib.sha256(b'probe name').hexdigest())
assert private_hits('made by Probe Name today') == ['probe name'] and not private_hits('a neutral sentence')

catalogue = json.loads((root / 'references/asset-catalog.json').read_text(encoding='utf-8'))
listed = {a['path'] for a in catalogue['included']}
shipped = {p.relative_to(root).as_posix() for d in ('assets/generated', 'assets/models', 'assets/fonts') for p in (root / d).rglob('*') if p.is_file()}
assert listed == shipped, ('catalogue and assets differ', sorted(listed ^ shipped))
for a in catalogue['included']:
    data = (root / a['path']).read_bytes()
    assert len(data) == a['bytes'] and hashlib.sha256(data).hexdigest() == a['sha256'], ('stale catalogue entry', a['path'])

with tempfile.TemporaryDirectory(prefix='html-master-self-test-') as tmp:
    base = Path(tmp)
    (base/'template.html').write_text('<style>{{CSS}}</style><script>{{JS}}</script><script type="application/json">{{DATA}}</script><img src="{{PIC}}">',encoding='utf-8')
    (base/'style.css').write_text('body{color:#fff}/*</STYLE>*/',encoding='utf-8')
    (base/'app.js').write_text('const t="{{CSS}} stays literal";const s="</SCRIPT>";',encoding='utf-8')
    (base/'data.json').write_text('{"tag":"</script>"}',encoding='utf-8')
    (base/'pic.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>',encoding='utf-8')
    (base/'manifest.json').write_text(json.dumps({'slots':{'CSS':{'path':'style.css','kind':'css'},'JS':{'path':'app.js','kind':'js'},'DATA':{'path':'data.json','kind':'json'},'PIC':{'path':'pic.svg','kind':'data-url'}}}),encoding='utf-8')
    output = base/'out.html'; build(base,Path('template.html'),Path('manifest.json'),output)
    html = output.read_text(encoding='utf-8')
    assert 'data:image/svg+xml;base64,' in html and '\\u003c/script>' in html
    assert '<\\/STYLE>' in html and '<\\/SCRIPT>' in html, 'closing tags must be escaped in any case'
    assert '{{CSS}} stays literal' in html, 'tokens inside embedded content must not be replaced'
    try:
        build(base, Path('../outside.html'), Path('manifest.json'), base/'x.html'); raise AssertionError('path escape accepted')
    except ValueError: pass
    assets = manifest(base,['pic.svg']); assert len(assets)==1 and len(assets[0]['sha256'])==64
    with zipfile.ZipFile(base/'check.skill','w') as z: z.write(root/'SKILL.md','html-master/SKILL.md')
    with zipfile.ZipFile(base/'check.skill') as z: assert z.testzip() is None
print('self-test passed: links, privacy and path scan, catalogue, embedding and escaping, manifest, ZIP CRC')
