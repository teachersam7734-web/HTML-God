# The design read, the dials and the brief

From the owner's own skills: GOAT HTML (`SKILL.md` §2 and `references/design.md` §6 to §8) and HTML-Master
(`references/01-art-direction.md`), folded in and adjusted where HTML-Sensei's rules differ (section 5).

## 1. The one-line read

Before any code, write one line and put it at the top of `.sensei/direction.md`:

> Reading this as: **<kind>** for **<audience>**, with a **<vibe>** language, leaning toward **<palette family> /
> <type pairing> / <motion level>**.

Skipping the read is the biggest single cause of generic output. Ground it in the subject: a magic-carpet lyric
journey must not look like a finance dashboard. Palette, texture and type come from the subject's world; if the brief
pins a look, the brief wins; if it is silent, never spend the freedom on a default.

## 2. The three dials

| Dial | Range | Means |
|---|---|---|
| Variance | 1 to 10 | 1 rigid symmetry, 10 art-directed chaos |
| Motion | 1 to 10 | 1 static, 10 physics and cinematic |
| Density | 1 to 10 | 1 airy gallery, 10 cockpit |

Inferred from the brief's words (GOAT HTML's table):

| The user said | Variance | Motion | Density |
|---|---|---|---|
| minimalist, calm, editorial | 5 to 6 | 3 to 4 | 2 to 3 |
| premium, luxury, cinematic | 7 to 8 | 5 to 7 | 3 to 4 |
| playful, experimental, flashy, award-site | 9 to 10 | 8 to 10 | 3 to 4 |
| educational app, learning tool | 7 | 6 | 5 |
| trust-first, regulated, dashboard | 3 to 4 | 2 to 3 | 5 to 6 |

**HTML-Sensei's default when the brief is silent** is the profile's `motion: cinematic`, the most exciting design that
serves the content: variance 8, motion 7 to 8, density 4. Map the profile to the motion dial: `cinematic` 7 to 9,
`lively` 5 to 6, `calm` 2 to 3. Reduced motion is built in at every setting.

## 3. The memorable element and the movement

- **One memorable element**: the single thing a stranger would describe afterwards (Ultra Bookworm: the fire library;
  a hologram globe; a carpet flight over dunes). Spend boldness there; everything else stays quieter.
- **Movement name and philosophy**: for hero-level pieces, two or three words and two sentences ("Ember Library":
  knowledge as warmth you gather round). Then check every choice serves it. The thread goes into colour, texture and
  motion, not into a caption.

## 4. The brief, as HTML-Master asks for it

Audience; primary action; content density; output format; offline or hosted; brand invariants; supplied assets; an
approved baseline if any; desired spectacle; explicit exclusions; target devices; accessibility preferences; content
that must remain exact. A user's acceptance of recommendations authorises routine choices: do not ask the same
question twice.

Translate adjectives into visible choices: "cinematic" means framing, foreground and background separation, motivated
light, a coherent camera move and an arrival beat, not a black background; "futuristic" means precise hierarchy and
unusual materials, not tiny monospace and neon borders everywhere; "premium" means care in utility pages, loading
states and controls, not only the hero.

**Page families** to define before scaling: entrance (identity, promise, action, proof); dashboard (resume and
progress first); content (expressive entrance, stable reading surface, visible next step); interactive exhibit
(purpose, scenario, scene, controls, explanation, transcript); utility (notes, settings, results: same type and
spacing system, not exempt from quality).

**Motion in three levels**: atmosphere (slow, pausable, never behind dense text at full contrast), navigation (short,
responsive to repeated use, never an unskippable intro on return), explanation (learner-controlled, labelled). One
dominant arrival, a supporting reveal, then a stable reading state.

**Colour as roles**: primitives, then semantic roles (surface, text, muted text, focus, action, emphasis, separator,
status), then component exceptions (`sensei-tokens-theming`). Judge the final composited colours, not the nominal
pair; test controls in every state. Do not pile a new palette onto old media: replace composition and tokens together.

**Type as an assigned system**: each family has one job; test the longest real heading; fixed-height cards that
assume short English labels break in other languages.

**Reference study**: for each example record the mechanism (camera follows depth, words enter one by one), then decide
whether to rebuild it in our own code or use a licensed component.

## 5. Where HTML-Sensei differs from GOAT HTML and HTML-Master

HTML-Sensei takes priority (owner, `HTML-SENSEI-ADDITIONS.md` §10). Recorded for the coordinator to resolve in those
two skills:

| GOAT HTML or HTML-Master says | HTML-Sensei says |
|---|---|
| A size budget tier in the design read (Feather 200 KB, Middle 5 MB, Heavy 5 to 20 MB) | no budget unless the user asks; weight is reported, never a design input |
| "One heavy library max" | use what the best result needs; record each in the licence ledger |
| On mobile, fade the hero canvas to .2 under 1100 px and turn it off under 640 px | design the mobile composition deliberately; never switch an effect off because a device class is assumed weak (the target device decides; say what was not verified) |
| "Two families max" | a family per job; a third (data, mono) is fine when it has a role, as HTML-Master itself allows |
| Default motion when silent: motion 6 | default `cinematic` (motion 7 to 9), the most exciting design that serves the content |
| Liquid glass "verified cross-browser" | Chromium only verified here; Firefox and Safari not verified |
