# Question engines, feedback, content gates and spaced review

Sources: `domain-courses-elearning.md` in the HTML-Sensei build project's research notes (not shipped) sections 4.3, 4.4, 4.7 and 6; the field log
(the build project's field log (SENSEI-LOG, not shipped), design-fix phase 1); Ultra Bookworm's `app.js`; the tests in this skill.

## The six question types (`scripts/engine.js`)

| Type | Data | Control | Accessibility choice | Grading |
|---|---|---|---|---|
| `mcq` | `options`, `answer` (index) | native radios in `<fieldset><legend>` | arrows select natively; changes allowed until Check | 1 or 0 |
| `tfng` | `answer` (0 True, 1 False, 2 Not Given) | the same, three fixed options | Not Given is a real answer, used | 1 or 0 |
| `multi` | `options`, `answer` (indexes) | native checkboxes | the same | `(hits - wrong picks) / answers`, floored at 0 (1, 0.5, 0, 0 measured) |
| `gap` | `answer` (accepted strings) | `<label for>` and a text input, `autocomplete=off autocapitalize=off spellcheck=false` | the label is the prompt | trim, lower-case, collapse spaces, fold curly apostrophes; any accepted answer |
| `order` | `items`, `answer` (permutation) | a list with Up and Down buttons, Alt+Arrow on a row; a polite live region says "Review moved to position 2 of 3" | drag is never the only way | share in the right place (partial credit) |
| `match` | `pairs` | one native `<select>` per row | works with every input method | share matched |

`mount(q, host, {attempts, onDone})` adds the Check button, a `role="status"` region that exists empty before any text
(so the first message is announced), the empty-submit guard ("Choose an answer first.", no attempt used), the retry
policy ("Not quite. Try again (1 left)." and never the key), then locks the controls and adds "(correct answer)" for
screen readers. `onDone(result)` gets `{score, ok, response, tries}`.

### When the first choice must be final (Ultra Bookworm's pattern)

Native radios select on arrow keys, so in a one-shot quiz an arrow would answer for the learner. Use buttons with
`role="radio"` and `aria-checked` in a `role="radiogroup"` named by the prompt, move focus only on arrows, answer on
click, Enter or Space. After answering, mark options with `aria-disabled="true"`, never `disabled`: disabling the
focused option drops focus to `<body>` (field log). Every `:hover:not(:disabled)` style also needs
`:not([aria-disabled="true"])`.

### Feedback rules (design rules the engine encodes; not measured outcomes)

- Immediate, specific, short: right or wrong in words, then the reason from the content (`explain`), referring to the
  passage. Ultra Bookworm requires every quotation in an explanation to exist in the passage (`quotecheck.py`).
- Never reveal the key before the last attempt.
- Never colour alone: a word ("Correct", "Not quite"), an icon, and a hidden note per option.
- One polite live region for verdicts; clear it and write after a short delay so the same sentence twice is spoken.
- A wrong answer is information for review: feed it to the deck.
- The course's own voice, not "Wrong!".

## Content gates (`scripts/validate-lessons.mjs`)

Run before every build; a build that writes the deliverable with errors is a bug.

| Gate | Why | Severity |
|---|---|---|
| Unique lesson ids, prompts present, explanation on every question | a missing explanation is a dead end for the learner | error |
| Answer index in range, options unique, gap answers present, order answer a permutation, multi answer valid, match has two or more pairs | a broken item cannot be answered correctly | error |
| Exact question count (`--count N`) | Ultra Bookworm: anything but 10 is an error | error |
| The key is the longest option more often than chance plus 15 points (8 or more items) | answerable by length; Ultra Bookworm measured 70 per cent before repair, 14.9 after | warning |
| An answer position never used (8 or more items) | a pattern a candidate can exploit | warning |
| True/False/Not Given with no Not Given answer (5 or more items) | Not Given must be a real option; 32 Ultra Bookworm lessons had none before repair | warning |

Course-specific gates (quotations exist in the passage, recycled vocabulary, lexical quotas, technique uniqueness)
belong in the course's own validator, as in Ultra Bookworm's `checkone.py` and `auditlesson.py`.

## Spaced review

| Scheduler | Use when | Measured here |
|---|---|---|
| Leitner (`srs.js leitner`) | a fixed-length course; predictable and explainable ("box 3, back in two days") | Good moves a box up, Hard one down, Again to box 1; gaps 0, 1, 2, 4, 8 days by default; a course may pass its own table |
| SM-2 (`srs.js sm2`) | a simple adaptive schedule with no dependency | intervals 1, 6, then times the ease: 16 days at quality 5 (ease 2.7 then in force), ease floor 1.3, a lapse back to 1 day |
| FSRS (`ts-fsrs`, MIT) | review is the product (a vocabulary trainer, a long programme) | fuzz off: first Good due in 10 minutes, then 2.0 days, then 11.0 days; stability 2.31, 2.31, 10.97 (the learning step does not grow stability, review does) |

Deck building: due cards first, most overdue first (`dueQueue`), new cards capped per day; interleave so two cards from
one lesson are never neighbours when it can be avoided (`interleave`, greedy and deterministic: shuffle first if the
order should vary). ts-fsrs ships CommonJS and ESM; for a classic script in one file, bundle it to an IIFE with esbuild
(`--format=iife --global-name=FSRS`) and add its MIT notice and a ledger row.

Make the deck's words agree with its numbers: Ultra Bookworm's spoken summary says box 1 is "again today" while its
code schedules box 1 for tomorrow (see `ultra-bookworm.md`).

Flashcard accessibility (field log): a back face hidden only by `rotateY(180deg)` and `backface-visibility` is still
in the accessibility tree and is read before the flip. The front is a `<button aria-expanded>`, the back `inert` and
`aria-hidden` until turned, then focused.

## Assessment and certificates

- A final assessment is a separate data file with its own validator (counts, four unique options, a key in range,
  every position used, every tested word taught where the item says).
- Refuse to mark until every item is answered and a name is given; move focus to the first gap.
- Persist the pass (`{name, pct, date}`) and gate the certificate route in the router, so a deep link, a bookmark or
  Back cannot open the reward without the test, and run the certificate's setup on every entry (field log).
- Draw a canvas certificate only after `document.fonts.load()` of each face it uses.
- A code computed in the page proves the details were issued together by this file, nothing more: anyone with the file
  can compute one. A certificate that must be trusted by a third party needs an LMS or a server.
- Never let animation frames carry a result: a hidden tab gets none (Ultra Bookworm's score froze at 0 per cent).
