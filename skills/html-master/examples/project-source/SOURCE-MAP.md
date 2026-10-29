# Selected original implementation modules

These files come from the approved AI Level-Up Pro editable source and are preserved as **study material**, not a standalone copy of the course. They depend on route functions, global course data, bundled Three.js/PDF.js and assets in the original application. Import specific ideas into a new architecture; do not concatenate them and expect a running app.

| Files | What to study | Dependencies and adaptation |
|---|---|---|
| `animations.js` / `.css` | Data-driven SVG educational scenes, scenario switching, labels and playback | Original course scene data and route shell. Replace the course data; write ending assertions for your new scenarios. |
| `cinema.js` / `.css` | Eight live 3D teaching dioramas and environment-specific view states | Three.js, GLTF assets, scene data, original app rendering hooks. Substitute appropriately licensed models and captions. |
| `neural.js` / `.css` | Brain entrance, eight synapses, responsive network and navigation | Original course data, Three.js and anatomical model. The synapses are a navigation metaphor, not a brain map. |
| `reader.js` / `.css` | PDF.js reader, page controls, highlights and stored notes | PDF.js, book data and original state helpers. Test worker and text-layer mapping in the next browser. |
| `shared-intro.js` / `.css` | Shared intro timing, skip/replay and reduced-motion behaviour | Video/poster data and original entry route. Change media and timings deliberately. |

The original `build.mjs` is not copied because it includes the course's proprietary manuscript/PDF/media inputs and a machine-specific dependency location. Its safe build pattern is described in [architecture](../../references/02-architecture.md) and recreated generically in [build_single_file.py](../../scripts/build_single_file.py). Source datasets, password gate, identity portraits, signatures, book and soundtrack are intentionally omitted. This package includes non-personal generated concept images and licensed reference models with a catalogue. It does not grant rights to a future project's content.

Revision of 27 October 2026: three em dashes in user-facing strings (two in `animations.js`, one in `neural.js`) were replaced with a colon or a comma. Nothing else in these files was changed; their American spellings in code and strings are left as the historical source.
