---
name: sensei-landing-hero
description: "Landing pages and hero sections as one offline HTML file: section anatomy (nav, hero, proof, features, how it works, pricing, FAQ, final call to action) with the copy rules that change the build, hero structures, five tested CSS hero backgrounds (mesh, aurora, spotlight, grid, noise), hand-offs to shader, 3D, hologram and video heroes, a split headline reveal, a marquee with a pause button, a scroll-revealed bento, a pricing toggle and a script-free FAQ, with themes and Persian built in and an audit across every theme and language. Use when someone says landing page, hero, hero section, above the fold, homepage, marketing or product page, launch or waitlist page, pricing, FAQ, logo wall, bento grid, call to action, make the hero pop, animated background, aurora, mesh gradient or spotlight effect."
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-landing-hero

A landing page says what it is, for whom and the next step within the first screen, proves it honestly, and carries
the visitor to one action. Doctrine first (`html-sensei`): the most exciting design that serves the content; nothing
cut for this machine; offline unless told otherwise; what was not verified is said.

## 1. When to use

Any landing page, homepage, launch or waitlist page, and the entrance screen of a course, deck or game; any hero
section; a page that "does not convert" or "looks flat".

| The job is | Skill |
|---|---|
| Directions, dials, style, the comparison page before building | `sensei-direction` (always first for a new page) |
| Tokens, themes, the theme switch, contrast gate | `sensei-tokens-theming` (this skill's example uses its designed switch) |
| Sign-up, waitlist or contact forms: validation, accessible errors, offline or hosted submit | `sensei-ui-components` ([forms recipe](../sensei-ui-components/references/forms.md), [example](../sensei-ui-components/examples/form.html)) |
| A living shader ground, raymarching, particles | `sensei-shaders-vfx` |
| A 3D or hologram hero | `sensei-3d`, `sensei-holograms` |
| Hero or background video, Lottie, Rive | `sensei-lottie-rive-video` |
| Fonts, splitting, kinetic type, Persian type | `sensei-typography` |
| Hover, press, entrance motion with Motion or GSAP | `sensei-motion-ui` |
| Pinning, scrollytelling, Lenis | `sensei-scroll` |
| Cursor and pointer effects beyond the spotlight | `sensei-pointer` |
| Components and libraries (shadcn, Magic UI, react-bits) | `sensei-ui-components` |
| One-file packaging of a page with media | `sensei-single-file` |

## 2. Decision table

| Choice | Options | What decides it |
|---|---|---|
| Structure | full anatomy; hero plus one section; a single screen | the offer: a product needs proof, pricing and FAQ; a waitlist needs a hero and a form (the form recipe, with what submit does in an offline file: `sensei-ui-components`, [references/forms.md](../sensei-ui-components/references/forms.md)); a course entrance needs a promise and a start |
| Hero layout | centred promise; split screen (copy and an instrument or product); oversized wordmark; full-bleed media with scrim; edge-cropped tiles | the direction chosen in `sensei-direction` and what the product can show (a product with a real interface earns the split screen) |
| Ground | grid (static, cheapest); mesh (soft, moving); aurora; spotlight (fine pointers); noise (texture, often under another); shader; 3D; video | the direction's one memorable element: spend it here or keep the ground quiet; the motion dial |
| Headline motion | word reveal; none; per-letter only for one short word | word reveal for the promise (safe for Persian); never per-letter scramble on the main promise |
| Proof | numbers with units and sources; named quotes; logos in one colour | what is real; leave the slot out rather than invent |
| Feature layout | bento (sizes carry meaning); three columns; alternating rows | how many items and whether one outcome dominates |
| Motion library | CSS only; Motion (MIT); GSAP | CSS for everything here; a library only for springs, sequences or pinning (`sensei-motion-ui`, `sensei-scroll`) |
| Themes and languages | one; light and dark; skins; Persian | the brief and the profile; built in from the start, never added |

## 3. Core technique

### 3.1 Build from the tested page

Start from [examples/landing.html](examples/landing.html): one file, no build, no network; nav, hero with five
grounds, marquee, bento, pricing, FAQ, final call to action; three themes and English or Persian over one markup with
logical properties only. Replace the copy, tokens and ground with the project's own (from `.sensei/direction.md`).
The anatomy, copy rules and section recipes: [references/anatomy-and-copy.md](references/anatomy-and-copy.md).

### 3.2 The hero in one block

```html
<section class="hero" id="top">
  <div class="bg" aria-hidden="true"><!-- one ground layer --></div>
  <div class="wrap">
    <p class="eyebrow">Launch pages that convert</p>
    <h1 id="h1">Ship the page your product <em>deserves</em></h1>
    <p class="lede">One sentence of support.</p>
    <div class="cta"><a class="btn primary" href="#pricing">Start free</a><a class="btn" href="#features">See how it works</a></div>
    <div class="proof"><span>4.8 of 5 from 2,100 teams</span><span>No card needed</span></div>
  </div>
</section>
```

```css
.hero{position:relative;isolation:isolate;overflow:clip;padding-block:clamp(4rem,2rem + 9vw,9rem) clamp(3rem,2rem + 6vw,7rem)}
.hero .bg{position:absolute;inset:0;z-index:-1;pointer-events:none}
.hero h1{font-size:clamp(2.25rem,1.1rem + 4.6vw,5rem);max-inline-size:18ch;margin-inline:auto;text-wrap:balance}
:lang(fa) .hero h1{letter-spacing:0;line-height:1.45;max-inline-size:20ch}
/* the mesh ground: soft radial blobs, transform only, no blur filter */
.mesh i{position:absolute;inline-size:70vmax;block-size:70vmax;border-radius:50%}
.mesh i:nth-child(1){inset-block-start:-30vmax;inset-inline-start:-20vmax;background:radial-gradient(circle,var(--glow-a),transparent 62%);animation:drift1 22s ease-in-out infinite alternate}
@keyframes drift1{to{transform:translate3d(18vmax,10vmax,0) scale(1.15)}}
```

Padding, not `100vh`, sizes the hero (no jump when a phone's address bar moves); the `h1` clamp has a rem term so zoom
still grows it; body text is never fluid. The five grounds, their traps and the hand-offs to shader, 3D, hologram and
video heroes: [references/backgrounds-and-heroes.md](references/backgrounds-and-heroes.md).

### 3.3 Headline reveal, emphasis, and the hover that works

Split the headline by words (`splitkit.js` from `sensei-typography`, inlined in the example), stagger with `--i`, and
put the gradient on each split word, because `background-clip: text` on the parent does not paint through split
inline-block children. Hover lifts use the individual `translate` property inside
`@media (hover:hover) and (pointer:fine)`: an element that also has a scroll-driven reveal has its `transform` owned by
the animation, so a `transform` hover never applies (measured on the original lab: 0 px movement; fixed: 4 px).

### 3.4 Controls that say what they are

Every control's accessible name contains its visible text (WCAG 2.5.3: voice-control users say what they see). The
lab's theme and language chips had `aria-label="Theme"` and `"Language"` over visible "ink" and "FA"; lane D5's axe
run flagged `label-content-name-mismatch`. Fixed: no `aria-label`; the theme chip reads "Theme: Ink", the language chip
names the language it switches to in that language ("فارسی" with `lang="fa"`, then "English"). Moving things over five
seconds get a visible pause button with `aria-pressed`.

The theme chip uses `sensei-tokens-theming`'s designed switch, unchanged in behaviour: a View Transition opens the new
theme as a circle from the pressed button (720 ms), Calm and `prefers-reduced-motion` get a 220 ms crossfade, a second
press finishes the first and moves one more step (the target counts from the last press, not from `data-theme`, which
has not changed yet), and a Calm chip (`aria-pressed`) stops every moving part as reduced motion does. Both read the
same storage keys (`lab-theme`, `lab-calm`) before first paint, so the landing and the tokens recipe compose. Persian
text is set in the shipped Vazirmatn subset (`sensei-typography/assets/`), embedded as a data URI and applied with
`:lang(fa)`; its coverage of every Persian string on the page was checked with `font-coverage.py`.

### 3.5 Prove it in every theme and language

```
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-landing-hero/scripts/audit.mjs page.html --variants "theme=ink,theme=paper,theme=ink&lang=fa,theme=paper&lang=fa"
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/verify.mjs page.html --routes "?bg=aurora,?lang=fa,click:#bTheme,click:#bCalm"
node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-direction/scripts/blur-cost.mjs page.html bg=mesh bg=aurora bg=spotlight
```

`audit.mjs` runs the cheap checks per query (the gate takes a file and sees one variant): console, network, overflow
at 360 to 1920 px, solid-ground contrast, targets, alt, lang. The gate adds axe, keyboard and focus rings, reflow,
forced colours, reduced motion and the contact sheet. Text over gradients and media is skipped by the audit: look at
it and pixel-sample it.

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Whole landing page: five grounds, reveal, marquee with pause, bento, pricing, FAQ, three themes with the designed switch and Calm, Persian in the embedded Vazirmatn | [examples/landing.html](examples/landing.html) | verified |
| Its form, when the page has one | [../sensei-ui-components/examples/form.html](../sensei-ui-components/examples/form.html) | verified there |
| Audit per theme and language | [scripts/audit.mjs](scripts/audit.mjs) | verified |
| Self-test (22 assertions, including the name-mismatch fix proved with axe) | [scripts/test-landing.mjs](scripts/test-landing.mjs) | verified |
| Fixture that must fail (remote font, contrast, overflow, small target, no alt, no lang, mismatched names) | [fixtures/bad-hero.html](fixtures/bad-hero.html) | verified |
| Relative cost of grounds | `sensei-direction`'s `scripts/blur-cost.mjs` with `bg=` queries | verified (software raster) |
| Anatomy, copy rules, section recipes, use cases | [references/anatomy-and-copy.md](references/anatomy-and-copy.md) | reference |
| Grounds, hero structures, hand-offs, paid-library categories rebuilt in code | [references/backgrounds-and-heroes.md](references/backgrounds-and-heroes.md) | reference (Kombai structures described, not run) |

## 5. Quality bars

- First screen at 360 by 640 shows the promise, the primary action and the proof line.
- One `h1`; the hero and final buttons share a verb; proof is real, with units and sources.
- `audit.mjs` passes every theme and language the page offers; the gate passes in strict `file://` with zero failures
  and every warning fixed or explained; the contact sheet and the Persian screenshot were looked at.
- No network request; fonts embedded; nothing from a never-ship source.
- Reduced motion: zero running animations and every word, tile and price visible; print shows every tile; forced
  colours keep every control's edge.
- Grounds animate `transform` or `opacity` only, sit in the `.bg` layer, and pause or stop when not visible if they
  run a loop (shader, 3D, video skills).
- Every control's name contains its visible text; targets at least 24 CSS px (44 for primary actions); anything that
  moves for more than five seconds has a pause button.

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Voice control cannot press the theme or language button | `aria-label` ("Theme") does not contain the visible text ("ink") | let the visible text be the name; name a language in itself | reported by lane D5's axe run; fixed here and proved with axe's `label-content-name-mismatch` rule |
| 2 | The gate's axe passed the page with that bug | the rule is outside the gate's default tag set in axe 4.12 | run the rule explicitly (`test-landing.mjs` does); look for it on any icon or abbreviation button | tested here |
| 3 | Emphasised words vanish after splitting | `background-clip: text` on the parent does not paint through split inline-block words | the gradient on each split word; `em:has(.sk-w){background:none}` | tested (research and here) |
| 4 | The space before the emphasised word disappears | splitting the text node drops it | reinsert a text node `" "` | tested (research) |
| 5 | Tile hover does nothing | the scroll-driven reveal owns `transform` (fill both) | `translate` for the hover | measured here: 0 px before, 4 px after |
| 6 | Cards stay lifted after a tap on a phone | `:hover` sticks on touch | hover motion only under `(hover:hover) and (pointer:fine)`; `:active` feedback for everyone | reported (SENSEI-LOG) |
| 7 | Tiles invisible in screenshots, print and old engines | scroll-driven reveal never ran | `@supports (animation-timeline: view())`, a print reset, scroll before capture | tested |
| 8 | A pinched star in the middle of the aurora | the conic apex is visible | apex at the rotation centre, covered by a static disc of the page colour | found by looking (research) |
| 9 | The marquee jumps once a cycle | a flex `gap` between the two lists makes `-50%` wrong by half a gap | trailing padding on each list | tested (research: 927.25 px track, 463.625 px list) |
| 10 | The marquee cannot be stopped by keyboard or touch users | hover-only pause | a visible pause button with `aria-pressed` (WCAG 2.2.2) | tested here |
| 11 | Persian marquee runs backwards or orders items wrong | `translateX(-50%)` under `rtl` | container `direction: ltr`, `dir="rtl"` on the lists | tested (research) |
| 12 | The pricing radios fail target size and show no focus | 13 px inputs hidden with `opacity: 0` and `pointer-events: none` | the input covers its whole label; the ring on the label via `:has(input:focus-visible)` | found by the gate here |
| 13 | Horizontal scroll at 320 px | nav action plus two chips wider than a phone | the bar wraps under 420 px | found by the gate here |
| 14 | The hero jumps on phones | `100vh` with a moving address bar | padding-sized hero, or `svh` | reported (research) |
| 15 | The headline does not grow with zoom | a pure `vw` size | a rem term in the clamp; body text in rem | measured (`sensei-typography`) |
| 16 | Persian headline cramped or broken | Latin tracking and leading | `:lang(fa)`: no letter-spacing, taller leading, no uppercase | tested (research) |
| 17 | The page fails offline | Google Fonts or CDN links, remote media (every Kombai hero read did this) | embed fonts and media; `lint-web` and the gate flag remote requests | reported (Kombai), tested (audit fixture) |
| 18 | A blurred nav over a moving hero costs frames | `backdrop-filter` repaints with the ground | keep it; a still ground under glass where possible; quality tier on weak targets | measured (`sensei-direction` blur cost) |
| 19 | Text over a video or image ground unreadable in places | one colour pair cannot judge moving media | scrim; sample the busiest frame | reported (Kombai, research) |
| 20 | A noise ground costs a full filter every paint | `filter: url(#noise)` on a full-viewport element | a small `feTurbulence` tile as a background image | reported (research, not measured) |
| 21 | Invented logos, ratings or lifts shipped | placeholder proof left in | real proof or none; the example's header says its proof is fictional | owner's rule |
| 22 | Vanilla Motion animates under reduced motion | it does not read the preference by itself (a 1 s animation took 1020 ms with reduced motion forced) | gate it yourself (`sensei-motion-ui`) | tested (research, motion.dev) |
| 23 | Two quick presses of the theme switch move one step | the second press read `data-theme`, which the first transition had not changed yet; and a pointer press during a transition lands on the transition overlay, not the button | count the target from the last press; test the double press from the keyboard | found and fixed while composing the tokens switch into this example |

## 7. Licences

- **This skill's code** (`landing.html` with the inlined `splitkit.js`, `audit.mjs`, `test-landing.mjs`, fixtures) is
  HTML-Sensei's own, from the UI lane's `code-ui` lab.
- **Never shipped in the plugin**: Landingfolio components (licence forbids redistributing items or making templates),
  SceneAI backgrounds and prompts (no redistribution, no AI training, no extractable embedding: rebuild the category in
  code), Tailwind Plus, Aceternity Pro, react-bits components (fetch-and-port into a project only:
  `sensei-ui-components`).
- **Reference only**: Kombai gallery heroes (licence of individual designs not found; remote assets); Wedoflow
  templates (Webflow-locked, licence terms not read); Modulify (a hosted builder; no code export documented).
- **May be vendored into a project with its notice and a ledger row**: Motion (MIT; the shipped UMD has no banner, add
  one; pin the version), GSAP (free licence, keep headers), Open Props and Pico (MIT).
- Placeholder proof in the example is fictional and labelled; a project ships real proof.
- **Shipped third-party file inside the example**: the Vazirmatn subset (SIL Open Font License 1.1, Copyright 2015 The
  Vazirmatn Project Authors), embedded as a data URI with its notice in the header; the licence text is
  `sensei-typography/assets/OFL-Vazirmatn.txt` and the plugin's `LICENSES/` index. A project that embeds it keeps the
  notice and adds a ledger row (`use: vendored`).

## 8. Verification

Run here (Windows 10, Node 24, Chrome 156 through playwright-core 1.64.1, axe-core 4.14.0, software GL, strict
`file://`):

- `scripts/test-landing.mjs`: 30 of 30 pass (the designed switch: reveal mode with the circle on the new snapshot,
  cleanup, storage and announcement, two quick presses, Calm with a crossfade and nothing running, the switch under
  Calm, both surviving a reload; Persian in the embedded Vazirmatn, English on the system stack), including axe's name-mismatch rule flagging `#bTheme` and `#bLang` in the
  fixture (the original lab markup) and passing the fixed page in English and Persian; the hover lift moving 4 px with
  the reveal running; print showing every tile; reduced motion with no running animation.
- `scripts/audit.mjs` on `examples/landing.html`: ink, pulse and paper in English and Persian all pass (64 or 65 text
  items checked each, 6 skipped over gradients); on the fixture: fails on network, contrast, overflow, targets, alt
  and lang.
- `sensei-verify`'s umbrella on `examples/landing.html` with the four routes of section 3.5: PASS, 25 pass, 0 warn, 0
  fail (2026-10-28, after the switch and the font); the Persian route screenshot was looked at (Vazirmatn set). Earlier
  run: pass (21 checks; 24 with three routes), after fixing the two issues it found (pricing
  radios, 320 px overflow); the contact sheet, the aurora screenshot in the paper theme and the Persian screenshot in
  the pulse theme were looked at.
- `blur-cost.mjs` with the five grounds: 60.3 to 61.0 fps each, software raster, pointer still.
- The original lab page's hover was measured at 0 px movement (the bug in trap 5).

Not verified: Firefox and Safari (`:has()`, `animation-timeline`, `details name`, `color-mix`, `text-wrap`); phones,
touch and real GPUs; screen reader speech of the toggle, the accordion and the switches; the contrast of the six
gradient-text and gradient-ground items (looked at, not measured); the Kombai hero structures (described from their
HTML, not rebuilt here); the conversion figures (third-party summaries); a video hero inside this page
(`sensei-lottie-rive-video` owns and tests it).

## 9. Carried by

- Agent `sensei-art-director` chooses the structure and ground with `sensei-direction`; builders assemble from the
  example; `sensei-interaction-engineer` adds motion, scroll and pointer layers; `sensei-reviewer` runs the audit and
  the gate and checks the quality bars; `sensei-packager` packs a page with media.
- Hooks: `lint-web.mjs` warns on remote references when offline, `transition: all`, smooth scroll on `html`, unguarded
  scroll-driven animation, `cursor: none` without a hover query, missing reduced-motion paths and vendored code without
  a notice; `guard-licence.mjs` refuses never-ship sources in plugin paths; `gate-claim.mjs` needs a fresh passing
  gate before "done". Not enforced by any hook yet (covered by `audit.mjs` and `test-landing.mjs`): accessible names
  that do not contain the visible text, `background-clip: text` over split words, `transform` hovers on elements with a
  scroll-driven reveal.
