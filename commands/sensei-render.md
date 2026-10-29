---
description: 'Render an HTML seek page to MP4 through the HTML-Sensei film pipeline (preflight, determinism probe, a look-first sheet, chunked resumable render, contact sheet of the master, the film gates), then report from the file on disk.'
argument-hint: "<film.html> [out.mp4] [--draft] [render options such as --png --shutter 8 --audio mix.wav --srt captions.srt]"
allowed-tools: Read, Glob, Bash(node *)
disable-model-invocation: true
---

Render a film with the HTML-Sensei pipeline: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/skills/sensei-video-pipeline/SKILL.md` sections 3.1 and 3.2 and its TRAPS first if you
have not this session. The first argument is the seek page; the second, if it ends in `.mp4`, is the output (default:
the page's name with `.mp4`, in an `out/` folder beside it). `--draft` means half scale, five-second chunks and two
workers; otherwise render at full quality. Never lower scale, fps or shutter samples on your own because this machine
is slow: say how long it took instead.

1. Preflight: `node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-video-pipeline/scripts/preflight.mjs" <outDir>`. If it exits
   1, report what is missing (Chrome, ffmpeg, ffprobe, disk) and how to provide it (`CHROME`, `FFMPEG`), and stop.
2. Probe determinism: `node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-video-pipeline/scripts/render.mjs" <page> --probe`.
   If frames differ in and out of order, stop and report the times and the `lint-determinism` findings; the page needs
   fixing by its author before any render.
3. Look before rendering everything: `render.mjs <page> --sheet 0.5,2,4,6 --out <outDir>/look.png`, and open the image.
4. Render, resumable (a killed render resumes by running the same command again):
   draft `render.mjs <page> <out.mp4> --scale 0.5 --chunk 5 --workers 2`, or full with the options the user passed
   (for a master, `--png` and `--shutter 8` are the defaults to suggest). Tell the user it may take a while and record
   the running process in `.sensei/state.json`.
5. Review the file, not the page: `node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-video-pipeline/scripts/sheet.mjs"
   <out.mp4>`, then open the sheet. Add `--strip <t>` around any fast move and open those too.
6. Film gates on the file: `node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-motion-graphics/scripts/film-gates.mjs" --video
   <out.mp4>` (add `--expect <beats>` from the storyboard and `--audio` when there is sound).
7. Last, the umbrella, so the Stop hook sees one combined report:
   `node "${CLAUDE_PLUGIN_ROOT}/skills/sensei-verify/scripts/verify.mjs" <page> --film <out.mp4>`.

Report: the MP4 path, its `<out>.render.json` numbers (frames, seconds, chunks reused, GL renderer), the probe result,
the film-gate results with numbers, the sheet and strip paths with one sentence per image you looked at, the umbrella
verdict and report path, and what was not verified (real GPU, audio by ear, target devices). Never call a
`.part.mp4`, a page that plays, or a sheet you did not open a finished film.
