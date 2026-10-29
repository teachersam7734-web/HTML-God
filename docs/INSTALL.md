# Install HTML God

The repository is both a marketplace and the plugin it lists. Its plugin identifier and marketplace identifier are both `html-god`. The GitHub repository is [teachersam7734-web/HTML-God](https://github.com/teachersam7734-web/HTML-God).

## Claude Code

Inside a Claude Code session:

```text
/plugin marketplace add teachersam7734-web/HTML-God
/plugin install html-god@html-god
```

Follow the install panel, then start a fresh session. Say **“HTML God, interview me”** to open the visual interview, ask **“HTML Router: I want to build…”** or invoke `/html-god:html-router`. Commands use the `html-god` prefix, including `/html-god:sensei-start` and `/html-god:sensei-gate`.

From a terminal, equivalent registration and installation commands are:

```sh
claude plugin marketplace add teachersam7734-web/HTML-God
claude plugin install html-god@html-god
```

To try the local source for one session:

```sh
git clone https://github.com/teachersam7734-web/HTML-God.git
claude --plugin-dir ./HTML-God
```

Optional Blender MCP wrappers are off until configured in the plugin's settings. They require their separate software and dependencies. Image generation, ElevenLabs, browsers and FFmpeg are optional integrations; the package does not install or authenticate them.

## Codex

In a desktop client with marketplace management:

1. Open the Plugins Directory and choose **Add Marketplace**.
2. Enter `https://github.com/teachersam7734-web/HTML-God`.
3. Sync or refresh, select the **HTML God** marketplace and install **HTML God**.
4. Start a new chat and say **“HTML God, interview me”** or ask Codex to use **html-router**. Read [COMPATIBILITY.md](COMPATIBILITY.md) for the host adaptations and manual gates.

Client labels and availability can vary. The current Codex CLI can register the same catalog:

```sh
codex plugin marketplace add teachersam7734-web/HTML-God
codex plugin marketplace list
```

Then use the desktop Plugins Directory to install and test the plugin. To refresh a tracked marketplace later:

```sh
codex plugin marketplace upgrade html-god
```

### Local-clone fallback

```sh
git clone https://github.com/teachersam7734-web/HTML-God.git
codex plugin marketplace add ./HTML-God
```

Open that repository as a trusted Codex project. The repo-scoped `.agents/plugins/marketplace.json` lists the root plugin. Restart the desktop app if needed, select the local **HTML God** source in the Plugins Directory and install it. Installation uses a cached copy; refresh or reinstall after modifying the source.

For a client without plugin support, open the cloned repository and explicitly ask the agent to read `skills/html-router/SKILL.md`, then follow [COMPATIBILITY.md](COMPATIBILITY.md). This is a source-based fallback rather than a registered plugin install.

## Run the visual interview

Node.js 18+ is required for the local bridge. Install and sign in to your preferred agent separately, then run from the repository:

```sh
node scripts/interview.mjs --project /path/to/your/project --agent codex
```

Use `--agent claude` for Claude Code. Follow the printed local URL. The chosen project is where the agent builds the result. Directly opening `interview.html` supports brief export; it does not run the agent. See [INTERVIEW.md](INTERVIEW.md).

## Check the package

No npm dependencies are needed for package validation:

```sh
npm run validate
```

When Claude Code is available, also run `claude plugin validate .`. The repository validator checks manifests and package paths; it cannot prove live client installation or model-driven build quality.

## Format references

- [Claude Code marketplace documentation](https://code.claude.com/docs/en/plugin-marketplaces)
- [OpenAI plugin packaging and marketplace documentation](https://developers.openai.com/plugins/build/plugins)

These describe the two independent catalogs and the supported Codex compatibility manifest. Publishing this GitHub marketplace does not submit the plugin to either vendor's official public directory.
