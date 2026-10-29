#!/usr/bin/env python3
"""Regenerate the included-asset catalogue and intentional-exclusion record.

Python standard library only. Run it after adding, removing or editing any file under assets/generated, assets/models
or assets/fonts; self_test.py fails while the catalogue is stale.
"""
import hashlib, json, mimetypes
from pathlib import Path

root=Path(__file__).resolve().parents[1]
notes={
 'premium-solar.png':('Native image generator','Warm glass torus concept background; non-personal'),
 'premium-emerald.png':('Native image generator','Emerald glass architecture concept background; non-personal'),
 'neural-environment.png':('Native image generator','Artistic microscopic neural environment; not anatomical'),
 'neural-knot.png':('Native image generator','Conceptual neural visual; not anatomical'),
 'human.glb':('Quaternius / UMRAM-Bilkent, CC0','Rigged character; see model credits'),
 'robot.glb':('Quaternius / Three.js examples, CC0','Expressive robot; see model credits'),
 'brain-surface.bin':('Brain Project/Z-Anatomy/BodyParts3D, CC BY-SA 4.0','Adapted course-specific cortex geometry; see notice'),
 'brain-surface-LICENSE.txt':('Notice written for this package','CC BY-SA 4.0 attribution and change notice for brain-surface.bin'),
 'CHARACTER-CREDITS.md':('Notice written for this package','Credits, licences and file format for the three models'),
 'orbitron-1.ttf':('Orbitron, (c) The Orbitron Project Authors, version 2.001, SIL OFL 1.1','Display font, Bold; notice in Orbitron-OFL.txt'),
 'premium-BarlowCondensed-1.ttf':('Barlow Condensed, (c) The Barlow Project Authors, version 1.408, SIL OFL 1.1','Cinematic heading font, Bold; notice in BarlowCondensed-OFL.txt'),
 'premium-Manrope-1.ttf':('Manrope, (c) The Manrope Project Authors, version 4.504, SIL OFL 1.1','Reading and interface font, Medium; notice in Manrope-OFL.txt'),
 'Orbitron-OFL.txt':('SIL Open Font License 1.1 text','Licence notice for orbitron-1.ttf (Reserved Font Name: Orbitron)'),
 'BarlowCondensed-OFL.txt':('SIL Open Font License 1.1 text','Licence notice for premium-BarlowCondensed-1.ttf'),
 'Manrope-OFL.txt':('SIL Open Font License 1.1 text','Licence notice for premium-Manrope-1.ttf'),
}
assets=[]
for folder in ['assets/generated','assets/models','assets/fonts']:
 for path in sorted((root/folder).rglob('*')):
  if not path.is_file():continue
  if path.name not in notes: raise SystemExit(f'no catalogue note for {path.relative_to(root).as_posix()}: add one to notes')
  origin,role=notes[path.name]
  assets.append({'path':path.relative_to(root).as_posix(),'bytes':path.stat().st_size,
                 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                 'mime':mimetypes.guess_type(path.name)[0] or 'application/octet-stream',
                 'origin':origin,'role':role})
excluded=[
 {'kind':'personal portrait and signature','reason':'Identity-specific user-supplied material; not a reusable default'},
 {'kind':'generated portrait series','reason':'Identity-specific variants made with the portrait reference'},
 {'kind':'book PDF, manuscript, covers and bonus manuscript','reason':'Course-specific authored and supplied content'},
 {'kind':'background music and user-supplied films','reason':'Course-specific media and uncertain portability outside this project'},
 {'kind':'password string','reason':'Local gate value is personal and provides no reusable security'},
 {'kind':'third-party runtime libraries and paid templates','reason':'Install or acquire from the verified upstream source under its current terms'},
]
out=root/'references/asset-catalog.json'
out.write_text(json.dumps({'purpose':'Included portable reference assets and exclusions','included':assets,'excluded':excluded},indent=2),encoding='utf-8')
print(f'{len(assets)} catalogued assets')
