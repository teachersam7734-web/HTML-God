# Sources and licences

| Source | Licence | In projects | In the plugin | Notes |
|---|---|---|---|---|
| lottie-web 5.13.0 | MIT | yes, inlined with its notice and a ledger row | not vendored (installed in the work folder) | maintenance mode |
| @lottiefiles/dotlottie-web 0.81.0 | MIT | yes, with `setWasmUrl` | not vendored | WASM is part of the package |
| dotLottie format 2.0 (dotlottie.io) | open specification | yes | `make-dotlottie.py` is original | |
| LottieFiles animations | Lottie Simple License (same-terms, no technical restrictions, no compiled collections) | per file, ledger row with creator | never | not CC0; premium files differ |
| @rive-app/canvas, canvas-lite, canvas-single, webgl2 2.45.0 | MIT | yes, with its notice | not vendored | |
| Rive Marketplace files | CC BY (attribution required, visible) | yes, with the credit | never | community and premium files carry their own terms |
| rive-wasm sample `.riv` files | repository MIT, artwork authorship not stated | tests on your machine only | **never** | the tests take a path in `RIV` |
| ffmpeg (libx264, libx265 GPL; libvpx, libaom BSD) | GPL build | run it | never | output is yours; codec patents not assessed |
| Stock footage (Pexels, Pixabay, Videvo) | per site | after reading the licence | never | Pixabay forbids standalone redistribution |
| `lottie-helpers.js`, `rive-mount.js` | CC0 | yes | yes | original to this project |
| Every other script and example here | original to this project | yes | yes | |

Every Lottie, Rive or video file used in a project gets a ledger row (`node lib/ledger.mjs`): source, creator,
licence, required credit. The test animation (`make-lottie.mjs`) and the clips (`make-clips.mjs`) are generated, so
they need none.
