# HTML Router

The front door of the HTML package. You tell it what you want ("I want to build an HTML file for...", "an interactive
course about...", "a landing page for..."), it asks you at most ten plain questions, and then it builds the thing with
the right parts of three skill sets:

- **HTML-Sensei**, a Claude Code plugin with 25 skills, 16 specialist agents, commands and safety hooks. It sets the
  rules and has the final say where the three disagree.
- **GOAT HTML**, single-file craft: starters, canvas effects, tools and kiosks, a quick static check.
- **HTML-Master**, art direction, asset production and a small asset library, learning design, a browser smoke test.

By default it aims for the best possible quality and the most exciting, dynamic design the content supports, with
reduced motion, keyboard use and contrast built in. It never sets a file-size limit unless you ask for one, and it
does not call the work done until HTML-Sensei's gate has checked the finished file.

## What happens when you use it

1. You describe the project in your own words. Anything you already said is never asked again.
2. It checks which of the three skill sets are installed and tells you if one is missing.
3. It asks up to ten short questions, in up to three rounds, each with a default ("If you have no preference, I will
   ..."). Before any technical question it explains the choice in two or three plain sentences. You can always answer
   in your own words or say "you decide".
4. It writes a brief (`.sensei/brief.md`) and the project profile (`.sensei/profile.json`) that HTML-Sensei's tools
   and hooks read, and starts a licence list (`.sensei/licences.json`).
5. It tells you the plan in a short list: what it will build, with which parts, in what order, and how it will check
   it.
6. It builds, hardest part first, then runs the gate in the browser and reports what was verified and what was not.

## Install

### As part of the combined package (recommended)

`HTML-Package.zip` is one Claude Code plugin that holds everything: HTML-Sensei with its agents, commands and hooks,
plus the HTML Router, GOAT HTML and HTML-Master skills. Install the ZIP as a plugin as it is (one top-level folder,
`html-package/`, with `.claude-plugin/plugin.json` inside), or for one session without installing:

```
claude --plugin-dir <path-to>/html-package
```

In the package the skills are named `html-package:html-router`, `html-package:goat-html`, `html-package:html-master`
and `html-package:<sensei skill>`.

### On its own

`HTML-Router.skill` is a ZIP with one folder, `html-router/`. Extract that folder into your Claude skills folder
(`~/.claude/skills/` for every project, or a project's `.claude/skills/`). It works best with the HTML-Sensei plugin
installed and the `goat-html` and `html-master` skills beside it; it finds them wherever they are installed and works
with less if one is missing, saying what that changes.

Needs Node 18 or newer for its helper script. The gate needs Chrome (or Edge or Chromium) and Playwright, which
HTML-Sensei's gate finds on its own (`npm i -D playwright-core axe-core` if it finds none).

## Use

Ask for something in HTML, or name it: "HTML Router: I want to create an interactive course about volcanoes for my
Year 7 class." Then answer the questions.

The helper script can also be run by hand from the skill folder:

```
node scripts/router.mjs detect                              # which skill sets are installed, and where
node scripts/router.mjs brief .sensei/brief.md              # check a brief
node scripts/router.mjs brief --interview .sensei/interview.md   # check an interview: at most 10 questions, plain, with defaults
node scripts/router.mjs profile .sensei/brief.md --project .     # write the profile, the licence list and the state file
node scripts/test-router.mjs                                # the tests
```

## Files

| Path | What |
|---|---|
| `SKILL.md` | the method the assistant follows |
| `references/interview-bank.md` | every question by kind of project, with defaults and plain explanations |
| `references/routing-map.md` | every part of the three skill sets and when each is used |
| `references/brief-template.md` | the brief format |
| `scripts/router.mjs`, `scripts/test-router.mjs`, `scripts/fixtures/` | the helper and its tests |
| `examples/` | three worked interviews (landing page, course, presentation) and a finished brief |
| `evals/evals.json` | test requests with what a good interview and plan must do |

## What is verified

On Windows 10 with Node 24: the helper's tests pass, the example interviews and brief pass the checks, and a profile
was written through HTML-Sensei's own loader. Not verified: the interview and a full build run by a model, macOS and
Linux.
