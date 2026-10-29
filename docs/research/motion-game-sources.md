# Motion and game source study

Researched 2026-10-28 for HTML God / HTML Sensei. Public repository metadata, commit objects, file contents and licence texts were inspected through the GitHub connector. Commit SHAs below freeze what was read; upstream branches may change.

The integration consists of **original reference recipes and links in the existing Sensei skills**. No upstream runtime, implementation, demo composition, character image, film, font or binary has been vendored. "Studied" means source inspection, not a successful local execution of these external projects.

## Source revisions and rights

| Repository | Inspected commit | Licence evidence | Reuse decision |
|---|---|---|---|
| [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | [19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/commit/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9) | [LICENSE: Apache-2.0](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/LICENSE) read | Transfer routing, asset-production and AI design ideas into original browser guidance |
| [huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion) | [8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c](https://github.com/alchaincyf/huashu-art-motion/commit/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c) | [LICENSE: MIT](https://github.com/alchaincyf/huashu-art-motion/blob/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c/LICENSE) read; [README exceptions](https://github.com/alchaincyf/huashu-art-motion/blob/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c/README.md) examined | Learn layered art motion and shot design; do not copy author-character or Clawd demo media, compositions, font files or stroke data |
| [framefields](https://github.com/gatewai-dev/framefields) | [f9a25e2493d838dec0ecb588ee3236484f359d92](https://github.com/gatewai-dev/framefields/commit/f9a25e2493d838dec0ecb588ee3236484f359d92) | [LICENCE: Apache-2.0](https://github.com/gatewai-dev/framefields/blob/f9a25e2493d838dec0ecb588ee3236484f359d92/LICENCE) read | Document an optional external authoring path and renderer-independent timing/QA ideas |

Huashu's repository explicitly excludes its author character and Clawd fan-demo films from the broad MIT grant; its bundled stroke medians and fonts carry separate terms. A public example is not a reusable asset licence. Any future implementation copied from Apache-licensed sources must retain applicable notices and redistribution requirements; this source-study document is not a substitute for those notices.

## What changed in HTML Sensei

| Finding | Integration | Practical result |
|---|---|---|
| One existing engine, additive concerns and progressive loading | [agent-game-workflows.md](../../skills/sensei-games/references/agent-game-workflows.md) | Preserve project dependencies; route to a browser runtime and load only relevant concerns |
| Art direction before generating families; manifest and actual game-scale QA | Same game reference | Consistent sprites and textures with explicit pivots, collision roles and provenance |
| Running actions, reactive guards and utility hysteresis | Same game reference | Guidance for interruptible enemies without invalid persistent chase or decision thrash |
| Four art-motion routes, full-frame layer coordinates and local material motion | [art-to-motion-workflows.md](../../skills/sensei-motion-graphics/references/art-to-motion-workflows.md) | Transform approved art into controlled browser movement instead of a sequence of zooming stills |
| Interaction-relative events and continuity across traversed worlds | Same motion reference | Retiming locomotion does not detach gestures; transitions keep baseline and identity coherent |
| Absolute frame clocks, audio-derived chapter boundaries and cheap render inspections | Same motion reference | Deterministic timing and review before expensive video export |
| Native renderer versus self-contained browser output | Same motion reference | A separate toolchain is described honestly; no automatic service or browser-runtime integration is claimed |

## Primary files inspected

**Game catalogue**

- [Router](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/router/SKILL.md): detects the real runtime and composes engine, discipline, genre and workflow.
- [Create game assets](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/create-game-assets/SKILL.md): art brief, seed target, families, normalization, import and evidence.
- [Behavior trees and Utility AI](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/ai-behavior-trees-utility-ai/SKILL.md): status semantics, interruption, normalized considerations and switching stability.

**Huashu**

- [Skill](https://github.com/alchaincyf/huashu-art-motion/blob/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c/SKILL.md): directing, camera variety, per-shot action and verification limits.
- [First still and four routes](https://github.com/alchaincyf/huashu-art-motion/blob/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c/references/03-一帧先行四条路线.md): code, generated layers, generated video and hybrid routes.
- [Procedural drawing](https://github.com/alchaincyf/huashu-art-motion/blob/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c/references/04-纯代码绘制.md): material-specific layers, cached layout and motifs.
- [Long-scroll film](https://github.com/alchaincyf/huashu-art-motion/blob/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c/references/11-长卷穿越片.md): relative interaction anchors, world boundaries, actor baseline and camera path.

**Framefields**

- [README](https://github.com/gatewai-dev/framefields/blob/f9a25e2493d838dec0ecb588ee3236484f359d92/README.md) and [package metadata](https://github.com/gatewai-dev/framefields/blob/f9a25e2493d838dec0ecb588ee3236484f359d92/package.json): beta native WebGPU renderer, Node >=22, optional gateway and separate preview.
- [Main skill](https://github.com/gatewai-dev/framefields/blob/f9a25e2493d838dec0ecb588ee3236484f359d92/plugins/framefields/skills/framefields/SKILL.md) and [render workflow](https://github.com/gatewai-dev/framefields/blob/f9a25e2493d838dec0ecb588ee3236484f359d92/plugins/framefields/skills/framefields-render/SKILL.md): composition setup, schema/type checks, targeted frames, grids and video export.
- [Track evaluator](https://github.com/gatewai-dev/framefields/blob/f9a25e2493d838dec0ecb588ee3236484f359d92/packages/compositions/src/program/evaluator.ts): seeded coherent motion, analytical spring evaluation and frame-indexed signals.
- [Launch-film timeline](https://github.com/gatewai-dev/framefields/blob/f9a25e2493d838dec0ecb588ee3236484f359d92/examples/22_framefields_launch/src/timeline.ts) and [beat analysis](https://github.com/gatewai-dev/framefields/blob/f9a25e2493d838dec0ecb588ee3236484f359d92/examples/22_framefields_launch/src/music/beat-grid.ts): stored audio structure sets chapter starts; waveform analysis estimates tempo, phase, bars and a drop.

## Validation scope

The new reference files were checked for local relative-link targets and linked from both owning skills. They contain original documentation and a suggested asset-record schema, not executable adapters. External dependency installation, rendering, generated-video quality, true game performance and cross-browser playback were not tested in this study. Existing verified Sensei tools retain the verification scope stated in their own skills.
