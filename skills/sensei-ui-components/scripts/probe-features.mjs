// probe-features.mjs: open examples/probe.html in the discovered Chromium-family browser and print which native
// component features it has. For Firefox and Safari, open probe.html in them by hand: it prints the same table.
// HTML-Sensei's own code.
//
//   node probe-features.mjs [--json]
//
// verified: Windows 10, Node 24, playwright-core 1.64, Chrome 156: every row yes.
// not verified: other browsers through this script (Playwright's Firefox and WebKit builds were not installed here).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, fileUrl } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { browser, chrome } = await launch();
try {
  const p = await browser.newPage();
  await p.goto(fileUrl(path.join(HERE, '..', 'examples', 'probe.html')));
  await p.waitForFunction('window.__done === true');
  const r = await p.evaluate('window.__probe'); const ua = await p.evaluate('navigator.userAgent');
  if (process.argv.includes('--json')) console.log(JSON.stringify({ browser: chrome, ua, features: r }, null, 2));
  else { console.log(ua); for (const [k, v] of Object.entries(r)) console.log(`${v ? 'yes' : 'NO '}  ${k}`); }
  process.exitCode = Object.values(r).every(Boolean) ? 0 : 1;
} finally { await browser.close(); }
