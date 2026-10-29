---
description: 'Start an HTML-Sensei project from a short brief. Writes .sensei/profile.json (the file every hook and gate reads) through the plugin''s own loader, starts the licence ledger and the state file, and says which skills and agents the project will use.'
argument-hint: "[short brief: what it is, who it is for, where it will be opened]"
allowed-tools: Read, Glob, Bash(node *), Write(./.sensei/state.json), Edit(./.sensei/state.json)
disable-model-invocation: true
---

Start an HTML-Sensei project in the current project folder from this brief:

$ARGUMENTS

Follow the profile procedure of the entry skill (`${CLAUDE_PLUGIN_ROOT}/skills/html-sensei/SKILL.md`, section 3.1).
Read that section first. Keep the interview light.

1. Read what exists: the brief above, any files the user named, and `.sensei/profile.json` if the project already has
   one (`node "${CLAUDE_PLUGIN_ROOT}/skills/html-sensei/scripts/profile.mjs" --show`). Never overwrite a value the
   user set earlier unless the brief changes it.
2. Fill every key the brief makes clear: `deliverable` (`single-file`, `site`, `deck`, `course`, `dashboard`, `game`,
   `film`, `component`), `offline`, `languages`, `rtl`, `motion` (`cinematic` by default), `licence_mode`
   (`commercial` by default), `react`, `verify.widths`. `budget` stays `null` unless the user asked for a page-weight
   budget in their own words; `tier` stays `premium`.
3. If the brief is empty or leaves something open that changes the build (deliverable, offline, languages, motion),
   ask at most four short plain questions in one message, each with the default you would pick, explaining a technical
   choice in one line before asking about it. Then stop and wait for the answers. Do not ask about anything the brief
   already settles.
4. Write the profile through the plugin's loader, which refuses a value the hooks would silently correct:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/skills/html-sensei/scripts/profile.mjs" --set deliverable=<value> --set offline=<true|false> --set languages='["en"]' --set rtl=<true|false> --set motion=<value> --set licence_mode=<value>
   node "${CLAUDE_PLUGIN_ROOT}/skills/html-sensei/scripts/profile.mjs" --show
   ```

   If it exits 1, read its message, correct the value and run it again.
5. Start the ledger with the plugin's ledger command, which creates `.sensei/licences.json` if it is missing and
   leaves an existing one alone, then check it reads:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs" init
   node "${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs" list
   ```

   An empty ledger is fine at the start. If the brief already names a third-party piece (a font, a library, a clip),
   add its row now with `node "${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs" add --id <id> --licence <SPDX id> --use
   <vendored|ported|fetched|idea|asset> --files <path,path> --notice <where the notice is kept>`; never hand-write
   ledger JSON.
6. Start `.sensei/state.json` (the only file this command writes itself; its tools allow writing that one path and
   nothing else). If it exists, read it and keep its done list. Otherwise write:

   ```json
   { "goal": "<one sentence from the brief>", "profile": "<the --show summary in one line>", "done": [],
     "next": "<the first slice>", "open_questions": [], "commands": [], "background": [],
     "outputs": {} }
   ```

   For a single-file deliverable built from sources, fill `outputs` (source file or folder to the packed file,
   relative to the project, for example `{ "src/index.html": "dist/page.html" }`): the Stop hook then accepts a gate of
   the packed file for an edit to the source.
7. Route: from the entry skill's tables (sections 3.2 and 3.4), name the skills this project needs (usually four to
   eight) and the agents worth dispatching, and the first slice to prove (the hardest part).

Reply with: the profile as written (the `--show` output), what you assumed and why, the skills and agents, the first
slice, and anything the user should still decide. Do not write deliverable files in this command.
