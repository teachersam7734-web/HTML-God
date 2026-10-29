---
name: goat-html
description: >
  Use when building, extending, or debugging single-file HTML experiences: interactive
  courses, slide decks, cinematic landing pages, audio-reactive 3D music visualisers, games,
  dashboards, tools, charts, exhibits, kiosks, or any "one HTML file" deliverable. Covers
  architecture (data contracts, routers, stores, sentinels), visual production
  (aurora/grain/vignette systems, glow, liquid glass), canvas and WebGL (particles, holograms,
  three.js + UnrealBloom), media embedding (base64 images/audio/fonts, ffmpeg analysis), the
  effects-wave libraries (react-three-fiber, liquid-glass-js, shadergradient, liquid-logo:
  port or bundle), an anti-generic design process, an asset-source registry with licences,
  and the verification loop that ships files that work. Use whenever the user mentions an HTML file, page, deck,
  dashboard, course, or visualiser, or asks for something "cinematic", "standalone", or
  "work offline". Part of the HTML Router package; where it disagrees with HTML-Sensei,
  HTML-Sensei wins.
license: MIT
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# GOAT-HTML: Cinematic Single-File HTML Mastery

The complete playbook for shipping one-file HTML experiences that feel like they cost
thousands of dollars, boot instantly, and work offline: distilled from three shipped projects
(Idiom-Ville 136 KB / 1,126 lines; Ultra Bookworm 4.5 MB / 1,525 lines; 1001 Arabian Nights
14.6 MB / 2,370 lines) and an ecosystem audit of every major HTML/visual skill.

---

## §0 · PACKAGE RULES: HTML-Sensei takes priority

GOAT HTML ships in the HTML Router package with HTML-Master and HTML-Sensei. It works on its own;
when HTML-Sensei is installed, its doctrine wins wherever the three disagree, and its skills
(`html-sensei:<skill>`) hold the deeper version of several topics here. The doctrine, as this skill
applies it:

1. **Best quality is the default.** No page-weight budget unless the user asks for one; weight is
   reported, never a gate, never a reason to cut an effect.
2. **Judge by the target device, not this machine.** Never fade or switch off an effect because a
   device class is assumed weak; if something cannot be verified here, say so.
3. **Evidence before claims.** Say what was verified, on which browser, and what was not
   (most checks here run in Chromium only: Firefox and Safari are "not verified" unless tested).
4. **Licences are part of the build.** Every vendored or ported piece gets a ledger row
   (`references/sources.md` §0); React Bits code is used in projects only, never redistributed.
5. **Reduced motion, keyboard, contrast and forced colours are built in, not added.**
6. **Offline means no network request.** No CDN, no font `<link>`: embed what the file needs.

| Topic | Here | Deeper in HTML-Sensei |
|---|---|---|
| Direction, dials, anti-slop | §2, §7, `design.md` | `html-sensei:sensei-direction` |
| Fonts, embedding, RTL | `design.md` §2, `media-embedding.md` §4 | `html-sensei:sensei-typography` |
| three.js, shaders | `webgl.md` | `html-sensei:sensei-3d`, `html-sensei:sensei-shaders-vfx` |
| Decks | `presentations.md` | `html-sensei:sensei-presentations` |
| Courses, dashboards, games | genre references | `html-sensei:sensei-courses`, `sensei-dataviz`, `sensei-games` |
| One offline file, packaging | `media-embedding.md` | `html-sensei:sensei-single-file` |
| The gate | §6, `verification.md` | `html-sensei:sensei-verify` |

---

## §1 · ROUTER: start here, then load only what you need

| Situation | Read first |
|---|---|
| Starting any new single-file build | `references/workflow.md` (the 8-phase loop) |
| Choosing architecture (routes, data, store, sentinels) | `references/architecture.md` |
| Making it *look* expensive: palette, type, glow, overlays | `references/design.md` |
| Any canvas, particles, 3D, three.js, or post-processing | `references/canvas-2d.md` then `references/webgl.md` |
| Liquid glass, liquid-metal logos, shader gradients, react-three-fiber/drei: use, port, or re-derive? | `references/library-ecosystem.md` |
| Embedding images / audio / fonts / libraries as base64 | `references/media-embedding.md` |
| Audio-reactive anything (WebAudio, bass, beats, lyric sync) | `references/audio-reactive.md` |
| Slide decks, presentations, pitch decks, talks | `references/presentations.md` |
| Dashboards, reports, charts, printable documents | `references/dashboards-reports.md` |
| Tools, converters, games, kiosks, exhibits | `references/tools-games.md` |
| Courses, quizzes, flashcards, progress stores | `references/learning-apps.md` |
| Interaction inventory, router UX, toast/modals, SFX | `references/interaction.md` |
| Finding components, heroes, animations, SFX, VFX, fonts, icons to lift | `references/sources.md` |
| Final ship gate: static, runtime, and media checks | `references/verification.md` |
| Reproducing or extending the three shipped projects | `references/case-studies.md` |
| Not sure which to read? | This file top-to-bottom, then the row above that matches your blocker |

Load **one** reference at a time, apply, and only load another when the current one is exhausted.
`case-studies.md` is best read *after* the workflow: it is the proof, not the plan.

---

## §2 · THE DESIGN READ: before any code (ecosystem-wide lesson)

The single biggest cause of generic output is skipping the read of the brief. Before one line of
HTML/CSS, output one line:

> "Reading this as: **\<kind>** for **\<audience>**, with a **\<vibe>** language, leaning towards
> **\<palette family> / \<type pairing> / \<motion level>**."

Then set three dials (they gate every later decision):

| Dial | Range | Default | Notes |
|---|---|---|---|
| `DESIGN_VARIANCE` | 1 to 10 | 8 | 1 = rigid symmetry, 10 = artsy chaos |
| `MOTION_INTENSITY` | 1 to 10 | 8 | 1 = static, 10 = physics/cinematic; the silent-brief default is cinematic (7 to 9: the most exciting design that serves the content). HTML-Sensei's `motion` profile: 7 to 9 `cinematic`, 4 to 6 `lively`, 1 to 3 `calm` |
| `VISUAL_DENSITY` | 1 to 10 | 4 | 1 = airy gallery, 10 = cockpit |

Whatever the motion level, every animated system ships its reduced-motion path.

Dial inference from the brief's vibe words:

| The user said | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| minimalist / calm / editorial / Linear-style | 5 to 6 | 3 to 4 | 2 to 3 |
| premium / luxury / cinematic / Apple-y | 7 to 8 | 5 to 7 | 3 to 4 |
| playful / experimental / Awwwards / flashy | 9 to 10 | 8 to 10 | 3 to 4 |
| educational app / learning tool | 7 | 6 | 5 |
| trust-first / regulated / dashboard | 3 to 4 | 2 to 3 | 5 to 6 |

**Ground the design in the subject.** A magic-carpet lyric journey must not look like a finance
dashboard and vice versa: palette, texture, and type come from the subject's world (Arabian Nights →
gold/dusk gradients, Cinzel Decorative; fire library → ember/orange, Unbounded; futuristic course →
cyan/violet aurora, Space Grotesk). If the brief's words pin a look, they win; if silent, never spend
the freedom on a default.

---

## §3 · THE WORKFLOW: eight phases, gates between them

Full detail in `references/workflow.md`; the loop:

1. **Design read**: the one-liner + dials (§2). No code yet.
2. **Contract**: data shape(s), store shape, routes, sentinels, all *before* UI. (`architecture.md` §2)
3. **Skeleton**: tokens, fonts, overlays, app shell, empty routes. Verify it renders before features.
4. **Engine**: the hardest canvas/3D/audio piece first, *before* UI polish. It determines feasibility.
5. **Features**: one at a time, each verified in the running page before the next.
6. **Naturalism pass**: gradients, glows, parallax, sound design, choreography. (`design.md` §6)
7. **Hardening**: confirm reduced motion (built in since phase 4), resize, storage failures,
   error guards, focus states, keyboard routes, forced colours.
8. **Ship gate**: `scripts/verify_html.py` + browser gates (HTML-Sensei's gate when installed).
   All green or it doesn't ship; the hand-off names what was not verified.

Working rhythm rules:
- Build the risky thing first (engine > features > polish). A feature on a broken engine is lost work.
- Verify after every phase, not at the end. Static gates are cheap; late surprises are expensive.
- Write decisions down in a build log (like `GOAT-HTML.md`) while they are fresh.

---

## §4 · IRON RULES (violating the letter violates the spirit)

1. **The file must boot.** After every edit, the page must load without console errors. Verify in a
   browser, opened the way the user will open it (`file://` for a single file; served as well when
   hosted), before claiming completion: evidence before claims, always.
2. **One source of truth.** All content lives in one typed array; features are views over it.
   Two sources = guaranteed drift.
3. **Fit, don't crop, client logos.** `height + width:auto`, no `object-fit:cover` on identity art.
4. **Resize before you inline.** 1 MB logo into a 52 px slot doubles file size for nothing.
5. **Never edit inside base64 blobs.** One unique anchor swap, then count matches (must stay 1).
6. **Cache-bust previews** (`?v=N`) or you debug ghosts.
7. **Respect `prefers-reduced-motion`** in every animated system, built in with the engine, not
   patched at the end: three lines per engine.
8. **Sentinels beat regex-on-code.** `/*__ENGINE__*/`, `/*__MODULES__*/`, `/*__LYRICS__*/` are
   stable, greppable injection points. Add them even when you don't need them yet.
9. **Use what the best result needs.** A hand-rolled projection is 50 lines; three.js r128 is
   about 590 KB minified. Hand-roll when it gives the same picture; import (as many libraries as
   the result needs) when the complexity is real. Weight is reported, never a gate; every library
   gets a licence-ledger row.
10. **Never let one canvas frame kill the page.** Wrap RAF work in try/catch.

---

## §5 · QUICK DECISION TABLES

**Genre routing (which reference owns the build):**

| The deliverable is… | Genre reference | Signature disciplines |
|---|---|---|
| A course, quiz, flashcards, learning tool | `learning-apps.md` | store-first data, retrieval & spaced repetition |
| A deck, talk, pitch, keynote | `presentations.md` | fixed 1920×1080 canvas, keyboard nav, presenter mode, print |
| A dashboard, report, data document | `dashboards-reports.md` | 40-line charts, KPI cards, print stylesheet, near-zero motion |
| A tool, converter, generator, editor | `tools-games.md` | pure transform function, URL state, copy buttons |
| A game | `tools-games.md` | fixed-timestep loop, state machine, held-keys input |
| A kiosk / exhibit | `tools-games.md` | idle attract loop, touch lockdown, self-healing |
| A cinematic page, landing, music video | `design.md` + `canvas-2d.md`/`webgl.md` | overlay stack, engine-first, naturalism pass |

All genres share the same workflow (§3), architecture rules (`architecture.md`), and ship gates
(§6). The genre reference replaces `design.md`'s *motion* guidance: dashboards invert it.

**Storage:**

| Need | Use |
|---|---|
| Small prefs, progress, XP | `localStorage` + try/catch (default) |
| Larger typed records / many rows | IndexedDB, same try/catch wrapper |
| One-shot flags (unlock state) | `localStorage` with timestamp JSON |

**3D ambition:**

| Ambition | Implementation |
|---|---|
| Wireframe globe, orbiting motes, depth-sorted particles | Hand-rolled 2D-canvas projection (~50 lines of trig) |
| 3D scene, camera flight, cloth, instanced cities, bloom | three.js (r128 inline: 589 KB minified) + UnrealBloomPass and its passes (about 15 KB minified), both measured |
| Photo-real or asset-heavy (large models, many textures) | Still possible in one file; decide file versus site by how it is delivered, not by weight (`html-sensei:sensei-single-file`, `html-sensei:sensei-3d`) |

**Motion runtime:**

| Need | Reach for |
|---|---|
| Repeated ambient motifs, shimmer, pulse | CSS keyframes (free) |
| Route transitions, hovers | CSS transitions + one shared easing |
| Sequenced choreography | CSS animation-delay chains or a tiny JS sequencer |
| Beat/audio-synced scene changes | JS timeline (see `references/audio-reactive.md`) |

---

## §6 · THE SHIP GATE (summary: full checklist in `references/verification.md`)

Before declaring done, run and pass **all three**:

1. **Static**: `python scripts/verify_html.py file.html --strict` (`--offline` for an offline file)
   (tag balance, data shape audit, one-URI sanity, JS parse by script type, network references,
   reduced-motion presence, weight report: information, no budget)
2. **Runtime**: open it as the user will (strict `file://` for a single file), zero console
   errors, each route renders, each feature works. With HTML-Sensei installed, run its gate
   (`sensei-gate.mjs`: axe, keyboard, forced colours, reduced motion, reflow, network, contact
   sheet); Chromium only, so name Firefox and Safari as not verified (`references/verification.md` §2).
3. **Media**: every `<img>` `complete && naturalWidth>0`; audio `duration>0 && !error`;
   `document.fonts.check()` for every family you rely on.

Never claim success on the strength of a previous run: run fresh, every time.

---

## §7 · ANTI-SLOP CHECKLIST (frontend-design-derived)

The generic tells: cream background + terracotta accent, near-black + acid green, broadsheet
hairlines, identical rounded cards with the same soft shadow, ALL-CAPS eyebrow over every heading,
meta strings joined by middle dots, "→" appended to every link, one border-radius on everything.
These are legitimate for *some* briefs; they are defaults rather than choices when they appear
regardless of subject. Where the brief leaves an axis free, don't spend it on a default.

Checks before you ship the design:
- [ ] Would a competent designer recognise this as *this* subject, blind to the text?
- [ ] Is there exactly one bold, memorable element (spend boldness in one place)?
- [ ] Do overlays (aurora, grain, scanlines) serve the scene or are they stickers?
- [ ] Is the one orchestrated page-load moment better than ten scattered fades?
- [ ] Line length < 80ch, type scale intentional, one family per role (display, body, and a third
      for data or mono only when it has a job)?
- [ ] Motion answers user action or focuses attention; nothing loops forever without purpose?

---

## §8 · THE ECOSYSTEM MAP: what was mined and where it lives in this skill

| Source skill / repo | What it got right | Absorbed into |
|---|---|---|
| **anthropics/skills** `skill-creator` | Skill anatomy (SKILL.md + scripts/references/assets), progressive disclosure, evals | this file's shape |
| **frontend-design** (Anthropic + local) | Anti-generic design discipline, calibration of AI tells, restraint | §2, §7 |
| **canvas-design** | Philosophy-first art; deduce a subtle conceptual thread; second-pass refinement | `design.md` §8, workflow phase 6 |
| **algorithmic-art** | Template-first building; seeded randomness; parameter philosophy; Art-Blocks pattern | `canvas-2d.md` §6, `workflow.md` phase 4 |
| **hyperframes family** (local) | Routing tables, symptom→fix indexes, non-negotiables separated from craft rules | §1 router, every `Symptom → Fix` table, §4 |
| **taste-skill** (local, 1,206 lines) | Three-dial system, brief inference, anti-default discipline | §2 |
| **web-design-guidelines** (Vercel) | The UI quality checklist discipline (focus, a11y, perf) | `verification.md` §2, `interaction.md` §5 |
| **verification-before-completion** | "Evidence before claims, always": the gate function | §4 rule 1, §6 |
| **agent-browser** | Stub pattern: point to fresh content; use real browser verification, not vibes | `verification.md` §2 |
| **web-artifacts-builder** (Anthropic) | init→develop→bundle→test pipeline; esbuild bundling to one HTML | `media-embedding.md` §7 (alternative to hand-rolling) |
| **mega-study-method** (local) | Learning-science: retrieval-first, spaced schedules (+1,+3,+7,+15,+31,+63), tutoring loops | `learning-apps.md` §5 |
| **msrt-mini-lessons** (local) | Teach-the-rule-not-the-key; distractor analysis in quiz explanations | `learning-apps.md` §4 |
| **slide-skill ecosystem** (ToseaAI/awesome-html-slide-skills: frontend-slides, huashu-design, guizang-ppt-skill, visual-explainer, html-ppt-skill, open-slide) | Fixed-canvas scaling, presenter mode, theme-as-tokens, show-don't-tell | `presentations.md`, `assets/starter-deck.html` |
| **component galleries & registries** (Uiverse, 21st.dev, shadcn/Aceternity/Magic UI, Layers.to, Godly, Codrops, jsfxr, Lucide, Fontshare…) | Verified-licence asset & technique registry any LLM can scrape | `sources.md` |
| **marketplaces** (awesome-claude-skills, awesomeskill.ai, truefoundry registry…) | Confirmed no single-file-cinematic skill existed; that gap is this skill | whole thing |
| **pmndrs/react-three-fiber** (+ drei) | Delta-clock `useFrame` discipline; declarative scene reuse; React↔fiber version pairing | `library-ecosystem.md` §1 (Door-B case, media-embedding §7) |
| **dashersw/liquid-glass-js** | Vanilla+WebGL liquid glass; layered refraction/rim/base parameter model; nested-glass sampling | `library-ecosystem.md` §2, `design.md` §9 |
| **ruucm/shadergradient** | Animated-gradient plane params (uSpeed/uStrength/uFrequency); query-string preset format | `library-ecosystem.md` §3 → re-derive via `webgl.md` §6 |
| **paper-design/liquid-logo + paper-design/shaders** | Liquid-metal = domain-warped noise + metallic ramp; zero-dep vanilla shaders (Apache-2.0) vendoring path; the liquid-logo app itself is PolyForm Shield (reference only) | `library-ecosystem.md` §4 |
| **similar wave** (nikdelvin/liquid-glass CSS+SVG, childrentime/liquid-glass, ybouane/liquidglass, collidingScopes/liquid-logo, pmndrs/postprocessing, TresJS…) | CSS/SVG-filter glass variants; composer pass math; Vue twin of fiber | `library-ecosystem.md` §5 sweep table |
| **HTML-Sensei** (the package's priority skill set) | Doctrine (no budget, target device, evidence, licences, built-in accessibility), the gate | §0, §4, §6, every reference that points to `html-sensei:` |

Rules for extending this skill later: keep SKILL.md < 500 lines; put depth in references with a
routing pointer from §1; every new technique lands as a **Symptom → Fix** or **Decision** table row
first, prose second; add eval prompts to `evals/evals.json` when you add a capability; keep the
three-dial vocabulary consistent.

---

## §9 · FILE MANIFEST

```
goat-html/
├── SKILL.md                    ← you are here (router + doctrine + tables)
├── CHANGELOG.md                ← changes made for the HTML Router package, with evidence
├── references/
│   ├── workflow.md             ← the 8-phase loop with gates & timing
│   ├── architecture.md         ← data contracts, stores, routers, sentinels
│   ├── design.md               ← tokens, type, glow systems, overlays, naturalism
│   ├── canvas-2d.md            ← RAF loops, particle systems, holograms, confetti
│   ├── webgl.md                ← three.js scenes, post-processing, performance
│   ├── library-ecosystem.md    ← 2026 effects wave: r3f, liquid glass, shadergradient, liquid-logo: port vs bundle
│   ├── media-embedding.md      ← base64 pipeline, sharp, ffmpeg, fonts, libraries
│   ├── audio-reactive.md       ← WebAudio engines, band splitting, lyric timelines
│   ├── presentations.md        ← decks: fixed canvas, keyboard nav, presenter mode, print
│   ├── dashboards-reports.md   ← charts, KPI cards, tables, print stylesheets
│   ├── tools-games.md          ← tools, games, kiosks: interaction-first genres
│   ├── learning-apps.md        ← courses, quizzes, flashcards, spaced repetition
│   ├── interaction.md          ← routers, modals, toasts, SFX, keyboard, a11y
│   ├── sources.md              ← scrape registry: components, motion, SFX, fonts, icons + licenses
│   ├── verification.md         ← the three gates, static + runtime + media
│   └── case-studies.md         ← Idiom-Ville · Ultra Bookworm · Arabian Nights
├── scripts/
│   ├── verify_html.py          ← static gate (Python standard library; uses Node when present)
│   ├── inline_media.py         ← resize+base64-embed images (needs Pillow)
│   ├── inline_three.py         ← fetch & inline three.js + UnrealBloom (r147 or older), minified
│   └── serve.py                ← zero-dep preview server, no-store, localhost (--lan for phones)
├── assets/
│   ├── starter-lite.html       ← minimal cinematic shell (offline, reduced motion built in)
│   ├── starter-rich.html       ← tokens+overlays+router+store+SFX shell (offline)
│   ├── starter-deck.html       ← fixed-canvas deck: keys, swipe, buttons, presenter, print (offline)
│   ├── engine-analyzer.js      ← probes any HTML's engines/data/sentinels/network map (Node 22+)
│   └── design-read-template.md ← fill-in-the-blanks design read
└── evals/
    └── evals.json              ← 10 test prompts with assertions
```
