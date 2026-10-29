// guard-reviewer.mjs (PreToolUse: Bash, PowerShell): keeps the sensei-reviewer agent read-only through the shell.
// Its tool list already removes Write, Edit, MultiEdit and NotebookEdit; this closes the shell path.
//
// Claude Code puts agent_id and agent_type in the hook input when a tool call comes from a subagent (hooks
// reference, code.claude.com/docs/en/hooks, "Common input fields"); plugin agents are named <plugin>:<agent>, so
// agent_type is "html-sensei:sensei-reviewer" (or "sensei-reviewer"). Every other agent and the main conversation
// are left alone.
//
// Allowed for the reviewer: read-only commands, and node running scripts inside the plugin (the gates, which write
// only into .sensei/gate/). Refused: redirection into a file, in-place edits, deleting, moving, copying, creating
// or touching files, PowerShell writes, git commands that change the tree, package installs, node or python code
// that writes files, and node scripts outside the plugin, plus the plugin's own writers (ledger add or init,
// profile --set, approval approve).
import path from 'node:path';
import { readInput, pluginRoot, block, run } from '../lib/hookio.mjs';
import { shellWrites } from '../lib/shell-writes.mjs';

export const IS_REVIEWER = /(?:^|:)sensei-reviewer$/;
const key = p => { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };
const words = s => [...String(s).matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);
const SINKS = /^(?:\/dev\/null|nul|\$null|&\d)$/i;
const inGate = p => /[\\/]\.sensei[\\/]gate(?:[\\/]|$)/.test(p);

export function reviewerProblems(cmd, cwd, root = pluginRoot()) {
  const out = [];
  const text = String(cmd || '');
  for (const seg of text.split(/\r?\n|;|&&|\|\|/).map(s => s.trim()).filter(Boolean)) {
    for (const m of seg.matchAll(/(?<![0-9&<>=-])>>?\s*("[^"]+"|'[^']+'|[^\s|;&<>()]+)/g)) {
      const t = m[1].replace(/^["']|["']$/g, '');
      if (!SINKS.test(t) && !inGate(t)) out.push(`redirection into ${t}`);
    }
    for (const st of seg.split(/\|(?!\|)/).map(s => s.trim().replace(/^(?:sudo|xargs)\s+(?:-\S+\s+)*/, ''))) {
      const w = words(st); const c = (w[0] || '').toLowerCase().replace(/\.exe$/, '');
      if (/^(?:rm|rmdir|del|erase|rd|remove-item|ri|unlink|shred|mv|move|move-item|mi|ren|rename|rename-item|rni|cp|copy|copy-item|cpi|xcopy|robocopy|install|mkdir|md|new-item|ni|touch|truncate|chmod|chown|icacls|attrib|ln|set-content|sc|add-content|ac|out-file|clear-content|clc|tee|tee-object|set-itemproperty|dd|patch)$/.test(c)) out.push(`"${c}" changes files`);
      else if ((c === 'sed' && w.some(x => /^-[a-z]*i|^--in-place/.test(x))) || (c === 'perl' && w.some(x => /^-[a-z]*i/.test(x)))) out.push(`"${c} -i" edits files in place`);
      else if (c === 'git' && /^(?:checkout|switch|reset|restore|stash|commit|apply|am|clean|rm|mv|add|merge|rebase|cherry-pick|revert|push|pull|worktree|init|clone)$/.test(w[1] || '')) out.push(`"git ${w[1]}" changes the repository`);
      else if (/^(?:npm|pnpm|yarn|bun|pip|pip3|uv|cargo|gem)$/.test(c) && /^(?:i|install|add|remove|rm|uninstall|update|up|upgrade|init|ci|link|publish)$/.test(w[1] || '')) out.push(`"${c} ${w[1]}" changes the project`);
      else if (c === 'npx' || c === 'pnpx' || c === 'bunx') out.push(`"${c}" runs code from outside the plugin`);
      else if (/^(?:node|deno|python[\d.]*|py)$/.test(c)) {
        const evalIdx = w.findIndex(x => /^(?:-e|--eval|-p|--print|-c)$/.test(x));
        if (evalIdx > 0) {
          if (/writeFile|appendFile|createWriteStream|rmSync|rmdirSync|unlink|renameSync|rename\(|mkdirSync|copyFile|cpSync|truncate|\bopen\([^)]*["'][wax+]|\.write_(?:text|bytes)\(|shutil\.|os\.remove|os\.rename/.test(w.slice(evalIdx + 1).join(' '))) out.push(`"${c} ${w[evalIdx]}" code that writes files`);
          continue;
        }
        const script = w.slice(1).find(x => !x.startsWith('-'));
        if (!script) continue;
        const abs = /\$\{?CLAUDE_PLUGIN_ROOT\}?/.test(script) ? null : path.resolve(cwd, script);
        if (abs && !key(abs).startsWith(key(root) + path.sep)) out.push(`"${c} ${script}" runs a script outside the plugin`);
        const rest = w.slice(w.indexOf(script) + 1);
        if (/ledger\.mjs$/i.test(script) && /^(?:add|init)$/.test(rest[0] || '')) out.push(`"ledger.mjs ${rest[0]}" writes the licence ledger`);
        if (/profile\.mjs$/i.test(script) && rest.some(x => /^--set$/.test(x))) out.push('"profile.mjs --set" writes the profile');
        if (/approval\.mjs$/i.test(script) && rest[0] === 'approve') out.push('"approval.mjs approve" records an approval');
      }
    }
  }
  for (const f of shellWrites(text, cwd)) if (!inGate(f) && !out.some(o => o.includes(path.basename(f)))) out.push(`writes ${f}`);
  return [...new Set(out)];
}

run(async () => {
  const input = await readInput();
  if (!IS_REVIEWER.test(String(input.agent_type || ''))) return;
  const cmd = (input.tool_input || {}).command;
  if (!cmd) return;
  const found = reviewerProblems(cmd, input.cwd || process.cwd());
  if (found.length) block(`HTML-Sensei guard-reviewer refused this ${input.tool_name || 'shell'} command: sensei-reviewer is read-only and never fixes what it judges (${found.slice(0, 4).join('; ')}).\n` +
    `Run the gates and read-only commands only (node "${path.join(pluginRoot(), 'skills', 'sensei-verify', 'scripts', 'verify.mjs').replace(/\\/g, '/')}" ..., cat, ls, grep, git diff, git log).` + ' Report the defect with its evidence and the owner of the fix instead of changing the file.');
});
