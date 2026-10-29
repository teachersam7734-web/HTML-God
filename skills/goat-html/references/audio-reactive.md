# Audio-Reactive: WebAudio, band splitting, lyric engines

The Arabian Nights discipline: the music is the timeline, the visuals are the orchestra. Everything
in this file shipped in a 14.6 MB single file. Deeper (procedural and sampled SFX, mixing,
audio-visual sync): `html-sensei:sensei-audio`.

---

## §1 · Two ways sound enters the file

| Mode | How | Use |
|---|---|---|
| Embedded track | `<audio src="data:audio/mpeg;base64,…">` | music-driven pieces |
| Synthesised | WebAudio oscillators (`interaction.md` §4) | SFX, UI sounds: zero bytes |

The two coexist (Ultra Bookworm: embedded narration + synthesised UI sounds). Create/resume the
`AudioContext` on first user gesture: always.

## §2 · Band splitting (the reactive core)

```js
const AC = new (window.AudioContext||window.webkitAudioContext)();
const src = AC.createMediaElementSource(document.getElementById('song'));
const an  = AC.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = .82;
src.connect(an); an.connect(AC.destination);
const freq = new Uint8Array(an.frequencyBinCount);
function bands(){
  an.getByteFrequencyData(freq);
  const avg = (a,b) => { let s=0; for(let i=a;i<b;i++) s+=freq[i]; return s/(b-a)/255; };
  return { bass: avg(0,10), mid: avg(10,100), treble: avg(100,256) };
}
```

- `smoothingTimeConstant` ~0.8 makes bands musical instead of jittery.
- Drive CSS vars every frame: `document.documentElement.style.setProperty('--bass', b.bass)`: then
  CSS does the reacting (text glow radius, cover scale, hue rotation) with zero JS per element.
- Drive three.js: `bloom.strength = .7 + bass*.9`, star jitter `+= bass*.003` (`webgl.md` §3).

## §3 · The timeline (musical time, not wall time)

```js
const SCENES = [ {t:0,name:'the desert awaits',pal:[…],fog:0x0a0a24,hue:45,sky:'dawn'}, … ];
const LY = [ {sec:'v1', lines:[ {t:25.51, d:3.45, x:'Come join this trip', tok:1, em:'🏜️',
              w:[['Come',25.51],['join',25.86],['this',26.21],['trip',26.56],['(This trip)',27.35]]} ]} ];
```

- One entry per "shot"/section with its palette; one entry per lyric line with duration; optional
  per-word times for karaoke fills.
- Each frame: `song.currentTime` → binary-search/pointer-walk the arrays → trigger changes.
- Lerp between scene palettes over ~1.5s for cinematic cross-fades instead of hard cuts.

## §4 · Timestamps you can trust

Eyeballed timestamps are wrong by half a second and it *shows*. The measured pipeline:

```bash
# isolate vocals from the real audio, then find onsets/valleys/minima per band
ffmpeg -i song.mp3 -af "highpass=f=200,lowpass=f=3000" vocals.wav
ffmpeg -i song.mp3 -af "lowpass=f=150" bass.wav
# then a node/python pass: local energy minima = line starts; strong peaks = beat hits
```

- Line starts land on energy valleys (silence between phrases), not peaks.
- Final calibration pass: listen at 2 to 3 suspect lines, nudge ±0.1 to 0.2s. (Arabian Nights supports
  `[` / `]` hotkeys to nudge the active line while previewing: build this into every lyric tool.)
- Store final times as plain numbers in `LY`; the analysis scripts are build-time tools, not runtime.

## §5 · Lyric rendering choreography

- Feed container with mask gradient (lines fade at top/bottom); lines absolutely positioned.
- Line states: `.active` (full color/glow/scale), `.done` (faded above), upcoming (hidden below).
- Karaoke fill: per-word gradient `background-size:0%→100%` transition triggered at word time.
- Countdown digits ignite individually on their sung beats (`.tok.lit` at per-digit times).
- One `--bass` CSS var drives glow radius on the active line: the words *pulse* with the vocal.
- Reduced motion: lyrics still advance and highlight on time; the pulsing, scaling and camera
  motion stop.

## §6 · Symptom → Fix

| Symptom | Cause | Fix |
|---|---|---|
| `createMediaElementSource` throws twice | created per play | create once, reuse |
| Silence after first play | ctx suspended / src re-created | resume on gesture (§2) |
| Bands jitter violently | smoothing too low | 0.8+ smoothing |
| Lyrics drift over the song | wall-clock timing | use `currentTime`-driven pointer |
| Visual pulse feels late | reading bands in a separate loop | read in the render loop itself |
| Whole file feels chaotic | every element reacting | pick 3 to 5 reactive elements max |
