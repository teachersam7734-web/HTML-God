# Gates G0 to G5 for films

Definitions after motionmaxxing's `SKILL.md` (Apache-2.0, read 2026-10-18), implemented as our own code in
`../scripts/film-gates.mjs`. Scope: **films and motion pieces only**. Never apply G5 or the never-ship list to lesson
chrome, dashboards or game HUDs, which legitimately need counters, progress bars and corner labels.

| Gate | Passes when | How it is checked here |
|---|---|---|
| G0 render exists | the file decodes, the picture moves, the length matches the plan within a frame, audio is present when planned | `film-gates.mjs --video f.mp4 --expect S [--audio]` (ffprobe, signalstats YDIF) |
| G1 proof readable | interface text at least 0.04 H; a UI fragment at least 0.55 W or cropped by the frame edge; lit, in a world | by eye on the contact sheet and stills; no script number, say so in NOTE.md |
| G2 no empty frame | no run of more than 3 consecutive flat frames | whole-frame luma range under 16 levels for more than 3 frames fails |
| G3 end card short | the unchanged end hold is at most 1.4 s (0.6 to 1.4 s is a resolved hold; under 0.6 s it ends mid-motion, which is fine); the final shot at most 25% of the film | trailing frames with YDIF under 0.2; cuts from ffmpeg `scdet` (threshold 12) |
| G4 one hero per frame | two panels only if one is at least 2x the other's area or the camera moves between them | by eye on the sheet |
| G5 no page chrome | no corner or edge labels, tracked-caps labels, counters or timecodes, progress bars (and in motionmaxxing's full lint: header and footer bars, kickers, left headline blocks beside media, letter-typed headlines, vibe-coded UI cards) | `film-gates.mjs --page film.html` samples the DOM at 24 times: C1, C2, C3, P1 only |

Exit codes: 0 pass, 1 a gate failed, 2 could not check.

## What the scripts cannot see

- G5 reads the DOM. Text drawn on a canvas, in WebGL, in images or in video is invisible to it.
- G2 calls a frame flat by its luma range; a single-colour gradient with no grain may pass while still reading
  empty, and a full-frame plain ground with only a tiny mark passes (correctly) while a 6 px dot may be too small to
  read: look at the sheet.
- G3 on an x264 draft: the encoder keeps refining a frozen picture for a while, so a measured hold can read short
  (a 4 s frozen end measured 2.67 s here). It still failed the gate; treat the number as a lower bound.
- Cut detection misses carried transitions by design (a one-take film reports no cuts, and the final-shot rule is
  then skipped with a note).

## The other gates in the pipeline

- **Storyboard gate** before building: `storyboard-check.mjs` (rhythm, rest, carries, buys, reading time, frame 0,
  end hold).
- **Determinism gate**: the same frame in and out of order (`sensei-video-pipeline` probe; `test-examples.mjs` here).
- **Loudness gate** after the mix: about -14 LUFS integrated for the web (-16 is also used), true peak at or below
  -1.5 dBTP (`sensei-video-pipeline`, `sensei-audio`).
- **Claim gate**: the plugin's Stop hook `gate-claim.mjs` refuses "done" on a film project until an MP4 and a
  contact sheet newer than the last edit exist.

## The checks ledger (record each kind separately)

| Check | Done? |
|---|---|
| scripts passed (which, with numbers) | |
| technical (decode, duration, loudness) | |
| stills viewed | |
| motion viewed (strips around fast moves, full playback) | |
| audio heard (by a person; a loudness number is not listening) | |

If something could not be observed, deliver "implemented; audiovisual acceptance pending" with the intervals that
still need a human (video-production-skills).
