#!/usr/bin/env node
// Validate distribution wiring without installing a host or running plugin code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function validatePackage(root = ROOT) {
  root = path.resolve(root);
  const errors = [], checks = [];
  const check = (ok, message) => (ok ? checks : errors).push(message);
  const exists = relative => fs.existsSync(path.join(root, relative));
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  const json = relative => {
    try { const data = JSON.parse(read(relative)); checks.push('JSON: ' + relative); return data; }
    catch (error) { errors.push(relative + ': ' + error.message); return null; }
  };
  const localPath = (relative, label) => {
    if (typeof relative !== 'string' || !relative.startsWith('./')) {
      errors.push(label + ': use a ./-prefixed path'); return;
    }
    const absolute = path.resolve(root, relative);
    const tail = path.relative(root, absolute);
    check(!tail.startsWith('..') && !path.isAbsolute(tail), label + ': path stays inside plugin');
    check(fs.existsSync(absolute), label + ': target exists (' + relative + ')');
  };
  const claude = json('.claude-plugin/plugin.json');
  const codex = json('.codex-plugin/plugin.json');
  const cm = json('.claude-plugin/marketplace.json');
  const xm = json('.agents/plugins/marketplace.json');
  const ch = json('hooks/hooks.json');
  const mh = json('.mcp.json');
  const xh = json('.codex-plugin/hooks.json');
  const mm = json('.codex-plugin/mcp.json');
  const pkg = json('package.json');

  for (const [name, obj] of [['Claude plugin',claude],['Codex plugin',codex],['Claude marketplace',cm],['Codex marketplace',xm]]) {
    check(obj?.name === 'html-god', name + ': consistent html-god identity');
  }
  check(pkg?.private === true, 'npm metadata: private (GitHub plugin distribution)');
  check(pkg?.scripts?.validate === 'node scripts/validate-package.mjs', 'npm metadata: validation entry point');
  for (const [label, market] of [['Claude',cm],['Codex',xm]]) {
    check(Array.isArray(market?.plugins) && market.plugins.length === 1, label + ': one marketplace entry');
    const entry = market?.plugins?.[0];
    check(entry?.name === 'html-god', label + ': entry matches manifest');
    const source = label === 'Claude' ? entry?.source : entry?.source?.path;
    check(source === './', label + ': root plugin source');
    if (source) localPath(source, label + ' marketplace source');
  }
  check(xm?.plugins?.[0]?.source?.source === 'local', 'Codex catalog: local source type');
  check(xm?.plugins?.[0]?.policy?.installation === 'AVAILABLE', 'Codex catalog: available installation');
  check(xm?.plugins?.[0]?.policy?.authentication === 'ON_INSTALL', 'Codex catalog: on-install authentication');
  check(xm?.plugins?.[0]?.category === 'Creativity', 'Codex catalog: creativity category');
  check(codex?.skills === './skills/', 'Codex: shared skill directory');
  check(codex?.hooks === './.codex-plugin/hooks.json', 'Codex: explicit separate hooks configuration');
  check(codex?.mcpServers === './.codex-plugin/mcp.json', 'Codex: explicit separate MCP configuration');
  check(xh?.hooks && Object.keys(xh.hooks).length === 0, 'Codex: Claude hook events are not registered');
  check(mm?.mcpServers && Object.keys(mm.mcpServers).length === 0, 'Codex: Claude MCP wrappers are not launched');
  for (const key of ['skills','hooks','mcpServers']) if (codex?.[key]) localPath(codex[key], 'Codex ' + key);
  for (const key of ['composerIcon','logo']) if (codex?.interface?.[key]) localPath(codex.interface[key], 'Codex ' + key);
  for (const [name, obj] of [['Claude',claude],['Codex',codex]]) {
    check(obj?.repository === 'https://github.com/teachersam7734-web/HTML-God', name + ': expected repository');
    check(!obj?.license, name + ': no invented blanket licence');
  }
  check(!!ch?.hooks && Object.keys(ch.hooks).length > 0, 'Claude: original hooks retained');
  check(!!mh?.mcpServers?.['blender-lab'] && !!mh?.mcpServers?.['blender-live'], 'Claude: opt-in Blender wrappers retained');
  if (ch?.hooks) for (const [event, groups] of Object.entries(ch.hooks)) {
    for (const group of groups) for (const hook of group.hooks || []) {
      const target = hook.command?.split('${CLAUDE_PLUGIN_ROOT}/')[1]?.split('"')[0];
      check(!!target, 'Claude hook ' + event + ': plugin-relative command');
      if (target) check(exists(target), 'Claude hook target: ' + target);
      check(!hook.command?.includes('\\"'), 'Claude hook ' + event + ': shell quotes are not overescaped');
    }
  }

  const dirs = relative => exists(relative) ? fs.readdirSync(path.join(root,relative),{withFileTypes:true}) : [];
  const skills = dirs('skills').filter(e => e.isDirectory() && exists('skills/' + e.name + '/SKILL.md'));
  check(skills.length === 28, 'Inventory: 28 shared skills');
  check(dirs('agents').filter(e => e.isFile() && e.name.endsWith('.md')).length === 16, 'Inventory: 16 Claude agents');
  check(dirs('commands').filter(e => e.isFile() && e.name.endsWith('.md')).length === 5, 'Inventory: 5 Claude commands');
  for (const skill of skills) {
    const text = read('skills/' + skill.name + '/SKILL.md');
    check(/^---\r?\n[\s\S]*?^name:\s*.+[\s\S]*?^---/m.test(text), 'Skill front matter: ' + skill.name);
  }
  for (const relative of ['interview.html','scripts/interview.mjs','docs/INTERVIEW.md','LICENSES/README.md','docs/LEGACY-SENSEI.md']) {
    check(exists(relative), 'Required deliverable: ' + relative);
  }
  if (exists('skills/html-router/scripts/router.mjs')) {
    check(read('skills/html-router/scripts/router.mjs').includes("['html-god', 'html-sensei', 'html-package']"), 'Router: current and legacy package discovery');
  }
  for (const relative of ['README.md','docs/INSTALL.md','docs/COMPATIBILITY.md']) {
    if (!exists(relative)) { errors.push('Missing documentation: ' + relative); continue; }
    const text = read(relative);
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].split('#')[0];
      if (!link || /^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
      const target = path.resolve(path.dirname(path.join(root,relative)), decodeURIComponent(link));
      check(fs.existsSync(target), relative + ': local link ' + link);
    }
  }
  return {ok: errors.length === 0, checks: checks.length, skills: skills.length, errors};
}

if (typeof process !== 'undefined' && process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = validatePackage();
  if (result.ok) console.log('HTML God package valid: ' + result.checks + ' checks, ' + result.skills + ' skills, both marketplace catalogs.');
  else { for (const error of result.errors) console.error('FAIL: ' + error); process.exitCode = 1; }
}
