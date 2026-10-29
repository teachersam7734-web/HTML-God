# Narration, audio, captions and sync

Sound design itself (synthesis, SFX catalogues, Web Audio) is `sensei-audio`. This file is the part of sound that
the film pipeline owns: narration timing, the mix targets, the mux, captions and the sync test. Field facts are from
the Save The Damsel films (SENSEI-LOG) unless marked otherwise.

## Narration first

1. Write every line for the whole film. Generate **all** of it in one sitting, before building anything, and keep
   the files: a film half in one voice and half in another is unusable.
2. Measure each line (`timeline.mjs` reads durations with ffprobe) and build absolute beat times from scenes with
   pre-roll, gaps and tails. The picture reads `window.TIMELINE`; captions come out as SRT.
3. Pin reveals to spoken words, not to clip lengths: edge-tts streams word boundaries when asked
   (`boundary="WordBoundary"`, offsets in 100 ns ticks, divide by 1e7); fire the on-screen reveal on the spoken word
   minus about 0.05 s. edge-tts sometimes merges two words into one boundary ("The court"): split and interpolate.
4. Tighten without regenerating: drop a spoken ordinal that is on screen, trim head and tail, cap pauses at about
   0.36 s by cutting the middle of long gaps with 8 ms crossfades, then `atempo=1.08` (pitch preserving, transparent
   at small factors); remap every word boundary through each edit. This took each Damsel film from about 4:28 to
   3:55.
5. A pronunciation fix map (display text versus spoken text) changes the cache key of a TTS line, so expect a re-run
   (reported, Austerlitz).

## Voice provider traps (each cost the Damsel films a pass)

| Trap | Fix |
|---|---|
| ElevenLabs key without `user_read`/`voices_read` scopes: quota and voice search fail with 401 while TTS works | use known premade voice IDs; budget characters yourself |
| ElevenLabs `mp3_44100_192` is Creator tier only (403) | `mp3_44100_128` on lower tiers |
| Quota exhausted mid-batch returns 401 `quota_exceeded`, not 402 or 429 | read the error body; generate everything up front |
| Fish Audio API credit is separate from platform credit (402 on the first call) | make one tiny call before planning on a provider |
| edge-tts 403: the local clock was 3 h 15 min slow, so the token was stale; later the free endpoint returned 403 intermittently, then always | correct the clock skew (measure it from a Microsoft Date header); generate in one sitting |
| Gemini audio MCP sat silent for 30 minutes | keep files short; never block the pipeline on it |
| faster-whisper with new PyAV: `unexpected keyword argument 'metadata_errors'` | decode with ffmpeg to float32 PCM and pass the array |

Every paid call (ElevenLabs and the rest) goes through the plan-hash approval that `guard-process` enforces.

## Listening test by ASR, two passes

Unhinted Whisper flags rare words it cannot spell even when pronounced acceptably. Run a second pass with the
vocabulary as the initial prompt and word probabilities: it separates "unknown word" from "mispronounced word" (all 40
Damsel keys were recognised when hinted). An ASR pass is not a listening test; a person still listens.

## The mix

- Ducking from a smoothed voice-activity mask: music down about 50% and SFX about 35% under speech (Austerlitz shape,
  used in the Damsel films); IR reverb by FFT convolution; a tanh soft clip; two-pass loudnorm.
- Measured balance in the Damsel films: voice about -17 dB RMS while speaking, the music bed about 21 dB under it and
  about 8 dB up in the gaps. The first pass had the bed 26 dB under and it was inaudible: measure stems, do not guess.
- Targets: about -14 LUFS integrated for the web (-16 also used; both Damsel films are -16.0 LUFS, -1.5 dBTP), true
  peak at or below -1.5 dBTP. `audio.mjs normalize` does the two-pass loudnorm (tested: -14.05 LUFS from a synthetic
  mix). lemo-opuscar's mux refuses partial or damaged audio (reported); ours refuses to overwrite its sources.
- Place each SFX so its measured peak, not the file start, lands on the event; about 0.03 s before a visual contact
  (claude-animation-skill, reported).
- Free disk: float WAV stems (about 90 MB each) and pre-loudnorm mixes are regenerable; delete them after measuring.

## Sync test

Cross-correlate picture motion energy against audio onset strength over a window (30 Hz series). The Damsel films
measured 0 ms over the whole film and in middle and end windows; one opening showed -200 ms because the whoosh
deliberately leads the hit. **Trap**: "frame of maximum change versus loudest onset" inside a short window is not a
sync test; it picked the wrong event and reported +533 ms on a perfectly synced hit.

## Captions

- Ship captions as a `mov_text` track in the MP4 and as a separate `.srt` (`render.mjs --srt` or `audio.mjs mux
  --srt`, tested), plus a transcript on the page when there is narration.
- Hold each caption at least 1.8 s and at least the speech plus 0.6 s, without overlapping the next (lemo-opuscar
  rule; `timeline.mjs` applies it, tested).
- Keep important picture above the caption band (a safe area), and the story should still work muted.
- Text on screen is verbatim from the script; never invent numbers or quotes.

## Delivery facts (Damsel films, reported)

Masters 1920x1080, 30 fps, H.264 High CRF 14, AAC 256k, 3:55 and 3:57. Spelling of all 40 keys checked on a contact
sheet of master frames taken just after each word lands. A render that exits 0 proves nothing: the sheet of the
master is what gets looked at.
