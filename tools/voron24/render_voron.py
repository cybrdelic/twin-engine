import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

mesh_dir = Path(os.environ["MESH_DIR"])
out_dir = Path(os.environ["OUTPUT_DIR"])
out_dir.mkdir(parents=True, exist_ok=True)

with (mesh_dir / "manifest.json").open("r", encoding="utf-8") as handle:
    manifest = json.load(handle)
metadata = {p["file"]: p for p in manifest["parts"]}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 64
scene.eevee.use_gtao = True
scene.eevee.gtao_distance = 3.0
scene.eevee.gtao_factor = 1.25
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0.15
scene.view_settings.gamma = 1.0
scene.world.color = (0.018, 0.022, 0.030)


def material(name, color, metallic=0.0, roughness=0.4, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        bsdf.inputs["Transmission"].default_value = 0.15
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True
        mat.show_transparent_back = False
    return mat

mats = {
    "metal": material("Anodized aluminum", (0.23, 0.26, 0.30), 0.82, 0.22),
    "steel": material("Machined steel", (0.42, 0.45, 0.48), 0.92, 0.18),
    "black": material("Black printed polymer", (0.018, 0.022, 0.028), 0.05, 0.32),
    "accent": material("Voron red", (0.62, 0.018, 0.012), 0.12, 0.26),
    "bed": material("Build plate", (0.075, 0.082, 0.09), 0.34, 0.36),
    "glass": material("Polycarbonate panels", (0.16, 0.21, 0.25), 0.08, 0.12, 0.22),
    "rubber": material("Belts and rubber", (0.012, 0.012, 0.014), 0.0, 0.78),
    "electronics": material("Electronics", (0.035, 0.08, 0.045), 0.15, 0.38),
}

metal_words = ("extrusion", "rail", "shaft", "bearing", "screw", "bolt", "nut", "washer", "pulley", "gear", "motor", "stepper", "plate", "bracket", "spring")
steel_words = ("linear rail", "mgn", "rod", "bearing", "screw", "bolt", "washer", "shaft")
accent_words = ("[a]", "accent", "latch", "knob", "logo")
glass_words = ("panel", "door", "window", "acrylic", "polycarbonate")
rubber_words = ("belt", "foot", "bumper", "seal")
bed_words = ("bed", "build plate", "heater")
electronics_words = ("pcb", "raspberry", "controller", "power supply", "psu", "display", "fan")


def classify(label: str):
    text = label.lower()
    if any(w in text for w in glass_words):
        return mats["glass"]
    if any(w in text for w in bed_words):
        return mats["bed"]
    if any(w in text for w in rubber_words):
        return mats["rubber"]
    if any(w in text for w in electronics_words):
        return mats["electronics"]
    if any(w in text for w in accent_words):
        return mats["accent"]
    if any(w in text for w in steel_words):
        return mats["steel"]
    if any(w in text for w in metal_words):
        return mats["metal"]
    # Authored printed parts default to black, with deterministic red accents.
    checksum = sum(ord(c) for c in text)
    return mats["accent"] if checksum % 13 == 0 else mats["black"]

stl_files = sorted(mesh_dir.glob("*.stl"))
print(f"Importing {len(stl_files)} tessellated authored solids")
for i, stl_path in enumerate(stl_files):
    bpy.ops.import_mesh.stl(filepath=str(stl_path))
    obj = bpy.context.object
    info = metadata.get(stl_path.name, {})
    label = info.get("label", stl_path.stem)
    obj.name = label[:63]
    obj.scale = (0.001, 0.001, 0.001)  # STEP/STL millimetres -> metres
    obj.data.materials.append(classify(label))
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if len(obj.data.polygons) < 200000:
        bevel = obj.modifiers.new("Manufacturing edge bevel", "BEVEL")
        bevel.width = 0.00035
        bevel.segments = 2
        bevel.limit_method = "ANGLE"
        bevel.angle_limit = math.radians(32)
        normal = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
    if (i + 1) % 100 == 0:
        print(f"Imported {i + 1}/{len(stl_files)}")

# Bounds after applying scale.
objects = [o for o in scene.objects if o.type == "MESH"]
mins = Vector((1e9, 1e9, 1e9))
maxs = Vector((-1e9, -1e9, -1e9))
for obj in objects:
    for corner in obj.bound_box:
        world = obj.matrix_world @ Vector(corner)
        mins.x = min(mins.x, world.x); mins.y = min(mins.y, world.y); mins.z = min(mins.z, world.z)
        maxs.x = max(maxs.x, world.x); maxs.y = max(maxs.y, world.y); maxs.z = max(maxs.z, world.z)
center = (mins + maxs) * 0.5
size = maxs - mins
radius = max(size.x, size.y, size.z) * 0.72
print("Assembly bounds", tuple(mins), tuple(maxs), "center", tuple(center))

# Ground cyclorama.
bpy.ops.mesh.primitive_plane_add(size=max(5.0, radius * 8.0), location=(center.x, center.y, mins.z - 0.002))
ground = bpy.context.object
ground.name = "Studio floor"
ground.data.materials.append(material("Studio floor", (0.032, 0.037, 0.045), 0.05, 0.66))

# Target and camera.
bpy.ops.object.empty_add(type="PLAIN_AXES", location=center)
target = bpy.context.object
bpy.ops.object.camera_add(location=(center.x + radius * 1.7, center.y - radius * 1.7, center.z + radius * 1.15))
camera = bpy.context.object
scene.camera = camera
camera.data.lens = 55
camera.data.sensor_width = 36
constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

# Area-key, fill, and rim lights.
def area(name, location, energy, size_value, color):
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
    return light

area("Key softbox", (center.x + radius * 1.4, center.y - radius * 1.2, center.z + radius * 2.1), 1100, radius * 1.2, (1.0, 0.78, 0.62))
area("Fill softbox", (center.x - radius * 1.8, center.y - radius * 0.3, center.z + radius * 1.0), 700, radius * 1.4, (0.58, 0.72, 1.0))
area("Rim strip", (center.x, center.y + radius * 1.8, center.z + radius * 1.5), 1200, radius * 0.9, (0.65, 0.78, 1.0))

# Hero image.
scene.render.filepath = str(out_dir / "voron24_official_hero.png")
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)

# Orbit animation around the actual assembly.
scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "HIGH"
scene.render.ffmpeg.ffmpeg_preset = "GOOD"
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 72
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.filepath = str(out_dir / "voron24_official_orbit.mp4")
for frame in range(scene.frame_start, scene.frame_end + 1):
    angle = 2.0 * math.pi * (frame - 1) / (scene.frame_end - scene.frame_start + 1)
    camera.location = (
        center.x + math.cos(angle) * radius * 2.15,
        center.y + math.sin(angle) * radius * 2.15,
        center.z + radius * (0.95 + 0.12 * math.sin(angle * 2.0)),
    )
    camera.keyframe_insert(data_path="location", frame=frame)
for curve in camera.animation_data.action.fcurves:
    for point in curve.keyframe_points:
        point.interpolation = "LINEAR"
bpy.ops.render.render(animation=True)

# Save the renderable assembly scene for later twin-engine material/animation work.
bpy.ops.wm.save_as_mainfile(filepath=str(out_dir / "voron24_official_scene.blend"))
print("Rendered official Voron 2.4 assembly")
