// run.mjs: proves each HTML-Sensei hook blocks or warns on a bad case and passes a good one, by spawning the real hook
// program with the hook stdin JSON Claude Code sends (hooks reference, code.claude.com/docs/en/hooks).
//   node plugin/hooks/test/run.mjs            (exit 1 if any case fails)
// Everything happens in a scratch folder under the OS temp directory. Secret-shaped and licence-marked strings are
// assembled from pieces at run time, so this file and the fixtures carry none of them whole. No command under test is
// ever executed: the guards only read the command text.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanLicence } from '../../lib/lint/licence.mjs';
import { scanText } from '../../lib/lint/secrets.mjs';
import { writeGateReport } from '../../lib/gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');                 // the plugin folder
const FX = path.join(HERE, 'fixtures');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'html-sensei-test-'));
const DATA = path.join(TMP, 'plugin-data');
const results = [];

function mkProject(name, profile) {
  const d = path.join(TMP, name); fs.mkdirSync(d, { recursive: true });
  if (profile) { fs.mkdirSync(path.join(d, '.sensei'), { recursive: true }); fs.writeFileSync(path.join(d, '.sensei', 'profile.json'), JSON.stringify(profile, null, 2)); }
  return d;
}

function hook(name, input, { project, raw } = {}) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'hooks', `${name}.mjs`)], {
    input: raw ?? JSON.stringify({ session_id: 'test-session', transcript_path: path.join(TMP, 'none.jsonl'), cwd: project, permission_mode: 'default', ...input }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: project, CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PLUGIN_DATA: DATA },
    encoding: 'utf8', timeout: 60000,
  });
  let json = null; try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* plain text */ }
  const context = json && json.hookSpecificOutput ? json.hookSpecificOutput.additionalContext || '' : '';
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json, context };
}

// expect: 'block' (exit 2, stderr has every `has`), 'warn' (exit 0, context or systemMessage has every `has`),
//         'pass' (exit 0, no output at all), 'ok' (exit 0, anything on stdout)
function check(label, r, expect, has = []) {
  const text = expect === 'block' ? r.stderr : `${r.context}\n${r.json && r.json.systemMessage || ''}`;
  let ok;
  if (expect === 'block') ok = r.code === 2;
  else if (expect === 'pass') ok = r.code === 0 && !r.stdout.trim();
  else if (expect === 'warn') ok = r.code === 0 && !!text.trim();
  else ok = r.code === 0;
  const missing = has.filter(h => !text.includes(h));
  ok = ok && !missing.length;
  results.push({ label, ok, detail: ok ? '' : `exit ${r.code}; expected ${expect}${missing.length ? `; missing ${missing.join(', ')}` : ''}; stdout ${r.stdout.slice(0, 300)}; stderr ${r.stderr.slice(0, 300)}` });
}

const write = (file, content) => ({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: file, content }, tool_response: { filePath: file, type: 'create' } });
const preWrite = (file, content) => ({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: file, content } });
const preEdit = (file, oldS, newS) => ({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: file, old_string: oldS, new_string: newS, replace_all: false } });
const bash = command => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, description: 'test' } });
const pwsh = command => ({ hook_event_name: 'PreToolUse', tool_name: 'PowerShell', tool_input: { command, description: 'test' } });
const placeFixture = (proj, name) => { const f = path.join(proj, name); fs.copyFileSync(path.join(FX, name), f); return f; };

// ---------- probe (SessionStart) ----------
{
  const p = mkProject('probe', { deliverable: 'single-file' });
  const r = hook('probe', { hook_event_name: 'SessionStart', source: 'startup' }, { project: p });
  check('probe: reports tools and profile, never blocks', r, 'warn', ['HTML-Sensei probe', 'Node:', 'Profile: .sensei']);
  results.push({ label: 'probe: wrote .sensei/env.json', ok: fs.existsSync(path.join(p, '.sensei', 'env.json')), detail: 'env.json missing' });
  const q = mkProject('probe-noprofile');
  check('probe: no profile, says defaults are in use', hook('probe', { hook_event_name: 'SessionStart', source: 'startup' }, { project: q }), 'warn', ['Profile: none']);
  results.push({ label: 'probe: no .sensei folder created in a project without one', ok: !fs.existsSync(path.join(q, '.sensei')), detail: '.sensei was created' });
}

// ---------- lint-web: media, audio and cross-document transition rules ----------
{
  const p = mkProject('web-media', { offline: true });
  check('lint-web: media page warns (cross-doc VT, dotLottie and Rive CDN, relative track, HEVC only, looping video, audio unlock, mute, setTimeout sound, WAAPI keyframes in a variable)',
    hook('lint-web', write(placeFixture(p, 'media-bad.html'), ''), { project: p }), 'warn',
    ['cross-document-vt-without-reduced-motion', 'dotlottie-wasm-from-cdn', 'rive-wasm-from-cdn', 'rive-asset-cdn', 'relative-track-offline', 'hevc-only-video', 'looping-video-without-pause', 'audio-without-unlock', 'audio-without-mute', 'audio-timed-by-settimeout', 'reduced-motion:web-animations']);
  check('lint-web: the corrected media page passes', hook('lint-web', write(placeFixture(p, 'media-good.html'), ''), { project: p }), 'pass');
}

// ---------- lint-web ----------
{
  const p = mkProject('web', { offline: true });
  const bad = placeFixture(p, 'web-bad.html');
  check('lint-web: bad page warns (reduced motion, transition all, smooth scroll, guards, cursor, drag, toast, CDN, markers)',
    hook('lint-web', write(bad, ''), { project: p }), 'warn', ['reduced-motion:css-keyframes', 'reduced-motion:gsap', 'transition-all', 'smooth-scroll-on-html', 'scroll-driven-unguarded', 'view-transition-unguarded', 'cursor-none-without-hover-query', 'drag-without-keys', 'toast-without-live-region', 'no-cdn']);
  const r = hook('lint-web', write(bad, ''), { project: p });
  results.push({ label: 'lint-web: warning hook never blocks (exit 0)', ok: r.code === 0, detail: `exit ${r.code}` });
  check('lint-web: good page passes', hook('lint-web', write(placeFixture(p, 'web-good.html'), ''), { project: p }), 'pass');
  const on = mkProject('web-online', { offline: false });
  const onBad = placeFixture(on, 'web-bad.html');
  const r2 = hook('lint-web', write(onBad, ''), { project: on });
  results.push({ label: 'lint-web: no-CDN rule off when the profile says offline false', ok: r2.code === 0 && !r2.context.includes('no-cdn') && r2.context.includes('transition-all'), detail: r2.context.slice(0, 200) });
  const md = path.join(p, 'notes.md'); fs.writeFileSync(md, 'transition: all 1s');
  check('lint-web: ignores non-web files', hook('lint-web', write(md, ''), { project: p }), 'pass');
  check('lint-web: unreadable stdin does not block', hook('lint-web', {}, { project: p, raw: '{not json' }), 'pass');
}

// ---------- lint-3d ----------
{
  const p = mkProject('three', {});
  check('lint-3d: bad WebGL page warns (transpose, context loss, dpr, pause, Draco CDN, import.meta ...)', hook('lint-3d', write(placeFixture(p, 'three-bad.html'), ''), { project: p }), 'warn',
    ['3d:transpose-matrix-multiply', '3d:context-loss', '3d:dpr-cap', '3d:pause-hidden', '3d:draco-cdn', '3d:import-meta-in-classic-script', '3d:reduced-motion', '3d:empty-media-src', '3d:reversed-smoothstep', '3d:same-random-two-axes', '3d:clock-deprecated']);
  check('lint-3d: good WebGL page passes', hook('lint-3d', write(placeFixture(p, 'three-good.html'), ''), { project: p }), 'pass');
  check('lint-3d: page without WebGL is skipped', hook('lint-3d', write(placeFixture(p, 'web-good.html'), ''), { project: p }), 'pass');
}

// ---------- lint-determinism ----------
{
  const p = mkProject('seek', { deliverable: 'film' });
  check('lint-determinism: bad seek page warns (Date.now, random, timers, CSS animation)', hook('lint-determinism', write(placeFixture(p, 'seek-bad.html'), ''), { project: p }), 'warn',
    ['seek:date-now', 'seek:unseeded-random', 'seek:timers', 'seek:css-animation']);
  check('lint-determinism: good seek page passes', hook('lint-determinism', write(placeFixture(p, 'seek-good.html'), ''), { project: p }), 'pass');
  check('lint-determinism: non-seek page is skipped', hook('lint-determinism', write(placeFixture(p, 'web-bad.html'), ''), { project: p }), 'pass');
}

// ---------- keep-eol ----------
{
  const p = mkProject('eol', {});
  const f = path.join(p, 'crlf.html'); fs.writeFileSync(f, '<p>a</p>\r\n<p>b</p>\r\n');
  hook('keep-eol', preWrite(f, '<p>a</p>\n<p>c</p>\n'), { project: p });
  fs.writeFileSync(f, '<p>a</p>\n<p>c</p>\n');
  check('keep-eol: CRLF file rewritten as LF is reported with the fix', hook('keep-eol', write(f, ''), { project: p }), 'warn', ['CRLF to LF', '--to crlf']);
  const g = path.join(p, 'kept.html'); fs.writeFileSync(g, 'a\r\nb\r\n');
  hook('keep-eol', preWrite(g, ''), { project: p }); fs.writeFileSync(g, 'a\r\nc\r\n');
  check('keep-eol: CRLF kept as CRLF passes', hook('keep-eol', write(g, ''), { project: p }), 'pass');
  const n = path.join(p, 'new.html'); hook('keep-eol', preWrite(n, 'x\n'), { project: p }); fs.writeFileSync(n, 'x\n');
  check('keep-eol: new file passes', hook('keep-eol', write(n, ''), { project: p }), 'pass');
}

// ---------- guard-licence ----------
{
  const plug = mkProject('some-plugin');
  fs.mkdirSync(path.join(plug, '.claude-plugin'), { recursive: true }); fs.writeFileSync(path.join(plug, '.claude-plugin', 'plugin.json'), '{"name":"x"}');
  const proj = mkProject('licence-project', { licence_mode: 'commercial' });
  const personal = mkProject('licence-personal', { licence_mode: 'personal' });
  const RB = 'react' + 'bits' + '.dev';
  const holder = 'Da' + 'vid ' + 'Ha' + 'z';
  const rbCode = `// Source: https://${RB}/backgrounds/aurora\nexport default function Aurora() { const ref = useRef(null); return null; }\n`;
  const rbNotice = `/* Copyright (c) 2026 ${holder}. MIT plus Commons Clause. https://${RB} */\n`;
  check('guard-licence: react-bits code into a plugin path is blocked', hook('guard-licence', preWrite(path.join(plug, 'skills', 'x', 'Aurora.jsx'), rbNotice + rbCode), { project: proj }), 'block', ['never-ship:react-bits']);
  check('guard-licence: react-bits code into a user project with its notice passes', hook('guard-licence', preWrite(path.join(proj, 'src', 'Aurora.jsx'), rbNotice + rbCode), { project: proj }), 'pass');
  check('guard-licence: react-bits code in a project without the notice warns', hook('guard-licence', preWrite(path.join(proj, 'src', 'Aurora.jsx'), rbCode), { project: proj }), 'warn', ['notice-missing:react-bits']);
  check('guard-licence: an Edit adding react-bits code into a plugin path is blocked', hook('guard-licence', preEdit(path.join(plug, 'lib', 'fx.js'), 'x', rbCode), { project: proj }), 'block', ['never-ship:react-bits']);
  const prose = `# Catalogue\n\nReact Bits (${RB}) components are fetched into the user's project, never shipped here.\n\n\`\`\`\n/* Copyright (c) ${holder}. MIT plus Commons Clause. Fetched from https://${RB} */\n\`\`\`\n`;
  check('guard-licence: catalogue prose and the notice template in a plugin pass', hook('guard-licence', preWrite(path.join(plug, 'skills', 'ui', 'SKILL.md'), prose), { project: proj }), 'pass');
  const om = 'window.' + 'OM = {};\nOM.' + 'morphRect(a, b, t);\n';
  check('guard-licence: onetake code is blocked even in a user project', hook('guard-licence', preWrite(path.join(proj, 'film.js'), om), { project: proj }), 'block', ['ideas-only:onetake']);
  const st = '// from https://www.' + 'shader' + 'toy.com/view/abcd\nvoid mainImage(out vec4 c, in vec2 p) { c = vec4(1.0); }\n';
  check('guard-licence: copied Shadertoy shader is blocked', hook('guard-licence', preWrite(path.join(proj, 'bg.glsl'), st), { project: proj }), 'block', ['ideas-only:shadertoy']);
  const ly = '#include "' + 'lygia/generative/fbm.glsl"\nvoid main() { gl_FragColor = vec4(fbm(p)); }\n';
  check('guard-licence: lygia include is blocked', hook('guard-licence', preWrite(path.join(proj, 'n.frag'), ly), { project: proj }), 'block', ['ideas-only:lygia']);
  const nc = '/* Licence: ' + 'CC BY-' + 'NC 4.0 */\nexport const wave = t => Math.sin(t);\n';
  check('guard-licence: non-commercial code in a commercial project is blocked', hook('guard-licence', preWrite(path.join(proj, 'wave.js'), nc), { project: proj }), 'block', ['noncommercial:cc-by-nc']);
  check('guard-licence: non-commercial code in a personal project warns', hook('guard-licence', preWrite(path.join(personal, 'wave.js'), nc), { project: personal }), 'warn', ['noncommercial:cc-by-nc']);
  check('guard-licence: original code passes', hook('guard-licence', preWrite(path.join(plug, 'lib', 'ok.mjs'), 'export const add = (a, b) => a + b;\n'), { project: proj }), 'pass');
}

// ---------- guard-secrets ----------
{
  const p = mkProject('secrets', {});
  const ant = 'sk-' + 'ant-' + 'api03-' + 'Q7'.repeat(24);
  const ghp = 'gh' + 'p_' + 'a1B2c3D4'.repeat(5);
  check('guard-secrets: Anthropic key in a file is blocked', hook('guard-secrets', preWrite(path.join(p, 'config.js'), `const key = "${ant}";\n`), { project: p }), 'block', ['secret:anthropic-key']);
  check('guard-secrets: GitHub token in an Edit is blocked', hook('guard-secrets', preEdit(path.join(p, 'ci.yml'), 'x', `token: ${ghp}`), { project: p }), 'block', ['secret:github-token']);
  const lit = 'api' + 'Key: "' + 'f3a9c2e7b1d04c5a8e6f2b9d7c1a3e5f' + '"';
  check('guard-secrets: a literal assigned to apiKey is blocked', hook('guard-secrets', preWrite(path.join(p, 'svc.js'), `const cfg = { ${lit} };\n`), { project: p }), 'block', ['secret:assigned-literal']);
  check('guard-secrets: key read from the environment passes', hook('guard-secrets', preWrite(path.join(p, 'svc.js'), 'const cfg = { apiKey: process.env.ELEVENLABS_API_KEY };\n'), { project: p }), 'pass');
  check('guard-secrets: echo of a key variable is blocked', hook('guard-secrets', bash('echo $ELEVENLABS_API_KEY'), { project: p }), 'block', ['secret:echo-secret-var']);
  check('guard-secrets: printing all environment variables is blocked', hook('guard-secrets', bash('printenv'), { project: p }), 'block', ['secret:dump-env']);
  check('guard-secrets: PowerShell $env: key printed is blocked', hook('guard-secrets', pwsh('Write-Output $env:FAL_KEY'), { project: p }), 'block', ['secret:echo-secret-var']);
  check('guard-secrets: cat .env is blocked', hook('guard-secrets', bash('cat .env'), { project: p }), 'block', ['secret:read-secret-file']);
  check('guard-secrets: key in a curl command line is blocked', hook('guard-secrets', bash(`curl -H "x-api-key: ${ant}" https://api.anthropic.com/v1/messages`), { project: p }), 'block', ['secret:anthropic-key']);
  check('guard-secrets: checking a key is set without printing passes', hook('guard-secrets', bash('[ -n "$FAL_KEY" ] && echo set'), { project: p }), 'pass');
  check('guard-secrets: reading .env.example passes', hook('guard-secrets', bash('cat .env.example'), { project: p }), 'pass');
}

// ---------- guard-process ----------
{
  const p = mkProject('process', {});
  check('guard-process: taskkill /IM chrome.exe is blocked', hook('guard-process', bash('taskkill /F /IM chrome.exe'), { project: p }), 'block', ['process:kill-browser-by-name']);
  check('guard-process: Stop-Process -Name msedge is blocked', hook('guard-process', pwsh('Stop-Process -Name msedge -Force'), { project: p }), 'block', ['process:kill-browser-by-name']);
  check('guard-process: Get-Process chrome | Stop-Process is blocked', hook('guard-process', pwsh('Get-Process chrome | Stop-Process'), { project: p }), 'block', ['process:kill-browser-by-name']);
  check('guard-process: pkill -f chromium is blocked', hook('guard-process', bash('npm test && pkill -f chromium'), { project: p }), 'block', ['process:kill-browser-by-name']);
  check('guard-process: killing a launched PID passes', hook('guard-process', bash('taskkill /PID 4242 /T /F'), { project: p }), 'pass');
  check('guard-process: a commit message that mentions it passes', hook('guard-process', bash('git commit -m "guard: never taskkill chrome by name"'), { project: p }), 'pass');
  const paid = 'curl -s https://api.elevenlabs.io/v1/sound-generation -H "xi-api-key: $ELEVENLABS_API_KEY" -d @req.json -o hit.mp3';
  check('guard-process: paid call with no plan is blocked', hook('guard-process', bash(paid), { project: p }), 'block', ['process:paid-without-approval', 'plan.md']);
  fs.mkdirSync(path.join(p, '.sensei'), { recursive: true }); fs.writeFileSync(path.join(p, '.sensei', 'plan.md'), '# Plan\n3 SFX from ElevenLabs, 1 retry each, about 0.30 USD.\n');
  check('guard-process: paid call with an unapproved plan is blocked', hook('guard-process', bash(paid), { project: p }), 'block', ['has not been approved']);
  const ap = spawnSync(process.execPath, [path.join(ROOT, 'lib', 'approval.mjs'), 'approve', '--words', 'yes, go ahead with the three sounds', p], { encoding: 'utf8' });
  results.push({ label: 'approval.mjs: records the plan hash', ok: ap.status === 0 && /sha256/.test(ap.stdout), detail: ap.stdout + ap.stderr });
  check('guard-process: paid call with a matching approved plan passes', hook('guard-process', bash(paid), { project: p }), 'pass');
  fs.appendFileSync(path.join(p, '.sensei', 'plan.md'), 'Also 40 music stems.\n');
  check('guard-process: plan edited after approval is blocked again', hook('guard-process', bash(paid), { project: p }), 'block', ['hash differs']);
  fs.writeFileSync(path.join(p, 'entry-glb.js'), "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';\nwindow.T = { GLTFLoader, DRACOLoader };\n");
  fs.writeFileSync(path.join(p, 'entry-min.js'), "import * as THREE from 'three';\nwindow.T = THREE;\n");
  check('guard-process: three loader bundle without the define is blocked', hook('guard-process', bash('npx esbuild entry-glb.js --bundle --format=iife --global-name=T --minify --outfile=t-glb.js'), { project: p }), 'block', ['process:bundle-without-import-meta-define']);
  check('guard-process: the same bundle with the define passes', hook('guard-process', bash('npx esbuild entry-glb.js --bundle --format=iife --global-name=T --minify --define:import.meta.url=\\"https://invalid.local/x/\\" --outfile=t-glb.js'), { project: p }), 'pass');
  check('guard-process: a bundle with no loaders passes', hook('guard-process', bash('npx esbuild entry-min.js --bundle --format=iife --global-name=T --outfile=t-min.js'), { project: p }), 'pass');
}

// ---------- gate-claim (Stop) ----------
{
  const stop = (msg, sid, extra = {}) => ({ hook_event_name: 'Stop', session_id: sid, stop_hook_active: false, last_assistant_message: msg, ...extra });
  const edit = (proj, sid, file) => { fs.writeFileSync(file, '<!doctype html><p>x</p>\n'); return hook('keep-eol', { ...write(file, ''), session_id: sid }, { project: proj }); };
  const p = mkProject('gate', { deliverable: 'single-file' });
  edit(p, 's1', path.join(p, 'index.html'));
  check('gate-claim: "done" after an edit with no gate report is blocked', hook('gate-claim', stop('The page is finished and ready to ship.', 's1'), { project: p }), 'block', ['gate-claim', 'no gate report']);
  check('gate-claim: blocks only once for the same edits', hook('gate-claim', stop('Done.', 's1'), { project: p }), 'pass');
  check('gate-claim: stop_hook_active passes', hook('gate-claim', stop('Done.', 's1', { stop_hook_active: true }), { project: p }), 'pass');
  edit(p, 's2', path.join(p, 'index.html'));
  check('gate-claim: no claim in the reply passes', hook('gate-claim', stop('I changed the hero; next I will run the verify gate.', 's2'), { project: p }), 'pass');
  const rep = writeGateReport(p, 'verify', { target: 'index.html', checks: [{ id: 'reduced-motion', status: 'pass' }] });
  const later = new Date(Date.now() + 5000); fs.utimesSync(rep, later, later);
  check('gate-claim: "done" with a fresh passing gate report passes', hook('gate-claim', stop('All done: every check passed.', 's2'), { project: p }), 'pass');
  edit(p, 's3', path.join(p, 'index.html'));
  const rep2 = writeGateReport(p, 'verify', { target: 'index.html', checks: [{ id: 'axe', status: 'fail' }] });
  const later2 = new Date(Date.now() + 10000); fs.utimesSync(rep2, later2, later2);
  check('gate-claim: "done" with a failing gate report is blocked', hook('gate-claim', stop('Finished.', 's3'), { project: p }), 'block', ['failed']);
  // A quick passing run written after a fuller failing one must not hide it.
  const q = mkProject('gate-hide', { deliverable: 'single-file' });
  edit(q, 'h1', path.join(q, 'index.html'));
  const full = writeGateReport(q, 'full', { target: 'index.html', checks: [{ id: 'axe', status: 'fail' }] });
  const tf = new Date(Date.now() + 3000); fs.utimesSync(full, tf, tf);
  const quick = writeGateReport(q, 'quick', { target: 'index.html', checks: [{ id: 'load', status: 'pass' }] });
  const tq = new Date(Date.now() + 6000); fs.utimesSync(quick, tq, tq);
  check('gate-claim: a newer passing report does not hide a fresh failing one', hook('gate-claim', stop('Done.', 'h1'), { project: q }), 'block', ['full.json']);
  // A deliverable dated in the future (clock moved back) must not make every report stale.
  const fut = mkProject('gate-future', { deliverable: 'single-file' });
  const ff = path.join(fut, 'index.html');
  edit(fut, 'u1', ff);
  const ahead = new Date(Date.now() + 3600e3); fs.utimesSync(ff, ahead, ahead);
  const ok = writeGateReport(fut, 'verify', { target: 'index.html', checks: [{ id: 'load', status: 'pass' }] });
  const tn = new Date(Date.now() + 2000); fs.utimesSync(ok, tn, tn);
  check('gate-claim: a file dated in the future does not block a fresh passing report', hook('gate-claim', stop('Done.', 'u1'), { project: fut }), 'pass');
  const film = mkProject('gate-film', { deliverable: 'film' });
  edit(film, 'f1', path.join(film, 'film.html'));
  check('gate-claim: film "done" with no MP4 or contact sheet is blocked', hook('gate-claim', stop('The film is finished.', 'f1'), { project: film }), 'block', ['no MP4', 'no contact sheet']);
  edit(film, 'f2', path.join(film, 'film.html'));
  const t = new Date(Date.now() + 5000);
  for (const n of ['final.mp4', 'contact-sheet.png']) { const f = path.join(film, 'out', n); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'x'); fs.utimesSync(f, t, t); }
  check('gate-claim: film "done" with a fresh MP4 and contact sheet passes', hook('gate-claim', stop('The film is finished.', 'f2'), { project: film }), 'pass');
  const loose = mkProject('gate-noprofile');
  edit(loose, 'n1', path.join(loose, 'page.html'));
  check('gate-claim: project without a profile gets a note, not a block', hook('gate-claim', stop('Done.', 'n1'), { project: loose }), 'warn', ['not a block']);
}

// ======================================================================================================
// Regression tests for the QC report (build/qc/html-sensei-qc.md). Each one failed before its fix.
// ======================================================================================================
const stopIn = (msg, sid) => ({ hook_event_name: 'Stop', session_id: sid, stop_hook_active: false, last_assistant_message: msg });
const editIn = (proj, sid, file, body = '<!doctype html><p>x</p>\n') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); return hook('keep-eol', { ...write(file, ''), session_id: sid }, { project: proj }); };
const future = (f, ms) => { const t = new Date(Date.now() + ms); fs.utimesSync(f, t, t); };

// ---------- QC 2: the Stop hook needs a fresh passing report that covers the edited deliverable ----------
{
  const p = mkProject('qc2', { deliverable: 'single-file', outputs: { 'src/index.html': 'dist/pol.html' } });
  editIn(p, 'c1', path.join(p, 'src', 'index.html'));
  fs.writeFileSync(path.join(p, 'fixture.html'), '<p>other</p>\n');
  future(writeGateReport(p, 'fixture', { target: path.join(p, 'fixture.html'), checks: [{ id: 'load', status: 'pass' }] }), 3000);
  check('QC2 gate-claim: a fresh passing report for an unrelated file does not cover the edited page', hook('gate-claim', stopIn('Done. The page is ready.', 'c1'), { project: p }), 'block', ['no gate report covers src', 'fixture.json']);
  // Stale packed output: the source changed, dist/ was not packed again, the old dist/ was gated.
  editIn(p, 'c2', path.join(p, 'src', 'index.html'), '<!doctype html><p>new</p>\n');
  const dist = path.join(p, 'dist', 'pol.html'); fs.mkdirSync(path.dirname(dist), { recursive: true }); fs.writeFileSync(dist, '<p>old pack</p>\n');
  const past = new Date(Date.now() - 60000); fs.utimesSync(dist, past, past);
  future(writeGateReport(p, 'verify-pol', { target: dist, checks: [{ id: 'load', status: 'pass' }] }), 3000);
  check('QC2 gate-claim: gating a stale packed file after a source edit is blocked', hook('gate-claim', stopIn('Finished; all checks pass.', 'c2'), { project: p }), 'block', ['dist', 'not rebuilt']);
  // Packed again after the edit and gated: passes through the profile's outputs map.
  editIn(p, 'c3', path.join(p, 'src', 'index.html'), '<!doctype html><p>newer</p>\n');
  fs.writeFileSync(dist, '<p>new pack</p>\n'); future(dist, 1000);
  future(writeGateReport(p, 'verify-pol', { target: 'dist/pol.html', checks: [{ id: 'load', status: 'pass' }] }), 3000);
  check('QC2 gate-claim: a fresh passing report on the packed output named in profile.outputs covers the source', hook('gate-claim', stopIn('Finished; all checks pass.', 'c3'), { project: p }), 'pass');
  // A report whose content hash no longer matches its target does not count.
  const q = mkProject('qc2-hash', { deliverable: 'single-file' });
  const page = path.join(q, 'index.html'); editIn(q, 'h1', page, '<p>v2</p>\n');
  future(writeGateReport(q, 'verify', { target: page, kind: 'file', freshness: { sha256: '0'.repeat(64) }, checks: [{ id: 'load', status: 'pass' }] }), 3000);
  check('QC2 gate-claim: a report whose hash no longer matches the page is not fresh', hook('gate-claim', stopIn('Done.', 'h1'), { project: q }), 'block', ['no longer matches']);
  // An asset beside the gated page is covered by the page's report.
  const r = mkProject('qc2-asset', { deliverable: 'single-file' });
  fs.writeFileSync(path.join(r, 'index.html'), '<p>x</p>\n');
  editIn(r, 'a1', path.join(r, 'js', 'app.js'), 'export const x = 1;\n');
  future(writeGateReport(r, 'verify', { target: 'index.html', checks: [{ id: 'load', status: 'pass' }] }), 3000);
  check('QC2 gate-claim: a script under the gated page\'s folder is covered by that page\'s report', hook('gate-claim', stopIn('Done.', 'a1'), { project: r }), 'pass');
}

// ---------- QC 3: claims judged per sentence ----------
{
  const p = mkProject('qc3', { deliverable: 'single-file' });
  let n = 0;
  const claimCase = (label, msg, expect) => { const sid = `q3-${++n}`; editIn(p, sid, path.join(p, 'index.html'), `<p>${n}</p>\n`); check(`QC3 gate-claim: ${label}`, hook('gate-claim', stopIn(msg, sid), { project: p }), expect, expect === 'block' ? ['gate-claim'] : []); };
  claimCase('a "not done yet" sentence negates only itself', 'The landing page is finished and all checks pass. The email sending is not done yet (it needs a server).', 'block');
  claimCase('"All 22 checks pass and it is good to go." is a claim', 'All 22 checks pass and it is good to go.', 'block');
  claimCase('"ready" is a claim', 'The sign-up page is ready.', 'block');
  claimCase('"shipped" is a claim', 'Shipped the new hero.', 'block');
  claimCase('"complete" is a claim', 'The course is complete.', 'block');
  claimCase('"works" is a claim', 'The theme switch works now.', 'block');
  claimCase('"it\'s live" is a claim', "It's live.", 'block');
  claimCase('a progress note with "next" is not a claim', 'I have done the hero; next I will build the form.', 'pass');
  claimCase('a question is not a claim', 'Is the page ready?', 'pass');
  claimCase('a conditional is not a claim', 'It will be done once the server exists.', 'pass');
  claimCase('"so far" is not a claim', 'So far the hero is done and the rest is open.', 'pass');
}

// ---------- QC 4: reduced motion judged on code, by selector, with comments stripped ----------
{
  const p = mkProject('qc4', { offline: true });
  check('QC4 lint-web: an infinite spin whose reduce block resets only another element warns', hook('lint-web', write(placeFixture(p, 'rm-partial.html'), ''), { project: p }), 'warn', ['reduced-motion:css-keyframes', '.spinner']);
  check('QC4 lint-web: rAF and element.animate() with only an unrelated CSS reduce rule warn', hook('lint-web', write(placeFixture(p, 'raf-css-rm.html'), ''), { project: p }), 'warn', ['reduced-motion:requestAnimationFrame', 'reduced-motion:web-animations']);
  check('QC4 lint-web: a comment is not a reduced-motion guard', hook('lint-web', write(placeFixture(p, 'raf-comment.html'), ''), { project: p }), 'warn', ['reduced-motion:requestAnimationFrame']);
  check('QC4 lint-web: View Transitions with an unrelated reduce rule warn', hook('lint-web', write(placeFixture(p, 'vt-rm-miss.html'), ''), { project: p }), 'warn', ['reduced-motion:view-transitions']);
  check('QC4 lint-web: the same features done right lint clean', hook('lint-web', write(placeFixture(p, 'rm-fixed.html'), ''), { project: p }), 'pass');
  check('QC4 lint-3d: a WebGL loop whose only reduced-motion branch is a comment warns', hook('lint-3d', write(placeFixture(p, 'gl-comment-rm.html'), ''), { project: p }), 'warn', ['3d:reduced-motion']);
  // Every example page shipped in the skills still lints clean (the sweep the fix was checked against).
  const { lintWeb } = await import(new URL('../../lib/lint/web.mjs', import.meta.url).href);
  const pages = []; const walkEx = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walkEx(f); } else if (/\.html?$/i.test(e.name) && /[\\/]examples[\\/]/.test(f)) pages.push(f); } };
  if (fs.existsSync(path.join(ROOT, 'skills'))) walkEx(path.join(ROOT, 'skills'));
  const flagged = pages.flatMap(f => lintWeb(fs.readFileSync(f, 'utf8'), { file: f, profile: { offline: true } }).map(x => `${path.relative(ROOT, f)}: ${x.id} (line ${x.line})`));
  results.push({ label: `QC4 lint-web: every skill example page lints clean (${pages.length} pages)`, ok: !flagged.length, detail: flagged.join('; ') });
}

// ---------- QC 5: lint hooks silent in a project that never opted in ----------
{
  const p = mkProject('qc5-noprofile');
  const srv = path.join(p, 'server.js'); fs.writeFileSync(srv, 'const r = await fetch("https://api.github.com/repos/x/y");\nrequestAnimationFrame(function f() { requestAnimationFrame(f); });\n');
  check('QC5 lint-web: server code in a project with no profile gets nothing (no no-cdn failure)', hook('lint-web', write(srv, ''), { project: p }), 'pass');
  const gl = path.join(p, 'gl.html'); fs.copyFileSync(path.join(FX, 'three-bad.html'), gl);
  check('QC5 lint-3d: silent with no profile', hook('lint-3d', write(gl, ''), { project: p }), 'pass');
  const sk = path.join(p, 'seek.html'); fs.copyFileSync(path.join(FX, 'seek-bad.html'), sk);
  check('QC5 lint-determinism: silent with no profile', hook('lint-determinism', write(sk, ''), { project: p }), 'pass');
  const pr = hook('probe', { hook_event_name: 'SessionStart', source: 'startup' }, { project: p });
  results.push({ label: 'QC22 probe: one short line and no tool summary in a project with no .sensei folder', ok: pr.code === 0 && /Profile: none/.test(pr.context) && !/Node:|Chrome|ffmpeg/i.test(pr.context) && pr.context.split('\n').length === 1, detail: pr.context.slice(0, 300) });
}

// ---------- QC 7: guard-secrets by whole name segment, entropy, examples, Bearer, env readers ----------
{
  const p = mkProject('qc7', {});
  const hex = 'f3a9c2e7b1d0' + '4c5a8e6f2b9d' + '7c1a3e5f';
  check('QC7 guard-secrets: authorName is not a secret', hook('guard-secrets', preWrite(path.join(p, 'a.js'), 'const authorName = "Jane-Example-2026-portfolio";\n'), { project: p }), 'pass');
  check('QC7 guard-secrets: tokenizer is not a secret', hook('guard-secrets', preWrite(path.join(p, 'b.js'), 'const tokenizer = "wordpiece-uncased-v2-2024";\n'), { project: p }), 'pass');
  check('QC7 guard-secrets: echo $TOKENIZER_PATH is not a secret', hook('guard-secrets', bash('echo $TOKENIZER_PATH'), { project: p }), 'pass');
  const awsDoc = 'AKIA' + 'IOSFODNN7' + 'EXAMPLE';
  check('QC7 guard-secrets: the AWS documentation example key passes', hook('guard-secrets', preWrite(path.join(p, 'README.md'), `aws_access_key_id = ${awsDoc}\n`), { project: p }), 'pass');
  check('QC7 guard-secrets: a Bearer header with a literal token is blocked', hook('guard-secrets', preWrite(path.join(p, 'c.js'), `fetch(u, { headers: { Authorization: "Bear` + `er ${hex}" } });\n`), { project: p }), 'block', ['secret:bearer-literal']);
  check('QC7 guard-secrets: a Bearer header built from the environment passes', hook('guard-secrets', preWrite(path.join(p, 'c.js'), 'fetch(u, { headers: { Authorization: "Bearer " + process.env.API_TOKEN } });\n'), { project: p }), 'pass');
  check('QC7 guard-secrets: a bare .env value is blocked', hook('guard-secrets', preWrite(path.join(p, '.env.local'), `FAL_KEY=${hex}\n`), { project: p }), 'block', ['secret:env-literal']);
  check('QC7 guard-secrets: node -p process.env.KEY is blocked', hook('guard-secrets', bash('node -p process.env.ELEVENLABS_API_KEY'), { project: p }), 'block', ['secret:node-print-secret']);
  check('QC7 guard-secrets: sed reading .env is blocked', hook('guard-secrets', bash('sed -n p .env'), { project: p }), 'block', ['secret:read-secret-file']);
  check('QC7 guard-secrets: node -e reading .env is blocked', hook('guard-secrets', bash(`node -e "console.log(require('fs').readFileSync('.env','utf8'))"`), { project: p }), 'block', ['secret:read-secret-file']);
  check('QC7 guard-secrets: node --env-file=.env passes', hook('guard-secrets', bash('node --env-file=.env server.js'), { project: p }), 'pass');
}

// ---------- QC 8: the reviewer agent cannot write through the shell ----------
{
  const p = mkProject('qc8', {});
  const rv = { agent_id: 'agent-1', agent_type: 'html-sensei:sensei-reviewer' };
  const writes = [
    ['node -e writeFileSync', bash(`node -e "require('fs').writeFileSync('index.html','x')"`)],
    ['Set-Content', pwsh('Set-Content -Path index.html -Value x')],
    ['sed -i', bash("sed -i 's/a/b/' index.html")],
    ['redirection', bash('echo x > index.html')],
    ['rm', bash('rm index.html')],
    ['git checkout', bash('git checkout -- index.html')],
  ];
  for (const [label, inp] of writes) check(`QC8 guard-reviewer: the reviewer is refused ${label}`, hook('guard-reviewer', { ...inp, ...rv }, { project: p }), 'block', ['read-only']);
  check('QC8 guard-reviewer: the reviewer may run the plugin\'s gate', hook('guard-reviewer', { ...bash(`node "${path.join(ROOT, 'skills', 'sensei-verify', 'scripts', 'verify.mjs')}" index.html --name review-1`), ...rv }, { project: p }), 'pass');
  check('QC8 guard-reviewer: the reviewer may read', hook('guard-reviewer', { ...bash('cat index.html | grep -n x && git diff --stat 2>/dev/null'), ...rv }, { project: p }), 'pass');
  check('QC8 guard-reviewer: other agents and the main conversation are not affected', hook('guard-reviewer', { ...bash('echo x > index.html'), agent_type: 'html-sensei:sensei-packager' }, { project: p }), 'pass');
  check('QC8 guard-reviewer: no agent identity, no effect', hook('guard-reviewer', bash('echo x > index.html'), { project: p }), 'pass');
}

// ---------- QC 10: no-CDN coverage and non-loading link tags ----------
{
  const p = mkProject('qc10', { offline: true });
  check('QC10 lint-web: srcset, poster, SVG image, object, form action, side-effect import, Worker, sendBeacon, WebSocket and script.src are reported', hook('lint-web', write(placeFixture(p, 'net-miss.html'), ''), { project: p }), 'warn', ['no-cdn', '10 network reference']);
  check('QC10 lint-web: canonical, alternate, licence and author links, hyperlinks and commented-out URLs pass', hook('lint-web', write(placeFixture(p, 'net-links.html'), ''), { project: p }), 'pass');
}

// ---------- QC 11: lint-3d terminator and transpose through a variable ----------
{
  const p = mkProject('qc11', {});
  check('QC11 lint-3d: "</script>" in a string and p * modelViewMatrix are reported', hook('lint-3d', write(placeFixture(p, 'gl-terminator.html'), ''), { project: p }), 'warn', ['3d:inline-script-terminator', '3d:transpose-matrix-multiply']);
}

// ---------- QC 12: lint-determinism accepts seek-driven CSS and catches three more clocks ----------
{
  const p = mkProject('qc12', { deliverable: 'film' });
  check('QC12 lint-determinism: a paused CSS animation driven by getAnimations().currentTime passes', hook('lint-determinism', write(placeFixture(p, 'seek-paused.html'), ''), { project: p }), 'pass');
  check('QC12 lint-determinism: a paused CSS animation driven by a negative delay from t passes', hook('lint-determinism', write(placeFixture(p, 'seek-delay.html'), ''), { project: p }), 'pass');
  check('QC12 lint-determinism: crypto.randomUUID and document.timeline.currentTime are reported', hook('lint-determinism', write(placeFixture(p, 'seek-clocks.html'), ''), { project: p }), 'warn', ['seek:unseeded-random', 'seek:date-now']);
  const one = path.join(p, 'origin.html'); fs.writeFileSync(one, '<script>window.seek = t => { document.title = performance.timeOrigin + t; };</script>\n');
  check('QC12 lint-determinism: performance.timeOrigin is reported', hook('lint-determinism', write(one, ''), { project: p }), 'warn', ['seek:date-now']);
}

// ---------- QC 15: ledger init and add ----------
{
  const p = mkProject('qc15', {});
  const L = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'lib', 'ledger.mjs'), ...a], { encoding: 'utf8' });
  const i1 = L('init', p);
  results.push({ label: 'QC15 ledger init: creates .sensei/licences.json', ok: i1.status === 0 && fs.existsSync(path.join(p, '.sensei', 'licences.json')), detail: i1.stdout + i1.stderr });
  const a1 = L('add', p, '--id', 'gsap', '--name', 'GSAP', '--licence', 'Standard no-charge licence', '--use', 'vendored', '--files', 'dist/pol.html', '--notice', 'header');
  const ls = L('list', p);
  results.push({ label: 'QC15 ledger add: writes a row that list prints', ok: a1.status === 0 && /gsap\tStandard no-charge licence\tvendored\tdist\/pol\.html/.test(ls.stdout), detail: a1.stdout + a1.stderr + ls.stdout });
  const a2 = L('add', p, '--id', 'shadertoy', '--licence', 'CC ' + 'BY-' + 'NC-SA 3.0', '--use', 'ported');
  results.push({ label: 'QC15 ledger add: an ideas-only source recorded as ported exits 1 with the problem', ok: a2.status === 1 && /ideas-only/.test(a2.stdout), detail: a2.stdout + a2.stderr });
  const a3 = L('add', p, '--id', 'x');
  results.push({ label: 'QC15 ledger add: missing --licence and --use exits 2', ok: a3.status === 2 && /missing/.test(a3.stderr), detail: a3.stdout + a3.stderr });
  const i2 = L('init', p);
  results.push({ label: 'QC15 ledger init: leaves an existing ledger unchanged', ok: i2.status === 0 && /left unchanged/.test(i2.stdout) && /gsap/.test(L('list', p).stdout), detail: i2.stdout });
}

// ---------- QC 16: guard-process judges the kill target, not any word ----------
{
  const p = mkProject('qc16', {});
  check('QC16 guard-process: kill <pid> with a comment mentioning chrome passes', hook('guard-process', bash('kill 4242 # the chrome child I launched'), { project: p }), 'pass');
  check('QC16 guard-process: running a script whose name contains chrome passes', hook('guard-process', bash('node kill-chrome-test.mjs'), { project: p }), 'pass');
  check('QC16 guard-process: a flag naming chrome passes', hook('guard-process', bash('node render.mjs --kill-stale-chrome-profiles'), { project: p }), 'pass');
  check('QC16 guard-process: taskkill /IM chr* is blocked', hook('guard-process', bash('taskkill /F /IM chr*'), { project: p }), 'block', ['process:kill-browser-by-name']);
  check('QC16 guard-process: kill $(pgrep chrome) is blocked', hook('guard-process', bash('kill $(pgrep chrome)'), { project: p }), 'block', ['process:kill-browser-by-name']);
}

// ---------- QC 17: guard-licence, Shadertoy and React Bits shapes, honest credit lines ----------
{
  const plug = mkProject('qc17-plugin'); fs.mkdirSync(path.join(plug, '.claude-plugin'), { recursive: true }); fs.writeFileSync(path.join(plug, '.claude-plugin', 'plugin.json'), '{"name":"y"}');
  const proj = mkProject('qc17-project', { licence_mode: 'commercial' });
  const toy = 'void main' + 'Image(out vec4 fragColor, in vec2 fragCoord) {\n  vec2 uv = fragCoord / i' + 'Resolution.xy;\n  fragColor = vec4(uv, 0.5 + 0.5 * sin(i' + 'Time), 1.0);\n}\n';
  check('QC17 guard-licence: a Shadertoy-shaped shader with no URL is blocked in a plugin path', hook('guard-licence', preWrite(path.join(plug, 'skills', 'fx', 'bg.glsl'), toy), { project: proj }), 'block', ['ideas-only:shadertoy']);
  check('QC17 guard-licence: the same shader in a project warns', hook('guard-licence', preWrite(path.join(proj, 'bg.glsl'), toy), { project: proj }), 'warn', ['ideas-only:shadertoy']);
  const credit = '// technique inspired by https://www.' + 'shader' + 'toy.com/view/XsXXDn (own code)\nvoid main() { gl_FragColor = vec4(uTime); }\n';
  check('QC17 guard-licence: own code crediting a Shadertoy idea is not blocked (reminder only)', hook('guard-licence', preWrite(path.join(proj, 'own.frag'), credit), { project: proj }), 'warn', ['idea-credit:shadertoy', 'use idea']);
  const rbName = 'Shiny' + 'Text';
  const rb = `import { useRef } from 'react';\nexport default function ${rbName}({ text }) { const ref = useRef(null); return <span ref={ref} className="shiny">{text}</span>; }\n`;
  check('QC17 guard-licence: a react-bits-named component with no URL is blocked in a plugin path', hook('guard-licence', preWrite(path.join(plug, 'skills', 'ui', 'Shine.jsx'), rb), { project: proj }), 'block', ['never-ship:react-bits']);
  const reg = `import { useEffect } from 'react';\nexport default function Glow() { useEffect(() => {}, []); return null; }\n`;
  check('QC17 guard-licence: a component in the react-bits registry layout is blocked in a plugin path', hook('guard-licence', preWrite(path.join(plug, 'src', 'content', 'Backgrounds', 'Glow', 'Glow.jsx'), reg), { project: proj }), 'block', ['never-ship:react-bits']);
  check('QC17 guard-licence: a react-bits-named component in a user project is not blocked', hook('guard-licence', preWrite(path.join(proj, 'src', 'Shine.jsx'), rb), { project: proj }), 'pass');
}

// ---------- QC 18: edits made through the shell reach the Stop hook ----------
{
  const p = mkProject('qc18', { deliverable: 'single-file' });
  const page = path.join(p, 'dist', 'page.html'); fs.mkdirSync(path.dirname(page), { recursive: true }); fs.writeFileSync(page, '<p>x</p>\n');
  const post = (cmd, tool = 'Bash') => ({ hook_event_name: 'PostToolUse', tool_name: tool, session_id: 'sh1', tool_input: { command: cmd }, tool_response: { stdout: '', stderr: '' } });
  check('QC18 record-shell: prints nothing and never blocks', hook('record-shell', post('echo "<p>x</p>" > dist/page.html'), { project: p }), 'pass');
  check('QC18 gate-claim: a deliverable written by shell redirection needs a gate', hook('gate-claim', stopIn('Done.', 'sh1'), { project: p }), 'block', ['dist', 'page.html']);
  const src = path.join(p, 'src', 'index.html'); fs.mkdirSync(path.dirname(src), { recursive: true }); fs.writeFileSync(src, '<p>y</p>\n');
  hook('record-shell', { ...post('Set-Content -Path src/index.html -Value $t', 'PowerShell'), session_id: 'sh2' }, { project: p });
  check('QC18 gate-claim: a deliverable written by Set-Content needs a gate', hook('gate-claim', stopIn('Done.', 'sh2'), { project: p }), 'block', ['index.html']);
  hook('record-shell', { ...post(`node "${path.join(ROOT, 'skills', 'sensei-single-file', 'scripts', 'inline.mjs')}" src/index.html dist/page.html`), session_id: 'sh3' }, { project: p });
  check('QC18 gate-claim: the output of an inline build needs a gate', hook('gate-claim', stopIn('Packed and done.', 'sh3'), { project: p }), 'block', ['page.html']);
  hook('record-shell', { ...post('ls -la > listing.txt && npm test 2>&1'), session_id: 'sh4' }, { project: p });
  check('QC18 gate-claim: a command that writes no deliverable records nothing', hook('gate-claim', stopIn('Done.', 'sh4'), { project: p }), 'pass');
}

// ---------- the plugin tree against its own rules ----------
{
  const files = [];
  // Scan this plugin, excluding generated state and local dependencies.
  const excluded = new Set(['.git', '.work', '.sensei', '.codex', '.claude', 'node_modules']);
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!excluded.has(e.name)) walk(p); } else if (e.isFile()) files.push(p); } };
  walk(ROOT);
  const text = files.filter(f => /\.(?:mjs|js|json|md|html)$/i.test(f));
  const lic = text.flatMap(f => scanLicence(fs.readFileSync(f, 'utf8'), { file: f, inPlugin: true }).filter(x => x.level === 'block').map(x => `${path.relative(ROOT, f)}: ${x.id}`));
  results.push({ label: `plugin tree passes its own licence guard (${text.length} files)`, ok: !lic.length, detail: lic.join('; ') });
  const sec = text.flatMap(f => scanText(fs.readFileSync(f, 'utf8')).map(x => `${path.relative(ROOT, f)}: ${x.id}`));
  results.push({ label: 'plugin tree passes its own secrets guard', ok: !sec.length, detail: sec.join('; ') });
  const crlf = text.filter(f => fs.readFileSync(f, 'utf8').includes('\r'));
  results.push({ label: 'plugin tree is LF only', ok: !crlf.length, detail: crlf.map(f => path.relative(ROOT, f)).join(', ') });
  // The plugin installer rejects a skill whose description is over 1024 characters (claude plugin validate does not
  // check it), and an unquoted description holding ": " is not valid YAML for a strict parser.
  const fmBad = [];
  for (const f of files.filter(f => /[\\/](?:skills[\\/][^\\/]+[\\/]SKILL\.md|agents[\\/][^\\/]+\.md|commands[\\/][^\\/]+\.md)$/.test(f))) {
    const m = fs.readFileSync(f, 'utf8').match(/^---\n([\s\S]*?)\n---/); if (!m) { fmBad.push(`${path.relative(ROOT, f)}: no front matter`); continue; }
    const d = m[1].match(/^description:[ \t]*(.*(?:\n[ \t]+.*)*)/m); if (!d) { fmBad.push(`${path.relative(ROOT, f)}: no description`); continue; }
    let v = d[1].trim(), quoted = /^["']/.test(v);
    if (/^"/.test(v)) { try { v = JSON.parse(v); } catch { fmBad.push(`${path.relative(ROOT, f)}: description quoting`); continue; } }
    else if (/^'/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    else if (/^[>|]/.test(v)) { v = v.replace(/^[>|][-+]?\s*/, '').replace(/\s+/g, ' '); quoted = true; }
    if (v.length > 1024) fmBad.push(`${path.relative(ROOT, f)}: description ${v.length} characters (limit 1024)`);
    if (!quoted && /: /.test(v)) fmBad.push(`${path.relative(ROOT, f)}: unquoted description contains ": " (invalid YAML)`);
  }
  results.push({ label: 'skill, agent and command front matter: descriptions at most 1024 characters and valid YAML', ok: !fmBad.length, detail: fmBad.join('; ') });
  const dash = text.filter(f => /[\u2013\u2014]/.test(fs.readFileSync(f, 'utf8')));
  results.push({ label: 'plugin tree has no em or en dashes', ok: !dash.length, detail: dash.map(f => path.relative(ROOT, f)).join(', ') });
  const json = files.filter(f => f.endsWith('.json')).filter(f => { try { JSON.parse(fs.readFileSync(f, 'utf8')); return false; } catch { return true; } });
  results.push({ label: 'every JSON file parses', ok: !json.length, detail: json.join(', ') });
}

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : `\n      ${r.detail}`}`); }
console.log(`\n${results.length - failed} passed, ${failed} failed (${results.length} checks). Scratch folder: ${TMP}`);
if (!failed) fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
