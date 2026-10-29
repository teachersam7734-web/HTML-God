#!/usr/bin/env node
// router.mjs: the HTML Router's helper. Node 18 or newer, no dependencies.
//
//   node router.mjs detect  [--project DIR] [--claude-dir DIR] [--json]
//        Which subsets are installed and where: the HTML-Sensei plugin (installed, cached, the combined package this
//        script sits in, or bare skills), goat-html and html-master (user skills, project skills, inside a plugin).
//   node router.mjs brief   <brief.md> [--interview interview.md] [--json]
//   node router.mjs brief   --interview interview.md [--json]
//        Validate a brief against references/brief-template.md; check an interview file (at most 10 questions, plain
//        words, a default for each, an explanation before each technical question, nothing the request answered).
//   node router.mjs profile <brief.md> [--project DIR] [--sensei DIR] [--claude-dir DIR] [--dry-run]
//        Write .sensei/profile.json from the brief's Profile section through HTML-Sensei's own profile.mjs when it is
//        found, else directly in the documented shape; start the licence ledger and .sensei/state.json; copy the brief
//        to .sensei/brief.md.
//
// Exit codes: 0 fine, 1 the brief, interview or profile has problems (printed), 2 bad arguments or a missing file.
// verified: Windows 10, Node 24, by scripts/test-router.mjs (fixtures in scripts/fixtures, fake install trees in the
//           OS temp folder, and the real HTML-Sensei profile.mjs when it can be found).
// not verified: macOS and Linux (plain fs and child_process calls, no shell).
// Original HTML Router code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(HERE, '..');

// ---------------------------------------------------------------- shared facts (mirroring HTML-Sensei's lib/profile.mjs)
export const ENUMS = {
  deliverable: ['single-file', 'site', 'deck', 'course', 'dashboard', 'game', 'film', 'component'],
  motion: ['cinematic', 'lively', 'calm'],
  licence_mode: ['commercial', 'personal'],
};
export const DEFAULTS = {
  deliverable: 'single-file', offline: true, languages: ['en'], rtl: false, budget: null, tier: 'premium',
  motion: 'cinematic', licence_mode: 'commercial', react: false,
  verify: { browsers: ['chromium'], widths: [375, 768, 1440] },
};
export const RTL_LANGS = ['ar', 'fa', 'he', 'ur', 'ps', 'ku', 'yi', 'dv', 'sd', 'ug'];
export const SECTIONS = ['Request', 'Reading', 'Profile', 'Purpose and audience', 'Content and sources',
  'Brand and assets', 'Look and feel', 'Motion and media', 'Interactivity', 'Delivery and devices',
  'Languages and accessibility', 'Licences', 'Limits', 'Decisions log', 'Routing plan'];
export const PROFILE_KEYS = ['deliverable', 'offline', 'languages', 'rtl', 'motion', 'licence_mode', 'react', 'widths', 'budget'];
export const MAX_QUESTIONS = 10, MAX_ROUNDS = 3, MAX_PER_ROUND = 4;
const SOURCES = ['request', 'answer', 'inferred', 'default'];
const SUBSETS = ['html-sensei', 'goat-html', 'html-master'];
const PLUGIN_NAMES = ['html-god', 'html-sensei', 'html-package'];

// Words a newcomer may not know. A question whose Ask line uses one needs an Explain line before it.
export const JARGON = [/\boffline\b/i, /\bhost(?:ed|ing)?\b/i, /\bright[- ]to[- ]left\b/i, /\bRTL\b/, /\blicen[cs]es?\b/i,
  /\baccessib/i, /\bLMS\b/, /\bSCORM\b/i, /\bcmi5\b/i, /\bWebGL\b/i, /\bWebGPU\b/i, /\bshaders?\b/i, /\bAPI\b/,
  /\bCDN\b/, /\bviewport\b/i, /\bresponsive\b/i, /\bframework\b/i, /\bReact\b/, /\bSVG\b/, /\bcodecs?\b/i,
  /\brender(?:ed|ing)?\b/i, /\bdeploy/i, /\bPWA\b/, /\bSEO\b/, /\bCSS\b/, /\bJavaScript\b/i, /\bWCAG\b/i,
  /\bscreen reader\b/i, /\bMP4\b/i, /\b3D\b/i, /\bholograms?\b/i, /\bfavicon\b/i, /\bbase64\b/i, /\bdata URI\b/i];

// What a request settles, by the field it fills (interview-bank.md section 14).
export const SETTLES = [
  { re: /\b(single[- ]?(html[- ])?file|one (html )?file|offline|e-?mail(ed)? it|usb)\b/i, fields: ['profile.offline'] },
  { re: /\b(web ?site|online|my domain|hosted)\b/i, fields: ['profile.offline'] },
  { re: /\b(in|into|bilingual)\s+(persian|farsi|arabic|hebrew|urdu|english|french|german|spanish)\b/i, fields: ['profile.languages', 'profile.rtl'] },
  { re: /\b((my|our) (\w+ ){0,3}(company|company's|business|studio|shop|brand|startup|client|clients|agency)|to sell|commercial)\b/i, fields: ['profile.licence_mode'] },
  { re: /\b(for my (\w+ ){0,3}(class|students|pupils|family|kids)|personal (use|project)|a gift)\b/i, fields: ['profile.licence_mode'] },
  { re: /\b(no animation|calm|minimal motion|cinematic|lots of motion)\b/i, fields: ['profile.motion'] },
];

// ---------------------------------------------------------------- small helpers
const exists = p => { try { return fs.existsSync(p); } catch { return false; } };
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const norm = p => path.resolve(p);

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2), next = argv[i + 1];
      if (['json', 'dry-run', 'no-ledger', 'help'].includes(k)) out[k] = true;
      else if (next === undefined || next.startsWith('--')) { out[k] = true; }
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

export function frontMatterName(skillMd) {
  try {
    const t = fs.readFileSync(skillMd, 'utf8');
    const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const n = m && m[1].match(/^name:\s*["']?([A-Za-z0-9._-]+)/m);
    return n ? n[1] : null;
  } catch { return null; }
}

// Folders below `root` (to `depth` levels) that hold .claude-plugin/plugin.json.
function findPluginRoots(root, depth) {
  const found = [];
  const walk = (dir, d) => {
    if (d < 0 || !isDir(dir)) return;
    if (exists(path.join(dir, '.claude-plugin', 'plugin.json'))) found.push(dir);
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of names) if (e.isDirectory() && !['node_modules', '.git', '.sensei'].includes(e.name)) walk(path.join(dir, e.name), d - 1);
  };
  walk(root, depth);
  return found;
}

function senseiInfo(root, kind) {
  const plugin = readJSON(path.join(root, '.claude-plugin', 'plugin.json'));
  const info = {
    kind, path: norm(root), plugin_name: plugin ? plugin.name : null,
    profile_script: path.join(root, 'skills', 'html-sensei', 'scripts', 'profile.mjs'),
    profile_lib: path.join(root, 'lib', 'profile.mjs'),
    ledger: path.join(root, 'lib', 'ledger.mjs'),
    verify: path.join(root, 'skills', 'sensei-verify', 'scripts', 'verify.mjs'),
    hooks: path.join(root, 'hooks', 'hooks.json'),
  };
  info.skills = isDir(path.join(root, 'skills')) ? fs.readdirSync(path.join(root, 'skills')).filter(n => exists(path.join(root, 'skills', n, 'SKILL.md'))).length : 0;
  info.agents = isDir(path.join(root, 'agents')) ? fs.readdirSync(path.join(root, 'agents')).filter(n => n.endsWith('.md')).length : 0;
  info.complete = exists(info.profile_script) && exists(info.profile_lib) && exists(info.ledger) && exists(info.verify);
  info.hooks_active = exists(info.hooks) && !!plugin;      // hooks only run when loaded as a plugin
  for (const k of ['profile_script', 'profile_lib', 'ledger', 'verify', 'hooks']) if (!exists(info[k])) info[k] = null;
  return info;
}

// ---------------------------------------------------------------- detect
export function detect({ project = process.cwd(), claudeDir, sensei, env = process.env } = {}) {
  const cdir = norm(claudeDir || env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'));
  const proj = norm(project);
  const res = { claude_dir: cdir, project: proj, router: SKILL_DIR, subsets: {} };
  for (const s of SUBSETS) res.subsets[s] = { found: false, hits: [] };
  const seen = new Set();
  const addSensei = (root, kind) => {
    if (!root || !exists(path.join(root, 'skills', 'html-sensei', 'SKILL.md'))) return;
    const key = norm(root).toLowerCase(); if (seen.has(key)) return; seen.add(key);
    res.subsets['html-sensei'].hits.push(senseiInfo(root, kind));
  };
  const addSkill = (name, dir, kind) => {
    const md = path.join(dir, 'SKILL.md');
    if (!exists(md) || frontMatterName(md) !== name) return;
    const key = name + '|' + norm(dir).toLowerCase(); if (seen.has(key)) return; seen.add(key);
    res.subsets[name].hits.push({ kind, path: norm(dir) });
  };

  // HTML-Sensei, most explicit first.
  if (sensei) addSensei(sensei, 'given');
  if (env.HTML_SENSEI_ROOT) addSensei(env.HTML_SENSEI_ROOT, 'env HTML_SENSEI_ROOT');
  if (env.CLAUDE_PLUGIN_ROOT) addSensei(env.CLAUDE_PLUGIN_ROOT, 'env CLAUDE_PLUGIN_ROOT');
  const pkgRoot = path.resolve(SKILL_DIR, '..', '..');            // <plugin>/skills/html-router -> <plugin>
  if (exists(path.join(pkgRoot, '.claude-plugin', 'plugin.json'))) addSensei(pkgRoot, 'combined package');
  const installed = readJSON(path.join(cdir, 'plugins', 'installed_plugins.json'));
  if (installed && installed.plugins) {
    for (const [id, list] of Object.entries(installed.plugins)) {
      if (!PLUGIN_NAMES.includes(id.split('@')[0])) continue;
      for (const e of [].concat(list)) if (e && e.installPath) addSensei(e.installPath, `installed plugin ${id}`);
    }
  }
  for (const sub of ['cache', 'marketplaces']) {
    for (const r of findPluginRoots(path.join(cdir, 'plugins', sub), 5)) {
      const pj = readJSON(path.join(r, '.claude-plugin', 'plugin.json'));
      if (pj && PLUGIN_NAMES.includes(pj.name)) addSensei(r, `plugin ${sub}`);
    }
  }
  const srcTree = path.resolve(SKILL_DIR, '..', '..', 'html-sensei', 'plugin');   // the build tree: build/router/html-router
  if (exists(srcTree)) addSensei(srcTree, 'source tree');
  for (const [base, kind] of [[path.join(proj, '.claude', 'skills'), 'project skills'], [path.join(cdir, 'skills'), 'user skills']]) {
    if (exists(path.join(base, 'html-sensei', 'SKILL.md'))) addSensei(path.resolve(base, '..'), kind);
  }

  // GOAT HTML and HTML-Master.
  const skillDirs = [
    [path.resolve(SKILL_DIR, '..'), 'sibling of html-router'],
    [path.join(proj, '.claude', 'skills'), 'project skills'],
    [path.join(cdir, 'skills'), 'user skills'],
    ...res.subsets['html-sensei'].hits.map(h => [path.join(h.path, 'skills'), `inside ${h.kind}`]),
  ];
  for (const sub of ['cache', 'marketplaces']) for (const r of findPluginRoots(path.join(cdir, 'plugins', sub), 5)) skillDirs.push([path.join(r, 'skills'), `plugin ${sub}`]);
  for (const name of ['goat-html', 'html-master']) {
    for (const [base, kind] of skillDirs) addSkill(name, path.join(base, name), kind);
  }
  for (const s of SUBSETS) {
    const sub = res.subsets[s]; sub.found = sub.hits.length > 0;
    sub.best = s === 'html-sensei' ? (sub.hits.find(h => h.complete) || sub.hits[0] || null) : (sub.hits[0] || null);
  }
  const n = SUBSETS.filter(s => res.subsets[s].found).length;
  const sb = res.subsets['html-sensei'].best;
  res.mode = n === 3 ? 'all three' : n === 0 ? 'none' : `${n} of 3`;
  res.notes = [];
  if (!res.subsets['html-sensei'].found) res.notes.push('HTML-Sensei not found: no hooks, no profile loader, no sensei gate; the Router writes the profile directly and uses GOAT HTML and HTML-Master gates.');
  else if (!sb.complete) res.notes.push('HTML-Sensei skills found without the plugin lib/ folder: profile written directly; scripts that import lib/ will not run.');
  else if (!sb.hooks_active) res.notes.push('HTML-Sensei found as bare skills: its hooks are not active in this session.');
  if (!res.subsets['goat-html'].found) res.notes.push('GOAT HTML not found: no GOAT starters, canvas-2d engines, tools genre or verify_html.py.');
  if (!res.subsets['html-master'].found) res.notes.push('HTML-Master not found: no HTML-Master art direction notes, asset library, learning design or browser_smoke.cjs.');
  return res;
}

function printDetect(r) {
  console.log(`claude config: ${r.claude_dir}`);
  console.log(`project: ${r.project}`);
  console.log(`router: ${r.router}`);
  for (const s of SUBSETS) {
    const sub = r.subsets[s];
    if (!sub.found) { console.log(`${s}: not found`); continue; }
    for (const h of sub.hits) {
      const star = h === sub.best ? '*' : ' ';
      let extra = '';
      if (s === 'html-sensei') extra = ` (plugin name ${h.plugin_name || 'none'}, ${h.skills} skills, ${h.agents} agents, ${h.complete ? 'complete' : 'incomplete'}, hooks ${h.hooks_active ? 'available' : 'not active'})`;
      console.log(`${s}:${star}${h.kind}: ${h.path}${extra}`);
    }
    if (s === 'html-sensei' && sub.best) {
      const b = sub.best;
      console.log(`  profile script: ${b.profile_script || 'missing'}`);
      console.log(`  ledger: ${b.ledger || 'missing'}`);
      console.log(`  gate: ${b.verify || 'missing'}`);
    }
  }
  console.log(`mode: ${r.mode}`);
  for (const n of r.notes) console.log(`note: ${n}`);
}

// ---------------------------------------------------------------- brief
export function parseSections(text) {
  const out = {}; let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^##\s+(?:\d+\.\s*)?(.+?)\s*$/);
    if (m && !line.startsWith('###')) { cur = m[1].trim(); out[cur] = []; continue; }
    if (cur) out[cur].push(line);
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n').trim();
  return out;
}

export function parseProfile(body) {
  const p = {}, raw = {};
  for (const line of (body || '').split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s*([a-z_.]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    raw[m[1]] = m[2];
    let v; try { v = JSON.parse(m[2]); } catch { v = m[2]; }
    p[m[1]] = v;
  }
  return { profile: p, raw };
}

export function validateBrief(text) {
  const errors = [], warnings = [];
  const sec = parseSections(text);
  const have = Object.keys(sec).map(s => s.toLowerCase());
  for (const s of SECTIONS) if (!have.includes(s.toLowerCase())) errors.push(`missing section "## ${s}"`);
  const get = name => sec[Object.keys(sec).find(k => k.toLowerCase() === name.toLowerCase())] || '';
  const { profile: p } = parseProfile(get('Profile'));
  for (const k of PROFILE_KEYS) if (!(k in p)) errors.push(`Profile is missing "- ${k}: ..."`);
  for (const [k, allowed] of Object.entries(ENUMS)) if (k in p && !allowed.includes(p[k])) errors.push(`Profile ${k} "${p[k]}" is not one of ${allowed.join(', ')}`);
  for (const k of ['offline', 'rtl', 'react']) if (k in p && typeof p[k] !== 'boolean') errors.push(`Profile ${k} must be true or false, got "${p[k]}"`);
  if ('languages' in p && !(Array.isArray(p.languages) && p.languages.length && p.languages.every(x => typeof x === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]+)?$/.test(x)))) errors.push('Profile languages must be a JSON list of language codes, such as ["en"] or ["en","fa"]');
  if ('widths' in p && !(Array.isArray(p.widths) && p.widths.length && p.widths.every(w => Number.isInteger(w) && w >= 240 && w <= 7680))) errors.push('Profile widths must be a JSON list of whole screen widths, such as [375, 768, 1440]');
  if (Array.isArray(p.languages) && p.languages.some(l => RTL_LANGS.includes(l.split('-')[0])) && p.rtl !== true) errors.push('Profile rtl must be true: a language in the list is written right to left');
  const log = get('Decisions log');
  if ('budget' in p && p.budget !== null) {
    if (typeof p.budget !== 'number' || p.budget <= 0) errors.push('Profile budget must be null or a number of KB');
    else if (!log.split(/\r?\n/).some(l => /(size|budget|weight|limit|KB|MB)/i.test(l) && /source:\s*(answer|request)/i.test(l))) errors.push('a budget needs a decisions-log line from the user (source: answer or request) about the size limit; the default is no budget');
  }
  const logLines = log.split(/\r?\n/).filter(l => /^\s*[-*]\s+/.test(l));
  if (!logLines.length) errors.push('Decisions log has no lines ("- topic: value (source: request|answer|inferred|default)")');
  for (const l of logLines) {
    const m = l.match(/\(source:\s*([a-z]+)\s*\)\s*$/i);
    if (!m) errors.push(`decisions-log line without "(source: ...)" at the end: ${l.trim()}`);
    else if (!SOURCES.includes(m[1].toLowerCase())) errors.push(`decisions-log source "${m[1]}" is not one of ${SOURCES.join(', ')}`);
  }
  const plan = get('Routing plan');
  if (!/skills?\s*:/i.test(plan)) errors.push('Routing plan has no "- Skills: ..." line');
  if (!/verify\s*:/i.test(plan)) errors.push('Routing plan has no "- Verify: ..." line naming the final gate');
  const lines = text.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/^\s*>/.test(l)) return; // Quoted user/source material is literal content, not a template placeholder.
    if (/<[a-z][^<>]{0,80}>/i.test(l.replace(/`[^`]*`/g, '')) && !/<\/?(br|kbd|code)>/i.test(l)) errors.push(`placeholder left on line ${i + 1}: ${l.trim().slice(0, 80)}`);
    if (/\bTODO\b/.test(l)) errors.push(`TODO left on line ${i + 1}`);
  });
  for (const s of ['Request', 'Reading', 'Purpose and audience']) if (have.includes(s.toLowerCase()) && !get(s)) errors.push(`section "${s}" is empty`);
  return { ok: errors.length === 0, errors, warnings, profile: p, sections: sec };
}

// ---------------------------------------------------------------- interview
export function parseInterview(text) {
  const head = {}, questions = [], rounds = [];
  let cur = null, round = 0, inOptions = false;
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^##\s+Round\s+(\d+)/i))) { round = Number(m[1]); rounds.push(round); cur = null; inOptions = false; continue; }
    if ((m = line.match(/^###\s+Q(\d+)\b\s*(?:\[([^\]]*)\])?\s*(.*)$/))) {
      cur = { n: Number(m[1]), header: (m[2] || '').trim(), title: m[3].trim(), round: round || 1, explain: null, ask: null, def: null, options: [], fills: null, technical: null, order: [] };
      questions.push(cur); inOptions = false; continue;
    }
    if (!cur) {
      if ((m = line.match(/^(Request|Mode|Already answered|Project)\s*:\s*(.*)$/i))) head[m[1].toLowerCase()] = m[2].trim();
      continue;
    }
    if ((m = line.match(/^(Explain|Ask|Default|Fills|Technical)\s*:\s*(.*)$/i))) {
      const k = m[1].toLowerCase(); inOptions = false;
      if (k === 'explain') cur.explain = m[2].trim();
      if (k === 'ask') cur.ask = m[2].trim();
      if (k === 'default') cur.def = m[2].trim();
      if (k === 'fills') cur.fills = m[2].split(/[,\s]+/).filter(Boolean);
      if (k === 'technical') cur.technical = /^y(es)?|true$/i.test(m[2].trim());
      cur.order.push(k); continue;
    }
    if (/^Options\s*:\s*$/i.test(line)) { inOptions = true; cur.order.push('options'); continue; }
    if (inOptions && (m = line.match(/^\s*[-*]\s+(.+)$/))) {
      const t = m[1].trim(); const i = t.indexOf(':');
      cur.options.push({ label: (i > 0 ? t.slice(0, i) : t).trim(), description: i > 0 ? t.slice(i + 1).trim() : '' });
    }
  }
  return { head, questions, rounds };
}

export function settledFields(request) {
  const f = new Set();
  for (const s of SETTLES) if (s.re.test(request || '')) for (const x of s.fields) f.add(x);
  return f;
}

export function validateInterview(text) {
  const errors = [], warnings = [];
  const { head, questions, rounds } = parseInterview(text);
  const mode = (head.mode || 'message').toLowerCase();
  if (!['tool', 'message'].includes(mode)) errors.push(`Mode must be "tool" or "message", got "${head.mode}"`);
  if (!head.request) errors.push('no "Request:" line with the user\'s words at the top');
  if (!questions.length) errors.push('no questions found (each starts with "### Q<n>")');
  if (questions.length > MAX_QUESTIONS) errors.push(`${questions.length} questions: the limit is ${MAX_QUESTIONS}`);
  const nRounds = new Set(questions.map(q => q.round)).size;
  if (mode === 'message' && nRounds > 1) errors.push('message mode asks everything in one numbered message: use one round');
  if (nRounds > MAX_ROUNDS) errors.push(`${nRounds} rounds: the limit is ${MAX_ROUNDS}`);
  const seenN = new Set();
  questions.forEach((q, i) => {
    const id = `Q${q.n}`;
    if (q.n !== i + 1) errors.push(`${id}: questions must be numbered 1, 2, 3 ... in order (found Q${q.n} at position ${i + 1})`);
    if (seenN.has(q.n)) errors.push(`${id}: duplicate number`); seenN.add(q.n);
    if (!q.ask) errors.push(`${id}: no "Ask:" line`);
    if (!q.def) errors.push(`${id}: no "Default:" line`);
    else if (!/if you have no preference/i.test(q.def)) errors.push(`${id}: the default must read "If you have no preference, I will ..."`);
    const jargon = q.ask ? JARGON.filter(re => re.test(q.ask)).map(re => (q.ask.match(re) || [''])[0]) : [];
    const technical = q.technical === true || jargon.length > 0;
    if (technical && !q.explain) errors.push(`${id}: technical (${jargon.join(', ') || 'marked technical'}) but no "Explain:" line`);
    if (q.explain) {
      if (q.order.indexOf('explain') > q.order.indexOf('ask')) errors.push(`${id}: the explanation must come before the question`);
      const sentences = q.explain.split(/(?<=[.!?])\s+/).filter(s => s.trim()).length;
      if (sentences > 3) errors.push(`${id}: the explanation is ${sentences} sentences; keep it to two or three`);
      const hard = q.explain.match(/\b(SCORM|cmi5|API|CDN|PWA|WCAG|WebGL|WebGPU|codecs?)\b/);
      if (hard && !/\(|such as|for example|means|called/i.test(q.explain)) warnings.push(`${id}: the explanation uses "${hard[1]}" without saying what it is`);
    }
    if (q.ask && q.ask.split(/\s+/).length > 45) warnings.push(`${id}: the question is long (${q.ask.split(/\s+/).length} words); one sentence is best`);
    if (mode === 'tool') {
      if (q.options.length < 2 || q.options.length > 4) errors.push(`${id}: AskUserQuestion needs 2 to 4 options, found ${q.options.length}`);
      if (q.options.length && !/\(Recommended\)\s*$/.test(q.options[0].label)) errors.push(`${id}: the first option must be the recommended one, its label ending in "(Recommended)"`);
      if (q.options.slice(1).some(o => /\(Recommended\)/.test(o.label))) errors.push(`${id}: only the first option may be marked "(Recommended)"`);
      if (q.options.some(o => /^other\b/i.test(o.label))) errors.push(`${id}: do not add an "Other" option; the tool always allows a free answer`);
      if (!q.header) errors.push(`${id}: AskUserQuestion needs a short header in brackets after the number, such as "### Q1 [Goal]"`);
      else if (q.header.length > 12) errors.push(`${id}: header "${q.header}" is over 12 characters`);
    }
    if (q.options.some(o => JARGON.some(re => re.test(o.label)) && !q.explain)) errors.push(`${id}: an option label uses a technical word with no explanation`);
  });
  if (mode === 'tool') {
    const per = {};
    for (const q of questions) per[q.round] = (per[q.round] || 0) + 1;
    for (const [r, n] of Object.entries(per)) if (n > MAX_PER_ROUND) errors.push(`round ${r} has ${n} questions: AskUserQuestion takes at most ${MAX_PER_ROUND} per call`);
  }
  const settled = settledFields(head.request);
  for (const q of questions) for (const f of q.fills || []) if (settled.has(f)) errors.push(`Q${q.n}: asks for ${f}, which the request already answered`);
  if (rounds.length && rounds.some((r, i) => r !== i + 1)) errors.push('rounds must be numbered 1, 2, 3 in order');
  return { ok: errors.length === 0, errors, warnings, count: questions.length, rounds: nRounds, mode };
}

// ---------------------------------------------------------------- profile
function profileSets(p) {
  const sets = [];
  for (const k of ['deliverable', 'offline', 'languages', 'rtl', 'motion', 'licence_mode', 'react', 'budget']) sets.push(`${k}=${JSON.stringify(p[k])}`.replace(/^([a-z_]+)="([^"]*)"$/, '$1=$2'));
  sets.push(`verify.widths=${JSON.stringify(p.widths)}`);
  return sets;
}

export function writeProfileDirect(project, p) {
  const file = path.join(project, '.sensei', 'profile.json');
  const cur = readJSON(file) || {};
  const next = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...cur };
  for (const k of ['deliverable', 'offline', 'languages', 'rtl', 'motion', 'licence_mode', 'react', 'budget']) next[k] = p[k];
  next.verify = { ...DEFAULTS.verify, ...(cur.verify || {}), widths: p.widths };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  return { file, profile: next };
}

export function runProfile({ brief, project, sensei, claudeDir, dryRun = false, ledger = true, env = process.env }) {
  const out = { steps: [], errors: [] };
  if (!exists(brief)) { out.errors.push(`no brief at ${brief}`); out.code = 2; return out; }
  const text = fs.readFileSync(brief, 'utf8');
  const v = validateBrief(text);
  if (!v.ok) { out.errors.push(...v.errors); out.code = 1; return out; }
  const p = v.profile;
  project = norm(project || env.CLAUDE_PROJECT_DIR || process.cwd());
  const det = detect({ project, claudeDir, sensei, env });
  const sb = det.subsets['html-sensei'].best;
  const useScript = sb && sb.complete;
  const sets = profileSets(p);
  out.route = useScript ? `HTML-Sensei profile.mjs (${sb.kind}: ${sb.path})` : 'written directly (HTML-Sensei profile.mjs not found)';
  if (dryRun) { out.steps.push(`would write ${path.join(project, '.sensei', 'profile.json')} via ${out.route}`, `values: ${sets.join(' ')}`); out.code = 0; return out; }

  fs.mkdirSync(path.join(project, '.sensei'), { recursive: true });
  const briefDest = path.join(project, '.sensei', 'brief.md');
  if (norm(brief).toLowerCase() !== norm(briefDest).toLowerCase()) { fs.writeFileSync(briefDest, text.replace(/\r\n/g, '\n')); out.steps.push(`brief copied to ${briefDest}`); }

  if (useScript) {
    const r = spawnSync(process.execPath, [sb.profile_script, '--project', project, ...sets.flatMap(s => ['--set', s])], { encoding: 'utf8' });
    out.steps.push(`ran ${sb.profile_script} (exit ${r.status})`);
    if (r.status !== 0) { out.errors.push(`HTML-Sensei profile.mjs refused the profile:\n${(r.stdout || '') + (r.stderr || '')}`.trim()); out.code = 1; return out; }
  } else {
    const w = writeProfileDirect(project, p);
    out.steps.push(`wrote ${w.file} directly`);
  }
  out.profile_file = path.join(project, '.sensei', 'profile.json');
  out.profile = readJSON(out.profile_file);

  if (ledger) {
    if (sb && sb.ledger) {
      const r = spawnSync(process.execPath, [sb.ledger, 'init', project], { encoding: 'utf8' });
      out.steps.push(`ledger: ${(r.stdout || r.stderr || '').trim().split(/\r?\n/)[0] || `exit ${r.status}`}`);
    } else {
      const lf = path.join(project, '.sensei', 'licences.json');
      if (!exists(lf)) { fs.writeFileSync(lf, JSON.stringify({ rows: [] }, null, 2) + '\n'); out.steps.push(`ledger: created ${lf}`); }
      else out.steps.push(`ledger: ${lf} exists, left alone`);
    }
  }
  const sf = path.join(project, '.sensei', 'state.json');
  if (!exists(sf)) {
    const plan = (v.sections['Routing plan'] || '');
    const slice = (plan.match(/slice first\s*:\s*(.+)/i) || [])[1] || 'prove the hardest part first';
    const reading = (v.sections['Reading'] || '').replace(/\s*\r?\n\s*/g, ' ').split(/(?<=\.)\s+/)[0];
    const state = { goal: reading || (v.sections['Request'] || '').split(/\r?\n/)[0], profile: `${p.deliverable}, offline ${p.offline}, ${p.languages.join('+')}${p.rtl ? ' rtl' : ''}, motion ${p.motion}, ${p.licence_mode}`,
      done: [], next: slice.trim(), open_questions: [], commands: [], background: [], outputs: {} };
    fs.writeFileSync(sf, JSON.stringify(state, null, 2) + '\n');
    out.steps.push(`state: created ${sf}`);
  } else out.steps.push(`state: ${sf} exists, left alone`);
  out.code = 0;
  return out;
}

// ---------------------------------------------------------------- CLI
function usage() {
  console.log(`usage:
  node router.mjs detect  [--project DIR] [--claude-dir DIR] [--json]
  node router.mjs brief   <brief.md> [--interview interview.md] [--json]
  node router.mjs brief   --interview interview.md [--json]
  node router.mjs profile <brief.md> [--project DIR] [--sensei DIR] [--claude-dir DIR] [--dry-run] [--no-ledger]`);
}

function main(argv) {
  const a = args(argv);
  const cmd = a._[0];
  if (!cmd || a.help || cmd === 'help') { usage(); return cmd ? 0 : 2; }
  if (cmd === 'detect') {
    const r = detect({ project: a.project, claudeDir: a['claude-dir'], sensei: a.sensei });
    if (a.json) console.log(JSON.stringify(r, null, 2)); else printDetect(r);
    return 0;
  }
  if (cmd === 'brief') {
    const file = a._[1], iv = a.interview;
    if (!file && !iv) { usage(); return 2; }
    let code = 0; const report = {};
    if (file) {
      if (!exists(file)) { console.error(`no file ${file}`); return 2; }
      const v = validateBrief(fs.readFileSync(file, 'utf8'));
      report.brief = { file, ok: v.ok, errors: v.errors, warnings: v.warnings };
      if (!v.ok) code = 1;
    }
    if (iv && iv !== true) {
      if (!exists(iv)) { console.error(`no file ${iv}`); return 2; }
      const v = validateInterview(fs.readFileSync(iv, 'utf8'));
      report.interview = { file: iv, ok: v.ok, count: v.count, rounds: v.rounds, mode: v.mode, errors: v.errors, warnings: v.warnings };
      if (!v.ok) code = 1;
    } else if (iv === true) { usage(); return 2; }
    if (a.json) console.log(JSON.stringify(report, null, 2));
    else {
      if (report.brief) {
        console.log(`brief ${report.brief.file}: ${report.brief.ok ? 'ok' : 'PROBLEMS'}`);
        for (const e of report.brief.errors) console.log(`  error: ${e}`);
        for (const w of report.brief.warnings) console.log(`  warning: ${w}`);
      }
      if (report.interview) {
        const r = report.interview;
        console.log(`interview ${r.file}: ${r.count} question${r.count === 1 ? '' : 's'} (limit ${MAX_QUESTIONS}), ${r.rounds} round${r.rounds === 1 ? '' : 's'}, mode ${r.mode}: ${r.ok ? 'ok' : 'PROBLEMS'}`);
        for (const e of r.errors) console.log(`  error: ${e}`);
        for (const w of r.warnings) console.log(`  warning: ${w}`);
      }
    }
    return code;
  }
  if (cmd === 'profile') {
    const brief = a._[1];
    if (!brief) { usage(); return 2; }
    const r = runProfile({ brief, project: a.project, sensei: a.sensei, claudeDir: a['claude-dir'], dryRun: !!a['dry-run'], ledger: !a['no-ledger'] });
    if (r.route) console.log(`profile route: ${r.route}`);
    for (const s of r.steps) console.log(s);
    for (const e of r.errors) console.log(`error: ${e}`);
    if (r.profile) console.log(JSON.stringify(r.profile, null, 2));
    return r.code;
  }
  usage();
  return 2;
}

if (process.argv[1] && norm(process.argv[1]).toLowerCase() === norm(fileURLToPath(import.meta.url)).toLowerCase()) {
  process.exitCode = main(process.argv.slice(2));
}
