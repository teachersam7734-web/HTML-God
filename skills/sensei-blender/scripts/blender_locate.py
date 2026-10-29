"""Find a runnable Blender without installing or opening anything. Python 3 standard library only.

    python blender_locate.py                 # JSON: found, path, version, source, meets_min, searched
    python blender_locate.py --min 4.2       # also report whether the version is at least 4.2
    python blender_locate.py --deep          # also walks a few root folders (slow; default off)

Order: the environment variables BLENDER_EXE, BLENDER_PATH, BLENDER_BIN, BLENDER (the last three are the names the
plugin's lib/discover.mjs reads), then PATH, then the standard install folders per platform (Windows installer,
portable zips in Downloads and the user's programs folder, Steam, winget, scoop, Chocolatey, Microsoft Store; macOS
app bundles; Linux packages, snap, flatpak, /opt and home folders), then `blender --version` with a timeout.
`--version` proves the binary starts. It does NOT prove bpy works, that an add-on is enabled, that a GPU is present or
that an export succeeds. Absence is data, not an error: exit code 0 either way; read the JSON.

verified: Windows 10, Python 3.13: Blender absent, returns found=false and lists every path tried; with a stand-in
          executable that prints "Blender 5.2.0" (tests/test_python_tools.py) returns found=true, the version and
          meets_min for --min 4.2 and --min 6.0.
not verified: a real Blender on any platform; the macOS and Linux paths (written from each platform's standard
              locations, not run there).
Adapted from blender-demo/scripts/blender_locate.py in the HTML-Sensei build project's research notes (not shipped) (original to this project); the extra
environment variables and --min are new here.
"""
import glob
import json
import os
import platform
import re
import shutil
import subprocess
import sys

HOME = os.path.expanduser("~")
LOCAL = os.environ.get("LOCALAPPDATA", os.path.join(HOME, "AppData", "Local"))
PROGRAM_FILES = [os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")]
ENV_NAMES = ("BLENDER_EXE", "BLENDER_PATH", "BLENDER_BIN", "BLENDER")

PATTERNS = {
    "Windows": [
        *[os.path.join(p, "Blender Foundation", "Blender*", "blender.exe") for p in PROGRAM_FILES],
        *[os.path.join(p, "Steam", "steamapps", "common", "Blender", "blender.exe") for p in PROGRAM_FILES],
        os.path.join(LOCAL, "Programs", "Blender Foundation", "Blender*", "blender.exe"),
        os.path.join(LOCAL, "Microsoft", "WinGet", "Packages", "BlenderFoundation.Blender*", "**", "blender.exe"),
        os.path.join(LOCAL, "Microsoft", "WindowsApps", "blender.exe"),
        os.path.join(HOME, "scoop", "apps", "blender", "current", "blender.exe"),
        os.path.join(os.environ.get("ChocolateyInstall", r"C:\ProgramData\chocolatey"), "lib", "blender", "tools", "**", "blender.exe"),
        os.path.join(HOME, "Downloads", "blender-*", "blender.exe"),                 # unzipped portable build
        os.path.join(HOME, "Downloads", "blender-*", "*", "blender.exe"),
        os.path.join(PROGRAM_FILES[0], "WindowsApps", "BlenderFoundation.Blender*", "blender.exe"),  # Store (often unreadable)
    ],
    "Darwin": ["/Applications/Blender.app/Contents/MacOS/Blender", "/Applications/Blender*.app/Contents/MacOS/Blender",
               os.path.join(HOME, "Applications", "Blender.app", "Contents", "MacOS", "Blender")],
    "Linux": ["/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender", "/var/lib/flatpak/exports/bin/org.blender.Blender",
              os.path.join(HOME, ".local", "share", "flatpak", "exports", "bin", "org.blender.Blender"),
              os.path.join(HOME, "blender*", "blender"), os.path.join(HOME, "Downloads", "blender-*", "blender"), "/opt/blender*/blender"],
}


def version_of(path, timeout=30):
    """First run of a fresh Blender can take a while (shader caches, Python start-up); 30 s is generous."""
    try:
        out = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=timeout, stdin=subprocess.DEVNULL).stdout or ""
    except (OSError, subprocess.SubprocessError):
        return None
    m = re.search(r"Blender\s+(\d+)\.(\d+)(?:\.(\d+))?", out)
    return ".".join(g for g in m.groups() if g) if m else None


def at_least(version, minimum):
    def parts(v):
        return tuple(int(x) for x in v.split(".")) + (0, 0, 0)
    return parts(version)[:3] >= parts(minimum)[:3]


def candidates(deep=False):
    seen, out = set(), []

    def add(path, source):
        if path and os.path.isfile(path) and path.lower() not in seen:
            seen.add(path.lower())
            out.append((path, source))

    for name in ENV_NAMES:
        add(os.environ.get(name, ""), name)
    add(shutil.which("blender") or "", "PATH")
    for pat in PATTERNS.get(platform.system(), []):
        for hit in sorted(glob.glob(pat, recursive=True), reverse=True):   # newest version folder first
            add(hit, "standard location")
    if deep and platform.system() == "Windows":
        for root in (HOME, r"C:\Tools", "D:\\"):
            for hit in glob.glob(os.path.join(root, "**", "blender.exe"), recursive=True)[:5]:
                add(hit, "deep scan")
    return out


def find(deep=False, minimum=None):
    searched = candidates(deep)
    for path, source in searched:
        v = version_of(path)
        if v:
            r = {"found": True, "path": path, "version": v, "source": source, "searched": [p for p, _ in searched]}
            if minimum:
                r["min"], r["meets_min"] = minimum, at_least(v, minimum)
            return r
    return {"found": False, "path": None, "version": None, "source": "no runnable candidate",
            "searched": [p for p, _ in searched], "env_checked": list(ENV_NAMES), "patterns": PATTERNS.get(platform.system(), [])}


if __name__ == "__main__":
    mn = sys.argv[sys.argv.index("--min") + 1] if "--min" in sys.argv else None
    print(json.dumps(find("--deep" in sys.argv, mn), indent=2))
