# HTML to video pipelines compared

From `domain-html-to-video-pipelines.md` and the repo studies; "tested" means run on the build machine.

| Pipeline | Frame source | Clock | Strengths | Weaknesses | Evidence |
|---|---|---|---|---|---|
| Seek page + CDP + ffmpeg (this skill) | any DOM, SVG, canvas, WebGL page | pure in t, any frame in any order | no npm packages, parallel chunks, the scrub bar is free, same file plays in a lesson | needs Chrome; WebGL slow without a GPU | tested |
| Node + `@napi-rs/canvas` + ffmpeg (claude-animation-skill) | Canvas 2D in Node, no browser | `frame(ctx, t)` pure | no browser or GPU; 120 frames of 1080 square in 8 s | no DOM, CSS or WebGL; Windows ESM import patch; a native crash on a long 1080p film | tested in research; see `sensei-handmade-animation` |
| Stateful engine, ordered frames (papermotion) | canvas in headless Chromium | fixed-step simulation; pages simulate through each other's blocks | soft bodies, springs, physics | no random access; `draw` must be side-effect free; pnpm, TypeScript, Vite | read, not run |
| HyperFrames | HTML compositions with paused timelines | seekable timelines | agent-friendly, Studio, registry, multi-worker | its own CLI and rules | used for the Damsel films; see `hyperframes-handoff.md` |
| Remotion | React | `useCurrentFrame` | mature, common in prompts (113 of 703) | React and a build step; company licence terms not checked | corpus counts only |
| p5 + p5.brush watercolour | WebGL via p5 | pure in t | painterly look | heavy; WebGL; LGPL p5; remote fonts in the originals | read; black frames on the virtual GPU, 2.8 to 34 s per frame in software |
| Manim | Python | scene timeline | maths explainers | separate toolchain | named in the corpus |
| Generated clips (external models) | video models by API | none | live-action-like footage | paid, non-deterministic | keep behind the paid-generation approval |

## Choosing

| Need | Choose |
|---|---|
| Lesson animation, explainer, kinetic type, UI morph, countdown | seek page, CDP render |
| Must also scrub inside a page | seek page plus `player.js` |
| Storybook or hand-drawn look | canvas seek page (`sensei-handmade-animation`), or Node canvas when no browser is wanted |
| Physical stories with soft bodies | precompute a fixed-step simulation in `__ready`, or a papermotion-style engine if its toolchain is acceptable |
| Heavy 3D or WebGL film | seek page with WebGL; render on a real GPU on the target machine, SwiftShader here, never mixed in one film |
| Many scenes, editable by a person later | HyperFrames or Remotion if already installed |
