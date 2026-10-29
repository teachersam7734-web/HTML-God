# Timing: the audio clock, envelopes, unlock, picture in step with sound

## 1. Schedule on the audio clock

* Never time a sound with `setTimeout` or `setInterval`. Timers only wake the scheduler; every start time is on
  `ctx.currentTime` (`start(t)`, `setValueAtTime`, `exponentialRampToValueAtTime`).
* Look-ahead scheduler (`sensei-sfx.js`, `scheduler(stepFn, bpm, stepsPerBeat)`): wake every 25 ms, book everything
  due in the next 100 ms. Measured: 18 steps at 120 bpm, 4 steps a beat, spacing 0.125 s exact to floating point,
  zero late steps, smallest lead 68 to 74 ms.
* Tone.js Transport does the same: 8n callbacks at 120 bpm 0.25 s apart, the callback's `time` about 30 ms ahead of
  the raw context clock. Use that `time` argument inside callbacks, never `Tone.now()` (it includes the 0.1 s
  look-ahead, so comparing against it gives a misleading negative lead).

## 2. Envelopes and level changes

* Exponential ramps cannot start at or reach zero: start at 0.0001, ramp to the peak, ramp to 0.0001, stop the
  node a little later (`env()` in the engine). Every engine sound renders with first and last sample at zero.
* Volume and mute use `gain.setTargetAtTime(v, now, 0.015)`: no zipper noise. Measured: volume 0.25 gives a quarter
  of the RMS of volume 1 (0.00712 against 0.02836); mute gives silence.
* Compare RMS, not peak, across level tests: phase makes a peak with a 4 ms attack lie.
* In an offline test, `setTargetAtTime` at time 0 is still mid-ramp when a sound starts at 0: schedule test sounds
  slightly later (0.1 s).
* `AudioBufferSourceNode` is single-use: cache the decoded `AudioBuffer`, make a new source per play.
* Rapid repeats of one sound phase into harshness: the engine has a 30 ms cooldown per name, and `jitter` varies the
  playback rate of samples (seeded, so renders repeat).

## 3. Unlock (autoplay policy)

A context made before a user gesture starts `suspended`; `resume()` must run inside a gesture handler (`pointerup`,
`touchend`, `click`, `keydown`; iOS Safari wants `touchend`, not `touchstart`). `unlockOnGesture()` does this and
removes its listeners once the state is `running`. Do not `await ctx.resume()` before the first click: outside a
gesture it stays pending. Howler creates `Howler.ctx` lazily and unlocks itself; the first play on iOS must still
come from a touch handler. **Not verified here:** automated Chromium carries user activation from navigation, so a
context starts `running` even with `--autoplay-policy=document-user-activation-required`; the suspended state could
not be reproduced. Confirm on a real phone and in desktop Safari.

Suspend the context when the tab is hidden (`suspendWhenHidden()`); iOS also silences Web Audio with the ringer
switch, by design.

## 4. Picture in step with sound

* **When is a sound heard?** At `t + outputLatency + baseLatency`. `atHeard(t, fn)` waits for
  `currentTime - latency >= t` and fires on the next animation frame. Measured headless: 345 to 358 ms for a 300 ms
  target (the next frame after the target plus a callback). Headless reports `outputLatency` 0: measure on the device.
* **Audio clock as master for a visual beat** (SENSEI-LOG, and `examples/heartbeat.html`): book each beat on the
  audio clock with the look-ahead scheduler and give each beat its own Web Animation whose `startTime` is the beat
  mapped to the document timeline (`performance.now() + (t - currentTime + latency) * 1000`). Measured here: the
  pulse started 1 to 17 ms before `atHeard` saw the beat (the frame granularity of the measurement); the field entry
  measured 1 to 18 ms picture to sound. Fall back to `performance.now()` when the context is missing or suspended;
  stop on `visibilitychange`.
* **Never change the duration of a running infinite CSS animation to follow a tempo**: the browser rescales its
  progress and the picture jumps phase (SENSEI-LOG). One short animation per beat avoids it.
* **`getOutputTimestamp()`** is the API meant for mapping audio time to the page clock, but in headless Chrome its
  `contextTime` and `performanceTime` pairs moved by up to 150 ms between calls in the first seconds after resume
  (measured here), and `currentTime` itself drifted against `performance.now()` early on. Map close to the beat (the
  look-ahead keeps it within 100 ms) and test on the target device.
* **Testing a scheduled start:** `OscillatorNode.frequency.value` reads the default until automation runs, so match
  scheduled starts by pairing them with the beat log, not by reading frequencies (SENSEI-LOG).
* Video with sound: `requestVideoFrameCallback` and the video element's clock (`sensei-lottie-rive-video`). Film
  sound (narration first, mix targets, loudness, mux, captions, the cross-correlation sync test):
  `sensei-video-pipeline`, `references/audio-captions-sync.md`.
