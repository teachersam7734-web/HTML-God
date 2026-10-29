// lint/secrets.mjs: API keys and tokens in text about to be written, and shell commands that would print them.
// Keys belong in the plugin's userConfig with "sensitive": true (the credential store) or in the environment,
// never in a file, a page, a log or the conversation.
import { finding } from '../gate.mjs';

// Provider formats with a recognisable prefix. Lengths are lower bounds so test keys still match.
const KEYS = [
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['openai-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['stripe-key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/],
  ['elevenlabs-key', /\bsk_[a-f0-9]{40,}\b/],
  ['huggingface-token', /\bhf_[A-Za-z0-9]{30,}\b/],
  ['replicate-token', /\br8_[A-Za-z0-9]{30,}\b/],
  ['fal-key', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32}\b/],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY( BLOCK)?-----/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
];

// A name says "secret" when one of its whole segments (split at camelCase, _, -, . and $) is secret, token, password,
// passwd, apikey or credential(s), or two adjacent segments are api key, access key, private key, secret key or
// client secret. So authorName, tokenizer, TOKENIZER_PATH and designTokens are ordinary names.
const SECRET_WORD = /^(?:secret|secrets|token|password|passwd|pwd|apikey|credential|credentials|bearer)$/;
const SECRET_PAIR = /^(?:api|access|private|secret|client|signing|master)$/;
export function secretName(name) {
  const words = String(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (SECRET_WORD.test(words[i])) return true;
    if (SECRET_PAIR.test(words[i]) && /^(?:key|secret|token)$/.test(words[i + 1] || '')) return true;
  }
  return false;
}

// Shannon entropy in bits per character.
export function entropy(v) { const c = {}; for (const ch of v) c[ch] = (c[ch] || 0) + 1; let e = 0; for (const k in c) { const p = c[k] / v.length; e -= p * Math.log2(p); } return e; }
// A value made of words and numbers joined by separators ("wordpiece-uncased-v2-2024") is a label, not a key.
const wordy = v => { const seg = v.split(/[-_. /:]+/).filter(Boolean); return seg.length >= 3 && seg.every(x => /^\d+$/.test(x) || x.length <= 3 || (/^[A-Za-z]+$/.test(x) && /[aeiouy]/i.test(x) && (x.match(/[aeiouy]/gi).length / x.length) >= 0.2 && (x === x.toLowerCase() || x === x.toUpperCase() || /^[A-Z][a-z]+$/.test(x)))); };
// Documented example credentials (the AWS documentation pair and the like) and obvious placeholders.
const EXAMPLE = /EXAMPLE|example|sample|dummy|placeholder|redacted|xxxx|0000000000|1234567890|abcdef(?:ghij)?$/;
export function randomLooking(v) {
  v = String(v);
  if (v.length < 16 || EXAMPLE.test(v) || wordy(v)) return false;
  if (!/[0-9]/.test(v) || !/[A-Za-z]/.test(v)) return false;
  return entropy(v) >= (/^[0-9a-f]+$/i.test(v) ? 3.0 : 3.3);
}

// name = "long literal" where the name says key, token, secret or password, and the value looks random.
const ASSIGN = /\b([A-Za-z0-9_.$-]{0,127}[A-Za-z0-9_$])["']?\s*[:=]\s*["'`]([^"'`\s]{16,})["'`]/g;
// NAME=value lines (.env files, shell assignments) with no quotes.
const ENV_LINE = /^[ \t]*(?:export[ \t]+|\$env:)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*([^\s#'"`;|&]{16,})/gm;
// An Authorization header (or any "Bearer" value) carrying a literal token.
const BEARER = /\bBearer[ \t]+([A-Za-z0-9._~+\/=-]{16,})/g;
const PLACEHOLDER = /^(?:x+|\*+|\.+|<[^>]+>|\$\{[^}]+\}|\$[A-Za-z_]|\{\{[^}]+\}\}|%[A-Za-z_]|your[_-]|change[_-]?me|placeholder|example|dummy|test[_-]?key|sk-\.\.\.|process\.env|import\.meta\.env)/i;

function redact(s) { s = String(s); return s.length <= 10 ? '***' : `${s.slice(0, 6)}...${s.slice(-2)} (${s.length} chars)`; }

export function scanText(text) {
  const out = [];
  // Binary image/font payloads are not source. Mask them before assignment scanning so a
  // self-contained HTML file cannot exhaust the regexp stack on megabytes of base64.
  // Other data URIs and all surrounding source remain scanned.
  const t = String(text || '').replace(/data:(?:image\/(?:png|jpe?g|webp|gif|avif)|font\/(?:woff2?|ttf|otf));base64,[A-Za-z0-9+/=]+/gi, 'data:binary;base64,[embedded-payload]');
  for (const [id, re] of KEYS) {
    const m = [...t.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))].find(x => !EXAMPLE.test(x[0]));
    if (m) out.push(finding(`secret:${id}`, 'block', `A ${id.replace(/-/g, ' ')} is written in plain text.`,
      { fix: 'Remove it. Read it at run time from an environment variable (or the plugin userConfig with "sensitive": true), and rotate the key if it was ever saved or shown.', evidence: [redact(m[0])] }));
  }
  const seen = v => out.some(f => f.evidence && f.evidence.some(e => e.includes(redact(v))));
  for (const [re, id, label] of [[ASSIGN, 'assigned-literal', 'is set to'], [ENV_LINE, 'env-literal', 'is set to']]) {
    for (const m of t.matchAll(re)) {
      const name = m[1], val = m[2];
      if (!(id === 'env-literal' ? envSecretName : secretName)(name) || PLACEHOLDER.test(val) || /^[\w.]+\(/.test(val) || !randomLooking(val) || seen(val)) continue;
      out.push(finding(`secret:${id}`, 'block', `"${name}" ${label} a literal secret.`,
        { fix: `Use process.env.${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')} (or the userConfig value) instead of the literal. In a .env file keep it out of the repository and out of the conversation.`, evidence: [`${name} = ${redact(val)}`] }));
      break;
    }
  }
  for (const m of t.matchAll(BEARER)) {
    if (PLACEHOLDER.test(m[1]) || !randomLooking(m[1]) || seen(m[1])) continue;
    out.push(finding('secret:bearer-literal', 'block', 'A Bearer token is written in plain text.',
      { fix: 'Build the header from the environment at run time ("Bearer " + process.env.NAME, or "Bearer $NAME" in a shell) and rotate the token if it was ever saved or shown.', evidence: [`Bearer ${redact(m[1])}`] }));
    break;
  }
  return out;
}

/// Shell commands (Bash or PowerShell) that would print a secret into the transcript. Variable names are judged by
// whole segment, like secretName, plus KEY on its own (FAL_KEY, XI_KEY): TOKENIZER_PATH is not a secret.
export const envSecretName = n => secretName(n) || /(?:^|_)KEY(?:$|_)/i.test(n) || /[a-z0-9]Key$/.test(n);
const V = String.raw`([A-Za-z_][A-Za-z0-9_]*)`;
// A file that holds secrets, as a word in a command (.env and .env.local, not .env.example, .env.sample or .env.template).
const SECRET_FILE = String.raw`(?:^|[\s"'=(,\\/])(?:\.env(?:\.(?!example\b|sample\b|template\b|dist\b)[\w-]+)?|\.npmrc|\.netrc|\.pypirc|credentials(?:\.json)?|\.git-credentials|id_rsa|id_ed25519)(?=$|["'\s;|&),])`;
const READER = String.raw`\b(?:cat|type|more|less|head|tail|Get-Content|gc|bat|sed|awk|gawk|grep|egrep|rg|findstr|Select-String|sls|strings|xxd|od|nl|cut|sort|uniq|perl|ruby)\b`;
const PRINTERS = [
  // [id, regex, index of the captured variable name to judge (0: none)]
  ['echo-secret-var', new RegExp(String.raw`\b(?:echo|printf|Write-(?:Host|Output))\b[^|;&\n]*?(?:\$env:|\$\{?|%)${V}`, 'gi'), 1],
  ['print-secret-env', new RegExp(String.raw`(?:\bprintenv\s+|\b(?:Get-Item|Get-ChildItem|gci|dir|ls)\s+env:)${V}`, 'gi'), 1],
  ['dump-env', /(?:^|[;&|]\s*|\n\s*)(?:printenv|env|set|export\s+-p|Get-ChildItem\s+env:|gci\s+env:|dir\s+env:|ls\s+env:)\s*(?:$|[|;&\n])/gim, 0],
  ['node-print-secret', new RegExp(String.raw`console\.(?:log|error|dir|info|warn)\([^)]*process\.env(?:\.|\[['"])${V}`, 'gi'), 1],
  ['node-print-secret', new RegExp(String.raw`\b(?:node|bun|deno)\b[^\n]*?\s(?:-p|--print)\b[^\n]*?process\.env(?:\.|\[['"])${V}`, 'gi'), 1],
  ['python-print-secret', new RegExp(String.raw`print\([^)]*os\.environ(?:\.get\(|\[)['"]${V}`, 'gi'), 1],
  ['read-secret-file', new RegExp(String.raw`${READER}[^|;&\n]*?${SECRET_FILE}`, 'gim'), 0],
  ['read-secret-file', new RegExp(String.raw`\b(?:node|bun|deno)\b[^\n]*?\s(?:-e|--eval|-p|--print|eval)\b[^\n]*?${SECRET_FILE}|\bpython[\d.]*\b[^\n]*?\s-c\b[^\n]*?${SECRET_FILE}`, 'gim'), 0],
];

export function scanCommand(cmd) {
  const out = []; const c = String(cmd || '');
  for (const [id, re, group] of PRINTERS) {
    const m = [...c.matchAll(re)].find(x => !group || envSecretName(x[group]));
    if (m && !out.some(f => f.id === `secret:${id}`)) out.push(finding(`secret:${id}`, 'block', 'This command would print a secret (or every environment variable) into the transcript.',
      { fix: 'Check that a variable is set without printing it, for example `[ -n "$NAME" ] && echo set` or `if ($env:NAME) { "set" }`, pass keys to programs through the environment, and load .env with node --env-file=.env rather than printing it.', evidence: [m[0].trim().slice(0, 80)] }));
  }
  return out.concat(scanText(c));
}
