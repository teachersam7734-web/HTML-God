![HTML God - turn a vision into a world](docs/assets/html-god-hero.png)

# HTML God

**Your imagination. A serious HTML craft studio.**

A marketplace and installable plugin for **Claude Code and Codex**, built around HTML Router. Describe what you want to make, answer a focused creative interview, and let the right skills shape the build: a landing page, an interactive story, a course, a dashboard, a game or a cinematic film.

**28 skills · 16 Claude Code agents · 5 Claude Code commands · shared verification scripts**

[Start the interview](interview.html) · [Install](docs/INSTALL.md) · [Host compatibility](docs/COMPATIBILITY.md) · [Watch the one-minute introduction](docs/assets/intro.mp4)

## Install

### Claude Code

Run these inside Claude Code:

```text
/plugin marketplace add teachersam7734-web/HTML-God
/plugin install html-god@html-god
```

Then ask: **“HTML Router: I want to build…”** The plugin namespace is `html-god`, for example `/html-god:sensei-gate`.

### Codex

Open the Plugins Directory, choose **Add Marketplace**, and add:

```text
https://github.com/teachersam7734-web/HTML-God
```

Sync or refresh the marketplace, select **HTML God**, and install it. In a new chat, ask Codex to use **html-router**. If your client has no Add Marketplace control, use the CLI or local-clone instructions in [INSTALL.md](docs/INSTALL.md).

Codex loads the shared skills and scripts. The bundled agents, commands and automatic hooks target Claude Code; Codex follows the [manual verification workflow](docs/COMPATIBILITY.md). Host features and tools differ.

## A cinematic interview, built with HTML God

[`interview.html`](interview.html) turns the Router's briefing process into a visual, keyboard-friendly experience. Choose the kind of project, audience, art direction, content, motion and delivery needs, then submit a structured brief.

For an assisted build on your own machine, start the local bridge from this repository:

```sh
node scripts/interview.mjs --project /path/to/your/project --agent codex
```

Use `--agent claude` for Claude Code. Open the local URL printed by the bridge. Submission hands the brief to the installed, signed-in agent in your chosen project; that agent builds the HTML. This uses your agent account and any normal tool permissions or usage limits. See the [interview guide](docs/INTERVIEW.md) for the complete flow.

Opening the HTML file directly works as a brief builder and export tool. A standalone browser page cannot call your local coding agent or create arbitrary AI-generated files by itself.

## What you can make

| Create | Craft built in |
| --- | --- |
| Landing pages and sites | Art direction, typography, theming, components, scroll and transitions |
| Interactive experiences | Pointer effects, games, dashboards and accessible controls |
| Decks and learning | Presentations, courses, content structure and offline delivery |
| Dimensional worlds | Three.js, holograms, shaders and Blender workflows |
| Motion and films | Handmade animation, motion design, deterministic rendering, audio and video checks |
| Portable HTML | Single-file packaging, licence ledgers and browser verification |

HTML Router combines **HTML-Sensei**, **GOAT HTML** and **HTML-Master**. It interviews before building, chooses the relevant lane, and records the decisions in a reusable brief. The cinematic interview and introduction film in this repository demonstrate that workflow.

## Quality you can inspect

The package favours evidence: exercise interactions, inspect the result at target sizes, honour reduced motion, track third-party licences and record what could not be verified. A screenshot alone does not prove a working experience.

The shared scripts use Node.js 18 or newer. Browser gates also need a supported browser and Playwright; film work can require FFmpeg, and Blender workflows require Blender and their optional integrations. Tools are discovered rather than bundled. Image generation and ElevenLabs are optional external services, with separate access and usage costs; no credentials are shipped.

```sh
npm run validate
node lib/discover.mjs
node skills/html-router/scripts/router.mjs detect --project . --json
```

## Inside the repository

| Path | Purpose |
| --- | --- |
| `.claude-plugin/` | Claude Code plugin and marketplace manifests |
| `.codex-plugin/` | Codex compatibility manifest and explicit empty host integrations |
| `.agents/plugins/marketplace.json` | Codex marketplace catalog |
| `skills/` | 28 shared skill folders, references, examples and tools |
| `agents/`, `commands/`, `hooks/` | Claude Code native integrations |
| `interview.html`, `scripts/interview.mjs` | Visual interview and local agent bridge |
| `docs/assets/` | Generated artwork and introduction film |
| `LICENSES/` | Third-party notices and licence texts |

[Installation](docs/INSTALL.md) · [Compatibility](docs/COMPATIBILITY.md) · [Original documentation](docs/LEGACY-SENSEI.md) · [Third-party notices](LICENSES/README.md)

The original package did not include a blanket licence for all first-party material. No new blanket licence is asserted here; consult the owner about reuse rights. Existing third-party terms remain in force.

## Start the visual interview

Invoke **HTML God** and say **“Interview me.”** The Router opens [interview.html](interview.html), with a live spinning Blender logo, neumorphic fields, embedded fonts, motion controls and a review before submission. A signed-in local CLI supports Submit & build; standalone mode exports the brief. See [the interview guide](docs/INTERVIEW.md).

The [community workflow additions](docs/RESEARCH.md) cover all six repositories supplied for this release. Their practical recipes are linked from the relevant HTML-Sensei skills.
