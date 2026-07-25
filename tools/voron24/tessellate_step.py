import json
import os
import re
import sys

import FreeCAD as App
import Import
import Mesh

step_file = os.environ["STEP_FILE"]
out_dir = os.environ["MESH_DIR"]
os.makedirs(out_dir, exist_ok=True)

def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value.strip())
    return value[:120] or "part"

print(f"Importing STEP assembly: {step_file}")
doc = App.newDocument("Voron24")
Import.insert(step_file, doc.Name)
doc.recompute()

manifest = []
used = {}
exported = 0
for index, obj in enumerate(doc.Objects):
    if not hasattr(obj, "Shape"):
        continue
    shape = obj.Shape
    try:
        if shape.isNull() or len(shape.Faces) == 0:
            continue
    except Exception:
        continue

    label = getattr(obj, "Label", "") or getattr(obj, "Name", "") or f"part_{index:05d}"
    base = safe_name(label)
    used[base] = used.get(base, 0) + 1
    filename = f"{index:05d}_{base}_{used[base]:03d}.stl"
    path = os.path.join(out_dir, filename)

    try:
        Mesh.export([obj], path)
        bbox = shape.BoundBox
        manifest.append({
            "file": filename,
            "name": getattr(obj, "Name", ""),
            "label": label,
            "volume": float(getattr(shape, "Volume", 0.0)),
            "bbox": [bbox.XMin, bbox.YMin, bbox.ZMin, bbox.XMax, bbox.YMax, bbox.ZMax],
        })
        exported += 1
        if exported % 100 == 0:
            print(f"Exported {exported} solids")
    except Exception as exc:
        print(f"Skipping {label}: {exc}", file=sys.stderr)

with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as handle:
    json.dump({"source": step_file, "part_count": exported, "parts": manifest}, handle, indent=2)

print(f"Finished: {exported} authored solids exported")
if exported == 0:
    raise RuntimeError("No STEP solids were exported")
