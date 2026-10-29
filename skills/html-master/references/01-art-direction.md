# Art direction that survives implementation

## Start from a visual argument

Translate adjectives into visible choices. "Cinematic" can mean deliberate framing, foreground/midground/background separation, motivated lighting, a coherent camera move and an arrival beat. It does not require a black background. "Futuristic" can mean a precise information hierarchy, responsive spatial navigation and unusual materials; tiny monospaced copy and neon borders everywhere usually make reading worse. "Premium" needs consistency and care in utility pages, loading states and controls, not only a hero screenshot.

Write a brief with: audience; primary action; content density; requested output format; offline/hosted requirement; brand invariants; supplied assets; approved baseline; desired spectacle; explicit exclusions; target devices; accessibility preferences; and content that must remain exact. Treat a user's acceptance of recommendations as authorisation for routine choices, not an invitation to keep asking the same questions.

The AI Level-Up preferences are a useful example: dramatic, modern, original artwork, strong page motion, expressive educational scenes, coherent black/yellow/gold with restrained red for the Pro shell, independent palettes inside special animations, and no arbitrary file-size target. These are **case-specific preferences**, not automatic requirements for every future project.

## Compose page families

Define a small set of page families before scaling:

- **Entrance:** identity, distinctive object or portrait, title, promise, clear action, supporting proof, a transition that does not trap the user.
- **Dashboard:** resumption and progress first, discovery second. A cinematic header should not force repeat visitors to scroll through a film before reaching work.
- **Content:** expressive chapter entrance, stable reading surface, legible hierarchy, visible next action, neighbouring lessons and source access.
- **Interactive exhibit:** strong title, one-sentence purpose, scenario choice, scene, accessible controls, current explanation, transcript and return link.
- **Utility:** notes, preferences, results, source library and reader use the same spacing/type system. These are not exempt from design quality.

Use asymmetry with alignment: a dominant composition, a deliberate offset, repeated baselines and generous quiet space. Avoid giving every card the same border, glow and radius when their roles differ. A meaningful focal object earns detail; secondary chrome should recede.

## Colour roles, not random accents

Use primitive, semantic and component tokens. Example primitives from this project: near-black `#090909`, warm ivory `#f5e9ca`, metallic gold `#d7ad53`, highlight `#fbe68b`, restrained red `#b83728`. Map them to surface, text, muted text, focus, action, emphasis, separator and status roles. Then define component exceptions such as the blue/coral neural observatory.

Metal is a material treatment: broad reflected light, edge highlights and a darker side, not a uniform yellow fill. Glass needs a visible background, translucent surface, restrained blur, a fine edge and enough opaque support for text. Translucency alone is not a reason to lower text contrast.

Evaluate the final composited colours. A nominal foreground/background contrast calculation can mislead when moving media, gradients, opacity and blend modes intervene. Test controls in default, hovered, pressed, focused, selected, disabled, loading and error states. Keep meaning available in labels/icons as well as colour. Use current [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) for thresholds; do not declare a whole product compliant from one token check.

The earlier cream/green entrance mixed badly with retained purple assets and dark text on glass. The successful repair replaced the composition and its tokens coherently. Do not keep piling a new palette onto incompatible old media and overrides.

## Type as an assigned system

Give each family a job. This project used Barlow Condensed for cinematic headings, Manrope for reading/UI and JetBrains Mono for compact technical labels; earlier fonts remained where their role was established. A user's request for variety does not mean a different face for every paragraph.

Build a responsive type scale and test real longest headings. Avoid fixed-height cards that assume English labels will be short. Keep body copy comfortably readable, line lengths controlled and line-height generous. Small technical labels can support atmosphere, but never carry the only instruction or essential fact. Use actual licensed font files offline and keep the corresponding notices. Test loading failure with a sensible fallback stack.

For chapter recaps and PDFs, add exact wording as selectable HTML/SVG/vector text whenever possible. Generated images can supply depth and texture while layout engines preserve spelling and resizing.

## Motion across the product

Separate three levels:

1. **Atmosphere:** slow contour drift, light response, subtle particles, reflected highlights. Quiet, pausable/reducible, not behind dense text at full contrast.
2. **Navigation:** title arrival, page light sweep, hero-to-dashboard passage, brain-to-network transition. Short, responsive to repeated actions, with a usable static/reduced variant.
3. **Explanation:** play/seek/compare animations that expose a relationship or consequence. Learner-controlled and labelled.

Do not satisfy a page-motion request only by adding diagram animation. Conversely, do not make every paragraph bounce to imply richness. Coordinate timing: one dominant arrival, a supporting reveal and then a stable reading state. Repeated navigation should not replay an unskippable intro.

Respect [pause/stop/hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) for automatically moving content and provide a visible motion preference. Reduced motion is a complete experience with discrete states, not an empty page with the animations removed.

## Responsive art direction

Design mobile composition rather than shrinking the desktop. In the neural map, four columns by two rows becomes two columns by four rows. Hover descriptions become tap-to-preview and tap-again-to-open plus an explicit Open button. A projected 3D label is clamped within the scene, while a long explanatory transcript stays below it in normal document flow.

Check at narrow phone width, tablet and wide desktop; also test a live resize across breakpoints. A scene built once from its initial width needs a layout update or remount when that breakpoint changes. Use real touch emulation, since focus and hover events on tap can invalidate seemingly correct desktop logic.

## Reference study method

For every promising example, record the **specific mechanism**: camera follows depth, typography enters by word, a selected node reveals detail, a light sweep masks a route change. Then decide whether to reproduce that mechanism with original implementation or import a licensed component. Do not copy a screenshot's style without understanding its reading order and interaction.

Use a contact sheet of representative pages, not only the landing page. Inspect image crops, headline wraps, overall density, consistency of selected states and the visual distinction between primary and secondary actions. A design is ready when its important pages look related and its controls remain obvious without explanation.
