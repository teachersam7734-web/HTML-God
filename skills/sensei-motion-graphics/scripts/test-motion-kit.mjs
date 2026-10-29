// test-motion-kit.mjs: self-test for motion-kit.js. Run: node test-motion-kit.mjs  (exit 0 = all pass)
// verified: Node 24 on Windows 10. not verified: other Node versions (uses only ES2020 and node:module).
import { createRequire } from 'node:module';
const K = createRequire(import.meta.url)('./motion-kit.js');

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${msg}`); if (!cond) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

for (const [name, f] of Object.entries(K.EASE)) ok(f(0) === 0 && near(f(1), 1, 1e-12) && f(-1) === 0 && f(2) === 1, `${name}: f(0)=0, f(1)=1, clamped outside`);
const peak = f => { let best = [0, 0]; for (let i = 0; i <= 1000; i++) { const v = f(i / 1000); if (v > best[1]) best = [i / 1000, v]; } return best; };
const [ct, cv] = peak(K.EASE.crashIn); ok(near(cv, 1.18, 0.01) && near(ct, 0.27, 0.04), `crashIn peak ${cv.toFixed(3)} at t ${ct}`);
const [pt, pv] = peak(K.EASE.popOver); ok(near(pv, 1.08, 0.01) && near(pt, 0.72, 0.04), `popOver peak ${pv.toFixed(3)} at t ${pt}`);
const [bt, bv] = peak(K.EASE.bounceHard); ok(near(bv, 1.48, 0.01), `bounceHard peak ${bv.toFixed(3)} at t ${bt}`);
ok(near(K.EASE.snapSettle(0.1), 0.54, 0.01), `snapSettle does ${(K.EASE.snapSettle(0.1) * 100).toFixed(1)}% of the travel in the first 10% of the time`);
ok(K.EASE.softLand(0.5) > 0.84 && K.EASE.softLand(0.5) < 0.86, `softLand(0.5) = ${K.EASE.softLand(0.5).toFixed(3)} (reported shape 85% at half time)`);

const keys = [[0, 0], [10, 100, 'softLand'], [10, 300], [20, 0, 'accelExit']];
ok(K.kf(-5, keys) === 0 && K.kf(10, keys) === 300 && K.kf(25, keys) === 0, 'kf: before first key, hard step at a repeated time, after last key');
ok(K.kf(5, keys) === K.kf(5, keys) && K.kf(5, keys) > 50, `kf: eased segment value at 5 = ${K.kf(5, keys).toFixed(2)}`);

const a = K.rng('seed'), b = K.rng('seed');
ok([1, 2, 3].every(() => a() === b()), 'rng: same seed gives the same sequence');
ok(K.rand('x', 3) === K.rand('x', 3) && K.rand('x', 3) !== K.rand('x', 4), 'rand: stable per key and index');
ok(K.shake(0.99, 1)[0] === 0 && K.shake(1.05, 1)[0] !== 0 && Math.abs(K.shake(3, 1)[0]) < 1e-5, 'shake: zero before the hit, rings down after');
ok(near(K.zoomAt(1, 100, 0.5), 10, 1e-9), 'zoomAt: half way from 1x to 100x in log space is 10x');
ok(near(K.cv([1, 1, 1, 1]), 0, 1e-12) && K.cv([0.5, 2, 1, 3]) > 0.25, 'cv: metronome 0, varied cut lengths above 0.25');
ok(near(K.readTime('Read like a detective.'), 22 / 15 + 1.5, 1e-9), `readTime: 22 characters need ${K.readTime('Read like a detective.').toFixed(2)} s`);
ok(K.smear(0, 20) === 20 && K.smear(2, 20) === 5 && K.smear(-1, 20) === 0, 'smear: peak on the first frame, halving each frame');

console.log(fails ? `${fails} failure(s)` : 'all pass');
process.exit(fails ? 1 : 0);
