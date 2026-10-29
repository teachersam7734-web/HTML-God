# Quality control: behaviour, pixels and preservation

## Build evidence in layers

1. **Source fidelity:** expected sections/outcomes are mapped, essential qualifications retained, original material available where required.
2. **Build integrity:** IDs, routes, asset names, option counts, schema, licences and protected hashes validated.
3. **Behaviour:** actual pointer/keyboard/touch actions, scoring, animation endpoints, import/export, media and reader operations exercised.
4. **Visual review:** final screenshots inspected at useful resolution, including varied content lengths and scene times.
5. **Environment:** offline file loading, reduced motion, missing WebGL, storage failure and target browser limitations tested where relevant.

These checks are complementary. Do not report a visual pass from a script that only counted DOM elements, or an interaction pass from a screenshot of the initial state.

## A proportional browser matrix

Use desktop wide, a narrow phone layout and tablet when the layout has a distinct breakpoint. Include actual touch emulation (`hasTouch`, mobile behaviour) rather than only reducing width. Keyboard test focus order, visible focus, Enter/Space activation, Escape dismissal and restoration of focus after dialogs/transitions. Mobile hover replacements must expose the same useful information.

Run the delivered `file://` artefact in strict mode (no `--allow-file-access-from-files`, which hides failures a double-clicked file would meet) with the browser context offline, and record external requests. `scripts/browser_smoke.cjs` does this; HTML-Sensei's gate (`html-sensei:sensei-verify`) adds axe, keyboard, forced colours, reflow, blocked storage and a contact sheet. A page that works only because a CDN asset is cached is not proven offline. Catch `pageerror` and console failures relevant to the product. Resource-load exceptions and WebGL warnings need interpretation, not automatic suppression.

Use real actionability checks. If a button click is intercepted, inspect layers, pointer events, active transforms and layout shifts. Do not use forced clicks as a way to get a passing test unless the test is deliberately about non-pointer behaviour.

## Motion tests

For each scenario test start, important intermediate states and exact end. Accelerated full playback can cover all routes; also check representative real-speed handoffs, transitions and pause/seek behaviour. Validate concrete outcomes: destination ID, completed hops, tool-effect count, retry duplicate count or exhausted budget.

Pause and compare both time and canvas pixels. Scrub forward/backward to detect accumulated state. Change scenario, restart, return to collection and reopen. Drag the camera, reset it, resize and inspect labels. Test completion without modulo wraparound. A blocked scenario must end in a named held state rather than silently sending a token to a success output.

Reduced motion should open a static, manually controllable scene. WebGL failure should retain a poster, stages, scenario switching, explanation and route access. Test the fallback deliberately by replacing renderer creation in an isolated QA context, not by claiming it exists because an exception handler was written.

## Visual acceptance

Capture full pages and focused crops: landing, dashboard, long lesson, flashcard front/back, quiz, results, reader with highlights, preferences, each scene at meaningful times, brain entrance and neural map. Review a contact sheet for coherence, then individual images for text and interaction details.

Look for clipped words, overflow, inaccessible small labels, hidden/black icons, mismatched palette remnants, overexposure from bloom, unreadable text on imagery, incorrect crops, overly similar cards, empty dead space, occluded human/robot faces and scene labels that detach from their objects. Native dimensions and actual alpha are stronger evidence than filename conventions.

[Playwright screenshot comparisons](https://playwright.dev/docs/test-snapshots) help detect regressions, but hardware, browser, font and animation differences affect pixels. Freeze or seek deterministic scenes for stable captures. Do not substitute a permissive image-diff threshold for looking at the image.

## Accessibility without empty claims

Use semantic controls and landmarks, explicit labels, sensible heading order, visible focus and text equivalents. Decorative graphics should be hidden from assistive technology; controls should not be canvas-only when a native button can provide equivalent access. Ensure colour is not the only signal. Check composited contrast, zoom and keyboard flow.

Honour `prefers-reduced-motion` plus an in-product motion preference. Automatically moving background content may need a pause/stop mechanism; a small disabled CSS animation list is insufficient if Canvas, WebGL and video continue. Avoid flashing effects that create health risks. Do not claim full WCAG conformance unless the scope and audit support it.

## Flashcard and quiz regression

Exercise every card with the actual answer text on desktop and mobile. Test front/back visibility, answer containment and both keyboard keys. For assessments choose a known pattern of right/wrong responses; assert score and exact missed-question list. Confirm no correctness feedback appears before completion. Test retake semantics without erasing unrelated study records.

## Performance checks

Record file size as information (there is no budget unless the user sets one), separately from first usable render, long tasks, image/media decode, model preparation and interaction responsiveness. Cap unnecessary pixel density, stop offscreen loops and release resources on route changes. A browser memory snapshot is useful if growth continues after repeated navigation; file-size reduction alone does not prove the leak is fixed.

Judge performance on the target device, not the development machine: do not downgrade or remove an effect because this machine struggles, and do not switch an effect off for a device class assumed to be weak. Numbers from a software-rendered or headless browser are relative, not target-device numbers; say which target devices were not tested. A lower-detail or static path is for a real failure (no WebGL, a lost context, reduced motion) and must stay useful instead of only showing an error. Test touch target stability while backgrounds move and page transitions run.

## Preservation and release

Compare the final protected edition/hash, core content arrays, embedded PDF and soundtrack against source. Rebuild before release. Re-run checks affected by any final edits; do not repeat unrelated exhaustive tests merely to fill a checklist. Keep reports with test date, browser, viewport, assertions, output hash and limitations. Label old failed reports as resolved history once the corresponding check passes, rather than leaving ambiguous FAIL files beside release results.

The AI Level-Up release recorded 74 cinematic checks, 33 neural navigation checks, 15 complete scenarios, 29 chapters, 63 lessons and 378 stage templates; earlier evidence covered 48 flashcards at two widths, the final quiz, 193 PDF pages/count and shared intro behaviour. These are **case-study results**, not automatic guarantees for code adapted elsewhere.

## Independent review

If authorised and available, give a reviewer a concrete artefact and bounded acceptance task without feeding the desired answer. Ask for actual evidence and file paths. Save findings periodically. If delegation fails, record that limitation and perform the feasible checks directly; do not claim independent QA. This project's later research/review dispatches failed for workspace-credit reasons, and the primary agent completed direct checks.

## Failure priorities

Fix blocked primary actions, content corruption, lost notes and wrong teaching/scoring first. Next fix unreadable content, touch/keyboard failures, broken fallback and severe performance. Then refine timing, material, spacing and visual consistency. A beautiful poster cannot compensate for a broken Enroll, flip, Read or Open animation action.
