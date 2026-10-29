// mcp-optin.mjs: makes the plugin's Blender MCP servers opt-in.
// Claude Code starts every MCP server a plugin declares and has no "disabled" field for plugin servers, so each
// entry in .mcp.json runs this wrapper. Its switch comes from the plugin's userConfig (passed in as SENSEI_MCP_ON):
//   off (the default)  answer as a tiny MCP server with no tools whose instructions say how to turn it on;
//   on                 find uv / uvx and hand the stdio over to the real server, run as a separate process
//                      (GPL-3.0 servers are called, never embedded).
// Usage (from .mcp.json): node mcp-optin.mjs blender-lab | blender-live
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { findUv } from './discover.mjs';

const id = process.argv[2];
const on = /^(?:true|1|yes|on)$/i.test(process.env.SENSEI_MCP_ON || '');

const SERVERS = {
  'blender-lab': {
    title: 'Blender Lab MCP (official, GPL-3.0)',
    setting: 'Blender Lab MCP (official)',
    command(uv) {
      const dir = process.env.SENSEI_MCP_DIR || '';
      const mcpDir = fs.existsSync(path.join(dir, 'mcp')) ? path.join(dir, 'mcp') : dir;
      if (!dir || !fs.existsSync(mcpDir)) return { error: 'Set "Blender Lab MCP clone folder" in the plugin options to your clone of https://projects.blender.org/lab/blender_mcp (git clone it first).' };
      if (!uv.uv.found) return { error: 'uv is not installed. Install it with the official installer (https://docs.astral.sh/uv/getting-started/installation/), not pip, then restart Claude Code.' };
      return { file: uv.uv.path, args: ['--directory', mcpDir, 'run', 'blender-mcp'] };
    },
  },
  'blender-live': {
    title: 'Blender live-scene MCP (community blender-mcp, MIT)',
    setting: 'Blender live-scene MCP (community blender-mcp)',
    command(uv) {
      if (!uv.uvx.found) return { error: 'uvx is not installed. Install uv with the official installer (https://docs.astral.sh/uv/getting-started/installation/), not pip, then restart Claude Code.' };
      return { file: uv.uvx.path, args: ['mcp-for-blender'], env: { DISABLE_TELEMETRY: 'true', BLENDER_MCP_SAFE_MODE: '1' } };
    },
  },
};

function stub(text) {
  // Minimal MCP over stdio: newline-delimited JSON-RPC.
  let buf = '';
  const send = o => process.stdout.write(JSON.stringify(o) + '\n');
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id === undefined) continue;                    // notifications need no answer
      if (msg.method === 'initialize') send({ jsonrpc: '2.0', id: msg.id, result: {
        protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: `html-sensei-${id}-off`, version: '0' },
        instructions: text } });
      else if (msg.method === 'tools/list') send({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } });
      else if (msg.method === 'ping') send({ jsonrpc: '2.0', id: msg.id, result: {} });
      else send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: text } });
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

const s = SERVERS[id];
if (!s) { stub(`Unknown server "${id}".`); }
else if (!on) stub(`${s.title} is off. Turn on "${s.setting}" in the HTML-Sensei plugin options (/plugin, then the plugin's configure option, or /config), then restart Claude Code. See the plugin README for setup.`);
else {
  const c = s.command(findUv());
  if (c.error) stub(`${s.title} is on but cannot start: ${c.error}`);
  else {
    const child = spawn(c.file, c.args, { stdio: 'inherit', env: { ...process.env, ...(c.env || {}) }, windowsHide: true });
    child.on('error', e => { process.stderr.write(`[html-sensei] could not start ${s.title}: ${e.message}\n`); process.exit(1); });
    child.on('exit', code => process.exit(code ?? 0));
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
  }
}
