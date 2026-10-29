# Where sounds come from, and what each licence allows

Licences were read from each source on 2026-10-18 (media lane, `domain-audio-sfx-html.md`). Re-read before a
commercial release: terms change.

## 1. Recorded sound effects

| Source | Licence as read | In a shipped page? | Trap |
|---|---|---|---|
| Kenney (kenney.nl: UI, interface, impact packs) | CC0 (kenney.nl/support) | yes, no attribution needed | do not use the Kenney logo |
| Sonniss GameAudioGDC bundles (2015 to 2024) | royalty-free, commercial, no attribution | yes, inside a finished product | may not be redistributed as sound effects on their own, even edited; AI or ML training prohibited. Do not expose the raw files as downloads |
| Mixkit Sound Effects Free License | commercial and non-commercial, games, web, video | yes | not "on its own, as stock, in a tool or template, or with source files": never inside a template or starter given to others |
| Pixabay Content Licence | free, no attribution, modification allowed | yes | no standalone redistribution; only the full terms bind |
| OpenGameArt | per asset: CC0, CC-BY, CC-BY-SA, OGA-BY, GPL | CC0, and OGA-BY or CC-BY with a visible credit | CC-BY-SA puts your derivative under SA; CC-BY forbids DRM distribution; read each asset's own licence |
| Freesound | per sound: CC0, CC-BY, CC-BY-NC, Sampling+ | CC0 and CC-BY only | CC-BY-NC forbids anything that earns money; Sampling+ forbids advertising; CC-BY needs a credit list; download needs a login |
| BBC Sound Effects | personal, educational or research use only | **no** for a commercial or public product | looks free, is not |
| Google Actions Sound Library | only for Actions built on Google platforms | **no** | often mis-remembered as CC-BY; it is not |
| Zapsplat | attribution for free members, premium removes it | unverified (the licence page returned 404 when read) | check before use |
| ElevenLabs `text_to_sound_effects` (a tool in some environments) | the plan's commercial terms | check the plan | paid: goes through the plugin's approval (`.sensei/plan.md`, the user's yes, `lib/approval.mjs`); keep the prompt and file in the ledger |

## 2. Code libraries

| Library | Licence | Notes |
|---|---|---|
| `sensei-sfx.js`, `sensei-room.js` (this skill) | CC0 | original |
| Howler.js 2.2.4 | MIT | last push November 2025: stable, do not expect fixes |
| Tone.js 15.1.22 | MIT | active; 345 KB |
| ZzFX 1.4.0 | MIT | tiny; `ZzFXMicro` creates a context at load (trap) |
| jsfxr 1.4.1 | Unlicense (public domain) | store the definition, not the WAV |
| React Bits sound library | React Bits licence | may be used in a project, never shipped in the plugin (`sensei-ui-components` has the fetch-and-port procedure) |
| onetake's sound notes and `sfx_palette.py` | PolyForm Noncommercial 1.0.0 | **ideas only**: no code, ever. `sensei-room.js` restates the ideas in this project's own code |

## 3. The ledger

Every recorded or generated sound gets a row in `.sensei/licences.json` (`node ${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs list|check`):
source URL, licence, author, the attribution text, and whether the page may be passed on as a template.
Synthesised sounds (this engine, ZzFX, jsfxr definitions) need only the tool's row. Credits that a licence requires
are visible on the page (a credits section), not only in the ledger.
