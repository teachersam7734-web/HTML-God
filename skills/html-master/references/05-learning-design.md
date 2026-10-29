# Source-grounded interactive learning

Use this reference only when the artefact teaches. Do not impose a curriculum, quiz or ENM terminology on an unrelated portfolio or product page. With HTML-Sensei installed, `html-sensei:sensei-courses` holds the question engines, spaced review, persistence, certificates and LMS packaging.

## Plan the learning before rendering chapters

Read the source in meaningful chunks and map its structure: chapters, distinctions, examples, qualifications, methods and supporting references. Build a coverage ledger connecting each source section to a lesson, reference-only location or documented exclusion. Summarisation should preserve the condition that makes a claim true, not only the memorable slogan.

For every lesson specify: intended learner; one central question; two to four outcomes; a concrete worked example; a misconception; essential terms; practice opportunity; source locator; and a boundary or failure case. Separate supplied claims, original teaching examples and freshly verified external information. A source's bibliography is not a claim that you independently rechecked every cited study.

The case adapted 28 core chapters and a bonus Plugin Architecture chapter into 63 lessons. That count is historical evidence, not a target. A large source may need fewer clearer lessons rather than a mechanically uniform number per chapter. Keep the full source available when the user requests it.

## Applying ENM without inventing learning science

The supplied Mega Study Method uses the Spark-Neuron-Code-Flow-Trace Network (SNCFT), also called ENM/Mind Hack. In the HTML course it became six interface stages:

| Stage | Learner action | Implementation |
|---|---|---|
| Spark | Preview and predict | Curiosity questions, outcomes, optional prediction |
| Learn | Understand the idea and example | Short explanations, distinctions, source access, useful diagram |
| Neuron + Code | Explain a cue map | D/A/T branches with hidden prepared explanations |
| Lab | Retrieve, check and condense | Empty learner fields; optional reference reveals |
| Flow | Apply to a concrete situation | Scenario, action prompt and criteria for self-check |
| Trace | Synthesise and preserve a limit | Own words, return to Spark questions, model only on request |

D marks subtopics, A principles and T connections in this project. The labels are organisational metaphors. Do not infer biological location, neurotransmitter effects, brain-wave changes or permanent memory from their names.

The optional 3-2-1 routine reads a passage for meaning, relationships and precision, recalls twice and writes once from memory, then checks. Adapt repetitions to the learner; the useful action is retrieval with correction, not ritualised counting. Blurt-Refine-Condense separates recall from repair and compression. Preserve blank learner notes rather than pre-populating them with an AI-written answer and calling it the learner's work.

Source skill rules are not all suitable for a self-paced HTML artefact. The user's request overrode Markdown-only output and per-session scored assessment. Document the adaptation rather than pretending the full interactive course follows every rule unchanged.

## Flashcards

Cards need a question/term on one face and a concise answer/definition on the other. Use a genuine button, focus styling, a clear flip cue and `aria-pressed` or equivalent state. Do not expose both faces at once to screen readers merely because one is rotated away visually. Give the answer enough vertical room; variable answer lengths can defeat a fixed card height.

For a 3D glass treatment, preserve `transform-style:preserve-3d`, consistent backface visibility, a correctly rotated back face and explicit active-face visibility. Avoid clipping the card's 3D transform with an ancestor's incompatible overflow/filter. Reduced motion can change faces discretely. Test click, tap, Enter, Space, card changes and flipping back across every card.

This project has three cumulative Review Stops after chapters 7, 18 and 28, with 48 cards total. They are ungraded and can be revisited. This is the user's course configuration, not a rule for every educational project.

## Assessments

Encode the answer key separately from presentation. For the requested final quiz: exactly 20 questions, exactly four options each, one selection, Next, no correctness feedback before submission, then a report with score and every missed question, correct explanation and source chapter to revisit. A 20-question sample does not certify all outcomes or practical mastery.

Test with a deliberate answer pattern whose expected score and missed IDs you know. Check that early DOM/UI states do not reveal answer styling, and that a retake resets the intended quiz state without deleting unrelated notes. Check incomplete-answer behaviour, final-question completion and reloading saved state.

For a different project, negotiate the assessment shape from the brief. Do not add repeated quizzes or forced grading merely because the skill has an assessment reference.

## Review timing and progress

In this case, completion records the actual local date; suggested reviews use cumulative offsets of +1, +3, +7, +15, +31 and +63 days. These are suggested return dates, not automatic notifications or guaranteed memory outcomes. Label the distinction clearly.

Completion is a learner-controlled progress marker, not evidence that a concept was mastered. Watching a video, opening a recap or playing an animation does not automatically mark a lesson complete. Offer resumption and visible progress without inventing deadlines or social pressure.

## Educational visual acceptance

Before approval, ask what the learner can now predict or explain. An animation earns its place if it exposes order, causation, branching, authority, dependency, uncertainty or a changing state that static prose makes harder to see. A beautifully moving network with unlabeled edges fails this test.

Pair every visual with a short explanation and a limitation. For example: a hub's spokes show message routes, not proof that one agent has legal or business authority; a lost receipt does not mean the action failed; a loop needs an exit; a provenance edge indicates support, not certainty. Make failures intelligible instead of forcing every animation to end in success.

Test all lesson templates against the source map and all actual links against IDs. Use rendered inspection for long text and diagrams. A count of 378 generated stage templates is useful coverage evidence, but it does not replace checking representative final pages and every distinct interaction.
