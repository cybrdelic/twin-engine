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
scene.eevee.taa_render_samples = 80
scene.eevee.use_gtao = True
scene.eevee.gtao_distance = 3.0
scene.eevee.gtao_factor = 1.25
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0.12
scene.world.color = (0.012, 0.016, 0.024)


def mat(name, color, metallic=0.0, roughness=0.4, alpha=1.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, alpha)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        bsdf.inputs["Transmission"].default_value = 0.20
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
        material.show_transparent_back = False
    return material

metal = mat("Anodized aluminum", (0.25, 0.28, 0.32), 0.86, 0.23)
steel = mat("Machined steel", (0.48, 0.50, 0.52), 0.94, 0.18)
black = mat("Black printed polymer", (0.018, 0.021, 0.027), 0.04, 0.34)
red = mat("Voron red", (0.64, 0.015, 0.010), 0.10, 0.27)
glass = mat("Polycarbonate panels", (0.10, 0.17, 0.22), 0.03, 0.14, 0.22)
bed = mat("Build plate", (0.065, 0.072, 0.080), 0.38, 0.31)
rubber = mat("Belts and rubber", (0.006, 0.006, 0.008), 0.0, 0.86)
green = mat("Electronics", (0.025, 0.075, 0.043), 0.10, 0.42)
floor_mat = mat("Studio floor", (0.025, 0.029, 0.036), 0.03, 0.70)

assembly_file = mesh_dir / manifest["exports"][0]["file"]
bpy.ops.import_mesh.stl(filepath=str(assembly_file))
assembly = bpy.context.object
assembly.name = "Official_Voron24_Assembly"
assembly.scale = (0.001, 0.001, 0.001)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# The STEP assembly was exported as one STL containing disconnected authored solids.
# Recover those solids so each can receive a mechanically plausible material.
bpy.context.view_layer.objects.active = assembly
assembly.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
objects = [obj for obj in scene.objects if obj.type == "MESH"]
print("Separated authored solids:", len(objects))

# Determine global bounds first.
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

for index, obj in enumerate(objects):
    dims = sorted([abs(obj.dimensions.x), abs(obj.dimensions.y), abs(obj.dimensions.z)])
    thin, mid, long = dims
    world_center = obj.matrix_world.translation
    if thin < 0.007 and long > 0.24 and mid > 0.16:
        chosen = bed if abs(world_center.z - center.z) < size.z * 0.18 else glass
    elif long > 0.22 and mid < 0.055:
        chosen = metal
    elif long < 0.035 and mid < 0.025:
        chosen = steel
    elif thin < 0.004 and long > 0.10:
        chosen = rubber
    elif world_center.z < mins.z + size.z * 0.22 and index % 9 == 0:
        chosen = green
    else:
        chosen = red if index % 11 == 0 else black
    obj.data.materials.clear()
    obj.data.materials.append(chosen)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

print("Official assembly bounds:", tuple(mins), tuple(maxs))

bpy.ops.mesh.primitive_plane_add(size=max(5.0, radius * 8.0), location=(center.x, center.y, mins.z - 0.002))
floor = bpy.context.object
floor.data.materials.append(floor_mat)

bpy.ops.object.empty_add(type="PLAIN_AXES", location=center)
target = bpy.context.object
bpy.ops.object.camera_add(location=(center.x + radius * 1.72, center.y - radius * 1.72, center.z + radius * 1.08))
camera = bpy.context.object
camera.data.lens = 56
camera.data.sensor_width = 36
scene.camera = camera
track = camera.constraints.new(type="TRACK_TO")
track.target = target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"


def area(name, location, energy, area_size, color):
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

area("Warm key", (center.x + radius * 1.5, center.y - radius * 1.3, center.z + radius * 2.0), 1250, radius * 1.25, (1.0, 0.76, 0.58))
area("Cool fill", (center.x - radius * 1.7, center.y - radius * 0.4, center.z + radius * 1.0), 760, radius * 1.45, (0.55, 0.72, 1.0))
area("Rim", (center.x, center.y + radius * 1.8, center.z + radius * 1.4), 1300, radius * 0.95, (0.65, 0.80, 1.0))

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
