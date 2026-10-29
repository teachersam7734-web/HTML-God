// shot.mjs: one headless screenshot of a 3D or shader page, with its console and page errors printed.
//   node shot.mjs "page.html?t=2.4" out.png [extraWaitMs]
//   env: W, H (viewport, default 1000 x 500), RM=1 (prefers-reduced-motion: reduce), CHROME, PW (see browser.mjs)
// Adapted from the 3D lane's shot.js (code-3d in the HTML-Sensei build project's research notes (not shipped)): same flags and wait contract, ESM, no
// hard-coded browser path, reduced motion through the Playwright context instead of a Chrome flag.
//
// verified: Windows 10, Chrome 155 + SwiftShader, on every example page of sensei-3d, sensei-holograms and
//           sensei-shaders-vfx (screenshots inspected).
// not verified: macOS, Linux; any real GPU.
import { launch, pageUrl, waitDone } from './browser.mjs';

const [, , spec, out = 'shot.png', wait = '300'] = process.argv;
if (!spec) { console.error('usage: node shot.mjs "page.html?t=2.4" out.png [extraWaitMs]'); process.exit(2); }
const { browser } = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: +(process.env.W || 1000), height: +(process.env.H || 500) }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.on('console', m => console.log('console:', m.type(), m.text().slice(0, 400)));
  p.on('pageerror', e => console.log('pageerror:', e.message.slice(0, 400)));
  await p.goto(pageUrl(spec));
  if (!(await waitDone(p))) console.log('timeout: window.__done never became true');
  await p.waitForTimeout(+wait || 0);
  await p.screenshot({ path: out });
  console.log('wrote', out);
} finally { await browser.close(); }
