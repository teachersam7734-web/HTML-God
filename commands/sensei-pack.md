---
description: 'Package a project into ONE offline HTML file with sensei-single-file''s builder or inliner, then gate the packed file in strict file:// mode and report weight as information, external URLs and licence notices.'
argument-hint: "<entry.html | build.json> [out.html] [--strict] [--mode both]"
allowed-tools: Read, Glob, Bash(node *)
disable-model-invocation: true
---

Package a single-file release: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/skills/sensei-single-file/SKILL.md` (decision table, core technique, TRAPS) first if you
have not this session. No page-weight budget applies unless `.sensei/profile.json` has one; weight is reported, never a
reason to recompress below the project's chosen quality.

1. Pick the route from the first argument:
   - a `.json` manifest: `node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-single-file/scripts/build-single.mjs" <build.json>
     --check`, then the same without `--check` (add `--out <out.html>` if an output was given);
   - an `.html` entry: `node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-single-file/scripts/inline.mjs" <entry.html>
     <out.html>` (default output `dist/<entry name>.html`);
   - nothing given: look for `build.json`, then `src/index.html`, then `index.html`; if none, ask and stop.
   A refusal (leftover placeholder, missing file, a path outside the manifest folder, inert script holding `</script`)
   stops the build: report it and its fix; never work around it.
2. Read every warning the builder prints (a boot that waits for `DOMContentLoaded` behind large payloads, a late
   `<meta charset>`, external URLs kept) and say which you fixed and which remain.
3. Licences: `node "${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs" check`, and search the packed file for each inlined library's
   notice.
4. Gate the packed file, never only the source, in strict `file://`, last:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/verify.mjs" <out.html> --strict
   ```

   Pass `--mode both` after the `--` when the file will also be hosted, and the project's steps file with `--steps`
   when there is one. Open the contact sheet with the Read tool.

Report: the packed file path and its size (information only, with the five largest assets), the route used, warnings
kept and why, external URLs left (or none), notices found and the ledger check result, the gate verdict and report
path, the not-verified list verbatim, and the manual checks left for the user (double-click on the target machine,
the host or LMS). Never publish, upload or send the file anywhere without the user's explicit yes in chat.
