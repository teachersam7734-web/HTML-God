// make_demo_glb.mjs: build the demo model without Blender (glTF-Transform Document API) and write it three ways:
// demo-raw.glb, demo-draco.glb (KHR_draco_mesh_compression), demo-meshopt.glb (EXT_meshopt_compression).
//
//   node make_demo_glb.mjs <outDir>          (run from the work folder that holds node_modules, see package.json)
//
// It holds the three animation kinds Blender's glTF exporter writes (node TRS, skin, morph target) and two named
// clips, Idle and Orbit, as an NLA_TRACKS export would. It is the test fixture for the web half and a worked example
// of the Document API (accessors, a morph target, a skin with inverse bind matrices, animation channels).
// verified: Windows 10, Node 24, glTF-Transform 4.5.1, draco3dgltf 1.5.9, meshoptimizer 1.3.0: all three files pass
//           gltf-transform validate with no errors or warnings and glb_audit.mjs, and play in the player (test-web.mjs).
// not verified: textures (the demo has none).
// Copied from blender-demo/web/make_demo_glb.mjs in the HTML-Sensei build project's research notes (not shipped) (original to this project; run there).
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// Packages come from the work folder (the current directory), not from this file's folder, so the script runs in place.
const req = createRequire(join(process.cwd(), 'noop.js'));
const imp = n => import(pathToFileURL(req.resolve(n)).href);
const { Document, NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { draco, meshopt, weld, prune, dedup } = await imp('@gltf-transform/functions');
const draco3d = (await imp('draco3dgltf')).default;
const { MeshoptEncoder } = await imp('meshoptimizer');

const outDir = process.argv[2] || '.';
mkdirSync(outDir, { recursive: true });

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('Scene');

const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const mat = (name, rgb, metal, rough, emissive = [0, 0, 0]) =>
  doc.createMaterial(name).setBaseColorFactor([...rgb, 1]).setMetallicFactor(metal).setRoughnessFactor(rough).setEmissiveFactor(emissive);

// ---------- geometry helpers ----------
function icosphere(subdiv) {
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map(p => { const l = Math.hypot(...p); return p.map(c => c / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < subdiv; s++) {
    const cache = new Map();
    const mid = (a, b) => {
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (cache.has(k)) return cache.get(k);
      const m = v[a].map((c, i) => (c + v[b][i]) / 2); const l = Math.hypot(...m);
      v.push(m.map(c => c / l)); cache.set(k, v.length - 1); return v.length - 1;
    };
    const nf = [];
    for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  return { v, f };
}

function torus(R, r, seg, side) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= side; j++) {
    const u = (i / seg) * Math.PI * 2, w = (j / side) * Math.PI * 2;
    const cx = Math.cos(u) * R, cz = Math.sin(u) * R;
    const nx = Math.cos(u) * Math.cos(w), ny = Math.sin(w), nz = Math.sin(u) * Math.cos(w);
    pos.push(cx + nx * r, ny * r, cz + nz * r); nor.push(nx, ny, nz);
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < side; j++) {
    const a = i * (side + 1) + j, b = (i + 1) * (side + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
}

function cube(s) {
  const h = s / 2, pos = [], nor = [], idx = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  for (const [n, u, v] of faces) {
    const base = pos.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(...[0, 1, 2].map(k => (n[k] + u[k] * a + v[k] * b) * h)); nor.push(...n);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
}

const meshFrom = (name, g, material) =>
  doc.createMesh(name).addPrimitive(
    doc.createPrimitive()
      .setAttribute('POSITION', acc('VEC3', g.pos)).setAttribute('NORMAL', acc('VEC3', g.nor))
      .setIndices(acc('SCALAR', g.idx)).setMaterial(material));

// quaternion about an axis
const q = (ax, ay, az, deg) => { const l = Math.hypot(ax, ay, az), h = (deg * Math.PI) / 360, s = Math.sin(h) / l; return [ax * s, ay * s, az * s, Math.cos(h)]; }; // axis is normalised: the validator rejects non-unit quaternions

// ---------- materials ----------
const mCore = mat('CoreMat', [0.05, 0.55, 0.95], 0.2, 0.35, [0.0, 0.08, 0.2]);
const mRing = mat('RingMat', [0.95, 0.75, 0.2], 1.0, 0.25);
const mTube = mat('TentacleMat', [0.9, 0.25, 0.45], 0.0, 0.5);
const mCube = mat('OrbiterMat', [0.85, 0.9, 0.95], 0.6, 0.3);

// ---------- Core sphere with a "Breathe" morph target ----------
const ico = icosphere(3);
const cpos = new Float32Array(ico.v.flat().map(c => c * 0.9));
const cnor = new Float32Array(ico.v.flat());
const cidx = new Uint16Array(ico.f.flat());
const breatheDelta = new Float32Array(ico.v.length * 3);
ico.v.forEach((p, i) => { const k = 0.18 * (1 + Math.sin(p[1] * 4)); breatheDelta.set(p.map(c => c * k), i * 3); });
const corePrim = doc.createPrimitive()
  .setAttribute('POSITION', acc('VEC3', cpos)).setAttribute('NORMAL', acc('VEC3', cnor))
  .setIndices(acc('SCALAR', cidx)).setMaterial(mCore)
  .addTarget(doc.createPrimitiveTarget('Breathe').setAttribute('POSITION', acc('VEC3', breatheDelta)));
const coreMesh = doc.createMesh('Core').addPrimitive(corePrim).setWeights([0]).setExtras({ targetNames: ['Breathe'] });
const coreNode = doc.createNode('Core').setMesh(coreMesh);

// ---------- Ring ----------
const ringNode = doc.createNode('Ring').setMesh(meshFrom('Ring', torus(1.6, 0.05, 64, 8), mRing));

// ---------- OrbitPivot with three cubes ----------
const pivot = doc.createNode('OrbitPivot');
const cubeMesh = meshFrom('Orbiter', cube(0.22), mCube);
[0, 120, 240].forEach((deg, i) => {
  const a = (deg * Math.PI) / 180;
  pivot.addChild(doc.createNode(`Orbiter${i + 1}`).setMesh(cubeMesh).setTranslation([Math.cos(a) * 2.2, 0.3 * (i - 1), Math.sin(a) * 2.2]));
});

// ---------- Skinned "Tentacle": 3 joints, 9 rings x 8 sides ----------
const rings = 9, sides = 8, height = 2.0, radius = 0.12;
const tpos = [], tnor = [], tjoint = [], tweight = [], tidx = [];
for (let r = 0; r < rings; r++) for (let s = 0; s <= sides; s++) {
  const y = (r / (rings - 1)) * height, a = (s / sides) * Math.PI * 2;
  const taper = radius * (1 - 0.55 * (y / height));
  tpos.push(Math.cos(a) * taper, y, Math.sin(a) * taper); tnor.push(Math.cos(a), 0, Math.sin(a));
  const f = y / 1.0; // joint spacing 1.0
  const j0 = Math.min(2, Math.floor(f)), j1 = Math.min(2, j0 + 1), t = Math.min(1, f - j0);
  // a zero-weight slot must point at joint 0 (validator: ACCESSOR_JOINTS_USED_ZERO_WEIGHT)
  tjoint.push(j0, j0 === j1 || t === 0 ? 0 : j1, 0, 0);   // t === 0 (a vertex exactly on a joint) is a zero weight too
  tweight.push(j0 === j1 ? 1 : 1 - t, j0 === j1 ? 0 : t, 0, 0);
}
for (let r = 0; r < rings - 1; r++) for (let s = 0; s < sides; s++) {
  const a = r * (sides + 1) + s, b = (r + 1) * (sides + 1) + s;
  tidx.push(a, b, a + 1, b, b + 1, a + 1);
}
const tentPrim = doc.createPrimitive()
  .setAttribute('POSITION', acc('VEC3', new Float32Array(tpos))).setAttribute('NORMAL', acc('VEC3', new Float32Array(tnor)))
  .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array(tjoint))).setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(tweight)))
  .setIndices(acc('SCALAR', new Uint16Array(tidx))).setMaterial(mTube);
const j0 = doc.createNode('Bone_0').setTranslation([0, 0, 0]);
const j1 = doc.createNode('Bone_1').setTranslation([0, 1, 0]);
const j2 = doc.createNode('Bone_2').setTranslation([0, 1, 0]);
j0.addChild(j1); j1.addChild(j2);
const ibm = new Float32Array(48); // inverse bind = translate(0,-y,0), column-major
[0, 1, 2].forEach(i => { ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -i, 0, 1], i * 16); });
const skin = doc.createSkin('TentacleRig').addJoint(j0).addJoint(j1).addJoint(j2).setSkeleton(j0).setInverseBindMatrices(acc('MAT4', ibm));
const tentNode = doc.createNode('Tentacle').setMesh(doc.createMesh('Tentacle').addPrimitive(tentPrim)).setSkin(skin);
const tentRoot = doc.createNode('TentacleRoot').setTranslation([1.2, -2.6, 0]).addChild(j0);
// glTF rule (validator NODE_SKINNED_MESH_*): a skinned mesh node must be a scene ROOT with no transform of its own;
// the joints' transforms position it. So the mesh node is NOT a child of TentacleRoot.

scene.addChild(coreNode).addChild(ringNode).addChild(pivot).addChild(tentRoot).addChild(tentNode);

// ---------- Animations ----------
const FPS = 24, DUR = 4; // seconds
function track(anim, node, path, times, values, type, interp = 'LINEAR') {
  const sampler = doc.createAnimationSampler().setInput(acc('SCALAR', new Float32Array(times))).setOutput(acc(type, new Float32Array(values))).setInterpolation(interp);
  anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
}
const idle = doc.createAnimation('Idle');
{
  const n = DUR * FPS + 1, times = [], w = [], r1 = [], r2 = [];
  for (let i = 0; i < n; i++) {
    const t = i / FPS, ph = (t / DUR) * Math.PI * 2;
    times.push(t); w.push(0.5 + 0.5 * Math.sin(ph - Math.PI / 2));
    r1.push(...q(0, 0, 1, 28 * Math.sin(ph))); r2.push(...q(0, 0, 1, 40 * Math.sin(ph - 0.9)));
  }
  track(idle, coreNode, 'weights', times, w, 'SCALAR');
  track(idle, j1, 'rotation', times, r1, 'VEC4');
  track(idle, j2, 'rotation', times, r2, 'VEC4');
}
const orbit = doc.createAnimation('Orbit');
{
  const times = [0, 1, 2, 3, 4], rot = (k) => times.map(t => q(0, 1, 0, (t / 4) * 360 * k)).flat();
  track(orbit, ringNode, 'rotation', times, times.map(t => q(1, 0, 0.3, (t / 4) * 360)).flat(), 'VEC4');
  track(orbit, pivot, 'rotation', times, rot(1), 'VEC4');
}

// ---------- write three flavours ----------
const baseIO = () => new NodeIO().registerExtensions(ALL_EXTENSIONS);
const raw = join(outDir, 'demo-raw.glb');
await baseIO().write(raw, doc);

await doc.transform(prune(), dedup());
const dracoIO = baseIO().registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule() });
await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeGeneric: 0 }));
// quantizeGeneric: 0 matters. With the default 12 the encoder returns 0 bytes for any primitive carrying JOINTS_0 + WEIGHTS_0
// ("Error applying Draco compression. Skipping primitive compression."), so skinned meshes silently stay uncompressed.
await dracoIO.write(join(outDir, 'demo-draco.glb'), doc);

// reload raw for the meshopt flavour (a Document that already carries Draco cannot also carry Meshopt)
const doc2 = await baseIO().read(raw);
await MeshoptEncoder.ready;
await doc2.transform(prune(), dedup(), weld(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await baseIO().registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).write(join(outDir, 'demo-meshopt.glb'), doc2);
console.log('written to', outDir);
