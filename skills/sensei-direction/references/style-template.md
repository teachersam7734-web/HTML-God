# The direction note and the style spec

Two files the direction step leaves behind. Both are short, plain markdown in the project, never in the plugin.

## 1. `.sensei/direction.md`: the direction note

Written after the design read, updated when the user picks a direction. Every later agent reads it before building.

```markdown
# Direction: <project>

## Read
Reading this as: <kind> for <audience>, with a <vibe> language, leaning toward <palette family> / <type pairing> /
<motion level>.
Dials: variance <1-10>, motion <1-10>, density <1-10> (why, in one line each).
Profile: motion = <cinematic | lively | calm>, deliverable = <...>, languages = <...>.

## Movement
Name: <two or three words, from the subject's world>.
Philosophy: <two sentences: what the design believes about this subject>.
The one memorable element: <what a stranger would describe afterwards>.

## Brief facts
Audience; primary action; content density; brand invariants (logo, colours, words that must stay exact); supplied
assets; target devices; offline or hosted; accessibility needs; explicit exclusions.

## Directions explored
A <name>: <thesis>. B ... (3 to 6). Comparison page: <path>. Grounded in: <references and what structure each lent>.

## Chosen
<letter and any mix, in the user's words>, on <date>. What changes from the preview when built properly.

## Style
Token style or art direction: <name>, spec in <path to STYLE spec if one was written>.
Palette (named roles, not colour names): ground, surface, ink, ink-soft, accent, accent-ink, line, focus.
Type roles: display, body, data. Motion: one ease family, the three levels (atmosphere, navigation, explanation).

## Gates passed
Gate 1 (theses agreed): <date>. Gate 2 (comparison page looked at, checker passed): <date>. Gate 3 (built slice
looked at): <date>.
```

## 2. A style spec, for an art direction we define

Use this section order (studied from lemo-opuscar's style template, which is MIT; this is our own wording). One page
per style; it fixes the invariants so a direction stays itself across a hero, a deck and a film.

1. **Essence**: one paragraph, and what it is NOT (the style most often confused with it, and the difference).
2. **Materials and rendering**: what surfaces are made of and how light behaves on them; the HTML technique for each
   (CSS layers, SVG filter, canvas, WebGL), and the fallback when it cannot run.
3. **Colour logic**: named roles and what each colour means; the rule for exceptions (one warm accent in a cool world).
4. **Type**: families and their jobs, scale, what must never be set in the display face (body, facts, instructions).
5. **Motion quality**: ease family, durations, what moves and what never moves; the reduced-motion version (a
   complete set of still states, not an empty page).
6. **Camera and transitions**: how the view changes; the native transition of this style (ink bloom, paint-over,
   overprint, light sweep, snap to grid).
7. **Sound** (when the deliverable has any): palette and silences (`sensei-audio`).
8. **Native moves**: three to six signature moments the style is known for; spend the boldest at the peak.
9. **Pitfalls**: the failures specific to this style, with contrast, flashing and Persian notes.
10. **Engine pointers**: which skill and example builds each part.
11. **Variation space**: what may change between projects (palette, density, subject) and what may not.

Write the spec before the first slice; check the slice against it; update the spec, not just the code, when the user
changes the look.
