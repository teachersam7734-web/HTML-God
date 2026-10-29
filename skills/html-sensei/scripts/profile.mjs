#!/usr/bin/env node
// profile.mjs: write, update or show the project profile, .sensei/profile.json, the file every HTML-Sensei hook and
// gate reads (architecture section 2). It goes through the plugin's lib/profile.mjs, so the defaults and the checks
// are the hooks' own.
//
//   node profile.mjs [--project DIR] --show
//   node profile.mjs [--project DIR] --set deliverable=course --set languages='["en","fa"]' --set rtl=true \
//        --set motion=lively --set licence_mode=personal --set verify.widths='[360,768,1440]'
//
// Values are read as JSON when they parse (true, null, 3, ["en"]) and as plain strings otherwise. Keys not given keep
// their current value, or the default when there is no profile yet. "budget" stays null unless the user asked for a
// budget (owner rule: weight is reported, never a gate). After writing, the file is read back through the same loader
// the hooks use; if the loader would correct any value (one outside the allowed list), the previous file is restored,
// the problem printed, and the exit code is 1.
// Project: --project, else CLAUDE_PROJECT_DIR, else the current folder.
//
// verified: Windows 10, Node 24: written in a scratch folder with --set for every key and read back; an invalid
//           deliverable ("website") refused with the old profile kept; --show prints the merged profile or the defaults.
// not verified: macOS and Linux (plain fs calls).
// Original HTML-Sensei code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { loadProfile, DEFAULTS } = await import(pathToFileURL(path.resolve(HERE, '..', '..', '..', 'lib', 'profile.mjs')).href);

const a = process.argv.slice(2);
const project = path.resolve(a.includes('--project') ? a[a.indexOf('--project') + 1] : process.env.CLAUDE_PROJECT_DIR || process.cwd());
const sets = a.map((x, i) => x === '--set' ? a[i + 1] : null).filter(Boolean);
const file = path.join(project, '.sensei', 'profile.json');

if (!sets.length) {
  const r = loadProfile({ projectDir: project });
  console.log(r.found ? `profile: ${r.path}` : `no profile in ${project}: these are the defaults the hooks use`);
  console.log(JSON.stringify(r.profile, null, 2));
  for (const w of r.warnings) console.log('warning:', w);
  process.exit(0);
}

let cur = {};
if (fs.existsSync(file)) { try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`existing profile is not valid JSON (${e.message}); starting from the defaults`); } }
const next = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...cur };
for (const s of sets) {
  const eq = s.indexOf('=');
  if (eq < 1) { console.error(`--set needs key=value, got "${s}"`); process.exit(2); }
  const key = s.slice(0, eq), raw = s.slice(eq + 1);
  let val; try { val = JSON.parse(raw); } catch { val = raw; }
  if (!key.includes('.') && !(key in DEFAULTS)) console.log(`note: "${key}" is not a profile key the hooks read (${Object.keys(DEFAULTS).join(', ')}); written anyway`);
  if (key.includes('.')) { const [k1, k2] = key.split('.'); next[k1] = { ...(next[k1] || {}), [k2]: val }; } else next[key] = val;
}
fs.mkdirSync(path.dirname(file), { recursive: true });
const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
const back = loadProfile({ projectDir: project });
if (back.warnings.length) {                      // never leave a profile the hooks would silently correct
  if (before) fs.writeFileSync(file, before); else fs.unlinkSync(file);
  for (const w of back.warnings) console.log('ERROR:', w);
  console.log('nothing changed: fix the value and run again');
  process.exit(1);
}
console.log(`wrote ${file}`);
console.log(JSON.stringify(back.profile, null, 2));
