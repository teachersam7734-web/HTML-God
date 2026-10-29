---
name: sensei-direction
description: "Art direction before building: reads the brief into a design read and three dials (variance, motion, density), names the one memorable element, explores 3 to 6 structurally different directions on one offline comparison page, stops for the user's pick, and writes the direction note later agents follow. Holds the visual styles catalogue (glassmorphism, neumorphism, claymorphism, neo-brutalism, bento, Swiss, editorial, retro, Y2K, hologram HUD, risograph, halftone, paper collage and more) with measured contrast and each style's accessibility trap, plus the anti-slop gates. Use when someone says design direction, art direction, make it look premium, it looks generic, AI slop, give me options, mood, visual style, which style, look and feel, moodboard, or before any new page, hero, deck, course or film."
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-direction

Direction is decided before code and written down, so that tokens, components, motion and every agent serve one idea.
Doctrine first (`html-sensei`): the default is the most exciting design that serves the content; nothing is cut for
this machine; what was not verified is said.

## 1. When to use

At stage 2 of the production loop (`html-sensei` 3.3) for every new deliverable; when a built page "looks generic";
when the user asks for options or names a style; before a redesign. Skip the exploration (not the read) for a small
change that follows an existing `.sensei/direction.md`.

| The job is | Skill |
|---|---|
| Turning the chosen palette into tokens, themes, light and dark, the contrast gate | `sensei-tokens-theming` |
| Landing structures, hero patterns, backgrounds | `sensei-landing-hero` |
| Fonts, kinetic type, Persian and RTL type | `sensei-typography` |
| Components and libraries, licences of component sources | `sensei-ui-components` |
| Film treatment, storyboard, the G0 to G5 gates | `sensei-motion-graphics` |
| Shader or 3D backgrounds for a chosen direction | `sensei-shaders-vfx`, `sensei-3d` |
| Proving the built page (axe, keyboard, forced colours, contact sheet) | `sensei-verify` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Explore or not | 3 to 6 directions; one direction with thesis; none | no fixed look: explore; a named look: one; a brand system: explore structure only; a small change: none |
| How many directions | 3 (default), up to 6 | 3 when the brief is clear; more when the audience or tone is open. Never more than the user can compare in one sitting |
| Dials | variance, motion, density, 1 to 10 | the brief's words ([references/design-read.md](references/design-read.md)); silent brief: variance 8, motion 7 to 8, density 4 (`cinematic`) |
| Motion dial against the profile | `cinematic` 7 to 9, `lively` 5 to 6, `calm` 2 to 3 | the profile's `motion`; reduced motion is built in at every level |
| Token style for UI surfaces | the 11 in [references/styles-catalogue.md](references/styles-catalogue.md) | the use case table there; neumorphism only with the border fix; glass only with scrim and fallbacks |
| Art direction for a hero, deck or film | dark keynote, hologram HUD, Swiss motion, risograph, halftone, blueprint, paper collage... | the subject's world; at most two mixed; written as a style spec ([references/style-template.md](references/style-template.md)) |
| References | Kombai gallery, Landingfolio gallery or its MCP, the owner's projects, the catalogue | what has the same content shape; look at every one; borrow structure, never identity |
| Stop points | Gate 1 theses, Gate 2 comparison page, Gate 3 first built slice | always all three for a new deliverable; partial approval advances only what was approved |

## 3. Core technique

### 3.1 Read the brief, set the dials

Write the one-liner and the dials at the top of `.sensei/direction.md` (template in
[references/style-template.md](references/style-template.md)):

> Reading this as: **an offline reading course** for **adults who stalled on long books**, with a **calm but
> confident** language, leaning toward **warm paper or deep ink / one serif or one grotesque / lively motion**.
> Dials: variance 7, motion 6, density 4.

Then the brief facts (audience, primary action, density, brand invariants, supplied assets, devices, offline,
accessibility, exclusions, exact content), the **movement name and two-sentence philosophy**, and the **one memorable
element**. Ground everything in the subject's world; a silent axis is never spent on a default.

### 3.2 Explore 3 to 6 directions (full method: [references/explore-directions.md](references/explore-directions.md))

1. Brand scan; scope to one section (usually the hero); read its real copy.
2. Pull 6 to 10 references of the same content shape and look at each picture.
3. **Gate 1**: theses in text only. Each one sentence, each different in structure, hierarchy, density or priority
   ("never the same layout in different colours"), each traced to the structure it borrows. Stop.
4. **Gate 2**: one comparison page from [examples/directions.html](examples/directions.html). The marks the checker
   reads:

```html
<article class="direction" data-direction="B" data-prefix="vb-">
  <h2>B. Instrument panel</h2>
  <p data-part="thesis">...</p>  <p data-part="tradeoff">Optimises ...; gives up ...</p>
  <ul data-part="grounded"><li>Structure from ...</li></ul>
  <div class="preview"><section class="vb-hero">
    <h3 class="vb-title" data-role="headline">Same real headline</h3>
    <p data-role="lede">...</p> <a class="vb-cta" data-role="cta" href="#">...</a>
    <div data-role="media">...</div> <div data-role="proof">...</div>
  </section></div>
</article>
```

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-direction/scripts/check-directions.mjs directions.html     # count, parts, prefixes, same copy, distinct layouts, offline
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/sensei-gate.mjs directions.html
```

   `check-directions.mjs` measures where each preview's headline, lede, action, media and proof sit (the text's own
   extent, so a centred line in a full-width block counts as centred) and fails two directions closer than 0.2: the
   "same layout in different colours" failure. Look at the full-page screenshot, then show the page and stop.
5. **Gate 3**: after the pick ("go with C", "B with A's proof row"), record it in the direction note in the user's
   words, build the chosen direction properly as the first slice, show it, then produce.

**Borrow structure, never identity**: no reference's copy, logo, pictures or brand colours.

### 3.3 Choose and prove a visual style

Token styles share one component layer; a style only sets custom properties, so one markup takes any style and a
style can be measured in isolation:

```css
.card{background:var(--card-bg);color:var(--card-text,var(--text));border:var(--card-border,1px solid transparent);
  border-radius:var(--r);box-shadow:var(--card-shadow,none);backdrop-filter:var(--card-filter,none)}
.btn{background:var(--btn-bg);color:var(--btn-text);border:var(--btn-border,1px solid transparent);box-shadow:var(--btn-shadow,none);min-block-size:44px}
.field{background:var(--field-bg);color:var(--field-text,var(--card-text,var(--text)));border:var(--field-border,1px solid transparent)}
.glass{--card-bg:rgba(20,16,50,.38);--card-border:1px solid rgba(255,255,255,.35);--card-filter:blur(18px) saturate(160%)}
@supports not (backdrop-filter:blur(1px)){.glass{--card-bg:rgba(27,21,55,.92)}}
@media (prefers-reduced-transparency:reduce){.glass{--card-bg:#1b1537;--card-filter:none}}
.neu.fixed{--card-border:1.5px solid #5f6c80;--btn-border:1.5px solid #5f6c80;--field-border:1.5px solid #5f6c80;--btn-bg:#2d3748;--btn-text:#fff}
```

Three rules carry most of the accessibility: every control keeps a real border (transparent by default) so forced
colours keep its shape; contrast is sampled from pixels where the ground is a gradient, blur or image; field text takes
the card's colour, never the ground's. Prove a style on the project's own copy:

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-direction/scripts/style-contrast.mjs page.html[?query] [--cell .demo] [--json out.json]   # text 4.5, heading 3, boundaries 3
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-direction/scripts/style-shots.mjs page.html [--out DIR]   # normal, forced colours, RTL pictures; shapeless controls fail
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-direction/scripts/blur-cost.mjs                           # relative cost of glass panels and blur layers
```

For a whole world (dark keynote, hologram HUD, risograph, paper collage), write the style spec first: essence and what
it is not, materials, colour logic, type, motion, transitions, native moves, pitfalls, engine pointers, variation space
([references/style-template.md](references/style-template.md)).

### 3.4 Anti-slop gates (before the comparison page and again on the built page)

The generic tells, from GOAT HTML and HTML-Master: cream ground with a terracotta accent, near-black with acid green,
broadsheet hairlines, identical rounded cards with the same soft shadow and one radius for everything, an all-caps
eyebrow over every heading, meta strings joined by middle dots, an arrow appended to every link, ten scattered fades.
Legitimate for some briefs; slop when they appear regardless of subject.

- [ ] A designer would recognise the subject with the text hidden.
- [ ] Exactly one bold, memorable element; everything else quieter.
- [ ] Overlays (aurora, grain, scanlines) serve the scene; grain is felt, not seen.
- [ ] One orchestrated arrival, not scattered fades; nothing loops forever without purpose; reduced motion is a
      complete set of still states.
- [ ] Reading lines under 80 characters; a type scale with a job per family; the longest real heading tested.
- [ ] Copy in the user's voice ("Save changes", not "Submit"); errors say what happened and how to fix it.
- [ ] Colour roles, not colour names; composited contrast measured; controls checked in every state.
- [ ] Important pages look related (contact sheet of several pages, not only the hero).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Eleven token styles on one markup, LTR and Persian RTL, failing cells behind `?bad=1` | [examples/styles.html](examples/styles.html) | verified |
| Comparison page of three directions (frame, theses, trade-offs, grounded-in, analysis, decision row) | [examples/directions.html](examples/directions.html) | verified |
| Blur cost lab page | [examples/blurcost.html](examples/blurcost.html) | verified |
| Pixel-sampled contrast per style cell | [scripts/style-contrast.mjs](scripts/style-contrast.mjs) | verified |
| Normal, forced-colours and RTL pictures, shapeless-control check | [scripts/style-shots.mjs](scripts/style-shots.mjs) | verified |
| Relative blur cost | [scripts/blur-cost.mjs](scripts/blur-cost.mjs) | verified (software raster) |
| Comparison page checker (distinct layouts, prefixes, parts, copy, offline) | [scripts/check-directions.mjs](scripts/check-directions.mjs) | verified |
| Self-test of all of the above (13 assertions) | [scripts/test-direction.mjs](scripts/test-direction.mjs) | verified |
| Fixtures that must fail | [fixtures/same-layout.html](fixtures/same-layout.html), [fixtures/shadow-only.html](fixtures/shadow-only.html) | verified |
| Design read, dials, brief, page families, motion levels, where the owner's older skills differ | [references/design-read.md](references/design-read.md) | reference |
| The explore method, gates, reference sources, troubleshooting | [references/explore-directions.md](references/explore-directions.md) | reference |
| Styles catalogue: tokens, measured contrast, traps, use cases, art directions | [references/styles-catalogue.md](references/styles-catalogue.md) | reference |
| Direction note and style spec templates | [references/style-template.md](references/style-template.md) | reference |

The scripts find Playwright and Chrome through
`sensei-verify`'s discovery (`SENSEI_PW` or `PW`, `SENSEI_CHROME` or `CHROME`, then installs).

## 5. Quality bars

- `.sensei/direction.md` exists before the first deliverable file: the read, the dials, the movement, the memorable
  element, the brief facts.
- 3 to 6 directions, each with thesis, trade-off and grounded-in; same real copy; no pair under layout distance 0.2;
  nothing remote (`check-directions.mjs` passes); previews at the references' level of polish.
- The three gates were stopped at, and the pick is recorded in the user's words.
- The chosen style passes `style-contrast.mjs` on the real copy: text 4.5, large headings 3, field and button
  boundaries 3, sampled at the lightest and darkest patch; `style-shots.mjs` passes (every control keeps an edge in
  forced colours) and the RTL pictures are looked at when the project is RTL.
- Glass has a scrim, the `@supports` fallback and the reduced-transparency override; CRT flicker at most 3% and 0.25
  Hz, removed under reduced motion; neumorphism has the 3:1 border.
- The anti-slop list is ticked on the built page, not only on the plan.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Output looks generic | the read was skipped; silent axes spent on defaults | the one-liner and dials first; ground every axis in the subject | reported (GOAT HTML, the owner's three projects) |
| 2 | Three "directions" are one layout in three colours | theses not structurally distinct | distinct structure, hierarchy, density or priority; `check-directions.mjs` fails pairs under 0.2 | reported (Landingfolio method); checker tested here on a twin fixture (distance 0.00) |
| 3 | The checker called a centred poster and a left-aligned page "the same" | it measured element boxes; a centred line inside a full-width block has a full-width box | measure the text's own extent (a DOM Range) and compare centres | found and fixed while writing this skill (distance 0.14 became 0.40) |
| 4 | One direction's restyle changed another preview | shared class names on one page | prefix each direction's CSS; the checker fails unprefixed classes | reported; tested (fixture) |
| 5 | Previews look like wireframes and the user cannot judge | described the idea instead of matching the references' polish | real type, colour and copy at reference level | reported (Landingfolio) |
| 6 | A reference's brand leaked into the work | copied identity with structure | borrow structure only; replace copy, colours, pictures | reported; also a licence rule |
| 7 | Neumorphic controls are hard to find | edges 1.05 to 1.16:1 against the ground; shadow carries the shape | 1.5px border at 3:1 and a dark primary | tested (measured here and in the research) |
| 8 | Buttons become bare text in Windows High Contrast | forced colours remove box-shadow; `border: 0` leaves nothing | a transparent 1px border on every control | tested (`style-shots.mjs`, shadow-only fixture) |
| 9 | Glass text unreadable over some parts of the ground | a 38% fill: contrast follows the ground | a dark scrim in the fill; pixel-sample the lightest and darkest patch; solid fallbacks | tested (research: placeholder 4.24 before the fix) |
| 10 | Glass and blur pages stutter | backdrop blur costs per panel and per radius; a big animated `filter: blur` is worst | keep the effect; add a quality tier; still ground behind glass when it need not move; soft radial gradients instead of a blurred layer | measured here, software raster: 60.7 fps to 36.3 (4 panels) and 14.7 (blur layer plus 8 panels) |
| 11 | Typed text invisible in a field | the field took the ground's text colour (cream on cream) | colour field text from the card (`--field-text`) | found by axe while writing this skill (skeuomorphism) |
| 12 | Clay field edge invisible | fill-only field with an inset shadow | a 1.5px border; measured 1.46 before, 3.93 after (`#6f4f8f`) | tested here |
| 13 | Fill-only fields fail in Swiss, bento and dark designs | no border, fill too close to the ground | a 1px border at 3:1 (`#767676` on white is 4.5) | tested (research) |
| 14 | Dark mode looks cheap and fails | pure black, grey text, saturated blue label | lighter-tint elevation, desaturated accent, text near `#e7e9ee` | tested (body 3.72, label 2.30 measured) |
| 15 | A huge bar at the start of a Persian paragraph | drop cap applied to Persian's first letter | `p:lang(en)::first-letter` only | tested (research) |
| 16 | Persian looks broken in a terminal style | a monospace stack with no Persian face falls back to a fixed-pitch face | a Persian-capable face after the mono faces | tested (research) |
| 17 | Contrast check reports false failures on pill buttons | the sample rectangle included corners outside the curve | sample the central part of rounded controls | found in the research and kept in the script |
| 18 | Text over a hard-split gradient fails in part | one colour pair cannot judge a split | pixel-sample across the split | reported (research) |
| 19 | CRT or stamp effects risk seizures | flashes and strobing | flicker at most 3% at 0.25 Hz; never more than three flashes a second; reduce-effects option | reported (WCAG 2.3.1; research) |
| 20 | An older skill's size budget or "one heavy library" shaped the design | GOAT HTML and HTML-Master rules | no budget unless asked; HTML-Sensei takes priority ([references/design-read.md](references/design-read.md) section 5) | owner's rule |
| 21 | Generation money spent on a wrong idea | expensive step before cheap agreement | Gate 1 in text, Gate 2 on a preview, then build or generate | reported (gbro) |
| 22 | A reference MCP token appeared in chat or a file | the token is a secret | keep it in the user's configuration; `guard-secrets` blocks it in files | reported (Landingfolio) |

## 7. Licences

- **This skill's code and examples** (`styles.html`, `directions.html`, `blurcost.html`, every script and fixture) are
  HTML-Sensei's own, from the UI lane's `code-ui` lab; they ship in the plugin.
- **Studied, own words only**: lemo-opuscar (MIT) style spec structure and its style ideas; gbro-collage-broll (MIT)
  gates and the paper-collage style; Landingfolio's free `explore-landing-sections` skill (MIT) method; the owner's GOAT
  HTML and HTML-Master. Nothing copied verbatim.
- **Never shipped in the plugin, may be used in a user's project under its own terms**: Landingfolio's component
  library (licence forbids redistributing items or making templates from them; per-seat pass), SceneAI prompts and
  backgrounds (no redistribution, no AI training; an inline data URI is extractable, which its licence forbids without
  written permission: rebuild in code instead), Tailwind Plus, Aceternity Pro, react-bits components.
- **Reference only**: Kombai gallery heroes (licence of individual designs not verified; they hotlink fonts and media).
- In a project, every reference that lent structure is named in the direction note; anything actually used (font,
  image, component) gets a ledger row.

## 8. Verification

Run here (Windows 10, Node 24, installed Chrome 155 through playwright-core 1.64, axe-core 4.12 via `SENSEI_AXE`,
software GL):

- `scripts/test-direction.mjs`: 13 of 13 assertions pass in about 60 s: the lab passes contrast in LTR and RTL; with
  `?bad=1` it fails on exactly the seven measured rows; `style-shots.mjs` writes 33 pictures and passes the lab, fails
  the shadow-only fixture; `check-directions.mjs` passes the example (smallest layout distance 0.39) and fails the
  twin fixture on distinct (0.00), parts, prefix and copy.
- `sensei-verify`'s `sensei-gate.mjs`, strict `file://`: `directions.html` pass (20 pass), `styles.html` pass (21
  pass, after fixing the field-text trap axe found), `blurcost.html` warn (no focusable element: a measuring page).
  Contact sheets and the full-page picture of the directions page were looked at; the editorial RTL and glass
  forced-colours cells were looked at.
- `blur-cost.mjs` produced the numbers in trap 10 and the catalogue.

Not verified: Firefox and Safari (backdrop-filter, `::first-letter` floats in RTL, `prefers-reduced-transparency`);
real GPUs and phones (blur numbers are software-raster ratios); Windows High Contrast themes other than the emulated
one; contrast of text over video or blend modes; the layout-distance threshold across many real projects; the
paper-collage CSS techniques (described, not run); the Landingfolio and Kombai MCP servers (not called: they need an
account token); whether users pick better with 3 or with 6 directions.

## 9. Carried by

- Agent `sensei-art-director`: runs the read, the explore step and its gates, writes `.sensei/direction.md`, hands
  tokens to `sensei-tokens-theming`. Agent `sensei-reviewer` uses section 3.4 and section 5 as its design lens.
- Hooks: `lint-web.mjs` warns on `transition: all`, unguarded View Transitions and missing reduced motion in the
  comparison page and the built slice; `guard-licence.mjs` refuses never-ship sources in plugin paths;
  `guard-secrets.mjs` keeps reference-service tokens out of files; `gate-claim.mjs` asks for a fresh gate report
  before the comparison page or the slice is called done. Rules the research proposed that no hook enforces yet
  (shadow-only controls without a border, `backdrop-filter` without fallbacks, drop caps or mono-only stacks in
  Persian files) are covered by this skill's scripts instead.
