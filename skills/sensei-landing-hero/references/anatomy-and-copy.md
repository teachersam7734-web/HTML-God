# Landing anatomy, copy rules and section recipes

Source: `domain-landing-hero.md` in the HTML-Sensei build project's research notes (not shipped) (UI lane), built in [../examples/landing.html](../examples/landing.html).
The order below is a synthesis from the Landingfolio and Kombai reviews and the lab page; no per-page measurement was
made.

## 1. The sections

| Block | Job | Rules that hold up | How the example builds it (one file, no build step) |
|---|---|---|---|
| Skip link | keyboard users past the nav | first Tab stop | `.skip`, shown on focus |
| Nav | orient, one primary action | sticky; one filled button; 44 px targets; at most a handful of links; theme and language switches named by their visible text | `position: sticky`, translucent ground with `color-mix`; links hidden under 760 px except the action; the bar wraps under 420 px |
| Hero | what it is, for whom, the next step, in five seconds | one `h1` stating the outcome; one sentence of support; one primary and one secondary action; one proof line inside the first screen | word-split reveal, gradient on the emphasised word, background layer behind (`backgrounds.md`) |
| Social proof | cut risk | real names; numbers with a unit and a source; logos in one colour; never invent | CSS marquee with a pause button; a static row works as well |
| Features | benefits, not nouns | 3 to 6 items; one outcome number per tile; bento only if sizes carry meaning | CSS grid spans; scroll-driven reveal as progressive enhancement |
| How it works or demo | remove the "how" doubt | three steps or one real screenshot | static image or a short loop (`sensei-lottie-rive-video`) |
| Pricing | let people self-select | three tiers, one highlighted; a billing toggle that keeps focus order | radio inputs covering their labels, `:has()` swaps prices, no script |
| FAQ | answer the last objections | real objections, short answers | `<details name="faq">`: a native exclusive accordion |
| Final call to action | repeat the one action | same verb as the hero button | plain section with a radial glow |
| Footer | trust and legal | contact, privacy | plain |

## 2. Copy rules that change the build

- One `h1`, stating the outcome; the hero button's verb matches the final call to action's verb.
- Numbers carry units and sources; no carousel for essential content; the proof line sits in the first screen.
- Write for scanning: headings carry the message, short paragraphs, one idea per block (Nielsen Norman Group's
  eye-tracking work, 232 users, 2006 and revisited: people scan in several patterns; from a summary).
- Unbounce's 2024 benchmark (third-party, read through a search summary, not at source): SaaS landing pages convert at
  a median of about 3.8% against 6.6% across industries, trending up as pages get easier to read and down as word
  count grows. A direction, not a target.
- **Never fake proof.** The example's brand, logos, rating and "38%" are placeholders and say so in the file header.
  Real projects use real numbers or leave the slot out.

## 3. Section recipes

**Word reveal with gradient emphasis** (the split tool is `sensei-typography`'s `splitkit.js`, inlined in the example):

```css
.hero h1 .sk-w{display:inline-block;white-space:nowrap;opacity:0;transform:translateY(.5em);
  animation:rise .9s var(--ease) both;animation-delay:calc(var(--i)*70ms + 120ms)}
@keyframes rise{to{opacity:1;transform:none}}
/* background-clip:text on the parent does not paint through split inline-block children: paint each word */
.hero h1 em:has(.sk-w){background:none}
.hero h1 em .sk-w{background:linear-gradient(100deg,var(--brand),var(--accent) 60%,var(--accent-2));
  -webkit-background-clip:text;background-clip:text;color:transparent}
```

Split by words only (Persian joining survives); split the `<em>` separately and put the space back as a text node.
The split copy is `aria-hidden` and one visually hidden real copy stays in the tree.

**Marquee** (seamless because each list carries its own trailing padding; a flex `gap` between the two lists breaks
the half-width maths):

```css
.mq{overflow:hidden;direction:ltr}
.mq-track{display:flex;inline-size:max-content;animation:mq 30s linear infinite}
.mq ul{display:flex;gap:3rem;margin:0;padding:0 3rem 0 0;list-style:none;flex:none}
@keyframes mq{to{transform:translateX(-50%)}}
.mq:hover .mq-track,.mq.paused .mq-track{animation-play-state:paused}
```

Keep the container `direction: ltr` and put `dir="rtl"` on the lists for Persian. A visible pause button
(`aria-pressed`) is required when it runs more than five seconds (WCAG 2.2.2); hover alone is not enough.

**Bento reveal with a working hover**:

```css
@supports (animation-timeline:view()){
  .tile{animation:tilein linear both;animation-timeline:view();animation-range:entry 0% entry 55%}
  @keyframes tilein{from{opacity:0;transform:translateY(40px) scale(.97)}to{opacity:1;transform:none}}
}
@media (hover:hover) and (pointer:fine){.tile:hover{translate:0 -4px}}   /* translate, not transform */
@media print{.tile{opacity:1!important;transform:none!important;animation:none!important}}
```

**Pricing toggle without script**:

```css
.toggle label{position:relative;display:inline-flex;align-items:center;min-block-size:40px}
.toggle input{position:absolute;inset:0;inline-size:100%;block-size:100%;margin:0;opacity:0;cursor:pointer}
.toggle label:has(input:checked){background:var(--brand);color:var(--brand-ink)}
.toggle label:has(input:focus-visible){outline:3px solid var(--accent);outline-offset:2px}
.plans .yearly{display:none}
body:has(#bill-year:checked) .plans .monthly{display:none}
body:has(#bill-year:checked) .plans .yearly{display:inline}
```

**Exclusive FAQ**: `<details name="faq">` on each item; opening one closes the others (tested in Chrome).

**Reduced motion, print and forced colours** (one block each, every state still visible):

```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  .hero h1 .sk-w,.tile{opacity:1;transform:none}
  .mq-track{flex-wrap:wrap;inline-size:auto}.mq ul[aria-hidden]{display:none}
}
@media (forced-colors:active){.btn,.tile,.plan,details{border:1px solid CanvasText}.hero .bg{display:none}}
```

## 4. Use cases

| Use case | Pattern | Avoid |
|---|---|---|
| Product landing | the full anatomy; mesh or grid ground, or a shader ground | a video hero without a poster; sound that plays by itself |
| Course entrance (Ultra Bookworm) | the promise and one start button; theme skins; Persian toggle; returning visitors skip the film | heavy grounds behind lesson text |
| Presentation title | hero blocks as title slides; grid or mesh | marquee; spotlight (no pointer on a projector) |
| Game title screen | spotlight, noise, a 3D or hologram figure | bento, pricing |
| Dashboard | skip the hero; keep bento and tokens | parallax |
| Film | seekable pieces only | pointer effects |
