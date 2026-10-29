# Video inside pages in depth

Measured with `scripts/test-video.mjs` and `scripts/ffmpeg-recipes.mjs` (Windows 10, Chrome 155 headless over
strict `file://`, ffmpeg 7.1 essentials build passed through `FFMPEG`). All clips are synthetic (`testsrc2`,
frame-coded colour fields), so **sizes are indicative only**; real footage differs. Nothing was tested in Safari or
Firefox or on a phone. Turning a page INTO a video is `sensei-video-pipeline`; this file is video in a page.

## 1. Codecs in this Chrome

`canPlayType`: H.264 probably, VP9 probably, AV1 probably, Opus and AAC probably, **HEVC (`hvc1`) "no"**, and the
HEVC clip failed to load with MediaError 4. HEVC in Chrome depends on the machine's hardware or OS decoder: never
ship HEVC as the only source. From general knowledge (not tested): Safari plays HEVC including alpha on Apple
hardware and added VP9 and AV1 only on recent systems.

## 2. Markup

```html
<video autoplay muted loop playsinline preload="metadata" poster="poster.webp" disablepictureinpicture aria-hidden="true">
  <source src="hero.webm" type='video/webm; codecs="vp9"'>   <!-- preferred first; AV1 MP4 is the smallest option -->
  <source src="hero.mp4"  type="video/mp4">                   <!-- H.264 last: plays everywhere -->
</video>
```

`muted` must be in the markup (or set before `play()`); `playsinline` for iOS; strip audio (`-an`) from backgrounds.
Handle `play()` rejection (low-power mode, data saver) by leaving the poster: `v.play().catch(() => v.classList.add('is-static'))`.
Anything that moves on its own for more than 5 s needs a visible pause control (WCAG 2.2.2).
`examples/hero-video.html` does all of it, plus reduced motion and the hidden-tab pause.

A `<source media>` that does not match fires `error` at that `<source>`: listen for `error` on the LAST source only,
and on the video for decode failures (SENSEI-LOG). A `<video>` removed from the DOM keeps playing its sound: pause
media on route change (SENSEI-LOG).

## 3. The recipe book (`scripts/ffmpeg-recipes.mjs`, sizes from the 4 s 640x360 synthetic clip, H.264 source 381 KB)

| Recipe | Key arguments | Size, time |
|---|---|---|
| Poster, WebP | `-frames:v 1 -c:v libwebp -quality 80` | 9.0 KB (JPEG q3: 18.8 KB) |
| Hero H.264 | `-c:v libx264 -profile:v high -level 4.1 -crf 20 -preset slow -pix_fmt yuv420p -vf scale=trunc(iw/2)*2:trunc(ih/2)*2 -movflags +faststart -an` | 449 KB; moov before mdat checked |
| Hero VP9 | `-c:v libvpx-vp9 -crf 30 -b:v 0 -row-mt 1 -an` | 435 KB, 3.4 s |
| Hero AV1 | `-c:v libaom-av1 -crf 32 -b:v 0 -cpu-used 4 -row-mt 1 -pix_fmt yuv420p -an` | 281 KB, 16.4 s (slow) |
| Seamless loop | two inputs, `xfade=transition=fade:duration=0.5:offset=3.5,trim=0:3.5,setpts=PTS-STARTPTS` | 408 KB, 3.47 s by ffprobe (0.5 s shorter than the source) |
| Scrub, all-intra | `-g 1` | 1,191 KB (2.7 times the hero) |
| Scrub, GOP 8 | `-g 8 -keyint_min 8 -sc_threshold 0 -bf 0` | 588 KB |
| Alpha VP9 re-encode | `-c:v libvpx-vp9` as the decoder too, `-pix_fmt yuva420p -crf 36 -b:v 0 -auto-alt-ref 0` | 348 KB (from 464 KB); alpha kept |
| Alpha-packed H.264 | `split`, `alphaextract`, `vstack` (colour above, matte below) | 526 KB at 640x720 |
| Loudness-normalised Opus | `-af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a libopus -b:a 64k` | 29 KB for 3 s |

AV1 was the smallest (about 40 per cent under H.264 here) at about 5 times VP9's encode time. SVT-AV1 was not in the
build and was not tested.

## 4. Transparent video

- **VP9 alpha in WebM** (`-pix_fmt yuva420p -auto-alt-ref 0`): drawn to a canvas, corner alpha 0 and about 25,000
  opaque pixels, before and after the CRF 36 re-encode. ffprobe reports `yuv420p` for both and shows no alpha tag:
  **never judge alpha with ffprobe; read pixels in a browser** (`test-video.mjs` C). When re-encoding, force the
  libvpx decoder on input (`-c:v libvpx-vp9 -i in.webm`), as the recipe does.
- **HEVC with alpha** (Safari): needs Apple's encoder (`avconvert`, Compressor, `hevc_videotoolbox` on macOS); x265
  has no alpha. Not produced or tested. The usual pair: HEVC-alpha MP4 first for Safari, VP9-alpha WebM second.
- **Alpha-packed H.264** plays wherever video plays: recombine colour and matte in a shader (`sensei-holograms`
  `vid.html` shows the method) or with canvas compositing. Encoded here; recombination not re-tested in this skill.
- VP9 alpha is straight (not premultiplied) colour: composite with the right blend in WebGL.

## 5. Scroll-scrubbed video

`examples/scrub-video.html`: sticky video, scroll progress to `currentTime` with an eased follow, one seek in flight,
0.02 s dead-band, reduced motion jumps straight. With the all-intra frame-coded clip inlined as a data URI, the shown
frame matched the target within one frame at 0, 25, 50, 75, 100 and 10 per cent (`0/0, 25/24, 49/49, 74/74, 99/99,
10/10`).

Seek accuracy (20 seeks, drawn after `requestVideoFrameCallback`): every seek within one frame for GOP 250, GOP 12 and
all-intra; the off-by-one cases come from aiming at mid-frame times (snap targets to `k / fps` plus a small
epsilon). Mean seek times on these 160x90 clips were 0.4 to 5.3 ms and changed order between runs: too small and too
noisy to rank encodes. The research lane's run gave GOP 250 4.8 ms, GOP 12 1.4 ms, all-intra 0.9 ms; the principle
(long GOPs make the decoder run from the last keyframe, far worse at 1080p and 4K) stands, but measure on real
footage. Encode for scrubbing with a keyframe every 4 to 12 frames and no B-frames, keep `preload="auto"`, never
start a seek while one is pending. iOS Safari seeking of long-GOP files is reported to be slow (not tested). For very
long sequences: WebCodecs or an image sequence on canvas.

## 6. WebCodecs without a demuxer

Encode a raw Annex B stream with access unit delimiters (`-x264-params aud=1 -bsf:v h264_mp4toannexb -f h264`), split
on NAL type 9, mark IDR (type 5) as keyframes, configure `{ codec: 'avc1.64000a', codedWidth, codedHeight, avc: {
format: 'annexb' } }`, feed `EncodedVideoChunk`s. 100 access units, 9 keyframes; decoding any frame from its
previous keyframe matched the sequential decode exactly at nine probes. Always start from the previous keyframe,
`flush()`, and `close()` every `VideoFrame` or the decoder stalls. Tag colour (`-colorspace bt709 -color_primaries
bt709 -color_trc bt709 -color_range tv`) when it matters: a raw stream carries no colour metadata. Real MP4 files
need a demuxer (mp4box.js or similar) for the avcC description and sample table: not tested.

## 7. One offline file

A `data:video/mp4;base64,...` source and a `blob:` URL built from inlined base64 both played and seeked to the right
frames. Prefer the Blob route for anything over a few MB (`URL.createObjectURL(new Blob([bytes], { type }))`): it
drops the base64 string after decoding and avoids a second copy; revoke URLs on teardown. Base64 adds 33 per cent.
No page-weight gate: report the bytes. Safari and Firefox were not tested (Safari has been strict about media from
data URIs; test the Blob route there).

Under strict `file://` (how a double-clicked file opens) a relative `.vtt` track beside the page **failed**
(`readyState` 3, no cues), while a `data:text/vtt` track loaded its two cues. Inline captions, or build cues with
`addTextTrack`. The research lane's relative-track pass was made with `--allow-file-access-from-files`, a flag users
do not have. The tests here read video pixels only through `blob:` and `data:` sources.

## 8. Frame-synced effects

`video.requestVideoFrameCallback(cb)` gave `mediaTime` steps of exactly 0.0333 s at 30 fps: use it, not
`timeupdate` (about 4 Hz), to drive canvas or WebGL overlays and caption highlights, and to know a sought frame is on
screen before drawing it.

## 9. Reduced motion and data saving

No autoplay under `prefers-reduced-motion: reduce` (remove the attribute before it starts; the poster stays);
pause off screen and in a hidden tab; offer an explicit Play that overrides for the visit; consider
`navigator.connection.saveData`. Tested in `examples/hero-video.html`.

## 10. Footage sources

Stock video sites (Pexels, Pixabay, Videvo) were not read by the research: read each licence before use (Pixabay's
content licence forbids standalone redistribution). ffmpeg's GPL build may be run freely; codec patent pools are a
matter for large distributors and were not assessed.
