// ledger.mjs: the project's licence ledger (.sensei/licences.json) and the two source lists the licence guard enforces.
//
// NEVER_SHIP: may be used in a user's project (fetched into that project, notice kept), never shipped inside a plugin
//             because their licences forbid redistributing the items themselves.
// IDEAS_ONLY: study the idea, write original code; never copy their code anywhere (no licence, non-commercial, or
//             share-alike terms that do not fit a commercial product).
//
// Each source has `origins` (URLs or package names that mark copied material) and `markers` (text that is itself a
// copy, such as a library's own global or include path). Mentioning a source in prose is fine; the guard looks for
// origins next to code, or for markers.
//
// Ledger row: { id, name, url, licence, use: 'vendored'|'ported'|'fetched'|'idea'|'asset', files: [], notice,
//               attribution, ships_in_plugin: false, added: 'YYYY-MM-DD', note }
// CLI: node ledger.mjs list|check|init [projectDir]
//      node ledger.mjs add [projectDir] --id <id> --licence <licence> --use <use> [--name --url --files --notice
//                          --attribution --note]   (run with help for the full usage)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// A notice is the holder's name after a copyright or licence word on the same line. Built from strings so this file
// does not match its own patterns when the licence guard scans it.
const noticeRe = holder => new RegExp('(?:\u00a9|\\(c\\)|copyright|licen[cs]e)[^\\n]{0,60}' + holder, 'i');

export const NEVER_SHIP = [
  { id: 'react-bits', name: 'React Bits', why: 'MIT plus Commons Clause: use and port inside your own app or site, but never redistribute the components, alone, in a bundle or ported',
    origins: [/reactbits\.dev/i, /github\.com\/DavidHDev\/react-bits/i, /@react-bits\//i, /DavidHDev\/react-bits/i], markers: [], notice: noticeRe('David\\s+Haz') },
  { id: 'tailwind-plus', name: 'Tailwind Plus (Tailwind UI)', why: 'paid licence: end products allowed, redistributing the components or templates is not',
    origins: [/tailwindui\.com/i, /tailwindcss\.com\/plus/i, /@tailwindplus\//i], markers: [], notice: /Tailwind\s+(?:Plus|UI)\s+Licen[cs]e/i },
  { id: 'aceternity-pro', name: 'Aceternity UI Pro', why: 'per-item licence: end products allowed, redistributing items is not',
    origins: [/ui\.aceternity\.com/i, /pro\.aceternity\.com/i], markers: [], notice: noticeRe('Aceternity') },
  { id: 'landingfolio', name: 'Landingfolio', why: 'licence allows end projects but forbids redistributing the item or its source files',
    origins: [/landingfolio\.com/i], markers: [], notice: noticeRe('Landingfolio') },
  { id: 'sceneai', name: 'SceneAI', why: 'asset terms forbid making assets extractable; a data URI in a page or plugin is extractable',
    origins: [/sceneai\.art/i], markers: [], notice: noticeRe('SceneAI') },
];

export const IDEAS_ONLY = [
  { id: 'onetake', name: 'onetake', why: 'PolyForm licence, non-commercial variant: ideas only, no code, because the plugin and its projects may be commercial',
    origins: [/github\.com\/feitangyuan\/onetake/i], markers: [/\bwindow\.OM\s*=/, /\bOM\.(morphRect|zoomThrough|iris|hop)\s*\(/] },
  { id: 'battle-of-austerlitz-film', name: 'Battle-of-Austerlitz-Film', why: 'no licence file: all rights reserved',
    origins: [/WinterArc21\/Battle-of-Austerlitz-Film/i], markers: [] },
  { id: 'pdoomvideo', name: 'PDoomVideo', why: 'no licence file (the npm "ISC" is only the init default); third-party song and character',
    origins: [/JohnHeibel\/PDoomVideo/i], markers: [] },
  { id: 'hologram-particles', name: 'hologram-particles', why: 'no licence file: all rights reserved; models with no stated rights',
    origins: [/cortiz2894\/hologram-particles/i], markers: [] },
  { id: 'threejs-extras', name: 'Three.js-Extras', why: 'no licence stated',
    origins: [/BOXNYC\/Three\.js-Extras/i], markers: [] },
  { id: 'holographic-shader-visualizer', name: 'holographic-shader-visualizer-three.Js', why: 'README badge says MIT but there is no licence file',
    origins: [/YasirAwan4831\/holographic-shader-visualizer/i], markers: [] },
  { id: 'lygia', name: 'lygia', why: 'Prosperity (non-commercial) or paid Patron licence: ideas only',
    origins: [/lygia\.xyz/i, /patriciogonzalezvivo\/lygia/i], markers: [/#include\s+["']lygia\//] },
  { id: 'shadertoy', name: 'Shadertoy shaders', why: 'the default Shadertoy licence is Creative Commons BY, non-commercial, share-alike, unless the author states otherwise',
    origins: [/shadertoy\.com\/view\//i], markers: [] },
];

// Non-commercial licence texts: blocked in commercial mode, warned in personal mode.
export const NONCOMMERCIAL = [
  { id: 'cc-by-nc', re: /\bCC[\s-]BY[\s-]NC\b|[Cc]reative [Cc]ommons [Aa]ttribution[- ][Nn]on-?[Cc]ommercial/ },
  { id: 'polyform-noncommercial', re: /PolyForm\s+Non-?commercial/i },
  { id: 'prosperity', re: /Prosperity\s+Public\s+Licen[cs]e/i },
];

export function ledgerPath(projectDir) { return path.join(projectDir, '.sensei', 'licences.json'); }

export function readLedger(projectDir) {
  const f = ledgerPath(projectDir);
  if (!fs.existsSync(f)) return { rows: [] };
  try { const l = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(l) ? { rows: l } : { rows: l.rows || [] }; }
  catch { return { rows: [], error: 'licences.json is not valid JSON' }; }
}

export function writeLedger(projectDir, ledger) {
  const f = ledgerPath(projectDir); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ rows: ledger.rows || [] }, null, 2) + '\n');
  return f;
}

export function validateRow(row) {
  const errs = [];
  if (!row.id) errs.push('row needs an id');
  if (!row.licence) errs.push(`${row.id}: licence is empty`);
  const never = NEVER_SHIP.find(s => s.id === row.id); const ideas = IDEAS_ONLY.find(s => s.id === row.id);
  if (never && row.ships_in_plugin) errs.push(`${row.id}: never-ship source marked ships_in_plugin (${never.why})`);
  if (ideas && row.use && row.use !== 'idea') errs.push(`${row.id}: ideas-only source recorded as "${row.use}" (${ideas.why})`);
  if (/CC[\s-]?BY(?![\s-]?NC)/i.test(row.licence || '') && !row.attribution) errs.push(`${row.id}: CC BY needs a visible attribution line`);
  if (['vendored', 'ported', 'fetched'].includes(row.use) && !row.notice) errs.push(`${row.id}: copied code needs its notice kept (header comment or LICENSES entry)`);
  return errs;
}

export function addRow(projectDir, row) {
  const l = readLedger(projectDir);
  const i = l.rows.findIndex(r => r.id === row.id);
  const full = { added: new Date().toISOString().slice(0, 10), ships_in_plugin: false, files: [], ...row };
  if (i >= 0) l.rows[i] = { ...l.rows[i], ...full }; else l.rows.push(full);
  writeLedger(projectDir, l);
  return validateRow(full);
}

export function checkLedger(projectDir) {
  const l = readLedger(projectDir);
  return { rows: l.rows, errors: [...(l.error ? [l.error] : []), ...l.rows.flatMap(validateRow)] };
}

// Create an empty ledger when none exists; never overwrites rows. Returns { file, created }.
export function initLedger(projectDir) {
  const f = ledgerPath(projectDir);
  if (fs.existsSync(f)) return { file: f, created: false };
  return { file: writeLedger(projectDir, { rows: [] }), created: true };
}

const USES = ['vendored', 'ported', 'fetched', 'idea', 'asset'];
const USAGE = `usage:
  node ledger.mjs list  [projectDir]
  node ledger.mjs check [projectDir]
  node ledger.mjs init  [projectDir]
  node ledger.mjs add   [projectDir] --id <id> --licence <licence> --use <${USES.join('|')}>
                        [--name <name>] [--url <url>] [--files a.js,b.css] [--notice <header|LICENSES/x.txt>]
                        [--attribution <visible credit line>] [--note <text>]
add creates the ledger if needed, replaces the row with the same id, and exits 1 when the row breaks a rule.`;

// --key value pairs and positionals.
function parseArgs(argv) {
  const opt = {}; const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const eq = a.indexOf('='); if (eq > 0) opt[a.slice(2, eq)] = a.slice(eq + 1); else opt[a.slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
    else pos.push(a);
  }
  return { opt, pos };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [cmd = 'list', ...rest] = process.argv.slice(2);
  const { opt, pos } = parseArgs(rest);
  const dir = path.resolve(pos[0] || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (cmd === 'help' || cmd === '--help' || opt.help) { console.log(USAGE); process.exit(0); }
  if (cmd === 'init') {
    const r = initLedger(dir);
    console.log(r.created ? `created ${r.file} (empty ledger)` : `ledger already exists: ${r.file} (left unchanged)`);
    process.exit(0);
  }
  if (cmd === 'add') {
    const missing = ['id', 'licence', 'use'].filter(k => typeof opt[k] !== 'string' || !opt[k].trim());
    if (missing.length) { console.error(`ledger add: missing --${missing.join(', --')}\n${USAGE}`); process.exit(2); }
    if (!USES.includes(opt.use)) { console.error(`ledger add: --use must be one of ${USES.join(', ')} (got "${opt.use}")`); process.exit(2); }
    const row = { id: opt.id, licence: opt.licence, use: opt.use };
    for (const k of ['name', 'url', 'notice', 'attribution', 'note']) if (typeof opt[k] === 'string') row[k] = opt[k];
    if (typeof opt.files === 'string') row.files = opt.files.split(',').map(s => s.trim()).filter(Boolean);
    const errs = addRow(dir, row);
    console.log(`${errs.length ? 'added with problems' : 'added'}: ${row.id} (${row.licence}, ${row.use}) in ${ledgerPath(dir)}`);
    for (const e of errs) console.log(`PROBLEM ${e}`);
    process.exit(errs.length ? 1 : 0);
  }
  if (cmd !== 'list' && cmd !== 'check') { console.error(`ledger: unknown command "${cmd}"\n${USAGE}`); process.exit(2); }
  const { rows, errors } = checkLedger(dir);
  if (cmd === 'list') for (const r of rows) console.log(`${r.id}\t${r.licence}\t${r.use || ''}\t${(r.files || []).join(', ')}`);
  for (const e of errors) console.log(`PROBLEM ${e}`);
  if (!rows.length) console.log(`ledger is empty (${fs.existsSync(ledgerPath(dir)) ? '.sensei/licences.json' : 'no .sensei/licences.json yet; node ledger.mjs init creates it'})`);
  process.exit(errors.length ? 1 : 0);
}
