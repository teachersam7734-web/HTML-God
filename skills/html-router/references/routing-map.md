# Routing map: from needs to components

Every component of the three subsets, what it is for, and who owns a topic when they overlap. Built by reading the
subsets themselves (HTML-Sensei's 25 skills, 16 agents, 5 commands, hooks and `lib/`; GOAT HTML's 16 references,
4 scripts and 5 assets; HTML-Master's 14 references, 7 scripts, starter, assets and examples).

Paths below are relative to each subset's own folder. Where the subsets live on this machine comes from
`node scripts/router.mjs detect` (section 7). In the combined package everything sits in one plugin, so HTML-Sensei's
paths start at `${CLAUDE_PLUGIN_ROOT}` and the other two at `${CLAUDE_PLUGIN_ROOT}/skills/goat-html/` and
`${CLAUDE_PLUGIN_ROOT}/skills/html-master/`.

## 1. Ownership when the subsets overlap

**HTML-Sensei first.** Its doctrine wins wherever the three disagree (no size budget, judge by the target device,
evidence before claims, licences in the ledger, accessibility built in, portable tools), and its skill is the owner of
any topic it covers. GOAT HTML and HTML-Master are called for what they do better or what HTML-Sensei lacks:

| Topic | Owner | Why the other subsets are still called |
|---|---|---|
| Doctrine, profile, routing, the production loop, the hooks, the gate | HTML-Sensei (`html-sensei`, `sensei-verify`) | none: the others defer to it in their own text |
| Direction: design read, dials, 3 to 6 directions, styles | HTML-Sensei `sensei-direction` | GOAT's `assets/design-read-template.md` (a fill-in read) and `references/design.md` §8b (nine named presets, plain words for the interview); HTML-Master's `references/01-art-direction.md` (adjectives into visible choices, page families, responsive art direction) |
| Overlay stack, glow, naturalism pass, liquid glass | GOAT `references/design.md` §3 to §6 and §9, `references/library-ecosystem.md` | HTML-Sensei `sensei-tokens-theming` for the tokens it sits on |
| Quick cinematic shell to start from | GOAT `assets/starter-lite.html`, `assets/starter-rich.html` | HTML-Sensei's examples are per-skill proofs, not shells |
| Deck shell | HTML-Sensei `sensei-presentations` (`examples/deck.html`, tested) | GOAT `assets/starter-deck.html` as a second, simpler shell and `references/presentations.md` for content patterns |
| Hand-rolled canvas particles, fire, starfields, confetti | GOAT `references/canvas-2d.md` | HTML-Sensei `sensei-shaders-vfx` when it needs the GPU |
| Music visualisers, beat and lyric sync from a track | GOAT `references/audio-reactive.md` | HTML-Sensei `sensei-audio` for the sound engine, unlocking, mute and captions |
| Tools, converters, generators, calculators, kiosks and exhibits | GOAT `references/tools-games.md` §1 and §3 (HTML-Sensei has no tool skill) | HTML-Sensei `sensei-ui-components`, `sensei-single-file`, `sensei-verify` |
| Editing a large existing single file safely (sentinels, one data array) | GOAT `references/architecture.md` §2 and §5, `assets/engine-analyzer.js` | HTML-Sensei `sensei-single-file` for the rebuild |
| Asset sources and their licences | HTML-Sensei skills' `sources-and-licences.md` files and the ledger | GOAT `references/sources.md` (the wider registry); HTML-Master `references/08-source-atlas.md` (rechecked links, Plan B and C) |
| Generated imagery, asset briefs, portrait montage, infographics | HTML-Master `references/03-assets.md` | HTML-Sensei `sensei-direction` for the look they must serve |
| Ready assets: three OFL fonts, four generated scenes, two CC0 rigged models, a CC BY-SA brain surface | HTML-Master `assets/` (listed in `references/asset-catalog.json`) | every one gets a ledger row |
| Learning design: source to lessons, coverage ledger, outcomes, misconceptions | HTML-Master `references/05-learning-design.md` | HTML-Sensei `sensei-courses` for engines, persistence, review, certificates and LMS |
| Teaching scenes: deterministic teaching clock, recognisable objects, 3D dioramas | HTML-Master `references/04-motion-3d.md`, `examples/project-source/` | HTML-Sensei `sensei-3d`, `sensei-motion-graphics` |
| A PDF or book read inside an offline file, highlights, notes, export | HTML-Master `references/06-book-media-state.md` | HTML-Sensei `sensei-single-file` for embedding |
| Protected editions, preservation of an approved baseline | HTML-Master `references/02-architecture.md`, `references/07-quality-control.md` | HTML-Sensei `sensei-verify` |
| Packing one offline file | HTML-Sensei `sensei-single-file` (`build-single.mjs` grew from HTML-Master's helper) | GOAT `scripts/inline_media.py`, `scripts/inline_three.py` for a quick inline |
| Final verification | HTML-Sensei `sensei-verify` (`verify.mjs`, strict `file://`) | GOAT `scripts/verify_html.py` (static checks) and HTML-Master `scripts/browser_smoke.cjs` as extra passes, never instead |

If HTML-Sensei is missing, the owner of each topic falls to GOAT HTML for single-file craft, starters and the static
gate, and to HTML-Master for art direction, assets, learning design and its browser smoke test. Say which was used.

## 2. HTML-Sensei: the 25 skills

Skill names are `html-sensei:<skill>` when the plugin is installed on its own and `html-package:<skill>` in the
combined package; GOAT HTML and HTML-Master write `html-sensei:<skill>`, which means the same skill.

| Skill | Use when the brief has | Key files |
|---|---|---|
| `html-sensei` | any HTML project: doctrine, the profile, the routing tables, the production loop, agents, hooks | `scripts/profile.mjs` |
| `sensei-direction` | a new look, a redesign, "make it premium", "it looks generic": design read, dials, 3 to 6 directions, styles catalogue, anti-slop gates | `references/explore-directions.md`, `references/styles-catalogue.md`, `references/design-read.md`, `examples/directions.html`, `scripts/check-directions.mjs` |
| `sensei-tokens-theming` | colours, light and dark, themes, a theme switch, contrast | `scripts/tokens.mjs`, `examples/tokens.html` |
| `sensei-landing-hero` | a landing page, hero section, sign-up page, product page | `references/anatomy-and-copy.md`, `references/backgrounds-and-heroes.md`, `examples/landing.html`, `scripts/audit.mjs` |
| `sensei-ui-components` | forms, menus, dialogs, tabs, toasts; a component library; Tailwind in one file; React Bits | `references/forms.md`, `references/libraries.md`, `references/react-bits.md`, `examples/form.html` |
| `sensei-typography` | kinetic type, font choice and embedding, Persian and right-to-left text | `references/persian-rtl.md`, `references/fonts.md`, `scripts/fontembed.py`, `scripts/font-coverage.py`, `assets/vazirmatn-fa-latin.woff2` |
| `sensei-motion-ui` | interface motion: hovers, presses, springs, micro-interactions, GSAP or Motion | `references/micro-interactions.md`, `scripts/spring-linear.js` |
| `sensei-scroll` | scroll stories, reveals, parallax, pinned sections, smooth scroll | `references/native-recipes.md`, `examples/scroll-driven.html` |
| `sensei-pointer` | custom cursors, magnetic buttons, spotlight, tilt, drag and throw | `references/catalogue.md`, `examples/pointer.html` |
| `sensei-transitions` | page transitions, shared-element morphs, reorder animation | `references/api.md`, `examples/vt-same.html`, `examples/flip.html` |
| `sensei-motion-graphics` | a motion graphic, sting, promo, title sequence, explainer film | `references/film-direction.md`, `references/storyboard-template.md`, `scripts/film-gates.mjs`, `scripts/motion-kit.js` |
| `sensei-video-pipeline` | turning a page into an MP4, captions, loudness, HyperFrames hand-off | `scripts/render.mjs`, `scripts/sheet.mjs`, `scripts/preflight.mjs` |
| `sensei-handmade-animation` | a cartoon, hand-drawn or painted look, a character short | `references/principles.md`, `scripts/handmade-kit.js`, `scripts/review.mjs` |
| `sensei-3d` | 3D models, scenes, product viewers, 3D text, three.js | `references/single-file-three.md`, `references/assets-gltf.md`, `scripts/gate3d.mjs` |
| `sensei-holograms` | holograms of any kind | `references/hologram-recipes.md`, `examples/holo.html` |
| `sensei-shaders-vfx` | shader backgrounds, particles, raymarching, bloom and grain | `references/glsl-building-blocks.md`, `examples/reactive-bg.html` |
| `sensei-blender` | models or animation made in Blender | `references/install-and-run.md`, `scripts/blender_locate.py`, `scripts/blender_run.py` |
| `sensei-audio` | sound effects, music beds, sound that must be in step with visuals | `scripts/sensei-sfx.js`, `scripts/sensei-room.js`, `references/sources-and-licences.md` |
| `sensei-lottie-rive-video` | Lottie, Rive, hero or background video, transparent video, scroll-scrubbed video | `references/lottie.md`, `references/rive.md`, `references/video.md` |
| `sensei-presentations` | a presentation or deck: presenter view, notes, PDF handout | `examples/deck.html`, `references/deck-craft.md`, `scripts/deck-pdf.mjs` |
| `sensei-courses` | a course, lessons, quizzes, progress, certificates, LMS | `scripts/engine.js`, `scripts/validate-lessons.mjs`, `scripts/pack_lms.py`, `references/questions-and-review.md` |
| `sensei-dataviz` | a dashboard, charts, big tables | `references/forms-and-palettes.md`, `scripts/palette-check.mjs`, `scripts/build-dash.mjs` |
| `sensei-games` | a game | `scripts/game-core.js`, `references/input-pause-saves.md`, `examples/coin-run.html` |
| `sensei-single-file` | one offline file, emailed, on USB, in an LMS; file versus site | `scripts/build-single.mjs`, `scripts/inline.mjs`, `references/sharing.md` |
| `sensei-verify` | every project, last: the gate | `scripts/verify.mjs`, `scripts/sensei-gate.mjs`, `scripts/gate-fresh.mjs` |

Typical sets (from the entry skill, extended): landing page = direction, tokens-theming, landing-hero, typography,
motion-ui, scroll, pointer, verify (ui-components when there is a form); course = direction, tokens-theming, courses,
typography, motion-ui, audio, single-file, verify; deck = direction, presentations, typography, transitions,
single-file, verify; dashboard = direction, tokens-theming, dataviz, single-file, verify; game = direction, games,
audio, single-file, verify; film = direction, motion-graphics, video-pipeline, audio; website = direction,
tokens-theming, landing-hero, ui-components, transitions, scroll, typography, verify. Add 3d, holograms, shaders-vfx,
lottie-rive-video, blender, handmade-animation only when the brief asks for what they make.

## 3. HTML-Sensei: the 16 agents

Agent names are `<plugin>:<agent>` (`html-sensei:` alone, `html-package:` in the combined package). Dispatch when
the project has more than three independent parts or a domain with its own agent; a small page is built in the main
session with the skills.

| Agent | Dispatch when |
|---|---|
| `sensei-art-director` | the start of any new project or redesign: directions, style, tokens, type, one proven slice |
| `sensei-interaction-engineer` | interface motion, scroll, pointer, transitions, component behaviour, interface Lottie, Rive and video |
| `sensei-motion-director` | a film, sting, promo or explainer: treatment, storyboard, seek page |
| `sensei-film-renderer` | a seek page must become an MP4 |
| `sensei-animator` | hand-drawn or painted character animation |
| `sensei-3d-engineer` | three.js scenes and models |
| `sensei-hologram-builder` | a hologram |
| `sensei-shader-artist` | hand-written shaders, shader backgrounds, post effects |
| `sensei-blender-artist` | Blender models, rigs and renders |
| `sensei-sound-designer` | sound effects, music, mixing, sync |
| `sensei-course-builder` | a course: lessons, question engines, persistence, certificates, LMS |
| `sensei-deck-builder` | a presentation |
| `sensei-dataviz-engineer` | a dashboard or charts |
| `sensei-game-engineer` | a game |
| `sensei-packager` | release of a single offline file (or file plus site) |
| `sensei-reviewer` | before any claim of done and after each builder's report; read-only, lenses: design, accessibility, licences |

## 4. HTML-Sensei: commands, hooks and lib

| Component | What the Router does with it |
|---|---|
| `/sensei-start` | not needed after the Router's interview (the Router writes the profile itself); a person may still run it |
| `/sensei-gate` | its script, `skills/sensei-verify/scripts/verify.mjs <target>` in strict `file://`, is the Router's last step |
| `/sensei-render` | a film: its steps run `sensei-video-pipeline`'s scripts |
| `/sensei-pack` | a single-file release: `build-single.mjs` or `inline.mjs`, then the strict gate on the packed file |
| `/sensei-licences` | at release: `lib/ledger.mjs list` and `check` |
| `hooks/probe.mjs` (SessionStart) | writes `.sensei/env.json`: what tools exist (Chrome, Playwright, ffmpeg, Blender) |
| `hooks/guard-licence.mjs`, `guard-secrets.mjs`, `guard-process.mjs`, `guard-reviewer.mjs` (PreToolUse) | block forbidden code, keys in files, killing browsers by name, paid generation without approval, a reviewer that writes. If one blocks, do what it says; never route around it |
| `hooks/keep-eol.mjs`, `lint-web.mjs`, `lint-3d.mjs`, `lint-determinism.mjs`, `record-shell.mjs` (PostToolUse) | line endings, reduced motion and offline rules, WebGL traps, seek-page determinism; warnings to fix or explain |
| `hooks/gate-claim.mjs` (Stop) | a "done" without a fresh passing gate report is sent back |
| `lib/profile.mjs` | the profile's allowed values; `skills/html-sensei/scripts/profile.mjs` writes through it |
| `lib/ledger.mjs` | `init`, `add`, `list`, `check` the licence ledger `.sensei/licences.json` |
| `lib/approval.mjs` | records a user's yes to a paid-generation plan |
| `lib/discover.mjs` | prints what tools were found |

The hooks only fire when HTML-Sensei is installed as a plugin (alone or as the combined package). Installed as bare
skills, there are no hooks: the Router then runs the gate itself and says the guards were not active.

## 5. GOAT HTML: every component

| Component | Use it for |
|---|---|
| `SKILL.md` §2 | the design read and the three dials (HTML-Sensei's version is `sensei-direction`) |
| `SKILL.md` §4, §5 | iron rules for single files; genre routing; storage, 3D ambition and motion runtime tables |
| `references/workflow.md` | the 8-phase loop (folded into HTML-Sensei's production loop) |
| `references/architecture.md` | layered file anatomy, one data array, store before UI, hash router, sentinels for safe edits |
| `references/design.md` | tokens, type, the overlay stack (aurora, grain, vignette), glow discipline, naturalism pass, anti-slop, named presets (§8b), vanilla liquid glass (§9) |
| `references/canvas-2d.md` | hand-rolled canvas engines: depth-sorted particles (the canvas hologram), confetti, fire, smoke, starfields, seeded randomness |
| `references/webgl.md` | when three.js is worth it, the inline pipeline, scene skeleton, choreography by scene table, custom shaders |
| `references/library-ecosystem.md` | react-three-fiber, liquid-glass-js, shadergradient, liquid-logo: use, port or re-derive |
| `references/media-embedding.md` | base64 images, audio and fonts; the resize pipeline; the esbuild bundle route |
| `references/audio-reactive.md` | music visualisers: band splitting, musical-time timelines, trustworthy timestamps, lyric choreography |
| `references/presentations.md` | deck content patterns, presenter mode, print and PDF |
| `references/dashboards-reports.md` | charts without libraries, KPI cards, tables, print stylesheets, low-motion policy |
| `references/tools-games.md` | tools (pure transform, URL state, copy buttons), games, kiosks and exhibits (attract loop, touch lockdown) |
| `references/learning-apps.md` | course skeleton, flashcards, quiz engine, explore and search, spaced repetition |
| `references/interaction.md` | router UX, modals, toasts, keyboard map, synthesised sound effects, accessibility floor |
| `references/sources.md` | the wider asset and technique registry with licences, and when not to copy |
| `references/verification.md` | static, runtime and media gates; environment traps; regression sweep |
| `references/case-studies.md` | three shipped single files and what each taught |
| `scripts/verify_html.py` | static gate: tags, data shape, one-URI sanity, JS parse, network references, reduced motion, weight as information (`--strict`, `--offline`) |
| `scripts/inline_media.py` | resize and embed an image as one data URI, never cropping a logo (needs Pillow) |
| `scripts/inline_three.py` | fetch, minify and inline three.js and bloom passes (network at build time; r147 or older) |
| `scripts/serve.py` | a no-cache preview server on localhost (`--lan` for a phone on the same network) |
| `assets/starter-lite.html` | minimal cinematic shell, offline, reduced motion built in |
| `assets/starter-rich.html` | tokens, overlays, router, store and sound shell |
| `assets/starter-deck.html` | fixed-canvas deck with keys, swipe, presenter view and print |
| `assets/engine-analyzer.js` | probe an existing HTML file: engines, data, sentinels, storage keys, network map |
| `assets/design-read-template.md` | a fill-in design read for the project folder |
| `evals/evals.json` | GOAT's own test prompts |

## 6. HTML-Master: every component

| Component | Use it for |
|---|---|
| `SKILL.md` | working defaults, the production loop, quality distinctions (a picture is not a simulation, a screenshot is not a test) |
| `references/01-art-direction.md` | the visual argument, page families, colour and type roles, motion across the product, responsive art direction, reference study |
| `references/02-architecture.md` | the delivery contract table (offline file, offline folder, hosted site, server app, PWA), editable source and compiled file, protected editions |
| `references/03-assets.md` | asset briefs, native image generation, transparency checks, portrait montage, infographic recipe, asset licensing |
| `references/04-motion-3d.md` | choosing a motion architecture, a deterministic teaching clock, eight teaching patterns, recognisable objects, three.js scene building, scroll video, Remotion and HyperFrames |
| `references/05-learning-design.md` | source-grounded lessons, the coverage ledger, outcomes, misconceptions, flashcards, assessments, review timing |
| `references/06-book-media-state.md` | a PDF reader inside an offline file, highlights that survive resizing, audio as a user-controlled service, persistence and export |
| `references/07-quality-control.md` | evidence in layers, a proportional browser matrix, motion and visual acceptance, preservation, independent review |
| `references/08-source-atlas.md` | rechecked libraries, templates, models and media with licences; Plan B and C by constraint |
| `references/09-project-case-study.md` | what the original course shipped, failed and fixed |
| `references/10-tools-collaboration.md` | capability inventory, recovery patterns, Windows shell lessons, hand-offs |
| `references/11-recipes.md` | commands: bundle a scene, single-file assembly, media preparation, pure time mapping, glTF normalisation |
| `references/12-package-use.md` | how the HTML-Master package itself is installed and used |
| `references/13-idiom-ville.md` | a second, compact course structure (five routes, one dock) |
| `references/14-capability-ledger.md` | used, researched and contingent tools, and choosing A, B or C |
| `references/asset-catalog.json` | every included asset with origin, role, size and hash |
| `scripts/build_single_file.py` | embeds chosen CSS, JS, JSON and media into a template (HTML-Sensei's `build-single.mjs` is the default) |
| `scripts/asset_manifest.py` | sizes, MIME types and hashes of an asset folder |
| `scripts/browser_smoke.cjs` | strict `file://`, network off, desktop and phone, with and without reduced motion; errors, requests, overflow, screenshots |
| `scripts/validate_skill.py`, `pack_skill.py`, `self_test.py`, `build_catalog.py` | maintenance of the HTML-Master package itself, not of projects |
| `assets/starter/index.html` | a runnable specimen: cinematic hierarchy, explanatory motion, a glass flashcard, local notes, portable state |
| `assets/fonts/` | Barlow Condensed, Manrope, Orbitron (OFL 1.1, licence texts beside them) |
| `assets/generated/` | four generated scenes: neural environment, neural knot, premium emerald, premium solar |
| `assets/models/` | `human.glb` and `robot.glb` (CC0, rigged, idle animation), `brain-surface.bin` (CC BY-SA 4.0: attribution and share-alike) |
| `examples/project-source/` | study modules: data-driven SVG teaching scenes, 3D dioramas, reader, intro (not a drop-in app) |

## 7. Finding the parts on this machine

`node scripts/router.mjs detect` prints, for each subset, whether it is found, how (plugin, plugin cache, user skill,
project skill, or a sibling inside the combined package) and its path. Then:

| What was found | The Router works like this |
|---|---|
| All three (the combined package, or the plugin plus both skills) | everything in this map |
| HTML-Sensei plugin, no GOAT HTML or HTML-Master | everything except the GOAT and HTML-Master rows; say which strengths are missing (starters, canvas engines, tools genre, asset library, learning design) and use HTML-Sensei's nearest skill |
| HTML-Sensei skills only (no plugin, so no hooks and maybe no `lib/`) | the skills' recipes; profile written directly; gate run by hand; say the hooks were not active |
| GOAT HTML and HTML-Master, no HTML-Sensei | GOAT's workflow and starters, HTML-Master's direction, assets and learning design, GOAT's `verify_html.py` plus HTML-Master's `browser_smoke.cjs` as the gate; profile written directly for later; say the HTML-Sensei gate did not run |
| Only one of GOAT HTML or HTML-Master | that skill's own loop and gate; say what is missing |
| None | the Router's own doctrine and interview; build by hand; verify in a real browser in `file://`; say that no subset was installed |
