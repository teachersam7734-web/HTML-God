# Book readers, audio, local state and durable study trails

## PDF reading in an offline HTML

The course embeds the supplied PDF bytes and a matching PDF.js main/worker version. On entry, decode once and prepare the worker from locally embedded source/Blob URL; test the actual file-origin behaviour in the target browser. Keep a clear loading state, render failure state, page count, navigation, fit and zoom. Do not leave a cover-only page as the entire reading experience when the brief calls for a cinematic entry.

The book page here uses a short silent scroll-controlled film, followed by the cover and a direct read action. The film is an introduction; the reader and skip action remain easy to reach. A returned reader can preserve its last page. A supplied cover is identity, not a reason to force an empty full-screen detour.

PDF.js APIs change. The case's 3.11.174 implementation is a historical example with a specific text-layer API. For a new project, choose a currently supported version after checking official docs, keep main and worker aligned and adapt the code. Do not load arbitrary untrusted PDFs with an old copied runtime by default. See [PDF.js setup](https://mozilla.github.io/pdf.js/getting_started/).

## Highlights that survive resizing

Render the page canvas, text layer and highlight overlay in a common coordinate frame. Let the learner select actual text. For each selection rectangle, normalise x/y/width/height against the displayed page bounds; store the page number, selected text, colour, normalised rectangles, note, ID and relevant document/version identifier. Repaint from normalised coordinates after fit/zoom/resize.

Do not store only raw client pixels. Do not merge separate lines into one large rectangle that covers unrelated text. Account for multiple selection rectangles and ignore selections outside the current page. A note list should return to the selected page and passage. If the document changes, do not silently attach old coordinates to unrelated text.

Cancel an in-flight render before replacing its canvas and use a generation counter to ignore obsolete completion. Render and text-layer tasks may resolve in a different order when learners navigate quickly. Page numbers should be bounded after the document loads. Preserve readable error messages rather than leaving an indefinite spinner.

## Audio as a user-controlled service

Use one soundtrack element for the application lifetime. Start audible playback from a user gesture and handle a rejected `play()` promise. Show the real play/pause state, not a decorative animated icon that ignores the media state. Keep volume and mute obvious; persist the preference if requested.

Do not replace a user-supplied soundtrack with generated ambient audio without authorisation. In this project the full 105,067,342-byte, roughly two-hour MP3 was embedded unchanged, because the user prioritised the supplied track and accepted its size. That does not mean every future site should embed a two-hour soundtrack.

Silent/muted video can often autoplay under rules that differ from audible media. Use a poster and a usable entry action when autoplay fails. Inspect [MDN autoplay behaviour](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) instead of assuming every browser allows the same start behaviour. Never promise seamless sound before the first gesture when browser policy prevents it.

Pause background visual loops under reduced motion, separately from audio preferences. A learner may want music with static graphics or moving diagrams with no music. Avoid coupling those settings accidentally.

## Persistence and export

Keep a versioned state envelope with completion dates, current lesson, notes, preferences, review positions, assessment state and book highlights as applicable. Guard storage access with try/catch and retain in-memory usability if storage is blocked. Explain export as a portable backup.

[MDN documents `file://` localStorage behaviour as undefined and browser-dependent](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage). Do not promise notes will follow a moved/renamed file or synchronise between browsers. Private browsing, cleared browser data and a changed origin can affect persistence. The product should expose Export/Save progress and Import, not bury the only recovery option in documentation.

On import, validate the version, data types, IDs, array sizes, string lengths, numeric bounds and allowed colour/state values. Reject malformed input clearly or migrate a known schema. Keep the existing state until validation succeeds. Do not evaluate scripts or render arbitrary imported markup. Prefer a backup before a user-requested destructive replace.

Use a Blob download for portable JSON, attach a meaningful filename/date and revoke the object URL after the download has begun. A file input supplies import data without requiring a remote service. For hosted multi-device synchronisation, design an explicit authenticated backend; local storage is not a substitute.

## Reader and state QA

- Open cover, enter reader, navigate first/last/random page and type out-of-range values.
- Create multi-line highlights, resize/zoom, reload and verify alignment and notes.
- Navigate rapidly to exercise render cancellation and stale-task guards.
- Export, reset in an isolated test context, import and compare meaningful fields.
- Simulate blocked storage and malformed import; maintain usable controls and clear feedback.
- Play audio, navigate, change volume, pause and resume; confirm there is one continuing stream.
- Check the final file offline, including PDF workers and media decode.

The included project reader is a reference for these mechanics. It depends on application helpers and state, so adapt its interface deliberately rather than copying it into an unrelated app and assuming its globals exist.
