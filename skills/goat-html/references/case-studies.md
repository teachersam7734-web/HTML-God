# Case Studies: three shipped files, all paths taken

Idiom-Ville (136 KB) · Ultra Bookworm (4.5 MB) · 1001 Arabian Nights (14.6 MB). Together they span
the whole size spectrum and most of this skill's techniques. Facts below come from the surviving
build log (Idiom-Ville) and direct artefact forensics of the shipped files; where a detail was
reconstructed from the artefacts rather than recorded during the build, it's marked *(from artefacts)*.

---

## §1 · Idiom-Ville: `idiom-ville.html` (136 KB · 1,126 lines)

**The brief:** a cinematic, futuristic single-file interactive course teaching 100
advanced English idioms. The lightest of the three.

**Architecture:** five routes (Home/Explore/Cards/Quiz/Progress) behind a generated dock; DB of
exactly 100 entries `{n, cat, d, ex[2], alt[3]}`; store `{seen, correct, wrong, saved, xp, streak,
best, sound}` under `idiomville_v1`; sentinels `/*__ENGINE__*/`, `/*__MODULES__*/`.

**The wins:**
- Hand-rolled hologram (wireframe globe, 18 latitude rings, 64 depth-sorted motes, 3 orbital rings,
  mouse parallax, additive blending): the proof that ~50 lines of trig match three.js (about
  590 KB minified) for wireframe vibes.
- WebAudio SFX synthesised; canvas confetti at ≥70% quiz scores; hash router with icons.
- Logo pipeline: 843×1240 ~1 MB source → sharp resize to h144 fit-inside → 27 KB png → single data
  URI swap, verified 98×144 natural size in the served page.

**The failures & corrections (the valuable part):**
- v1 logo cropped into a circular plate: **user correction: never crop identity art.** Final:
  flex container, `height:52px; width:auto`, glow-only hover.
- `preview_screenshot` failing with "no frames / not composited" → reload-retry, fall back to
  snapshot/evaluate.
- Stale preview gaslighting → the `?v=N` rule (reached v=7).
- PowerShell-style `$_` in Git Bash silently misbehaving → bash-native tooling rule.
- No service worker/PWA, no spaced repetition, no light theme: all priced and deliberately skipped
  (the Part-B menu pattern: record the road not taken, with its price).

## §2 · Ultra Bookworm: `ultra-bookworm.html` (4.5 MB · 1,525 lines)

**The brief:** a cinematic 50-lesson Advanced Reading Comprehension course:
"Enter the library." The middle weight of the three (this is the 2026-09 build; the course has
grown since). Built *on top of* the Idiom-Ville pattern.

**Architecture (from artefacts):**
- Landing "world" (fire library) → password gate → embedded course SPA. `body.in-course` class flip
  hides the landing; the inner SPA is the Idiom-Ville router/dock/store pattern intact: including
  the same ROUTES array shape and an added **Exit** dock button back to the landing.
- **Published integration contract:** `window.UltraGate = { check(passwordText) → Promise,
  onPass(), DEMO_PASSWORD, UNLOCK_KEY:'ultrabookworm_unlocked_v1' }`: the gate is documented in a
  comment block for "the linking tool", with real validation deferred behind the demo line. A gate
  as an API contract, not an if-statement.
- Data: bonus course of **48 body-part idioms** in the same `{n, cat, d, ex[2], alt[3]}` shape as
  Idiom-Ville: proof of the contract's portability. The full reading course grafts by swapping the
  array wholesale *(the 50-lesson payload was linked via the gate contract rather than shipped in
  this file)*.
- Embedded narration: a `TTS` registry of **192 `data:audio/mpeg` clips (~3 MB)** keyed per phrase
  (`i0-name`, `i0-def`…): every idiom, definition and example has native-speaker-style audio
  buttons; the registry sits on a single 4.17 MB line.
- Media: 4 webp cover-art covers (3D carousel), png favicon + logo, all base64.
- Engines: WebAudio SFX module (same ensure/resume pattern), fullscreen fire canvas (layered noise +
  parallax), 3D cover carousel with perspective/reflections/shine, score arcs (SVG stroke-dashoffset),
  IntersectionObserver reveals, gold/score HUD.

**The wins:**
- **Shell reuse:** the second course was grafted onto a proven skeleton in a fraction of the first
  build's time. Contracts held; only data and skin changed.
- The gate-contract pattern let content ownership be split without breaking the file.
- TTS-by-embed (rather than speechSynthesis) gives consistent, offline, licensing-clear narration.

**The trade-offs / honest notes:**
- At 4.5 MB some markdown viewers and chat previews refuse the file. Fine for its delivery
  channel; the weight was reported and the channel decided, not a budget.
- Demo password ships in-file (`DEMO_PASSWORD` visible to any reader of the HTML): documented as a
  demo; real validation was the documented next step. Single-file gating is deterrent, not security.
- 192 embedded audio clips are ~70% of the file: in a course like this, audio, not code, is
  where the weight is.

## §3 · 1001 Arabian Nights: `1001-arabian-nights-standalone.html` (14.6 MB · 2,370 lines)

**The brief:** an interactive 3D lyric journey for Chisp's song "1001 Arabian Nights": ride the
magic carpet over dunes, synchronised lyrics, particle genie, fireworks. The heaviest of the
three. (A
provenance sibling, `1001-arabian-nights.html`, holds the pre-inline source layout; the standalone
file is the deliverable.)

**Architecture (from artefacts):**
- Three.js r128 + UnrealBloomPass + EffectComposer inlined (minified blob, `<!--__THREE__-->`-style
  anchors, scene code after passes).
- The file's own header comment is a build log: chase-cam flight over vertex-displaced dunes,
  instanced domes/minarets + cypress city, 3D carpet with woven canvas texture and sine-wave cloth
  ripple, 6000-point audio-reactive starfield, THREE.Points genie, bloom reactive to bass,
  "naturalism pass: gradient sky dome, faceted sunlit dunes, drifting clouds, golden dust, shooting
  stars, contact shadow, cinematic camera, lyric fine-offset calibration ([ and ])".
- `SCENES`: 15 timeline entries `{t, name, pal, fog, hue, sun, sky}` from 0s to 179.1s, written like
  a film treatment; a companion comment records verified section times (verse1 25.5, chorus1 48.1…).
- `LY`: per-line lyric timeline `{sec, badge, lines:[{t, d, x, cls, tok, em, w:[word,startSec]}]}`
  with per-word karaoke times; countdown digits with individual ignition times.
- Media: 10.4 MB mp3 single line (`<audio id="song" src="data:audio/mpeg;base64,…">`, ID3 tags
  intact), 530×530 cover-art png, emoji SVG favicon. Total 14.6 MB.

**The wins:**
- **Measured timestamps:** the comment block says "Lyric timeline MEASURED from this MP3's vocal
  envelope (ffmpeg band-split → onset/valley/minima analysis)": then `[\ /]` calibration hotkeys in
  the engine. Analysis + human final pass = sync that eyeballing never achieves.
- Audio-reactivity through CSS vars (`--bass` in lyric glow) + three.js (bloom pumping) + scene
  palette lerping: three systems, one clock.
- The `SCENES`-as-film-treatment pattern: 15 rows encode the entire art direction of the piece.
- Inlining everything (fonts, three, audio, art) yields a file that *is* the music video: no
  folder, no streaming, works anywhere.

**The costs / honest notes:**
- At 14.6 MB some chat apps, email clients and markdown hosts refuse it. The delivery channel
  decides how it travels (the standalone variant exists precisely because of this); the weight is
  reported, the quality is not cut.
- Report library weight with the rest: three.js r128 is 589 KB minified and the bloom passes about
  15 KB (measured 2026-10-27), so the song, not the code, is most of this file.
- Two `<script>` blobs over 600 KB each: any editor/agent that line-regexes blindly is dangerous.
  The anchor-swap discipline (§ sentinels) is what keeps this file maintainable.

## §4 · Cross-project lessons (the delta each build taught)

| Lesson | Idiom-Ville | Ultra Bookworm | Arabian Nights |
|---|---|---|---|
| Contract before UI | ✅ earned | ✅ reused (graft-in proved it) | ✅ (SCENES/LY shapes) |
| Hand-rolled vs library | hand-rolled won | hand-rolled (fire/carousel) | library necessary (real 3D) |
| Weight | 136 KB | 4.5 MB | 14.6 MB |
| Media currency | one logo | audio clips + covers | full song + art + libs |
| Verification discipline | born here (?v=N, static checks) | boot + gate contract checks | offset probes, anchor swaps |
| Failure record kept | ✅ build log | partially (reconstructed) | in-file header comment |

The meta-lesson: **write the log while building.** §2 and §3 above had to be partially reconstructed
from artefacts: proof that the Idiom-Ville practice of logging decisions as they happen is worth
the ten minutes it costs.
