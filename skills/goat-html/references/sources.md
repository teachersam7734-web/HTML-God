# Sources: the asset & component registry (for any LLM to scrape)

A curated registry of websites, galleries, and GitHub repos where an LLM (or human) can find and
lift **components, hero sections, templates, reactive features, animations, web motion, SFX, VFX,
fonts, and icons** for single-file HTML builds: with the licence reality stated per source, so
lifted work is legal by construction, not by luck.

> Licence facts below were verified September 2026; licences drift. Rechecked on 2026-10-27
> against the source (licence page, LICENSE file, GitHub's licence detection or the npm package):
> GSAP, jsfxr, animate.css, React Bits and the GitHub repos in §7. When a build depends on a
> source's licence, re-check the source before shipping. "Scrape-friendly" means the site serves
> real HTML/JSON that an agent can fetch and read without JS rendering or logins.
>
> Every vendored or ported piece gets a row in the project's licence ledger (source, licence,
> whether redistribution inside the deliverable is allowed). HTML-Sensei keeps that ledger in
> `.sensei/licences.json` and its `guard-licence` hook enforces the rules below.

---

## §0 · The scraping protocol (read before lifting anything)

1. **Identify the licence first.** MIT/BSD → lift freely (keep the notice). "Inspect/demo" sites →
   study the technique, re-implement from scratch (that's what we mean by *lift*: technique, not
   code, unless the code is permissively licensed). CC-BY → lift + attribute in a comment.
2. **Prefer raw file URLs.** GitHub sources: use `raw.githubusercontent.com/<user>/<repo>/<branch>/<path>`
   or the GitHub API (`api.github.com/repos/<user>/<repo>/contents/<path>`): both return plain
   text an agent can read directly. Never parse rendered HTML when a raw file exists.
3. **Extract the pattern, not the page.** What gets lifted is a *component* (HTML+CSS+JS block,
   self-contained), a *token set* (palette/typography as CSS custom properties), or an *algorithm*
   (a canvas/animation technique). Strip navigation, analytics, and dependencies before embedding.
4. **Adapt to the contract.** Any lifted block gets re-tokenised to the build's `:root` variables
   (`design.md` §1): no source's hardcoded palette survives contact with the build.
5. **Log provenance.** A one-line comment above the lifted block:
   `/* adapted from <source> (<licence>): re-tokenised to this build */`. Future sessions and
   audits will thank you.
6. **Weight is reported, not budgeted, but dependencies still cost.** A lifted hero that drags in
   three libraries also drags in three licences and three token systems that fight yours.
   Re-implement without dependencies when the result is as good; vendor the library when it is
   better (`library-ecosystem.md` §0). Never trade quality for weight.

---

## §1 · Component & section galleries (HTML/CSS blocks ready to lift)

| Source | What it holds | Licence reality | Scrape notes |
|---|---|---|---|
| **Uiverse.io** | 4,000+ open-source components: buttons, cards, loaders, toggles, inputs: vanilla HTML/CSS and Tailwind | MIT (per component) | `uiverse.io/element/<author>/<name>` pages embed the full HTML+CSS inline; also mirrors to GitHub under `uiverse-io/galaxy` |
| **unDraw** (undraw.co) | Consistent flat illustration set, recolourable by hex | Open (unDraw licence: free, no attribution) | SVG download URLs are stable; inline as `<svg>` and recolour via `fill` |
| **Open Peeps / Humaaans** | Modular illustration people | CC0 / CC-BY respectively | SVGs compose; strip to paths you need |
| **HTMLrev** (htmlrev.com) | 1,500+ free HTML templates (landing, portfolio, SaaS) from many authors | Mixed per template: check each | Good for *layout grammar* study; template code quality varies |
| **Flowbite / Preline** (free tiers) | Component blocks (heroes, pricing, testimonials) | MIT (free tiers); check each block | Study structure; for single-file builds, de-Tailwind into plain CSS |
| **Tailwind Plus** (formerly Tailwind UI) | Paid component and template library | Commercial licence: use in your licensed projects, never redistributed in a skill, plugin or template others receive | Study only unless the user holds a licence |
| **21st.dev** | React/Tailwind component registry (shadcn-style): heroes, animated components | Per-component (mostly MIT, shadcn-derived) | Serves component source via its registry API/JSON: agent-friendly; output is React → de-JSX to vanilla for single-file use, or take the CSS/animation ideas |
| **shadcn/ui + Aceternity UI + Magic UI** | shadcn primitives; Aceternity/Magic UI = animated hero/feature sections (spotlight, beams, meteors) | shadcn MIT; Magic UI and Aceternity's free components per their own terms (check each); Aceternity Pro is paid: project use only, never redistributed | Rich CSS/JS techniques (border-beam, spotlight follow) that translate cleanly to vanilla canvas/CSS |
| **React Bits** (reactbits.dev, `DavidHDev/react-bits`) | Animated React components, backgrounds, text effects | MIT + Commons Clause (checked 2026-10-27: you may not sell, sublicense or redistribute the components themselves) | Use in projects only: fetch the original component into the project (its registry or the repo), use or port it verbatim, keep the copyright and licence notice in a header comment. Never copy its code into this skill, a plugin or any bundle that is itself redistributed. HTML-Sensei: `html-sensei:sensei-ui-components` has the fetch-and-port procedure |

**Uiverse is the workhorse** for small vanilla components: MIT, vanilla, copy-paste-ready, enormous
variety. One caveat: it's *components*, not *systems*: keep the build's token discipline when
lifting three different authors' buttons.

## §2 · Motion, animation & VFX (studied and lifted)

| Source | What it holds | Licence reality | Scrape notes |
|---|---|---|---|
| **GSAP** (gsap.com) | The motion library + all plugins: **free for commercial use, plugins included (SplitText, MorphSVG, DrawSVG, ScrollTrigger…), under the Standard "No Charge" licence effective 30 April 2025, after Webflow acquired GreenSock** | Standard "No Charge" licence (gsap.com/standard-license, checked 2026-10-27): free in commercial projects; not for a no-code visual animation builder that competes with Webflow without written consent | Inline the minified core in a single file (gsap 3.15.0 `gsap.min.js`: 73 KB, measured 2026-10-27; no CDN in an offline file), or lift only the *easing curves* into our CSS `--ease` tokens. Deeper: `html-sensei:sensei-motion-ui`, `html-sensei:sensei-scroll` |
| **Codrops** (tympanus.net/codrops) | The best curated web-motion demos & tutorials for 15+ years (image reveals, WebGL, text effects) | Tutorials/code per-demo licences (many MIT, some "free for personal w/ attribution": **check each demo page**) | Demo pages link their GitHub repos: prefer the repo raw files; the *techniques* are always liftable |
| **GreenSock forums / Motion Triggers** | Community GSAP recipes | Per-post | Pattern mine for scroll-choreography |
| **three.js examples + Shadertoy-derivative technique pages** | Custom GLSL: noise fields, displacement, post-FX | three.js examples MIT; Shadertoy CC BY-NC-SA by default (ideas only, re-derive) | `webgl.md` §6 holds the compact noise+uniforms shader pattern to re-implement into |
| **Animate.css** | Ready CSS keyframe library | Hippocratic License 2.1 in the repo's LICENSE (the npm 4.1.1 metadata says MIT; checked 2026-10-27): read it before commercial use | Lift individual keyframes (bounce/flip/heartbeat) instead of the whole sheet |
| **OpenProp / hover.css** | Hover state patterns | MIT | Same: lift the two or three you need |
| **anime.js docs** | Timeline/transforms reference | MIT library | Alternative to GSAP at half the size |
| **Landingfolio / GoodUI patterns** | Layout/motion pattern galleries for landing pages | Study-only (Landingfolio: never vendored) | Grammar mining |

**VFX specifically:** our `canvas-2d.md` §5 (fire/smoke/stars) and `webgl.md` cover the zero-dep
path. To go beyond: **Shadertoy** (shadertoy.com: CC BY-NC-SA by default unless the author states
otherwise, as HTML-Sensei records; the terms page refused a fetch on 2026-10-27, so not rechecked
here; *ideas only*: describe the technique and write your own code) and **Codrops'
WebGL Displacement/Gradient demos**. For
single-file builds, a lifted Shadertoy technique re-implemented in a 60-line canvas shader almost
always beats inlining the original GLSL.

## §3 · SFX & audio

| Source | What it holds | Licence reality | Scrape notes |
|---|---|---|---|
| **jsfxr** (sfxr.me, chr15m/jsfxr on GitHub) | Procedural 8-bit SFX generator (coin, laser, explosion, powerup…): generates WAV in-browser | Unlicense (public domain dedication; GitHub, 2026-10-27); generated sounds are yours | Best trick for single-file: the generator is JS: either lift the generator into the file and synthesise at runtime, or generate-and-embed the WAVs as base64 |
| **Our synthesised SFX engine** (`interaction.md` §4) | Oscillator-based click/whoosh/chime/error | Yours (from this skill) | Zero bytes; prefer for UI sounds |
| **Freesound** (freesound.org) | Massive CC community sound library | Per-sound CC0/CC-BY/CC-BY-NC: filter CC0 first | API requires key; scrape-friendly pages per sound; embed as base64 after ffmpeg trim/normalize (`media-embedding.md` §3) |
| **Kenney.nl assets** | Game audio packs (UI, impacts, retro) | CC0 | Download packs from kenney.nl/assets; also on GitHub |
| **Pixabay / Mixkit sound** | Curated free SFX/music | Their free licences (no attribution required) | Fine for embeds; check "no resale" clauses |

## §4 · Fonts

| Source | What it holds | Licence reality | Scrape notes |
|---|---|---|---|
| **Google Fonts** (fonts.google.com) | ~1,800 families, all open | OFL/Apache: free, embedding fine | Scrape: `curl -A "<full Chrome UA>" "https://fonts.googleapis.com/css2?family=Name:wght@400;700&display=swap"`: the UA matters (curl's default gets TTF or nothing); the CSS lists per-subset woff2 URLs + `unicode-range`s; fetch the `latin` subset raw for embedding (`media-embedding.md` §4) |
| **The League of Moveable Type** (theleagueof.com) | Original open fonts (League Spartan, Blackout…) | OFL | GitHub mirrors |
| **Fontshare** (fontshare.com) | ITF's free-for-commercial families (Clash Display, General Sans, Satoshi…) | ITF FFL (free, embedding OK) | Clean download API; excellent "not-Inter" display choices |
| **Braille Institute's Atkinson Hyperlegible** | Max-legibility font | OFL | Accessibility-forward choice |
| **fontsource.org** | Self-hostable npm packages per font | OFL (fonts) | `npm`-style fetching; good for subset woff2 |

## §5 · Icons, favicon & misc embeddables

| Source | What it holds | Licence reality | Notes |
|---|---|---|---|
| **Lucide** (lucide.dev) | 1,500+ clean stroke icons, SVG paths | ISC | The dock icons in our starters are Lucide-style paths; grab single `<path d>` strings: perfect for generated navs (`architecture.md` §4) |
| **Tabler Icons** | 5,000+ stroke icons | MIT | Same lift pattern |
| **Simple Icons** (simpleicons.org) | Brand logos as single-path SVGs | CC0 for the paths (brand marks' own trademarks apply) | `cdn.simpleicons.org/<slug>/<color>` |
| **Twemoji / OpenMoji / Noto Emoji** | Colour emoji as SVG | CC-BY / CC-BY-SA / OFL | Our emoji-favicon trick (`media-embedding.md` §6) generalises: inline the SVG instead of relying on system emoji |
| **Heroicons** (heroicons.com) | Tailwind's icon set | MIT | 24px grid, clean |
| **Emojicombos / Kaomoji** | Text-based flourishes | Public domain-ish | For personality in plain text |

## §6 · Inspiration & pattern galleries (study, then re-implement)

These are *look at, learn from, re-derive* sources: scraping their code is not the point and often
not permitted:

| Source | Value | Notes |
|---|---|---|
| **Layers.to** | Curated landing/hero design gallery with live sites | Best for "what does premium look like right now": mine the *layouts*, palette families, motion patterns |
| **Godly.website** | Astrophysically good web design curation | Same discipline: study the grammar, lift nothing |
| **Dark.design / Land-book / SaaS-Landingpage** | Genre galleries | Filter by "dark/cinematic" for our aesthetic |
| **Awwwards / FWA** | The annual showcase ceiling | Mostly study-only; heavy WebGL |
| **HTTP203 / CSS-Tricks / web.dev/articles** | Technique deep-dives | `scroll-driven-animations`, `color-mix()`, `@property`: the modern single-file superpowers |
| **Wikipedia's Web colours / PatternFly tokens** | Palette science | Contrast math |

## §7 · GitHub repos worth scraping directly (raw-file gold)

| Repo | What to take | Licence |
|---|---|---|
| `uiverse-io/galaxy` | Every Uiverse component as raw HTML/CSS files | MIT |
| `chr15m/jsfxr` | The SFX generator (runtime synthesis) | Unlicense |
| `juliangarnier/anime` | anime.js source + easing catalogue | MIT |
| `greensock/GSAP` (public repo) | Core + plugins, all free | GSAP Standard "No Charge" licence |
| `animate-css/animate.css` | Keyframe library | Hippocratic 2.1 (repo LICENSE) |
| `mdn/dom-examples` | Canonical canvas/WebAudio/WebGL demos | CC0 |
| `codrops/*` org repos | Per-article demo code | Per-repo (check) |
| `googlefonts/*` repos | Font sources & subsets | OFL |
| `lucide-icons/lucide` | Icon path data as JSON/SVG files | ISC |
| `twitter/twemoji` | Emoji SVGs | graphics CC-BY 4.0, code MIT |
| `tailwindlabs/heroicons` | Icon SVGs | MIT |
| `dashersw/liquid-glass-js` | WebGL2 liquid-glass refraction: vanilla, no build | MIT |
| `paper-design/shaders` | Canvas/WebGL shaders (liquid-metal, mesh-gradient…), zero-dep vanilla build | Apache-2.0 |
| `ruucm/shadergradient` | Animated gradient planes + param/preset vocabulary (R3F) | MIT (npm packages; no licence file in the repo root) |
| `pmndrs/react-three-fiber` (+ `drei`) | React renderer for three + helpers: Door-B context, re-derive menu | MIT |

Fetch pattern for any of these:

```bash
curl -s https://api.github.com/repos/<user>/<repo>/contents/<path>   # JSON listing
curl -s https://raw.githubusercontent.com/<user>/<repo>/main/<path>  # raw file
```

## §8 · When NOT to scrape (and what to do instead)

| Temptation | Why it fails | Do instead |
|---|---|---|
| Inlining a lifted component with its whole dependency chain (Tailwind CDN, GSAP plugin chain, three.js) for one small effect | A CDN breaks offline; dependencies fight the token system; every dependency is another licence row | Re-implement the *effect* in vanilla against the build's tokens when it is as good (`canvas-2d.md`, `design.md`); otherwise vendor it properly (embedded, ledger row) |
| Copying Shadertoy/Awwwards GLSL wholesale | CC BY-NC-SA / unclear rights; unmaintainable inside one file | Ideas only: re-derive the technique (brightness functions, noise octaves) in your own compact shader |
| Copying React Bits components into a skill, plugin or redistributed template | MIT + Commons Clause forbids redistributing the components themselves | Fetch into the project only, verbatim, notice kept (§1) |
| Lifting a whole template from HTMLrev/Tailwind UI | Template structure ≠ the build's contract; drift guaranteed | Study its layout grammar, rebuild as routes over your data contract |
| Using NC-licensed fonts/audio in a client deliverable | Licence breach in shipping | Filter sources to CC0/OFL/MIT first (Freesound CC0 filter, Fontshare, Google Fonts) |

## §9 · The one-paragraph rule (for the build log)

Every lifted element gets one log line in the build's `GOAT-HTML.md`-style file:

```
Lifted: border-beam hover effect, adapted from Magic UI (MIT) → re-tokenised to --accent, 22 lines, replaces 40 KB dependency.
```

Source, licence, transformation, cost. That line is what makes the technique repeatable next build:
the same discipline as every other GOAT-HTML log entry.
