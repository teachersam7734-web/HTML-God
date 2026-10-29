# Canvas 2D: engines without dependencies

Canvas 2D at this level is: one RAF loop, a particle array, projection math, additive blending.
Fifty lines buy a hologram. A few more buy confetti, fire, and starfields.

---

## §1 · Hand-rolled vs library

| Complexity | Hand-rolled | Library |
|---|---|---|
| Wireframe globe, orbits, depth-sorted motes, parallax | ✅ ~50 lines of trig | three.js (about 590 KB minified, r128) says the same with more machinery |
| Confetti burst, rain, sparks | ✅ 20 to 40 lines | overkill |
| Fire, smoke, nebulae | ✅ layered noise + gradients | overkill |
| Real 3D meshes, camera flight, post-processing | ❌ | three.js + passes (`webgl.md`) |

Decision rule: if the visual is "points and lines in fake 3D", hand-roll. If it is "solid geometry
with lighting", don't. The choice is about which gives the better result, never about weight
(weight is reported, not budgeted). Deeper 3D and shader work: `html-sensei:sensei-3d`,
`html-sensei:sensei-shaders-vfx`.

## §2 · The universal engine skeleton

```js
(function engine(){
  const cv = document.getElementById('holo'), cx = cv.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, running = true, mx = 0, my = 0, t = 0, last = 0;
  function resize(){ const d = Math.min(devicePixelRatio||1, 2);
    W = cv.width = cv.clientWidth * d; H = cv.height = cv.clientHeight * d; }
  addEventListener('resize', resize); resize();
  addEventListener('mousemove', e => { mx = e.clientX/innerWidth - .5; my = e.clientY/innerHeight - .5; });
  function frame(now){
    if(!running) return;
    const dt = Math.min((now - (last || now)) / 1000, 0.1); last = now;   // delta clock
    try { t += dt; cx.clearRect(0,0,W,H); draw(t); }             // one frame, guarded
    catch(e){ /* never kill the page over one frame */ }
    requestAnimationFrame(frame);
  }
  function draw(t){ /* particles / projection / glow */ }
  document.addEventListener('visibilitychange', () => {          // pause when hidden
    running = !document.hidden && !reduced; last = 0;
    if(running) requestAnimationFrame(frame);
  });
  if(!reduced) requestAnimationFrame(frame); else draw(0);      // static frame for reduced motion
})();
```

- DPR clamp at 2: retina sharpness without 4× fill cost (a standard cap, not a device downgrade).
- Delta clock: motion is per second, not per frame, so a 120 Hz screen does not run double speed.
- Pause when the tab is hidden; resume on return.
- One clearRect per frame; state (particles) lives in closures, not globals.
- `try/catch` around the draw: one bad frame must not end the animation.

## §3 · Depth-sorted 3D-ish particles (the hologram core)

```js
const pts = Array.from({length: 64}, () => ({           // Fibonacci-sphere placement
  lat: Math.acos(1 - 2*(Math.random()*2-1)/1), lon: Math.random()*Math.PI*2,
  r: 1, orbit: Math.random()*Math.PI*2
}));
function project(p, t){                                  // rotate + perspective
  const a = p.lon + t*.3 + mx*1.2, b = p.lat + my*.6;
  const x = Math.sin(b)*Math.cos(a), y = Math.cos(b), z = Math.sin(b)*Math.sin(a);
  const s = 1/(2.2 - z*.9);                              // perspective divide
  return { x: W/2 + x*s*W*.3, y: H/2 + y*s*W*.3, s, z };
}
```

Per frame: compute all projections → **sort by z** → draw far-to-near. With
`globalCompositeOperation='lighter'` draw order stops mattering and brightness stacks: use both
(sort for occlusion of *lines*, additive for glow of *points*).

Wireframe globe: 18 latitude rings as polylines through the same projection. Orbital rings: 3 ellipses
with satellites; trails = store last N positions, draw fading segments.

## §4 · Confetti (the 20-line celebration)

```js
function confetti(x, y, n = 180){
  const P = Array.from({length:n}, () => ({ x, y,
    vx:(Math.random()-.5)*14, vy:-Math.random()*12-4,
    g:.35, s:4+Math.random()*6, c:`hsl(${Math.random()*360},90%,60%)`,
    rot:Math.random()*Math.PI, vr:(Math.random()-.5)*.3, life:1 }));
  (function tick(){ cx.clearRect(0,0,W,H); let alive = 0;
    for(const p of P){ p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= .008;
      if(p.life > 0 && p.y < H + 20){ alive++;
        cx.save(); cx.translate(p.x,p.y); cx.rotate(p.rot); cx.globalAlpha = p.life;
        cx.fillStyle = p.c; cx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); cx.restore(); } }
    if(alive) requestAnimationFrame(tick); else cx.clearRect(0,0,W,H); })();
}
```

Fire when earned (quiz ≥ 70%), never on every click.

## §5 · Fire, smoke, starfields (layered noise, no libraries)

- **Fire:** N vertical particle columns, `hsl(20 to 45, 100%, 50 to 70%)`, additive blending, radius
  shrinking with height, slight sine drift. Ultra Bookworm runs a fullscreen fire from ~30 lines.
- **Stars:** fixed positions, twinkle = per-star sine phase on alpha; shooting stars = one streak
  with a decaying trail, spawned on a Poisson-ish timer.
- **Dust/golden motes:** slow drift + sine bob, additive, tiny alpha: depth without cost.
- All of these: cap particle counts (reduced-motion → static frame at ~1/3 density).

## §6 · Template-first & seeded randomness (from algorithmic-art)

- When the brief is "generative/artistic", **start from a known-good shell** (like
  `assets/starter-lite.html`), not from scratch: replace the algorithm, keep the frame.
- Seed everything: `let seed = 12345;` + a tiny LCG/xorshift PRNG used instead of `Math.random()`:
  reproducible art, shareable seeds, testable output.
- Think in **parameters, not patterns**: counts, scales, probabilities, ratios, angles, thresholds:
  expose 3 to 6 of them as constants at the top of the engine.

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| Canvas freezes after resize | never re-read client size | §2 resize handler |
| Blurry on retina | DPR ignored | §2 DPR clamp |
| Points draw in wrong order | no z-sort | §3 sort by z |
| Animation stops silently | uncaught frame error | §2 try/catch |
| Phone heats up | full-DPR particles, loop runs while hidden | DPR clamp at 2, pause when hidden, measure on the target phone; if it truly cannot hold the scene, decide with the user (never a silent downgrade) |
| Confetti lingers forever | no life decay | §4 life field + cleanup |
