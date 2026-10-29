# Primary-source atlas and alternative routes

Sources first reviewed in September 2026. On 27 October 2026 every link in this file was rechecked and resolved, and the licence facts for Theatre.js, React Bits, Motion, Magic UI, GSAP, Spline's self-hosted export, Brain Project, RobotExpressive and the UMRAM human model were checked against their primary pages (see the changelog). Other rows are as reviewed in September 2026. Links are primary project/vendor/standards sources. Short findings below are original summaries, not copied manuals. Recheck volatile terms and API contracts before a future implementation. "Reviewed" does not mean installed, copied, tested or included in this package.

## Rendering and motion

| Source | Status in AI Level-Up | Useful route and limits |
|---|---|---|
| [Three.js](https://github.com/mrdoob/three.js), [MIT licence](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | Implemented: pinned 0.180.0 | Direct live 3D, materials, camera, bloom and original scene objects. Retain notice; example assets can have separate licences. |
| [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | Implemented | Load rigged models and animations. Inspect external dependencies/decoders and installed-version API. |
| [SkeletonUtils source](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/utils/SkeletonUtils.js) | Implemented from matching installed add-on | Clone skinned rigs; normalise outside animated hierarchy. A docs page for SkeletonUtils failed in September 2026 (`threejs.org/docs/pages/SkeletonUtils.html` still returned 404 on 27 October 2026); the installed source was the implementation authority. |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [Drei](https://github.com/pmndrs/drei) | Reviewed, unused | React ownership and useful Three.js helpers. Good for a React application; unnecessary migration cost for a small vanilla offline app. MIT repositories; recheck asset licences. |
| [Babylon.js](https://github.com/BabylonJS/Babylon.js) | Reviewed, unused | Fuller engine approach for larger interactive worlds; Apache-2.0. Bundle production dependencies rather than relying on the learning/demo CDN. |
| [PixiJS](https://github.com/pixijs/pixijs) | Reviewed, unused | High-performance 2D scenes, sprites and effects; MIT. Useful when visual depth can be composed in 2D. |
| [3d-force-graph](https://github.com/vasturiano/3d-force-graph) | Inspiration only | Directional particles and graph exploration; MIT. Fixed educational layouts were chosen because force drift obscures causal comparisons. |
| [Theatre.js](https://github.com/theatre-js/theatre), [licence](https://raw.githubusercontent.com/theatre-js/theatre/main/LICENSE) | Reviewed, unused | Artist-authored camera/property timelines. Core uses Apache-2.0; studio uses AGPL-3.0. Separate editing tool from shipped runtime. |
| [GSAP standard licence](https://gsap.com/community/standard-license/) | Used in earlier HyperFrames composition; later live scenes use original clock | Timeline choreography and scroll effects. Not MIT: GSAP, including the former paid plugins, is free for everyone under Webflow's standard "no charge" licence, which permits use on any website or app and prohibits use in no-code visual animation builders that compete with Webflow (checked 27 October 2026). Recheck exact intended use. |
| [Motion](https://github.com/motiondivision/motion), [licence](https://raw.githubusercontent.com/motiondivision/motion/main/LICENSE.md) | Reviewed, unused | JS/React motion, gestures and layout animation; MIT core. Paid services/components, if selected, require their own terms. |
| [Lenis](https://github.com/darkroomengineering/lenis), [licence](https://raw.githubusercontent.com/darkroomengineering/lenis/main/LICENSE) | Reviewed, unused | Smooth-scroll coordination, MIT. Native scrolling was preferred for reading/accessibility and reduced integration risk. |
| [Lottie Web](https://github.com/airbnb/lottie-web), [licence](https://raw.githubusercontent.com/airbnb/lottie-web/master/LICENSE.md) | Reviewed, unused | Prepared After Effects/vector animation playback, MIT runtime. Check export feature support and each animation asset's rights. Good for compact non-3D loops. |
| [Rive web runtime](https://rive.app/docs/runtimes/web/web-js) | Reviewed, unused | Interactive vector characters/state machines. JS/WASM runtime; renderer support and offline WASM/asset loading need explicit work. Editor/export terms are separate. |
| [Spline self-hosted export](https://docs.spline.design/exporting-your-scene/web/exporting-as-self-hosted-project), [code export](https://docs.spline.design/exporting-your-scene/web/exporting-as-code) | Reviewed, unused; earlier URL failed, current route verified | Visual scene authoring. The fully self-contained project export is an Enterprise-plan feature (checked 27 October 2026); ordinary code export is not proof of zero external requests or direct `file://` support. Confirm plan/runtime/export terms. |
| [Remotion](https://www.remotion.dev/docs), [licensing](https://www.remotion.dev/docs/license) | Implemented: portrait and course films | Frame-derived React video composition and rendering. Source available with eligibility/commercial terms; do not label it unrestricted MIT. Confirm current eligibility and product use before new rendering services. |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | Implemented earlier short film; registry investigated for later intro | Deterministic HTML/CSS/media video framework, Apache-2.0 repository. Follow current composition/seek contract and CLI. Registry research is not a claim that every candidate block was installed. |
| [FFmpeg](https://ffmpeg.org/documentation.html) | Implemented local tool | Trim, crop, silent derivatives, frame inspection and seek-oriented encoding. Build configuration/codecs affect distribution and codec licensing; do not infer one blanket licence from the command name. |

## Components, templates and art direction

| Source | Status | Decision |
|---|---|---|
| [21st.dev component catalogue](https://21st.dev/community/components) | Reviewed for heroes, reveal, reading/navigation patterns | Inspect the individual component, dependencies and licence. A catalogue is not one universally licensed bundle. |
| [GetLayers](https://getlayers.ai/) | Earlier project review; page retrieval failed in September 2026 and loaded on 27 October 2026 | Object-led hero and 3D composition inspiration. No paid template code/media extracted. Its current export and licensing terms were not verified. |
| [MotionSites](https://motionsites.ai/) | User supplied Cognitra and Cyber Ronin reference files | Cinematic hero framing, title staging, character presence and depth. User-provided text does not establish blanket rights to all linked third-party media. |
| [Magic UI](https://github.com/magicuidesign/magicui), [Animated Beam](https://magicui.design/docs/components/animated-beam), [licence](https://raw.githubusercontent.com/magicuidesign/magicui/main/LICENSE.md) | Inspiration; original SVG implementation | Directional beam/packet patterns, component catalogue. Repository licence checked; distinguish free source from separately offered paid templates. |
| [React Bits](https://github.com/DavidHDev/react-bits), [licence](https://raw.githubusercontent.com/DavidHDev/react-bits/main/LICENSE.md) | Inspiration only | Strong shader/type/background references. MIT plus Commons Clause condition, not plain MIT (checked 27 October 2026): use in an application, website or product is allowed, but the components themselves may not be sold, sublicensed or redistributed, alone, in a bundle or as a port. Fetch a component into the project with its notice; never ship one inside a skill, plugin or template pack (HTML-Sensei's rule). |
| [Codrops](https://tympanus.net/codrops/hub/tag/three-js/), [LayersAnimation](https://github.com/codrops/LayersAnimation) | Inspiration only | Layered transitions, WebGL image composition, camera depth. Check every demo's code and asset licences separately. |
| [Cinematic scroll example](https://github.com/JosephASG/codrops-cinematic-scroll-animations) | Earlier design research, not imported | A pattern source for depth/camera progression. Does not authorise copying unrelated embedded assets. |
| [Google Fonts](https://fonts.google.com/), [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed), [Manrope](https://fonts.google.com/specimen/Manrope) | Implemented local files | Exact family/weight choices and bundled OFL notices. Host locally for offline work; select roles rather than accumulating fonts. |

## Models and media assets

| Source | Status | Reuse notes |
|---|---|---|
| [Brain Project](https://github.com/itayinbarr/brainproject), [licence](https://github.com/itayinbarr/brainproject/blob/main/LICENSE) | Anatomical surface adapted | Model derives from Z-Anatomy/BodyParts3D, CC BY-SA 4.0; keep author/source/licence/change attribution. The viewer code is Apache-2.0 and does not relicense the model (checked 27 October 2026). |
| [RobotExpressive](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive) | Implemented | Tomás Laulhé / Quaternius; Don McCurdy conversion/refinement; CC0 1.0 per the model's README (checked 27 October 2026). |
| [UMRAM human model](https://github.com/UMRAM-Bilkent/supine-human-model) | Implemented | Rigged Quaternius CC0 character; the repository is CC0 1.0 too (checked 27 October 2026). Inspect clip posture before integrating into desks/scenes. |
| [Quaternius](https://quaternius.com/), [base characters](https://quaternius.itch.io/universal-base-characters) | Character source and future option | Useful stylised people, props and animation packs. Verify the selected download's notice and content. |
| [Poly Haven licence](https://polyhaven.com/license) | Reviewed, unused | CC0 HDRIs/textures/models can support richer physical lighting and objects. Website/API use and non-asset site content have separate terms; use permitted acquisition routes. |
| [Kenney support/licence guidance](https://kenney.nl/support) | Reviewed, unused | CC0 game-asset packs for coherent lightweight props and UI. The Kenney logo is not a generic licensed asset. |
| [Blender](https://www.blender.org/about/license/) | Optional authoring route, not used in the course | Sculpt, decimate, UV, bake and render original assets. Tool licensing and asset/output rights are distinct; verify the actual input asset licence. |

## Runtime, accessibility and testing authorities

- [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage): `file://` persistence is not a portable guarantee; export/import is essential for durable local records.
- [MDN autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): audible playback needs user-gesture handling and a failure path.
- [MDN data URLs](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data): inspect scheme behaviour and limits; embedded payload size is not memory size.
- [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion): respond to the user's OS preference as well as the product toggle.
- [PDF.js](https://mozilla.github.io/pdf.js/getting_started/): matching runtime/worker setup and version-specific text-layer integration.
- [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html): concrete acceptance criteria; not proof that the whole app has been formally audited.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots): stable screenshot methodology; pair it with actual user-flow assertions.
- [Adobe Flash end of life](https://www.adobe.com/products/flashplayer/end-of-life-alternative.html): SWF is not a practical modern-browser delivery choice. Prefer live WebGL/vector interactions or video with accessible controls.

## Plan B and C by constraint

| Constraint | Plan B | Plan C | What must remain |
|---|---|---|---|
| No live WebGL | Pre-rendered scene clips with stage control | Poster + complete vector/text stages | Explanatory meaning and navigation |
| Image generation unavailable | Licensed appropriate artwork | Original SVG/3D illustration if it satisfies the brief | Honest provenance; no fake model claims |
| Need more realistic actors | Better licensed GLTF characters and original props | Blender-authored or pre-rendered character scenes | Identity/rights, useful silhouettes, correct lesson logic |
| Single-file package too slow | Offline folder with lazy media | Hosted static version with deliberate caching | User-approved delivery change and saved-state portability |
| Scroll video seeks poorly | All-intra shorter encode | Frame sequence or authored timeline | Skip action, reduced motion, bounded memory |
| Transparent video inconsistent | Tested alpha codec per target | Masked/composited MP4 and still entry | Clean edges and usable entrance |
| Dynamic page too React-heavy | Framework-free original adaptation | Keep React and bundle properly if already needed | License, offline dependencies, lifecycle cleanup |
| Native PDF integration fails | Valid local worker/Blob strategy | Authorised extracted page images + text/annotations | Book readability, source fidelity, disclosed feature trade-offs |
| Need real paid/private access | Authenticated hosted application | Separate protected distribution channel | Do not sell client-side password as security |
| Agent/research service unavailable | Direct primary-source review and local QA | Narrowly document unverifiable terms | No fabricated independent review or installation claims |

## Installation stance

Install only the chosen stack, not this entire atlas. Inspect existing dependencies and lockfiles first. Use the project's package manager and pin a tested compatible set. Read the installed HyperFrames/Remotion skills before rendering. For external authoring services verify the needed plan/export rights before committing to a workflow. Never silently purchase a template, subscribe to a service, publish a project or send its content elsewhere merely because a source appears here.
