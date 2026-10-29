"""Write the glTF exporter's real option table for THIS Blender (names, types, defaults, enum items) to JSON and
Markdown, so nobody copies an option list from a blog post that this Blender rejects.

    blender -b --factory-startup --python-exit-code 1 --python export_options_dump.py -- --out gltf-options
    python blender_run.py --script blender/export_options_dump.py --expect gltf-options.json -- --out gltf-options

The exporter is an add-on bundled with Blender (enabled under --factory-startup). An unknown keyword raises TypeError
and the option set changes between releases (111 options in the add-on version studied for this skill), so the table
is generated from bpy.ops.export_scene.gltf.get_rna_type() at run time, never written by hand.

verified: type-checked against the fake-bpy-module-latest stubs (20261024) with scripts/check_bpy.py; the add-on
          operator itself is not in the stubs, so its calls were checked only by reading the exporter's documented use.
not verified: NOT RUN IN BLENDER (none installed where this was written). Prints EXPORTED <path> when done.
Original code of this project.
"""
import json
import sys

import bpy


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else "gltf-options"
    rna = bpy.ops.export_scene.gltf.get_rna_type()
    rows = []
    for p in rna.properties:
        if p.identifier == "rna_type":
            continue
        row: dict = {"id": p.identifier, "type": p.type, "name": p.name, "description": p.description}
        if p.type == "ENUM":
            row["items"] = [i.identifier for i in p.enum_items]
            row["default"] = sorted(p.default_flag) if p.is_enum_flag else p.default
        elif getattr(p, "is_array", False):
            row["default"] = list(p.default_array)
        elif p.type in {"BOOLEAN", "INT", "FLOAT", "STRING"}:
            row["default"] = p.default
        rows.append(row)
    rows.sort(key=lambda r: r["id"])
    meta = {"blender": bpy.app.version_string, "count": len(rows), "options": rows}
    with open(out + ".json", "w", encoding="utf-8", newline="\n") as fh:
        json.dump(meta, fh, indent=1)
    with open(out + ".md", "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"# glTF exporter options, Blender {bpy.app.version_string} ({len(rows)} options)\n\n")
        fh.write("| Option | Type | Default | Items |\n|---|---|---|---|\n")
        for r in rows:
            fh.write(f"| `{r['id']}` | {r['type']} | `{r.get('default', '')}` | {', '.join(r.get('items', []))} |\n")
    print("EXPORTED", out + ".json")


if __name__ == "__main__":
    main()
