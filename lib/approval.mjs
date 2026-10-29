// approval.mjs: the paid-generation gate, held as data rather than trust (pattern from the motion-graphics
// music-video plugin: "this records a plan hash; it cannot supply user consent itself").
//
// The plan (what will be generated, by which service, how many calls and retries, estimated cost) is written to
// .sensei/plan.md and shown to the user. Only after the user approves in their own words is it recorded:
//   node approval.mjs approve --words "<the user's words, quoted>" [--plan .sensei/plan.md] [projectDir]
// Recording stores the plan's SHA-256. Any later edit to the plan changes the hash and voids the approval, so a
// bigger spend needs a new yes. guard-process refuses paid calls until a matching approval exists.
//   node approval.mjs status [projectDir]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PLAN_REL = path.join('.sensei', 'plan.md');
const APPROVALS_REL = path.join('.sensei', 'approvals.json');

export const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

export function planHash(projectDir, planRel = PLAN_REL) {
  const f = path.resolve(projectDir, planRel);
  return fs.existsSync(f) ? sha256(fs.readFileSync(f)) : null;
}

export function readApprovals(projectDir) {
  try { return JSON.parse(fs.readFileSync(path.join(projectDir, APPROVALS_REL), 'utf8')).approvals || []; } catch { return []; }
}

export function approve(projectDir, words, planRel = PLAN_REL) {
  if (!words || words.trim().length < 3) throw new Error('quote the user\'s approval in --words');
  const hash = planHash(projectDir, planRel);
  if (!hash) throw new Error(`no plan at ${planRel}; write it and show it to the user first`);
  const approvals = readApprovals(projectDir);
  approvals.push({ plan: planRel.replace(/\\/g, '/'), sha256: hash, words: words.trim(), at: new Date().toISOString() });
  fs.mkdirSync(path.join(projectDir, '.sensei'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, APPROVALS_REL), JSON.stringify({ approvals }, null, 2) + '\n');
  return hash;
}

// { ok, reason, hash }
export function checkApproval(projectDir, planRel = PLAN_REL) {
  const hash = planHash(projectDir, planRel);
  if (!hash) return { ok: false, reason: `no plan file at ${planRel}` };
  const hit = readApprovals(projectDir).find(a => a.sha256 === hash);
  if (!hit) return { ok: false, reason: readApprovals(projectDir).length ? 'the plan changed after it was approved (hash differs)' : 'the plan has not been approved', hash };
  return { ok: true, hash, approval: hit };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2); const cmd = a[0];
  const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const positional = a.filter((x, i) => i > 0 && !x.startsWith('--') && !a[i - 1].startsWith('--'));
  const dir = path.resolve(positional[0] || process.cwd());
  const plan = opt('--plan') || PLAN_REL;
  try {
    if (cmd === 'approve') console.log(`approved plan ${plan} sha256 ${approve(dir, opt('--words'), plan)}`);
    else { const r = checkApproval(dir, plan); console.log(r.ok ? `approved: ${r.hash} ("${r.approval.words}")` : `not approved: ${r.reason}`); process.exit(r.ok ? 0 : 1); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
