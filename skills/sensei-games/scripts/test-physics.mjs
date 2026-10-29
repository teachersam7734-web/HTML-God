// test-physics.mjs: matter-js and planck.js in Node: determinism with a fixed step, stacks at rest, tunnelling through
// a thin wall, and cost (information only). HTML-Sensei's own code, ported from the research lane's test-physics.cjs.
//
//   node test-physics.mjs --libs DIR      (a folder with node_modules/matter-js and planck; or env GAME_LIBS)
//                                         npm i --ignore-scripts matter-js planck
//
// verified: Windows 10, Node 24; matter-js 0.20.0, planck 1.5.1.
// not verified: in a browser (the libraries are the same code); other versions; cost on a target device.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checker } from './pw.mjs';

const { ok, summary } = checker();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIBS = arg('--libs', process.env.GAME_LIBS);
if (!LIBS) { console.error('Give --libs DIR (or GAME_LIBS): a folder with node_modules/matter-js and planck.'); process.exit(2); }
const req = createRequire(path.join(path.resolve(LIBS), 'noop.js'));
const Matter = req('matter-js'), planck = req('planck');
const ver = (n) => JSON.parse(fs.readFileSync(path.join(path.resolve(LIBS), 'node_modules', n, 'package.json'), 'utf8')).version;
console.log('INFO versions matter-js', ver('matter-js'), ' planck', ver('planck'));

function matterRun(deltas, nBoxes = 5) {
  const e = Matter.Engine.create({ enableSleeping: false });
  const ground = Matter.Bodies.rectangle(400, 600, 800, 40, { isStatic: true });
  const boxes = []; for (let i = 0; i < nBoxes; i++) boxes.push(Matter.Bodies.rectangle(400, 560 - i * 42, 40, 40));
  Matter.Composite.add(e.world, [ground, ...boxes]);
  deltas.forEach((d) => Matter.Engine.update(e, d));
  return boxes.map((b) => [b.position.x, b.position.y, b.angle]);
}
const fixed = Array(600).fill(1000 / 60);
const a = matterRun(fixed), b = matterRun(fixed);
ok('matter: same fixed step, same result (bit-identical positions over 600 steps)', JSON.stringify(a) === JSON.stringify(b));
const jitter = []; let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 600; i++) jitter.push(10 + rnd() * 14);
ok('matter: a variable delta passed to Engine.update gives a DIFFERENT result (step it with a constant delta)', JSON.stringify(a) !== JSON.stringify(matterRun(jitter)));
ok('matter: a 5-box stack stays a stack after 10 s', a.every((p) => Math.abs(p[0] - 400) < 3 && p[1] > 400 && p[1] < 600 && Math.abs(p[2]) < 0.05), a.map((p) => p[1].toFixed(1)).join(', '));

function planckRun(steps, dt = 1 / 60) {
  const w = new planck.World({ gravity: { x: 0, y: -10 } });
  w.createBody({ position: { x: 0, y: 0 } }).createFixture(new planck.Box(20, 0.5));
  const boxes = []; for (let i = 0; i < 5; i++) { const bd = w.createDynamicBody({ x: 0, y: 1 + i * 1.05 }); bd.createFixture(new planck.Box(0.5, 0.5), { density: 1, friction: 0.5 }); boxes.push(bd); }
  for (let i = 0; i < steps; i++) w.step(dt, 8, 3);
  return boxes.map((q) => [q.getPosition().x, q.getPosition().y, q.getAngle()]);
}
const p1 = planckRun(600), p2 = planckRun(600);
ok('planck: deterministic fixed step', JSON.stringify(p1) === JSON.stringify(p2));
ok('planck: 5-box stack rests (centres near 1, 2, 3, 4, 5 within 0.2)', p1.every((p, i) => Math.abs(p[1] - (1 + i)) < 0.2 && Math.abs(p[0]) < 0.1), p1.map((p) => p[1].toFixed(2)).join(', '));

function matterTunnel() {
  const e = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  const wall = Matter.Bodies.rectangle(300, 100, 4, 200, { isStatic: true }), ball = Matter.Bodies.circle(0, 100, 5, { restitution: 0.9, frictionAir: 0 });
  Matter.Composite.add(e.world, [wall, ball]); Matter.Body.setVelocity(ball, { x: 120, y: 0 });     // 120 px per step
  for (let i = 0; i < 10; i++) Matter.Engine.update(e, 1000 / 60);
  return ball.position.x;
}
function matterSubstep(n) {   // the same ball, the same 1/60 s frames, each split into n engine updates
  const e = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  const wall = Matter.Bodies.rectangle(300, 100, 4, 200, { isStatic: true }), ball = Matter.Bodies.circle(0, 100, 5, { restitution: 0.9, frictionAir: 0 });
  Matter.Composite.add(e.world, [wall, ball]); Matter.Body.setVelocity(ball, { x: 120 / n, y: 0 });   // matter's velocity is per update
  for (let i = 0; i < 10 * n; i++) Matter.Engine.update(e, 1000 / 60 / n);
  return ball.position.x;
}
function planckTunnel() {
  const w = new planck.World({ gravity: { x: 0, y: 0 } });
  w.createBody({ position: { x: 30, y: 0 } }).createFixture(new planck.Box(0.02, 10));
  const ball = w.createDynamicBody({ x: 0, y: 0 }); ball.createFixture(new planck.Circle(0.2), { density: 1, restitution: 0.9 }); ball.setLinearVelocity({ x: 600, y: 0 });   // 10 m per step
  for (let i = 0; i < 10; i++) w.step(1 / 60, 8, 3);
  return ball.getPosition().x;
}
const mt = matterTunnel(), pt = planckTunnel(), ms = matterSubstep(40);
ok('matter tunnels through a thin wall at 120 px per step: the ball ends BEYOND the wall (x > 300)', mt > 300, `x = ${mt.toFixed(1)}`);
ok('planck stops a fast ball at a thin static wall (continuous collision): the ball stays before it (x < 30)', pt < 30, `x = ${pt.toFixed(2)}`);
ok('matter with 40 sub-steps per frame (3 px per update) stops at the wall', ms < 300, `x = ${ms.toFixed(1)}`);

const e = Matter.Engine.create(); Matter.Composite.add(e.world, [Matter.Bodies.rectangle(400, 1000, 2000, 40, { isStatic: true })]);
for (let i = 0; i < 500; i++) Matter.Composite.add(e.world, Matter.Bodies.circle(50 + (i % 40) * 18, 50 + Math.floor(i / 40) * 18, 7));
let t0 = process.hrtime.bigint(); for (let i = 0; i < 120; i++) Matter.Engine.update(e, 1000 / 60); const mm = Number(process.hrtime.bigint() - t0) / 1e6 / 120;
const w = new planck.World({ gravity: { x: 0, y: -10 } }); w.createBody().createFixture(new planck.Edge({ x: -50, y: 0 }, { x: 50, y: 0 }));
for (let i = 0; i < 500; i++) { const bd = w.createDynamicBody({ x: -35 + (i % 40) * 1.8, y: 1 + Math.floor(i / 40) * 1.8 }); bd.createFixture(new planck.Circle(0.7), { density: 1 }); }
t0 = process.hrtime.bigint(); for (let i = 0; i < 120; i++) w.step(1 / 60, 8, 3); const pm = Number(process.hrtime.bigint() - t0) / 1e6 / 120;
console.log(`INFO 500 dense circles, ms per step in Node on this machine: matter ${mm.toFixed(2)}, planck ${pm.toFixed(2)} (information only; a target device differs)`);
process.exitCode = summary();
