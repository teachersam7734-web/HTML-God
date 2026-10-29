# Release validation

Checked on Windows with Node 24, installed Chrome (software WebGL), Blender 5.2.2 LTS and FFmpeg 9.0.

| Check | Result |
|---|---|
| Package manifests and local references | 143 passed; 28 skills; both marketplace catalogs |
| Router regression suite | 114 passed, 0 failed |
| Hook regression suite | 150 passed, 0 failed; scans this plugin, excluding generated state and local dependencies |
| Interview and local-builder checks | 35 passed |
| Final interview full Sensei page gate | 22 passed, 1 performance warning, 0 failures |
| Automated accessibility | Zero axe violations in mobile, desktop and dark variants |
| Large embedded-asset secret-scan regression | Passed |
| Blender | Scene saved; PNG, GLB and actual mesh exported successfully |
| Introduction film | 60.000 seconds, 1920x1080, 30 fps, 1800 frames; G0/G2/G3/G5 and storyboard gate passed |

See [interview verification](interview/VERIFICATION.md) for performance measurements and manual/cross-browser limits, and [film notes](film/NOTE.md) for production evidence and sound measurements.

The hook tree scan was corrected to stay inside the plugin rather than reading its parent projects. The secret scanner now handles large embedded binary assets without overflowing its regular-expression stack while still checking adjacent source. New builder projects use the shared licence-ledger schema.

External model pipelines from the six researched repositories were not installed or run. No live paid model-generated build or installation across every Claude Code/Codex release is certified. The bridge regression uses a controlled runner that writes actual artifacts. No credentials, local dependencies, generated build folders or temporary render chunks are included in the release.
