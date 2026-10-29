// lint/process.mjs: shell commands guard-process refuses.
//   1. Killing browsers by image name (taskkill /IM chrome.exe, Stop-Process -Name msedge, pkill chromium ...).
//      That closes the user's own browser and every session in it. Close what you launched: browser.close(), or the PID
//      of the child process you started.
//   2. Paid generation (ElevenLabs, fal, OpenAI images/speech/video, Google generative APIs, Replicate, Stability,
//      Runway, Luma, Ideogram) without an approved plan whose hash still matches (see ../approval.mjs).
//   3. An esbuild IIFE bundle of three.js loaders (GLTF, DRACO, KTX2 and the like, or troika) without
//      --define:import.meta.url=..., which throws "Failed to construct URL" when the page loads from one file.
import fs from 'node:fs';
import path from 'node:path';
import { finding } from '../gate.mjs';
import { fileURLToPath } from 'node:url';
import { checkApproval, PLAN_REL } from '../approval.mjs';

const APPROVAL = fileURLToPath(new URL('../approval.mjs', import.meta.url)).replace(/\\/g, '/');

// Browser image names. A name in a kill command is a browser when it is one of these (with or without .exe), or a
// wildcard (chr*, *edge*, m?edge) that matches one of them.
const BROWSER_NAMES = ['chrome', 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'google chrome', 'msedge', 'microsoft-edge', 'microsoft edge', 'chrome-headless-shell', 'headless_shell', 'firefox', 'brave', 'brave-browser', 'opera'];
const BROWSER = /\b(?:chrome|chromium(?:-browser)?|google[- ]chrome(?:-stable)?|msedge|microsoft[- ]edge|chrome-headless-shell|headless_shell|firefox|brave(?:-browser)?|opera)(?:\.exe)?\b/i;
export function isBrowserName(raw) {
  const n = String(raw || '').replace(/^["']|["']$/g, '').replace(/\.exe$/i, '').trim().toLowerCase();
  if (!n) return false;
  if (/[*?]/.test(n)) {
    const re = new RegExp('^' + n.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return BROWSER_NAMES.some(b => re.test(b));
  }
  return BROWSER_NAMES.includes(n);
}

// Shell text with trailing comments removed (a # that starts a word, outside quotes), so "kill 4242 # the chrome
// child" is judged as "kill 4242".
export function stripShellComment(seg) {
  let q = null;
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (q) { if (c === q) q = null; else if (c === '\\' && q === '"') i++; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(seg[i - 1]))) return seg.slice(0, i).trimEnd();
  }
  return seg;
}

const PAID = [
  ['ElevenLabs', /api\.elevenlabs\.io/i],
  ['fal', /\b(?:queue\.|rest\.)?fal\.run\b|\bfal\.ai\/|\bfal_client\b|@fal-ai\/client/i],
  ['OpenAI image, speech or video', /api\.openai\.com\/v1\/(?:images|audio\/speech|videos)/i],
  ['Google generative APIs', /generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com/i],
  ['Replicate', /api\.replicate\.com/i],
  ['Stability', /api\.stability\.ai/i],
  ['Runway', /api\.(?:dev\.)?runwayml\.com/i],
  ['Luma', /api\.lumalabs\.ai/i],
  ['Ideogram', /api\.ideogram\.ai/i],
];

const THREE_LOADER = /three\/(?:addons|examples\/jsm)\/[^'"\s]*(?:GLTF|DRACO|KTX2|RGBE|EXR|HDR|FBX|OBJ|SVG|Font|USDZ|3DM|Rhino3dm)Loader|\b(?:DRACOLoader|KTX2Loader)\b|troika-three-text|\bimport\.meta\.url\b/;

const segments = cmd => String(cmd).split(/\r?\n|;|&&|\|\|/).map(s => stripShellComment(s.trim())).filter(Boolean);
const words = s => [...s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);
const listArg = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);

// The process names a pipeline stage would kill, judged by where the name sits (after /IM, -Name, pkill, killall, in
// a pgrep substitution, as the filter of a Win32_Process terminate), never by any word anywhere in the line, so
// "node kill-chrome-test.mjs" and "--kill-stale-chrome-profiles" are not kills.
function killTargets(seg) {
  const targets = [];
  // pgrep / pidof substitutions feeding kill: kill $(pgrep chrome), kill `pidof msedge`
  for (const m of seg.matchAll(/(?:\$\(|`)\s*(?:pgrep|pidof)\s+((?:-\S+\s+)*)([^\s)`]+)/g)) {
    if (/\bkill\b|Stop-Process|xargs/.test(seg)) targets.push({ name: m[2], loose: /-f/.test(m[1]) });
  }
  const stages = seg.split(/\|(?!\|)/).map(s => s.trim().replace(/^(?:sudo|doas|xargs)\s+(?:-\S+\s+)*/, ''));
  let fromGetProcess = []; let grepped = [];
  stages.forEach((st, idx) => {
    const w = words(st); const cmd = (w[0] || '').toLowerCase();
    if (cmd === 'taskkill' || cmd === 'taskkill.exe') {
      for (let i = 1; i < w.length; i++) if (/^[/-]im$/i.test(w[i])) targets.push({ name: w[i + 1] });
      for (const m of st.matchAll(/\/FI\s+"?IMAGENAME\s+eq\s+([^"\s]+)/gi)) targets.push({ name: m[1] });
    } else if (cmd === 'tskill') targets.push({ name: w[1] });
    else if (cmd === 'pkill' || cmd === 'killall') {
      const loose = w.some(x => /^-\w*f/.test(x));
      const pat = w.slice(1).filter(x => !x.startsWith('-')).pop();
      targets.push({ name: pat, loose: loose || cmd === 'pkill' });
    } else if (/^(?:stop-process|spps|kill)$/.test(cmd)) {
      for (let i = 1; i < w.length; i++) if (/^-(?:name|processname|n)$/i.test(w[i])) for (const n of listArg(w[i + 1])) targets.push({ name: n });
      if (idx > 0) targets.push(...fromGetProcess, ...grepped);
    } else if (/^(?:get-process|gps|ps)$/.test(cmd)) {
      const names = [];
      for (let i = 1; i < w.length; i++) { if (/^-(?:name|processname)$/i.test(w[i])) names.push(...listArg(w[++i])); else if (!w[i].startsWith('-')) names.push(...listArg(w[i])); }
      fromGetProcess = names.map(n => ({ name: n }));
    } else if (/^(?:grep|egrep|findstr|select-string|sls)$/.test(cmd)) {
      // ps aux | grep chrome | awk '{print $2}' | xargs kill
      grepped = w.slice(1).filter(x => !x.startsWith('-')).slice(0, 1).map(n => ({ name: n, loose: true }));
    } else if (/\.Kill\(\s*\)/.test(st) && idx > 0) targets.push(...fromGetProcess);
  });
  // (Get-Process chrome).Kill() and Get-Process chrome | ForEach-Object { $_.Kill() }
  for (const m of seg.matchAll(/\(\s*(?:Get-Process|gps)\s+(?:-Name\s+)?([^)\s]+)[^)]*\)\s*\.Kill\(/gi)) targets.push({ name: m[1] });
  // wmic process where name='chrome.exe' delete / call terminate; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Invoke-CimMethod -MethodName Terminate
  if (/\bwmic\b[^\n]*\bprocess\b[^\n]*\b(?:delete|terminate)\b|Win32_Process[^\n]*(?:Terminate|Remove-CimInstance|Remove-WmiObject)/i.test(seg)) {
    for (const m of seg.matchAll(/name\s*(?:=|like|-eq)\s*\\?["']?([\w.*%? -]+?)\\?["']/gi)) targets.push({ name: m[1].replace(/%/g, '*') });
  }
  return targets.filter(t => t.name);
}

export function scanBrowserKill(cmd) {
  for (const seg of segments(cmd)) {
    // Commands that only carry the words as text (commit messages, searches, echoes) are not kills.
    if (/^(?:git|echo|printf|Write-(?:Host|Output)|grep|rg|Select-String|findstr|cat|type)\b/i.test(seg)) continue;
    const hit = killTargets(seg).find(t => isBrowserName(t.name) || (t.loose && BROWSER.test(t.name)));
    if (hit) return [finding('process:kill-browser-by-name', 'block',
      `Refused: "${seg.slice(0, 90)}" kills browsers by image name ("${hit.name}"), which closes the user's own browser windows too.`,
      { fix: 'Close only what you started: await browser.close() in Playwright, or keep the child process handle and kill that PID (taskkill /PID <pid> /T, kill <pid>). Never kill chrome.exe or msedge.exe by name, and never with a wildcard such as chr*.' })];
  }
  return [];
}

export function scanPaid(cmd, projectDir) {
  const hit = PAID.find(([, re]) => re.test(cmd));
  if (!hit) return [];
  const r = checkApproval(projectDir);
  if (r.ok) return [];
  return [finding('process:paid-without-approval', 'block',
    `Refused: this command calls ${hit[0]}, a paid service, and ${r.reason}.`,
    { fix: `Write the plan to ${PLAN_REL.replace(/\\/g, '/')} (what is generated, service and model, number of calls and retries, estimated cost), show it to the user and wait for an explicit yes. Then record it with: node "${APPROVAL}" approve --words "<the user's words>" "${projectDir}". Recording cannot stand in for consent; never record an approval the user did not give.` })];
}

export function scanBundle(cmd, cwd) {
  const all = String(cmd);
  if (/--define:import\.meta\.url=/.test(all)) return [];
  for (const seg of segments(all)) {
    if (!/\besbuild\b/.test(seg) || !/--bundle\b/.test(seg)) continue;
    if (/--format[= ]esm\b/.test(seg)) continue;
    const entries = [...seg.matchAll(/(?:^|\s)(?!-)([^\s"'=]+\.(?:m?js|jsx|tsx?))(?=\s|$)/g)].map(m => m[1]);
    const read = entries.map(e => { try { return fs.readFileSync(path.resolve(cwd, e), 'utf8'); } catch { return ''; } }).join('\n');
    if (THREE_LOADER.test(read) || THREE_LOADER.test(seg)) return [finding('process:bundle-without-import-meta-define', 'block',
      'Refused: this esbuild bundle includes a three.js loader (or code using import.meta.url) as a classic script without --define:import.meta.url, so the single-file page throws "Failed to construct URL" at load.',
      { fix: 'Add --define:import.meta.url=\\"https://invalid.local/x/\\" (quoted for your shell), or bundle with --format=esm into a <script type="module">. Decoders then come from blob URLs, never a CDN.', evidence: entries.slice(0, 3) })];
  }
  return [];
}

export function scanProcess(cmd, { projectDir, cwd } = {}) {
  return [...scanBrowserKill(cmd), ...scanPaid(cmd, projectDir), ...scanBundle(cmd, cwd || projectDir)];
}
