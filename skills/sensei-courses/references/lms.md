# LMS reporting: SCORM 1.2, SCORM 2004, cmi5

Add this only when someone says LMS, SCORM, xAPI, cmi5, Moodle, Canvas, Blackboard, Totara, Docebo or "report
completion". A course that is emailed or opened from disk needs none of it; `lms.js` falls back to a no-op, so the
same file serves both.

Sources: `domain-courses-elearning.md` in the HTML-Sensei build project's research notes (not shipped) sections 3, 4.5, 4.6 and 7; the xAPI and cmi5
specifications (Apache-2.0), read by the research lane for the statement and launch rules; the tests in this skill.

## What an LMS needs from a package

| | SCORM 1.2 | SCORM 2004 4th Edition | cmi5 (xAPI) |
|---|---|---|---|
| Package | zip, `imsmanifest.xml` at the root, resource `adlcp:scormtype="sco"` | same, `adlcp:scormType` (capital T), more namespaces | zip, `cmi5.xml` at the root with an `<au>` (`moveOn`, `masteryScore`, `<url>`) |
| Runtime | a JavaScript object `API` found by walking `window.parent` (and the opener) | `API_1484_11` | HTTP: the launch URL carries `endpoint, fetch, actor, registration, activityId`; POST the single-use `fetch` URL for a token; read `LMS.LaunchData`; POST statements |
| Status | ONE field, `cmi.core.lesson_status` (passed, failed, completed, incomplete, browsed, not attempted) | two: `cmi.completion_status` and `cmi.success_status` | statements: initialized, then passed or failed, then completed, then terminated |
| Score | `score.raw/min/max` | adds `score.scaled` (-1 to 1) | `result.score.scaled/raw/min/max` |
| Resume | `lesson_location` (255 characters), `suspend_data` (4,096) | `location` (1,000), `suspend_data` (64,000) | the xAPI State API |
| Time | `HHHH:MM:SS.SS` | ISO 8601 `PT#H#M#.##S` | ISO 8601 duration |
| Same origin as the LMS | required (parent frame access) | required | not required: CORS to the LRS |

## The adapter (`scripts/lms.js`)

```html
<script src="lms.js"></script>  <!-- inline it in the single file -->
<script>
LMS.connect().then(function (lms) {
  // lms.kind: 'cmi5' | 'scorm2004' | 'scorm12' | 'none'
  var resume = lms.resume;                       // {location, suspend, entry, mastery}
  course.onProgress(function (p) {               // one fan-out: storage, live summary, LMS
    lms.progress({ location: p.lessonId, suspend: JSON.stringify(p.pointer),
                   scoreRaw: p.percent, completed: p.allDone, passed: p.allDone ? p.percent >= 70 : undefined });
  });
  addEventListener('pagehide', function () { lms.finish(!course.finished()); });  // once, synchronous
});
</script>
```

Choice order: cmi5 when the query has all five launch parameters; else SCORM 2004 (`API_1484_11` up the parent chain,
then the opener's chain, at most 500 hops); else 1.2 (`API`); else `none`. A cross-origin parent makes the walk throw;
the adapter catches it and runs standalone.

What it guarantees, each proved by `test-lms.mjs` against strict mocks: Initialize first; one Terminate last with a
Commit before it; nothing after Terminate; value formats per version (`PT0H0M0.03S` against `0000:00:00.03`); 2004
`score.scaled` to four places; 1.2 `passed` never overwritten by a later `completed` (a "decided" flag); a reopened
completed or passed attempt is not set back to incomplete; `suspend_data` over the version's limit is refused with a
console warning instead of being cut by the LMS; cmi5 fetches the token once, reads `LMS.LaunchData`, merges the LMS
context template (grouping and extensions kept, the LMS session id used), sends initialized, passed or failed,
completed and terminated once each with a scaled score and an ISO duration, Basic auth and
`X-Experience-API-Version: 1.0.3` on every call, `keepalive: true` on statements.

## Packaging (`scripts/pack_lms.py`)

```
python pack_lms.py index.html --format scorm12   --title "Reading" --id reading -o reading-scorm12.zip
python pack_lms.py index.html --format scorm2004 --title "Reading" --id reading -o reading-2004.zip
python pack_lms.py index.html --format cmi5      --title "Reading" --id reading -o reading-cmi5.zip
python -I pack_lms.py --selftest
```

The manifest is written at the zip root next to the page. cmi5 uses `moveOn="CompletedAndPassed"` and
`masteryScore="0.7"` by default (the `cmi5()` function's `mastery` argument). Extra files can be listed (`extra`), but
a single offline file needs none. Before shipping, import each zip into the client's LMS or SCORM Cloud: only a real
LMS proves a package.

## suspend_data: store pointers, not text

4,096 characters in 1.2 (some LMSs allow more, many truncate silently). Keep the real state in the course's own
storage and put ids and indexes in `suspend_data`: `{"l":"l7","s":3,"done":[1,2,5]}`, not the learner's answers in
full. Measure the longest realistic value in a test.

## Not verified

Import into any real LMS; behaviour of any real LRS; cmi5 `launchMode` Browse and Review (read, not acted on); 1.2
`mastery_score` (read, not acted on); surviving a reload of a cmi5 launch (the token is not cached, and the fetch URL
is single-use: cache it in `sessionStorage` if reloads must survive, and test that).

## Licences of LMS libraries

| Library | Licence | Use |
|---|---|---|
| `lms.js`, `pack_lms.py` | HTML-Sensei's own code | ship in a course |
| H5P (`h5p-php-library`) | GPL-3.0; each content type has its own licence | reference only: a course that embeds it inherits GPL obligations; a server-side PHP platform anyway |
| pipwerks `scorm-api-wrapper` | GitHub reports no licence | do not vendor without reading the file header; we wrote our own |
| ADL `SCORM-to-xAPI-Wrapper` | none detected, archived in 2017 | reference only |
| xAPI and cmi5 specifications | Apache-2.0 | read for the rules |
