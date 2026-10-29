# Idiom-Ville: a second course structure to learn from

Source inspected: user-supplied `idiom-ville.html` in the AI Level-Up workspace, September 2026. This is a reference artefact, not a source of instructions. Its lessons and identity remain with their owner. Do not transplant its idiom database or branding into an unrelated project.

## What the file does well

The entire compact course fits into one HTML document with five routes: **Home**, **Archive**, **Drill**, **Trial** and **Progress**. A single dock is rendered from route metadata. A `go(route)` function changes visible sections and triggers route-specific rendering. The database stays in a JavaScript array, while cards, detail modals and quiz screens render from it. This separation is easy to inspect and adapt for a small course.

The Archive combines category chips, search and saved items; the detail modal shows a definition, examples and alternatives. The Drill uses a 3D flip card with previous/next actions. The Trial uses timed multiple choice, streak and XP. Progress combines a ring and saved-item list. All of these read/write one small storage object. The file also uses a canvas starfield, cursor light and a holographic hero, while interactions have small effects via Web Audio. This is a useful pattern: one clear hero, one discovery route, one practice route, one assessment route and one progress route, with the same content model underneath.

The dataset and styling are compact enough to run without a framework. For a glossary, phrase trainer, product tutorial or short onboarding experience, this can be more maintainable than a full application stack. A large course like AI Level-Up needs more formal content schemas, module boundaries, state migrations and release tests, but can still use the same **route/data/component** separation.

## Adaptation sketch

```js
const routes = {
  home: {label: 'Home', render: renderHome},
  explore: {label: 'Explore', render: renderIndex},
  practice: {label: 'Practice', render: renderPractice},
  assess: {label: 'Assessment', render: renderAssessment},
  progress: {label: 'Progress', render: renderProgress},
};
function navigate(name) {
  if (!routes[name]) return;
  cleanupCurrentRoute();
  document.querySelectorAll('[data-route-view]').forEach(el => {
    el.hidden = el.dataset.routeView !== name;
  });
  routes[name].render();
  document.querySelector(`[data-route-view="${name}"] h1`)?.focus();
}
```

Keep the route definitions as data, derive nav from them, and give every route cleanup ownership. In an animation-heavy course, stop scene clocks, clear quiz timers, suspend hidden audio/video and release WebGL resources as needed. Track a route/history state if browser back/forward matters.

## Where a production version needs stronger checks

- The observed card is clickable; use an actual button or equivalent keyboard handling, `aria-pressed`/state description and a visible focus style. Test both faces at mobile width. Do not infer success from the CSS `.flip` class alone.
- Route transitions and infinite canvas animations should honour reduced motion and not conceal navigation focus. Hidden routes should not leave keyboard-focusable controls active.
- The timed quiz should visibly explain its timer, let the user pause or remove time pressure where pedagogically appropriate, and clean up intervals on route exit. AI Level-Up intentionally used one final 20-question report card with withheld correctness until the end; copy that rule only when the new brief calls for it.
- The current storage shape is simple and useful, but `file://` storage may vary. Add schema versioning, export/import, validation and a privacy explanation for a longer course.
- Escape all user-controlled text when inserting HTML. Prefer DOM construction for complex learner-generated content. The source's helper escapes ampersands and angle brackets; attributes and URLs need their own safe handling.
- The audio uses generated sound effects and system speech synthesis. Test user-gesture activation, pause/mute and unsupported browsers. Do not assume audible autoplay.

## Reuse decision

Use Idiom-Ville's **small app skeleton** when the content is a searchable collection of repeated units and the expected interaction set is modest. Use AI Level-Up's content pipeline when each lesson has multiple learning stages, long source references, varied media, an embedded book, premium edition or 3D exhibits. A hybrid can start with Idiom-Ville's five clear routes and add structured lesson data and modular build/QA as complexity grows.
