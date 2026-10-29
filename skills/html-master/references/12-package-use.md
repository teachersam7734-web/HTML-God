# Using this package

## Start a future project

Import `HTML-Master.skill` if the assistant environment supports skill archives. Otherwise treat it as ZIP and extract the `html-master` folder into the environment's skill directory: in Claude Code, the `skills` folder in the user's Claude configuration directory, or a project's `.claude/skills/`; in Codex, its configured skills directory. Do not assume a specific username or path. Reload skill discovery if required by the host. This delivered archive does not itself modify global settings. `agents/openai.yaml` is display metadata for OpenAI's Codex (name, short description, default prompt); other hosts ignore it.

Invoke the skill by name (in Claude Code, ask for `html-master` or let the HTML Router call it; in Codex, `$html-master`) with the new project's source files and goal. For example:

> Use html-master to turn these materials into an offline interactive HTML experience. Make the art direction original, use purposeful imagery and motion, preserve my content, and test the actual delivered file. Use the skill's reference atlas and proven patterns, adapting them to this audience and brief.

You do not need to restate the old project's implementation lessons. You should still supply the new content, audience, brand assets, required format and any changed preferences. The skill cannot infer a new identity, grant rights to unrelated assets or assume a paid service is authorised.

## What is executable

`assets/starter/index.html` runs directly in a browser without a build. It demonstrates deterministic explanatory motion, glass-card interaction, a visible Pause motion control, reduced motion, forced colours, local notes and export/import, and passes HTML-Sensei's strict `file://` gate. It is intentionally a small specimen; replace its branding, copy and art direction for production.

The scripts are generic helpers with command-line paths. Their self-test checks actual embedding/escaping, manifest and packaging behaviour. Browser smoke requires a usable Playwright/browser installation.

`examples/project-source/` contains selected implementation reference files from AI Level-Up. The source map marks application dependencies and removed inputs. It is not advertised as a complete independently buildable copy of the course. Use specific modules/patterns, or return to the original editable project when rebuilding that course.

## Assets and rights

Non-personal generated concept artwork, licensed fonts and the licensed brain/human/robot model files are included with provenance/notices. The adapted brain remains under its CC BY-SA 4.0 terms; those terms do not silently relicense separately authored course text. The asset catalogue identifies origin, role, hash, included path or reason for exclusion.

The supplied portrait/signature, generated identity-specific portrait series, book/PDF/manuscript, proprietary covers, full music and supplied videos remain in the original project and are not packaged as general defaults. The catalogue records each excluded kind and the reason; the references describe their roles and briefs. Reuse them in a future project only when that project's authorisation and context support it.

Third-party runtime packages, paid template code, whole external skills and copied website articles are not bundled merely for convenience. Install the selected dependencies from appropriate sources and retain their notices. The package includes original reference notes, not a scraped documentation archive.

## Evidence tiers

- **Project-tested:** original scene, UI, book, media and state patterns validated in the approved course; see the case study (the evidence files stay with the original project).
- **Package-tested:** helper scripts, portable starter and archive structure validated for this delivery; see [validation](../validation/README.md) and `validation/report.json`.
- **Research-only:** alternatives in the source atlas; not promised to be integrated or independently tested.
- **Unavailable/unverified:** explicitly marked failed retrievals or blocked delegation. Do not upgrade these to verified claims.

Keep those distinctions when adapting or explaining the skill. Re-run relevant tests on new data, visual layouts and dependency versions. A stable reference is a head start, not a substitute for inspecting the next artefact.
