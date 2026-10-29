// test-web.mjs: the self-test of the GLB to single offline HTML half. Run it from a work folder that has the pinned
// packages installed (copy package.json from this folder there, then npm install):
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/web/test-web.mjs [workOut=sensei-blender-test]
//
// Steps, each asserted:
//   1. make_demo_glb.mjs writes raw, Draco and Meshopt GLBs
//   2. gltf-transform validate: no errors and no warnings on all three (it reports KHR_draco_mesh_compression as an extension it cannot
//      validate, so a valid Draco file is not yet a decodable one: steps 3 and 5 decode it)
//   3. glb_audit.mjs passes all three with the right --expect, and FAILS two controls: the raw file audited as if it
//      should be Draco (every primitive, the skinned one included, reported uncompressed) and a copy with zero skin
//      weights (the NaN-bounds case); it also records whether Draco at the default generic quantisation still
//      compresses the skinned primitive (the lane once saw it skipped; see SKILL.md TRAPS)
//   4. build_html.mjs builds the Draco and Meshopt pages
//   5. verify_page.mjs on both: ready, clock advancing, not blank, no network, no errors; and with reduced motion: still
//   6. capture_frames.mjs and contact_sheet.py (Python 3 with Pillow, from PYTHON or python3 / python): loop seam <= 2
// Browser: CHROME or the plugin's discovery (cdp.mjs). Also runs sensei-3d's gate3d.mjs on the Draco page when
// Playwright is found (that gate checks ?t= frames, reduced motion and the context-loss round trip).
// verified: Windows 10, Node 24, Python 3.13 with Pillow 12, Chrome 155 + SwiftShader: every step passes (see SKILL.md).
// not verified: macOS and Linux.
// Original code of this project.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || 'sensei-blender-test');
mkdirSync(OUT, { recursive: true });
const req = createRequire(path.join(process.cwd(), 'noop.js'));
let failed = 0;
const step = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; return ok; };
const node = (script, args, opts = {}) => spawnSync(process.execPath, [path.join(HERE, script), ...args], { encoding: 'utf8', cwd: process.cwd(), ...opts });
const lastJson = s => { const l = s.trim().split('\n').reverse().find(x => x.trim().startsWith('{')); return l ? JSON.parse(l) : null; };
const f = n => path.join(OUT, n);

// 1
let r = node('make_demo_glb.mjs', [OUT]);
step('make_demo_glb', r.status === 0 && ['demo-raw.glb', 'demo-draco.glb', 'demo-meshopt.glb'].every(n => existsSync(f(n))), r.stderr.trim().slice(0, 200));

// 2
// the CLI's package.json is not in its "exports", so find the folder by walking up from the work folder
const pkgDir = name => { for (let d = process.cwd(); ; d = path.dirname(d)) { const p = path.join(d, 'node_modules', name); if (existsSync(path.join(p, 'package.json'))) return p; if (path.dirname(d) === d) throw new Error(name + ' is not installed in the work folder'); } };
const cliDir = pkgDir('@gltf-transform/cli'), cliPkg = JSON.parse(readFileSync(path.join(cliDir, 'package.json'), 'utf8'));
const cliBin = path.join(cliDir, typeof cliPkg.bin === 'string' ? cliPkg.bin : Object.values(cliPkg.bin)[0]);
for (const n of ['demo-raw.glb', 'demo-draco.glb', 'demo-meshopt.glb']) {
  const v = spawnSync(process.execPath, [cliBin, 'validate', f(n)], { encoding: 'utf8' });
  const txt = (v.stdout + v.stderr).replace(/\u001b\[[0-9;]*m/g, '');
  const clean = /ERROR[\s\S]*?No errors found[\s\S]*WARNING[\s\S]*?No warnings found/.test(txt);   // errors AND warnings
  const notes = [...new Set([...txt.matchAll(/\b([A-Z][A-Z_]{6,})\b/g)].map(m => m[1]).filter(c => !['ERROR', 'WARNING'].includes(c)))];
  step(`validate ${n}`, v.status === 0 && clean, clean ? (notes.length ? "no errors or warnings; infos: " + notes.join(", ") : "no errors or warnings") : txt.slice(0, 300));
}

// 3
const audit = (n, exp) => { const a = node('glb_audit.mjs', [f(n), ...(exp ? ['--expect', exp] : []), '--json']); return { code: a.status, j: lastJson(a.stdout), err: a.stderr }; };
let a = audit('demo-raw.glb'); step('audit raw', a.code === 0, a.j && `${a.j.triangles} tris, clips ${a.j.clips.map(c => c.name).join('+')}`);
a = audit('demo-draco.glb', 'draco'); step('audit draco --expect draco', a.code === 0, a.j && `${a.j.kb} KB, ${a.j.primitives.filter(p => p.draco).length}/${a.j.primitives.length} primitives Draco`);
a = audit('demo-meshopt.glb', 'meshopt'); step('audit meshopt --expect meshopt', a.code === 0, a.j && `${a.j.kb} KB`);
{ // controls the audit must fail
  const imp = n => import(pathToFileURL(req.resolve(n)).href);
  const { NodeIO } = await imp('@gltf-transform/core'); const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
  const { draco } = await imp('@gltf-transform/functions'); const draco3d = (await imp('draco3dgltf')).default;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule() });
  a = audit('demo-raw.glb', 'draco');
  step('control: uncompressed primitives are caught (raw file, --expect draco)', a.code === 1 && a.j.findings.filter(x => x.id === 'compression').length === a.j.primitives.length && a.j.findings.some(x => /skinned/.test(x.message)), a.j && `${a.j.findings.length} findings`);
  const d1 = await io.read(f('demo-raw.glb'));
  await d1.transform(draco({ method: 'edgebreaker' }));                  // default generic quantisation
  await io.write(f('draco-default-generic.glb'), d1);
  a = audit('draco-default-generic.glb', 'draco');
  console.log(`INFO  Draco with default generic quantisation: skinned primitive ${a.code === 0 ? 'compressed (lane trap not reproduced with this toolchain)' : 'SKIPPED (lane trap reproduced: use quantizeGeneric 0)'}`);
  const d2 = await io.read(f('demo-raw.glb'));
  for (const m of d2.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const w = p.getAttribute('WEIGHTS_0'); if (w) w.setArray(new Float32Array(w.getArray().length)); }
  await io.write(f('control-zero-weights.glb'), d2);
  a = audit('control-zero-weights.glb');
  step('control: zero skin weights are caught', a.code === 1 && a.j.findings.some(x => x.id === 'weights'), a.j && a.j.findings.map(x => x.id).join(','));
}

// 4
for (const c of ['draco', 'meshopt']) {
  r = node('build_html.mjs', [f(`demo-${c}.glb`), c, f(`demo-${c}.html`), `Blender to browser (${c})`]);
  const j = lastJson(r.stdout); step(`build_html ${c}`, r.status === 0 && !!j, j ? `${j.kb} KB page, bundle ${j.bundle_kb} KB` : r.stderr.slice(0, 300));
}

// 5
for (const c of ['draco', 'meshopt']) {
  r = node('verify_page.mjs', [f(`demo-${c}.html`), '--shot', f(`shot-${c}.png`)]);
  let j = lastJson(r.stdout); step(`verify ${c}`, r.status === 0, j ? `advancing ${j.advancing}, coverage ${j.coverage}, ${JSON.stringify(j.stats)}${j.problems.length ? ' problems ' + j.problems.join(' | ') : ''}${j.offsite.length ? ' offsite ' + j.offsite.join(' ') : ''}` : r.stderr.slice(0, 300));
  r = node('verify_page.mjs', [f(`demo-${c}.html`), '--reduced']);
  j = lastJson(r.stdout); step(`verify ${c} --reduced`, r.status === 0, j ? `advancing ${j.advancing}, sub "${j.sub}"` : r.stderr.slice(0, 300));
}

// 6
r = node('capture_frames.mjs', [f('demo-draco.html'), f('frames'), '8', '4']);
step('capture_frames', r.status === 0, (r.stdout + r.stderr).trim().slice(0, 200));
const pys = [process.env.PYTHON, 'python3', 'python', 'py'].filter(Boolean);
let py = null; for (const p of pys) { const t = spawnSync(p, ['-c', 'import PIL'], { encoding: 'utf8' }); if (t.status === 0) { py = p; break; } }
if (!py) step('contact_sheet', false, 'no Python 3 with Pillow found (set PYTHON)');
else {
  r = spawnSync(py, [path.join(HERE, '..', 'contact_sheet.py'), f('frames'), f('contact-sheet.png'), '--json'], { encoding: 'utf8' });
  const j = lastJson(r.stdout);
  step('contact_sheet loop seam', r.status === 0 && j && j.loop_seam <= 2, j ? `seam ${j.loop_seam}, steps ${j.steps.join(' ')}, static ${j.static.length}, spikes ${j.spikes.length}` : r.stderr.slice(0, 300));
}

// optional: sensei-3d's gate, when the plugin copy and Playwright are present
const gate = path.resolve(HERE, '../../../sensei-3d/scripts/gate3d.mjs');
if (existsSync(gate)) {
  r = spawnSync(process.execPath, [gate, f('demo-draco.html'), '--t=0.7,2.3', `--project=${OUT}`, '--name=sensei-blender-player'], { encoding: 'utf8', cwd: OUT });
  const lines = (r.stdout || '').trim().split('\n');
  if (/Playwright not found/.test(r.stderr || '')) console.log('SKIP  gate3d (Playwright not found; set PW)');
  else step('sensei-3d gate3d on the Draco page', r.status === 0, '\n        ' + lines.filter(l => /^(PASS|FAIL|WARN|SKIP)/.test(l)).join('\n        '));
}

writeFileSync(f('test-web.result.json'), JSON.stringify({ at: new Date().toISOString(), failed }, null, 1));
console.log(failed ? `\n${failed} step(s) failed` : '\nall steps passed');
process.exit(failed ? 1 : 0);
