---
description: 'Run the HTML-Sensei gate harness (the umbrella over the page, 3D and film gates) on a target in strict file:// mode, then summarise the report honestly, including what it could not check.'
argument-hint: "<page.html | folder | film.mp4> [--quick] [--film film.mp4] [any page-gate option: --steps flows.json --routes \"?lang=fa\" --strict --mode both]"
allowed-tools: Read, Glob, Bash(node *)
---

Run the HTML-Sensei gate on: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/SKILL.md` section 3 first if you have not this session.

1. Work out the target. If no target was given, look for the deliverable: the profile's deliverable kind
   (`node "${CLAUDE_PLUGIN_ROOT}/skills/html-sensei/scripts/profile.mjs" --show`), then the packed file in `dist/`, then
   the single `.html` the session edited last. If it is still unclear, ask which file and stop.
   For a single-file deliverable, verify the packed file, not the source.
2. Run the umbrella from the project root, in strict `file://` (the default; never add `--lenient-file` unless the
   user asked, and say so if they did). Pass the arguments through as given:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/verify.mjs" $ARGUMENTS
   ```

   If the project has a steps file for this target (for example `*.steps.json` beside it) and none was passed, add
   `--steps <file>`. Every page-gate option is forwarded as given (no `--` needed); an unknown option makes the
   umbrella exit 2 and run nothing, so read its message rather than retrying blind. The run header line
   `page-gate options:` shows what was forwarded: check `--steps` and `--strict` are in it when you meant them.
   Exit 0 is pass or warn, 1 is fail, 2 means the harness could not run.
3. If it exits 2, report what is missing (Playwright, a browser, axe-core, ffmpeg) with the install line from the
   skill (`npm i -D playwright-core axe-core` in the project, or `SENSEI_PW`, `CHROME`, `SENSEI_AXE`, `FFMPEG`). Do
   not claim anything was verified.
4. Read the combined report (`.sensei/gate/verify-<name>.json`) and the page gate's `report.md` in
   `.sensei/gate/<name>/`. Open the contact sheet and every failing screenshot with the Read tool and look at them.

Summarise in this shape, and keep the gate's own words for the not-verified list:

```
Target: <path>, mode <file|http|both>, strict file:// <yes|no>
Verdict: <pass|warn|fail>, report <path>
Failed: <check id: detail, and which skill owns the fix>
Warnings: <check id: detail>
Verified: <the verified list>
Not verified: <the not_verified list, verbatim>
Weight: <bytes, as information; never a failure unless the profile has a budget>
Looked at: <contact sheet and shots, one sentence each>
```

Do not fix anything in this command; name the owning skill or agent for each failure. Do not say the work is done
unless the verdict is pass (or warn with every warning explained) and the report is newer than the last edit.
