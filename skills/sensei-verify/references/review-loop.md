# The review loop and the hand-off

Source: `domain-verification-harness.md` in the HTML-Sensei build project's research notes (not shipped) section 5, the Doctrine (architecture section 0, item 3),
and the Stop hook `plugin/hooks/gate-claim.mjs`.

## The loop

1. **Run the gate.** `node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/verify.mjs" page.html` (the umbrella), or `sensei-gate.mjs` directly.
2. **Look.** Open the contact sheet and every failing screenshot with the Read tool (it shows images). Check layout,
   overflow, empty areas, contrast, and that the thing the brief asked for is actually there. The gate cannot judge
   taste.
3. **Read the `fail` and `warn` lines** in the table, then `report.json` for the detail (`data`: axe targets, focus
   stops, overflow offenders, frame statistics). Fix the cause, not the symptom: a flag that hides a check
   (`--lenient-file`, `--allow-external`, removing a check from `--checks`) is a defect, not a fix.
4. **Re-run only what changed**: `--checks keys,axe` after a focus fix, `--checks load,net,canvas` after a shader edit.
5. **Re-run the full gate once at the end.** Its report must be newer than the last edit, or the Stop hook sends the
   turn back.
6. **Report** in the hand-off format below. Never write "tested" for something the report does not contain.

For debugging a failure interactively, open the same file with Chrome DevTools or the browser tools; the gate is the
repeatable record, the browser is the microscope.

## The hand-off format

```
Verified (gate report .sensei/gate/<name>.json, verdict PASS, <date>):
- <check>: <what it showed>             (one line per passing check that matters to the brief)
Warnings kept, and why:
- keyboard: 1 of 18 stops shows a small ring (13 px native checkbox); looked at it, ring is present
Not verified:
- <every not_verified line from the report, verbatim>
- <anything this machine could not run: real GPU frame rates, Safari, a phone>
Looked at: contact sheet <path> (375, 768, 1440, forced colours, dark, reduced motion, 400 per cent zoom)
Manual checks for the user: <the ten-minute list from accessibility.md>
```

## Reading a report: worked example

The research gate on a finished landing page gave 16 pass, 2 warn and 3 axe fails. The three fails were **one** bug
seen on three runs (mobile, desktop, dark): `label-content-name-mismatch` on two header buttons. Reading it:

- Three axe fails with the same rule id are one defect, not three. Fix once, re-run `--checks axe`.
- One warning was the keyboard check: 1 of 18 stops showed no visible focus change, a 13 px native checkbox whose
  ring is small. Look at it, then fix it or keep it and say why; warnings go in the hand-off either way.
- The `performance` line said software GL: the frame rates were reported, not judged.

On the 83 MB Ultra Bookworm file the gate passed in strict file mode, with a `hygiene` warning for 8 `<h1>` elements
(one per screen of a single-page app): a real finding to weigh, not to silence.

## Honest words

| Do not write | Write |
|---|---|
| "accessible", "WCAG compliant" | "no automatically detectable violations (axe, three runs); manual checks listed" |
| "tested on mobile" | "rendered at 375 px in Chromium; not run on a phone" |
| "60 fps" (from software GL) | "62 fps under software GL (relative, not a target-device number)" |
| "works offline" (after an http run) | "passes strict file:// with external requests blocked" |
| "screen-reader tested" | "ARIA tree written; speech not tested" |
| "done" with no fresh report | run the gate first: the Stop hook will send the turn back otherwise |

## When the gate cannot run

No Node, no Playwright or no browser: the gate exits 2 with what it tried and what to install (`npm i -D
playwright-core`, no browser download needed when Chrome or Edge is installed; or `npx playwright install chromium`).
Say so plainly in the report and list every check as not verified. The umbrella writes a failing combined report when
the page gate could not run, because nothing was verified.
