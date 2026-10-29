// test-gate.mjs: the gate tests itself, and proves the plugin's Stop hook reads what the gate writes. A gate that
// passes a bad page, or fails a good one, is worse than no gate.
//
//   node test-gate.mjs          (needs Playwright and a Chromium-family browser, found by discovery or SENSEI_PW /
//                                PW and SENSEI_CHROME / CHROME; axe-core optional: its assertions are skipped without it)
//
// Everything runs in scratch projects in one new folder under the OS temp folder (sensei-verify-test-*), removed when
// every assertion passes and kept, with its path printed, when one fails. Sections:
//   1. fixtures/bad-page.html fails, for each named reason; the hook-format report says fail
//   2. fixtures/no-ring.html: the focus-ring pixel test flags it while axe passes it
//   3. fixtures/good-page.html passes every check over file:// and http://, and the two protocols agree
//   4. gate-fresh.mjs: fresh after a pass, stale after the page changes, stale on a failing report, missing report
//   5. the real hooks/gate-claim.mjs: lets "done" through after a passing gate, blocks it after a failing one
//   6. verify.mjs on fixtures/gl-seek.html runs the page gate and sensei-3d's gate3d and writes the combined report last
//   7. verify.mjs forwards page-gate options given without `--` (--steps, --strict), fails on failing steps, keeps the
//      `--` form, exits 2 on an unknown option or a missing steps file; the page gate exits 2 on an unknown option
//   8. steps start from a fresh load of the target after routes; --steps-after-routes chains them
//
// verified: Windows 10, Node 24.16, installed Chrome 156 via playwright-core 1.64.1, axe-core 4.14.0: 45 of 45 pass.
// not verified: macOS, Linux, other browsers.
// Origin: ported from code-engineering/test-gate.mjs (17 assertions) in the HTML-Sensei build project's research
// notes, not shipped; extended for the plugin.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runGate } from './sensei-gate.mjs';
import { findAxe } from './lib/discover.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.resolve(HERE, '..', 'fixtures');
const PLUGIN = path.resolve(HERE, '..', '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sensei-verify-test-'));
process.env.CLAUDE_PLUGIN_DATA = path.join(TMP, 'plugin-data');
let fails = 0;
const check = (n, ok, d) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? '  [' + String(d).slice(0, 160) + ']' : '')); };
const hasAxe = !!findAxe([HERE]);
const base = { widths: [375, 1024], height: 800, settle: 400, noFull: true };
const by = (out, id) => out.results.find(r => r.id === id) || { status: 'missing', summary: 'missing' };
const mkProject = (n, profile = { deliverable: 'single-file' }) => {
  const d = path.join(TMP, n); fs.mkdirSync(path.join(d, '.sensei'), { recursive: true });
  if (profile) fs.writeFileSync(path.join(d, '.sensei', 'profile.json'), JSON.stringify(profile, null, 2));
  return d;
};
// The copy gets the current time: copyFileSync keeps the source's mtime on Windows, and a fixture stamped in the
// future (a clock that moved back, found while testing) would look like an edit newer than every report.
const place = (proj, name) => { const f = path.join(proj, name); fs.copyFileSync(path.join(FX, name), f); const now = new Date(); fs.utimesSync(f, now, now); return f; };
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
if (!hasAxe) console.log('note: axe-core not found, axe assertions skipped (npm i axe-core, or set SENSEI_AXE)');

// 1. the bad fixture must fail for the right reasons
{
  const p = mkProject('bad');
  const { out, reportPath } = await runGate({ ...base, _: [place(p, 'bad-page.html')], project: p, checks: 'load,net,hygiene,shots,canvas,motion,forced,keys,reflow,storage' + (hasAxe ? ',axe' : '') });
  check('bad page: verdict fail', out.verdict === 'fail');
  check('bad page: console error caught', by(out, 'console-errors').status === 'fail');
  check('bad page: uncaught exception caught', by(out, 'page-errors').status === 'fail');
  check('bad page: external request caught (and blocked)', by(out, 'offline-self-contained').status === 'fail');
  check('bad page: broken image caught', by(out, 'request-failures').status === 'fail');
  check('bad page: blank WebGL canvas caught by pixels', by(out, 'canvas-pixels').status === 'fail');
  check('bad page: reduced-motion violation caught', by(out, 'reduced-motion').status === 'warn');
  check('bad page: shapeless control in forced colours caught', by(out, 'forced-colors').status === 'warn');
  check('bad page: pointer-only control caught', /pointer-only/.test(by(out, 'keyboard').summary), by(out, 'keyboard').summary);
  check('bad page: reflow overflow caught', by(out, 'reflow-400pc').status === 'warn');
  check('bad page: quirks mode and missing lang caught', /quirks/.test(by(out, 'hygiene').summary) && /lang/.test(by(out, 'hygiene').summary));
  check('bad page: weight is information, never a failure', by(out, 'weight').status === 'info');
  if (hasAxe) check('bad page: axe finds critical violations', by(out, 'axe-desktop').status === 'fail');
  const rep = readJson(reportPath);
  check('bad page: hook report at .sensei/gate/<name>.json', reportPath === path.join(p, '.sensei', 'gate', 'bad-page-html.json'), reportPath);
  check('bad page: hook report verdict fail, statuses in the plugin vocabulary', rep.verdict === 'fail' && rep.checks.every(c => ['pass', 'fail', 'warn', 'skip', 'not-verified'].includes(c.status)) && rep.checks.some(c => c.status === 'fail'));
  check('bad page: hook report carries verified and not_verified lists', Array.isArray(rep.verified) && rep.not_verified.length >= 7);
}
// 2. the focus-ring fixture: axe passes, the pixel test must still flag it
{
  const p = mkProject('noring');
  const { out } = await runGate({ ...base, _: [place(p, 'no-ring.html')], project: p, checks: 'keys' + (hasAxe ? ',axe' : '') });
  check('no-ring page: missing focus indicator caught', /no visible focus change/.test(by(out, 'keyboard').summary), by(out, 'keyboard').summary);
  if (hasAxe) check('no-ring page: axe alone passes it (why the pixel test exists)', by(out, 'axe-desktop').status === 'pass');
}
// 3. the good fixture must pass every check over both protocols
let goodProject, goodPage;
{
  goodProject = mkProject('good'); goodPage = place(goodProject, 'good-page.html');
  const { out, reportPath } = await runGate({ ...base, _: [goodPage], project: goodProject, mode: 'both' });
  const bad = out.results.filter(r => r.status === 'fail' || r.status === 'warn').map(r => `${r.id}: ${r.summary}`);
  check('good page: verdict pass over file:// and http:// (no fail, no warn)', out.verdict === 'pass', bad.join(' | '));
  check('good page: canvas has content and moves', by(out, 'file:canvas-pixels').status === 'pass' && /1 of 1/.test(by(out, 'file:canvas-motion').summary));
  check('good page: calm under reduced motion', by(out, 'file:reduced-motion').status === 'pass');
  check('good page: file and http agree', by(out, 'file-vs-http').status === 'pass');
  if (hasAxe) check('good page: axe clean on mobile, desktop and dark', ['axe-mobile', 'axe-desktop', 'axe-dark'].every(k => by(out, 'file:' + k).status === 'pass'));
  check('good page: hook report verdict pass', readJson(reportPath).verdict === 'pass');
  check('good page: contact sheet written', !!readJson(reportPath).contactSheet && fs.existsSync(readJson(reportPath).contactSheet));
}
// 4. gate-fresh.mjs
{
  const fresh = (arg) => spawnSync(process.execPath, [path.join(HERE, 'gate-fresh.mjs'), ...(arg ? [arg] : [])], { cwd: goodProject, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: '' } });
  check('gate-fresh: fresh right after a passing gate', fresh().status === 0, fresh().stdout);
  fs.appendFileSync(goodPage, '<!-- changed -->\n');
  check('gate-fresh: stale after the page changes', fresh().status === 1 && /changed/.test(fresh().stdout));
  check('gate-fresh: stale on a failing report', fresh(path.join(TMP, 'bad', '.sensei', 'gate', 'bad-page-html.json')).status === 1);
  check('gate-fresh: missing report is stale', fresh(path.join(TMP, 'nowhere')).status === 1);
}
// 5. the real Stop hook reads the gate's report
{
  const { recordEdit } = await import(pathToFileURL(path.join(PLUGIN, 'lib', 'state.mjs')).href);
  const hook = (project, sid, msg) => spawnSync(process.execPath, [path.join(PLUGIN, 'hooks', 'gate-claim.mjs')], {
    input: JSON.stringify({ hook_event_name: 'Stop', session_id: sid, cwd: project, stop_hook_active: false, last_assistant_message: msg, transcript_path: path.join(TMP, 'none.jsonl') }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: project, CLAUDE_PLUGIN_ROOT: PLUGIN }, encoding: 'utf8', timeout: 60000 });
  const p = mkProject('hook');
  const page = place(p, 'good-page.html');
  recordEdit(p, 'h1', page);
  const before = hook(p, 'h1', 'The page is finished and ready to ship.');
  check('hook: "done" with no gate report is blocked', before.status === 2 && /no gate report/.test(before.stderr), before.stderr);
  recordEdit(p, 'h2', page);
  await new Promise(r => setTimeout(r, 30));
  await runGate({ ...base, _: [page], project: p, checks: 'load,net,hygiene,canvas' });
  const after = hook(p, 'h2', 'All done: every check passed.');
  check('hook: "done" after a passing gate run is let through', after.status === 0 && !after.stdout.trim(), `exit ${after.status} ${after.stderr}`);
  const badPage = place(p, 'bad-page.html');
  recordEdit(p, 'h3', badPage);
  await new Promise(r => setTimeout(r, 30));
  await runGate({ ...base, _: [badPage], project: p, checks: 'load,net,canvas' });
  const failed = hook(p, 'h3', 'Finished.');
  check('hook: "done" after a failing gate run is blocked', failed.status === 2 && /failed/.test(failed.stderr), `exit ${failed.status} ${failed.stderr}`);
}
// 6. the umbrella: page gate plus gate3d on a WebGL seek page; the combined report is the newest one
{
  const p = mkProject('umbrella');
  const page = place(p, 'gl-seek.html');
  const r = spawnSync(process.execPath, [path.join(HERE, 'verify.mjs'), page, '--project', p, '--quick'], { encoding: 'utf8', timeout: 600000 });
  const gateDir = path.join(p, '.sensei', 'gate');
  const combined = path.join(gateDir, 'verify-gl-seek-html.json');
  const ok = fs.existsSync(combined);
  const rep = ok ? readJson(combined) : {};
  check('verify: exit 0 and combined report written', r.status === 0 && ok, (r.stdout || '').slice(-400) + (r.stderr || '').slice(-300));
  check('verify: ran the page gate and sensei-3d gate3d', ok && rep.plan.join(',') === 'page,3d' && rep.checks.every(c => c.status === 'pass' || c.status === 'warn'), ok && JSON.stringify(rep.checks));
  const newest = fs.readdirSync(gateDir).filter(n => n.endsWith('.json')).map(n => ({ n, t: fs.statSync(path.join(gateDir, n)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
  check('verify: the combined report is the newest, so the Stop hook reads it', newest && newest.n === 'verify-gl-seek-html.json', newest && newest.n);
}
// 7. the umbrella forwards page-gate options given without `--` (QC finding 1), and refuses unknown ones
{
  const p = mkProject('forward');
  const page = place(p, 'good-page.html');
  const verify = (...a) => spawnSync(process.execPath, [path.join(HERE, 'verify.mjs'), page, '--project', p, ...a], { encoding: 'utf8', timeout: 300000 });
  const pageRep = () => { try { return readJson(path.join(p, '.sensei', 'gate', 'good-page-html.json')); } catch { return {}; } };
  const combined = () => { try { return readJson(path.join(p, '.sensei', 'gate', 'verify-good-page-html.json')); } catch { return {}; } };
  const stepCheck = rep => (rep.checks || []).find(c => c.id === 'steps') || {};

  const failRun = verify('--steps', path.join(FX, 'steps-fail.json'), '--checks', 'load', '--widths', '800');
  check('verify: --steps without -- runs the steps, and failing steps fail the umbrella (exit 1)', failRun.status === 1 && stepCheck(pageRep()).status === 'fail' && combined().verdict === 'fail', `exit ${failRun.status} ${JSON.stringify(stepCheck(pageRep()))} ${(failRun.stderr || '').slice(-200)}`);
  check('verify: the header and the combined report list the forwarded options', /page-gate options: --steps .*steps-fail\.json --checks load/.test(failRun.stdout) && (combined().page_options || []).includes('--steps'), (failRun.stdout || '').slice(0, 400));

  const passRun = verify('--steps', path.join(FX, 'steps-pass.json'), '--checks', 'load', '--widths', '800', '--strict');
  check('verify: --steps and --strict without -- run and pass on a passing steps file', passRun.status === 0 && stepCheck(pageRep()).status === 'pass' && /3 scripted step/.test(stepCheck(pageRep()).detail || ''), `exit ${passRun.status} ${JSON.stringify(stepCheck(pageRep()))}`);

  const ddRun = verify('--', '--steps', path.join(FX, 'steps-fail.json'), '--checks', 'load', '--widths', '800');
  check('verify: the old `--` form still forwards', ddRun.status === 1 && stepCheck(pageRep()).status === 'fail', `exit ${ddRun.status}`);

  const before = fs.readdirSync(path.join(p, '.sensei', 'gate')).length;
  const unknown = verify('--stepz', path.join(FX, 'steps-fail.json'));
  check('verify: an unknown option exits 2 with a clear message and runs nothing', unknown.status === 2 && /unknown option --stepz/.test(unknown.stderr) && fs.readdirSync(path.join(p, '.sensei', 'gate')).length === before, `exit ${unknown.status} ${unknown.stderr}`);
  const missing = verify('--steps', path.join(FX, 'no-such-steps.json'));
  check('verify: a missing steps file exits 2', missing.status === 2 && /steps file not found/.test(missing.stderr), `exit ${missing.status} ${missing.stderr}`);
  const gateUnknown = spawnSync(process.execPath, [path.join(HERE, 'sensei-gate.mjs'), page, '--project', p, '--stepz', 'x.json'], { encoding: 'utf8', timeout: 60000 });
  check('page gate: an unknown option exits 2', gateUnknown.status === 2 && /unknown option --stepz/.test(gateUnknown.stderr), `exit ${gateUnknown.status} ${gateUnknown.stderr}`);
}
// 8. steps start from a fresh load of the target after routes (QC finding 14); --steps-after-routes keeps the old order
{
  const p = mkProject('routes-steps');
  const page = place(p, 'good-page.html');
  const run = extra => runGate({ ...base, widths: [800], _: [page], project: p, checks: 'load', routes: '?lang=fa,click:#toggle', steps: path.join(FX, 'steps-fresh.json'), ...extra });
  const fresh = (await run({})).out;
  check('routes then steps: steps start from a fresh load (no query, toggle not pressed)', by(fresh, 'steps').status === 'pass' && /fresh load/.test(by(fresh, 'steps').summary), by(fresh, 'steps').summary);
  check('routes then steps: the routes themselves ran', by(fresh, 'route-lang-fa').status === 'pass' && by(fresh, 'route-click-toggle').status === 'pass', JSON.stringify(fresh.results.filter(r => r.id.startsWith('route')).map(r => r.id + ':' + r.status)));
  const chained = (await run({ stepsAfterRoutes: true })).out;
  check('--steps-after-routes: steps see the state the routes left (both evals fail here, as they should)', by(chained, 'steps').status === 'fail' && /2 of 2/.test(by(chained, 'steps').summary), by(chained, 'steps').summary);
}
// Scratch: removed when every assertion passes; kept (and named) when one fails, so the reports can be read.
if (!fails) fs.rmSync(TMP, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED (scratch kept for inspection: ${TMP})` : `\nALL PASSED (scratch removed: ${TMP})`);
process.exit(fails ? 1 : 0);
