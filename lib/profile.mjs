// profile.mjs: reads .sensei/profile.json (architecture section 2) and fills every missing key with the defaults.
// Hooks change behaviour by profile, not by guesswork. A missing profile is not an error: the defaults apply and
// the SessionStart probe says so once per session.
//
// Defaults: where section 2 lists alternatives ("a | b | c"), the first is the default, except licence_mode,
// which defaults to "commercial" because the stricter licence rules are the safe side when nobody has said.
import fs from 'node:fs';
import path from 'node:path';

export const ENUMS = {
  deliverable: ['single-file', 'site', 'deck', 'course', 'dashboard', 'game', 'film', 'component'],
  motion: ['cinematic', 'lively', 'calm'],
  licence_mode: ['personal', 'commercial'],
};

export const DEFAULTS = Object.freeze({
  deliverable: 'single-file',
  offline: true,
  languages: ['en'],
  rtl: false,
  budget: null,            // no page-weight budget: weight is reported, never gated
  tier: 'premium',
  motion: 'cinematic',
  licence_mode: 'commercial',
  react: false,
  verify: { browsers: ['chromium'], widths: [375, 768, 1440] },
});

const clone = o => JSON.parse(JSON.stringify(o));

// Nearest .sensei/profile.json walking up from `from` (a file or folder), else in projectDir.
export function findProfile(from, projectDir) {
  const tried = new Set();
  let dir = from ? path.resolve(from) : null;
  if (dir && fs.existsSync(dir) && fs.statSync(dir).isFile()) dir = path.dirname(dir);
  else if (dir && path.extname(dir)) dir = path.dirname(dir);
  while (dir && !tried.has(dir)) {
    tried.add(dir);
    const f = path.join(dir, '.sensei', 'profile.json');
    if (fs.existsSync(f)) return f;
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  if (projectDir) { const f = path.join(projectDir, '.sensei', 'profile.json'); if (fs.existsSync(f)) return f; }
  return null;
}

export function loadProfile({ projectDir, from } = {}) {
  const file = findProfile(from, projectDir);
  const profile = clone(DEFAULTS); const warnings = [];
  if (!file) return { profile, found: false, path: null, root: projectDir || null, warnings };
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { warnings.push(`profile.json is not valid JSON (${e.message}); defaults in use`); return { profile, found: false, path: file, root: path.dirname(path.dirname(file)), warnings }; }
  for (const [k, v] of Object.entries(raw || {})) {
    if (k === 'verify' && v && typeof v === 'object') profile.verify = { ...profile.verify, ...v };
    else profile[k] = v;
  }
  for (const [k, allowed] of Object.entries(ENUMS)) {
    if (!allowed.includes(profile[k])) { warnings.push(`profile.${k} "${profile[k]}" is not one of ${allowed.join(', ')}; using "${DEFAULTS[k]}"`); profile[k] = DEFAULTS[k]; }
  }
  for (const k of ['offline', 'rtl', 'react']) if (typeof profile[k] !== 'boolean') { warnings.push(`profile.${k} should be true or false`); profile[k] = DEFAULTS[k]; }
  if (profile.budget !== null && typeof profile.budget !== 'object' && typeof profile.budget !== 'number') { warnings.push('profile.budget should be null, a number of KB, or an object'); profile.budget = null; }
  return { profile, found: true, path: file, root: path.dirname(path.dirname(file)), warnings };
}

export function writeProfile(projectDir, values) {
  const dir = path.join(projectDir, '.sensei'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'profile.json');
  fs.writeFileSync(f, JSON.stringify({ ...clone(DEFAULTS), ...values }, null, 2) + '\n');
  return f;
}
