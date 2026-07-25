import json
import os
import sys
import traceback
from pathlib import Path

import bpy
from mathutils import Vector

mesh_dir = Path(os.environ["MESH_DIR"])
out_dir = Path(os.environ["OUTPUT_DIR"])
out_dir.mkdir(parents=True, exist_ok=True)

try:
    with (mesh_dir / "manifest.json").open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    assembly_file = mesh_dir / manifest["exports"][0]["file"]
    if not assembly_file.exists():
        raise FileNotFoundError(assembly_file)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.preferences.addon_enable(module="io_mesh_stl")
    except Exception as exc:
        print("STL addon enable warning:", exc)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 96
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3.0
    scene.eevee.gtao_factor = 1.35
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 825
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0.2
    scene.world.color = (0.012, 0.016, 0.024)

    def make_material(name, base_color, metallic, roughness):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        return material

    metal = make_material("Official Voron Assembly", (0.10, 0.115, 0.14), 0.72, 0.27)
    floor_mat = make_material("Studio Floor", (0.025, 0.03, 0.04), 0.08, 0.68)

    print("Importing official tessellated assembly:", assembly_file)
    if hasattr(bpy.ops.wm, "stl_import"):
        bpy.ops.wm.stl_import(filepath=str(assembly_file))
    else:
        bpy.ops.import_mesh.stl(filepath=str(assembly_file))

    assembly = bpy.context.object
    if assembly is None or assembly.type != "MESH":
        raise RuntimeError("STL import produced no active mesh object")
    assembly.name = "Official_Voron_2.4r2_Assembly"
    assembly.scale = (0.001, 0.001, 0.001)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assembly.data.materials.append(metal)
    for polygon in assembly.data.polygons:
        polygon.use_smooth = True

    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for corner in assembly.bound_box:
        p = assembly.matrix_world @ Vector(corner)
        mins.x = min(mins.x, p.x); mins.y = min(mins.y, p.y); mins.z = min(mins.z, p.z)
        maxs.x = max(maxs.x, p.x); maxs.y = max(maxs.y, p.y); maxs.z = max(maxs.z, p.z)
    center = (mins + maxs) * 0.5
    size = maxs - mins
    radius = max(size.x, size.y, size.z) * 0.72
    print("Bounds metres:", tuple(mins), tuple(maxs))

    bpy.ops.mesh.primitive_plane_add(size=max(5.0, radius * 8.0), location=(center.x, center.y, mins.z - 0.004))
    floor = bpy.context.object
    floor.data.materials.append(floor_mat)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=center)
    target = bpy.context.object

    bpy.ops.object.camera_add(location=(center.x + radius * 1.75, center.y - radius * 1.75, center.z + radius * 1.10))
    camera = bpy.context.object
    camera.data.lens = 54
    camera.data.sensor_width = 36
    scene.camera = camera
    track = camera.constraints.new(type="TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"

    def add_area(name, location, energy, size_value, color):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size_value
        light.data.color = color
        con = light.constraints.new(type="TRACK_TO")
        con.target = target
        con.track_axis = "TRACK_NEGATIVE_Z"
        con.up_axis = "UP_Y"

    add_area("Key", (center.x + radius * 1.5, center.y - radius * 1.3, center.z + radius * 2.0), 1250, radius * 1.25, (1.0, 0.78, 0.62))
    add_area("Fill", (center.x - radius * 1.7, center.y - radius * 0.4, center.z + radius * 1.0), 800, radius * 1.4, (0.58, 0.72, 1.0))
    add_area("Rim", (center.x, center.y + radius * 1.8, center.z + radius * 1.4), 1400, radius * 0.95, (0.66, 0.82, 1.0))

    hero = out_dir / "voron24_official_hero.png"
    scene.render.filepath = str(hero)
    bpy.ops.render.render(write_still=True)

    if not hero.exists() or hero.stat().st_size < 10000:
        raise RuntimeError(f"Verified hero render was not produced: {hero}")

    bpy.ops.wm.save_as_mainfile(filepath=str(out_dir / "voron24_official_scene.blend"))
    print("VERIFIED_RENDER", hero, hero.stat().st_size)
except Exception:
    traceback.print_exc()
    sys.exit(2)
