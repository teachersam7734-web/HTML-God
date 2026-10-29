// glb_audit.mjs: the checks gltf-transform validate does not make, for a GLB on its way into a page.
//
//   node glb_audit.mjs <model.glb> [--expect draco|meshopt] [--max-joints 60] [--json]
//
// Fails (exit 1) when:
//   compression  --expect draco: a TRIANGLES primitive has no KHR_draco_mesh_compression (the exporter and
//                glTF-Transform both skip a primitive they cannot encode, log it, and still write a valid file);
//                --expect meshopt: a primitive reads an accessor whose bufferView has no meshopt extension
//   bounds       a POSITION accessor min or max is not finite, or the scene's world bounds are not finite
//   weights      a skinned vertex whose weights sum to zero (the NaN-bounds blank canvas)
// Warns when: more than 4 influences (JOINTS_1), more joints than --max-joints in one skin, no animations named.
// Reports: size, extensions used and required, triangles, per-primitive compression, skins, clips and durations.
// Run it after every export and every compression step, next to `gltf-transform validate`.
// verified: Windows 10, Node 24, glTF-Transform 4.5.1: passes the demo's raw, Draco and Meshopt files; fails a Draco
//           file written with the default generic quantisation (the skinned primitive left uncompressed) and a file
//           with an all-zero skin weight (test-web.mjs makes both).
// not verified: KHR_mesh_quantization files written by other tools than glTF-Transform; sparse accessors; textures.
// Original code of this project (the checks come from the Blender lane's traps).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const file = argv.find((a, i) => !a.startsWith('--') && !['--expect', '--max-joints'].includes(argv[i - 1]));
const opt = k => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const expect = opt('--expect'), maxJoints = +(opt('--max-joints') || 60);
if (!file) { console.error('usage: node glb_audit.mjs <model.glb> [--expect draco|meshopt] [--max-joints 60] [--json]'); process.exit(2); }

const req = createRequire(path.join(process.cwd(), 'noop.js'));
const imp = n => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { getBounds } = await imp('@gltf-transform/functions');
const draco3d = (await imp('draco3dgltf')).default;
const { MeshoptDecoder } = await imp('meshoptimizer');

const bytes = readFileSync(file);
const findings = []; const add = (id, level, message) => findings.push({ id, level, message });

// 1. Raw JSON chunk: what the file says about itself (decoding loses per-primitive extension records).
if (bytes.readUInt32LE(0) !== 0x46546c67) { console.error('not a GLB (magic "glTF" missing)'); process.exit(2); }
const jsonLen = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
const views = gltf.bufferViews || [], accs = gltf.accessors || [];
const isMeshopt = bv => bv && bv.extensions && (bv.extensions.EXT_meshopt_compression || bv.extensions.KHR_meshopt_compression);
const prims = [];
(gltf.meshes || []).forEach((m, mi) => (m.primitives || []).forEach((p, pi) => {
  const mode = p.mode ?? 4;
  const accIdx = [...Object.values(p.attributes || {}), ...(p.indices != null ? [p.indices] : [])];
  const draco = !!(p.extensions && p.extensions.KHR_draco_mesh_compression);
  const meshoptAll = accIdx.every(i => accs[i] && accs[i].bufferView != null && isMeshopt(views[accs[i].bufferView]));
  const skinned = 'JOINTS_0' in (p.attributes || {});
  prims.push({ mesh: m.name || `mesh${mi}`, prim: pi, mode, draco, meshopt: meshoptAll, skinned, morphs: (p.targets || []).length });
  const pos = accs[(p.attributes || {}).POSITION];
  if (pos && [...(pos.min || []), ...(pos.max || [])].some(v => !Number.isFinite(v))) add('bounds', 'fail', `${m.name || mi}/${pi}: POSITION min or max is not finite`);
  if ('JOINTS_1' in (p.attributes || {})) add('influences', 'warn', `${m.name || mi}/${pi}: more than 4 joint influences (JOINTS_1); many viewers draw it wrongly, export with 4`);
}));
if (expect === 'draco') for (const p of prims.filter(p => p.mode === 4 && !p.draco)) add('compression', 'fail', `${p.mesh}/${p.prim}${p.skinned ? ' (skinned)' : ''}${p.morphs ? ' (morph targets)' : ''} has no KHR_draco_mesh_compression: the encoder skipped it. glTF-Transform with skins: quantizeGeneric 0`);
if (expect === 'meshopt') for (const p of prims.filter(p => !p.meshopt)) add('compression', 'fail', `${p.mesh}/${p.prim} reads an accessor that is not meshopt-compressed`);

// 2. Decoded document: bounds, weights, skins, clips.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.decoder': (await MeshoptDecoder.ready, MeshoptDecoder),
});
const doc = await io.readBinary(new Uint8Array(bytes));
const root = doc.getRoot();
let tris = 0;
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const idx = p.getIndices(), pos = p.getAttribute('POSITION');
  if (p.getMode() === 4) tris += (idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3;
  const w = p.getAttribute('WEIGHTS_0');
  if (w) {
    let zero = 0; const el = [];
    for (let i = 0; i < w.getCount(); i++) { w.getElement(i, el); if (el.reduce((a, b) => a + b, 0) <= 1e-6) zero++; }
    if (zero) add('weights', 'fail', `${mesh.getName() || 'mesh'}: ${zero} of ${w.getCount()} skinned vertices have zero total weight (NaN bounds, blank canvas in three.js)`);
  }
}
for (const scene of root.listScenes()) {
  try {
    const b = getBounds(scene);
    if (![...b.min, ...b.max].every(Number.isFinite)) add('bounds', 'fail', `scene "${scene.getName()}": world bounds are not finite`);
  } catch (e) { add('bounds', 'warn', 'could not compute scene bounds: ' + e.message); }
}
const skins = root.listSkins().map(s => ({ name: s.getName(), joints: s.listJoints().length }));
for (const s of skins.filter(s => s.joints > maxJoints)) add('joints', 'warn', `skin "${s.name}" has ${s.joints} joints (budget ${maxJoints} for a web character; export deform bones only)`);
const clips = root.listAnimations().map(a => {
  let dur = 0; for (const s of a.listSamplers()) { const inp = s.getInput(); if (inp) dur = Math.max(dur, inp.getMax([])[0]); }
  return { name: a.getName(), seconds: +dur.toFixed(3), channels: a.listChannels().length };
});
if (clips.some(c => !c.name)) add('clips', 'warn', 'an animation has no name; AnimationMixer users look clips up by name (name the NLA tracks)');

const verdict = findings.some(f => f.level === 'fail') ? 'fail' : findings.some(f => f.level === 'warn') ? 'warn' : 'pass';
const report = { file: path.basename(file), verdict, kb: +(bytes.length / 1024).toFixed(1), extensionsUsed: gltf.extensionsUsed || [], extensionsRequired: gltf.extensionsRequired || [],
  triangles: Math.round(tris), primitives: prims, skins, clips, findings };
if (argv.includes('--json')) console.log(JSON.stringify(report));
else {
  console.log(`${report.file}: ${verdict.toUpperCase()}  ${report.kb} KB, ${report.triangles} triangles, ${prims.length} primitives, clips ${clips.map(c => `${c.name} ${c.seconds}s`).join(', ') || 'none'}`);
  console.log(`  extensions: ${report.extensionsUsed.join(', ') || 'none'}`);
  for (const p of prims) console.log(`  ${p.mesh}/${p.prim}: ${p.draco ? 'draco' : p.meshopt ? 'meshopt' : 'uncompressed'}${p.skinned ? ', skinned' : ''}${p.morphs ? `, ${p.morphs} morph` : ''}`);
  for (const f of findings) console.log(`  ${f.level.toUpperCase()} ${f.id}: ${f.message}`);
}
process.exit(verdict === 'fail' ? 1 : 0);
