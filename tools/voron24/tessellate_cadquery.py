import json
import os
import time

import cadquery as cq

step_file = os.environ["STEP_FILE"]
out_dir = os.environ["MESH_DIR"]
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "voron24_assembly.stl")

started = time.time()
print("Importing official Voron STEP with CadQuery/OCP:", step_file, flush=True)
assembly = cq.importers.importStep(step_file)
value = assembly.val()
solids = value.Solids()
bbox = value.BoundingBox()
print("Imported solids:", len(solids), flush=True)
print("Bounding box mm:", bbox.xlen, bbox.ylen, bbox.zlen, flush=True)

print("Tessellating authored assembly to STL", flush=True)
cq.exporters.export(
    assembly,
    out_path,
    exportType="STL",
    tolerance=0.18,
    angularTolerance=0.10,
)

manifest = {
    "source": step_file,
    "importer": "CadQuery/OCP",
    "solid_count": len(solids),
    "bbox_mm": [bbox.xmin, bbox.ymin, bbox.zmin, bbox.xmax, bbox.ymax, bbox.zmax],
    "elapsed_seconds": time.time() - started,
    "exports": [{"category": "assembly", "file": "voron24_assembly.stl", "object_count": len(solids)}],
}
with open(os.path.join(out_dir, "manifest.json"), "w") as handle:
    json.dump(manifest, handle, indent=2)
print("Wrote", out_path, os.path.getsize(out_path), "bytes", flush=True)
