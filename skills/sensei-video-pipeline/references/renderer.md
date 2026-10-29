# The renderer: flags, costs, chunks, blur, encodes

## Chrome

`cdp.mjs` launches its own headless Chrome: `--headless=new --remote-debugging-port=0` (the port is read from
`DevToolsActivePort` in a temporary profile), `--hide-scrollbars --mute-audio --allow-file-access-from-files
--force-color-profile=srgb`, and the two flags that stop headless pages freezing timers and frames:
`--disable-renderer-backgrounding --disable-background-timer-throttling` (reported in the research; PDoomVideo and
Austerlitz use them). GL modes: `swiftshader` (default: `--use-angle=swiftshader --enable-unsafe-swiftshader
--ignore-gpu-blocklist`), `gpu`, `none`. It closes only the process it started.

Why SwiftShader by default: on a VMware SVGA virtual GPU the Damsel films' three.js canvas came out empty at one time
and white at another under load, while the same canvas alone rendered (reported, SENSEI-LOG); ClaudeAnimationBase gave
black frames with `CONTEXT_LOST_WEBGL` on the default GPU path (reported). SwiftShader is deterministic. On a real
GPU, use `--gl gpu`, but never mix GPU and SwiftShader frames in one film: motionmaxxing measured about 38 dB PSNR
between them (reported).

`--dump-dom --virtual-time-budget` does not advance `requestAnimationFrame` or Web Animations, so animations never
finish that way: use a real CDP session (reported, domain research).

## Measured costs on this machine (Windows 10, no usable GPU, Chrome 155)

| Job | Rate |
|---|---|
| PNG capture of a 1920x1080 DOM page (probe) | about 240 ms each |
| 1280x720 DOM and canvas page, JPEG intermediates | 14 to 24 captures per second |
| 960x540 sting draft, 2 workers, 3 s chunks | 240 frames in 10.2 s |
| 1280x720 WebGL2 shader under SwiftShader, PNG | about 7 captures per second |
| Damsel films, HyperFrames, 3 workers, 1080p, SwiftShader | 7,063 frames in 12 min 50 s (reported); one render took 3 h 30 min on a contended machine |
| Austerlitz WebGL under SwiftShader | about 1.7 s per frame (reported, author's figure) |

These numbers schedule work; they never justify a cheaper effect. Tell the user the estimate (`--probe`) before a
long render.

## Chunks and resume

`--chunk S` splits the frame range into S-second chunks named `seg_<from>_<to>.mp4` in `<out>.chunks/`. Each chunk is
encoded to `.part.mp4` and renamed only when ffmpeg exits cleanly; existing chunks are reused unless `--force`. The
chunks are joined with the concat demuxer (`-c copy`) and audio and captions are muxed in the same step, written to
`out.part.mp4` and renamed. Tested: deleting one chunk and re-running re-rendered only that chunk.

`--workers N` opens N Chromes and deals chunks from one queue. Each worker loads the page, so memory and (on a GPU)
contexts scale with N; on a small machine more than two SwiftShader workers slow each other (reported, Austerlitz).

Never delete a source on the same command line as an unchecked step: a Damsel mux called ffmpeg by a relative path
from Python on Windows (`WinError 2`), the next line deleted the silent render anyway, and 13 minutes of rendering
were lost (reported). Delete only after checking the output exists and has the right duration.

## Shutter motion blur

`--shutter N` captures N sub-frames per output frame at times
`(i + ((s + 0.5) / N - 0.5) * angle / 360) / fps`, pipes them at `fps * N`, and reduces them with
`tmix=frames=N, select='eq(mod(n,N),N-1)', setpts=N/(fps*TB)` so each output frame is the mean of exactly its own
sub-frames (tested: 12 output frames for 0.4 s at 30 fps). Cost is linear in N.

How many sub-frames: each ghost step is `displacement per frame * angle / 360 / N`. Tested: a bar moving about 170 px
per frame at 6 sub-frames and 180 degrees still shows distinct steps of about 14 px. Keep the step under a few
pixels on the fastest move, or accept smear in the page instead. The research's floor is 6 or more at 30 fps and 4 or
more at 60 fps; 3 sub-frames give three visible ghost edges (reported). onetake rendered with averaging in linear
light (reported); `tmix` averages the encoded values, which darkens bright-on-dark blur slightly (not measured here).
Never combine shutter with per-element smear or an on-twos film.

## Intermediates and encodes

- Drafts: JPEG q95 through `image2pipe` (fast, lossy). Masters: `--png` (lossless) and encode once. Austerlitz and
  PDoomVideo both pass JPEG frames, costing a generation of quality (reported).
- Default x264: `-crf 17 -preset medium -pix_fmt yuv420p -movflags +faststart`. The Damsel masters used CRF 14 and
  were about 393 MB for 3:55 of grain-textured film (reported); budget disk for the silent render, the chunks and the
  muxed master at once.
- Web copy (Damsel, reported): two-pass x264 `veryslow`, about 700 kbps video plus AAC 112k, High profile, `moov`
  before `mdat`; SSIM against the master 0.981 at 24.3 MB for 3:55. Bitrate for a size budget:
  `(MB * 8 / seconds) - audio kbps`, times 0.985 for container overhead.
- Grain belongs in ffmpeg for animated grain (in-page per-frame grain makes frames incompressible; reported,
  lemo-opuscar); a fixed static noise layer in the page is fine and stops banding on dark gradients.
- HEVC is not a safe delivery codec for Chrome (it failed to load here in the media lane); H.264 MP4 plus an optional
  VP9 or AV1 WebM covers the web (see `sensei-lottie-rive-video`).

## Disk

HyperFrames' multi-worker capture writes every frame to disk first: a 3:55 1080p film wanted about 7.3 GB of temporary
JPEGs and refused to start with 4.4 GB free; `HF_CAPTURE_PARALLEL_STREAM=true` streams frames into the encoder
instead (reported, SENSEI-LOG). `render.mjs` always streams. `preflight.mjs` warns under 2 GB free.
