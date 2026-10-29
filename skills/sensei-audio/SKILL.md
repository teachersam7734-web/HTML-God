---
name: sensei-audio
description: Sound for HTML pages, courses, games and presentations with the Web Audio API. Procedural interface sounds (click, toggle, whoosh, chime, success, error, impact), sampled sounds baked, compressed and inlined into one offline file, scheduling on the audio clock, unlocking audio after a gesture, mute and volume that persist, captions so sound is never the only feedback, sound in one shared room (materials, reverb, distance), spatial audio, a visual pulse in step with sound, Howler, Tone.js, ZzFX and jsfxr, and the licences of recorded sound-effect libraries. Use when the user says sound, SFX, sound effects, audio, Web Audio, click sound, UI sounds, beep, chime, whoosh, game sounds, background music, mute button, autoplay, reverb, spatial audio, Howler, Tone.js, ZzFX, jsfxr, sound in sync with animation, or where do I get free sound effects.
---

> **Codex:** If `${CLAUDE_PLUGIN_ROOT}` is unset, resolve it as `../..` from this skill's folder. Treat `html-god`, `html-sensei` and `html-package` prefixes as references to the same bundled sibling skills. Use available Codex tools. Claude agent names refer to `agents/*.md` prompts; they are not registered Codex agents. Automatic hooks are off: run `skills/sensei-verify/scripts/verify.mjs` manually. See `docs/COMPATIBILITY.md` at the plugin root.

# sensei-audio

Doctrine first: best quality is the default, no page-weight budget unless the user asks, never downgrade because this
machine is slow, and say plainly what was not verified. **Nothing here was listened to.** Every number below was
measured from rendered samples (OfflineAudioContext) or the live audio clock in headless Chrome; how it sounds must be
judged by a person on real speakers, headphones and phones.

## 1. When to use

Any page, course, game or deck that makes sound: interface feedback, game effects, ambience, a generative score, a
beat that the picture follows, and the controls and captions that make sound safe to ship.

| The job is | Skill |
|---|---|
| Film sound: narration first, mix and ducking, loudness to -14 or -16 LUFS, mux, captions, the sync test | `sensei-video-pipeline` (its `references/audio-captions-sync.md` and `scripts/audio.mjs`) |
| Sound on a video, Lottie or Rive element; `requestVideoFrameCallback` | `sensei-lottie-rive-video` |
| The timing and choreography of motion that the sound accents | `sensei-motion-graphics` |
| A game loop, input and state around the sounds | `sensei-games` |
| Packing the deliverable into one file | `sensei-single-file` |

## 2. Decision table

| Choice | Pick | What decides it |
|---|---|---|
| Source of a sound | synthesise (`sensei-sfx.js`) | interface feedback; nothing to license; a few KB |
| | bake and inline (`bake-sfx.mjs`) | the same sound on every browser; many plays; a sound designed once |
| | recorded library | realism a synth cannot give; a ledger row each ([sources-and-licences](references/sources-and-licences.md)) |
| | generated (ElevenLabs and others) | bespoke one-shots; paid: approved plan first |
| Library | none (own engine) | courses, dashboards, landing pages |
| | Howler | games with many overlapping samples and sprites |
| | Tone.js | music and generative scores (345 KB) |
| | ZzFX or jsfxr | retro and arcade effects stored as a few hundred bytes |
| Format | Opus in Ogg | Chromium and Firefox, smallest |
| | AAC in m4a | Safari |
| | WAV | clicks under 10 ms; loops (with Opus or Vorbis); never MP3 or AAC for loops |
| Long audio | `<audio>` element | narration and music files: streams, controls, captions |
| Space | `StereoPannerNode` | 2D interface: pan from the element's position |
| | `PannerNode` HRTF | 3D scenes |
| | `sensei-room.js` | every sound in one world: shared room, send by distance |
| Picture and sound in step | audio clock as master | a beat, a hit, a pulse (`examples/heartbeat.html`) |
| | media element clock | narrated video (`sensei-video-pipeline`, `sensei-lottie-rive-video`) |
| First load | muted | any page that would otherwise make sound before the user asked |

## 3. Core technique

### 3.1 The engine

```html
<script src="sensei-sfx.js"></script>   <!-- inline it for one file; CC0 -->
<script>
const sfx = SenseiSFX.create({ storageKey: 'my-course-sound', startMuted: firstVisit, seed: 1 });
sfx.unlockOnGesture(document);          // resume() inside the first pointerup, touchend, click or keydown
sfx.suspendWhenHidden();
button.addEventListener('click', () => sfx.play('success', { caption: 'Correct answer', flash: () => mark(button) }));
soundSwitch.addEventListener('click', () => { sfx.toggleMute(); render(); });   // aria-pressed, remembered
</script>
```

Sounds: `click tick pop toggleOn toggleOff whoosh whooshDown chime success error impact type`. `play()` returns the
time the sound ends. `caption` goes to a polite live region and `flash` runs a visual cue even when muted, so sound
is never the only feedback. Under reduced motion `calmSkip` (whoosh, whooshDown, impact) are not played; captions
and confirmations stay. Every random choice comes from `seed`. A worked page: [examples/sfx-ui.html](examples/sfx-ui.html).

### 3.2 Time everything on the audio clock

```js
const sc = sfx.scheduler((step, t) => sfx.play('tick', { when: t }), 120, 4);   // wakes every 25 ms, books 100 ms ahead
sc.start();
sfx.env(gainNode, t, peak, attack, decay, hold, release);                       // exponential, from and to 0.0001
sfx.atHeard(t, () => flash());                                                   // when the sound reaches the speaker
```

Never `setTimeout` a sound. Never ramp exponentially to zero. Volume through `setTargetAtTime`. Cache decoded
buffers, not sources. Unlock, latency and picture sync: [references/scheduling-and-sync.md](references/scheduling-and-sync.md).

### 3.3 Picture in step with sound (audio clock as master)

```js
function pump() {
  while (nextT < ctx.currentTime + 0.1) {                 // look-ahead
    lubDub(nextT);                                        // sound booked on the audio clock
    const a = heart.animate(pulseKeyframes, { duration: 520 });
    a.startTime = performance.now() + (nextT - ctx.currentTime + ctx.outputLatency + ctx.baseLatency) * 1000;
    nextT += 60 / bpm;
  }
}
```

One short animation per beat (never retime a running infinite CSS animation: its progress rescales and the pulse
jumps phase). Measured: the pulse starts within 17 ms of the beat being heard. Full page: [examples/heartbeat.html](examples/heartbeat.html).

### 3.4 One room for every sound

```js
const room = SenseiRoom.create(sfx.ctx, { t60: 1.1, predelay: 0.012, ceilingDb: -8, destination: sfx._master() });
room.glass(t, { dist: 0.3 }); room.wood(t, { dist: 0.7 }); room.airFromCurve(t, cameraSpeeds, 1.6);
```

Inharmonic partials plus a noise transient, one shared synthetic room, send by distance, peaks at or under -8 dBFS,
fewer sound events than visual beats. Why and how: [references/room-and-mix.md](references/room-and-mix.md).

### 3.5 Bake, compress, inline

```bash
FFMPEG=/path/to/ffmpeg node scripts/bake-sfx.mjs --out baked --names click,pop,success --codecs opus,aac,wav
```

Renders offline, trims the tail, encodes, proves every file decodes in Chrome, writes `sfx-data.js` with data URIs.
Choose per browser; load with `sfx.loadSample(name, dataUri)`. Sizes and the four libraries:
[references/formats-and-libraries.md](references/formats-and-libraries.md).

## 4. Recipes

| Recipe | File | Status |
|---|---|---|
| Procedural and sample engine: library, mute, volume, seed, reduced motion, scheduler, atHeard, captions | [scripts/sensei-sfx.js](scripts/sensei-sfx.js) | run |
| Sound in a room: materials, shared reverb, distance sends, curve-driven air | [scripts/sensei-room.js](scripts/sensei-room.js) | run |
| Interface sound done safely (muted first visit, switch, volume, captions, reduced motion) | [examples/sfx-ui.html](examples/sfx-ui.html) | run |
| Visual pulse on the audio clock, tempo change, fallback, reduced motion | [examples/heartbeat.html](examples/heartbeat.html) | run |
| Bake, trim, encode (Opus, AAC, Vorbis, MP3, WAV), decode check, data-URI script | [scripts/bake-sfx.mjs](scripts/bake-sfx.mjs) | run |
| Howler, Tone, ZzFX, jsfxr in one offline page, checked | [scripts/test-libs.mjs](scripts/test-libs.mjs) | run |
| The test of everything above (except the two scripts with their own runs) | [scripts/test-audio.mjs](scripts/test-audio.mjs), [scripts/tests/engine.html](scripts/tests/engine.html) | run |
| Browser and ffmpeg discovery | [scripts/pw.mjs](scripts/pw.mjs) | run |

## 5. Quality bars

1. **No clicks:** every sound's first and last sample is 0 (offline render).
2. **No clipping:** peaks under 1.0 (engine loudest 0.71); room palette at or under -8 dBFS.
3. **Timing:** no timer-timed sound; scheduler steps exact and never late; picture within one frame of the beat.
4. **Control:** a visible, labelled, keyboard-reachable sound switch (`aria-pressed`) and volume on every page that
   makes sound; the choice persists; muted on first visit when anything would play on its own; never autoplay music
   with sound.
5. **Never sound-only:** every meaningful sound has a caption or visual equivalent; speech has captions.
6. **Reduced motion:** whooshes and impacts dropped, confirmations kept (there is no "prefers less sound" query).
7. **Offline:** samples inlined; zero requests outside `file:`, `data:`, `blob:`.
8. **Licences:** a ledger row for every recorded or generated sound; required credits visible on the page.
9. **Listening:** a person has listened on speakers, headphones and a phone before release; say so if not.

## 6. TRAPS

Each: symptom, cause, fix, how it was found.

1. **No sound on first click on a phone.** The context starts suspended; `resume()` outside a gesture stays pending;
   iOS wants `touchend`. Fix: `unlockOnGesture()`; never await `resume()` before the first gesture. Found: reported
   (autoplay policy); not reproducible headless (trap 2).
2. **Autoplay tests pass and prove nothing.** Automated Chromium carries user activation from navigation, so a
   context is `running` even under `--autoplay-policy=document-user-activation-required`. Fix: confirm on a real phone
   and in Safari. Found: tested (lane).
3. **Sound drifts against the beat or bunches up.** Timed with `setTimeout`. Fix: the look-ahead scheduler. Found:
   tested (spacing exact to floating point, zero late steps).
4. **Click at the start or end of a sound.** Exponential ramps cannot start at or reach zero; a sound that stops at
   full level clicks. Fix: `env()` from and to 0.0001, stop slightly later. Found: tested (every sound starts and
   ends at 0).
5. **Zipper noise on volume.** Jumping a gain value. Fix: `setTargetAtTime(v, now, 0.015)`. Found: tested.
6. **The "limiter" makes quiet sounds louder.** `DynamicsCompressorNode` adds automatic make-up gain: a 0.1 sine
   came out at 0.246 through threshold -30, ratio 20. Fix: keep the ceiling by level design; treat the compressor as
   colour. Found: tested here.
7. **The reverb is inaudible.** `ConvolverNode.normalize = true` applies the browser's calibration; the room
   returned almost nothing. Fix: unit-energy impulse, `normalize = false`, an explicit wet level. Found: tested here.
8. **Peak level tests disagree with the volume.** Phase: a 4 ms attack can peak near zero. Fix: compare RMS (volume
   0.25 gave exactly a quarter of the RMS). Found: tested.
9. **An offline test sound starts mid-ramp.** `setTargetAtTime` at time 0. Fix: schedule test sounds at 0.1 s.
   Found: tested (lane).
10. **Second play of a sound throws or is silent.** `AudioBufferSourceNode` is single-use. Fix: cache buffers, new
    source per play. Found: reported.
11. **Rapid repeats sound harsh.** Identical sounds stacking in phase. Fix: 30 ms cooldown per name, seeded `jitter`.
    Found: reported (lane).
12. **Two renders of the "same" sound differ.** `Math.random` in the engine (the lane's typewriter and jitter). Fix:
    the seeded generator. Found: tested here (same seed, same samples).
13. **Pulse and sound out of step after a tempo change.** Changing the duration of a running infinite CSS animation
    rescales its progress. Fix: one Web Animation per beat with `startTime` on the audio clock. Found: tested
    (SENSEI-LOG, 1 to 18 ms measured there; 1 to 17 ms here).
14. **The audio-to-page clock mapping jumps.** In headless Chrome `getOutputTimestamp()` pairs moved by up to 150 ms
    between calls, and `currentTime` drifted against `performance.now()` for the first seconds. Fix: map each beat
    when it is booked (within the 100 ms look-ahead) and measure on the target device. Found: tested here.
15. **A scheduled-start test reads the wrong frequency.** `OscillatorNode.frequency.value` shows the default until
    automation runs. Fix: pair starts with the beat log. Found: tested (SENSEI-LOG).
16. **`atHeard` fires early on real hardware or late in headless.** It adds `outputLatency + baseLatency`; headless
    reports 0. Fix: measure on the device. Found: tested (345 to 358 ms for a 300 ms target here).
17. **Loop has a gap.** MP3 and AAC add encoder delay and padding. Fix: Opus, Vorbis or WAV for loops. Found:
    reported (lane).
18. **Sound silent in Safari.** Opus in Ogg is not decodable by older Safari. Fix: AAC in m4a beside Opus. Found:
    reported; Safari not tested.
19. **A 2 s click weighs 176 KB.** Untrimmed renders. Fix: trim to the sound's end (`bake-sfx.mjs`: 7.6 KB WAV,
    653 B Opus). Found: tested here.
20. **ZzFX plays before any gesture, or cannot be tested.** `ZzFXMicro` makes an `AudioContext` at load. Fix: the ES
    module, resume `ZZFX.audioContext` on a gesture. Found: tested (lane).
21. **ZzFX inline script fails.** It is an ES module with `export`. Fix: `type="module"` or strip `export`. Found:
    tested.
22. **ZzFX and jsfxr sounds change every run.** ZzFX randomness defaults to 0.05; `sfxr.generate` is random. Fix:
    randomness 0; store jsfxr definitions. Found: tested.
23. **Tone callbacks look late.** `Tone.now()` includes the 0.1 s look-ahead. Fix: use the callback's `time`. Found:
    tested (lane).
24. **Howler silent on iOS until a touch.** `Howler.ctx` and its unlock are lazy. Fix: first play from a touch
    handler. Found: reported.
25. **An inlined library ends the page early.** `</script` inside its text. The lane's escape replaced the string
    with itself. Fix: write `<\/script` (`test-libs.mjs`). Found: read here.
26. **A sound plays after the user left the screen.** A media element removed from the DOM keeps playing; the context
    keeps running in a hidden tab. Fix: pause media on route change (SENSEI-LOG), `suspendWhenHidden()`. Found: tested
    (SENSEI-LOG).
27. **iOS stays silent with the ringer switch off.** Web Audio follows it, by design. Fix: none; captions carry the
    meaning. Found: reported.
28. **A free sound turns out not to be free.** BBC (non-commercial), Google Actions (only for Actions), Freesound
    CC-BY-NC, Sampling+, Mixkit or Sonniss inside a template given to others. Fix: the licence table and the ledger.
    Found: reported (licences read).
29. **Onetake code in a project.** Its licence is noncommercial. Fix: ideas only; `sensei-room.js` is original.
    `guard-licence.mjs` blocks onetake code. Found: reported.
30. **Paid sound generation runs without approval.** Fix: `.sensei/plan.md`, the user's yes, `lib/approval.mjs`.
    `guard-process.mjs` blocks known paid APIs called from the shell; it cannot see MCP tool calls. Found: read here.
31. **Gemini audio analysis hangs for 30 minutes.** Fix: short files; never block the build on it. Found: tested
    (SENSEI-LOG).

## 7. Licences

| May be used in projects | Never shipped in the plugin | Ideas only |
|---|---|---|
| `sensei-sfx.js`, `sensei-room.js` (CC0); Howler, Tone, ZzFX (MIT), jsfxr (Unlicense), each with its notice and a ledger row; Kenney (CC0); Sonniss, Mixkit, Pixabay inside a finished product; OpenGameArt and Freesound CC0 or CC-BY with credits | recorded sound files of any library; React Bits sounds (project use only); Howler, Tone, ZzFX and jsfxr builds (installed in the work folder, not vendored) | onetake's sound notes (PolyForm Noncommercial) |

Full table: [references/sources-and-licences.md](references/sources-and-licences.md). All code in this skill is
original to this project.

## 8. Verification

```bash
node scripts/test-audio.mjs                                            # engine, room, examples
FFMPEG=<ffmpeg> node scripts/bake-sfx.mjs --out baked                   # encode and decode every codec
cd work && npm i howler@2.2.4 tone@15.1.22 zzfx@1.4.0 jsfxr@1.4.1 && node ${CLAUDE_PLUGIN_ROOT}/skills/sensei-audio/scripts/test-libs.mjs
```

Verified (Windows 10, Node 24, Playwright 1.63, Chrome 155 headless, ffmpeg 7.1 passed through `FFMPEG`):

- `test-audio.mjs`: 32 checks pass. Engine: all 12 sounds start and end at 0, loudest peak 0.71, mute silent, volume
  0.25 gives RMS 0.00712 against 0.02836, pan -1 left only, seeds repeat, reduced motion drops the whoosh; HRTF
  energy 833/280 left, 281/835 right. Room: impulse -60.2 dB at T60, peaks 0.04 to 0.35 (ceiling 0.398), more room
  share far than near, curve followed. Live: scheduler exact, 0 late, smallest lead 68 to 74 ms; `atHeard` 345 to
  358 ms for 300 ms. `sfx-ui.html`: muted first, keyboard toggle persists over reload, captions, volume, reduced
  motion, no network. `heartbeat.html`: pulse 1 to 17 ms before the beat is heard, exact spacing after a tempo change,
  Stop works, reduced motion uses no scale pulse.
- `bake-sfx.mjs`: 45 of 45 files (9 sounds, 5 codecs) decode in Chrome; sizes in the formats reference.
- `test-libs.mjs`: 8 checks pass in one 446 KB offline page with no external request.

Not verified: **anything audible** (no listening); Safari, Firefox, iOS and Android; real autoplay suspension; real
output latency; HRTF by ear; Howler and Tone on iOS; Zapsplat terms.

## 9. Carried by

- **Agent:** `sensei-sound-designer` (picks the sound map, writes the engine config, bakes, runs the offline checks,
  keeps the ledger); `sensei-film-renderer` for film sound; `sensei-reviewer` (read-only gates).
- **Hooks** (in `plugin/hooks/`):
  - `guard-licence.mjs` (PreToolUse, Write and Edit): onetake and other ideas-only code; never-ship sources in the
    plugin.
  - `guard-process.mjs` (PreToolUse, Bash): paid generation (ElevenLabs and others) without an approved plan.
  - `guard-secrets.mjs`: API keys in files or echoed.
  - `lint-web.mjs` (PostToolUse): `no-cdn` for offline pages, `web-animations` reduced-motion path,
    `vendored-without-notice` for an inlined library.
  - `lint-determinism.mjs`: media playback in a seek page.
  - `gate-claim.mjs` (Stop): a "done" claim with no fresh gate report.
  - No hook yet checks an `AudioContext` without an unlock path or a mute control, timer-timed sounds, or audio files
    without a ledger row (reported to the hook owner); `test-audio.mjs`-style checks cover them when run.
