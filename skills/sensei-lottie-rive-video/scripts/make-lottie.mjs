// make-lottie.mjs: writes an ORIGINAL Lottie JSON (no third-party artwork): a ring that grows and shrinks, a turning
// star, a travelling dot; 60 frames at 30 fps, 200 by 200, markers "intro" (0 to 30) and "outro" (30 to 60).
// The test fixture for test-lottie.mjs, and a worked example of the Lottie JSON shape (layers, shape groups,
// animated properties with eases, markers).
//
//   node make-lottie.mjs out.json          or   import { makeLottie } from './make-lottie.mjs'
//
// verified: Windows 10, Node 24: the file renders in all five lottie-web 5.13.0 builds and in dotlottie-web 0.81.0
//           (test-lottie.mjs).
// not verified: After Effects or Lottie Creator opening the file.
// Ported from code-media/lottie/make-lottie.cjs in the HTML-Sensei build project's research notes (not shipped) (original to this project) to an ES module.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
export function makeLottie() {
  const ease = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
  const kf = (pairs) => pairs.map(([t, s], i) => i < pairs.length - 1 ? { t, s: Array.isArray(s) ? s : [s], ...ease } : { t, s: Array.isArray(s) ? s : [s] });
  const prop = (v) => ({ a: 0, k: v });
  const anim = (pairs) => ({ a: 1, k: kf(pairs) });
  const col = (r, g, b) => prop([r, g, b, 1]);
  const tr = () => ({ ty: 'tr', p: prop([0, 0]), a: prop([0, 0]), s: prop([100, 100]), r: prop(0), o: prop(100), sk: prop(0), sa: prop(0), nm: 'Transform' });
  function layer(ind, nm, shapes, ks) {
    return { ddd: 0, ind, ty: 4, nm, sr: 1, ks: Object.assign({ o: prop(100), r: prop(0), p: prop([100, 100, 0]), a: prop([0, 0, 0]), s: prop([100, 100, 100]) }, ks), ao: 0, shapes, ip: 0, op: 60, st: 0, bm: 0 };
  }
  const ring = layer(1, 'ring', [{ ty: 'gr', nm: 'ring', it: [
    { ty: 'el', p: prop([0, 0]), s: prop([120, 120]), nm: 'Ellipse' },
    { ty: 'st', c: col(0.42, 0.39, 1), o: prop(100), w: prop(10), lc: 2, lj: 2, nm: 'Stroke' }, tr()] }],
    { s: anim([[0, [0, 0, 100]], [20, [100, 100, 100]], [40, [100, 100, 100]], [60, [0, 0, 100]]]) });
  const star = layer(2, 'star', [{ ty: 'gr', nm: 'star', it: [
    { ty: 'sr', sy: 1, d: 1, pt: prop(5), p: prop([0, 0]), r: prop(0), ir: prop(18), is: prop(0), or: prop(42), os: prop(0), nm: 'Star' },
    { ty: 'fl', c: col(1, 0.78, 0.2), o: prop(100), r: 1, nm: 'Fill' }, tr()] }],
    { r: anim([[0, 0], [60, 360]]), s: anim([[0, [60, 60, 100]], [30, [100, 100, 100]], [60, [60, 60, 100]]]) });
  const dot = layer(3, 'dot', [{ ty: 'gr', nm: 'dot', it: [
    { ty: 'el', p: prop([0, 0]), s: prop([16, 16]), nm: 'Ellipse' },
    { ty: 'fl', c: col(0.2, 0.9, 0.6), o: prop(100), r: 1, nm: 'Fill' }, tr()] }],
    { p: anim([[0, [100, 20, 0]], [30, [180, 100, 0]], [60, [100, 20, 0]]]) });
  const j = { v: '5.7.0', fr: 30, ip: 0, op: 60, w: 200, h: 200, nm: 'sensei-test', ddd: 0, assets: [], layers: [dot, star, ring],
    markers: [{ tm: 0, cm: 'intro', dr: 30 }, { tm: 30, cm: 'outro', dr: 30 }] };
  return j;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2] || 'sensei-test.json';
  const s = JSON.stringify(makeLottie());
  fs.writeFileSync(out, s);
  console.log('wrote', out, s.length, 'bytes');
}
