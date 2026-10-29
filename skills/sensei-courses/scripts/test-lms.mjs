// test-lms.mjs: tests lms.js against strict mock LMSs (SCORM 1.2 and 2004 in a parent frame that enforce call order and
// the data-model formats and limits), a cmi5 LRS on another origin, a cross-origin parent and standalone; then runs
// pack_lms.py --selftest (python from PYTHON, else python3 or python on PATH).
//
//   node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-courses/scripts/test-lms.mjs
//
// verified: Windows 10, Node 24, playwright-core 1.62.1, installed Chrome 155, Python 3: every check passes.
// not verified: any real LMS or LRS.
// Origin: code-apps/test-lms.cjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), ported to ESM.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, checker } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lmsJs = fs.readFileSync(path.join(HERE, 'lms.js'), 'utf8');
const { ok: check, summary } = checker();
const L = { check };

// ---------- mock SCORM APIs (strict: they enforce call order and the data-model limits) ----------
const mockApiSrc = `
(function(){
  var log = [], store = {}, state = 'not initialized', lastErr = '0';
  window.__log = log; window.__store = store;
  function rec(m, k, v, r){ log.push([m,k,v,r]); return r; }
  var V12 = { 'cmi.core.lesson_status': /^(passed|completed|failed|incomplete|browsed|not attempted)$/, 'cmi.suspend_data': /^[\\s\\S]{0,4096}$/, 'cmi.core.lesson_location': /^[\\s\\S]{0,255}$/,
              'cmi.core.score.raw': /^(100|\\d{1,2}(\\.\\d+)?)$/, 'cmi.core.score.min': /^\\d+$/, 'cmi.core.score.max': /^\\d+$/,
              'cmi.core.session_time': /^\\d{4}:\\d{2}:\\d{2}(\\.\\d{1,2})?$/, 'cmi.core.exit': /^(time-out|suspend|logout|)$/ };
  var V04 = { 'cmi.completion_status': /^(completed|incomplete|not attempted|unknown)$/, 'cmi.success_status': /^(passed|failed|unknown)$/, 'cmi.suspend_data': /^[\\s\\S]{0,64000}$/,
              'cmi.score.scaled': /^-?(0|1)(\\.\\d+)?$/, 'cmi.score.raw': /^\\d+(\\.\\d+)?$/, 'cmi.score.min': /^\\d+$/, 'cmi.score.max': /^\\d+$/,
              'cmi.session_time': /^P(T(\\d+H)?(\\d+M)?(\\d+(\\.\\d{1,2})?S)?)$/, 'cmi.exit': /^(time-out|suspend|logout|normal|)$/, 'cmi.location': /^[\\s\\S]{0,1000}$/ };
  function mk(v2004){
    var V = v2004 ? V04 : V12, seed = window.__seed || {};
    return {
      init: function(){ if (state !== 'not initialized') { lastErr = '103'; return rec('init','','', 'false'); } state = 'running'; Object.keys(seed).forEach(function(k){ store[k] = seed[k]; }); return rec('init','','', 'true'); },
      set: function(k, v){ if (state !== 'running') { lastErr = '132'; return rec('set',k,v,'false'); } if (V[k] && !V[k].test(v)) { lastErr = '406'; return rec('set',k,v,'false'); } store[k] = v; return rec('set',k,v,'true'); },
      get: function(k){ if (state !== 'running') { lastErr = '122'; return ''; } return rec('get',k,'', store[k] == null ? '' : store[k]); },
      commit: function(){ if (state !== 'running') return 'false'; return rec('commit','','', 'true'); },
      term: function(){ if (state !== 'running') return 'false'; state = 'terminated'; return rec('term','','', 'true'); },
      err: function(){ return lastErr; }
    };
  }
  var m = mk(window.__v2004);
  if (window.__v2004) window.API_1484_11 = { Initialize: m.init, SetValue: m.set, GetValue: m.get, Commit: m.commit, Terminate: m.term, GetLastError: m.err, GetErrorString: function(){return ''}, GetDiagnostic: function(){return ''} };
  else window.API = { LMSInitialize: m.init, LMSSetValue: m.set, LMSGetValue: m.get, LMSCommit: m.commit, LMSFinish: m.term, LMSGetLastError: m.err, LMSGetErrorString: function(){return ''}, LMSGetDiagnostic: function(){return ''} };
})();`;
const host = (v2004, seed, src = "/sco.html") => `<!doctype html><html><body><script>window.__v2004=${v2004};window.__seed=${JSON.stringify(seed || {})};</script><script>${mockApiSrc}</script><iframe id="f" src="${src}"></iframe></body></html>`;
const sco = `<!doctype html><html><body><script>${lmsJs}</script><script>LMS.connect().then(function(s){window.__s=s;window.__ready=true;});</script></body></html>`;

// ---------- cmi5 LRS on its own port (cross-origin => CORS must work) ----------
const lrs = { statements: [], fetchCalls: 0, headersSeen: [] };
const lrsSrv = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Experience-API-Version', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = ''; req.on('data', (d) => body += d); req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/fetch') { lrs.fetchCalls++; if (lrs.fetchCalls > 1) { res.writeHead(401, cors); return res.end('{"error-text":"already used"}'); } res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ 'auth-token': Buffer.from('tok:en').toString('base64') })); }
    lrs.headersSeen.push({ p: u.pathname, auth: req.headers.authorization, v: req.headers['x-experience-api-version'] });
    if (req.headers.authorization !== 'Basic ' + Buffer.from('tok:en').toString('base64')) { res.writeHead(401, cors); return res.end(); }
    if (u.pathname === '/xapi/activities/state') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ contextTemplate: { contextActivities: { grouping: [{ id: 'http://example.com/course' }] }, extensions: { 'https://w3id.org/xapi/cmi5/context/extensions/sessionid': 'lms-session-1', 'x-lms': 'kept' } }, launchMode: 'Normal', masteryScore: 0.7, moveOn: 'CompletedAndPassed' })); }
    if (u.pathname === '/xapi/statements') { lrs.statements.push(JSON.parse(body)); res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end('["ok"]'); }
    res.writeHead(404, cors); res.end();
  });
});
// ---------- content server ----------
let pages = {};
const web = http.createServer((req, res) => { const p = pages[req.url.split('?')[0]]; if (!p) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(p); });

(async () => {
  await new Promise((r) => lrsSrv.listen(0, '127.0.0.1', r)); await new Promise((r) => web.listen(0, '127.0.0.1', r));
  const lrsPort = lrsSrv.address().port, webPort = web.address().port, base = 'http://127.0.0.1:' + webPort;
  const { browser: b } = await launch(); const errs = [];
  const open = async (hostHtml, scoUrl = '/sco.html') => { pages['/host.html'] = hostHtml; pages['/sco.html'] = sco; const c = await b.newContext(); const p = await c.newPage(); p.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); }); await p.goto(base + '/host.html'); const fr = p.frame({ url: /sco\.html/ }) || (await (await p.$('#f')).contentFrame()); await fr.waitForFunction(() => window.__ready); return { c, p, fr }; };

  // ---- SCORM 2004 ----
  let { c, p, fr } = await open(host(true, { 'cmi.location': 'lesson-3', 'cmi.suspend_data': '{"a":1}' }));
  let kind = await fr.evaluate(() => [__s.kind, __s.resume]);
  L.check('2004: found API_1484_11 through the parent frame, read bookmark and suspend_data', kind[0] === 'scorm2004' && kind[1].location === 'lesson-3' && kind[1].suspend === '{"a":1}', kind);
  await fr.evaluate(() => __s.progress({ location: 'lesson-4', suspend: '{"a":2}', scoreRaw: 80, completed: true, passed: true }));
  await fr.evaluate(() => __s.finish(false));
  let st = await p.evaluate(() => window.__store), lg = await p.evaluate(() => window.__log.map((x) => x[0]));
  L.check('2004: completion, success, raw and scaled score stored; no setter was rejected', st['cmi.completion_status'] === 'completed' && st['cmi.success_status'] === 'passed' && st['cmi.score.raw'] === '80' && st['cmi.score.scaled'] === '0.8000' && !(await p.evaluate(() => window.__log.some((x) => x[0] === 'set' && x[3] === 'false'))), st);
  L.check('2004: session_time is an ISO 8601 duration and exit is normal', /^PT\d+H\d+M[\d.]+S$/.test(st['cmi.session_time']) && st['cmi.exit'] === 'normal', [st['cmi.session_time'], st['cmi.exit']]);
  L.check('2004: call order is Initialize ... Commit, Terminate last, nothing after', lg[0] === 'init' && lg[lg.length - 1] === 'term' && lg[lg.length - 2] === 'commit' && lg.filter((x) => x === 'term').length === 1, lg.join());
  const after = await fr.evaluate(() => __s.progress({ scoreRaw: 10 }));
  L.check('after finish(), further progress calls are ignored (no call after Terminate)', after === false);
  await c.close();

  // ---- SCORM 2004: resume must not downgrade ----
  ({ c, p, fr } = await open(host(true, { 'cmi.completion_status': 'completed', 'cmi.success_status': 'passed' })));
  await fr.evaluate(() => __s.finish(false)); st = await p.evaluate(() => window.__store);
  L.check('2004: re-opening a completed attempt keeps completed (no downgrade to incomplete)', st['cmi.completion_status'] === 'completed');
  await c.close();

  // ---- SCORM 1.2 ----
  ({ c, p, fr } = await open(host(false, { 'cmi.core.lesson_location': 'p9', 'cmi.student_data.mastery_score': '70' })));
  kind = await fr.evaluate(() => [__s.kind, __s.resume.location, __s.resume.mastery, __s.limits.suspend]);
  L.check('1.2: found API, bookmark and mastery score read, suspend limit 4096', kind[0] === 'scorm12' && kind[1] === 'p9' && kind[2] === '70' && kind[3] === 4096, kind);
  await fr.evaluate(() => __s.progress({ scoreRaw: 85, completed: true }));
  st = await p.evaluate(() => window.__store);
  L.check('1.2: completed (without passed) writes lesson_status completed', st['cmi.core.lesson_status'] === 'completed', st['cmi.core.lesson_status']);
  await fr.evaluate(() => __s.progress({ scoreRaw: 85, completed: true, passed: true }));
  await fr.evaluate(() => __s.progress({ completed: true }));
  st = await p.evaluate(() => window.__store);
  L.check('1.2: passed wins over completed and a later completed does not overwrite it', st['cmi.core.lesson_status'] === 'passed', st['cmi.core.lesson_status']);
  await fr.evaluate(() => __s.progress({ suspend: 'x'.repeat(5000) }));
  const susp = (await p.evaluate(() => window.__store))['cmi.suspend_data'];
  L.check('1.2: oversized suspend_data is refused client-side (limit 4096), nothing written', susp === undefined, susp ? susp.length : 'not written');
  await fr.evaluate(() => __s.finish(true)); st = await p.evaluate(() => window.__store);
  L.check('1.2: session_time is HHHH:MM:SS.SS and exit=suspend when asked', /^\d{4}:\d{2}:\d{2}\.\d{2}$/.test(st['cmi.core.session_time']) && st['cmi.core.exit'] === 'suspend', [st['cmi.core.session_time'], st['cmi.core.exit']]);
  L.check('1.2: no setter was rejected by the strict mock', !(await p.evaluate(() => window.__log.some((x) => x[0] === 'set' && x[3] === 'false'))));
  await c.close();

  // ---- cross-origin parent (the LMS on one origin, content on another): must degrade, not throw ----
  pages['/host2.html'] = host(true, {}, `http://localhost:${webPort}/sco.html`);
  const c2 = await b.newContext(); const p2 = await c2.newPage(); p2.on('pageerror', (e) => errs.push('xo ' + e.message)); await p2.goto(base + '/host2.html');
  const fr2 = await (await p2.$('#f')).contentFrame(); await fr2.waitForFunction(() => window.__ready);
  L.check('cross-origin parent: adapter falls back to standalone without an exception (SCORM requires same origin)', (await fr2.evaluate(() => __s.kind)) === 'none');
  await c2.close();

  // ---- standalone ----
  pages['/sco.html'] = sco; const c3 = await b.newContext(); const p3 = await c3.newPage(); await p3.goto(base + '/sco.html'); await p3.waitForFunction(() => window.__ready);
  L.check('standalone (no LMS): kind none, progress() is a harmless no-op', (await p3.evaluate(() => [__s.kind, __s.progress({ scoreRaw: 1 })])).join() === 'none,false');
  await c3.close();

  // ---- cmi5 ----
  const actor = JSON.stringify({ objectType: 'Agent', account: { homePage: 'http://example.com', name: 'learner-1' } });
  const q = new URLSearchParams({ endpoint: `http://127.0.0.1:${lrsPort}/xapi`, fetch: `http://127.0.0.1:${lrsPort}/fetch`, actor, registration: '11111111-2222-4333-8444-555555555555', activityId: 'http://example.com/course/au1' });
  pages['/cmi5.html'] = sco;
  const c4 = await b.newContext(); const p4 = await c4.newPage(); p4.on('pageerror', (e) => errs.push('cmi5 ' + e.message));
  await p4.goto(base + '/cmi5.html?' + q.toString()); await p4.waitForFunction(() => window.__ready);
  L.check('cmi5: fetched the auth token once (single-use URL), read LMS.LaunchData, sent "initialized"', lrs.fetchCalls === 1 && lrs.statements.length === 1 && /initialized/.test(lrs.statements[0].verb.id), { fetchCalls: lrs.fetchCalls, n: lrs.statements.length });
  await p4.evaluate(() => __s.progress({ scoreRaw: 85, completed: true, passed: true }));
  await p4.evaluate(() => __s.progress({ scoreRaw: 90, completed: true, passed: true })); // duplicate: must not send twice
  await p4.evaluate(() => __s.finish());
  const verbs = lrs.statements.map((s) => s.verb.id.split('/').pop());
  L.check('cmi5: statement order initialized, passed, completed, terminated, each once', verbs.join() === 'initialized,passed,completed,terminated', verbs.join());
  const sPass = lrs.statements[1], sInit = lrs.statements[0];
  L.check('cmi5 passed: scaled score 0.85, success true, ISO duration', sPass.result.score.scaled === 0.85 && sPass.result.success === true && /^PT/.test(sPass.result.duration), sPass.result);
  L.check('cmi5: every statement has registration, cmi5 category, one session id; LMS context template merged (grouping, extension kept)',
    lrs.statements.every((s) => s.context.registration === '11111111-2222-4333-8444-555555555555' && s.context.contextActivities.category[0].id.endsWith('categories/cmi5')) &&
    new Set(lrs.statements.map((s) => s.context.extensions['https://w3id.org/xapi/cmi5/context/extensions/sessionid'])).size === 1 && lrs.statements[0].context.extensions['https://w3id.org/xapi/cmi5/context/extensions/sessionid'] === 'lms-session-1' && sInit.context.contextActivities.grouping[0].id === 'http://example.com/course' && sInit.context.extensions['x-lms'] === 'kept');
  L.check('cmi5: Basic auth and X-Experience-API-Version on every LRS call', lrs.headersSeen.length >= 5 && lrs.headersSeen.every((h) => /^Basic /.test(h.auth) && h.v === '1.0.3'), lrs.headersSeen.length);
  await c4.close();
  L.check('no page errors', errs.length === 0, errs);
  await b.close(); lrsSrv.close(); web.close();
  const py = [process.env.PYTHON, 'python3', 'python'].filter(Boolean).find((c) => { try { return spawnSync(c, ['--version']).status === 0; } catch { return false; } });
  if (!py) console.log('SKIP  pack_lms.py --selftest (no Python found: set PYTHON)');
  else {
    const r = spawnSync(py, ['-I', path.join(HERE, 'pack_lms.py'), '--selftest'], { encoding: 'utf8' });
    L.check('pack_lms.py --selftest: SCORM 1.2, SCORM 2004 and cmi5 manifests valid at the zip root', r.status === 0 && (r.stdout.match(/^PASS/gm) || []).length === 3, (r.stdout + r.stderr).trim().replace(/\s+/g, ' '));
  }
  process.exitCode = summary();
})().catch((e) => { console.error(e); process.exit(1); });
