# HTML God introduction

A 60-second, 1920×1080, 30 fps launch film. Final output: ../assets/intro.mp4 (H.264 video and AAC stereo). The editable deterministic composition is index.html + film.js; player.html provides play, pause and seek controls. The source draws perspective-projected 3D polyhedra and particles, authored transitions, and typography from a pure seconds clock.

## Production

Eight storyboard beats have a duration coefficient of variation of 0.35 and a designed rest of 7%. The storyboard gate passes. A 3-second hardest-beat render was inspected before the master. The source probe reproduced 20/20 selected frames in and out of order, including hand-offs. The final camera move was revised after the initial ending failed the maximum-hold gate; only its final chunk was re-rendered.

The final MP4 is exactly 60.000 seconds, with 1,800 frames. Scripted film gates G0 (duration/media), G2 (no empty frames), G3 (ending timing) and G5 (page chrome) pass. G5 cannot inspect text painted on canvas. G1 readability and G4 hierarchy were reviewed from the keyframes/contact sheet: the headline is the primary focal point, with the 3D motif carrying each chapter. The final repository address remains inside the safe area. See contact-sheet.jpg.

## Sound

The custom 8-second ElevenLabs SFX was generated with eleven_text_to_sound_v2 in flow l4oLz9wHVlN1vNVtEVj8, session AV65Tf6tOAduNxhn0ZVL. The prompt requests a warm sub-bass reveal, titanium assembly clicks, crystalline particles, a rising stereo energy whoosh and resonant metal/glass decay, without voices or melody. One generation completed; three proposed variations were rate-limited and were not retried.

score.py synthesizes an original 60-second stereo underscore. The generated SFX is placed at the opening and at 18, 42 and 53 seconds.

The repository owner supplied Voiceover.mp3 for narration. Its original bytes are preserved at the repository root; narration-source.json records provenance and checksum. Local speech recognition confirmed the script and supplied word timings. Eight phrase groups are placed at the corresponding scene changes using narration-timeline.json, with cuts inside measured pauses and no change to speaking speed.

The music/SFX bed is lowered and automatically ducked beneath speech. The final AAC master measures -16.01 LUFS integrated, -3.65 dBTP true peak and 5.6 LU loudness range. Both video and audio are exactly 60.000 seconds. The H.264 stream was copied without re-encoding and its SHA-256 matched before and after the mix. All 1,800 original frames remain. See ../assets/intro-audio-report.json.

English captions are included as a selectable MP4 track, ../assets/intro.en.srt, and synchronized captions in player.html. The player also includes a transcript. Browser checks covered playback, pause, seeking, mute, captions, mobile width, and the MP4 link. No claim of listening on physical speakers/headphones is made.

## Rebuild the narrated film

With FFmpeg installed, run `node docs/film/mix-narration.mjs` to rebuild the narrated mix and replace the MP4 audio while preserving its video stream. This uses Voiceover.mp3, narration-timeline.json, the caption file, and docs/film/mix-normalized.wav. To regenerate the music bed and full visual render from a fresh checkout, run `node docs/film/build.mjs --prepare --render` (also requires Python and the browser rendering tools). The prepare step includes narration automatically.

## Limits

Rendered using the local Chrome/FFmpeg pipeline. Measured software-renderer speed is not target-device performance. The film does not prove live plugin installation, external service availability, or the quality of arbitrary future agent builds. Original authored scene/score; Manrope OFL and the toolkit's Apache-2.0/NOTICE are preserved. No external video/character footage or proprietary 3D assets are copied.
