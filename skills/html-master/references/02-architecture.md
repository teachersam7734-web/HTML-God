# Architecture, single-file delivery and preservation

## Choose the delivery contract first

| Contract | Best fit | Trade-off |
|---|---|---|
| One offline HTML | Portable course, exhibit, report, workshop handout | Large parse/decode cost; `file://` constraints; no secure access control |
| Offline folder | Large media library, local classroom package | Better lazy loading and cache behaviour; folder must stay together |
| Hosted static site | Public experience, frequent updates, clean URLs | Needs hosting and network/caching strategy |
| Server application | Accounts, shared notes, licensing, private content | Authentication, backend and operational obligations |
| PWA | Installed-like hosted experience with offline cache | Service worker lifecycle and secure-context requirements; not simply a file opened from disk |

Match the user's requested contract. Do not silently turn a single HTML into a cloud app or claim a service worker makes arbitrary `file://` delivery work. A large allowed payload is not a reason to load every scene into GPU memory at startup.

## Editable source, compiled deliverable

Keep source modular even when the final output is one file:

```
project/
  content/       structured source-linked content and scenarios
  assets/        original/supplied/derived files, fonts and licenses
  motion/        scene code, video compositions and render scripts
  ui/            page templates, styles and interaction modules
  vendor/        pinned runtime bundles and notices when appropriate
  research/      decisions, source links and asset provenance
  qa/            checks, screenshots, coverage and release reports
  checkpoints/   protected source snapshots, not random output copies
  build.*        deterministic assembly and validation
  output/        delivery artifacts
```

Use this structure when helpful; do not make empty directories or force a tiny artefact through an elaborate architecture. A new project should have explicit module ownership rather than the historical course's stack of wrappers around `render()` and `proCleanup()`.

Content schemas should encode IDs, titles, source locators, lessons, scenarios, stages, links and assessments separately from HTML. Validate duplicate IDs, dangling links, quiz option counts, missing source references and required fields at build time. A numerical count is not enough: verify every expected ID and the semantics of edge direction/gates.

## Embedding details

- Inline CSS and bundled JS with explicit markers or a proper templating step. JS string replacement callbacks avoid interpreting `$&`, `$1` and similar replacement metacharacters inside code.
- Embed JSON in `<script type="application/json">` and escape `<` as `\u003c` so a data string containing `</script>` cannot terminate the element. Read it with `textContent` and `JSON.parse`.
- `JSON.stringify` is not shell quoting. Write complex content through file APIs or structured arguments; never interpolate untrusted text into shell command strings.
- Base64 length is `4 * ceil(bytes / 3)`. File growth is predictable, but browser memory includes strings, decoded bytes, media buffers, textures and parsed objects. Do not equate the HTML's disk size to its RAM/GPU use.
- Data URLs are suitable for many images and fonts. For large media, decode once into a Blob, reuse its URL and revoke it when truly finished. Do not decode a two-hour soundtrack on every route change.
- Local modules and fetches can behave differently under `file://`. Bundle dependencies into the deliverable; test the actual final file with networking disabled rather than relying only on a development server.
- PDF.js workers, GLTF external textures, Draco/KTX2 decoders, environment maps, font subsets and WASM are common hidden network dependencies. Inventory them explicitly.
- A GLB container does not guarantee its every dependency is self-contained. Inspect extensions and referenced URIs before promising portability.

Read current [data URL guidance](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data) for scheme behaviour and browser limits. Avoid turning one observed limit into a universal maximum.

## State and route ownership

Separate immutable content from mutable learner/user state. Version the state envelope and migrate known older versions deliberately. Normalise imported values, enforce sensible bounds and ignore unknown fields rather than injecting imported HTML into the DOM. Render notes with `textContent` or correct escaping.

Each page/scene gets a mount and cleanup contract. Cleanup cancels animation frames, timers and pending work, disconnects observers, removes listeners owned by that instance, stops mixers and disposes renderer resources. Do not dispose shared cached model geometry while another scene uses it. A generation/epoch guard should prevent an old async PDF render or model load from writing into a new route.

Global services such as soundtrack playback, application state and keyboard shortcuts need explicit lifetime ownership. A page transition should not accidentally create a second audio element or duplicate click handlers. Use hash navigation for simple local apps when suitable; preserve focus and provide a route heading.

## Protected editions

When preserving Standard while adding Pro:

1. Hash and checkpoint the approved Standard file and relevant content before editing.
2. Keep Pro-specific UI/styles/content behind a clear mode boundary or separate build.
3. If a later request authorises a shared intro, isolate it in marked blocks with a reversible build transformation.
4. Verify that removing those exact authorised blocks restores the original contents; compare hashes rather than relying on visual similarity.
5. Check core content, PDF and supplied music against their original bytes where exact preservation was requested.

Do not generalise a project's client-side password into real entitlement enforcement. An offline HTML necessarily contains its content and validation logic. Server-verified authorisation is a different architecture.

## Large-file performance

Defer heavy work until the relevant page opens. Parse the content once. Keep a poster visible while a model prepares. Put only the active lesson/scene in the DOM, but preserve serialisable notes independently. Stop expensive draw loops when hidden or paused. Cap pixel ratio as a measured quality/performance choice; it is not a substitute for reducing draw calls, polygon counts or expensive material layers.

Image and model compression should preserve the particular detail the design needs. A detailed anatomical brain benefits from recognisable gyri; a tiny background speck does not need a high-resolution texture. Avoid giant image sequences unless scroll seeking or alpha requirements justify them. Output size is unrestricted by default: there is no page-weight budget unless the user sets one, and the weight is reported as information. Still test time-to-first-usable-content and scene switching on the target browser, and say which target devices were not tested. Never simplify a scene because the development machine struggles with it.

## Reproducibility

Pin or lock dependency versions, retain necessary notices, record tool versions and save build commands. Treat historical versions (Three.js 0.180.0, PDF.js 3.11.174, esbuild 0.25.10 in this case) as provenance, not recommendations for all future projects. Check supported versions and security changes before reusing old runtimes with untrusted input.

A release manifest should state output path, size/hash, source revision, content counts, media versions, required runtime conditions, test date and genuine limitations. Keep a concise handoff with completed files, unresolved items and next actions. The final user message should link the artefact rather than bury it under implementation logs.
