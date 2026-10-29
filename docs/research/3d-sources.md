# 3D and illustration source review

Reviewed 2026-10-28 through GitHub's primary repository/file endpoints. This review adds original production guidance in [community-3d-workflows.md](../../skills/sensei-3d/references/community-3d-workflows.md), linked from sensei-3d and sensei-blender. No upstream source, checkpoint, example model or sample illustration was copied into HTML God. No dependencies or external tools were installed or run for this review.

## Revisions inspected

| Repository | main revision observed and re-read | Role in HTML God |
| --- | --- | --- |
| [SUPRA-Tex](https://github.com/Supra-3D/SUPRA-Tex) | [e1c5c02805225d33b82fc9d69dd5ebd623d1f2e0](https://github.com/Supra-3D/SUPRA-Tex/commit/e1c5c02805225d33b82fc9d69dd5ebd623d1f2e0) | Observation-aware PBR asset authoring, alignment review and provenance |
| [Motion2MixamoRig](https://github.com/MaxLiu22/Motion2MixamoRig) | [f05a718188026b06e7ee64b47bab077970444b19](https://github.com/MaxLiu22/Motion2MixamoRig/commit/f05a718188026b06e7ee64b47bab077970444b19) | Separate motion extraction/retargeting, contact correction and character QA |
| [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | [5e1be84b8f22325eb156b00c34370374963c15aa](https://github.com/shinshin86/mesh-avatar-studio/commit/5e1be84b8f22325eb156b00c34370374963c15aa) | Prepared illustration layers, mesh deformation, runtime lifecycle and pose review |

These are source-code snapshots, not model-weight revisions or independent confirmations of upstream benchmark claims. README, license and key guides were fetched again at the pinned revisions; the source excerpts below use the same pins.

## SUPRA-Tex

Primary material inspected:

- [README and setup constraints](https://github.com/Supra-3D/SUPRA-Tex/blob/e1c5c02805225d33b82fc9d69dd5ebd623d1f2e0/README.md)
- [Method and implementation map](https://github.com/Supra-3D/SUPRA-Tex/blob/e1c5c02805225d33b82fc9d69dd5ebd623d1f2e0/docs/method.md)
- [Existing-mesh inputs, export and refinement behavior](https://github.com/Supra-3D/SUPRA-Tex/blob/e1c5c02805225d33b82fc9d69dd5ebd623d1f2e0/docs/texturing.md)
- [MIT LICENSE](https://github.com/Supra-3D/SUPRA-Tex/blob/e1c5c02805225d33b82fc9d69dd5ebd623d1f2e0/LICENSE) and [third-party notices](https://github.com/Supra-3D/SUPRA-Tex/blob/e1c5c02805225d33b82fc9d69dd5ebd623d1f2e0/THIRD_PARTY_NOTICES.md)

The documented pipeline estimates materials in the input camera, projects trusted visible information into a 3D representation and completes unobserved regions. The resulting GLB can be relit; this is not a video animation model. The reference adopts the separation between measured/observed regions and inferred regions, plus alignment diagnostics and front/back review. It does not reproduce the transformer implementation or numeric model internals.

The README requires Linux, an NVIDIA GPU, CUDA 12.4 with nvcc and a compiler, and describes a Python 3.10/Conda runtime. It reports an RTX 3090 24 GB test with automatic CPU offload; that is upstream evidence, not a hardware test performed here. DINOv3 access approval and other external model dependencies remain relevant. Model downloads and CUDA extension builds are external authoring tasks, not in-browser or Node-only capabilities.

The actual LICENSE file is MIT for original source. The README states MIT for original source and 3D completion weights, but describes the material adapter as subject to Qwen Research terms for non-commercial research/evaluation. THIRD_PARTY_NOTICES separately records MIT, Apache-2.0 and custom DINOv3 components and warns that runtime source terms do not license model weights/adapters. This review did not download or audit the individual weight artifacts or their model cards. No blanket commercial clearance for the full stack is claimed.

Concrete additions: source/camera alignment before material acceptance; clearly marked unseen-surface synthesis; no topology-preservation promise after texturing export; separate browser optimisation; and an original asset receipt convention that records the exact selected model terms and observed/inferred regions.

## Motion2MixamoRig

Primary material inspected:

- [README: inputs, outputs, commands, still-pose behavior and diagnostics](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/README.md)
- [Python dependencies](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/pyproject.toml)
- [Retarget source, including rest-bone and quaternion-continuity rules](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/motion2mixamorig/mixamo/retarget.py) (first 100 lines)
- [Foot-lock source and contact model](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/motion2mixamorig/mixamo/foot_lock.py) (first 100 lines)
- [Apache-2.0 LICENSE](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/LICENSE) and [NOTICE](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/NOTICE.md)

The tool separates human motion recovery from retargeting a reusable intermediate skeleton to a compatible Mixamo character. It exports skinned GLB and preview/diagnostic files. A photo supplies a single static pose; the preview orbit must not be described as recovered motion. The original source comments explain independent heel/ball contact, transition easing, IK and reach-limited hip corrections. HTML God now carries these as implementation-independent acceptance/design rules, without copying their code or tuned constants.

Documented setup includes Python 3.11+, large inference downloads, locally obtained body/character models and an optional hand pipeline. The Blender extension targets Blender 4.2+ and uses an external Python environment. CPU execution is described by upstream, so it is not labelled GPU-only here; hardware/runtime performance has not been independently measured. FFmpeg is recommended upstream for browser-compatible previews. Runtime claims and platform tests in the README remain upstream claims.

The repository's actual LICENSE is Apache-2.0. Its NOTICE explicitly characterises the end-to-end pipeline as effectively non-commercial/research because of upstream components, including GVHMR and SMPL-X. It also identifies YOLOv8's AGPL-3.0 and separate checkpoint/asset terms. The README distinguishes Mixamo character product usage from redistribution as an asset pack and identifies extra MANO requirements for hands. No model, character or checkpoint rights were inferred from Apache-2.0, and none are distributed here.

Concrete additions: cache extraction separately from character changes; record FPS/frame count; preserve target bone proportions; review foot slide separately from floor collision; inspect self-intersection ranges and manual annotations; distinguish baked browser clips from authoring inference; and route accepted clips into the existing game/film gates.

## Mesh Avatar Studio

Primary material inspected:

- [README: authoring, editor, Player and live data boundaries](https://github.com/shinshin86/mesh-avatar-studio/blob/5e1be84b8f22325eb156b00c34370374963c15aa/README.md)
- [Agent guide: calibrated grids, layers, fixed-pose review and masked variants](https://github.com/shinshin86/mesh-avatar-studio/blob/5e1be84b8f22325eb156b00c34370374963c15aa/docs/agent-guide.md)
- [Avatar package format and validation limits](https://github.com/shinshin86/mesh-avatar-studio/blob/5e1be84b8f22325eb156b00c34370374963c15aa/docs/format.md)
- [Runtime README and documented JavaScript API](https://github.com/shinshin86/mesh-avatar-studio/blob/5e1be84b8f22325eb156b00c34370374963c15aa/packages/runtime/README.md)
- [Secondary-motion source](https://github.com/shinshin86/mesh-avatar-studio/blob/5e1be84b8f22325eb156b00c34370374963c15aa/packages/runtime/src/engine/physics.js) (first 100 lines)
- [Repository MIT LICENSE](https://github.com/shinshin86/mesh-avatar-studio/blob/5e1be84b8f22325eb156b00c34370374963c15aa/LICENSE), [runtime MIT LICENSE](https://github.com/shinshin86/mesh-avatar-studio/blob/5e1be84b8f22325eb156b00c34370374963c15aa/packages/runtime/LICENSE) and [Miko sample terms summary](https://github.com/shinshin86/mesh-avatar-studio/blob/5e1be84b8f22325eb156b00c34370374963c15aa/samples/miko-qipao/MIKO_ASSET_TERMS.md)

This is prepared 2D illustration deformation in WebGL, with layers/rig and optional drawn facial variants. The runtime accepts a prepared folder or .mavatar archive, including binary input; it exposes control methods for expression, pose and voice level plus destruction. Audio playback and loudness analysis remain application responsibilities. The .mavatar format is an archive of JSON and PNG assets, not glTF.

The editor requires Node.js 22.17+; the agent-led build/review guide also needs Python/uv and Playwright Chromium. Prepared browser playback does not require that entire authoring stack. The guide's external image-generation stage is optional; live local face/voice operation and external image editing have different data flows and must be described separately.

Both inspected code licenses are MIT, copyright Yuki Shindo. The Miko artwork is explicitly excluded from MIT. Its included summary allows integration within works and prohibits standalone/asset-collection redistribution, while identifying Japanese character guidelines as authoritative. HTML God does not include Miko or claim an independent audit of the full Japanese guidelines. The README separately credits MediaPipe/its face landmarker under Apache-2.0; those assets were not vendored or independently audited here.

Concrete additions: coordinate calibration before rigging; zoomed eye/mouth placement; layered source/build/review separation; fixed-pose/crop acceptance; runtime lifecycle ownership; numeric tracking controls with explicit local media boundaries; and a static fallback plus a separate deterministic-film plan for stateful mesh physics.

## Verification boundary

Completed: primary-source reading at the listed revisions, licence-file/notice inspection, original workflow authoring, and skill-link integration. Not completed: installing upstream environments, fetching checkpoints, running model inference, producing a new character/asset with these tools, testing their runtimes, or measuring device performance. These notes are a reproducible research and production-routing integration, not a claim that HTML God bundles or has executed the three upstream systems.
