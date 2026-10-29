# Asset production and native image generation

## Build an asset brief, not a decoration list

For each asset record: role, subject, aspect ratio, crop/safe area, required transparency, visual family, source/provenance, rights, expected usage, file path and status. Assign a purpose: focal identity, conceptual metaphor, environmental depth, diagram support, transition plate, portrait montage, book cover, recap or loading fallback.

Use formats according to the job:

- SVG for editable diagrams, icons, short exact labels and clean vector exports.
- Generated raster for atmospheric artwork, photoreal/stylised scenes, complex textures and portrait variants.
- GLB/geometry for actual camera movement, interactive objects and reusable character rigs.
- MP4/WebM for rich predetermined motion; keep interactive labels and controls in HTML.
- CSS/Canvas for light atmospheric systems and original geometry where they are genuinely sufficient.

Do not offer a CSS blob as a completed request for a detailed brain, real objects or an identity-preserving portrait. Conversely, do not burn every UI label into a raster to make it look cinematic.

## Native image-generation workflow

Use the available built-in image tool for ordinary generation and editing. Inspect a local reference before using it. Identify whether each image is an identity reference, edit target, style reference or supporting insert. Use the tool's exposed schema rather than inventing quality/model arguments.

A user saying "GPT Image 2.5" is not evidence that this version is exposed. Record the actual tool path and returned capabilities; describe an unspecified native model honestly. Do not silently switch to a paid/API workflow to obtain a different parameter. If native generation fails, state the limitation and use an authorised alternative or ask about the material trade-off.

Prompt structure:

```
Use case: stylised-concept / scientific-educational / identity-preserve
Asset role: hero, isolated object, background, infographic artwork, montage frame
Subject and meaning: the concrete object and the concept it supports
Composition: ratio, camera, focal location, safe text area, crop boundaries
Material and light: physical surfaces, key/fill/rim, atmosphere and depth
Palette: colour roles and exceptions
Invariants: identity, number/order of objects, exact visual relationships
Text: none, or a short exact specification
Exclusions: frame, watermark, background field, glasses, extra symbols, etc.
```

Use only relevant fields. Preserve a specific user prompt rather than adding arbitrary actors, logos or narrative details.

For transparent assets, request actual alpha and inspect the saved file: a painted checkerboard is not transparency. Check edge halos on both dark and light backgrounds. Preserve generated alpha; save a project-bound copy in the workspace and update consuming references. Do not leave the only copy in a generator cache. Keep the original and selected final separately when iterating.

## Portrait montage recipe

This project used six synthetic variants of a supplied identity: frontal galactic origin, left three-quarter, right three-quarter, sparks/lightning, cyber half-mask, infinity finale. Shared constraints maintained identity, omitted glasses, avoided text and used coherent lighting. These are synthetic interpretations, not documentary footage.

For reuse, substitute the newly authorised identity reference. Do not inherit a previous person's portrait, name or signature. Generate each required variation, inspect face consistency, save output and prompt, then compose motion. Use slow camera travel, mild parallax, overlapping crossfades, particles behind important features and a deliberate ending. A small number of consistent images usually outperforms many unrelated variants.

## Infographic recipe

First choose a source-grounded relationship: sequence, dependency, contrast, loop, evidence chain or hierarchy. Write one takeaway, three to five essential concepts, one example and one limit. Specify what arrows mean. Do not illustrate a mesh as automatically superior or label an artistic neuron as proof of a learning mechanism.

The proven route was layered: generated conceptual artwork plus exact SVG/HTML labels. Chapter recaps used a 1600 x 900 canvas, readable margins, source labels, interactive concept selection, accessible text and SVG export. These are original SVG infographics, not 29 images attributed to an unconfirmed model version.

Plan B: generate a complete raster infographic with exact short labels, then verify every word and relationship. Repair errors before delivery or rebuild the labels as editable overlays. Plan C: use original vector geometry without raster imagery where precise structure carries the idea better.

## Asset acquisition and licensing

Record the licence for the **asset**, separately from the repository's code licence. Brain Project's viewer and anatomical geometry have different terms. Quaternius characters reused here are CC0; the adapted anatomical surface is CC BY-SA 4.0 with attribution and change notes. A repository being public does not establish reuse rights.

Preserve licence text/source URL, author, retrieval date, modifications and attribution location, and give every font, model, image, sound and vendored piece a row in the project's licence ledger (`.sensei/licences.json` with HTML-Sensei, otherwise a `LICENCES.md` beside the source). Recheck per-item licences on template marketplaces. Open-source components may refer to demo photographs, logos or models with separate rights. Free preview access is not permission to redistribute paid template code. Use supplied templates as references unless their terms clearly allow the desired reuse.

For stock-like environments and objects, see Poly Haven, Kenney and Quaternius in the source atlas. Use official download/export routes, not unauthorised bulk scraping. For high-detail assets consider polygon/texture reduction and bake transforms. Test loaders and animations before investing in full scene choreography.

## Artefacts included in this package

The [asset catalogue](asset-catalog.json) lists every included file with origin, role, size and SHA-256, and records the kinds of material deliberately left out: the personal portrait and signature, the identity-specific portrait series, the book, manuscript and covers, the music and supplied films, the access password and third-party runtimes. Reusable non-personal generated scenes are included under `assets/generated/`. The original project retains the excluded material unchanged.

The descriptive prompt recipes in this reference are reusable production specifications. Unless explicitly marked as an exact retained prompt, do not present a reconstructed brief as a verbatim historical tool call.

## Inspection checklist

- Subject and identity match the brief; object count and relationships are correct.
- Composition works in the actual page crop and at narrow widths.
- Transparent assets have real alpha and clean edges.
- Text is exact, legible and editable where useful.
- Lighting and palette integrate with the target page; no accidental purple/green leftovers in a gold system.
- Source, generation method, modifications and files are logged.
- Output is actually embedded or reachable offline as promised.
- A generated visual does not imply measured evidence, anatomical precision or guaranteed outcomes unless separately established.
