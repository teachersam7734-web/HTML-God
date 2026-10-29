# Interview verification

Final interview: ../../interview.html. Built with HTML-Sensei, with the bundled HTML-Master fonts/artwork, motion and SFX engines, and actual Blender-exported geometry.

- 35 end-to-end checks passed for canonical briefs, source quoting, token/origin protection, duplicate submissions, output artifacts, standalone export, final validation, bilingual RTL, pause, context loss/recovery, narrow layouts, reduced motion, forced colours and browser script errors.
- HTML-Sensei's full page gate: 22 pass, 1 performance warning, 0 failures.
- Axe: zero automated violations in mobile, desktop and dark variants; manual-review items remain subject to human inspection.
- Keyboard focus order and visible rings pass. Chapter controls have at least 24 CSS px targets. Reflow at 320/640 px, text spacing, blocked storage and offline self-containment pass.
- Both canvas layers contain pixels and animate. Reduced motion stops their automatic movement. A Blender-rendered poster appears on context loss and real geometry returns on restoration.
- Performance warning: software WebGL recorded a 1,271 ms longest startup task, approximately 22 fps idle and scrolling, and 0.1526 cumulative layout shift. These are software-renderer observations, not target-device measurements. No effect was removed based on this machine.

The latest contact sheet was reviewed for legibility, content clipping, and whether visible labels directly support the interview. The outer logo rings, decorative caption/credits, promotional footer, divider below the logo and floor streak were removed at the owner's request. The final palette adds violet, cyan, coral and gold across the atmosphere, controls and choices.

Live model-generated build quality and installation in every Claude Code/Codex release are not certified by these tests. The local builder uses the signed-in CLI and its existing permissions; missing authentication, tools or required approvals are reported, not bypassed. Repeatable builder tests use a controlled runner that writes real output, while the browser tests use the delivered standalone file.

The root package validator and Router/hook regression suites are recorded in ../VALIDATION.md.
