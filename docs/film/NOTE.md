# HTML God introduction

A 60-second, 1920×1080, 30 fps launch film. Final output: ../assets/intro.mp4 (H.264 video and AAC stereo). The editable deterministic composition is index.html + film.js; player.html provides play, pause and seek controls. The source draws perspective-projected 3D polyhedra and particles, authored transitions, and typography from a pure seconds clock.

## Production

Eight storyboard beats have a duration coefficient of variation of 0.35 and a designed rest of 7%. The storyboard gate passes. A 3-second hardest-beat render was inspected before the master. The source probe reproduced 20/20 selected frames in and out of order, including hand-offs. The final camera move was revised after the initial ending failed the maximum-hold gate; only its final chunk was re-rendered.

The final MP4 is exactly 60.000 seconds, with 1,800 frames. Scripted film gates G0 (duration/media), G2 (no empty frames), G3 (ending timing) and G5 (page chrome) pass. G5 cannot inspect text painted on canvas. G1 readability and G4 hierarchy were reviewed from the keyframes/contact sheet: the headline is the primary focal point, with the 3D motif carrying each chapter. The final repository address remains inside the safe area. See contact-sheet.jpg.

## Sound

The custom 8-second ElevenLabs SFX was generated with eleven_text_to_sound_v2 in flow l4oLz9wHVlN1vNVtEVj8, session AV65Tf6tOAduNxhn0ZVL. The prompt requests a warm sub-bass reveal, titanium assembly clicks, crystalline particles, a rising stereo energy whoosh and resonant metal/glass decay, without voices or melody. One generation completed; three proposed variations were rate-limited and were not retried.

score.py synthesizes an original 60-second stereo underscore. The generated SFX is placed at the opening and at 18, 42 and 53 seconds. The encoded master measures -15.43 LUFS integrated, -2 dBTP true peak and 6.1 LU loudness range, appropriate for the approximately -16 LUFS mix. The file contains no narration. No claim of listening on physical speakers/headphones is made; the user should audition it on the intended playback device.

## Limits

Rendered using the local Chrome/FFmpeg pipeline. Measured software-renderer speed is not target-device performance. The film does not prove live plugin installation, external service availability, or the quality of arbitrary future agent builds. Original authored scene/score; Manrope OFL and the toolkit's Apache-2.0/NOTICE are preserved. No external video/character footage or proprietary 3D assets are copied.
