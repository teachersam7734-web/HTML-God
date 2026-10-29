# Changelog

## 27 October 2026: revision for the HTML Router package

Why: the owner asked for HTML-Master to be freed of errors and brought into agreement with HTML-Sensei, which takes priority where they clash, because the HTML Router will call HTML-Master, GOAT HTML and HTML-Sensei together. The original archive is kept unchanged as the backup. Identity, voice and structure are unchanged: same name, same 14 references, same starter, scripts, examples and assets.

### Agreement with HTML-Sensei

| What | Why | Evidence |
|---|---|---|
| `SKILL.md`: new section "Working with HTML-Sensei" (no budget, never downgrade for a device or the development machine, most exciting design by default, reduced motion and accessibility built in, licence ledger, strict `file://` evidence) with pointers to `html-sensei:sensei-verify`, `sensei-single-file`, `sensei-3d`, `sensei-courses`, `sensei-motion-ui`, `sensei-lottie-rive-video`, `sensei-direction`; the description says HTML-Sensei takes priority | HTML-Sensei doctrine 1 to 5 and its priority rule; the Router needs one stated rule | HTML-SENSEI-ARCHITECTURE.md section 0; html-sensei SKILL.md; skill names checked against the plugin's `skills/` folder |
| `SKILL.md` working defaults: "Preserve useful high-quality media when the brief permits a large file" replaced by "no size budget unless the user sets one; report the weight" | it implied a size limit by default | doctrine 1 |
| `SKILL.md` steps 6 and 7: verify in strict `file://`, offline, forced colours included, with the smoke helper and HTML-Sensei's gate; release completes the licence ledger and states what was not verified | doctrine 3 to 5 | |
| `07-quality-control.md` performance: "Use a lower-detail or static fallback where a device cannot sustain the intended scene" replaced: judge on the target device, never downgrade for this machine or an assumed weak device class, software-GL numbers are relative, a static path is for real failures | direct clash with doctrine 2 and the owner's standing preference | design-read.md section 5 ("never switch an effect off because a device class is assumed weak") |
| `07-quality-control.md`: strict `file://` (no `--allow-file-access-from-files`) named; HTML-Sensei gate named | doctrine 3 | |
| `02-architecture.md` large files: unrestricted size is the default, weight reported, never simplify for the development machine | doctrine 1 and 2 | |
| `14-capability-ledger.md`: single-file packaging option A now "embed every asset the design needs and report the weight" instead of "embed verified small/medium assets"; Babylon.js "audit output size" now "record weight as information"; Three.js "test mobile performance" now "judge on target devices, name those not tested" | budget-like advice against doctrine 1 and 2 | |
| `03-assets.md`: every font, model, image, sound and vendored piece gets a licence-ledger row | doctrine 4 | |
| `04`, `05`, `14`: one-line pointers to the HTML-Sensei skill that covers the topic in depth | the task allows pointing instead of duplicating; HTML-Master stays usable alone | |
| `10-tools-collaboration.md`: close only browsers you opened; never kill a browser by image name | HTML-Sensei rule (guard-process hook, section 3.6 rule 7) | |
| `08-source-atlas.md` React Bits row: never ship its components inside a skill, plugin or template pack | HTML-Sensei licence rule 15 and section 7 | React Bits LICENSE.md fetched 27 October 2026 |
| Clashes listed in design-read.md section 5 that are not in HTML-Master (size tiers, one heavy library max, hero canvas faded on small screens, two font families max, motion 6, liquid glass "verified cross-browser") | searched every file; none of these phrases or rules occur in HTML-Master (they belong to GOAT HTML) | grep over the extracted package |

### Starter (`assets/starter/index.html`)

| What | Why | Evidence |
|---|---|---|
| Flashcard: removed the `aria-label` that replaced the card's text, so the visible face is the accessible name; the hidden face gets `aria-hidden` and swaps on turn | axe `label-content-name-mismatch` (serious); a screen reader never heard the question or the answer | gate before: FAIL; after: no violations |
| Active step label colour raised to the ink colour | axe `color-contrast` (serious) on `.active > small` | same |
| Three-stage route is now an `<ol>` with `aria-current="step"` on the active stage | `aria-label` on a role-less `div` (axe `aria-prohibited-attr`, needs review) | same |
| Reduced motion: the floating sphere and orbit stop (`animation:none`) instead of running infinite 0.01 ms loops; transitions on the card and steps are dropped | the gate saw 2 infinite animations still running under reduced motion | gate `reduced-motion`: WARN before, PASS after |
| New visible "Pause motion" button (`aria-pressed`) that pauses every animation | WCAG 2.2.2 pause, stop, hide; HTML-Sensei doctrine 5; the skill's own reference 01 asks for a visible motion preference | smoke `motionPauses: true` |
| Forced colours: card, call to action and active step keep a border or outline | the card button lost its shape | gate `forced-colors`: WARN before, PASS after |
| `html { scroll-behavior: smooth }` removed | ignores reduced motion; HTML-Sensei lint rule | gate `smooth-scroll-root`: WARN before, gone after |
| Duplicate `aria-label` on the labelled textarea removed; import clears the file input and ignores a cancelled pick; the in-page call to action arrow is now a down arrow; the navigation wraps so the motion button is never clipped at 320 px | small correctness and layout issues | 400 per cent zoom shot in the contact sheet |
| Header comment saying what was and was not verified | doctrine 3 | |

### Scripts

| What | Why | Evidence |
|---|---|---|
| `browser_smoke.cjs`: finds `playwright` or `playwright-core` in the script folder, the current folder or the global npm root; honours `BROWSER_EXECUTABLE`; tries Chrome, then Edge, then Playwright's Chromium; sets the context offline; runs each viewport with and without reduced motion and with touch on mobile; records console errors; fails on external requests; checks the card by keyboard, the answer exposure, the Pause motion button and stillness under reduced motion | it failed with `MODULE_NOT_FOUND` unless `PLAYWRIGHT_MODULE` was set; it defaulted to Edge only; `BROWSER_EXECUTABLE` and "offline mode" were documented in reference 11 but not implemented; it only ever tested reduced motion | original run: `Cannot find module 'playwright'`; revised run passes in Chrome and Edge |
| `build_single_file.py`: tokens replaced in one pass; `</style` and `</script` escaped in any letter case | a `{{NAME}}` inside embedded content was replaced by later slots; `</SCRIPT>` passed through unescaped | new self-test assertions |
| `self_test.py`: works in a temporary folder; checks the catalogue against the shipped files by path, size and SHA-256; tests one-pass replacement, upper-case escapes and a refused path escape; tests the private-name check with a synthetic name | it wrote `self-test-work/` beside the skill folder, which fails in a read-only install and litters the parent | original run left `self-test-work/` in the parent folder |
| `validate_skill.py`: original names stored as SHA-256 hashes instead of split strings; generic machine-path pattern; em and en dash check; `CHANGELOG.md` required | the validator itself carried the original branding and machine paths in readable form | |
| `asset_manifest.py`: records the root's folder name, not its absolute path; usage in the docstring | a manifest carried a machine-specific path (the old validation note said so) | |
| `build_catalog.py`: exact origin and role for every font and notice (it labelled them all "Original project or OFL-licensed font"); refuses a file without a catalogue note | the catalogue did not say which font or notice each file was | font copyright and version read from each TTF's name table |
| `pack_skill.py`: archive root always `html-master/`; refuses to write inside the skill folder; imports work from any current folder | packing from a folder with another name changed the archive's root | |
| `references/asset-catalog.json` regenerated; `validation/report.json` regenerated (it said 57 files while the archive held 53) | stale | |

### Wrong or outdated statements

| File | What was wrong | Now | Checked against |
|---|---|---|---|
| `11-recipes.md` | documented a different `build_single_file.py` (a JSON spec with `template`, `css`, `js`, `output` and `/*HTML_MASTER_CSS*/` markers) and a different `asset_manifest.py` (`path --out`) | documents the real `--root --template --manifest --output` slots interface and `--root --include --output` | the scripts and the self-test |
| `11-recipes.md` | "The included `prepare-intro.py`" | it is not included; it stays with the original project | archive listing |
| `11-recipes.md` | packaging steps | adds `build_catalog.py`, the report output and where to write the archive | |
| `09-project-case-study.md` | the examples were said to include `app`, `pro`, `premium`, `gold`, motion sources, video preparation, build logic, scenario data, recap logic and QA scripts; "evidence files included with the package" | only the five modules shipped are named; the rest and the evidence stay with the original project | archive listing |
| `12-package-use.md` | "selected reusable vectors" included; excluded items' "transformation scripts and reference filenames are documented"; Codex-only install and `$html-master` syntax | no vectors claimed; the catalogue records excluded kinds and reasons; install and invocation for Claude Code and Codex; `agents/openai.yaml` explained | archive listing; catalogue |
| `03-assets.md` | the catalogue was said to inventory portrait variations, supplied media and infographics | it lists included files and the excluded kinds | catalogue |
| `assets/models/CHARACTER-CREDITS.md` | "The source code shows its decoder" (no decoder ships) | documents the binary layout read from the file and a five-line Three.js decoder | file parsed with Python and the decoder run in Node: `IARB`, 174,658 vertices, 961,995 indices, unit normals, sizes add up exactly to 8,039,784 bytes |
| `08-source-atlas.md`, `SKILL.md` | "Research refreshed 18 September 2026" | first reviewed September 2026; links and named licence facts rechecked 27 October 2026; the rest marked as September review | all 62 external links fetched: 59 returned 200 directly, tympanus.net returned 200 with browser headers, and rive.app and adobe.com, which blocked the script, were confirmed through a fetch service |
| `08-source-atlas.md` GSAP | "current standard terms permit commercial website use and restrict specified competing visual animation builders" | GSAP, former bonus plugins included, is free for everyone under Webflow's standard "no charge" licence; prohibited only in no-code visual animation builders competing with Webflow | gsap.com/community/standard-license and gsap.com/pricing |
| `08-source-atlas.md` Spline | "listed as Enterprise at refresh" | Enterprise-plan feature, date given | Spline self-hosted export docs |
| `08-source-atlas.md` GetLayers | "refresh page retrieval failed" | loaded on 27 October 2026; terms not verified | HTTP 200 |
| `08-source-atlas.md` SkeletonUtils | "newer docs URL failed during refresh" | the `docs/pages/SkeletonUtils.html` page still 404s; dated | HTTP 404 |
| `08-source-atlas.md` Brain Project, RobotExpressive, UMRAM | "viewer code terms are separate"; "CC0 per model notice" | viewer code Apache-2.0, model CC BY-SA 4.0; RobotExpressive CC0 1.0 per its README; UMRAM repository CC0 1.0 | each upstream LICENSE or README |
| `assets/models/brain-surface-LICENSE.txt` | did not say the viewer licence does not cover the model | adds that line with the recheck date; spelling | Brain Project README "Attribution & licence" |
| `SKILL.md` | "Tested project environment: Windows, local HTML in Microsoft Edge" | Windows 10 only; course tested in Edge; this revision in Chrome and Edge through Playwright; Firefox, Safari, macOS, Linux and physical phones not tested | |
| `validation/README.md` | described the old validation (Edge only, quick validator, 57 files) | this revision's evidence and what was not verified | |

### Branding, paths, dashes, spelling

- Personal branding, access password and machine paths: none found in any text file (scan for drive-letter user paths, `/Users/`, `/home/`, password strings, e-mail addresses and the original brand names). The only occurrences were the validator's own split strings, now hashed.
- Em dashes: three, all in `examples/project-source/` strings (two in `animations.js`, one in `neural.js`), replaced by a colon or a comma. No en dashes. The validator now rejects both.
- British spelling in all prose (SKILL.md, references, notices, source map, `agents/openai.yaml`): colour, behaviour, licence (noun), artefact, normalise, organise, recognisable, labelled, centring, authorise, synchronise, trade-off and others. Code, inline code, URLs, file names and proper names (MIT License, Apache License, SIL Open Font License) unchanged. The historical example sources keep their American spellings in code and strings.
- Line endings preserved: files that were CRLF in the original archive are still CRLF.

### Judged and left alone

- `agents/openai.yaml`: Codex display metadata (name, short description, default prompt). Harmless in a Claude package; kept, explained in reference 12, spelling fixed.
- Orbitron's Reserved Font Name: the TTF still calls itself Orbitron (version 2.001, 208 glyphs, 207 mapped characters), which matches an unmodified Google Fonts build, so the name is allowed. Whether it was subset was not provable from the file alone. Orbitron is shipped but no reference uses it; kept as a catalogued asset.
- Manrope's OFL text says "Copyright 2018 ... googlefonts/manrope" while the font says 2019 and the designer's repository; both name the Manrope Project Authors under OFL 1.1, so the notice covers the file. Not edited, because the OFL text is copied verbatim from upstream.
- The `examples/project-source/` modules: study material that needs the original application; not run, not restyled.
- Historical facts in the case study (counts, versions such as Three.js 0.180.0 and PDF.js 3.11.174, Edge testing): history, not recommendations; kept.
- Rows of the source atlas not named above (Lenis, Lottie, Remotion, HyperFrames, Babylon.js, PixiJS, Poly Haven, Kenney, Blender, FFmpeg): links resolve, licence wording not re-read; marked as the September review.
- The "Enroll" label in the case study: the course's actual button text, kept.

## Coordinator, 2026-10-28

- Eight text files were stored with CRLF line endings (the starter, the five example sources, the asset catalogue and
  the validation report). Converted to LF so the package passes the combined HTML package's LF check; the self-test,
  validator and packer were rerun and pass, and the repacked archive holds no CRLF file.
