# Community 3D and illustration workflows

Use this reference when a brief starts from a still image, recorded human motion or an illustrated character. These are production routes, not bundled model integrations. The research is pinned and attributed in [3d-sources.md](../../../docs/research/3d-sources.md). No upstream implementation, checkpoint or sample artwork is shipped with this reference.

## 1. Choose the representation before choosing the tool

| Requested result | Route | What actually runs in the delivered HTML |
| --- | --- | --- |
| A photograph becomes a relightable, orbitable object | Optional SUPRA-Tex authoring, then Blender cleanup and GLB delivery | A prepared 3D mesh, PBR textures and viewer controls |
| A person in a video drives a rigged 3D character | Optional Motion2MixamoRig extraction/retargeting, then clip cleanup | Baked skeletal animation and a character GLB |
| A single photo supplies a pose | Still-pose recovery or manual posing | A static posed model; camera movement does not make the pose animated |
| A portrait illustration blinks, speaks and sways | Prepared 2D layers, mesh rig and optional drawn variants | A lightweight WebGL illustration rig; not reconstructed 3D geometry |
| An image moves without an authoring/model setup | Original layers, restrained parallax or authored SVG/canvas motion | Only motion supported by the prepared layers; no claim of unseen geometry |

Ask only for information the request has not settled: desired output (object, pose, motion clip or illustrated avatar), input rights, whether true viewpoint changes are needed, commercial/personal use, and whether the user accepts external generation. Do not demand a GPU for playback simply because asset authoring used one.

## 2. Image to a textured 3D object: observation before invention

SUPRA-Tex separates reference-view material estimation, projection of visible observations onto the surface, and learned completion of unseen material. Adopt that separation in the brief and review even when using a different tool.

### Authoring handoff

1. Start with one sharp, fully framed object. Prefer clean RGBA foreground. Preserve the original image and its camera/scale metadata; do not silently crop away labels or details the user needs.
2. Decide whether geometry already exists. Existing-mesh texturing requires matching geometry, camera, foreground observation and material maps. A single RGB image is not a ready-to-use texturing package.
3. Generate or prepare the asset outside the browser. SUPRA-Tex's documented runtime uses Linux, NVIDIA CUDA 12.4, Python/Conda and native extensions; its image-to-3D setup also downloads several models, some access-gated. A Node-only HTML project cannot run those steps by adding a script tag.
4. Inspect geometry-to-image alignment before completion. Upstream prints silhouette overlap and warns below IoU 0.9. Treat that as an upstream diagnostic, not a universal acceptance threshold. Misalignment makes apparently observed details come from synthesis instead.
5. Record which surfaces came from the supplied view, which from another generated view, and which were completed without direct observation. Review a full turntable so the unseen side is not accepted on the strength of the front alone.
6. Export a new GLB, inspect it in Blender, clean floaters and check the textures under multiple lighting directions. Existing-mesh texturing may change vertices and UVs at export; do not promise topology preservation or automatically reuse a prior rig.
7. Optimise a separate browser copy to the target device, retaining the full authoring result. Upstream defaults such as a 500,000-face mesh and 4096 texture atlas are authoring settings, not a tested mobile budget.

### Material and image-generation traps

- Keep the material frontend's maps distinct from exported glTF materials. SUPRA-Tex's input MRA map has its own channel convention; consume the exported GLB or explicitly convert conventions rather than wiring that intermediate image straight into a browser material.
- Small lettering needs reference-view comparison at readable zoom. Upstream optional refinement repairs observed base colour; it is not proof that hidden labels, geometry or roughness are correct.
- A generated back view is a creative hypothesis. Use an aligned normal/silhouette guide, inspect it, then retain the approval/defect notes with the asset. Do not claim the back was recovered from the source photograph.
- Source code's MIT licence does not license the complete inference stack. The upstream material adapter is described as Qwen Research licensed for non-commercial research/evaluation. Verify every selected model and its intended use before running this route commercially.

### Reusable receipt

Keep a small authoring receipt next to the GLB: source image hash; author/rights; tool and revision; model/checkpoint identifiers and terms; seed; units/camera; observed versus inferred regions; alignment and refinement status; exported file hash; geometry/texture counts; and defects found in the front/back/side review. This is an HTML God handoff convention, not a claim that upstream emits this exact schema.

## 3. Recorded human motion to a character: separate expensive extraction from retargeting

Motion2MixamoRig demonstrates a valuable split: recover an intermediate human skeleton once, then retarget that same skeleton to different compatible characters. Keep those stages separate in project files and cache keys.

### External authoring route

1. Check that the input shows one person head to toe throughout. Choose and record the exact input file; avoid an unattended latest-file selection when several clips exist.
2. Verify asset/model rights before selecting this pipeline. Its own code is Apache-2.0, but the upstream NOTICE states the complete extraction pipeline is effectively non-commercial/research because of GVHMR, SMPL-X and other components. A permissive wrapper is not commercial permission for its models or character assets.
3. In a separately prepared environment, use the upstream doctor check. Its documented prerequisites include Python 3.11+, model weights and locally supplied body/character assets; the Blender extension requires Blender 4.2+ and an external Python runtime. Do not install these automatically into the HTML project.
4. Extract one skeleton and retain it with input hash, source FPS, frame count and extraction settings. The first run can download gigabytes of weights. CPU execution is documented, but runtime varies; do not turn the README's example timings into a promise.
5. Reuse the extracted skeleton when changing the character. In that external tool, an existing setup can use the following shape of command:

```sh
m2mr run --skeleton outputs/previous/skeleton_motion.npz --rig assets/mixamo/character.fbx
```

6. Check the exported character GLB and its animation in Blender. Match the source FPS and the zero-based frame range. Optional hand detection is a separate extraction pass with further weights and MANO requirements, not a free detail slider.
7. Use the HTML God GLB/player pipeline only after asset acceptance. Do not embed Python inference, private model files or raw source character packs in the page.

A still input produces a static recovered pose. To animate that character, obtain an authorised motion clip or author actual keyframes; an orbiting camera around the static pose is a turntable, not motion capture.

### Portable animation corrections

Apply these concepts with an original implementation or a separately licensed tool; no upstream retarget code is included here:

- Preserve target rest-bone lengths. Transfer orientations and root movement in an explicit coordinate frame; stretching target bones to match the source can break the character proportions.
- Keep quaternion signs temporally consistent and inspect ambiguous half-turns. Equivalent quaternion signs can produce visible interpolation discontinuities if tracks are assembled carelessly.
- Treat planted heel and ball contact as different constraints. Use hysteresis for contact entry/exit, reject tiny contact segments, and ease corrections around segment boundaries.
- When the foot is planted, correct the leg through IK while preserving the intended bend direction. If reach is impossible, review a small shared hip correction instead of stretching the leg or snapping a foot.
- Separate foot-contact drift correction from floor placement. Check both; self-intersection diagnostics alone do not detect floor penetration.

### Acceptance review

Capture source/character side by side and inspect the entire timeline plus worst frames: foot slide, floor penetration, knees/elbows flipping, shoulder twist, self-intersections and hand visibility. Add fixed floor markers so root motion is visible. Inspect the beginning/end for a loop seam; make a loop only when it is requested. Keep diagnostic frame ranges and manual notes alongside the exported clip.

For a film, bake or evaluate the accepted animation at exact timeline time under the existing seek contract; verify repeated and out-of-order seeks. For a game, define idle/walk/action clips and transition rules, and check root motion against gameplay movement before wiring input.

## 4. Illustration to a browser mesh avatar

Mesh Avatar Studio demonstrates a browser-friendly path that does not require a diffusion model per frame: prepare layers and a controllable 2D mesh, then deform it at runtime. This preserves illustration style and supports controlled blinks, mouth movement and modest head/body motion. It does not recover a real 3D head or invisible artwork.

### Prepare and review the asset

1. Use an owned or authorised front-facing illustration with the face clearly visible. Keep original pixels and rig coordinates in one documented image coordinate system.
2. Calibrate visual coordinate reading before placing controls. Work on zoomed grids for eyes and mouth; record pivots at the neck and attachment roots rather than guessing all landmarks from a thumbnail.
3. Separate the stable base, eyes, lashes, movable accessories and hair influence mask. Fill pixels revealed by movement during authoring; do not stretch the original eye white into a closed eyelid.
4. Add optional drawn closed/half eyes and mouth shapes through tightly masked image edits. Preserve scale, registration and pixels outside the intended region. Review composited results, not just the generated full image. External image generation is optional and uses the user's authorised image-service access.
5. Render fixed extremes: neutral, closed eyes, open mouth, turn left/right, tilt, expression changes and hair motion. Check at full image scale and tight eye/mouth crops. Fail on remaining iris in a blink, torn contours, drifting skin patches, exposed holes or accessories bending with unrelated facial parts.
6. Keep source, rig, built layers and review outputs separate. A playable package need not include the source image, but its built layers still reveal the artwork. Check artwork rights before sharing either form.

The upstream editor needs Node.js 22.17+; its agent-led layer/review workflow also uses Python/uv and Playwright Chromium. The prepared runtime is ESM/WebGL and does not depend on React. The browser Player supports playback and optional face/voice control; do not describe that as the whole asset-generation workflow running in-browser.

### Web runtime integration contract

For an explicitly approved external runtime dependency, consult the pinned runtime README in the source notes. Its documented load function accepts a prepared avatar folder or .mavatar archive, including binary input; a single-file build can embed the reviewed bytes and pass a Blob/Uint8Array instead of fetching a remote asset. Bundle the selected runtime and retain its notices. This reference does not install it or ship its bundle.

The documented entry point is `loadMeshAvatar(canvas, source)`. Its relevant methods include `setAutoIdle`, `setSpeaking`, `setVoiceLevel`, `setEmotion`, `setExpression`, `setParameters`, `setOverlays` and `destroy`. A loader-owned archive is released on destruction; a package supplied by the caller remains caller-owned. Use the pinned API rather than inventing pause/seek methods.

Keep four responsibilities distinct:

| App responsibility | Runtime handoff | Required check |
| --- | --- | --- |
| Play narration/audio after a user gesture | Call `setVoiceLevel` with 0 to 1 and `setSpeaking` | A talking mouth is not itself audio playback or phoneme recognition |
| Choose emotion/expression | Call `setExpression` / `setEmotion` | Blinks and speech still work during expression changes |
| Optional face tracking | Send bounded/smoothed values through `setParameters` | Camera permission, neutral calibration, tracking-loss fallback |
| Remove/replace avatar | Call `destroy`; release caller-owned packages | No orphaned WebGL contexts, audio analyzers or object URLs |

The upstream .mavatar is a constrained ZIP package, not a GLB. Use its loader/validator; do not rename it to .glb or feed it to a glTF loader. Its structural validator does not assess actual image dimensions or visual motion quality, so retain rendered review.

### Motion and privacy rules for HTML God delivery

- Use a visible still illustration as the loading, WebGL-failure and reduced-motion fallback. If the chosen runtime cannot truly pause, remove/destroy it and show the still instead of merely disabling idle motion while leaving another motion source active.
- Camera and microphone are opt-in, with stop controls. Keep raw media local when implementing the local tracking route; send only required numeric controls between views. Do not infer a remote privacy guarantee from a local demo.
- Smooth incoming controls, cap extreme motion and keep a neutral fallback on tracking loss. Do not scale hair amplitudes endlessly with head velocity; use bounded secondary motion and small fixed simulation steps.
- Treat the live avatar as stateful. For deterministic film seeking, bake/simulate from a known state or render a prepared frame sequence, then verify the existing out-of-order seek tests. This runtime is not asserted to expose HTML God's deterministic seek contract.
- The upstream Miko sample artwork is separately licensed and is not part of HTML God. Build examples from original artwork; MIT runtime terms do not grant sample-art rights.

## 5. Handoff to existing HTML God lanes

- Product viewer or character scene: continue in sensei-3d for offline loaders, DPR limits, context loss, reduced motion and its 3D gate.
- Asset cleanup, texture bake and animated export: continue in sensei-blender and inspect the actual GLB, not only a successful process exit.
- Character film: continue in sensei-motion-graphics and sensei-video-pipeline for exact timing, sound, rendered file checks and contact sheets.
- Browser game: continue in sensei-games for input, loop, pause, save and gameplay tests. Model inference is an authoring dependency, not an unconditional startup task for a player.

These integrations are authored workflows and decision rules. The external model pipelines and upstream apps were inspected, not executed or performance-tested in this environment.
