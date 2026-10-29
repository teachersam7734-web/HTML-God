# Learning Apps: courses, quizzes, flashcards, retention

Two of the three shipped projects are learning tools. This file is their shared manual: UI,
scoring, and the learning science that makes them more than quizzes. Deeper (question engines,
persistence, certificates, LMS packaging): `html-sensei:sensei-courses`.

---

## §1 · The standard course skeleton (proven twice)

Routes: **Home · Explore · Cards · Quiz · Progress** behind a generated dock
(`architecture.md` §4). Landing page sells the course (hero + 3D cover carousel + "lesson anatomy"
cards); `body.in-course` flips the shell into the SPA.

## §2 · Flashcards

- 3D flip: `.card { transform-style:preserve-3d; transition:transform .6s var(--ease) }`
  `.card.flipped { transform:rotateY(180deg) }`; front/back absolutely positioned, `backface-visibility:hidden`.
  Reduced motion: swap faces with no rotation. Mark the hidden face `inert` (or `aria-hidden`) so a
  screen reader reads only the face showing.
- One card per render; arrows/keys navigate; "known / again" buttons write `correct`/`wrong` to the store.
- Direction matters: front = prompt, back = full entry (definition, examples, alternates, audio).

## §3 · Quiz engine

- Draw N random questions with seeded shuffle (reproducible sessions), 15 to 20s timer per question,
  auto-fail on timeout with the correct answer revealed.
- Score → XP + streak (streak resets on a miss, multiplies XP at 3+); confetti at ≥ 70%
  (`canvas-2d.md` §4).
- After each answer: show *why*: which words/phrases decide the answer and what makes each
  distractor wrong (the msrt rule: teach the rule, not the key).
- Store per-item: `{seen, correct, wrong}`: this data is the raw material for §5.

## §4 · Explore & search

- Filter chips from the data's categories (generated from the array, not hardcoded); search box
  matches term/definition/examples; case-insensitive, debounced 150ms.
- Cards in a responsive grid (`repeat(auto-fill,minmax(240px,1fr))`); click opens a modal with the
  full entry: modals trap focus, close on Esc/backdrop.
- "Save" star per item → `saved:[]` in the store; Progress lists saved items.

## §5 · Learning science (from mega-study-method): the upgrade path

Most course apps stop at §4. This is what turns one into a *teacher*:

- **Retrieval-first:** every session opens with questions before content (the "Spark"); reveal
  answers only after the learner commits.
- **Spaced repetition:** schedule reviews at **+1, +3, +7, +15, +31, +63 days** from actual
  completion (the 2^n−1 family). The store already records per-item results: a scheduler over
  `wrong:{}`/`correct:{}` is ~40 lines and converts a quiz into retention training.
- **Drill-my-misses mode:** quiz draws only from `wrong:{}`. Nearly free given the store.
- **Difficulty adaptation:** adjust after 5 questions towards ~85% success (challenging but
  manageable); report coverage and gaps after 20.
- **Blurting:** show an entry's prompt, user recalls *before* the flip; reveal then refine. A
  checkbox toggle "recall mode" on cards implements this.
- **Coverage honesty:** show mastery % per category and total; never claim completion the data
  doesn't support.

## §6 · Progress that motivates

- Mastery ring: SVG circle, `stroke-dashoffset` animated to mastery fraction on route-entry.
- Per-category rows with mini-bars; saved-items list; best-streak and total-XP chips.
- Everything computed from the store at render time: no cached progress copies.

## Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| Quiz repeats last session's questions | Math.random without seed | §3 seeded shuffle |
| Timer drifts when tab is backgrounded | setInterval accumulation | deadline checks vs `Date.now()` |
| "Learned" never updates | writing to a feature-local copy | §3 store-only writes |
| Cards flip mid-transition | rapid re-clicks | lock during transition, or allow but idempotent |
| Streak gimmick feels random | no visibility into multiplier | show "×N" chip in HUD when active |
