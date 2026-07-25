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
    manifest_path = mesh_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(manifest_path)

    with manifest_path.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    exports = manifest.get("exports") or []
    if not exports or "file" not in exports[0]:
        raise RuntimeError("CAD manifest contains no assembly export")

    assembly_file = mesh_dir / exports[0]["file"]
    if not assembly_file.is_file() or assembly_file.stat().st_size < 1024:
        raise RuntimeError(f"Assembly mesh is missing or empty: {assembly_file}")

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Ubuntu 22.04 supplies Blender 3.0.1. Its STL importer is the legacy
    # io_mesh_stl add-on and the operator is bpy.ops.import_mesh.stl.
    bpy.ops.preferences.addon_enable(module="io_mesh_stl")

    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("Blender did not create a scene")

    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 64
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3.0
    scene.eevee.gtao_factor = 1.35
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 825
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.2
    scene.view_settings.gamma = 1.0

    world = bpy.data.worlds.new("Voron Studio World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = (0.012, 0.016, 0.024, 1.0)
        background.inputs["Strength"].default_value = 0.30
    scene.world = world

    def make_material(name, base_color, metallic, roughness):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf is None:
            raise RuntimeError(f"Principled BSDF unavailable for {name}")
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        return material

    metal = make_material("Official Voron Assembly", (0.10, 0.115, 0.14), 0.72, 0.27)
    floor_mat = make_material("Studio Floor", (0.025, 0.03, 0.04), 0.08, 0.68)

    print("Importing official tessellated assembly:", assembly_file, assembly_file.stat().st_size)
    result = bpy.ops.import_mesh.stl(filepath=str(assembly_file))
    if "FINISHED" not in result:
        raise RuntimeError(f"STL importer returned {result}")

    imported_meshes = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
    if len(imported_meshes) != 1:
        raise RuntimeError(f"Expected one imported assembly mesh, got {len(imported_meshes)}")

    assembly = imported_meshes[0]
    bpy.context.view_layer.objects.active = assembly
    assembly.select_set(True)
    assembly.name = "Official_Voron_2.4r2_Assembly"
    assembly.scale = (0.001, 0.001, 0.001)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assembly.data.materials.append(metal)

    if len(assembly.data.vertices) == 0 or len(assembly.data.polygons) == 0:
        raise RuntimeError("Imported assembly mesh has no geometry")
    print("Assembly mesh:", len(assembly.data.vertices), "vertices,", len(assembly.data.polygons), "triangles")

    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for corner in assembly.bound_box:
        p = assembly.matrix_world @ Vector(corner)
        mins.x = min(mins.x, p.x)
        mins.y = min(mins.y, p.y)
        mins.z = min(mins.z, p.z)
        maxs.x = max(maxs.x, p.x)
        maxs.y = max(maxs.y, p.y)
        maxs.z = max(maxs.z, p.z)

    center = (mins + maxs) * 0.5
    size = maxs - mins
    radius = max(size.x, size.y, size.z) * 0.72
    if radius <= 0.0 or radius > 10.0:
        raise RuntimeError(f"Implausible assembly bounds: {tuple(mins)} to {tuple(maxs)}")
    print("Bounds metres:", tuple(mins), tuple(maxs), "radius", radius)

    bpy.ops.mesh.primitive_plane_add(
        size=max(5.0, radius * 8.0),
        location=(center.x, center.y, mins.z - 0.004),
    )
    floor = bpy.context.object
    floor.name = "Studio Floor"
    floor.data.materials.append(floor_mat)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=center)
    target = bpy.context.object
    target.name = "Camera Target"

    bpy.ops.object.camera_add(
        location=(
            center.x + radius * 1.75,
            center.y - radius * 1.75,
            center.z + radius * 1.10,
        )
    )
    camera = bpy.context.object
    camera.name = "Hero Camera"
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
        light.data.size = max(size_value, 0.1)
        light.data.color = color
        constraint = light.constraints.new(type="TRACK_TO")
        constraint.target = target
        constraint.track_axis = "TRACK_NEGATIVE_Z"
        constraint.up_axis = "UP_Y"
        return light

    add_area("Key", (center.x + radius * 1.5, center.y - radius * 1.3, center.z + radius * 2.0), 1250, radius * 1.25, (1.0, 0.78, 0.62))
    add_area("Fill", (center.x - radius * 1.7, center.y - radius * 0.4, center.z + radius * 1.0), 800, radius * 1.4, (0.58, 0.72, 1.0))
    add_area("Rim", (center.x, center.y + radius * 1.8, center.z + radius * 1.4), 1400, radius * 0.95, (0.66, 0.82, 1.0))

    bpy.context.view_layer.update()
    if scene.camera is None:
        raise RuntimeError("No active camera before render")

    hero = out_dir / "voron24_official_hero.png"
    scene.render.filepath = str(hero)
    bpy.ops.render.render(write_still=True)

    if not hero.is_file() or hero.stat().st_size < 10000:
        raise RuntimeError(f"Verified hero render was not produced: {hero}")

    blend_file = out_dir / "voron24_official_scene.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_file))
    if not blend_file.is_file() or blend_file.stat().st_size < 10000:
        raise RuntimeError("Blend scene save failed")

    print("VERIFIED_RENDER", hero, hero.stat().st_size)
except Exception:
    traceback.print_exc()
    sys.exit(2)
