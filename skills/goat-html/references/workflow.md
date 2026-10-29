# The 8-Phase Workflow

The loop every GOAT-HTML build runs, in order, with a gate after each phase. Skipping a gate is how
"cinematic" becomes "broken at 90%". Times are for a solo agent build; scale with scope.

---

## Phase 1 · Design Read (5 min, zero code)

Output the one-liner (SKILL.md §2) and set the three dials. Additionally:

- Name the **one memorable element**: the thing a stranger would describe afterwards. ("The hologram
  globe", "the fire background", "the 3D cover carousel".) Everything else stays quieter than it.
- List the **engines** you expect to need: canvas 2D? WebGL? WebAudio? TTS? Router? Store? Write them
  down; Phase 4 builds them first.
- Write down the **delivery channel** (emailed, USB, LMS upload, hosted) and whether it must work
  offline. Best quality is the default: there is no page-weight budget unless the user asks for one.
  Weight is reported at every gate as information, never used to cut quality (`media-embedding.md` §1).

**Gate 1:** design read + dials + memorable element + engine list + delivery note exist as text.
If the brief is ambiguous on look, ask *one* question: never a questionnaire.

## Phase 2 · Contract (10 min, still zero HTML)

Decide, in writing, before UI exists:

1. **Data contract**: one array, one shape. Document it in a comment at the top of the array.
2. **Store shape**: what persists, under what key, with what migration/version field.
3. **Routes**: id/label/icon path/tooltip quadruples, even for a 2-route app.
4. **Sentinels**: where scripted edits will inject: `/*__ENGINE__*/`, `/*__MODULES__*/`,
   `/*__DATA__*/`, `/*__COVERS__*/`… name them now, place them in the skeleton.
5. **Feature list**: ranked must/should/could.

Why before UI: features are views over data. Contracts designed after the UI get retrofitted, and
retrofits leak. (In Ultra Bookworm the entire 50-lesson course was later grafted onto a bonus-course
shell *because* the route/dock/store contracts held; the data array was swapped wholesale.)

**Gate 2:** contract block pasted into the file's `<script>` as a comment; feature list ranked.

## Phase 3 · Skeleton (30 to 60 min)

- Tokens (`:root` custom properties), fonts (embedded `@font-face` for offline files; a `<link>` only
  for a hosted page that may make network requests), overlay stack, app shell, empty routes,
  nav dock generated from the routes array.
- All routes exist and are switchable with empty content before any feature is written.
- Verify: serves, boots, no console errors, routes switch.

**Gate 3:** browser shows the shell; console clean; `verify_html.py` passes on the skeleton.

## Phase 4 · Engine first (2 to 8 h: the expensive phase)

Build the hardest engine before any feature UI:

- Canvas/WebGL scenes, audio analysers, lyric engines, physics, custom layouts.
- Decide library-vs-hand-rolled per engine (`webgl.md` §1, `canvas-2d.md` §1). Hand-rolled wins at
  "vibe" complexity; libraries win when the requirement is real (real 3D, real bloom).
- If inlining a library, do it **now**, before it's referenced everywhere (`inline_three.py`).
- Wrap every engine in try/catch; every animated system gets its `prefers-reduced-motion` path
  now, not in hardening (reduced motion is built in, not added).

**Gate 4:** the engine runs in the served page (not just in your head): animate, resize, reduced
motion all verified. Console clean.

## Phase 5 · Features (iterative)

One feature per pass, smallest shard that demonstrates it, verified before the next:

- explore/search/filter → cards → quiz → progress → save/bookmark → sound toggle → settings.
- Each feature reads *only* the data contract and writes *only* the store contract.

**Gate 5:** each feature verified in the browser at its phase; `verify_html.py` still green.

## Phase 6 · Naturalism pass (1 to 2 h)

The 20% of effort that produces 80% of "this looks expensive":

- Ambient motion (aurora breathe, grain steps, marquee, parallax): `design.md` §6.
- Micro-interaction sound design (click, whoosh, chime): `interaction.md` §4.
- Choreography: page-load sequence orchestrated as one moment; route transitions share one easing.
- Light discipline: shadows/glow consistent in direction and temperature.

**Gate 6:** side-by-side with Phase 5 state: the delta should be obvious in a screenshot.

## Phase 7 · Hardening (1 h)

- Confirm `prefers-reduced-motion` in every system; resize handlers; storage try/catch;
  `window.onerror` toast; focus-visible states; a keyboard route for every pointer feature; forced
  colours (controls keep a border); `inert` on hidden panels; touch targets ≥ 44px; viewport-fit
  for notches; pause animation when the tab is hidden.
- Storage schema versioned (or key-bumped) so future edits don't wipe user progress.

**Gate 7:** kill network → still boots; private window → still boots (storage degraded, not dead).

## Phase 8 · Ship gate

1. `python scripts/verify_html.py <file> --strict` (add `--offline` for an offline file): all green.
2. Fresh tab, opened the way the user will open it (file:// for a single file), walk every route,
   run every feature once. With HTML-Sensei installed, run its gate (`verification.md` §2).
3. Media gate: images/audio/fonts verified per `verification.md` §3.
4. Weight report (information, not a budget); update the build log (`GOAT-HTML.md` pattern) with
   decisions made, what was verified, and what was not.

**Gate 8:** all three gates pass **in this session**. No "should be fine".

---

## Failure modes this workflow prevents

| Symptom | Cause | Fix |
|---|---|---|
| Beautiful engine, broken app | Engine built after features were hung on it | Phase 4 before 5, always |
| Feature drift / two truths | Features writing their own storage | Phase 2 store contract |
| "Works on my machine" | Gates faked at the end | Gate after every phase |
| Weight surprises the delivery channel | Libraries and media inlined ad hoc, nobody looked | Phase 1 delivery note; weight reported at every gate (`media-embedding.md` §1) |
| Regressions at ship | No regression sweep between phases | Re-run static gate each phase |
| Generic output | Skipped Phase 1 | The design read is not optional |
