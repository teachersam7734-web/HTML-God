# Delivery validation

Revision of 27 October 2026, on Windows 10 with Python 3.13, Node 24 and a global `playwright-core`. See [the changelog](../CHANGELOG.md) for what changed.

- `scripts/validate_skill.py`: **valid** (structure, relative links, private names, machine paths, em and en dashes). `report.json` holds its portable output.
- `scripts/self_test.py`: passed (validation, catalogue against the shipped assets by path, size and SHA-256, embedding and escaping, token replacement in one pass, path escape refused, manifest, ZIP CRC). It works in a temporary folder and leaves nothing behind.
- `scripts/build_single_file.py` and `scripts/asset_manifest.py`: exercised by the self-test and run from the command line; `scripts/build_catalog.py` regenerated the catalogue (15 assets).
- `assets/starter/index.html` through HTML-Sensei's gate (`sensei-gate.mjs`, strict `file://`, software GL, Chrome): **pass**, 21 checks passed, no warnings: no console or page errors, no external requests, calm under reduced motion, controls keep their shape in forced colours, axe 4.14 with no violations at mobile, desktop and dark, keyboard order and focus rings, 24 px targets, reflow at 320 px, text spacing, blocked storage. Before this revision the same gate failed it (two axe violations, motion under reduced motion, a control shapeless in forced colours, unguarded smooth scrolling).
- `scripts/browser_smoke.cjs` on the starter: **passed** in Chrome and in Edge, strict `file://`, offline, 1440 x 900 and 390 x 844 with touch, each with and without reduced motion: no errors, no external requests, no horizontal overflow; the card turns by click and by Enter and exposes the answer, the sequence reaches step 3, Pause motion stops every animation, reduced motion leaves nothing running, and notes save.
- Archive: built with `scripts/pack_skill.py`; one `html-master/` root; extracted to a scratch folder, listed and its `self_test.py` run from the extracted copy.

Not verified: Firefox, Safari, macOS, Linux, physical phones and tablets, a real GPU (the gate ran with software GL, so its frame rates are relative), what a screen reader actually says, and the reference modules in `examples/project-source/` (study material that needs the original application to run). The original course's release evidence stays with that project.

Raw screenshots and browser reports are kept outside the archive because they record local absolute paths.
