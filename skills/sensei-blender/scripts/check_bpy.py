"""Type-check Blender Python scripts WITHOUT Blender: mypy against the fake-bpy-module stubs. Standard library only
(mypy and the stub wheel are fetched by the user, see below).

    python check_bpy.py --wheel fake_bpy_module_latest-*.whl --mypy-lib mypy-lib script.py [more.py ...]
    python check_bpy.py --stubs stubs-dir script.py                  # stubs already unpacked (plain package names)
    python check_bpy.py --wheel ... --mypy-lib ... --selftest        # prove the check can fail (control file)

Getting the tools (needs the network once; ask before downloading on the user's machine):
    python -m pip download --no-deps --dest dl fake-bpy-module-latest       # or fake-bpy-module-<series>, e.g. 4.2
    python -m pip install --target mypy-lib mypy                             # or any environment that has mypy
Environment instead of flags: BPY_STUBS_WHEEL, BPY_STUBS_DIR, MYPY_LIB.

Two flags are not optional and are always passed: --check-untyped-defs (without it mypy skips every function body
without annotations, which is nearly all Blender code, so a broken script "passes") and --no-strict-optional (the
stubs type bpy.context.scene as optional, which buries real errors). Output is filtered to the files checked; the
stubs themselves produce hundreds of errors.
Triage: an unknown keyword argument, or an unknown attribute on a concrete type, is real. An error naming a generic
base type (Constraint, Light, Node, NodeSocket, Property), get_rna_type, enum_items, or an add-on operator
(export_scene, rigify, import_scene) is usually stub imprecision: add-on operators are not in the stubs at all, which
is why the export wrapper filters keywords against get_rna_type() at run time.
What it cannot catch: wrong mode or context, nothing selected, geometry that is wrong, behaviour that changed without
a signature change. A checked script is "type-checked, not run" until Blender has run it.

verified: Windows 10, Python 3.13, mypy 1.x from pip, fake-bpy-module-latest 20261024: the self-test control fails as
          it must (an unknown keyword inside an unannotated function); the plugin's Blender scripts were checked with
          it (results in SKILL.md, Verification).
not verified: pyright; stub series other than latest; macOS and Linux.
Original code of this project (the method and the two flags come from the Blender lane, repo-fake-bpy-module.md).
"""
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

CONTROL = '''import bmesh


def build():
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, diameter=1.0)   # wrong keyword: the real one is radius
    return bm
'''
LINE = re.compile(r"^(.*?\.pyi?):(\d+): error: (.*)$")
# Each alternative is a stub or inference limitation seen on scripts that are valid Blender code (checked against the
# API documentation): generic base types, add-on properties and operators (Cycles settings, Rigify), the object-data
# union, mathutils types that are iterable in Blender, keyword dicts, literal narrowing, untyped containers.
STUB_NOISE = re.compile("|".join([
    r'"(Constraint|Light|Node|NodeSocket|Property|Modifier|ID|Struct|UnknownType)" has no attribute',
    r'get_rna_type|enum_items|default_flag|default_array|rigify|addon_utils|armature_human_metarig_add|new_socket',
    r'has no attribute "cycles"', r'Item "[A-Za-z]+" of "[^"]*Armature \| Camera', r'has no attribute "__iter__"',
    r'No overload variant of "zip"', r'incompatible type "\*\*dict', r'expression has type "Literal\[',
    r'Need type annotation', r'Collection\[str\]', r'"FCurve \| list\[FCurve\]"',
]))


def unpack(wheel):
    dest = os.path.join(tempfile.gettempdir(), "sensei-bpy-stubs", os.path.basename(wheel).replace(".whl", ""))
    if os.path.isdir(dest) and os.listdir(dest):
        return dest
    tmp = dest + ".tmp"
    shutil.rmtree(tmp, ignore_errors=True)
    with zipfile.ZipFile(wheel) as z:
        z.extractall(tmp)
    os.makedirs(dest, exist_ok=True)
    for d in glob.glob(os.path.join(tmp, "*-stubs")):          # mypy only reads *-stubs from site-packages: rename
        shutil.copytree(d, os.path.join(dest, os.path.basename(d)[:-len("-stubs")]), dirs_exist_ok=True)
    shutil.rmtree(tmp, ignore_errors=True)
    return dest


def check(files, stubs, mypy_lib):
    env = dict(os.environ, MYPYPATH=stubs)
    if mypy_lib:
        env["PYTHONPATH"] = mypy_lib + os.pathsep + env.get("PYTHONPATH", "")
    cmd = [sys.executable, "-m", "mypy", "--follow-imports=silent", "--check-untyped-defs", "--no-strict-optional",
           "--no-error-summary", "--show-error-codes", "--no-incremental",
           "--cache-dir", os.path.join(tempfile.gettempdir(), "sensei-bpy-mypy-cache"), *files]   # never a cache in the project
    p = subprocess.run(cmd, capture_output=True, text=True, env=env, encoding="utf-8", errors="replace")
    if "No module named mypy" in p.stderr:
        sys.exit("mypy not found: pass --mypy-lib <folder from pip install --target> or install mypy")
    out = {}
    for f in files:
        base = os.path.basename(f)
        lines = []
        for ln in p.stdout.splitlines():
            m = LINE.match(ln)            # a Windows path has a colon after the drive letter too
            if m and os.path.basename(m.group(1)) == base:
                lines.append(f"line {m.group(2)}: {m.group(3)}")
        out[f] = {"errors": len(lines),
                  "likely_real": [ln for ln in lines if not STUB_NOISE.search(ln)],
                  "likely_stub_noise": [ln for ln in lines if STUB_NOISE.search(ln)]}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("--wheel", default=os.environ.get("BPY_STUBS_WHEEL"))
    ap.add_argument("--stubs", default=os.environ.get("BPY_STUBS_DIR"))
    ap.add_argument("--mypy-lib", default=os.environ.get("MYPY_LIB"))
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    stubs = a.stubs or (unpack(a.wheel) if a.wheel else None)
    if not stubs or not os.path.isdir(os.path.join(stubs, "bpy")):
        sys.exit("stubs not found: pass --wheel <fake_bpy_module wheel> or --stubs <folder holding bpy/, bmesh/, mathutils/>")
    if a.selftest:
        d = tempfile.mkdtemp(prefix="sensei-bpy-control-")
        ctl = os.path.join(d, "control_bad_bpy.py")
        with open(ctl, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(CONTROL)
        r = check([ctl], stubs, a.mypy_lib)[ctl]
        caught = any("diameter" in e for e in r["likely_real"])
        print(json.dumps({"selftest": "pass" if caught else "FAIL: the check is vacuous", **r}, indent=2))
        sys.exit(0 if caught else 1)
    if not a.files:
        sys.exit("no files given")
    res = check(a.files, stubs, a.mypy_lib)
    print(json.dumps(res, indent=2))
    sys.exit(1 if any(v["likely_real"] for v in res.values()) else 0)


if __name__ == "__main__":
    main()
