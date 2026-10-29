# Visual styles catalogue

Two kinds of entry. **Token styles** (section 1) are surface languages for UI: a block of custom properties that the
shared component layer reads, each rendered in [../examples/styles.html](../examples/styles.html) and measured.
**Art directions** (section 5) are whole worlds (material, colour logic, type, motion, native moves) for heroes, films,
decks and games, described in our own words from the styles studied in the research; build them with the template in
[style-template.md](style-template.md).

Sources: `domain-visual-styles.md` in the HTML-Sensei build project's research notes (not shipped) (UI lane, measured), `repo-lemo-opuscar.md` (51 film styles,
MIT; studied, not copied), `repo-gbro-collage-broll.md` (paper collage, MIT), GOAT HTML `references/design.md` §8b
(the owner's named presets).

## 1. Token styles

The shared layer (every style is only a block that sets these):

```css
.card{background:var(--card-bg);color:var(--card-text,var(--text));border:var(--card-border,1px solid transparent);
  border-radius:var(--r);box-shadow:var(--card-shadow,none);backdrop-filter:var(--card-filter,none)}
.btn{background:var(--btn-bg);color:var(--btn-text);border:var(--btn-border,1px solid transparent);box-shadow:var(--btn-shadow,none);min-block-size:44px}
.field{background:var(--field-bg);color:var(--field-text,var(--card-text,var(--text)));border:var(--field-border,1px solid transparent);box-shadow:var(--field-shadow,none)}
```

The transparent default border is deliberate: forced colours remove every `box-shadow` and paint borders in a system
colour, so a shadow-shaped control keeps its edge. The field's text colour comes from the card, never from the ground
(section 2, row skeuomorphism).

| Style | Core tokens | Best for | Persian and RTL |
|---|---|---|---|
| Glass | fill `rgba(20,16,50,.38)`, border `1px rgba(255,255,255,.35)`, `backdrop-filter: blur(18px) saturate(160%)`, inset top highlight, over a colourful gradient ground | overlays, nav, hero cards over imagery | fine; ship the `@supports not (backdrop-filter)` solid fallback and the `prefers-reduced-transparency` solid override |
| Neumorphism (fixed) | ground and card `#e0e5ec`; shadows `9px 9px 16px #a3b1c6, -9px -9px 16px #fff`; inset pair for fields; **plus** a 1.5px `#5f6c80` border and a dark primary button | calm single-purpose widgets (timer, knob) | light direction is physical: do not mirror shadows in RTL |
| Claymorphism | radius 30px, three shadows (outer coloured, inset dark, inset light), pastel fills, a bordered field | playful onboarding, children, game menus | fine |
| Neo-brutalism | `3px solid #000`, hard `7px 7px 0 #000` shadow, flat saturated fills, heavy type, radius 0; press translates into the shadow | bold marketing, tools with attitude | press moves physically; fine in RTL |
| Bento | white tiles, 1px hairline, radius 22px, soft long shadow, grid spans | feature grids, dashboards | spans mirror automatically |
| Skeuomorphism | gradient fills, `inset 0 1px 0 #fff`, a bottom lip, drop shadow, inner shadow on fields, textured ground | instruments, games, nostalgia | serif stacks fall back for Persian: name a Persian face deliberately |
| Swiss | white, one red, one typeface, flush start, 6px top rule, hierarchy by size and weight only | documentation, editorial products, Persian-friendly clarity | flush start flips to the right with no extra code |
| Editorial | serif display, hairline rules, measure about 60 characters, a drop cap | long reading (courses, essays) | drop caps are a Latin convention: `p:lang(en)::first-letter` only |
| Retro CRT | `#031a0b` ground, phosphor `#7dff9b` with `text-shadow: 0 0 6px`, scanlines `repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px)`, vignette, 3% flicker at 0.25 Hz | game UI, terminals | put a Persian-capable face after the mono faces |
| Y2K | pastel gradient ground, chrome card with a hard 48/52% split, pill buttons, cyan gradient button | nostalgic campaigns | sample contrast across the split |
| Dark mode | `#121316` ground, `#1c1e23` card (elevation by lighter tint), desaturated accent `#8ab4ff`, text `#e7e9ee`, `color-scheme: dark` | everything | Persian on dark may want a little more weight (judgement, not measured) |

## 2. Measured contrast

`scripts/style-contrast.mjs` hides all text, photographs what is behind each text item and takes the worst ratio over
every pixel; boundaries compare the fill or border with the pixels just outside. Needed: 4.5 for body, labels and
placeholders, 3 for a large heading and for field and button boundaries (WCAG 1.4.11); the card row is information.
Run here (Windows 10, Chrome 155, system fonts), `?bad=1`; `!` marks a failure:

| Style | Body | Heading | Button label | Placeholder | Card | Field | Button |
|---|---|---|---|---|---|---|---|
| Glass | 5.05 | 4.28 | 15.79 | 10.41 | 7.35 | 8.30 | 15.93 |
| Neumorphism fixed | 7.53 | 9.47 | 11.99 | 5.62 | 4.86 | 3.35 | 10.29 |
| Claymorphism | 8.51 | 9.85 | 6.90 | 5.99 | 1.04 | 3.93 | 4.99 |
| Neo-brutalism | 13.64 | 13.64 | 7.21 | 9.74 | 18.97 | 21.00 | 18.97 |
| Skeuomorphism | 6.95 | 12.01 | 6.74 | 6.90 | 10.32 | 11.27 | 6.20 |
| Swiss | 18.88 | 18.88 | 5.62 | 6.66 | 18.88 | 4.54 | 5.62 |
| Editorial | 15.67 | 15.67 | 15.67 | 6.78 | 15.67 | 5.05 | 15.67 |
| Retro CRT | 13.48 | 13.48 | 10.73 | 9.11 | 9.52 | 9.31 | 9.73 |
| Y2K | 8.63 | 14.69 | 7.69 | 8.16 | 1.43 | 3.65 | 4.38 |
| Dark mode good | 8.48 | 13.73 | 8.64 | 5.84 | 1.39 | 3.84 | 8.89 |
| Bento | 8.88 | 17.93 | 17.93 | 7.01 | 1.16 | 3.17 | 15.87 |
| Neumorphism raw | 7.53 | 9.47 | 9.47 | 5.62 | 1.16 | **1.05!** | **1.11!** |
| Claymorphism, field without border | 8.51 | 9.85 | 6.90 | 5.99 | 1.04 | **1.46!** | 5.00 |
| Dark mode bad (grey text, saturated blue, pure black) | **3.72!** | 19.80 | **2.30!** | **2.53!** | 1.21 | **1.32!** | 4.67 |

The research run (with the lab's Vazirmatn font) gave the same failures within 0.1; the Swiss button is 5.62 here
because the red was darkened from `#e10600` to `#d10600`.

## 3. Accessibility traps per style

1. **Neumorphism fails non-text contrast by construction**: the edges are 1.05 to 1.16:1 against the ground; the
   shadow carries all the shape and none of it counts. Add a 3:1 border and a dark filled primary button.
2. **Forced colours remove every shadow.** With `border: 0`, glass, neumorphic, clay, Swiss and editorial buttons
   became bare text. A `1px solid transparent` border on every control fixes it (`scripts/style-shots.mjs` checks it).
3. **Glass legibility depends on what is behind it.** A 38% fill changes contrast with the ground: put a dark (or
   light) scrim in the fill, sample the lightest and darkest patches, keep the placeholder on the scrim, ship the two
   solid fallbacks. Chrome recognises `prefers-reduced-transparency` (`matchMedia` returns the query, not "not all").
4. **Blur cost** (`scripts/blur-cost.mjs`, software raster, relative only; run here): ground alone 60.7 fps, 1 panel
   60.7, 4 panels at 18px 36.3, 8 panels at 8px 41.0, at 18px 38.0, at 40px 25.7, one large animated
   `filter: blur(60px)` layer 20.7, with 8 panels 14.7. Backdrop blur over a moving ground costs per panel and per
   radius; a big animated blur layer is worst (the hero mesh in `sensei-landing-hero` uses soft radial gradients
   instead). Never remove glass for this machine: add a quality tier, keep the ground still behind glass when it
   need not move.
5. **Dark mode done badly** (pure black, grey text, saturated blue label on blue) fails body, label, placeholder and
   field. Pure white on pure black also halates for many readers. Elevation by lighter tint, not shadow.
6. **Hard-split gradients** (Y2K): text crossing the split needs a pixel sample, never one colour pair.
7. **Inset highlights** (skeuomorphism, clay) push the lightest pixel behind a label toward white: dark labels are
   safe, white labels are a risk (the first clay button failed in the research).
8. **CRT**: scanlines at 22% black reduce contrast slightly (the table includes them); never thin text in dim green;
   the flicker stays at 3% and 0.25 Hz, far below three flashes a second (WCAG 2.3.1), and stops under reduced motion.
9. **Neo-brutalism press**: hover moves 2px and active 5px into the shadow; respect reduced motion for the
   transition, keep the 44px target, and use the individual `translate` property so it composes with other transforms.
10. **Underline-only fields** (editorial, Swiss) are a judgement call under 1.4.11: the lab gives them a full hairline
    border with a heavier underline, a visible label and a 3px focus ring.
11. **Field text inherits the ground colour.** In the skeuomorphic cell the typed text was the ground's cream on the
    cream field (axe: serious colour-contrast). Colour field text from the card (`--field-text`), not from the ground.
12. **Persian**: drop caps only for Latin; a Persian-capable face after any monospace stack; no letter-spacing on
    Persian; uppercase transforms do nothing for it (`sensei-typography`).

## 4. Which style for which job

| Use case | Choose | Avoid |
|---|---|---|
| Landing hero | dark mode (good) plus glass cards over a mesh ground; Swiss for a serious tone | raw neumorphism |
| Interactive course | editorial or dark for reading (Ultra Bookworm's Ink), a futurist hard-edged skin for energy (Pulse) | glass behind long reading text |
| Presentation | Swiss or editorial, readable from the back of a room | glass, thin CRT text |
| Game | CRT, skeuomorphism, clay or brutalism by theme | neumorphism for controls that must be found fast |
| Dashboard | bento plus dark good, tabular numerals | glass over live charts |
| Film | any, but seekable (no timers) | blur-heavy grounds when rendering on CPU |

## 5. Art directions (worlds, not surfaces)

From the 51 film styles studied in lemo-opuscar, these carry over best to HTML pages and heroes. Each line is our own
summary of the idea; build the full spec with [style-template.md](style-template.md) and our own code.

| Direction | Essence | Material and colour | Type | Motion and native move | Pitfall |
|---|---|---|---|---|---|
| Dark tech keynote | a near-black stage where UI is the subject | three surface steps, hairline grid, one accent | one grotesque, numerals that roll | panels snap to a grid, light reveals a shape, glyph scramble on numbers | low-alpha hairline text fails contrast: keep body text solid on plates |
| Hologram HUD | a projected wireframe object locked on by instruments | cyan or teal light on dark, one warm exception colour | condensed technical sans, tiny labels never carry facts | scan growth, target lock, local explode, rolling digits | the 3-frame glitch and strobing stamps: keep under three flashes a second (`sensei-holograms`) |
| Glass product | a hero object shown through transparency and light | dispersion, caustics, a soft studio ground | quiet sans | light travelling inside the object, exploded view on a beat | needs WebGL for the real thing (`sensei-3d`); CSS glass is a different style |
| Swiss motion | the grid means something | white, black, one signal colour | one family, extreme scale contrast | elements snap on the beat, a knife-cut wipe | motion that ignores the grid reads as decoration |
| Risograph | each colour is one ink plate | two or three inks, overprint where they cross, slight misregistration | heavy grotesque or slab | plates arrive one by one; at most two plates per area | halftone over text: keep reading text on a flat plate |
| Halftone dossier | an archive file being assembled | cream paper, overprinted halftone, stamps, redaction bars | typewriter plus a condensed headline | stamps slam, papers slide in, redaction wipes | stamp flashes are a photosensitivity risk |
| ASCII terminal | everything is real characters on a grid | phosphor on near-black | monospace everything (plus a Persian-capable face) | font size is the camera; typewriter reveal | CRT flicker needs a reduce-effects option |
| Blueprint | drafting as reveal | cyanotype blue, white line work | mono labels, clean sans | lines draw on in drafting order, live annotations | thin white lines on blue at small sizes fail contrast |
| Data storytelling | the chart is the camera | paper ground, two pencil colours | serif notes, tabular numerals | marks drawn one by one, axes grow with the story | honesty: never stretch a colour ramp (`sensei-dataviz`) |
| Isometric infographic | a flat three-tone world explained in blocks | three tones per object, Isotype counts | geometric sans | cut-away, build-up | perspective tricks that distort quantities |
| Art Deco | gold keylines on lacquer black | gold, black, one jewel colour | high-contrast display caps | bulbs switch on, doors open as transitions | gold text on black at small sizes |
| Pixel RPG | a small low-resolution world with menus | limited palette, pixel-perfect scaling | pixel font for flavour, real text for content | text boxes, palette collapse | pixel fonts for body text fail readability |
| Paper collage (gbro) | one metaphor assembled from empty, piece by piece | a flat meaningful colour field, black and white halftone cut-outs, coloured card, cream keylines, soft physical shadow, paper grain | none inside the scene | stop-motion assembly (held poses at 8 to 12 fps): structure, subject, connectors, action, result | 3 to 6 pieces only; the final frame is the reduced-motion still |

The owner's named presets from GOAT HTML (Aurora Tech, Ember Library, Golden Dusk, Swiss Statement, Paper Editorial,
Terminal, Soft Pastel, Neo-Brutalist, Blueprint) are the same idea in one line each: palette, type, motion, texture.
Use them as starting vocabulary, never as a default (GOAT: "mix at most two; always re-derive from the subject").

**Paper collage in HTML** (the research gave the techniques, not run): ground with `feTurbulence` grain multiplied
over it; halftone by a dot `radial-gradient` multiplied over a greyscale image inside a high-contrast wrapper; pieces
with a cream outline and a soft shadow; assembly with `steps()` timing. Verify every one in Chrome before use; the
contrast wrapper trick in particular is unproven here.
