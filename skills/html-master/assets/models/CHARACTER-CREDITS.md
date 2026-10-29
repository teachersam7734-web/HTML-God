# Model notices

- `human.glb`: Quaternius CC0 character, obtained through [UMRAM/Bilkent's supine-human-model repository](https://github.com/UMRAM-Bilkent/supine-human-model), whose README states the source character and the repository are CC0 1.0 (checked 27 October 2026). The course recoloured/resized it and used its Idle rig animation.
- `robot.glb`: RobotExpressive by Tomás Laulhé / Quaternius, converted/refined by Don McCurdy, obtained from [Three.js example models](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive). CC0 1.0 per the model's README (checked 27 October 2026); the course resized/recoloured it and used its idle animation.
- `brain-surface.bin`: adapted surface from [Brain Project](https://github.com/itayinbarr/brainproject), Z-Anatomy and BodyParts3D. CC BY-SA 4.0; preserve [the included notice](brain-surface-LICENSE.txt), attribution and share-alike for adaptations.

`brain-surface.bin` is an application-specific vertex format, not a generic GLB, and its decoder is not part of this package. The layout (read from the file on 27 October 2026, little-endian): the four ASCII bytes `IARB`; a uint32 vertex count (174,658); a uint32 index count (961,995); vertex positions as float32 x, y, z for every vertex; unit normals as float32 x, y, z for every vertex; then uint32 triangle indices. In Three.js:

```js
const view = new DataView(buffer), n = view.getUint32(4, true), m = view.getUint32(8, true);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, 12, n * 3), 3));
geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(buffer, 12 + n * 12, n * 3), 3));
geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, 12 + n * 24, m), 1));
```

The original full brain model was not included because the adapted geometry and required attribution are enough to study the course's UI pattern. Each file still needs a row in the next project's licence ledger. Review upstream notices and project-specific distribution terms when replacing these assets.
