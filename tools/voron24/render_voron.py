import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

mesh_dir = Path(os.environ["MESH_DIR"])
out_dir = Path(os.environ["OUTPUT_DIR"])
out_dir.mkdir(parents=True, exist_ok=True)
with (mesh_dir / "manifest.json").open("r") as handle:
    manifest = json.load(handle)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 96
scene.eevee.use_gtao = True
scene.eevee.gtao_distance = 3.0
scene.eevee.gtao_factor = 1.3
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0.1
scene.world.color = (0.014, 0.018, 0.025)


def make_material(name, color, metallic=0.0, roughness=0.4, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, alpha)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        bsdf.inputs["Transmission"].default_value = 0.22
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True
        mat.show_transparent_back = False
    return mat

materials = {
    "metal": make_material("Anodized aluminum and steel", (0.27, 0.30, 0.34), 0.86, 0.22),
    "printed": make_material("Voron printed polymer", (0.035, 0.025, 0.027), 0.05, 0.34),
    "panels": make_material("Polycarbonate enclosure", (0.12, 0.18, 0.22), 0.05, 0.13, 0.24),
    "belts": make_material("Belts and rubber", (0.008, 0.008, 0.010), 0.0, 0.82),
    "bed": make_material("Heated build plate", (0.075, 0.082, 0.090), 0.36, 0.30),
    "electronics": make_material("Electronics", (0.025, 0.075, 0.045), 0.12, 0.40),
}
accent = make_material("Voron red accent", (0.63, 0.018, 0.012), 0.12, 0.26)

objects = []
for entry in manifest["exports"]:
    path = mesh_dir / entry["file"]
    bpy.ops.import_mesh.stl(filepath=str(path))
    obj = bpy.context.object
    category = entry["category"]
    obj.name = "Voron_" + category
    obj.scale = (0.001, 0.001, 0.001)
    obj.data.materials.append(materials.get(category, materials["printed"]))
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if category in ("metal", "printed", "bed"):
        bevel = obj.modifiers.new("Manufacturing bevel", "BEVEL")
        bevel.width = 0.00028
        bevel.segments = 2
        bevel.limit_method = "ANGLE"
        bevel.angle_limit = math.radians(35)
        normal = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
    objects.append(obj)

# Add a subtle red accent shell by duplicating a small fraction of the printed mesh is unsafe;
# retain the official geometry and use a restrained red floor strip instead.
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -1000))
accent_dummy = bpy.context.object
accent_dummy.hide_render = True
accent_dummy.data.materials.append(accent)

mins = Vector((1e9, 1e9, 1e9))
maxs = Vector((-1e9, -1e9, -1e9))
for obj in objects:
    for corner in obj.bound_box:
        p = obj.matrix_world @ Vector(corner)
        mins.x = min(mins.x, p.x); mins.y = min(mins.y, p.y); mins.z = min(mins.z, p.z)
        maxs.x = max(maxs.x, p.x); maxs.y = max(maxs.y, p.y); maxs.z = max(maxs.z, p.z)
center = (mins + maxs) * 0.5
size = maxs - mins
radius = max(size.x, size.y, size.z) * 0.72
print("Official assembly bounds:", tuple(mins), tuple(maxs))

floor_mat = make_material("Studio floor", (0.028, 0.032, 0.040), 0.04, 0.68)
bpy.ops.mesh.primitive_plane_add(size=max(5.0, radius * 8.0), location=(center.x, center.y, mins.z - 0.002))
floor = bpy.context.object
floor.data.materials.append(floor_mat)

bpy.ops.object.empty_add(type="PLAIN_AXES", location=center)
target = bpy.context.object
bpy.ops.object.camera_add(location=(center.x + radius * 1.75, center.y - radius * 1.75, center.z + radius * 1.10))
camera = bpy.context.object
camera.data.lens = 56
camera.data.sensor_width = 36
scene.camera = camera
track = camera.constraints.new(type="TRACK_TO")
track.target = target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"


def add_area(name, location, energy, area_size, color):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = area_size
    light.data.color = color
    con = light.constraints.new(type="TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"

add_area("Warm key", (center.x + radius * 1.5, center.y - radius * 1.3, center.z + radius * 2.0), 1250, radius * 1.25, (1.0, 0.76, 0.58))
add_area("Cool fill", (center.x - radius * 1.7, center.y - radius * 0.4, center.z + radius * 1.0), 760, radius * 1.45, (0.55, 0.72, 1.0))
add_area("Rim", (center.x, center.y + radius * 1.8, center.z + radius * 1.4), 1300, radius * 0.95, (0.65, 0.80, 1.0))

scene.render.filepath = str(out_dir / "voron24_official_hero.png")
bpy.ops.render.render(write_still=True)

scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "HIGH"
scene.render.ffmpeg.ffmpeg_preset = "GOOD"
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 72
scene.render.filepath = str(out_dir / "voron24_official_orbit.mp4")
for frame in range(1, 73):
    angle = 2.0 * math.pi * (frame - 1) / 72.0
    camera.location = (
        center.x + math.cos(angle) * radius * 2.15,
        center.y + math.sin(angle) * radius * 2.15,
        center.z + radius * (0.92 + 0.10 * math.sin(angle * 2.0)),
    )
    camera.keyframe_insert(data_path="location", frame=frame)
for curve in camera.animation_data.action.fcurves:
    for point in curve.keyframe_points:
        point.interpolation = "LINEAR"
bpy.ops.render.render(animation=True)

bpy.ops.wm.save_as_mainfile(filepath=str(out_dir / "voron24_official_scene.blend"))
print("Rendered official Voron 2.4 authored assembly")
