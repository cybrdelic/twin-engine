import json
import os

import FreeCAD as App
import Import
import Mesh

step_file = os.environ["STEP_FILE"]
out_dir = os.environ["MESH_DIR"]
os.makedirs(out_dir, exist_ok=True)

print("Importing official STEP assembly:", step_file)
doc = App.newDocument("Voron24")
Import.insert(step_file, doc.Name)
doc.recompute()

groups = {
    "metal": [],
    "printed": [],
    "panels": [],
    "belts": [],
    "bed": [],
    "electronics": [],
}

metal_words = ("extrusion", "rail", "shaft", "bearing", "screw", "bolt", "nut", "washer", "pulley", "gear", "motor", "stepper", "spring", "plate")
panel_words = ("panel", "door", "window", "acrylic", "polycarbonate")
belt_words = ("belt", "foot", "bumper", "seal")
bed_words = ("bed", "heater", "build plate")
electronics_words = ("pcb", "raspberry", "controller", "power supply", "psu", "display", "screen", "fan")

records = []
for obj in doc.Objects:
    if not hasattr(obj, "Shape"):
        continue
    try:
        if obj.Shape.isNull() or len(obj.Shape.Faces) == 0:
            continue
    except Exception:
        continue

    label = (getattr(obj, "Label", "") or getattr(obj, "Name", "") or "part").lower()
    if any(word in label for word in panel_words):
        category = "panels"
    elif any(word in label for word in bed_words):
        category = "bed"
    elif any(word in label for word in belt_words):
        category = "belts"
    elif any(word in label for word in electronics_words):
        category = "electronics"
    elif any(word in label for word in metal_words):
        category = "metal"
    else:
        category = "printed"
    groups[category].append(obj)
    records.append({"label": getattr(obj, "Label", ""), "name": getattr(obj, "Name", ""), "category": category})

exports = []
for category, objects in groups.items():
    if not objects:
        continue
    path = os.path.join(out_dir, category + ".stl")
    print("Exporting", category, len(objects), "objects ->", path)
    Mesh.export(objects, path)
    exports.append({"category": category, "file": category + ".stl", "object_count": len(objects)})

with open(os.path.join(out_dir, "manifest.json"), "w") as handle:
    json.dump({"source": step_file, "object_count": len(records), "exports": exports, "objects": records}, handle, indent=2)

print("Finished grouped STEP tessellation:", len(records), "objects in", len(exports), "mesh groups")
if not exports:
    raise RuntimeError("No STEP geometry was exported")
