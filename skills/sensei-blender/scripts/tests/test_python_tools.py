"""Self-test for blender_locate.py, blender_run.py and contact_sheet.py, with a stand-in for Blender (no Blender
needed). Python 3 standard library; the contact-sheet part needs Pillow and is skipped without it.

    python tests/test_python_tools.py

The stand-in is a tiny program named like Blender (a .bat on Windows, a shell script elsewhere) that runs shim.py:
it answers --version, records its argument list, and behaves according to SHIM_MODE (ok, nonzero, traceback, nofile,
nosentinel, sleep). In sleep mode it starts a child process and records both process ids, so the test can prove that a
timeout kills the whole tree, not just the first process.

verified: Windows 10, Python 3.13, Pillow 12.2: every case passes.
not verified: macOS and Linux (the shell-script stand-in and the process-group kill are written for them, not run).
Original code of this project.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, SCRIPTS)

SHIM = r'''
import os, subprocess, sys, time
args = sys.argv[1:]
log = os.environ["SHIM_LOG"]
with open(log, "a", encoding="utf-8") as fh:
    fh.write(" ".join(args) + "\n")
if args == ["--version"]:
    print("Blender 5.2.0\n\tbuild date: stand-in")
    sys.exit(0)
mode = os.environ.get("SHIM_MODE", "ok")
rest = args[args.index("--") + 1:] if "--" in args else []
out = rest[rest.index("--out") + 1] if "--out" in rest else None
if mode == "sleep":
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"])
    with open(log + ".pids", "w") as fh:
        fh.write(f"{os.getpid()} {child.pid}")
    time.sleep(120)
if mode == "traceback":
    print("Traceback (most recent call last):\n  RuntimeError: boom", file=sys.stderr)
    sys.exit(1)
if out and mode != "nofile":
    with open(out, "wb") as fh:
        fh.write(b"glTF" + b"\0" * 64)
if mode != "nosentinel":
    print("EXPORTED", out)
sys.exit(1 if mode == "nonzero" else 0)
'''


def alive(pid):
    if os.name == "nt":
        r = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True)
        return str(pid) in r.stdout
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def make_shim(d):
    with open(os.path.join(d, "shim.py"), "w", encoding="utf-8") as fh:
        fh.write(SHIM)
    if os.name == "nt":
        exe = os.path.join(d, "blender.bat")
        with open(exe, "w", encoding="utf-8") as fh:
            fh.write(f'@"{sys.executable}" "%~dp0shim.py" %*\r\n')
    else:
        exe = os.path.join(d, "blender")
        with open(exe, "w", encoding="utf-8") as fh:
            fh.write(f'#!/bin/sh\nexec "{sys.executable}" "$(dirname "$0")/shim.py" "$@"\n')
        os.chmod(exe, 0o755)
    return exe


FAILS = []


def check(name, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + name + (f"  {detail}" if detail else ""))
    if not cond:
        FAILS.append(name)


def main():
    d = tempfile.mkdtemp(prefix="sensei-blender-test-")
    exe = make_shim(d)
    log = os.path.join(d, "calls.log")
    os.environ["SHIM_LOG"] = log
    for n in ("BLENDER_EXE", "BLENDER_PATH", "BLENDER_BIN", "BLENDER"):
        os.environ.pop(n, None)

    import blender_locate
    import blender_run

    # locate
    os.environ["BLENDER_PATH"] = exe
    r = blender_locate.find(minimum="4.2")
    check("locate: env BLENDER_PATH, version read", r["found"] and r["version"] == "5.2.0" and r["source"] == "BLENDER_PATH", json.dumps({k: r.get(k) for k in ("found", "version", "source")}))
    check("locate: meets --min 4.2", r.get("meets_min") is True)
    check("locate: fails --min 6.0", blender_locate.find(minimum="6.0").get("meets_min") is False)
    os.environ.pop("BLENDER_PATH")

    # run
    script = os.path.join(d, "job.py")
    open(script, "w").close()
    blend = os.path.join(d, "scene.blend")
    open(blend, "w").close()
    out = os.path.join(d, "out.glb")

    def run(mode, timeout=60, expect=None):
        os.environ["SHIM_MODE"] = mode
        if os.path.exists(out):
            os.remove(out)
        return blender_run.run(script, [expect or out], blender=exe, blend=blend, timeout=timeout, extra=["--out", out])

    r = run("ok")
    check("run: ok", r["status"] == "ok", r["status"])
    last = open(log, encoding="utf-8").read().strip().splitlines()[-1].split()
    check("run: -b, --factory-startup, --python-exit-code 1", last[:4] == ["-b", "--factory-startup", "--python-exit-code", "1"], " ".join(last[:4]))
    check("run: .blend before --python", last.index(blend) < last.index("--python") if blend in last else False)
    check("run: arguments after -- passed through", last[-2:] == ["--out", out])
    r = run("nonzero")
    check("run: artefact + sentinel with exit 1 is ok_with_nonzero_exit", r["status"] == "ok_with_nonzero_exit", r["status"])
    r = run("traceback")
    check("run: traceback fails", r["status"] == "failed" and r["stderr_errors"], r["status"])
    r = run("nofile")
    check("run: missing artefact fails", r["status"] == "failed" and r["missing"], r["status"])
    r = run("nosentinel")
    check("run: no sentinel fails", r["status"] == "failed" and not r["sentinel_seen"], r["status"])
    t0 = time.time()
    r = run("sleep", timeout=4)
    took = time.time() - t0
    pids = open(log + ".pids").read().split() if os.path.exists(log + ".pids") else []
    time.sleep(1)
    gone = pids and not any(alive(int(p)) for p in pids)
    check("run: timeout reported", r["status"] == "timeout", f"{r['status']} after {took:.1f} s")
    check("run: timeout kills the whole process tree", bool(gone), f"pids {pids}")
    r = blender_run.run(script, [out], blender=None, timeout=5) if not shutil.which("blender") and not blender_locate.find()["found"] else {"status": "blender_missing"}
    check("run: no Blender gives blender_missing with a hint", r["status"] == "blender_missing" and "hint" in r)

    # contact sheet
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("SKIP  contact_sheet (Pillow not installed)")
    else:
        cs = os.path.join(SCRIPTS, "contact_sheet.py")

        def frames(name, positions):
            fd = os.path.join(d, name)
            os.makedirs(fd)
            for i, x in enumerate(positions):
                im = Image.new("RGB", (160, 90), (10, 12, 20))
                ImageDraw.Draw(im).ellipse((x, 30, x + 30, 60), fill=(240, 200, 60))
                im.save(os.path.join(fd, f"f_{i:03d}.png"))
            return fd

        def sheet(fd):
            p = subprocess.run([sys.executable, cs, fd, os.path.join(fd, "sheet.png"), "--json"], capture_output=True, text=True)
            return p.returncode, json.loads(p.stdout.strip().splitlines()[-1])

        code, j = sheet(frames("loop", [10, 30, 50, 70, 50, 30, 10]))
        check("contact sheet: seamless loop passes", code == 0 and j["loop_seam"] == 0, json.dumps(j))
        code, j = sheet(frames("seam", [10, 30, 50, 70, 90, 110]))
        check("contact sheet: loop seam fails", code == 1 and j["loop_seam"] > 2, f"seam {j['loop_seam']}")
        code, j = sheet(frames("static", [40] * 5))
        check("contact sheet: static clip fails", code == 1 and len(j["static"]) == 4)
        code, j = sheet(frames("spike", [10, 12, 14, 16, 90, 18, 20, 22, 10]))
        check("contact sheet: spike reported", 3 in j["spikes"] or 4 in j["spikes"], f"spikes {j['spikes']}")

    shutil.rmtree(d, ignore_errors=True)
    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
