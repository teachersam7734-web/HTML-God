#!/usr/bin/env node
// sensei-gate.mjs: the HTML-Sensei verification gate. One command, one report, honest about what it cannot see.
//
//   node sensei-gate.mjs <page.html | folder | http(s)://url> [options]
//
// Where the report goes (the format the Stop hook gate-claim.mjs reads, through plugin/lib/gate.mjs):
//   <project>/.sensei/gate/<name>.json   { gate, target, at, verdict: pass|warn|fail, checks: [{id, status, detail}],
//                                          verified: [], not_verified: [], ...the full gate fields }
//   <project>/.sensei/gate/<name>/       screenshots, contact sheet, ARIA tree, report.json (full), report.md
//   <project> is --project, else CLAUDE_PROJECT_DIR, else the current folder. <name> is --name, else from the target.
//
//   --project DIR        project root whose .sensei/gate/ the Stop hook reads (default CLAUDE_PROJECT_DIR or cwd)
//   --name ID            report name (default: the target's file or host name, slugged)
//   --out DIR            artefact folder (default <project>/.sensei/gate/<name>)
//   --stamp FILE         also write a copy of the hook report here
//   --mode file|http|both   how to open a file target (default: file for a file, http for a folder). both = diff the two.
//   --widths 375,768,1440   screenshot widths (default: the profile's verify.widths, else 375,768,1440)
//   --height 900         viewport height
//   --checks a,b,c       subset of: load,hygiene,shots,canvas,motion,forced,axe,keys,reflow,storage,perf,net (default all)
//   --routes "#/a,#/b,?x=1,click:#menu"   extra states to open and screenshot; each is checked for new errors
//   --steps FILE.json    scripted interaction: [{"do":"click","sel":"#go"},{"do":"press","key":"Escape"},{"do":"wait","ms":300},
//                        {"do":"shot","name":"menu"},{"do":"eval","expr":"document.title","expect":"Hello"}]
//                        Steps start from a fresh load of the target, after any routes, in a new browser context
//                        (storage and the URL the routes changed do not carry over). A missing or malformed file: exit 2.
//   --steps-after-routes the old order: steps continue on the page the last route left (use to script a flow that
//                        starts from a route's state)
//   --wait-for EXPR      JS expression that becomes truthy when the page is ready (default: window.__done if the page defines it)
//   --settle MS          extra wait after ready (default 800)
//   --allow-external     external requests warn instead of fail (default: fail; also implied by "offline": false in the profile)
//   --expect-text "A|B"  strings that must appear in the rendered text
//   --expect-motion      fail if nothing on the page moves (a "live" background that is static)
//   --lenient-file       launch with --allow-file-access-from-files (hides file:// failures; default is the strict, double-click-like mode)
//   --gpu                do not force software GL (use on a machine with a real GPU; timings only mean something then)
//   --axe-path FILE      path to axe.min.js (default: SENSEI_AXE, then node_modules, then the global npm root)
//   --strict             warnings fail the gate (weight never does: it is information, owner rule, no budget)
//   --isolated           serve with COOP/COEP headers (cross-origin isolation) in http mode
//   --json               print the full JSON report on stdout instead of the table
//
// Exit codes: 0 verdict pass or warn, 1 verdict fail, 2 the harness itself could not run (including an unknown option,
// an option with no value, or a missing steps file: nothing is silently ignored).
// Discovery: Playwright from SENSEI_PW or PW, else node_modules up from the cwd and the target, else the global npm root;
// the browser from SENSEI_CHROME, CHROME or CHROME_PATH, else installed Chrome or Edge, else Playwright's own build.
//
// verified: Windows 10, Node 24.16, installed Chrome 156 via playwright-core 1.64.1, axe-core 4.14.0, software GL, strict
//           file:// (last full run 2026-10-28; first run with playwright-core 1.62):
//           test-gate.mjs (bad fixture fails for each named reason, no-ring fixture caught while axe passes, good fixture
//           passes every check over file:// and http://, the report is read by the real gate-claim Stop hook).
//           The research version of this gate was also run on a landing page, a WebGL raymarch page and the 83 MB
//           Ultra Bookworm file (domain-verification-harness.md in the HTML-Sensei build project's research notes (not shipped)).
// not verified: Firefox and Safari (Chromium only); macOS and Linux runs (discovery paths are written, not run);
//           real-GPU frame rates; screen reader output; anything listed in NOT_CHECKED below.
// Origin: code-engineering/sensei-gate.mjs in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code); adapted here to write the
// plugin's gate report format and to read the project profile.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { launch, findAxe, fileUrl } from './lib/discover.mjs';
import { serve } from './lib/server.mjs';
import * as P from './lib/inpage.mjs';
import { PAGE_VALUE_OPTS, PAGE_FLAGS, parseOptions, OptionError } from './lib/gate-options.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = { name: 'sensei-gate', schema: 2 };
const PLUGIN_LIB = path.resolve(HERE, '..', '..', '..', 'lib');

// The plugin's shared modules: the gate report writer the Stop hook reads, and the profile reader. Imported, not
// copied, so the gate and the hook can never drift apart. Fallbacks keep the gate usable outside the plugin.
async function pluginLib() {
  const lib = {};
  try { lib.gate = await import(pathToFileURL(path.join(PLUGIN_LIB, 'gate.mjs')).href); } catch { lib.gate = null; }
  try { lib.profile = await import(pathToFileURL(path.join(PLUGIN_LIB, 'profile.mjs')).href); } catch { lib.profile = null; }
  return lib;
}
export function projectRoot(opts = {}) {
  return path.resolve(opts.project || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

// ---------- args ----------
function parseArgs(argv) {
  const o = { widths: null, height: 900, settle: 800, checks: null, mode: null, ...parseOptions(argv, PAGE_VALUE_OPTS, PAGE_FLAGS) };
  if (o.widths) o.widths = String(o.widths).split(',').map(Number).filter(Boolean);
  o.height = +o.height; o.settle = +o.settle;
  return o;
}

const ALL = ['load', 'hygiene', 'shots', 'canvas', 'motion', 'forced', 'axe', 'keys', 'reflow', 'storage', 'perf', 'net'];
const NOT_CHECKED = [
  'What a screen reader actually says (NVDA, JAWS, VoiceOver, TalkBack): axe checks structure, not the spoken result.',
  'Whether alt text, link text and headings are meaningful (only that they exist).',
  'Real-device frame rate, thermals and memory: software GL numbers are relative, not target-device numbers.',
  'Firefox and Safari behaviour: this gate drives Chromium only.',
  'Colour-vision deficiency, text over photographs and gradients (contrast on image backgrounds is "incomplete" in axe).',
  'Flashing content against the three-flashes threshold, vestibular comfort, audio loudness.',
  'Whether the design is good. Look at the contact sheet.',
];

// ---------- helpers ----------
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const slug = s => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 48) || 'page';
function newestMtime(dir, limit = 5000) {
  let newest = 0, n = 0; const stack = [dir];
  while (stack.length && n < limit) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p); else { n++; newest = Math.max(newest, fs.statSync(p).mtimeMs); }
    }
  }
  return newest;
}

class Report {
  constructor(meta) { this.meta = meta; this.results = []; this.artefacts = []; }
  add(id, status, summary, data) { this.results.push({ id, status, summary, ...(data !== undefined ? { data } : {}) }); }
  get fails() { return this.results.filter(r => r.status === 'fail'); }
  get warns() { return this.results.filter(r => r.status === 'warn'); }
}

// ---------- main ----------
export async function runGate(opts) {
  const t0 = Date.now();
  const target = opts._[0];
  if (!target) throw Object.assign(new Error('usage: sensei-gate.mjs <page.html | folder | url> [options]'), { code: 'USAGE' });
  const want = new Set((opts.checks ? String(opts.checks).split(',') : ALL).map(s => s.trim()));
  const isUrl = /^https?:\/\//i.test(target);
  const abs = isUrl ? null : path.resolve(target);
  if (!isUrl && !fs.existsSync(abs)) throw Object.assign(new Error('target not found: ' + target), { code: 'USAGE' });
  const isDir = !isUrl && fs.statSync(abs).isDirectory();
  if (opts.steps && !fs.existsSync(path.resolve(opts.steps))) throw Object.assign(new Error('steps file not found: ' + opts.steps), { code: 'USAGE' });
  if (opts.steps) { try { const j = JSON.parse(fs.readFileSync(path.resolve(opts.steps), 'utf8')); if (!Array.isArray(j)) throw new Error('not a JSON array'); } catch (e) { throw Object.assign(new Error(`steps file ${opts.steps} is not a JSON array of steps: ${e.message}`), { code: 'USAGE' }); } }
  const name = slug(opts.name || (isUrl ? new URL(target).host : path.basename(abs)));
  const project = projectRoot(opts);
  const lib = await pluginLib();
  const prof = lib.profile ? lib.profile.loadProfile({ projectDir: project, from: isUrl ? undefined : abs }) : { profile: { offline: true, budget: null, verify: {} }, found: false };
  const profile = prof.profile;
  opts = { height: 900, settle: 800, ...opts };      // defaults when called as a library, not through parseArgs
  opts.height = +opts.height || 900; opts.settle = Number.isFinite(+opts.settle) ? +opts.settle : 800;
  if (!opts.widths || !opts.widths.length) opts.widths = (profile.verify && Array.isArray(profile.verify.widths) && profile.verify.widths.length) ? profile.verify.widths.map(Number) : [375, 768, 1440];
  if (Array.isArray(opts.widths)) opts.widths = opts.widths.map(Number).filter(Boolean).sort((a, b) => a - b);
  if (profile.offline === false && !opts.allowExternal) { opts.allowExternal = true; opts.allowExternalFrom = 'profile (offline: false)'; }
  opts.budget = profile.budget ?? null;
  const outDir = path.resolve(opts.out || path.join(project, '.sensei', 'gate', name));
  fs.mkdirSync(outDir, { recursive: true });

  const mode = opts.mode || (isUrl || isDir ? 'http' : 'file');
  const modes = mode === 'both' ? ['file', 'http'] : [mode];
  const axePath = opts.axePath || findAxe([HERE, isUrl ? process.cwd() : (isDir ? abs : path.dirname(abs))]);

  const env = await launch({ gpu: !!opts.gpu, lenientFile: !!opts.lenientFile, extraDirs: [HERE, isUrl ? process.cwd() : (isDir ? abs : path.dirname(abs))] });
  const { browser } = env;
  const report = new Report({
    tool: TOOL, target: isUrl ? target : abs, kind: isUrl ? 'url' : isDir ? 'folder' : 'file',
    startedAt: new Date(t0).toISOString(), node: process.version, platform: process.platform,
    browser: { path: env.browserPath, source: env.browserSource, version: env.version, softwareGL: !opts.gpu, strictFile: !opts.lenientFile },
    playwright: env.playwrightFrom, modes, widths: opts.widths, checks: [...want], project,
    profile: { found: !!prof.found, path: prof.path || null, offline: profile.offline, budget: opts.budget, allowExternal: !!opts.allowExternal, allowExternalFrom: opts.allowExternalFrom || (opts.allowExternal ? 'flag' : null) },
    freshness: isUrl ? null : { sha256: isDir ? null : sha256(abs), newestSourceMtimeMs: isDir ? newestMtime(abs) : fs.statSync(abs).mtimeMs },
  });

  let server = null;
  try {
    for (const m of modes) {
      let pageUrl, origin = null;
      if (isUrl) { pageUrl = target; origin = new URL(target).origin; }
      else if (m === 'http') {
        const root = isDir ? abs : path.dirname(abs);
        server = await serve(root, { isolated: !!opts.isolated });
        origin = server.origin; pageUrl = origin + '/' + (isDir ? '' : encodeURIComponent(path.basename(abs)));
      } else pageUrl = fileUrl(abs);
      await runMode({ opts, want, report, browser, pageUrl, origin, mode: m, outDir, axePath, multi: modes.length > 1, name });
      if (server) { await server.close(); server = null; }
    }
    if (modes.length > 1) diffModes(report);
  } finally {
    if (server) await server.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  report.meta.durationMs = Date.now() - t0;
  report.meta.finishedAt = new Date().toISOString();
  // Verdict in the plugin's vocabulary (lib/gate.mjs): fail if any check fails, warn if any warns, else pass. With
  // --strict a warning fails, except weight: weight is information and never fails the gate (owner rule, no budget).
  const strictWarns = report.warns.filter(r => !/(^|:)weight$/.test(r.id));
  const verdict = report.fails.length || (opts.strict && strictWarns.length) ? 'fail' : report.warns.length ? 'warn' : 'pass';
  const out = { ...report.meta, verdict, counts: { pass: report.results.filter(r => r.status === 'pass').length, warn: report.warns.length, fail: report.fails.length, info: report.results.filter(r => r.status === 'info').length }, results: report.results, artefacts: report.artefacts, notChecked: NOT_CHECKED };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), toMarkdown(out));
  const hookReport = toHookReport(out, outDir, name);
  const reportPath = writeHookReport(lib, project, name, hookReport);
  if (opts.stamp) { fs.mkdirSync(path.dirname(path.resolve(opts.stamp)), { recursive: true }); fs.writeFileSync(path.resolve(opts.stamp), JSON.stringify(hookReport, null, 2) + '\n'); }
  return { out, outDir, reportPath, hookReport };
}

// The gate's statuses mapped onto the plugin's (pass, fail, warn, skip, not-verified). 'info' results are things the
// gate measured but does not judge (weight, software-GL frame rates, a screenshot to compare by eye, an inconclusive
// reduced-motion comparison), so they are reported as not-verified, never as a pass.
const HOOK_STATUS = { pass: 'pass', fail: 'fail', warn: 'warn', skip: 'skip', info: 'not-verified' };
export function toHookReport(out, outDir, name) {
  const checks = out.results.map(r => ({ id: r.id, status: HOOK_STATUS[r.status] || 'not-verified', detail: String(r.summary) }));
  return {
    gate: name, target: out.target, at: out.finishedAt, verdict: out.verdict, checks,
    verified: out.results.filter(r => r.status === 'pass').map(r => `${r.id}: ${r.summary}`),
    not_verified: [...out.results.filter(r => r.status === 'info' || r.status === 'skip').map(r => `${r.id}: ${r.summary}`), ...out.notChecked],
    tool: out.tool, kind: out.kind, freshness: out.freshness, finishedAt: out.finishedAt, counts: out.counts,
    browser: out.browser, profile: out.profile, durationMs: out.durationMs,
    failing: out.results.filter(r => r.status === 'fail').map(r => ({ id: r.id, summary: r.summary })),
    artefactsDir: outDir, reportPath: path.join(outDir, 'report.json'),
    contactSheet: (out.artefacts.find(a => a.kind === 'contact-sheet') || {}).file ? path.join(outDir, out.artefacts.find(a => a.kind === 'contact-sheet').file) : null,
  };
}
function writeHookReport(lib, project, name, body) {
  if (lib.gate && lib.gate.writeGateReport) return lib.gate.writeGateReport(project, name, body);
  const dir = path.join(project, '.sensei', 'gate'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${String(name).replace(/[^\w.-]/g, '_')}.json`);
  fs.writeFileSync(f, JSON.stringify(body, null, 2) + '\n');
  return f;
}

async function newCtx(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.width, height: o.height }, deviceScaleFactor: 1, serviceWorkers: 'block', ignoreHTTPSErrors: true, ...o.ctx });
  return ctx;
}

function attachWatchers(page, bucket, cfg) {
  page.on('console', m => {
    const t = m.type();
    if (t === 'error' || t === 'warning') bucket.console.push({ type: t, text: m.text().slice(0, 300), where: (m.location().url || '').slice(0, 80) });
  });
  page.on('pageerror', e => bucket.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('requestfailed', r => { const f = r.failure(); bucket.failed.push({ url: r.url().slice(0, 120), why: f && f.errorText }); });
  page.on('response', r => { if (r.status() >= 400) bucket.http.push({ url: r.url().slice(0, 120), status: r.status() }); });
  page.on('request', r => {
    const u = r.url();
    if (/^(data|blob|about):/.test(u)) return;
    let ext = false;
    if (/^file:/.test(u)) ext = false;
    else if (/^https?:/.test(u)) ext = !(cfg.origin && u.startsWith(cfg.origin));
    if (ext) bucket.external.push(u.slice(0, 140));
    bucket.requests++;
  });
  page.on('dialog', d => { bucket.dialogs.push(d.type() + ': ' + d.message().slice(0, 80)); d.dismiss().catch(() => {}); });
}

const freshBucket = () => ({ console: [], pageErrors: [], failed: [], http: [], external: [], requests: 0, dialogs: [] });

async function openPage(browser, cfg, o = {}) {
  const ctx = await newCtx(browser, { width: o.width || cfg.opts.widths.at(-1), height: cfg.opts.height, ctx: o.ctx });
  if (o.init) for (const f of [].concat(o.init)) await ctx.addInitScript(f);
  // Offline policy: nothing leaves the machine. Anything that is not the page's own origin is recorded then aborted.
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (/^(data|blob|about|file):/.test(u) || (cfg.origin && u.startsWith(cfg.origin))) return route.continue();
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  const bucket = freshBucket();
  attachWatchers(page, bucket, cfg);
  return { ctx, page, bucket };
}

async function gotoReady(page, url, cfg) {
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(e => ({ __err: e }));
  if (resp && resp.__err) throw resp.__err;
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  const wf = cfg.opts.waitFor;
  if (wf) await page.waitForFunction(wf, null, { timeout: 60000 }).catch(() => cfg.warnings.push(`wait-for expression never became true: ${wf}`));
  else {
    const defined = await page.evaluate(() => ('__done' in window) || ('__ready' in window)).catch(() => false);
    if (defined) await page.waitForFunction(() => window.__done === true || window.__ready === true, null, { timeout: 60000 }).catch(() => cfg.warnings.push('window.__done/__ready was defined but never became true within 60 s'));
  }
  await page.waitForTimeout(cfg.opts.settle);
  return resp;
}

async function scrollPass(page) {
  // Trigger IntersectionObserver reveals and lazy media, then return to the top. Reveals that wait for the
  // viewport leave opacity:0 in full-page screenshots otherwise.
  return page.evaluate(async () => {
    const vh = innerHeight; let y = 0, steps = 0, last = -1;
    while (steps < 60) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 90));
      const h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
      if (y + vh >= h || h === last && y > h) break;
      last = h; y += Math.round(vh * 0.8); steps++;
    }
    const total = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    scrollTo(0, 0); await new Promise(r => setTimeout(r, 150));
    return { scrollHeight: total, steps };
  }).catch(() => ({ scrollHeight: 0, steps: 0 }));
}

async function runMode({ opts, want, report, browser, pageUrl, origin, mode, outDir, axePath, multi, name }) {
  const tag = multi ? mode + ':' : '';
  const R = (id, st, sum, data) => report.add(tag + id, st, sum, data);
  const cfg = { opts, origin, warnings: [], pageUrl };
  const widest = opts.widths.at(-1);
  const shots = []; // {label, file}
  const modeDir = multi ? path.join(outDir, mode) : outDir; fs.mkdirSync(modeDir, { recursive: true });
  const art = (f, kind) => { report.artefacts.push({ kind, file: path.relative(outDir, f) }); return f; };

  // helper page for pixel maths
  const helperCtx = await browser.newContext(); const helper = await helperCtx.newPage(); await helper.goto('about:blank');
  const stats = async buf => helper.evaluate(P.pixelStats, buf.toString('base64'));
  const pdiff = async (a, b) => helper.evaluate(P.pixelDiff, [a.toString('base64'), b.toString('base64')]).catch(() => null);

  // ===== main page, widest width =====
  const main = await openPage(browser, cfg, { width: widest, init: P.frameSamplerInit });
  const { page, bucket } = main;
  let loaded = false;
  const cdp = await main.ctx.newCDPSession(page).catch(() => null);
  if (cdp) await cdp.send('Performance.enable').catch(() => {});
  try {
    const t = Date.now();
    await gotoReady(page, pageUrl, cfg);
    loaded = true;
    R('load', 'pass', `opened in ${Date.now() - t} ms (${mode})`, { url: pageUrl });
  } catch (e) {
    R('load', 'fail', 'page did not load: ' + String(e.message).split('\n')[0]);
  }
  for (const w of cfg.warnings) R('load-readiness', 'warn', w);
  if (!loaded) { await main.ctx.close(); await helperCtx.close(); return; }

  const scroll = await scrollPass(page);
  await page.waitForTimeout(250);

  // --- load: errors and requests
  if (want.has('load')) {
    const ignorable = c => /favicon\.ico/.test(c.text + c.where) || /Failed to load resource.*favicon/.test(c.text);
    const errs = bucket.console.filter(c => c.type === 'error' && !ignorable(c));
    const warns = bucket.console.filter(c => c.type === 'warning');
    R('console-errors', errs.length ? 'fail' : 'pass', errs.length ? `${errs.length} console error(s)` : 'no console errors', errs.slice(0, 8));
    R('console-warnings', warns.length ? 'warn' : 'pass', warns.length ? `${warns.length} console warning(s)` : 'no console warnings', warns.slice(0, 6));
    R('page-errors', bucket.pageErrors.length ? 'fail' : 'pass', bucket.pageErrors.length ? `${bucket.pageErrors.length} uncaught exception(s)` : 'no uncaught exceptions', bucket.pageErrors.slice(0, 6));
    const failed = bucket.failed.filter(f => !/favicon/.test(f.url) && f.why !== 'net::ERR_BLOCKED_BY_CLIENT');
    R('request-failures', failed.length || bucket.http.filter(h => !/favicon/.test(h.url)).length ? 'fail' : 'pass', failed.length ? `${failed.length} request(s) failed` : (bucket.http.length ? `${bucket.http.length} HTTP error response(s)` : 'every request succeeded'), { failed: failed.slice(0, 8), http: bucket.http.slice(0, 8) });
    if (bucket.dialogs.length) R('dialogs', 'warn', 'alert/confirm/prompt fired and was dismissed', bucket.dialogs);
    if (opts.expectText) {
      const text = await page.evaluate(() => document.body.innerText);
      const missing = String(opts.expectText).split('|').filter(s => s && !text.includes(s));
      R('expect-text', missing.length ? 'fail' : 'pass', missing.length ? 'missing text: ' + missing.join(' | ') : 'all expected text present');
    }
  }

  // --- net: offline policy
  if (want.has('net')) {
    const ext = [...new Set(bucket.external)];
    const st = ext.length ? (opts.allowExternal ? 'warn' : 'fail') : 'pass';
    R('offline-self-contained', st, ext.length ? `${ext.length} external request(s) attempted (blocked in this run)` : `no external requests (${bucket.requests} local request(s))`, ext.slice(0, 10));
  }

  // --- hygiene
  if (want.has('hygiene')) {
    const h = await page.evaluate(P.hygiene);
    let head1k = '';
    try { head1k = fs.existsSync(new URL(pageUrl).pathname.replace(/^\/([A-Za-z]:)/, '$1')) && pageUrl.startsWith('file:') ? fs.readFileSync(fileURLToPath(pageUrl)).subarray(0, 1024).toString('latin1') : ''; } catch {}
    const issues = [];
    if (h.compatMode !== 'CSS1Compat') issues.push('quirks mode (missing <!doctype html>)');
    if (!h.viewportMeta) issues.push('no viewport meta');
    if (!h.lang) issues.push('no <html lang>');
    if (!h.title) issues.push('empty <title>');
    if (h.characterSet.toLowerCase() !== 'utf-8') issues.push('character set is ' + h.characterSet);
    if (head1k && !/<meta[^>]+charset/i.test(head1k)) issues.push('<meta charset> not within the first 1024 bytes (file:// has no HTTP charset header)');
    if (h.brokenImages.length) issues.push(h.brokenImages.length + ' broken image(s)');
    if (h.imagesWithoutAlt) issues.push(h.imagesWithoutAlt + ' image(s) without alt attribute');
    if (!h.landmarks.main) issues.push('no <main> landmark');
    if (h.h1 !== 1) issues.push(`${h.h1} <h1> element(s)`);
    R('hygiene', issues.length ? 'warn' : 'pass', issues.length ? issues.join('; ') : 'doctype, viewport, lang, title, charset, landmarks, alt text present', h);
  }

  // --- weight (information only, never a gate)
  if (/^file:/.test(pageUrl)) {
    const f = fileURLToPath(pageUrl); const src = fs.readFileSync(f, 'utf8'); const bytes = Buffer.byteLength(src);
    const uris = {}; let uriBytes = 0;
    for (const m of src.matchAll(/data:([a-z0-9.+\/-]+)(?:;[a-z0-9=.-]+)*?[;,]/gi)) {
      const start = m.index; let end = start; const stop = /["')\s]/;
      end = start + m[0].length; while (end < src.length && !stop.test(src[end])) end++;
      uris[m[1]] = (uris[m[1]] || 0) + (end - start); uriBytes += end - start;
    }
    const scripts = [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(s => s[1].length).sort((a, b) => b - a);
    // Weight is reported, never failed (owner rule, additions section 9.3). Only when the user asked for a budget
    // (profile "budget": a number of KB, or { "kb": N }) does an overrun warn; --strict never turns it into a fail.
    const budgetKB = typeof opts.budget === 'number' ? opts.budget : (opts.budget && typeof opts.budget.kb === 'number' ? opts.budget.kb : null);
    const over = budgetKB !== null && bytes / 1024 > budgetKB;
    const tail = budgetKB === null ? '(information only, no budget)' : over ? `(over the ${budgetKB} KB budget the user set; information, not a failure)` : `(within the ${budgetKB} KB budget the user set)`;
    R('weight', over ? 'warn' : 'info', `${(bytes / 1048576).toFixed(2)} MB total; ${(uriBytes / 1048576).toFixed(2)} MB of it is data: URIs; largest inline script ${(scripts[0] / 1024 || 0).toFixed(0)} KB ${tail}`, { bytes, dataUriBytes: uriBytes, dataUriByType: uris, scriptBytesTop3: scripts.slice(0, 3), budgetKB });
  }

  // --- shots at widths (new context per width so media queries and DPR behave)
  if (want.has('shots')) {
    for (const w of opts.widths) {
      const c = await openPage(browser, cfg, { width: w });
      try {
        await gotoReady(c.page, pageUrl, cfg);
        const sp = await scrollPass(c.page);
        const vf = art(path.join(modeDir, `${name}-${w}.png`), 'screenshot');
        const buf = await c.page.screenshot({ path: vf });
        const st = await stats(buf);
        const ov = await c.page.evaluate(P.overflowers);
        shots.push({ label: `${w}px`, file: vf });
        let status = 'pass', sum = `${w}px: ${st.w}x${st.h}, ${st.uniqueColours} colours, ${(st.nonBackgroundFraction * 100).toFixed(1)}% non-background`;
        if (st.uniqueColours <= 2 && st.stddev < 1.5) { status = 'fail'; sum = `${w}px viewport is blank (one flat colour)`; }
        if (ov.scrollW > ov.clientW + 1) { status = status === 'fail' ? 'fail' : 'warn'; sum += `; horizontal overflow ${ov.scrollW}>${ov.clientW}`; }
        R(`shot-${w}`, status, sum, { stats: st, overflow: ov, scrollHeight: sp.scrollHeight });
        if (!opts.noFull) {
          const cap = 15000;
          const full = art(path.join(modeDir, `${name}-${w}-full.png`), 'screenshot');
          await c.page.screenshot({ path: full, fullPage: sp.scrollHeight <= cap, clip: sp.scrollHeight > cap ? { x: 0, y: 0, width: w, height: cap } : undefined });
          if (sp.scrollHeight > cap) R(`shot-${w}-full`, 'info', `page is ${sp.scrollHeight}px tall: full-page screenshot clipped to ${cap}px (browser limit)`);
        }
      } catch (e) { R(`shot-${w}`, 'fail', 'screenshot failed: ' + String(e.message).split('\n')[0]); }
      await c.ctx.close();
    }
  }

  // --- canvases (pixel, not DOM): non-blank and animating
  if (want.has('canvas')) {
    await page.evaluate(() => scrollTo(0, 0));
    const n = await page.locator('canvas').count();
    if (!n) R('canvas', 'info', 'no <canvas> elements');
    const rows = [];
    for (let i = 0; i < Math.min(n, 8); i++) {
      const loc = page.locator('canvas').nth(i);
      try {
        await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
        const bb = await loc.boundingBox();
        if (!bb || bb.width < 32 || bb.height < 32) { rows.push({ i, skipped: 'smaller than 32px or hidden' }); continue; }
        const vis = await loc.evaluate(el => getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none' && +getComputedStyle(el).opacity > 0);
        // Isolate the canvas: hide everything else and put a magenta sentinel behind it, so overlays, page
        // backgrounds and sibling content cannot make a blank canvas look alive. Transparent pixels show magenta.
        await loc.evaluate(el => { el.setAttribute('data-sensei-target', ''); const s = document.createElement('style'); s.id = '__sensei_iso'; s.textContent = 'html{background:#ff00ff!important}*{visibility:hidden!important;background-image:none!important}canvas[data-sensei-target]{visibility:visible!important}'; document.head.appendChild(s); });
        const a = await loc.screenshot({ timeout: 8000 }); await page.waitForTimeout(450); const b = await loc.screenshot({ timeout: 8000 });
        await loc.evaluate(el => { el.removeAttribute('data-sensei-target'); document.getElementById('__sensei_iso')?.remove(); });
        const st = await stats(a), df = await pdiff(a, b);
        const magentaOnly = st.uniqueColours <= 2 && st.meanLuma > 70 && st.meanLuma < 90 && st.stddev < 1.5; // luma of #f0f is about 72+
        const blank = magentaOnly || (st.uniqueColours <= 2 && st.stddev < 1.5);
        rows.push({ i, w: Math.round(bb.width), h: Math.round(bb.height), visible: vis, blank, transparentOnly: magentaOnly, animating: df ? df.fraction > 0.0005 : null, motionFraction: df && df.fraction, ...st });
      } catch (e) { rows.push({ i, error: String(e.message).split('\n')[0] }); }
    }
    if (n) {
      const blanks = rows.filter(r => r.blank && r.visible !== false);
      R('canvas-pixels', blanks.length ? 'fail' : 'pass', blanks.length ? `${blanks.length} of ${rows.length} canvas(es) are blank (WebGL failed, context lost, or nothing drawn)` : `${rows.filter(r => !r.skipped && !r.error).length} canvas(es) have content`, rows);
      const anim = rows.filter(r => r.animating).length;
      R('canvas-motion', 'info', `${anim} of ${rows.length} canvas(es) changed within 450 ms`);
    }
  }

  // --- motion inventory and reduced motion
  let normalMotion = null;
  if (want.has('motion')) {
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(150);
    const inv = await page.evaluate(P.motionInventory);
    const a = await page.screenshot(); await page.waitForTimeout(700); const b = await page.screenshot();
    normalMotion = (await pdiff(a, b))?.fraction ?? null;
    R('motion-present', 'info', `normal run: ${inv.runningAnimations} running animation(s) (${inv.infiniteAnimations} infinite), ${normalMotion === null ? '?' : (normalMotion * 100).toFixed(2) + '%'} of pixels changed in 700 ms`, inv);
    if (opts.expectMotion) R('expect-motion', (inv.runningAnimations || normalMotion > 0.0005) ? 'pass' : 'fail', (inv.runningAnimations || normalMotion > 0.0005) ? 'something moves' : 'nothing moves: the live background or animation is static');
    if (inv.smoothScrollOnRoot) R('smooth-scroll-root', 'warn', 'html { scroll-behavior: smooth } is set: it ignores prefers-reduced-motion unless guarded and fights JS scroll libraries');

    const rm = await openPage(browser, cfg, { width: widest, ctx: { reducedMotion: 'reduce' } });
    try {
      await gotoReady(rm.page, pageUrl, cfg);
      const inv2 = await rm.page.evaluate(P.motionInventory);
      const a2 = await rm.page.screenshot(); await rm.page.waitForTimeout(700); const b2 = await rm.page.screenshot();
      const d2 = (await pdiff(a2, b2))?.fraction ?? null;
      const moving = inv2.infiniteAnimations > 0 || (d2 !== null && d2 > 0.003) || inv2.videosPlaying > 0;
      const meaningful = normalMotion === null || normalMotion > 0.0005 || inv.runningAnimations > 0;
      const f = art(path.join(modeDir, `${name}-reduced-motion.png`), 'screenshot'); await rm.page.screenshot({ path: f });
      R('reduced-motion', !meaningful ? 'info' : moving ? 'warn' : 'pass',
        !meaningful ? 'page is static in the normal run, so the reduced-motion comparison proves nothing' : moving ? `still moving under prefers-reduced-motion: ${inv2.infiniteAnimations} infinite animation(s), ${inv2.videosPlaying} video(s) playing, ${(d2 * 100).toFixed(2)}% pixels changed in 700 ms` : 'calm under prefers-reduced-motion (no infinite animations, pixels still)',
        { reduced: inv2, changedFraction: d2, normalChangedFraction: normalMotion });
    } catch (e) { R('reduced-motion', 'fail', 'reduced-motion run failed: ' + String(e.message).split('\n')[0]); }
    await rm.ctx.close();
  }

  // --- forced colours and dark scheme
  if (want.has('forced')) {
    const fc = await openPage(browser, cfg, { width: widest, ctx: { forcedColors: 'active' } });
    try {
      await gotoReady(fc.page, pageUrl, cfg);
      const au = await fc.page.evaluate(P.forcedAudit);
      const f = art(path.join(modeDir, `${name}-forced-colors.png`), 'screenshot'); const buf = await fc.page.screenshot({ path: f });
      const st = await stats(buf);
      shots.push({ label: 'forced-colors', file: f });
      R('forced-colors', !au.forcedColors ? 'info' : au.shapelessCount ? 'warn' : 'pass',
        !au.forcedColors ? 'forced-colors emulation did not engage' : au.shapelessCount ? `${au.shapelessCount} control(s) lose their shape in forced colours (no border or outline): ${au.shapeless.slice(0, 4).join(', ')}` : 'controls keep a border or outline in forced colours', { ...au, stats: st });
    } catch (e) { R('forced-colors', 'fail', 'forced-colours run failed: ' + String(e.message).split('\n')[0]); }
    await fc.ctx.close();
    const dk = await openPage(browser, cfg, { width: widest, ctx: { colorScheme: 'dark' } });
    try {
      await gotoReady(dk.page, pageUrl, cfg);
      const f = art(path.join(modeDir, `${name}-dark-scheme.png`), 'screenshot'); await dk.page.screenshot({ path: f });
      shots.push({ label: 'prefers dark', file: f });
      R('dark-scheme', 'info', 'screenshot taken with prefers-color-scheme: dark (compare it with the light one by eye)');
    } catch (e) { R('dark-scheme', 'warn', 'dark run failed: ' + String(e.message).split('\n')[0]); }
    await dk.ctx.close();
  }

  // --- axe-core
  if (want.has('axe')) {
    if (!axePath) R('axe', 'skip', 'axe-core not found: npm i axe-core (or set SENSEI_AXE to axe.min.js)');
    else {
      const axeSrc = fs.readFileSync(axePath, 'utf8');
      const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
      for (const [label, ctxo, w] of [['mobile', { reducedMotion: 'reduce' }, 375], ['desktop', { reducedMotion: 'reduce' }, widest], ['dark', { colorScheme: 'dark', reducedMotion: 'reduce' }, widest]]) {
        const ac = await openPage(browser, cfg, { width: w, ctx: ctxo });
        try {
          await gotoReady(ac.page, pageUrl, cfg);
          await scrollPass(ac.page);
          await ac.page.evaluate(src => { (0, eval)(src); }, axeSrc).catch(async () => { await ac.page.addScriptTag({ content: axeSrc }); });
          const res = await ac.page.evaluate(P.runAxe, tags);
          if (label === 'desktop') { try { const yml = await ac.page.locator('body').ariaSnapshot(); const f = art(path.join(modeDir, name + '-aria-tree.yml'), 'aria-tree'); fs.writeFileSync(f, yml); } catch (e) {} }
          const serious = res.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
          R(`axe-${label}`, serious.length ? 'fail' : res.violations.length ? 'warn' : 'pass',
            `${res.violations.length} violation(s) (${serious.length} serious or critical), ${res.incomplete.length} needing manual review; ${res.passes} rules passed`,
            { violations: res.violations, incomplete: res.incomplete.map(v => ({ id: v.id, nodes: v.nodes })), axeVersion: res.axeVersion });
        } catch (e) { R(`axe-${label}`, 'fail', 'axe run failed: ' + String(e.message).split('\n')[0]); }
        await ac.ctx.close();
      }
    }
  }

  // --- keyboard
  if (want.has('keys')) {
    const kb = await openPage(browser, cfg, { width: widest });
    try {
      await gotoReady(kb.page, pageUrl, cfg);
      const stops = []; let traps = 0;
      await kb.page.evaluate(() => { document.activeElement && document.activeElement.blur(); scrollTo(0, 0); });
      for (let i = 0; i < 80; i++) {
        await kb.page.keyboard.press('Tab');
        const s = await kb.page.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body || el === document.documentElement) return { body: true };
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          const nm = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.alt || '').trim().replace(/\s+/g, ' ').slice(0, 30);
          const tabs = [...document.querySelectorAll('*')].indexOf(el);
          return { tag: el.tagName.toLowerCase(), id: el.id, cls: typeof el.className === 'string' ? el.className.split(/\s+/)[0] : '', name: nm, idx: tabs, top: Math.round(r.top + scrollY), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, tabindex: el.getAttribute('tabindex'), visible: cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0, fv: el.matches(':focus-visible') };
        });
        if (s.body) { stops.push(s); if (stops.filter(x => x.body).length >= 2) break; continue; }
        const prev = stops[stops.length - 1];
        if (prev && !prev.body && prev.idx === s.idx) traps++;
        if (stops.some(x => !x.body && x.idx === s.idx)) { stops.push({ ...s, wrapped: true }); break; }
        stops.push(s);
      }
      const real = stops.filter(x => !x.body && !x.wrapped);
      const hidden = real.filter(x => !x.visible), offscreen = real.filter(x => !x.inView), unnamed = real.filter(x => !x.name && !['input', 'select', 'textarea'].includes(x.tag)), posTab = real.filter(x => x.tabindex && +x.tabindex > 0);
      let inversions = 0; for (let i = 1; i < real.length; i++) if (real[i].top < real[i - 1].top - 200) inversions++;
      const wrapped = stops.some(x => x.wrapped), lostToBody = stops.slice(0, -1).some(x => x.body);
      const issues = [];
      if (!real.length) issues.push('no keyboard-focusable elements found');
      if (traps) issues.push('possible keyboard trap (same element focused twice in a row)');
      if (hidden.length) issues.push(`${hidden.length} focus stop(s) on invisible elements`);
      if (unnamed.length) issues.push(`${unnamed.length} focus stop(s) without an accessible name`);
      if (posTab.length) issues.push(`${posTab.length} element(s) with tabindex > 0`);
      if (inversions > 2) issues.push(`${inversions} large jumps backwards in focus order`);
      if (!wrapped && !lostToBody && real.length >= 80) issues.push('focus order did not cycle within 80 stops');
      // focus indicator: pixel difference of the element's neighbourhood with and without focus
      const noRing = [];
      const sample = real.filter(x => x.visible && x.w > 4 && x.h > 4).slice(0, 25);
      for (const s of sample) {
        try {
          const handle = (await kb.page.locator(s.id ? '#' + CSS_escape(s.id) : s.tag + (s.cls ? '.' + CSS_escape(s.cls) : '')).all()).find(Boolean);
          if (!handle) continue;
          await handle.scrollIntoViewIfNeeded({ timeout: 1500 });
          const bb = await handle.boundingBox(); if (!bb) continue;
          const clip = { x: Math.max(0, bb.x - 8), y: Math.max(0, bb.y - 8), width: Math.min(bb.width + 16, 800), height: Math.min(bb.height + 16, 300) };
          await kb.page.keyboard.press('Shift'); await handle.evaluate(el => el.focus({ focusVisible: true })); await kb.page.waitForTimeout(120);
          const f = await kb.page.screenshot({ clip }); await handle.evaluate(el => el.blur()); await kb.page.waitForTimeout(120);
          const u = await kb.page.screenshot({ clip }); const d = await pdiff(f, u);
          if (d && d.fraction < 0.002) noRing.push((s.tag + (s.id ? '#' + s.id : s.cls ? '.' + s.cls : '') + ' "' + s.name + '"').slice(0, 50));
        } catch {}
      }
      if (noRing.length) issues.push(`${noRing.length} of ${sample.length} sampled focus stops show no visible focus change`);
      const ctl = await kb.page.evaluate(P.controlAudit);
      if (ctl.pointerOnly.length) issues.push(`${ctl.pointerOnly.length} pointer-only control(s) (cursor:pointer, not keyboard reachable): ${ctl.pointerOnly.slice(0, 3).join(', ')}`);
      if (ctl.unnamedCount) issues.push(`${ctl.unnamedCount} control(s) without a name`);
      const skip = real[0] && /skip/i.test(real[0].name);
      R('keyboard', issues.length ? 'warn' : 'pass', issues.length ? issues.join('; ') : `${real.length} focus stops, order is sensible, rings visible${skip ? ', skip link first' : ''}`, { stops: real.slice(0, 40).map(x => `${x.tag}${x.id ? '#' + x.id : ''} "${x.name}"`), noRing, skipLinkFirst: !!skip, controls: ctl });
      R('target-size', ctl.smallCount ? 'warn' : 'pass', ctl.smallCount ? `${ctl.smallCount} control(s) smaller than 24 CSS px (WCAG 2.2 AA minimum; 44 is the platform advice): ${ctl.small.slice(0, 4).join(', ')}` : 'all controls at least 24 CSS px');
    } catch (e) { R('keyboard', 'fail', 'keyboard run failed: ' + String(e.message).split('\n')[0]); }
    await kb.ctx.close();
  }

  // --- reflow at 320 css px (= 400 per cent zoom on 1280), 640 (200 per cent), text spacing
  if (want.has('reflow')) {
    for (const [label, w, h] of [['400pc', 320, 800], ['200pc', 640, 800]]) {
      const rc = await openPage(browser, cfg, { width: w });
      try {
        await rc.page.setViewportSize({ width: w, height: h });
        await gotoReady(rc.page, pageUrl, cfg); await scrollPass(rc.page);
        const ov = await rc.page.evaluate(P.overflowers);
        const f = art(path.join(modeDir, `${name}-zoom-${label}.png`), 'screenshot'); await rc.page.screenshot({ path: f });
        if (label === '400pc') shots.push({ label: 'zoom 400% (320px)', file: f });
        const bad = ov.scrollW > ov.clientW + 1;
        R(`reflow-${label}`, bad ? 'warn' : 'pass', bad ? `${w}px wide: horizontal scroll (${ov.scrollW} > ${ov.clientW}); offenders: ${ov.offenders.slice(0, 4).map(o => o.el).join(', ') || 'unknown'}` : `${w}px wide: no horizontal scroll`, ov);
        if (label === '400pc') {
          const before = await rc.page.evaluate(P.clippedCount);
          await rc.page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
          await rc.page.waitForTimeout(200);
          const after = await rc.page.evaluate(P.clippedCount);
          R('text-spacing', after.clipped > before.clipped ? 'warn' : 'pass', after.clipped > before.clipped ? `${after.clipped - before.clipped} element(s) clip their text under WCAG text-spacing overrides: ${after.examples.join(', ')}` : 'no extra clipping under text-spacing overrides (1.4.12)');
        }
      } catch (e) { R(`reflow-${label}`, 'fail', 'reflow run failed: ' + String(e.message).split('\n')[0]); }
      await rc.ctx.close();
    }
  }

  // --- blocked storage (Safari private mode, sandboxed iframes, some privacy settings)
  if (want.has('storage')) {
    const sb = await openPage(browser, cfg, { width: widest, init: () => {
      const boom = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
      for (const k of ['localStorage', 'sessionStorage']) { try { Object.defineProperty(window, k, { get: boom, configurable: true }); } catch (e) {} }
      try { Object.defineProperty(window, 'indexedDB', { get: boom, configurable: true }); } catch (e) {}
    } });
    try {
      await gotoReady(sb.page, pageUrl, cfg);
      const errs = sb.bucket.pageErrors.concat(sb.bucket.console.filter(c => c.type === 'error').map(c => c.text));
      const body = await sb.page.evaluate(() => document.body.innerText.trim().length);
      R('blocked-storage', errs.length || body < 5 ? 'warn' : 'pass', errs.length ? `${errs.length} error(s) when storage access throws: ${errs[0].slice(0, 100)}` : body < 5 ? 'page renders no text when storage is blocked' : 'page survives blocked localStorage, sessionStorage and indexedDB', errs.slice(0, 4));
    } catch (e) { R('blocked-storage', 'warn', 'run failed: ' + String(e.message).split('\n')[0]); }
    await sb.ctx.close();
  }

  // --- performance (smoothness; information, never a gate; software GL numbers are relative)
  if (want.has('perf')) {
    try {
      const idle0 = await page.evaluate(() => { window.__sf.length = 0; return performance.now(); });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(2500);
      const idle = await page.evaluate(P.frameStats);
      await page.evaluate(() => { window.__sf.length = 0; });
      await page.evaluate(async () => { const h = document.documentElement.scrollHeight - innerHeight; const t = 3000, s = performance.now(); await new Promise(res => { const step = () => { const k = Math.min(1, (performance.now() - s) / t); scrollTo(0, h * k); k < 1 ? requestAnimationFrame(step) : res(); }; step(); }); });
      const scrolling = await page.evaluate(P.frameStats);
      const snap = await page.evaluate(P.perfSnapshot);
      const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      const picked = { nodes: metrics.Nodes, jsEventListeners: metrics.JSEventListeners, jsHeapMB: +(metrics.JSHeapUsedSize / 1048576).toFixed(1), layoutCount: metrics.LayoutCount, recalcStyleCount: metrics.RecalcStyleCount, scriptSec: +metrics.ScriptDuration?.toFixed(3), layoutSec: +metrics.LayoutDuration?.toFixed(3), taskSec: +metrics.TaskDuration?.toFixed(3) };
      const warn = [];
      if (snap.cls > 0.1) warn.push(`CLS ${snap.cls}`);
      if (snap.longestTaskMs > 300) warn.push(`longest main-thread task ${snap.longestTaskMs} ms during load`);
      if (idle && idle.p95Ms > 50) warn.push(`idle p95 frame ${idle.p95Ms} ms`);
      if (scrolling && scrolling.p95Ms > 50) warn.push(`scroll p95 frame ${scrolling.p95Ms} ms`);
      R('performance', warn.length ? 'warn' : 'info', (warn.length ? warn.join('; ') + '. ' : '') + `Software GL: ${opts.gpu ? 'no (real GPU run)' : 'yes, so these numbers are relative, not target-device numbers'}. Idle ${idle ? idle.avgFps : '?'} fps, scrolling ${scrolling ? scrolling.avgFps : '?'} fps.`, { load: snap, idle, scrolling, cdp: picked, softwareGL: !opts.gpu, strictFile: !opts.lenientFile });
      void idle0;
    } catch (e) { R('performance', 'warn', 'performance probe failed: ' + String(e.message).split('\n')[0]); }
  }

  // --- routes and scripted steps (states beyond the first screen)
  // Order: routes first, each on one page in turn. Steps then start from a fresh browser context on the target URL,
  // so a route that switched the language or the theme (or stored it) cannot change what the steps see (QC finding
  // 14). --steps-after-routes keeps the old behaviour: the steps continue on the page the last route left.
  const stepsFile = opts.steps ? JSON.parse(fs.readFileSync(path.resolve(opts.steps), 'utf8')) : null;
  const routes = opts.routes ? String(opts.routes).split(',').map(s => s.trim()).filter(Boolean) : [];
  if (routes.length || stepsFile) {
    let rc = await openPage(browser, cfg, { width: widest });
    let routeErrors = 0;
    try {
      await gotoReady(rc.page, pageUrl, cfg);
      for (const r of routes) {
        const before = { e: rc.bucket.pageErrors.length, c: rc.bucket.console.filter(c => c.type === 'error').length };
        try {
          if (r.startsWith('click:')) await rc.page.click(r.slice(6), { timeout: 4000 });
          else if (r.startsWith('#')) await rc.page.evaluate(h => { location.hash = h; }, r);
          else if (r.startsWith('?')) await rc.page.goto(pageUrl.split('?')[0] + r, { waitUntil: 'load' });
          else await rc.page.goto(new URL(r, pageUrl).href, { waitUntil: 'load' });
          await rc.page.waitForTimeout(opts.settle);
          const f = art(path.join(modeDir, `${name}-route-${slug(r)}.png`), 'screenshot'); const buf = await rc.page.screenshot({ path: f });
          const st = await stats(buf); shots.push({ label: r, file: f });
          const newErr = (rc.bucket.pageErrors.length - before.e) + (rc.bucket.console.filter(c => c.type === 'error').length - before.c);
          R(`route-${slug(r)}`, newErr ? 'fail' : (st.uniqueColours <= 2 && st.stddev < 1.5 ? 'fail' : 'pass'), newErr ? `${newErr} new error(s) on this route` : (st.uniqueColours <= 2 && st.stddev < 1.5 ? 'route renders blank' : 'renders without new errors'), { stats: st });
        } catch (e) { R(`route-${slug(r)}`, 'fail', 'route failed: ' + String(e.message).split('\n')[0]); }
      }
      if (stepsFile) {
        if (routes.length && !opts.stepsAfterRoutes) {
          routeErrors = rc.bucket.pageErrors.length;
          await rc.ctx.close();
          rc = await openPage(browser, cfg, { width: widest });
          await gotoReady(rc.page, pageUrl, cfg);
        }
        let i = 0, bad = 0;
        for (const s of stepsFile) {
          i++;
          try {
            if (s.do === 'click') await rc.page.click(s.sel, { timeout: 5000 });
            else if (s.do === 'fill') await rc.page.fill(s.sel, s.value);
            else if (s.do === 'press') await rc.page.keyboard.press(s.key);
            else if (s.do === 'hover') await rc.page.hover(s.sel);
            else if (s.do === 'wait') await rc.page.waitForTimeout(s.ms || 300);
            else if (s.do === 'shot') { const f = art(path.join(modeDir, `${name}-step-${slug(s.name || String(i))}.png`), 'screenshot'); await rc.page.screenshot({ path: f }); shots.push({ label: s.name || 'step ' + i, file: f }); }
            else if (s.do === 'eval') { const v = await rc.page.evaluate(s.expr); const okv = s.expect === undefined ? !!v : String(v) === String(s.expect); if (!okv) { bad++; R(`step-${i}`, 'fail', `eval ${s.expr} gave ${JSON.stringify(v)}, expected ${JSON.stringify(s.expect)}`); } }
            else if (s.do === 'text') { const t = await rc.page.evaluate(() => document.body.innerText); if (!t.includes(s.has)) { bad++; R(`step-${i}`, 'fail', `text not found: ${s.has}`); } }
            else { bad++; R(`step-${i}`, 'fail', `unknown step "do": ${JSON.stringify(s.do)} (click, fill, press, hover, wait, shot, eval, text)`); }
          } catch (e) { bad++; R(`step-${i}`, 'fail', `${s.do} ${s.sel || s.key || ''} failed: ` + String(e.message).split('\n')[0]); }
        }
        const start = routes.length ? (opts.stepsAfterRoutes ? 'continuing on the page the last route left' : 'from a fresh load of the target') : 'from the target';
        R('steps', bad ? 'fail' : 'pass', (bad ? `${bad} of ${stepsFile.length} scripted step(s) failed` : `${stepsFile.length} scripted step(s) ran`) + `, ${start}`);
      }
      const errs = routeErrors + rc.bucket.pageErrors.length;
      if (errs && stepsFile) R('steps-errors', 'fail', `${errs} uncaught exception(s) during routes and steps`, rc.bucket.pageErrors.slice(0, 5));
    } catch (e) { R('routes', 'fail', 'routes run failed: ' + String(e.message).split('\n')[0]); }
    await rc.ctx.close();
  }

  // --- contact sheet
  if (shots.length) {
    try {
      const html = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#16181d;color:#e8e8ea;font:13px system-ui,sans-serif"><div style="display:flex;flex-wrap:wrap;gap:14px;padding:14px;align-items:flex-start">` +
        shots.map(s => `<figure style="margin:0"><img style="display:block;height:420px;width:auto;max-width:700px;object-fit:contain;object-position:top;background:#000;border:1px solid #333" src="data:image/png;base64,${fs.readFileSync(s.file).toString('base64')}"><figcaption style="padding:4px 2px">${s.label.replace(/</g, '&lt;')}</figcaption></figure>`).join('') + '</div>';
      await helper.setViewportSize({ width: 1600, height: 900 });
      await helper.setContent(html, { waitUntil: 'load' });
      const f = art(path.join(modeDir, `${name}-contact-sheet.png`), 'contact-sheet');
      await helper.screenshot({ path: f, fullPage: true });
      R('contact-sheet', 'info', `${shots.length} frames: ${path.relative(outDir, f)}. Look at it: automation cannot judge taste.`);
    } catch (e) { R('contact-sheet', 'warn', 'could not build contact sheet: ' + String(e.message).split('\n')[0]); }
  }
  await main.ctx.close(); await helperCtx.close();
  report.meta['summary_' + mode] = { requests: bucket.requests };
}

function CSS_escape(s) { return String(s).replace(/([^a-zA-Z0-9_-])/g, '\\$1'); }

function diffModes(report) {
  const f = report.results.filter(r => r.id.startsWith('file:')), h = report.results.filter(r => r.id.startsWith('http:'));
  const diffs = [];
  for (const a of f) { const b = h.find(x => x.id === 'http:' + a.id.slice(5)); if (b && a.status !== b.status) diffs.push({ id: a.id.slice(5), file: a.status, http: b.status, fileSummary: a.summary, httpSummary: b.summary }); }
  report.add('file-vs-http', diffs.length ? 'fail' : 'pass', diffs.length ? `${diffs.length} check(s) behave differently over file:// and http://` : 'file:// and http:// agree on every check', diffs);
}

function toMarkdown(o) {
  const icon = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', info: 'INFO', skip: 'SKIP' };
  const L = [`# Gate report: ${o.target}`, '', `Verdict: **${o.verdict.toUpperCase()}** (${o.counts.pass} pass, ${o.counts.warn} warn, ${o.counts.fail} fail, ${o.counts.info} info). ${o.browser.version} via ${o.browser.source}, software GL: ${o.browser.softwareGL}. ${o.durationMs} ms.`, '', '| Status | Check | Result |', '|---|---|---|'];
  for (const r of o.results) L.push(`| ${icon[r.status]} | ${r.id} | ${String(r.summary).replace(/\|/g, '/').replace(/\n/g, ' ')} |`);
  L.push('', '## Not checked by this gate', ...o.notChecked.map(s => '- ' + s), '', '## Artefacts', ...o.artefacts.map(a => `- ${a.kind}: ${a.file}`));
  return L.join('\n') + '\n';
}

// ---------- CLI ----------
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { if (e instanceof OptionError) { console.error(`sensei-gate: ${e.message}. Run with --help for the list of options.`); process.exit(2); } throw e; }
  if (opts.help || !opts._.length) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1).filter((l, i, a) => a.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(opts.help ? 0 : 2); }
  runGate(opts).then(({ out, outDir, reportPath, hookReport }) => {
    if (opts.json) console.log(JSON.stringify(out, null, 2));
    else {
      console.log(`\nGate: ${out.target}\n${'-'.repeat(60)}`);
      for (const r of out.results) console.log(`${{ pass: 'PASS', warn: 'WARN', fail: 'FAIL', info: 'info', skip: 'skip' }[r.status]}  ${r.id.padEnd(24)} ${String(r.summary).slice(0, 170)}`);
      console.log(`${'-'.repeat(60)}\nVerdict: ${out.verdict.toUpperCase()}  (${out.counts.pass} pass, ${out.counts.warn} warn, ${out.counts.fail} fail)  ${out.durationMs} ms\nReport (read by the Stop hook): ${reportPath}\nFull report and artefacts: ${outDir}${hookReport.contactSheet ? `\nContact sheet (look at it): ${hookReport.contactSheet}` : ''}`);
    }
    process.exit(out.verdict === 'fail' ? 1 : 0);
  }).catch(e => { console.error('HARNESS ERROR:', e.message); process.exit(2); });
}
