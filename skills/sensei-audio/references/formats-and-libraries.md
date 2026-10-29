# Formats, inlining, and the four libraries

## 1. Baked samples: sizes and choices

`scripts/bake-sfx.mjs` renders engine sounds offline at 48 kHz mono, trims the silent tail, encodes, and proves every
file decodes in Chrome. Measured (bytes, ffmpeg 7.1):

| sound | WAV | Opus 48k | AAC 64k | Vorbis q3 | MP3 96k |
|---|---|---|---|---|---|
| click | 7,630 | 653 | 1,819 | 4,125 | 1,772 |
| pop | 12,908 | 1,270 | 2,232 | 4,254 | 2,348 |
| whoosh | 48,046 | 2,595 | 5,266 | 7,132 | 6,668 |
| chime | 138,668 | 10,021 | 12,769 | 10,934 | 18,188 |
| success | 163,148 | 12,800 | 15,210 | 14,441 | 21,068 |

All 45 files of the nine default sounds decoded with `decodeAudioData`. Without trimming (the lane's 2 s renders) a
click was 176 KB as WAV and 24.8 KB as MP3: trim first.

| Need | Format |
|---|---|
| Chromium and Firefox | Opus in Ogg (smallest) or Vorbis |
| Safari | AAC in m4a (older Safari cannot decode Opus in Ogg; Safari was not tested here) |
| A loop | Opus, Vorbis or WAV: MP3 and AAC add encoder delay and padding, so the loop point gaps |
| A click under 10 ms | WAV is fine |
| Identical output everywhere | bake once and ship samples, instead of synthesising in each browser |

Inline as `data:audio/...;base64,...` (the generated `sfx-data.js`), decode once with `decodeAudioData`, keep the
`AudioBuffer`, and give it to the engine (`sfx.loadSample(name, dataUri)`). Base64 costs a third more than the file.
Narration and long audio: a plain `<audio>` element (streams, has controls, takes captions); Web Audio for effects.

## 2. Libraries (tested in one 446 KB offline page, zero external requests)

| Library | When | Recipe and traps |
|---|---|---|
| Own engine (`sensei-sfx.js`) | interface feedback in a course, dashboard or landing page | no library needed |
| Howler.js | a game with many overlapping one-shots, sprites | `new Howl({ src: ['data:audio/wav;base64,...'], sprite: { a: [0, 150] } })`; sprite `a` ended after 153 ms; `stereo()`, `pos()`, `Howler.mute()`, `Howler.volume()` work; `Howler.ctx` is null until first use |
| Tone.js | music, generative score | `await Tone.start()` inside a gesture; `Tone.Offline(() => {...}, seconds)` bakes a bed (a note scheduled at 0.25 s rendered from 0.2501 s); Transport callbacks take their `time` argument |
| ZzFX | tiny parametric game sounds | use the full ES module: `ZZFX.buildSamples(...params)` gives samples without an audio device (41,454 samples, 0.94 s); deterministic only with randomness 0 (the default 0.05 is random); `ZZFX.volume` default 0.3; raw samples reach full scale |
| jsfxr | retro sfxr sounds | `sfxr.toWave(def).dataURI` (8 KB WAV); the same definition gives the same bytes, `sfxr.generate()` is random each call: store the definition (121 characters as base58), not the WAV |

Traps:
1. `ZzFXMicro` creates `new AudioContext` at load: suspended before any gesture, and a global that tests cannot
   replace. Use the ES module and resume `ZZFX.audioContext` on a gesture.
2. `ZzFX.js` is an ES module: inline it as `<script type="module">` (works from `file://`) or strip its `export`
   keywords (as `test-libs.mjs` does).
3. Inlining a library: escape `</script` inside its text. The lane's test replaced `</script` with the same text (a
   no-op); `test-libs.mjs` writes `<\/script`. Found: read here.
4. Tone is 345 KB: for music only. Bake with `Tone.Offline` and ship a file when the score does not need to react.
