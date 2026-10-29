"""Run a Blender script headless with a timeout, capture output, and judge success by the ARTEFACT, not the exit code.

    python blender_run.py --script build_scene.py --expect demo.glb --timeout 180 -- --out demo.glb
    python blender_run.py --blend scene.blend --script export.py --expect out.glb -- --out out.glb
    python blender_run.py --script x.py --expect out.glb --blender /path/to/blender --report run.json -- ...

Rules built in (each one cost someone a bad build):
  * `-b` (no UI), `--factory-startup` (clean and reproducible: no user add-ons or preferences), `--python-exit-code 1`
    (a Python exception fails the process).
  * The .blend, if any, goes BEFORE `--python` (arguments run in order; loading the file after the script runs the
    script on the empty start-up scene).
  * The script is a file (no `--python-expr` for long scripts: command-line length limits).
  * Hard timeout; on timeout the whole process tree is killed (Blender can start helper processes), stdin is closed.
  * Success = every --expect file exists and is non-empty AND no line starting `ERROR` or `Traceback` (or containing
    `Error:`) in stderr AND the sentinel (default `EXPORTED`) appeared in stdout. A non-zero exit with all of these
    true is reported as `ok_with_nonzero_exit` (Windows can return non-zero from an allocator warning at shutdown
    after a successful script). Status values: ok, ok_with_nonzero_exit, failed, timeout, blender_missing.

verified: Windows 10, Python 3.13, with a stand-in executable (tests/test_python_tools.py): ok, ok_with_nonzero_exit,
          failed on a traceback, failed on a missing artefact, failed without the sentinel, timeout with the stand-in's
          child process killed, the .blend placed before --python, the arguments after -- passed through.
not verified: a real Blender run on any platform (none installed where this was written); the POSIX process-group
              kill (written from the subprocess and os documentation, not run on macOS or Linux).
Adapted from blender-demo/scripts/blender_run.py in the HTML-Sensei build project's research notes (not shipped) (original to this project); the process-tree
kill, --report and the reading of every Blender environment variable are new here.
"""
import argparse
import json
import os
import signal
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from blender_locate import ENV_NAMES, find  # noqa: E402


def kill_tree(p):
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], capture_output=True)
    else:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            p.kill()


def run(script, expect, blender=None, blend=None, timeout=120, sentinel="EXPORTED", extra=(), threads=0):
    exe = blender or next((os.environ[n] for n in ENV_NAMES if os.environ.get(n)), None) or find().get("path")
    if not exe:
        return {"status": "blender_missing", "hint": "Blender was not found. Run blender_locate.py, then set BLENDER_EXE "
                "or pass --blender. See references/install-and-run.md for installing it on this machine."}
    cmd = [exe, "-b", "--factory-startup", "--python-exit-code", "1"]
    if threads:
        cmd += ["-t", str(threads)]
    if blend:
        cmd.append(blend)                       # file first, then the script
    cmd += ["--python", script, "--", *extra]
    kw = dict(stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, text=True, encoding="utf-8", errors="replace")
    if os.name == "nt":
        kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kw["start_new_session"] = True
    t0 = time.time()
    p = subprocess.Popen(cmd, **kw)
    timed_out = False
    try:
        out, err = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        kill_tree(p)
        try:
            out, err = p.communicate(timeout=15)
        except subprocess.TimeoutExpired:
            out, err = "", ""
    code = None if timed_out else p.returncode
    files = {f: (os.path.getsize(f) if os.path.isfile(f) else None) for f in expect}
    missing = [f for f, s in files.items() if not s]
    bad_err = [ln for ln in (err or "").splitlines() if ln.startswith(("ERROR", "Traceback")) or "Error:" in ln][:5]
    sentinel_ok = (sentinel in (out or "")) if sentinel else True
    ok = not timed_out and not missing and not bad_err and sentinel_ok
    status = "timeout" if timed_out else ("ok" if ok and code == 0 else ("ok_with_nonzero_exit" if ok else "failed"))
    return {"status": status, "exit": code, "seconds": round(time.time() - t0, 1), "files": files, "missing": missing,
            "stderr_errors": bad_err, "sentinel_seen": sentinel_ok, "cmd": cmd, "stdout_tail": (out or "").splitlines()[-8:]}


if __name__ == "__main__":
    argv = sys.argv[1:]
    rest = argv[argv.index("--") + 1:] if "--" in argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--expect", nargs="+", required=True)
    ap.add_argument("--blender")
    ap.add_argument("--blend")
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--sentinel", default="EXPORTED")
    ap.add_argument("--threads", type=int, default=0)
    ap.add_argument("--report", help="also write the JSON result to this file")
    a = ap.parse_args(argv[:argv.index("--")] if "--" in argv else argv)
    r = run(a.script, a.expect, a.blender, a.blend, a.timeout, a.sentinel, rest, a.threads)
    text = json.dumps(r, indent=2)
    if a.report:
        with open(a.report, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text + "\n")
    print(text)
    sys.exit(0 if r["status"].startswith("ok") else 1)
