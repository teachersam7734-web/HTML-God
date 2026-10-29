#!/usr/bin/env node
// test-router.mjs: tests for router.mjs and the HTML Router skill folder. Node 18 or newer, no dependencies.
//
//   node test-router.mjs
//
// Covers: brief validation (good, bad, the template, the example brief); interview checks (the three examples, a
// message-mode fixture, eleven questions, crowded rounds, every rule broken at once); detect on fake install trees
// (nothing, plugin cache plus user and project skills, installed_plugins.json, the combined package layout, bare
// skills without lib/); profile written directly, through a fake HTML-Sensei that refuses, through the real
// HTML-Sensei profile.mjs when it can be found, dry run, and an invalid brief; the CLI exit codes; links in the
// skill's Markdown; the routing map's component paths against the real subsets when they are found; evals.json; and
// the text rules (LF only, no long dashes, no owner names, no mention of the dropped record document).
// Scratch: a folder under the OS temp directory, removed when every check passes, kept (path printed) when one fails.
// verified: Windows 10, Node 24. not verified: macOS and Linux.
// Original HTML Router code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const FIX = path.join(HERE, 'fixtures');
const R = await import(pathToFileURL(path.join(HERE, 'router.mjs')).href);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'html-router-test-'));

let pass = 0, fail = 0;
const ok = (cond, name, detail = '') => { if (cond) { pass++; console.log(`ok   ${name}`); } else { fail++; console.log(`FAIL ${name}${detail ? `: ${detail}` : ''}`); } };
const read = f => fs.readFileSync(f, 'utf8');
const has = (list, re) => list.some(e => re.test(e));
const cleanEnv = () => { const e = { ...process.env }; delete e.CLAUDE_PLUGIN_ROOT; delete e.HTML_SENSEI_ROOT; delete e.CLAUDE_CONFIG_DIR; delete e.CLAUDE_PROJECT_DIR; return e; };
const write = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const skillMd = name => `---\nname: ${name}\ndescription: test\n---\n# ${name}\n`;
const run = (script, args, env = cleanEnv()) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env });

// A copy of the router in a folder with no siblings, so detect sees only the fake trees.
function standaloneRouter(dir) {
  const s = path.join(dir, 'html-router', 'scripts', 'router.mjs');
  write(s, read(path.join(HERE, 'router.mjs')));
  write(path.join(dir, 'html-router', 'SKILL.md'), skillMd('html-router'));
  return s;
}
// A fake HTML-Sensei plugin root. refuse: its profile.mjs exits 1.
function fakeSensei(root, name = 'html-sensei', { refuse = false, lib = true } = {}) {
  write(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name }));
  write(path.join(root, 'skills', 'html-sensei', 'SKILL.md'), skillMd('html-sensei'));
  write(path.join(root, 'skills', 'sensei-verify', 'SKILL.md'), skillMd('sensei-verify'));
  write(path.join(root, 'skills', 'sensei-verify', 'scripts', 'verify.mjs'), 'console.log("fake gate")\n');
  write(path.join(root, 'hooks', 'hooks.json'), '{"hooks":{}}\n');
  write(path.join(root, 'agents', 'sensei-reviewer.md'), '---\nname: sensei-reviewer\n---\n');
  write(path.join(root, 'skills', 'html-sensei', 'scripts', 'profile.mjs'), refuse
    ? 'console.log("ERROR: profile.deliverable is not allowed"); process.exit(1);\n'
    : `import fs from 'node:fs'; import path from 'node:path';
const a = process.argv.slice(2); const p = a[a.indexOf('--project') + 1]; const o = { fake: true };
a.forEach((x, i) => { if (x === '--set') { const s = a[i + 1], e = s.indexOf('='); let v = s.slice(e + 1); try { v = JSON.parse(v); } catch {} o[s.slice(0, e)] = v; } });
fs.mkdirSync(path.join(p, '.sensei'), { recursive: true }); fs.writeFileSync(path.join(p, '.sensei', 'profile.json'), JSON.stringify(o));
console.log('fake profile written');\n`);
  if (lib) {
    write(path.join(root, 'lib', 'profile.mjs'), 'export const DEFAULTS = {};\n');
    write(path.join(root, 'lib', 'ledger.mjs'), `import fs from 'node:fs'; import path from 'node:path';
const p = process.argv[3]; fs.mkdirSync(path.join(p, '.sensei'), { recursive: true });
fs.writeFileSync(path.join(p, '.sensei', 'licences.json'), '{"rows":[],"fake":true}'); console.log('created fake ledger');\n`);
  }
}

// ---------------------------------------------------------------- brief
{
  const g = R.validateBrief(read(path.join(FIX, 'brief-good.md')));
  ok(g.ok, 'good brief passes', g.errors.join('; '));
  ok(g.profile.deliverable === 'single-file' && g.profile.budget === null && Array.isArray(g.profile.widths), 'good brief profile parsed');
  const ex = R.validateBrief(read(path.join(SKILL, 'examples', 'brief-course.md')));
  ok(ex.ok, 'example course brief passes', ex.errors.join('; '));
  const b = R.validateBrief(read(path.join(FIX, 'brief-bad.md')));
  ok(!b.ok, 'bad brief fails');
  const want = [/missing section "## Limits"/, /deliverable "website"/, /motion "wild"/, /offline must be true or false/,
    /missing "- react/, /rtl must be true/, /budget needs a decisions-log line/, /source "guess"/, /without "\(source/,
    /no "- Skills/, /no "- Verify/, /placeholder left/, /TODO left/];
  for (const re of want) ok(has(b.errors, re), `bad brief reports ${re.source}`, b.errors.join(' | '));
  const t = R.validateBrief(read(path.join(SKILL, 'references', 'brief-template.md')));
  ok(!t.ok && has(t.errors, /placeholder/), 'the template itself fails (placeholders)');
  const withBudget = read(path.join(FIX, 'brief-good.md')).replace('- budget: null', '- budget: 900').replace('- size limit: none (source: default)', '- size limit: 900 KB, the user asked for it (source: answer)');
  ok(R.validateBrief(withBudget).ok, 'a budget the user asked for passes');
}

// ---------------------------------------------------------------- interview
{
  for (const f of ['interview-landing.md', 'interview-course.md', 'interview-presentation.md']) {
    const v = R.validateInterview(read(path.join(SKILL, 'examples', f)));
    ok(v.ok && v.count <= 10 && v.mode === 'tool' && v.rounds <= 3, `example ${f} passes (${v.count} questions, ${v.rounds} rounds)`, v.errors.join('; '));
    ok(!v.warnings.length, `example ${f} has no warnings`, v.warnings.join('; '));
  }
  const m = R.validateInterview(read(path.join(FIX, 'interview-message.md')));
  ok(m.ok && m.count === 3 && m.mode === 'message', 'message-mode fixture passes', m.errors.join('; '));
  const many = R.validateInterview(read(path.join(FIX, 'interview-too-many.md')));
  ok(!many.ok && many.count === 11 && has(many.errors, /11 questions: the limit is 10/), 'eleven questions refused');
  const crowd = R.validateInterview(read(path.join(FIX, 'interview-crowded.md')));
  ok(has(crowd.errors, /round 1 has 5 questions/), 'five questions in one tool round refused');
  ok(has(crowd.errors, /4 rounds: the limit is 3/), 'four rounds refused');
  const bad = R.validateInterview(read(path.join(FIX, 'interview-bad.md')));
  const want = [/Q1: asks for profile.offline, which the request already answered/, /Q1: header "Deliverable format" is over 12/,
    /Q1: technical \(offline/, /Q1: the first option must be the recommended/, /Q1: only the first option/,
    /Q2: no "Default:"/, /Q2: AskUserQuestion needs 2 to 4 options, found 5/, /Q2: do not add an "Other"/,
    /Q3: the explanation must come before/, /Q3: the default must read "If you have no preference/,
    /Q5: asks for profile.languages, which the request already answered/, /numbered 1, 2, 3 .* \(found Q5 at position 4\)/,
    /Q6: AskUserQuestion needs 2 to 4 options, found 1/];
  for (const re of want) ok(has(bad.errors, re), `bad interview reports ${re.source}`, bad.errors.join(' | '));
  ok(R.settledFields('a single HTML file for my coffee shop, in English').has('profile.licence_mode'), 'a shop request settles the licence mode');
  ok(!R.settledFields('an interactive course about volcanoes').has('profile.offline'), 'a course request does not settle delivery');
}

// ---------------------------------------------------------------- CLI exit codes
{
  const S = path.join(HERE, 'router.mjs');
  ok(run(S, ['brief', path.join(FIX, 'brief-good.md')]).status === 0, 'CLI brief good: exit 0');
  ok(run(S, ['brief', path.join(FIX, 'brief-bad.md')]).status === 1, 'CLI brief bad: exit 1');
  const tm = run(S, ['brief', '--interview', path.join(FIX, 'interview-too-many.md')]);
  ok(tm.status === 1 && /11 questions \(limit 10\)/.test(tm.stdout), 'CLI interview of eleven: exit 1 with the count');
  ok(run(S, ['brief', path.join(FIX, 'brief-good.md'), '--interview', path.join(SKILL, 'examples', 'interview-landing.md')]).status === 0, 'CLI brief and interview together: exit 0');
  ok(run(S, ['brief', path.join(TMP, 'nope.md')]).status === 2, 'CLI missing file: exit 2');
  ok(run(S, []).status === 2, 'CLI no command: exit 2');
  const j = run(S, ['brief', '--interview', path.join(SKILL, 'examples', 'interview-course.md'), '--json']);
  let parsed = null; try { parsed = JSON.parse(j.stdout); } catch {}
  ok(parsed && parsed.interview.count === 8, 'CLI --json prints the report');
}

// ---------------------------------------------------------------- detect
{
  const base = path.join(TMP, 'detect');
  const router = standaloneRouter(path.join(base, 'alone'));
  const d = (cdir, proj, extra = []) => JSON.parse(run(router, ['detect', '--json', '--claude-dir', cdir, '--project', proj, ...extra]).stdout);
  const emptyC = path.join(base, 'empty-claude'), proj = path.join(base, 'proj');
  fs.mkdirSync(emptyC, { recursive: true }); fs.mkdirSync(proj, { recursive: true });
  const none = d(emptyC, proj);
  ok(none.mode === 'none' && !none.subsets['html-sensei'].found && none.notes.length === 3, 'detect: nothing installed', JSON.stringify(none.notes));

  const c2 = path.join(base, 'claude2'), p2 = path.join(base, 'proj2');
  fakeSensei(path.join(c2, 'plugins', 'cache', 'some-market', 'html-sensei', 'abc123'));
  write(path.join(c2, 'skills', 'goat-html', 'SKILL.md'), skillMd('goat-html'));
  write(path.join(c2, 'skills', 'not-goat', 'SKILL.md'), skillMd('something-else'));
  write(path.join(c2, 'skills', 'html-master', 'SKILL.md'), skillMd('wrong-name'));
  write(path.join(p2, '.claude', 'skills', 'html-master', 'SKILL.md'), skillMd('html-master'));
  const all = d(c2, p2);
  const s = all.subsets['html-sensei'].best;
  ok(all.mode === 'all three', 'detect: all three from cache, user and project skills', all.mode);
  ok(s && s.kind === 'plugin cache' && s.complete && s.hooks_active && s.plugin_name === 'html-sensei', 'detect: HTML-Sensei in the plugin cache, complete', JSON.stringify(s));
  ok(s && /profile\.mjs$/.test(s.profile_script) && /ledger\.mjs$/.test(s.ledger) && /verify\.mjs$/.test(s.verify), 'detect: prints the profile, ledger and gate paths');
  ok(all.subsets['goat-html'].best.kind === 'user skills', 'detect: goat-html in user skills');
  ok(all.subsets['html-master'].best.kind === 'project skills' && all.subsets['html-master'].hits.length === 1, 'detect: html-master in project skills, the wrong-name folder ignored');
  const txt = run(router, ['detect', '--claude-dir', c2, '--project', p2]).stdout;
  ok(/html-sensei:\*plugin cache: .*abc123/.test(txt) && /goat-html:\*user skills/.test(txt), 'detect: text output names kind and path');

  const c3 = path.join(base, 'claude3'), elsewhere = path.join(base, 'somewhere', 'html-package');
  fakeSensei(elsewhere, 'html-package');
  write(path.join(elsewhere, 'skills', 'goat-html', 'SKILL.md'), skillMd('goat-html'));
  write(path.join(c3, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'html-package@local': [{ scope: 'user', installPath: elsewhere }], 'other@x': [{ installPath: base }] } }));
  const inst = d(c3, proj);
  ok(inst.subsets['html-sensei'].best && inst.subsets['html-sensei'].best.kind === 'installed plugin html-package@local', 'detect: installed_plugins.json entry for html-package', JSON.stringify(inst.subsets['html-sensei'].hits.map(h => h.kind)));
  ok(inst.subsets['goat-html'].found && /inside installed plugin/.test(inst.subsets['goat-html'].best.kind), 'detect: goat-html inside the installed plugin');
  ok(!inst.subsets['html-master'].found && has(inst.notes, /HTML-Master not found/), 'detect: missing html-master noted');

  const pkg = path.join(base, 'pkg', 'html-package');
  fakeSensei(pkg, 'html-package');
  write(path.join(pkg, 'skills', 'goat-html', 'SKILL.md'), skillMd('goat-html'));
  write(path.join(pkg, 'skills', 'html-master', 'SKILL.md'), skillMd('html-master'));
  const pr = path.join(pkg, 'skills', 'html-router', 'scripts', 'router.mjs');
  write(pr, read(path.join(HERE, 'router.mjs')));
  const inPkg = JSON.parse(run(pr, ['detect', '--json', '--claude-dir', emptyC, '--project', proj]).stdout);
  ok(inPkg.mode === 'all three' && inPkg.subsets['html-sensei'].best.kind === 'combined package', 'detect: the combined package layout', inPkg.mode);
  ok(inPkg.subsets['goat-html'].best.kind === 'sibling of html-router' && inPkg.subsets['html-master'].best.kind === 'sibling of html-router', 'detect: siblings inside the combined package');
  const envHit = JSON.parse(run(router, ['detect', '--json', '--claude-dir', emptyC, '--project', proj], { ...cleanEnv(), CLAUDE_PLUGIN_ROOT: pkg }).stdout);
  ok(envHit.subsets['html-sensei'].best && envHit.subsets['html-sensei'].best.kind === 'env CLAUDE_PLUGIN_ROOT', 'detect: CLAUDE_PLUGIN_ROOT honoured');

  const c4 = path.join(base, 'claude4');
  write(path.join(c4, 'skills', 'html-sensei', 'SKILL.md'), skillMd('html-sensei'));
  const bare = d(c4, proj);
  ok(bare.subsets['html-sensei'].found && !bare.subsets['html-sensei'].best.complete && has(bare.notes, /without the plugin lib/), 'detect: bare skills without lib/ found and flagged incomplete');
}

// ---------------------------------------------------------------- profile
{
  const base = path.join(TMP, 'profile');
  const router = standaloneRouter(path.join(base, 'alone'));
  const emptyC = path.join(base, 'empty-claude'); fs.mkdirSync(emptyC, { recursive: true });
  const brief = path.join(FIX, 'brief-good.md');

  const p1 = path.join(base, 'direct');
  write(path.join(p1, '.sensei', 'profile.json'), JSON.stringify({ outputs: { 'src/index.html': 'dist/page.html' }, motion: 'calm' }));
  const r1 = run(router, ['profile', brief, '--project', p1, '--claude-dir', emptyC]);
  const prof = JSON.parse(read(path.join(p1, '.sensei', 'profile.json')));
  ok(r1.status === 0 && /written directly/.test(r1.stdout), 'profile: written directly without HTML-Sensei', r1.stdout + r1.stderr);
  ok(prof.deliverable === 'single-file' && prof.offline === true && prof.motion === 'cinematic' && prof.budget === null && prof.tier === 'premium' && prof.verify.widths.join() === '375,768,1440' && prof.verify.browsers[0] === 'chromium', 'profile: documented shape and values');
  ok(prof.outputs && prof.outputs['src/index.html'] === 'dist/page.html', 'profile: keeps keys it does not own (outputs)');
  ok(JSON.parse(read(path.join(p1, '.sensei', 'licences.json'))).rows.length === 0, 'profile: empty ledger created');
  const st = JSON.parse(read(path.join(p1, '.sensei', 'state.json')));
  ok(/^Reading this as: a landing page/.test(st.goal) && st.next === 'the 3D pot hero' && Array.isArray(st.done), 'profile: state.json started with goal and first slice', JSON.stringify(st));
  ok(read(path.join(p1, '.sensei', 'brief.md')) === read(brief).replace(/\r\n/g, '\n'), 'profile: brief copied to .sensei/brief.md');
  const loaded = await import(pathToFileURL(path.join(HERE, 'router.mjs')).href);
  for (const [k, allowed] of Object.entries(loaded.ENUMS)) ok(allowed.includes(prof[k]), `profile: ${k} is an allowed value`);

  const fake = path.join(base, 'fake-sensei'); fakeSensei(fake);
  const p2 = path.join(base, 'via-fake');
  const r2 = run(router, ['profile', brief, '--project', p2, '--claude-dir', emptyC, '--sensei', fake]);
  const fp = JSON.parse(read(path.join(p2, '.sensei', 'profile.json')));
  ok(r2.status === 0 && fp.fake === true && fp.deliverable === 'single-file' && fp.budget === null && fp['verify.widths'].length === 3 && Array.isArray(fp.languages), 'profile: --set values passed to HTML-Sensei profile.mjs', JSON.stringify(fp));
  ok(JSON.parse(read(path.join(p2, '.sensei', 'licences.json'))).fake === true, 'profile: HTML-Sensei ledger init used');

  const refuse = path.join(base, 'refusing-sensei'); fakeSensei(refuse, 'html-sensei', { refuse: true });
  const p3 = path.join(base, 'refused');
  const r3 = run(router, ['profile', brief, '--project', p3, '--claude-dir', emptyC, '--sensei', refuse]);
  ok(r3.status === 1 && /refused the profile/.test(r3.stdout) && !fs.existsSync(path.join(p3, '.sensei', 'profile.json')), 'profile: a refusal from HTML-Sensei is passed on, exit 1');

  const p4 = path.join(base, 'invalid');
  const r4 = run(router, ['profile', path.join(FIX, 'brief-bad.md'), '--project', p4, '--claude-dir', emptyC]);
  ok(r4.status === 1 && !fs.existsSync(path.join(p4, '.sensei')), 'profile: an invalid brief writes nothing, exit 1');

  const p5 = path.join(base, 'dry');
  const r5 = run(router, ['profile', brief, '--project', p5, '--claude-dir', emptyC, '--dry-run']);
  ok(r5.status === 0 && /would write/.test(r5.stdout) && !fs.existsSync(p5), 'profile: --dry-run writes nothing');

  // The real HTML-Sensei, when this skill sits where it can be found (the build tree or the combined package).
  const real = R.detect({ project: base, claudeDir: emptyC, env: cleanEnv() }).subsets['html-sensei'].best;
  if (real && real.complete && fs.existsSync(path.join(real.path, 'lib', 'profile.mjs')) && read(path.join(real.path, 'lib', 'profile.mjs')).includes('loadProfile')) {
    const p6 = path.join(base, 'real');
    const r6 = run(path.join(HERE, 'router.mjs'), ['profile', path.join(SKILL, 'examples', 'brief-course.md'), '--project', p6, '--claude-dir', emptyC]);
    const rp = fs.existsSync(path.join(p6, '.sensei', 'profile.json')) ? JSON.parse(read(path.join(p6, '.sensei', 'profile.json'))) : {};
    ok(r6.status === 0 && /HTML-Sensei profile\.mjs/.test(r6.stdout) && rp.deliverable === 'course' && rp.rtl === true && rp.languages.join() === 'en,fa' && rp.licence_mode === 'personal' && rp.budget === null && rp.verify.widths.length === 3, `profile: through the real HTML-Sensei profile.mjs (${real.kind})`, r6.stdout + r6.stderr);
    const show = run(real.profile_script, ['--project', p6, '--show']);
    ok(/profile: /.test(show.stdout) && !/warning/.test(show.stdout), 'profile: the real loader reads it back with no warnings', show.stdout);
  } else console.log(`skip real HTML-Sensei profile test: not found from ${SKILL}`);
}

// ---------------------------------------------------------------- the skill folder: links, map, evals, text rules
{
  const files = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  walk(SKILL);
  const md = files.filter(f => f.endsWith('.md'));
  let links = 0, broken = [];
  for (const f of md) {
    for (const m of read(f).matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(m[1])) continue;
      links++;
      if (!fs.existsSync(path.resolve(path.dirname(f), m[1]))) broken.push(`${path.relative(SKILL, f)} -> ${m[1]}`);
    }
  }
  ok(links > 10 && !broken.length, `every Markdown link resolves (${links} links)`, broken.join('; '));

  const skillText = read(path.join(SKILL, 'SKILL.md'));
  const lines = skillText.split('\n').length;
  ok(lines < 500, `SKILL.md is under 500 lines (${lines})`);
  ok(/^---\nname: html-router\ndescription: /.test(skillText), 'SKILL.md front matter: name html-router');
  const dm = skillText.match(/^description: (".*")$/m);
  let desc = null; try { desc = dm && JSON.parse(dm[1]); } catch {}
  ok(desc && desc.length < 900, `description is one double-quoted string under 900 characters (installer limit 1024): ${desc ? desc.length : 'not quoted'}`);
  for (const t of ['I want to build an HTML file for', 'interactive course', 'presentation', 'landing page', 'website', 'dashboard', 'game', 'motion graphic', 'single HTML file']) ok(skillText.split('\n---')[0].includes(t), `description has the trigger "${t}"`);

  // The routing map's component paths, against the real subsets when they are found.
  const det = R.detect({ project: SKILL, env: cleanEnv() });
  const map = read(path.join(SKILL, 'references', 'routing-map.md'));
  const sect = n => (map.split(/\n## /).find(s => s.startsWith(`${n}.`)) || '');
  const rows = s => s.split('\n').filter(l => /^\| `/.test(l)).map(l => l.split('|').map(c => c.trim()));
  const ticks = c => [...(c || '').matchAll(/`([^`]+)`/g)].map(m => m[1]);
  const sensei = det.subsets['html-sensei'].best, goat = det.subsets['goat-html'].best, master = det.subsets['html-master'].best;
  if (sensei && sensei.complete) {
    const missing = [];
    let n = 0;
    for (const r of rows(sect(2))) { const name = ticks(r[1])[0]; for (const p of [ 'SKILL.md', ...ticks(r[3])]) { n++; if (!fs.existsSync(path.join(sensei.path, 'skills', name, p))) missing.push(`${name}/${p}`); } }
    const skillsOnDisk = fs.readdirSync(path.join(sensei.path, 'skills')).filter(s => fs.existsSync(path.join(sensei.path, 'skills', s, 'SKILL.md')) && s.startsWith('sensei') || s === 'html-sensei');
    const named = rows(sect(2)).map(r => ticks(r[1])[0]);
    ok(skillsOnDisk.every(s => named.includes(s)) && named.length === 25, `routing map names all 25 HTML-Sensei skills (${named.length})`, skillsOnDisk.filter(s => !named.includes(s)).join(', '));
    ok(!missing.length, `routing map HTML-Sensei paths exist (${n} checked)`, missing.join(', '));
    const agents = rows(sect(3)).map(r => ticks(r[1])[0]);
    const onDisk = fs.readdirSync(path.join(sensei.path, 'agents')).map(f => f.replace(/\.md$/, ''));
    ok(agents.length === 16 && onDisk.every(a => agents.includes(a)), `routing map names all 16 agents (${agents.length})`);
    const hooks = fs.readdirSync(path.join(sensei.path, 'hooks')).filter(f => f.endsWith('.mjs'));
    ok(hooks.every(h => sect(4).includes(h)), 'routing map names every hook', hooks.filter(h => !sect(4).includes(h)).join(', '));
  } else console.log('skip routing map check for HTML-Sensei: not found');
  for (const [sub, n, label] of [[goat, 5, 'GOAT HTML'], [master, 6, 'HTML-Master']]) {
    if (!sub) { console.log(`skip routing map check for ${label}: not found`); continue; }
    const missing = []; let count = 0;
    for (const r of rows(sect(n))) {
      let dir = '';
      for (const t of ticks(r[1])) {
        if (/^SKILL\.md$/.test(t)) { count++; if (!fs.existsSync(path.join(sub.path, t))) missing.push(t); continue; }
        const p = t.includes('/') ? t : dir + t; if (t.includes('/')) dir = t.slice(0, t.lastIndexOf('/') + 1);
        count++; if (!fs.existsSync(path.join(sub.path, p))) missing.push(p);
      }
    }
    ok(!missing.length && count > 20, `routing map ${label} paths exist (${count} checked)`, missing.join(', '));
    const want = n === 5 ? ['references', 'scripts', 'assets'] : ['references', 'scripts'];
    const all = want.flatMap(d => fs.readdirSync(path.join(sub.path, d)).filter(f => fs.statSync(path.join(sub.path, d, f)).isFile()).map(f => `${d}/${f}`));
    const sec = sect(n);
    const unnamed = all.filter(p => !sec.includes(p) && !sec.includes(path.basename(p)));
    ok(!unnamed.length, `routing map names every ${label} reference, script${n === 5 ? ' and asset' : ''}`, unnamed.join(', '));
  }

  let ev = null; try { ev = JSON.parse(read(path.join(SKILL, 'evals', 'evals.json'))); } catch (e) { ok(false, 'evals.json parses', e.message); }
  if (ev) {
    ok(ev.skill_name === 'html-router' && Array.isArray(ev.evals) && ev.evals.length >= 8, `evals.json parses with ${ev.evals.length} evals`);
    const types = new Set(ev.evals.map(e => e.deliverable));
    for (const t of ['single-file page', 'landing page', 'website', 'interactive course', 'presentation', 'dashboard', 'game', 'motion graphic', 'tool']) ok(types.has(t), `evals cover ${t}`);
    ok(ev.evals.every(e => e.prompt && Array.isArray(e.interview_assertions) && e.interview_assertions.length >= 4 && Array.isArray(e.routing_assertions) && e.routing_assertions.length >= 3 && Array.isArray(e.must_route) && e.must_route.length), 'every eval has interview and routing assertions and components to route');
  }

  // Patterns are built from reversed strings so this file does not contain what it searches for.
  const rev = s => s.split('').reverse().join('');
  const owner = ['dajjaS', 'inarI', 'MAS\\s*rehcaeT', 'epuslelak'].map(s => new RegExp(rev(s).replace('*s\\', '\\s*'), 'i'));
  const DASH = new RegExp('[\\u2013\\u2014]'), RECORD = new RegExp('HTML-' + 'Record', 'i');
  const US = new RegExp('\\b(' + ['roloc', 'srovaf', 'rovaf', 'roivaheb', 'retnec', 'ezylana', 'ezinagro', 'ezimitpo', 'golatac'].map(rev).join('|') + ')\\b');
  const bad = [];
  for (const f of files) {
    const buf = fs.readFileSync(f), t = buf.toString('utf8'), rel = path.relative(SKILL, f);
    if (owner.some(re => re.test(t) || re.test(buf.toString('latin1')))) bad.push(`${rel}: owner name`);
    if (RECORD.test(t)) bad.push(`${rel}: a dropped document is named`);
    if (DASH.test(t)) bad.push(`${rel}: long dash`);
    if (t.includes('\r')) bad.push(`${rel}: CR line ending`);
    const prose = t.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
    const us = prose.match(US);
    if (us) bad.push(`${rel}: American spelling "${us[1]}"`);
  }
  ok(!bad.length, `text rules on ${files.length} files (owner names, dropped documents, dashes, LF, British spelling)`, bad.join('; '));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log(`scratch kept: ${TMP}`); else fs.rmSync(TMP, { recursive: true, force: true });
process.exitCode = fail ? 1 : 0;
