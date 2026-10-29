// verify_page.mjs: the headless check for a GLB player page (or any page with the same QA hooks).
//
//   node verify_page.mjs <page.html> [--shot shot.png] [--reduced] [--json]
//
// Checks: ready flag (document.body.dataset.ready) and window.__done; the AnimationMixer clock advances over 1.5 s
// (with --reduced: prefers-reduced-motion is emulated and the clock must NOT advance); the frame is not blank (share
// of pixels in the upper 60 per cent of the page that differ from the corner pixel, away from the control panel);
// no request outside file:, data: and blob: (http and https are blocked and listed); no page errors or console
// errors. Prints one JSON line; exit 0 only when every check passes.
// A ready flag and a triangle count do not prove a visible frame: a zero-weight skin gave NaN bounds, a camera at NaN
// and an empty canvas while both looked normal (Blender lane). The pixel check is the proof.
// verified: Windows 10, Node 24, Chrome 155 headless + SwiftShader, on the Draco and Meshopt demo pages (test-web.mjs).
// not verified: macOS and Linux; a real GPU; pages larger than about 5 MB.
// Adapted from blender-demo/web/verify_cdp.mjs in the HTML-Sensei build project's research notes (not shipped) (run there); network blocking, the reduced-motion
// mode and __done are new here. Original code of this project.
import { writeFileSync } from 'node:fs';
import { open, fileUrl, screenshot } from './cdp.mjs';

const argv = process.argv.slice(2);
const target = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--shot');
const shotPath = argv.includes('--shot') ? argv[argv.indexOf('--shot') + 1] : null;
const reduced = argv.includes('--reduced');
if (!target) { console.error('usage: node verify_page.mjs <page.html> [--shot shot.png] [--reduced]'); process.exit(2); }

const cdp = await open({ width: 1000, height: 700 });
const problems = [], offsite = [];
cdp.on((method, p) => {
  if (method === 'Runtime.exceptionThrown') problems.push('exception ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).slice(0, 200));
  else if (method === 'Runtime.consoleAPICalled' && p.type === 'error') problems.push('console.error ' + p.args.map(a => a.value ?? a.description).join(' ').slice(0, 200));
  else if (method === 'Network.requestWillBeSent' && !/^(file|data|blob):/.test(p.request.url)) offsite.push(p.request.url.slice(0, 120));
});
let res;
try {
  await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*'] });
  if (reduced) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cdp.send('Page.navigate', { url: fileUrl(target) });
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) { await cdp.sleep(300); ready = await cdp.evaluate('!!(document.body && document.body.dataset.ready === "1" && window.__done === true)'); }
  const sub = await cdp.evaluate('(document.getElementById("sub")||{}).textContent || ""');
  const msg = await cdp.evaluate('(document.getElementById("msg")||{}).textContent || ""');
  const t1 = await cdp.evaluate('window.__demo ? window.__demo.getTime() : null');
  await cdp.sleep(1500);
  const t2 = await cdp.evaluate('window.__demo ? window.__demo.getTime() : null');
  const stats = await cdp.evaluate('window.__demo ? window.__demo.stats() : null');
  const png = await screenshot(cdp);
  if (shotPath) writeFileSync(shotPath, png);
  const coverage = await cdp.evaluate(`new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = Math.floor(i.height * 0.6);
    const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k]-d[0]) + Math.abs(d[k+1]-d[1]) + Math.abs(d[k+2]-d[2]) > 36) n++;
    res(n / (d.length / 4)); }; i.src = 'data:image/png;base64,${png.toString('base64')}'; })`);
  const advancing = t1 !== null && t2 !== null && t2 !== t1;
  const motionOk = reduced ? !advancing : advancing;
  const real = problems.filter(l => !/X4122|GPU stall/.test(l));       // SwiftShader driver chatter, not page faults
  const ok = ready && !msg && motionOk && coverage >= 0.01 && !offsite.length && !real.length;
  res = { page: target, reduced, ok, ready, sub, msg, t1, t2, advancing, coverage: Math.round(coverage * 1000) / 1000, blank: coverage < 0.01, stats, offsite: [...new Set(offsite)].slice(0, 5), problems: real.slice(0, 5) };
} finally { await cdp.close(); }
console.log(JSON.stringify(res));
process.exit(res && res.ok ? 0 : 1);
