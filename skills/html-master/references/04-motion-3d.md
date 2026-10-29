# Motion, live 3D and educational scenes

## Choose a motion architecture

| Need | Preferred route | Alternative |
|---|---|---|
| Hover, entrance, state feedback | CSS or Web Animations | Motion/GSAP for coordinated timelines |
| Long branded film with exact timing | Remotion or HyperFrames render | FFmpeg assembly of prepared footage |
| Learner can seek, compare or rotate | Live Three.js/SVG with explicit state | Rive state machine or pre-rendered clips plus controls |
| Art-directable complex camera timeline | Three.js with authored path | Theatre.js; confirm editor/runtime licensing |
| Expressive animated 2D character | Rive or prepared sprites | Lottie if supported features fit |
| Rich 3D world with engine services | Babylon.js | Three.js with selected helpers |
| Existing React app | React Three Fiber/Drei | Direct Three.js with lifecycle bridge |

These alternatives are not all implemented here. Consult the source atlas before choosing them. With HTML-Sensei installed, `html-sensei:sensei-motion-ui`, `html-sensei:sensei-scroll`, `html-sensei:sensei-3d` and `html-sensei:sensei-lottie-rive-video` hold the deeper recipes; this reference keeps the lessons of the case study. Do not add React just to use one decorative component in a portable vanilla HTML artefact.

## Deterministic teaching clock

Use `state = evaluate(time, scenario)` rather than an accumulation of unrelated timers. Every frame should be reproducible after seek. Derive packet position, active stage, caption, gate state, emitted effects, character pose and camera from the same time. Clamp normalised progress and define endpoint behaviour explicitly.

For a multi-hop route, keep a list of actual curves. Map time into leg index and local progress, including a short arrival hold if useful. At completion, evaluate the final leg at exactly 1 instead of letting modulo arithmetic wrap the packet back to its start. If a route stops because authority is missing, hold it at the correct gate and name the reason. A deliberate blocked ending is not a broken animation.

Expose a compact API: `play`, `pause`, `seek(seconds)`, `mode(index)`, `speed(value)`, `resetView`, `status`, `dispose`. Pause must freeze visible geometry as well as a time counter. A restart should have deliberate autoplay semantics, not accidental playback. When the tab is hidden, avoid jumping many seconds on the next frame unless that behaviour is intended.

Use transcripts and stage buttons as full alternatives. Playback alone does not mark learning completion. Keep arrows semantically distinct: message, evidence reference, dependency, shared state and permission are not interchangeable.

## Eight high-value patterns from the course

1. **Hub/spoke vs peer/mesh:** human brief, coordinator/peer terminals, labelled specialists and final document. Complete each handoff. The comparison changes routing, not merely node colour.
2. **Retrieval authority:** a current approved source and a stale source lead to different release decisions. Relevance alone does not make the old source authoritative.
3. **Verification:** pass format, evidence and release checks; a missing basis remains held.
4. **Uncertain outcome:** an action can succeed while its acknowledgement is lost. Reconcile durable state before retrying; compare one effect with a duplicate.
5. **Bounded revision:** show a finite budget and an explicit escalation exit, not an endless attractive loop.
6. **Plugin architecture:** exploded circuit layers make descriptions, methods, references, guards, tool effects and durable state visibly different jobs. Checks precede tool effects.
7. **Provenance:** removing source support changes derived views and the final answer's support, without pretending deleting one line erases all world knowledge.
8. **ENM:** illustrate recall, checking, cue organisation, application and synthesis. Mark neuronal imagery as metaphor, not a model of neurotransmitters or a mastery guarantee.

Every scene should have a learning objective, scenario table, states, controls, limit statement and source locator. Prefer a few scenes where movement adds understanding to animating every chapter identically.

## Recognisable objects instead of placeholder geometry

Use procedural primitives for functional supports: tables, monitors, paper stacks, circuit boards, gates and rails. Use a licensed or generated/modelled asset for a focal brain, person, robot or other recognisable object. Silhouette and placement matter more than raw polygon count.

Character workflow: load GLTF once, clone a skinned rig with SkeletonUtils, keep per-instance materials and mixer, normalise through a parent group **outside the animated hierarchy**, select and inspect a suitable clip, and drive mixer time from the teaching clock. An animation may overwrite root transforms. A Working clip can bend an actor below the desk; inspect several times and choose a readable pose. Keep the face/torso beside the monitor rather than occluded by it. Avoid disposing shared cached geometry during route cleanup.

Brain workflow in this project: decode a licensed Draco model at build time; retain relevant cortex/cerebellum/brainstem surfaces; bake transforms; merge geometry; embed the result and licence. The page uses a detailed surface, physical material, cyan/coral lights and a short scale/camera/fade passage into the network. Do not call the artistic eight-node menu a scientifically mapped neural simulation.

## Three.js scene construction

Use physically plausible material/light relationships: roughness, metalness, clearcoat, modest transmission, environment response, key/rim lights and restrained bloom. Bright emission without scene context makes everything look like identical neon toys. Bloom should support a few highlights and moving signals, not erase edges or labels.

Bundle Three.js and matching add-ons from the same version. Manage tone mapping and output colour space consistently. A composer can change alpha/blending behaviour; test its real composite over the page. In this project, the canvas container needed `mix-blend-mode: screen` so black pixels revealed the generated neural background. Applying it only to a child within an isolated stacking context failed.

Project labels from world to screen, then constrain them to the scene bounds. Check overlap at each key camera angle. Use HTML for crisp text and accessible controls. Pointer drag can give camera control to the learner; Reset view restores the authored camera. Avoid parallax that causes motion sickness or makes a target hard to click.

Clean up requestAnimationFrame, observers, controls, mixers, geometries/materials/textures owned by the scene, render targets, composers and renderers. Use an explicit ownership policy for cached resources. Test repeatedly entering/leaving scenes to detect leaked contexts and duplicated updates.

## Neural navigation interaction

Use native buttons over projected bright nodes. Decorative canvases/backgrounds should not intercept input. Preserve the centring transform in `:active`; the project's global button press rule replaced `translate(-50%,-50%)` and moved targets during clicks. A test that forced clicks would have hidden the actual defect.

Hover/focus reveals the title and short description. Touch needs its own preview state because a tap also fires focus: first tap previews, second tap opens, with an explicit Open action available. Keyboard Enter/Space should work directly. Provide a list/card alternative. Rebuild positions when changing from a desktop four-by-two layout to a phone two-by-four layout. Disable continuous ambient movement when reduced motion is chosen; keep every destination available.

## Scroll video and introductory footage

Normalise scroll within a deliberate section: `p = clamp((scrollY - start) / travel, 0, 1)`, then map to `video.duration`. Use requestAnimationFrame and avoid issuing another seek while a prior one is unresolved. A short all-intra encode can improve random seeking; its larger file is reported, not a reason to avoid it. A frame sequence is Plan B when exact frame/alpha needs justify download and decode cost. Keep a static poster and skip/read action.

For an intro that feels integrated, inspect the original crop, remove audio if silent autoplay is intended, trim to meaningful action, soften edges or create a proper matte, place it within the page atmosphere and time the final transition. Provide skip, Escape, replay and reduced-motion entry. Test actual decoded alpha; a filename ending in WebM does not prove transparent playback in a target browser.

The case's edge-connected dark matte preserved enclosed dark facial detail better than globally making all black pixels transparent. It was suited to that supplied footage, not a general segmentation technique. For moving complex backgrounds use a proper segmentation/compositing workflow; do not promise a luma key can preserve every dark foreground.

## Remotion and HyperFrames

Remotion: organise frame-derived React compositions, prepare source assets, verify frame rate/duration, render with the installed supported browser, inspect representative frames and confirm streams with ffprobe. Keep all package versions compatible. A React animation based only on wall-clock CSS may not be frame deterministic.

HyperFrames: read its current router/contract, inspect reusable registry blocks before recreating named effects, author valid timed composition metadata and seekable timelines, lint/preview/check/render with the available CLI. Record registry installation separately from research. The course's live 3D scenes were not rendered by HyperFrames simply because they exposed an `hf-seek` hook.

Prefer a fallback that preserves meaning: static model/poster plus full labelled steps, scenario choices and transcript. A fallback should not announce success while silently omitting the explanation.
