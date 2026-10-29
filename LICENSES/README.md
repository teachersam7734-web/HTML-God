# Third-party notices

Everything in this plugin is HTML-Sensei's own code and writing, except the files listed here. Each entry names the
shipped file, where it came from, its licence, and where the licence text and notice are kept. Paths are relative to
the plugin folder.

| Shipped file | What it is | Origin | Licence | Licence text and notice |
|---|---|---|---|---|
| `skills/sensei-typography/assets/vazirmatn-fa-latin.woff2` | Vazirmatn variable font, subset to Persian and Latin, version 33.003 | Vazirmatn by The Vazirmatn Project Authors, https://github.com/rastikerdar/vazirmatn (subset with fontTools by `sensei-typography/scripts/fontembed.py`) | SIL Open Font License 1.1 | [OFL-1.1-Vazirmatn.txt](OFL-1.1-Vazirmatn.txt); also beside the font as `skills/sensei-typography/assets/OFL-Vazirmatn.txt`; the copyright and licence name records are kept inside the font |
| `skills/sensei-landing-hero/examples/landing.html` (the `@font-face` data URI) | the same Vazirmatn subset, embedded | as above | SIL Open Font License 1.1 | as above; the notice is in the page's header comment and beside the `@font-face` rule |
| `skills/sensei-single-file/fixtures/test-font.woff2` | Vazirmatn version 33.003, a larger subset used as a packaging test fixture | as above | SIL Open Font License 1.1 | [OFL-1.1-Vazirmatn.txt](OFL-1.1-Vazirmatn.txt); also `skills/sensei-single-file/fixtures/test-font-OFL.txt` (identical text) |
| `skills/sensei-motion-graphics/scripts/motion-kit.js` (the twelve `EASE` curves and `EASE_FRAMES`) | ease functions fitted to professional films | motionmaxxing by Tejas Makwana, `runtime/motion.js`, https://github.com/Tejashmakwana/motionmaxxing (modified: wrapped in a UMD module, helpers renamed; the rest of the file is HTML-Sensei's own code) | Apache License 2.0 | [Apache-2.0.txt](Apache-2.0.txt) (from https://www.apache.org/licenses/LICENSE-2.0.txt, fetched 2026-10-28); the project's NOTICE, verbatim: [NOTICE-motionmaxxing.txt](NOTICE-motionmaxxing.txt) (fetched 2026-10-28 from the repository's `main` branch, commit 8c8ec0f); the attribution and the modification note are in the file's header |
| `skills/sensei-ui-components/references/react-bits-notice.txt` | the React Bits licence text (MIT + Commons Clause), as a template a project fills in when it fetches a component | React Bits `LICENSE.md` by David Haz, https://github.com/DavidHDev/react-bits, read 2026-10-24 | its own text (MIT + Commons Clause) | the file is the licence text itself; no React Bits component code ships in the plugin |

Notes:

- The motionmaxxing NOTICE lists third-party components bundled in that repository (GSAP, three.js, opentype.js,
  Inter). None of them was copied into this plugin; the NOTICE is carried whole because Apache 2.0 section 4(d) asks
  for it to travel with the derived work.
- Libraries the skills use at build or test time (three.js, esbuild, playwright-core, axe-core, Tailwind, reveal.js,
  GSAP, Lenis, Motion and others) are installed by the user and never vendored here; when a project inlines one, the
  skill's script keeps its licence header and adds a row to the project's ledger (`lib/ledger.mjs`).
- Test fixtures that look like notices (`skills/sensei-ui-components/fixtures/notice-fixture.txt`) are HTML-Sensei's
  own test data.
- To check this list against the plugin: every font, media file and file carrying "Copyright" or a licence name
  outside `references/` was reviewed on 2026-10-28; the rest is original.


## Publication additions and inherited asset inventory

| File or group | Origin / terms | Notice |
|---|---|---|
| Manrope, Orbitron and Barlow Condensed in skills/html-master/assets/fonts/; Manrope/Orbitron embedded in interview.html; docs/film/Manrope.ttf | SIL Open Font License 1.1 | The corresponding *-OFL.txt files beside the bundled fonts; docs/film/Manrope-OFL.txt |
| HTML-Master generated PNG artwork and the premium-solar atmosphere embedded in interview.html | Existing generated artwork bundled with HTML-Master | Authored package artwork; no third-party character asset is introduced |
| human.glb, robot.glb and brain-surface.bin in skills/html-master/assets/models/ | CC0 character assets; adapted brain geometry CC BY-SA 4.0 | CHARACTER-CREDITS.md and brain-surface-LICENSE.txt in that folder; preserve share-alike terms for adaptations of that geometry |
| interview.html embedded motion-kit.js EASE curves; docs/film/motion-kit.js | motionmaxxing adaptation, Apache-2.0 | Apache-2.0.txt and NOTICE-motionmaxxing.txt here; original inline licence header preserved |
| interview.html embedded sensei-sfx.js | HTML-Sensei original CC0 sound engine | Inline source header retained |
| docs/assets/html-god-hero.png and html-god-icon.png | Generated using built-in imagegen for this repository | [Generation prompts](../docs/assets/GENERATION-PROMPTS.md) |
| docs/assets/html-god-logo.glb, html-god-logo-mesh.json, html-god-logo.png; docs/blender/html-god-logo.blend | Original HTML God geometry authored in Blender 5.2.2 LTS | Editable build script and run report in docs/blender/; no Blender program code is bundled |
| docs/assets/intro-elevenlabs-sfx.mp3 and intro.mp4 soundtrack | Custom ElevenLabs sound generation plus original procedural score | Provenance and measurement notes in docs/film/NOTE.md |

Community repository research introduced original written procedures only. It did not copy third-party source, characters, models or weights; see [research notes](../docs/RESEARCH.md).
