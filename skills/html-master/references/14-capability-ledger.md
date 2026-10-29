# Capability ledger: used, researched and contingent

This is a decision aid, not a claim that every listed tool produced the approved artefact. Check availability, licence, API and subscription at the time of the next project. The detailed source links and licensing cautions are in [the source atlas](08-source-atlas.md).

## Used in the AI Level-Up production

| Capability | Actual role | Keep in mind |
|---|---|---|
| Native image generator | Concept art, portrait variants and neural scene environment | Prompt for compositional negative space; review identity and generated details; retain provenance. |
| HTML, CSS, SVG and Canvas | Shell, live diagrams, card interactions, 29 recaps, entrance effects | Prefer semantic DOM labels over text baked into images. |
| Three.js / GLTFLoader / SkeletonUtils | Live 3D dioramas, brain observatory, rigged humans/robot | Normalise meshes carefully; retain model licences; test context loss; judge performance on the target devices and name those not tested. |
| Remotion | Portrait film and a short interlude | Useful when exact frame timing and React composition matter; export deterministic media. |
| HyperFrames | Earlier interlude and motion workflow/reference | A render tool, not the source of the live 3D neural map. Read its entry skill before authoring with it. |
| FFmpeg / ffprobe | Trim, transcode, make seekable derivatives, inspect streams | Record exact commands and verify runtime codecs. |
| PDF.js | Offline book canvas and selectable text/highlights | Keep worker embedded/local; map normalised highlight coordinates; test many pages. |
| Playwright / local Edge | Route, flashcard, quiz, book, mobile and timed scene checks | Test the actual `file://` delivery. Screenshots alone are insufficient. |
| Python, Node.js, PowerShell | Content/asset authoring, assembly, inspection and QA | Keep readable editable sources; avoid machine-specific paths in portable code. |
| Mega Study Method, master-ai-level-up | Learning structure and source interpretation | Respect the source text and lesson goals; don't copy every method rule mechanically. |
| Taste, UI/UX Pro Max | Art direction, type/colour hierarchy and interface critique | Use an original direction; don't mistake an aesthetic heuristic for user intent. |
| PDF and skill-creator skills | PDF/skill packaging and validation | Follow their current validation steps on the host where used. |

## Researched, referenced or optionally available

| Route | When it may beat the project's chosen route | Condition |
|---|---|---|
| React Three Fiber / Drei | Complex declarative React 3D interface | React bundle/build and WebGL fallback acceptable. |
| Babylon.js | Richer 3D tools and engine conventions | Record output weight as information; check the API and version. |
| PixiJS | Many 2D sprites/particles with GPU rendering | It is 2D, so pair with CSS/DOM for accessible text. |
| `3d-force-graph` | A dense exploratory network | Avoid when an exact educational topology must stay legible. |
| GSAP ScrollTrigger / Motion / Lenis | Choreographed page transitions and scroll sequences | Test scroll control, reduced motion, licensing and initialisation order. |
| Rive / Lottie | Compact authored vector animation with states | Verify offline runtimes and interaction requirements. |
| Theatre.js / Blender | Precise cinematic scene authoring | Accept the heavier authoring/export pipeline; review package licence boundaries. |
| Spline | Rapid spatial prototyping | Verify export/self-hosting and plan terms before committing to offline single-file. |
| Sites / hosting / PWA | Many files, server control, authentication or synchronisation | Change the delivery contract; a local password cannot become secure. |
| Canva / Figma | Collaborative layouts, brand systems or rapid marketing graphics | Exported visual comps still need HTML behaviour and accessibility. Figma plugin was only an optional recommendation, not used. |
| 21st.dev, getlayers.ai, MotionSites, Magic UI, Codrops, React Bits | Reference or component source | Inspect live licence and functionality; adapt, don't bulk-copy. User-supplied MotionSites templates were design references. |
| Poly Haven / Kenney / Quaternius / Three examples | CC0/compatible visual assets | Record creator, exact asset, changes and notice; don't assume every asset on a domain shares a licence. |
| Firecrawl / developer/research search | Focused source discovery or citation tracking | Web tools supplement primary docs; current projects may not have this connector. |
| Unity | Full game-like simulation | Usually excessive for an offline course; consider only when physics or 3D authoring complexity justifies it. |
| SWF/Flash | Historical reference only | Modern browser delivery requires conversion/reimplementation. |

## Choosing A, B and C

**Hero motion:** A: live CSS/SVG/Canvas for responsive interface-linked motion; B: Remotion/HyperFrames rendered loop; C: still key art with responsive layers and subtle depth. Choose after testing startup and user control.

**Educational diagram:** A: semantic SVG with explicit scene states; B: live Three.js with recognisable objects and captions; C: exported video plus accessible transcript and stage labels. Use 3D only when depth or object relationships clarify the concept.

**Long-form reading:** A: embedded PDF.js with text layer and highlights; B: semantic HTML transcription with citations; C: external downloadable PDF. For a large offline file, test the worker, browser memory and highlight persistence before selecting A.

**Single-file packaging:** A: embed every asset the design needs, at the quality it needs, and report the weight; B: ship a folder/PWA with relative assets; C: stream from a server. The user's delivery contract decides, not a size budget (there is none unless the user sets one). Size is information, not a quality signal: neither trim the design to hit a number nor pad it to look premium. With HTML-Sensei installed, `html-sensei:sensei-single-file` holds the packing recipes.

**Source research:** A: official docs/repositories and licence files; B: curated examples/tutorials verified against primary docs; C: design inspiration without code reuse. Label each claim's evidence tier.
