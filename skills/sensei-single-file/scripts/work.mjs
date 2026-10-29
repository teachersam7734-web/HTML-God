// work.mjs: where this skill's tests and experiments write, and how they find optional npm tools. Nothing is written
// inside the plugin. Original HTML-Sensei code.
//   SENSEI_WORK  scratch folder (default: <OS temp>/sensei-single-file)
//   SENSEI_NPM   a folder whose node_modules holds esbuild, sharp, svgo (default: the current folder, walking up)
// verified: Windows 10, Node 24 (used by every test in this folder).
// not verified: macOS and Linux (os.tmpdir and createRequire are standard).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WORK = path.resolve(process.env.SENSEI_WORK || path.join(os.tmpdir(), 'sensei-single-file'));
fs.mkdirSync(WORK, { recursive: true });
export const PKG = path.join(WORK, 'pkg');
export const FIXTURES = path.resolve(HERE, '..', 'fixtures');
// Browser and server helpers live in sensei-verify (one copy in the plugin).
export const VERIFY_LIB = path.resolve(HERE, '..', '..', 'sensei-verify', 'scripts', 'lib');

export function ensurePkg() {
  if (!fs.existsSync(path.join(PKG, 'index.html'))) execFileSync(process.execPath, [path.join(HERE, 'make-fixture.mjs')], { stdio: 'inherit' });
  return PKG;
}

export function npmRequire(name) {
  const base = process.env.SENSEI_NPM ? path.resolve(process.env.SENSEI_NPM) : process.cwd();
  try { return createRequire(path.join(base, 'x.js'))(name); }
  catch (e) {
    const err = new Error(`${name} not found from ${base}. Install it in the project (npm i -D ${name}) or set SENSEI_NPM to a folder whose node_modules has it.`);
    err.code = 'NO_' + name.toUpperCase(); throw err;
  }
}
