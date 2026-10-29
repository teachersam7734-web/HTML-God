---
description: 'Print the project''s HTML-Sensei licence ledger (.sensei/licences.json) and flag rows with problems (copied code missing its notice, CC BY without attribution, never-ship or ideas-only sources used wrongly), plus inlined code with no ledger row.'
argument-hint: "[project folder, default the current project]"
allowed-tools: Read, Glob, Grep, Bash(node *)
---

Print and check the licence ledger of: $ARGUMENTS

(If no folder was given, use the current project root.) Read `${CLAUDE_PLUGIN_ROOT}/skills/html-sensei/SKILL.md`
section 7 for the licence rules if you have not this session.

1. Print the ledger: `node "${CLAUDE_PLUGIN_ROOT}/lib/ledger.mjs" list <project>`. Each row prints as id, licence, use
   and files; each problem prints as a `PROBLEM` line; exit 1 means at least one problem. An empty ledger prints a
   note: say so, and if the project has vendored or fetched code, that is itself a finding.
2. Flag rows missing notices: `ledger.mjs` already reports `copied code needs its notice kept` for vendored, ported or
   fetched rows with no notice. For each row with `files`, open the files and confirm the notice text (the holder's
   name after a copyright or licence word) is actually present in a header comment or a LICENSES entry; a row that
   claims a notice the file does not carry is flagged too.
3. Look for the reverse gap: search the project's web files for inlined libraries and fetched components (licence
   headers, `@license`, `Copyright`, well-known globals such as `gsap`, `Lenis`, `THREE`, `lottie`, `rive`,
   `Chart`, `echarts`) and list any that have no ledger row.
4. Flag forbidden use: never-ship sources (react-bits, Tailwind Plus, Aceternity Pro, Landingfolio, SceneAI) marked as
   shipping in a plugin; ideas-only sources (onetake, repositories without a licence, lygia, Shadertoy defaults)
   recorded as anything but `idea`; CC BY assets without a visible attribution line; non-commercial licences in a
   project whose profile says `licence_mode: commercial`.

Print the ledger as a table (id, name, licence, use, files, notice present yes or no), then the flags, most serious
first, each with the row id and the fix (add the notice, add the row, add the attribution, replace the piece). Do not
edit the ledger or any file in this command; tell the user what to change, or which agent should.
