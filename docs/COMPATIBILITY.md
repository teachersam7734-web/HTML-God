# Claude Code and Codex compatibility

HTML God ships one shared skill tree and two host-specific manifests. Both catalogs list the root folder. The Codex package uses the supported `.codex-plugin/plugin.json` compatibility format; OpenAI now recommends a portable root manifest for new packages. This overlay preserves the existing Claude Code layout while giving Codex explicit skill and integration paths.

## What each host loads

| Component | Claude Code | Codex |
| --- | --- | --- |
| 28 `skills/*/SKILL.md` files | Native plugin skills | Shared skills declared by the Codex manifest |
| Node scripts, references and examples | Available on disk | Available on disk |
| 16 `agents/*.md` prompts | Native Claude Code agents | Reference prompts; no Codex agent registration is supplied |
| 5 `commands/*.md` files | Native namespaced slash commands | Reference workflows; no equivalent slash-command registration is supplied |
| `hooks/hooks.json` | Claude Code lifecycle/tool hooks | Explicitly disabled by an empty Codex hook configuration |
| Root `.mcp.json` | Opt-in Blender wrappers with Claude user configuration | Replaced by an explicit empty Codex MCP configuration |
| Visual interview | Brief export, or local bridge to Claude CLI | Brief export, or local bridge to Codex CLI |

Codex loads `.codex-plugin/hooks.json` and `.codex-plugin/mcp.json`, both intentionally empty. This prevents automatic discovery of the Claude hook events and its `user_config`-based server settings. This release does not promise automatic hook enforcement or Blender configuration parity in Codex.

## Reading the shared skills in Codex

The shared source originated in Claude Code and retains its authored tool names, legacy namespaces and ${CLAUDE_PLUGIN_ROOT} placeholders. A skill being discoverable does not make every instruction host-native. Before following one in Codex:

1. Resolve the installed plugin root from the actual loaded skill's path. For `<root>/skills/<name>/SKILL.md`, go up two directories. Substitute this absolute path whenever the text uses ${CLAUDE_PLUGIN_ROOT}; do not assume that environment variable is exported to a shell.
2. Map file reads, edits, terminal execution and browser inspection to the tools available in your Codex session. Claude's `Bash`, `Read`, `Edit`, `Skill` and `Agent` names are instructions about operations, not Codex API names.
3. Treat `html-sensei:<name>` and `html-package:<name>` as legacy references to the bundled component. Claude Code's current native prefix is `html-god`. In Codex, open the relevant skill or agent prompt directly when it is not registered by name.
4. Use `agents/*.md` as specialist reference material. Model labels and Claude front-matter tools do not configure Codex. Perform their review steps in the current session unless the user has separately authorised delegation.
5. Run the appropriate shared verification scripts explicitly. Report missing browsers, renderers and external services; never convert an unrun gate into a pass.

For example, tell Codex:

> Use HTML Router. Resolve this plugin's root from the loaded skill, read docs/COMPATIBILITY.md, replace Claude-specific paths and tools with the available Codex equivalents, and run the shared verification gates manually.

## Manual gates for Codex

Run these from the plugin source directory, or use absolute paths to the installed copy. Replace project and artifact paths with your own; quote paths containing spaces.

```sh
node lib/discover.mjs
node skills/html-router/scripts/router.mjs detect --project /path/to/project --json
node skills/html-router/scripts/router.mjs brief /path/to/project/.sensei/brief.md --json
node skills/html-router/scripts/router.mjs profile /path/to/project/.sensei/brief.md --project /path/to/project
node skills/sensei-verify/scripts/verify.mjs /path/to/project/index.html --project /path/to/project --strict --mode file
```

The umbrella verifier selects page and relevant domain gates, writes reports under the target project's `.sensei/gate/`, and records verification that could not run. Read its help and the active skill before selecting options, especially for online sites, WebGL and films. Browser checks need a supported browser plus Playwright. Video checks can need FFmpeg. Building a result and verifying it are separate steps.

The standalone scripts are available to both hosts, but the host must still grant file and process access. The interview bridge uses your separately installed local CLI and normal agent permissions. It does not provide credentials, a hosted AI endpoint or free model usage.

## Validation limits

`npm run validate` checks package identity, catalogs, referenced paths, skill inventory, the explicit empty Codex integrations and local documentation links. It is not an end-to-end installation test. Legacy test notes preserve their original dates and environments in [LEGACY-SENSEI.md](LEGACY-SENSEI.md); they are not evidence of new Codex integration tests.

See [OpenAI's packaging guidance](https://developers.openai.com/plugins/build/plugins) for compatibility manifests, explicit hook discovery overrides and marketplace behavior, and [Claude Code's marketplace guide](https://code.claude.com/docs/en/plugin-marketplaces) for the native catalog.
