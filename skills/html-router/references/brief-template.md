# The brief format

The Router turns the interview into one Markdown file, saved as `.sensei/brief.md` in the project. Every later step
reads it: the profile is written from its Profile section, the agents get it as their brief file, and the final report
checks the build against it. `node scripts/router.mjs brief .sensei/brief.md` validates it.

## Rules the validator enforces

- Every section below is present, with the same heading text (the number is optional).
- The Profile section has every key, one per line as `- key: value`, with an allowed value:

| Key | Allowed | Default |
|---|---|---|
| `deliverable` | `single-file`, `site`, `deck`, `course`, `dashboard`, `game`, `film`, `component` | `single-file` |
| `offline` | `true`, `false` | `true` |
| `languages` | a JSON list of language codes, such as `["en"]` or `["en","fa"]` | `["en"]` |
| `rtl` | `true`, `false` (true when any language is written right to left: `fa`, `ar`, `he`, `ur`) | `false` |
| `motion` | `cinematic`, `lively`, `calm` | `cinematic` |
| `licence_mode` | `commercial`, `personal` | `commercial` |
| `react` | `true`, `false` | `false` |
| `widths` | a JSON list of screen widths to test, such as `[375, 768, 1440]` | `[375, 768, 1440]` |
| `budget` | `null`, or a number of KB only when the user asked for a size limit | `null` |

- `rtl` must be `true` when `languages` includes a right-to-left language.
- A `budget` other than `null` needs a decisions-log line with `source: answer` or `source: request` that mentions the
  size limit (the no-budget default is never changed silently).
- No placeholders left: no `<...>` and no `TODO`.
- The decisions log has one line per decision: `- <topic>: <value> (source: request|answer|inferred|default)`.
- The routing plan names at least one skill and the final gate.

## The template

```markdown
# Brief: <project name>

## 1. Request
<the user's request, word for word>

## 2. Reading
Reading this as: <kind> for <audience>, with a <vibe> language, leaning toward <palette family> / <type pairing> /
<motion level>. Memorable element: <the one thing a stranger would describe afterwards>.

## 3. Profile
- deliverable: <single-file|site|deck|course|dashboard|game|film|component>
- offline: <true|false>
- languages: <["en"]>
- rtl: <true|false>
- motion: <cinematic|lively|calm>
- licence_mode: <commercial|personal>
- react: <true|false>
- widths: <[375, 768, 1440]>
- budget: <null>

## 4. Purpose and audience
<goal, primary action, audience and what they already know>

## 5. Content and sources
<what the user supplied (files, links, text) and where it is; what will be written; what is invented and marked>

## 6. Brand and assets
<logo, colours, fonts, images, models, sounds: supplied or to be found or made, with where each lives>

## 7. Look and feel
<the chosen direction, or "explore three directions first"; named looks the user liked; things to avoid>

## 8. Motion and media
<motion level in words; 3D, hologram, shader, video, Lottie or Rive, sound, hand-drawn animation; the reduced-motion
promise>

## 9. Interactivity
<quizzes, forms, scroll story, game rules, filters, presenter view, and what each does>

## 10. Delivery and devices
<one offline file or hosted site; where it will be shared; target devices; widths to test>

## 11. Languages and accessibility
<languages and direction; fonts that must cover them; accessibility needs beyond the built-in defaults>

## 12. Licences
<commercial or personal; third-party pieces expected and their licences; never-ship or ideas-only sources to avoid>

## 13. Limits
<deadline, size limit only if the user asked, anything it must not do>

## 14. Decisions log
- <topic>: <value> (source: <request|answer|inferred|default>)

## 15. Routing plan
- Skills: <the skills, in order>
- Agents: <the agents to dispatch, or "none: built in the main session">
- From GOAT HTML: <references, starters or scripts, or "none">
- From HTML-Master: <references, assets or scripts, or "none">
- Slice first: <the hardest part, proven before the rest>
- Verify: <the gate command and what it covers; what cannot be verified here>
```

## A filled example

`examples/brief-course.md` is a complete brief for the course in `examples/interview-course.md`; running
`node scripts/router.mjs profile examples/brief-course.md --project <folder>` writes its profile.
