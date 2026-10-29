# Accessibility testing: what the gate proves, and what it cannot

Source: `domain-accessibility-testing.md` in the HTML-Sensei build project's research notes (not shipped), plus the field log (the build project's field log (SENSEI-LOG, not shipped)). Building
accessible pages is taught by the domain skills (reduced-motion paths, contrast tokens, forced-colours borders); this
file is about proving it in a browser and being honest about the rest.

## Tools

| Tool | For | Licence | Here |
|---|---|---|---|
| axe-core | rule engine, WCAG A to 2.2 AA and best practice | MPL-2.0 | injected from a local `axe.min.js` (about 540 KB) with `page.evaluate`; never from a CDN; keep its licence header if vendored |
| `@axe-core/playwright` | wrapper | MPL-2.0 | not needed: injecting the file avoids a dependency |
| Playwright emulation | `reducedMotion`, `forcedColors`, `colorScheme`, viewport | Apache-2.0 (playwright-core) | native |
| `locator.ariaSnapshot()` | the accessibility tree as YAML | | written as `*-aria-tree.yml` |
| Lighthouse accessibility | a subset of axe with a score | Apache-2.0 | not needed; the gate's axe run covers the same rules with more control |
| NVDA, VoiceOver, TalkBack, JAWS | real speech | | cannot be automated here: the manual list below |

## The checks

**axe, three runs.** Mobile width (375), desktop, and dark scheme, each with reduced motion on (so animation does not
change contrast mid-run) and after a scroll pass (so lazily revealed content exists). `incomplete` is the manual review
queue (text over images and gradients, pseudo-elements, `backdrop-filter` surfaces), never a pass.

```js
await page.evaluate(src => (0, eval)(src), fs.readFileSync(axePath, 'utf8'));   // fallback: page.addScriptTag({ content })
const r = await page.evaluate(() => axe.run(document, {
  runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] },
  resultTypes: ['violations','incomplete'] }));
```

| Page | What axe found |
|---|---|
| A finished landing page that had passed its own lane's audit | 1 serious violation on all three runs: `label-content-name-mismatch` on two buttons whose visible text ("ink", "FA") was not part of the accessible name |
| The bad fixture | 6 violations, 5 serious or critical: `button-name`, `color-contrast`, `document-title`, `html-has-lang`, `image-alt`, `region` |
| The no-ring fixture (focus ring removed) | 0 violations: axe cannot see focus visibility |

**Keyboard.** Tab up to 80 times; per stop: tag, id, name, position, visibility, `:focus-visible`. Reports traps (the
same element twice running), focus on invisible elements, stops without a name, `tabindex` above zero, backward jumps
over 200 px (more than two), whether focus cycles, whether a skip link is first.

**Focus ring by pixels.** Up to 25 stops: scroll into view, press Shift (keyboard modality), focus, screenshot with an
8 px margin, blur, screenshot, compare. Under 0.2 per cent changed pixels means "no visible focus change". On a page
with `:focus{outline:none}` all 3 of 3 stops were flagged while axe reported nothing; on the landing page 1 of 18 (a
13 px native checkbox whose ring is small).

**Pointer-only controls.** `cursor: pointer` elements that are neither focusable nor inside a focusable ancestor (found
the planted `div onclick`). Controls without any name. Targets under 24 CSS px.

**Forced colours.** Chrome's emulation with the default system palette; any button, input, select or button-like link
with neither a 1 px border nor an outline has lost its shape. Fix: `border: 1px solid transparent` on every control
shaped by shadow or background.

**Reduced motion.** A second context with `reducedMotion: 'reduce'`: infinite animations, playing videos, pixels
changed in 700 ms. If the normal run is also static, the result says "inconclusive" rather than pass. Reduced motion
means no continuous, large or parallax motion; essential state changes remain.

**Reflow and spacing.** 320 CSS px wide (WCAG 1.4.10, which equals 400 per cent zoom on a 1280 px screen) and 640 px
(200 per cent), `scrollWidth` against `clientWidth`, offenders listed (scroll containers excluded). Then the WCAG
1.4.12 overrides (line height 1.5, letter spacing 0.12 em, word spacing 0.16 em, paragraph spacing 2 em) and a count of
elements that start clipping text.

**Blocked storage.** Storage getters throw `SecurityError` before the page runs (Safari private mode, sandboxed
iframes, some privacy settings). A page that reads storage inside `try` passes; one that reads it unguarded shows the
real message.

**Behaviour the Tab walk cannot see** needs a steps file: a custom widget that ignores arrow keys, Escape that does not
close a dialog, focus not returned after closing, a modal that lets focus escape, Shift+Tab order, roving tabindex.
`../examples/dialog.steps.json` is the pattern.

## Quality bars

1. axe: zero serious or critical violations on mobile, desktop and dark; every `incomplete` item looked at or listed
   as not reviewed.
2. Every focusable element shows a visible change on focus and has a name; on multi-section pages the first Tab stop
   is a skip link.
3. No keyboard trap; every pointer feature has a keyboard route; dialogs close on Escape and return focus (a step).
4. Reduced-motion run: no infinite animation, no autoplaying video, parallax and smooth scroll off.
5. Forced colours: every control keeps a border or outline.
6. No horizontal scroll at 320 px; no clipped text under the spacing overrides.
7. Targets at least 24 CSS px (44 px for primary touch controls).
8. Text contrast 4.5:1 (3:1 large), non-text 3:1; image and gradient backgrounds reviewed by eye.

## Traps

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Accessibility reported clean, keyboard users cannot see where they are | axe does not test focus visibility | the focus pixel test; never report accessibility from axe alone | tested (no-ring fixture) |
| 2 | "Accessible" claimed from a green axe run | automated rules cover roughly a third of WCAG issues (Deque's own figure; the share is contested) | write "no automatically detectable violations" | reported |
| 3 | Contrast "passed" on a hero image | it was in `incomplete`, not checked | review every `incomplete` item by eye | reported |
| 4 | Voice-control users cannot activate a button by what it says | visible text ("ink", "FA") not contained in a longer `aria-label` | put the visible words at the start of the accessible name | tested (landing page) |
| 5 | Screen reader ignores a label | `aria-label` on a `div` or `span` without a role | give it a role, or use a real element | reported |
| 6 | Forced-colours pass, real Windows theme breaks | one emulated palette; `forced-color-adjust: none` regions, SVG and canvas are not forced at all | test a real high-contrast theme by hand | reported |
| 7 | Reduced-motion CSS present, page still animates | GSAP, Lenis and three.js loops do not read the media query | a branch per animation system (the lint-web hook checks for it) | reported |
| 8 | Focus results differ from a headed browser | headless window focus and `:focus-visible` heuristics | the gate sets keyboard modality (Shift) before each focus | reported |
| 9 | A focus ring flagged that is really there, or one missed | the pixel test misses slight colour-only rings and can flag tiny native controls | treat a flag as "look at it"; the stop list and contact sheet are in the report | tested (13 px checkbox) |
| 10 | Arrow-key widgets pass the keyboard check and still fail users | the Tab walk tests forward order only | a steps file per widget | reported |
| 11 | Reflow pass, real zoom fails | the narrow viewport does not change `devicePixelRatio`, `resolution` media queries or the minimum font size; fluid type measured growing 1.0 to 1.9 times against a needed 2.0 | keep body text in `rem`; test text-only zoom by hand | reported |
| 12 | Content invisible to axe and to full-page screenshots | scroll-triggered reveals keep it at opacity 0 | the gate scrolls through the page first | tested |
| 13 | "Screen-reader tested" in a report | no portable way to automate speech here | never write it; hand the manual list over | reported |
| 14 | Six invisible focus stops before the page | a bar slid off screen with `translateY(-100%)` stays in the Tab order and the tree | toggle `inert` with the show class, and `visibility: hidden` after the slide | tested (field log, course UI) |
| 15 | Focus falls to `<body>` after a view change or an answer | the pressed button now lives in a `display: none` screen, or was set `disabled` | focus the new view's heading; use `aria-disabled` instead of `disabled` | tested (field log) |
| 16 | The answer is read before the card is flipped | a back face hidden only by `rotateY` is still in the tree | `inert` plus `aria-hidden` until turned | tested (field log) |
| 17 | Every later step in a test fails quietly | a scripted click opened a `<dialog>` and never closed it, making the rest of the page inert | close dialogs between steps, or start a fresh page | tested (field log) |
| 18 | A dialog test passes Escape on one page and fails on another | `showModal()` closes on Escape and returns focus to the opener by itself; `show()` (non-modal) does not close on Escape | use `showModal()` for modal UI and prove it with a step | tested here (`../examples/dialog.html`, Chrome) |

## What automation cannot check (printed in every report as not verified)

- What a screen reader speaks (NVDA with Firefox and Chrome, VoiceOver with Safari, TalkBack, JAWS): reading order,
  live-region timing, verbosity, tables, form mode.
- Meaning: alt text quality, link text out of context, a heading outline that makes sense, helpful errors, plain
  language.
- Colour-vision deficiency, contrast over photographs, video and gradients.
- Flashing (three flashes in any second), vestibular comfort of parallax and zoom, loudness, captions and transcripts.
- Cognitive load, timeouts, consistent navigation.
- Real assistive technology on real devices, switch access, voice control (name mismatch is the only hint).
- Firefox and Safari behaviour (the gate drives Chromium).

## The ten-minute manual checklist to hand the user

Tab through with the keyboard only; zoom the browser to 200 and 400 per cent; turn on the OS reduce-motion setting;
turn on high contrast; use a screen reader on the first screen and on one form or dialog; turn off images; read the
page aloud.
