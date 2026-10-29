# Deck engines, builds and export

Sources: `domain-presentations.md` in the HTML-Sensei build project's research notes (not shipped) (licences read from the installed packages and the GitHub API
on 2026-10-19), and this skill's tests run on 2026-10-25 with reveal.js 6.0.2 and @marp-team/marp-cli 4.5.1 from npm.
"Single file" means the finished deck is one offline HTML file that makes no request at run time.

## The engines

| Engine | For | Licence | Single file | Status here |
|---|---|---|---|---|
| Own core (`examples/deck.html`) | a deck that is itself a designed experience: branded, animated by hand, no library behaviour to surprise anyone | HTML-Sensei's own | yes, about 14 KB with its comments | verified, 33 checks |
| reveal.js | the default rich deck: fragments, vertical stacks, auto-animate, Markdown, speaker view, overview, print-pdf, plugins (notes, highlight, math, search, zoom) | MIT (slides.com, the hosted editor, is a separate commercial product) | yes, through `build-reveal.mjs` | verified, 16 checks |
| Marp (`@marp-team/marp-cli`) | Markdown source, PDF or PPTX the main output | MIT | yes: the CLI writes a self-contained bundle (110 KB for three slides in research) | HTML bundle verified, 7 checks; PDF and PPTX export not run |
| impress.js | one spatial "camera" showpiece | MIT | yes (161 KB) | verified in research; no fragments, notes or print of its own; never the base |
| bespoke.js | a tiny core (1.7 KB) and plugins | MIT | yes | verified in research; unmaintained since 2020 |
| Slidev | developer talks, Markdown with Vue, live code | MIT | no: a Vite app; `slidev build` gives a folder | not run |
| Spectacle | React decks | MIT | no without a bundler | not run; only in a React project |
| remark, WebSlides | older Markdown and HTML slide kits | MIT | yes | reference only; no modern print or accessibility story |
| PptxGenJS, python-pptx, pdf-lib | a real `.pptx` or merged PDFs when a client insists | MIT | not a deck | not run |
| Gamma, Canva, Figma Slides, Adobe Express | hosted visual authoring | proprietary | no | the "not HTML" alternative only |

## reveal.js in one file (`scripts/build-reveal.mjs`)

```
npm i -D reveal.js
node build-reveal.mjs slides.html -o deck.html --title "Talk" [--theme white] [--handout] [--no-notes]
```

What it does: inlines `reveal.css`, the theme (whose fonts are already data URIs inside it), `reveal.js` and the
notes plugin; escapes `</script` and `<!--` inside each inlined script; writes a notice comment in the head (reveal.js
MIT, the notes plugin bundles marked under MIT, the theme fonts are under the SIL Open Font Licence); turns transitions
and auto-animate off before `initialize()` when the system asks for reduced motion (reveal.js does not); `--handout`
sets `pdfSeparateFragments: false`. Measured: the built deck (notes plugin included) makes no request from `file://`;
auto-animate gave 52 or more distinct widths for a box going from 64 to 256 px; `?print-pdf` gave 10 pages for 7
slide positions with one three-fragment slide by default, 7 with `--handout`.

API notes: the global `Reveal` is the constructor; the instance (`new Reveal(config)`, here `window.deck`) carries
`getIndices()`, `getScale()`, `getConfig()`. The hash is written after a debounce of about a second, so a link read
straight after a key press is the old one.

## Marp

```
npx marp --no-stdin deck.md --html -o deck.html     # self-contained bundle
npx marp --no-stdin deck.md --pdf                   # needs an installed Chrome, Edge or Firefox; not run here
npx marp --no-stdin deck.md --pptx                  # image-based slides; --pptx-editable needs LibreOffice; not run
```

Always `--no-stdin` in scripts and agents: with a standard input that is not a terminal the CLI waits for it and
never finishes (proved by `test-marp.mjs`: still waiting after 15 s, nothing written). The bundle mentions an unpkg
URL only inside a licence comment and makes no request. A comment above the front matter turns the front matter into
a slide of its own (found while writing the example: three slides became four); put comments inside the YAML.

## Print and PDF

Own core: `@page { size: 1920px 1080px; margin: 0 }`, and in `@media print` the transform removed, every slide
`position: relative` at 1920 by 1080 with `break-after: page`, every fragment visible, `print-color-adjust: exact`.
Result: one page per slide, MediaBox 1440 by 810 pt, exactly 16:9.

Prove it every time with `scripts/deck-pdf.mjs deck.html -o deck.pdf` (the page count against the slides, one page
shape); for reveal.js add `--query print-pdf --wait-for window.__ready --expect N`. Then open the PDF and look:
`filter`, `backdrop-filter` and `mix-blend-mode` can rasterise or vanish in print, and web fonts must have loaded.

## Recording a deck as a film

The `(slide, step)` hash makes every frame addressable: hand the deck to `sensei-video-pipeline` with one screenshot
per step, or a seek page that maps time to a step.

## Licences in one place

| Piece | Licence | In a project | In the plugin |
|---|---|---|---|
| Own core, `build-reveal.mjs`, `deck-pdf.mjs`, the tests | HTML-Sensei's own | yes | yes |
| reveal.js (and marked inside the notes plugin) | MIT | yes, inlined by the build with its notice | never vendored; fetched with npm |
| reveal.js theme fonts (Source Sans Pro, League Gothic and others) | SIL Open Font Licence | yes, keep the notice when the deck is shared | no |
| Marp CLI, impress.js, bespoke | MIT | yes | no |
| Slides.com, Gamma, Canva templates | proprietary | not ours to redistribute as templates | no |
