# Finding, installing and running Blender headless

Read this before the first Blender call in a task. Nothing here installs anything on its own.

## 1. Probe first, never assume

```bash
python ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/blender_locate.py --min 4.2
node ${CLAUDE_PLUGIN_ROOT}/lib/discover.mjs              # the same probe the SessionStart hook runs; writes nothing
```

`blender_locate.py` reads `BLENDER_EXE`, `BLENDER_PATH`, `BLENDER_BIN`, `BLENDER` (the plugin's `lib/discover.mjs`
reads the last three), then `PATH`, then the standard folders for the platform, then runs `blender --version` with a
timeout. It prints JSON and exits 0 whether or not Blender is found: absence is information. `--version` proves the
binary starts; it does not prove `bpy` works, an add-on is enabled, a GPU is present or an export succeeds.

The SessionStart hook (`probe.mjs`) records the same result in `.sensei/env.json`. Its Blender search covers fewer
folders than `blender_locate.py` (no portable zips in Downloads, no winget package folder, no Chocolatey), so when the
hook says "not found" run `blender_locate.py --deep` before telling the user Blender is missing.

## 2. When Blender is absent

Say so in these words or close to them, then offer the install route. Never download or install without the user's
explicit yes (it is a 350 to 400 MB download, and it is their machine).

```
Blender is not installed on this machine (searched: environment variables, PATH and the standard folders).
The web half of this job (GLB checks, compression, the HTML player) runs without it.
The Blender scripts in this skill have not been run anywhere yet; they are type-checked only.
To build the model from the script I need Blender 4.2 LTS or newer. Options:
  1. you install it (commands below) and I run the script headless;
  2. you point me at an existing install (BLENDER_EXE=<path to the blender executable>);
  3. we build this shape in three.js directly, if it is simple enough not to need Blender.
```

## 3. Installing on the user's machine (only after a yes)

| Platform | Command or route | Notes |
|---|---|---|
| Windows | `winget install BlenderFoundation.Blender` | installs under Program Files; `blender_locate.py` finds it |
| Windows, no admin | the portable zip from blender.org, unzipped into the user's Downloads or programs folder | `blender_locate.py` looks in `Downloads/blender-*` |
| macOS | `brew install --cask blender` (or `blender@lts`), or the disk image from blender.org | executable: `/Applications/Blender.app/Contents/MacOS/Blender` |
| Linux | `sudo snap install blender --classic` (the Blender manual's route), or Flathub `org.blender.Blender`, or the tarball from blender.org | distribution packages are often several releases old |

Package names checked 2026-10-24 against the Blender manual (snap), Homebrew's cask page (`blender`, `blender@lts`
at 5.2.2) and Flathub; the winget id comes from the Blender lane's notes. Prefer an LTS release for scripts that must
keep working: the 4.5 LTS and 5.2 LTS series were both maintained when this skill was written.

After installing: run `blender_locate.py` again and record the version in the project's notes. Then run one of this
skill's scripts through the runner and replace its "not run" header with the version it ran on.

## 4. The headless job, every time

```bash
blender -b --factory-startup --python-exit-code 1 --python build_scene.py -- --out demo.glb
blender -b scene.blend --python export.py -- --out out.glb    # the .blend comes BEFORE the script
blender -b -P script.py -E help                               # list render engines
```

Through the runner (preferred):

```bash
python ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/blender_run.py --script ${CLAUDE_PLUGIN_ROOT}/skills/sensei-blender/scripts/blender/build_scene.py --expect demo.glb \
    --timeout 180 --report run.json -- --out demo.glb
```

Rules (each one cost someone a bad build):

1. **Arguments run in the order given.** The `.blend` before `--python`; `-o` before `-f` or `-a`; frame options
   after the file. Loading the file after the script runs the script on an empty scene.
2. **Scripts live in files**, not `--python-expr` (command-line length limits). Arguments for the script go after
   `--` and are read with `sys.argv[sys.argv.index("--") + 1:]`.
3. **`--factory-startup`** for reproducibility: no user add-ons or preferences. Legacy importers such as
   `import_scene.obj` do not exist there; use `wm.obj_import`, `wm.usd_import`. Native importers reject unknown
   keyword arguments: build an explicit option set per format.
4. **`--python-exit-code 1`** so a Python exception fails the process.
5. **Judge success by the artefact and a printed sentinel, not the exit code.** On Windows a non-zero exit can come
   from an allocator warning at shutdown after a successful script. The runner reports `ok_with_nonzero_exit` for that.
6. **Hard timeout, kill the process tree, close stdin.** The runner does all three.
7. **Never open a GUI from an agent.** The live-scene MCP server (see `mcp-servers.md`) is the only exception, and
   only when a person is watching the window.
8. **Python driver expressions need auto-run scripts** (`--enable-autoexec`). Do not turn that on: use simple
   `TRANSFORMS` variables with the built-in driver types, or bake drivers to keyframes (`bpy.ops.nla.bake`).
9. **Each run is a fresh session.** Anything that must persist goes into a saved `.blend` or the output files.
10. **Modules for Blender's Python** install into Blender's own interpreter, not the system one; system modules are
    not visible inside Blender (`--python-use-system-env` exists and brings its own conflicts).

## 5. Graphics and render engines on the target machine

Blender 5 needs OpenGL 4.3 or Vulkan 1.3 for its GPU backend. Eevee and viewport captures need a graphics context
even with `-b`; on servers that means a virtual display (xvfb on Linux), and the 5.2 line adds `gpu.init()` for
background mode (release notes; not verified here). Cycles on the CPU needs none of that, so it is the default render
path in this skill's scripts. On the user's machine with a real GPU, Eevee or Cycles on the GPU are fine; probe the
devices first rather than writing `scene.cycles.device = "GPU"` blind (it fails or silently falls back when no
supported GPU exists).
