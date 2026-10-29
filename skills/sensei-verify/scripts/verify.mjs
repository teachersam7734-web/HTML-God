#!/usr/bin/env node
// verify.mjs: the umbrella. Decides which gates a deliverable needs, runs each one as its own program, and writes one
// combined report last, so the Stop hook (which reads the newest report in .sensei/gate/) sees the worst verdict of
// all of them, not just whichever gate happened to finish last.
//
//   node verify.mjs <page.html | folder | url | film.mp4> [--project DIR] [--name ID] [--quick] [--only page,3d,film]
//                   [--film film.mp4] [--expect S] [--audio] [--dry-run] [any sensei-gate option]
//
// Every page-gate option (--steps, --routes, --strict, --mode, --checks, --widths, --allow-external, --expect-text,
// --steps-after-routes and the rest; the list is lib/gate-options.mjs) is forwarded to the page gate as given, with or
// without `--` before it. Any other option is an error: exit 2, nothing run. The run header and the combined report
// (`page_options`) list what was forwarded, so the report shows which checks ran.
//
// What it runs (it never re-implements a check; each gate owns its logic and its report):
//   page   scripts/sensei-gate.mjs (this skill)                      every HTML target; --quick = load,net,hygiene,shots,canvas,motion
//   3d     ../sensei-3d/scripts/gate3d.mjs                            the page uses WebGL and the seek contract (window.__seek, ?t=)
//   film   ../sensei-motion-graphics/scripts/film-gates.mjs --page    a seek page with a duration (window.__meta or DURATION): G5
//          ../sensei-video-pipeline/scripts/render.mjs --probe        same page: determinism hash, in order and out of order
//          film-gates.mjs --video and ../sensei-video-pipeline/scripts/sheet.mjs   an MP4 (target or --film): G0, G2, G3, contact sheet
// Combined report: <project>/.sensei/gate/verify-<name>.json, in the plugin's gate format (lib/gate.mjs). A gate that
// fails makes the verdict fail. A gate that could not run (exit 2: no browser, no ffmpeg) is listed as not-verified;
// if that gate is the page gate itself, the verdict is fail, because nothing was verified.
//
// verified: Windows 10, Node 24: test-gate.mjs runs it on the good fixture (page gate only) and on the sensei-3d
//           starter example (page gate plus gate3d) and checks the combined verdict and the Stop hook's reading of it.
// not verified: the film branch end to end in this skill's tests (each film script is tested in its own skill:
//           sensei-video-pipeline/scripts/test-pipeline.mjs, sensei-motion-graphics/scripts/test-examples.mjs);
//           macOS and Linux.
// Original HTML-Sensei code.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAGE_VALUE_OPTS, PAGE_FLAGS } from './lib/gate-options.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.resolve(HERE, '..', '..');
const LIB = path.resolve(SKILLS, '..', 'lib');
const GATES = {
  page: path.join(HERE, 'sensei-gate.mjs'),
  gate3d: path.join(SKILLS, 'sensei-3d', 'scripts', 'gate3d.mjs'),
  filmGates: path.join(SKILLS, 'sensei-motion-graphics', 'scripts', 'film-gates.mjs'),
  render: path.join(SKILLS, 'sensei-video-pipeline', 'scripts', 'render.mjs'),
  sheet: path.join(SKILLS, 'sensei-video-pipeline', 'scripts', 'sheet.mjs'),
};

// Options: this script's own, then every option the page gate accepts (forwarded to it as given), then an error for
// anything else. `--` still works and forwards everything after it unchecked by this script (the page gate checks it).
const OWN_VALUES = new Set(['project', 'name', 'only', 'film', 'expect']);
const OWN_FLAGS = new Set(['quick', 'audio', 'dry-run', 'help']);
const raw = process.argv.slice(2);
const dd = raw.indexOf('--');
const argv = dd >= 0 ? raw.slice(0, dd) : raw;
const passthrough = dd >= 0 ? raw.slice(dd + 1) : [];
const forwarded = [];
const opt = {}; const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { pos.push(a); continue; }
  let k = a.slice(2), v;
  const eq = k.indexOf('=');
  if (eq >= 0) { v = k.slice(eq + 1); k = k.slice(0, eq); }
  const needValue = () => {
    if (v !== undefined) return v;
    const n = argv[++i];
    if (n === undefined || (n.startsWith('--') && n.length > 2)) { console.error(`verify: --${k} needs a value`); process.exit(2); }
    return n;
  };
  if (OWN_FLAGS.has(k)) opt[k] = true;
  else if (OWN_VALUES.has(k)) opt[k] = needValue();
  else if (PAGE_FLAGS.has(k) && k !== 'help') forwarded.push('--' + k);
  else if (PAGE_VALUE_OPTS.has(k)) forwarded.push('--' + k, needValue());
  else {
    console.error(`verify: unknown option --${k}. verify.mjs takes --project --name --only --film --expect --quick --audio --dry-run, and forwards every page-gate option (${[...PAGE_VALUE_OPTS, ...PAGE_FLAGS].filter(x => x !== 'help' && x !== 'project' && x !== 'name').map(x => '--' + x).join(' ')}). Nothing was run.`);
    process.exit(2);
  }
}
const pageArgs = [...forwarded, ...passthrough];
const stepsAt = pageArgs.indexOf('--steps');
if (stepsAt >= 0 && !fs.existsSync(path.resolve(pageArgs[stepsAt + 1] || ''))) { console.error(`verify: steps file not found: ${pageArgs[stepsAt + 1]}. Nothing was run.`); process.exit(2); }
if (pageArgs.includes('--checks') && opt.quick) { console.error('verify: give either --quick or --checks, not both'); process.exit(2); }
if (pos.length > 1) { console.error(`verify: one target only; got ${pos.join(', ')}`); process.exit(2); }
if (opt.help || !pos.length) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1).filter((l, i, a) => a.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(opt.help ? 0 : 2);
}

const target = pos[0];
const isUrl = /^https?:\/\//i.test(target);
const abs = isUrl ? null : path.resolve(target);
if (!isUrl && !fs.existsSync(abs)) { console.error('target not found: ' + target); process.exit(2); }
const project = path.resolve(opt.project || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const slug = s => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 48) || 'page';
const name = slug(opt.name || (isUrl ? new URL(target).host : path.basename(abs)));
const only = opt.only ? new Set(String(opt.only).split(',')) : null;
const want = k => !only || only.has(k);

let lib = {};
try { lib.gate = await import(pathToFileURL(path.join(LIB, 'gate.mjs')).href); } catch { lib.gate = null; }
try { lib.profile = await import(pathToFileURL(path.join(LIB, 'profile.mjs')).href); } catch { lib.profile = null; }
const profile = lib.profile ? lib.profile.loadProfile({ projectDir: project, from: abs || undefined }).profile : { deliverable: 'single-file' };

const isFilm = !isUrl && /\.(mp4|mov|webm)$/i.test(abs);
const isHtml = isUrl || (!isFilm && (fs.statSync(abs).isDirectory() || /\.html?$/i.test(abs)));
const src = !isUrl && isHtml && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : '';
const usesGL = /getContext\(\s*['"](?:webgl2?|experimental-webgl)['"]|WebGLRenderer|WebGPURenderer/.test(src);
const seekPage = /window\.(?:__seek|seek|renderFrame)\s*=|function\s+(?:__seek|renderFrame)\b/.test(src);
const hasDuration = /__meta|DURATION|__duration/.test(src);
const filmFile = isFilm ? abs : (opt.film ? path.resolve(opt.film) : null);

const plan = [];
if (isHtml && want('page')) {
  const extra = opt.quick ? ['--checks', 'load,net,hygiene,shots,canvas,motion'] : [];
  plan.push({ id: 'page', file: GATES.page, args: [target, '--project', project, '--name', name, ...extra, ...pageArgs], core: true,
    report: () => path.join(project, '.sensei', 'gate', `${name}.json`) });
}
if (isHtml && !isUrl && usesGL && seekPage && want('3d')) {
  plan.push({ id: '3d', file: GATES.gate3d, args: [abs, `--project=${project}`, `--name=gate3d-${name}`],
    report: () => path.join(project, '.sensei', 'gate', `gate3d-${name}.json`) });
}
if (isHtml && !isUrl && seekPage && hasDuration && !usesGL && want('film')) {
  const j = path.join(project, '.sensei', 'gate', name, 'film-page.json');
  plan.push({ id: 'film-page', file: GATES.filmGates, args: ['--page', abs, '--json', j], json: () => j });
  plan.push({ id: 'determinism', file: GATES.render, args: [abs, '--probe'] });
}
if (filmFile && want('film')) {
  const j = path.join(project, '.sensei', 'gate', name, 'film-video.json');
  const v = ['--video', filmFile, '--json', j];
  if (opt.expect) v.push('--expect', String(opt.expect));
  if (opt.audio) v.push('--audio');
  plan.push({ id: 'film-video', file: GATES.filmGates, args: v, json: () => j });
  plan.push({ id: 'contact-sheet', file: GATES.sheet, args: [filmFile, '--out', path.join(project, '.sensei', 'gate', name)], capture: true });
}
if (!plan.length) { console.error('nothing to verify: give an .html file, a folder, a URL or an .mp4'); process.exit(2); }

console.log(`verify: ${target}\nproject: ${project}\nprofile deliverable: ${profile.deliverable}\nplan: ${plan.map(p => p.id).join(', ')}
page-gate options: ${pageArgs.length ? pageArgs.join(' ') : '(none)'}${opt.quick ? ' (plus --quick)' : ''}`);
if (opt['dry-run']) { for (const p of plan) console.log(`  node ${path.relative(process.cwd(), p.file)} ${p.args.join(' ')}`); process.exit(0); }
fs.mkdirSync(path.join(project, '.sensei', 'gate', name), { recursive: true });

const checks = [], verified = [], notVerified = [];
let coreRan = true;
for (const p of plan) {
  if (!fs.existsSync(p.file)) { checks.push({ id: p.id, status: 'not-verified', detail: `gate not installed: ${p.file}` }); notVerified.push(`${p.id}: gate script missing`); if (p.core) coreRan = false; continue; }
  console.log(`\n=== ${p.id}: ${path.basename(p.file)} ===`);
  const r = spawnSync(process.execPath, [p.file, ...p.args], { stdio: p.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8', env: process.env });
  const code = r.status;
  let status = code === 0 ? 'pass' : code === 1 ? 'fail' : 'not-verified', detail = `exit ${code}`;
  if (p.capture && code === 0) detail = `written: ${String(r.stdout).trim().split(/\r?\n/).pop()}`;
  if (p.report) {
    try {
      const rep = JSON.parse(fs.readFileSync(p.report(), 'utf8'));
      if (rep.verdict === 'warn' && status === 'pass') status = 'warn';
      detail = `${rep.verdict}; report ${p.report()}`;
      for (const v of rep.verified || []) verified.push(`${p.id} ${v}`);
      for (const v of rep.not_verified || []) notVerified.push(`${p.id} ${v}`);
    } catch { if (code !== 2) detail += '; its report could not be read'; }
  }
  if (p.json) { try { const j = JSON.parse(fs.readFileSync(p.json(), 'utf8')); for (const [g, v] of Object.entries(j.gates || {})) (v.pass ? verified : []).push(`${p.id} ${g}`); for (const n of j.notes || []) notVerified.push(`${p.id}: ${n}`); } catch { /* the gate printed its reason */ } }
  if (status === 'not-verified') { notVerified.push(`${p.id}: could not run on this machine (exit ${code}); see its message above`); if (p.core) coreRan = false; }
  checks.push({ id: p.id, status, detail });
}

const verdict = !coreRan || checks.some(c => c.status === 'fail') ? 'fail' : checks.some(c => c.status === 'warn' || c.status === 'not-verified') ? 'warn' : 'pass';
const body = { target: abs || target, verdict, checks, verified, not_verified: [...new Set(notVerified)], tool: { name: 'sensei-verify', schema: 1 }, plan: plan.map(p => p.id), page_options: pageArgs,
  ...(coreRan ? {} : { failing: [{ id: 'page', summary: 'the page gate did not run, so nothing was verified' }] }) };
let out;
if (lib.gate && lib.gate.writeGateReport) out = lib.gate.writeGateReport(project, `verify-${name}`, body);
else { const d = path.join(project, '.sensei', 'gate'); fs.mkdirSync(d, { recursive: true }); out = path.join(d, `verify-${name}.json`); fs.writeFileSync(out, JSON.stringify({ gate: `verify-${name}`, at: new Date().toISOString(), ...body }, null, 2) + '\n'); }
console.log(`\n${'-'.repeat(60)}`);
for (const c of checks) console.log(`${c.status.toUpperCase().padEnd(13)} ${c.id.padEnd(14)} ${c.detail}`);
console.log(`${'-'.repeat(60)}\nVerdict: ${verdict.toUpperCase()}\nCombined report (read by the Stop hook): ${out}`);
process.exit(verdict === 'fail' ? 1 : 0);
