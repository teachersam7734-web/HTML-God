# Exploring 3 to 6 directions, then building one

The method, in our own words. It was studied from Landingfolio's free `explore-landing-sections` skill (MIT, read on
its page, not downloaded; `site-landingfolio.md` in the HTML-Sensei build project's research notes (not shipped)) and the three-gate protocol of
gbro-collage-broll (MIT; `repo-gbro-collage-broll.md`). Nothing from Landingfolio's paid component library, nor any
SceneAI prompt or asset, is in this plugin or may be put into it.

## When to explore, when not

| Situation | Do |
|---|---|
| A new page, hero, deck or course with no fixed look | explore 3 to 6 directions on one comparison page |
| The user already named a look ("Swiss, black and red") | one direction, but still write the thesis and trade-off and show one preview |
| A brand system exists (tokens, logo, type) | explore structure and density only, inside the brand |
| A small change to a built page | no exploration; follow the existing direction note |
| A film or sting | explore as three treatments in text first (`sensei-motion-graphics`), then style frames |

## The steps

1. **Brand scan.** Look for brand material in the project (logo, colours, fonts, an existing template, a direction
   note). Use it; never explore over it.
2. **Scope to one section** (usually the hero, or the first screen of a course or deck) and read its real content:
   the real headline, the real proof, the real action. Placeholder text kills the exercise: every direction uses the
   same real copy.
3. **Ground in real examples, and look at them.** Pull 6 to 10 references whose content has the same shape (a
   three-tier pricing product needs three-tier references). Open each picture and look; never choose from a list of
   links. Sources: Kombai's gallery (370 heroes, licence of individual designs unverified, every entry read hotlinked
   fonts and media), Landingfolio's gallery and its free MCP server (20 component fetches a day on a free token, which
   is a secret: keep it out of chat and files), the owner's own projects, the styles catalogue. When no reference
   source is available, use [styles-catalogue.md](styles-catalogue.md) and the section patterns in
   `sensei-landing-hero`; say which path ran.
4. **Announce the theses before building (Gate 1).** In text only: 3 to 6 one-sentence theses, each different in
   structure, hierarchy, density or priority, never the same layout in different colours; each traced to 1 to 3
   references by the structure it borrows. Stop and let the user react. Partial approval moves only the approved
   theses forward.
5. **Build one comparison page (Gate 2)**, from [../examples/directions.html](../examples/directions.html): one
   standalone HTML file, vanilla CSS, nothing remote; each direction's CSS prefixed (`.va-`, `.vb-` ...) so none
   leaks; previews at desktop width with the real copy at the references' level of polish (a grey-box wireframe is a
   failure); per direction a thesis, a trade-off line (what it optimises, what it gives up) and a grounded-in list;
   then three short analysis blocks and a decision row ("if you want X, pick A"). Run
   `scripts/check-directions.mjs` and the gate, look at the full-page screenshot, then show it and stop.
6. **Build after the pick (Gate 3).** "Go with C", "B with A's proof row": record it in `.sensei/direction.md`, then
   build the chosen direction properly (tokens, real assets, motion, reduced motion) as the first slice of the
   production loop. Look at the slice with the user before the rest is built.

**Borrow structure, never identity.** A reference may lend an order, a hierarchy, a density or a grid. Its copy,
logo, product shots, illustrations and brand colours stay where they are. This is a licence rule as well as a taste
rule.

## Why gates

Changing a sentence at Gate 1 costs nothing; rebuilding one preview at Gate 2 costs minutes; rebuilding a finished
page or re-rendering a film costs hours or money (gbro's reasoning, and the reason paid generation in this plugin needs
a recorded approval: `html-sensei` section 3.5).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Directions look alike | the theses were not structurally distinct | rewrite the theses first; `check-directions.mjs` fails pairs under layout distance 0.2 |
| Previews look like wireframes | described instead of matched to the references' polish | build them at the level of the references, with real type and colour |
| A reference's brand leaked in | identity was borrowed with the structure | replace the copy, colours and pictures with the project's own |
| One direction's styles changed another | unprefixed classes | prefix everything; the checker fails it |
| The MCP returned 429 | the free daily limit | work with what you have; say so in the report |
| The user picked a mix | normal | record the mix in words; build it as a new direction, not two pasted together |
