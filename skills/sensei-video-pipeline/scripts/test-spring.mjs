// test-spring.mjs: numerical checks for spring.js. Run: node test-spring.mjs (exit 0 = pass). verified: Node 24.
import { createRequire } from 'node:module';
const { step, track, zeta } = createRequire(import.meta.url)('./spring.js');
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'pass' : 'FAIL'}  ${m}`); if (!c) fails++; };
const near = (a, b, e) => Math.abs(a - b) <= e;

ok(step(0) === 0 && step(-1) === 0, 'step is 0 at and before t = 0');
ok(near(step(1), 1, 1e-4), `step(1 s) for k 220 c 22 = ${step(1).toFixed(5)}`);
let peak = 0; for (let i = 0; i <= 4000; i++) peak = Math.max(peak, step(i / 1000));
ok(near((peak - 1) * 100, 3.1, 0.15), `zeta ${zeta(220, 22).toFixed(2)} overshoots ${((peak - 1) * 100).toFixed(2)}%`);
const k = 100, cc = 2 * Math.sqrt(k);
ok(near(step(0.3, k, cc), 1 - Math.exp(-3) * (1 + 3), 1e-12), 'critically damped form is exact');
const over = t => step(t, 100, 40); let mono = true; for (let i = 1; i < 2000; i++) if (over(i / 1000) < over((i - 1) / 1000) - 1e-12) mono = false;
ok(mono && over(10) > 0.999 && over(10) <= 1 + 1e-12, 'overdamped form rises monotonically to 1 without overshoot');
// a width that retargets at 0.6 s and 1.1 s: 220 -> 70 -> 520
const w = t => track(t, 220, [[0.6, 220, 70], [1.1, 70, 520]]);
for (const tr of [0.6, 1.1]) ok(Math.abs(w(tr + 1e-6) - w(tr - 1e-6)) < 1e-3, `position continuous across the ${tr} s retarget`);
const v = (t, h = 1e-7) => (w(t + h) - w(t - h)) / (2 * h);
ok(near(v(1.1 - 1e-6), v(1.1 + 1e-6), 0.5), `velocity continuous across the 1.1 s retarget (${v(1.1 - 1e-6).toFixed(2)} vs ${v(1.1 + 1e-6).toFixed(2)} px/s)`);
ok(near(w(6), 520, 1e-3) && w(0.5) === 220, 'track rests exactly on the final target and starts on x0');
console.log(fails ? `${fails} failure(s)` : 'all pass'); process.exit(fails ? 1 : 0);
