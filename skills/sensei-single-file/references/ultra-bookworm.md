# The worked example: Ultra Bookworm's builder, and the HTML-Master helper

Sources: `build.py` in the owner's Ultra Bookworm project (not shipped) and `app/template.html` in the owner's Ultra Bookworm project (not shipped) (read), `domain-single-file-packaging.md` in the HTML-Sensei build project's research notes (not shipped)
section 3.5 with the coordinator's correction of 2026-10-19, the field log (the build project's field log (SENSEI-LOG, not shipped), design-fix phase 1),
and `HTML-Master.skill` (`scripts/build_single_file.py`, `references/02-architecture.md`).

## What Ultra Bookworm is

One 83.26 MB HTML file: a course with 50 lessons, two type systems, an opening film, music, a WebGL hologram game and
two lesson films. 79.58 MB of it is data. It passes `sensei-verify`'s gate in strict `file://` mode: no console error, no
external request, its canvases have content, load about 4.9 s on the research machine.

## How build.py works

- A template with `/*__NAME__*/` placeholders (safe inside CSS, JS and attribute values) and one `<!--__PATHS__-->`,
  filled with Python `str.replace` (no `$&` problem in Python; JavaScript builders must use a function or split/join).
- Data is validated before anything is written: lesson schema, assessment, required assets; errors abort the build.
- `--check` validates without writing, so parallel agents never race for the output file.
- Fonts: grouped by **content hash** per family, one `@font-face` with a weight range per group (variable fonts appeared
  under several stems and were embedded once per weight, about 300 KB, until this), `unicode-range` split into latin
  and latin-ext.
- Grain is a 292-byte SVG with `feTurbulence`, not a bitmap.
- Images are base64 WebP data URIs; the opening film and music are data URIs in `src`; each reveal image is inlined
  once in a CSS custom property and every tile points at it with its own `background-position`.
- three.js (tree-shaken to an IIFE) goes in as inert text, `<script type="text/x-dm-three">`, compiled on first use
  with `new Function(src + ';return DMTHREE')`. The build **refuses** if the library contains `</script` or `<!--`.
- Lesson films that another hand delivers are optional: an absent file writes an empty slot, and the app shows no
  player at all.
- After every substitution, any `/*__X__*/` or `<!--__X__-->` left is a **refusal to write**: a placeholder nobody
  replaced does not raise, it ships as `src="/*__FOO__*/"`, a silently broken image.
- Order in the template: markup; `<script>window.UB_LESSONS=...;window.UB_ASSESS=...;</script>`; the app script; then the
  two inert film blocks (`application/x-dm-vid`) and three.js at the very end of `<body>`. The app ends with `boot();`,
  not a `DOMContentLoaded` listener.

## The correction, and the lesson

An early gate report read the 31.7 MB "largest inline script" as a 3 s parse task. Measured on 2026-10-19 with a
longtask observer over two runs, it is one of the two inert film blocks at the end of `<body>`: first paint 64 to
124 ms, longest task 101 to 289 ms, no 3 s task. What the 65 MB of inert blocks do cost is `DOMContentLoaded` (3.8 to
4.2 s, against 0.8 s without them), harmless only because nothing waits for it. The field log has the throttled
numbers: payloads moved to the end alone, 38.3 s against 36.7 s (no gain); the direct `boot()` call, 36.4 s to 10.7 s
(20 Mbit/s, CPU slowed four times).

**Lesson for every build: put big payloads in inert blocks after the app script, AND boot without waiting for
`DOMContentLoaded`.** `test-build-single.mjs` reproduces it on a 60 MB block (see `embedding-forms.md`).

Two smaller field lessons from the same file: carry big media as inert `<script type="application/x-...">` text, not as
`data-` attributes on a live element; and a control that must work before the app arrives (Skip on the opening film)
gets its own few-line inline script right after the element.

## What is still open in build.py (left for its owner)

- The lesson and assessment JSON go into a classic `<script>` through `script_json()`, which escapes every `</` as
  `<\/` (added 2026-10-25), so a lesson string holding `</script>` cannot end the script; the rebuilt data was proved
  to read back identical after parsing.
- The lessons are a JS literal (`window.UB_LESSONS = ...`) rather than a JSON text block; fine at its size, but a much
  larger data set belongs in `<script type="application/json">` read with `JSON.parse(textContent)`.

## The HTML-Master build helper idea

`build_single_file.py` (owner's earlier skill): a manifest of named slots, `{"slots": {"STYLES": {"path": "style.css",
"kind": "css"}}}`, tokens `{{STYLES}}`, kinds `css`, `js`, `json`, `text`, `data-url`; every path must stay inside
`--root`; a slot whose token is missing raises; JSON is re-serialised with `<` as `<`. Its architecture notes add:
editable modular source, a compiled single-file deliverable; use replacement callbacks in JS so `$&` in code is never
interpreted.

## How this skill combines them: `scripts/build-single.mjs`

The manifest and kinds from HTML-Master, the guards from build.py, and the order lesson: kinds `css`, `js`, `json`,
`text`, `data-url`, `base64` (inert payload text), `inert-js` (refuses `</script` and `<!--`), `fonts` (content-hash
grouping); tokens `/*__X__*/`, `<!--__X__-->` or `{{X}}`; optional slots; refusal on missing tokens, missing files,
paths outside the project, and leftover placeholders; `--check`; warnings on payloads before the app script, in
`<head>`, and on a boot that waits for `DOMContentLoaded`. The example in `examples/course-shape/` is Ultra Bookworm's
order in miniature.

Where they differ from HTML-Master and GOAT HTML, HTML-Sensei takes priority (additions section 10): no size budget,
weight reported only.
